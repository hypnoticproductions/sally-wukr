import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, stripe-signature",
};

async function logError(
  supabase: any,
  errorType: string,
  severity: string,
  message: string,
  context: Record<string, any> = {},
  stackTrace?: string
) {
  try {
    await supabase.from("error_logs").insert({
      source: "stripe-webhook",
      error_type: errorType,
      severity,
      message,
      context,
      stack_trace: stackTrace,
    });
  } catch (e) {
    console.error("Failed to log error:", e);
  }
}

async function logWebhook(
  supabase: any,
  eventType: string,
  payload: any,
  status: string,
  processingTimeMs: number,
  errorMessage?: string
) {
  try {
    const { data } = await supabase.from("webhook_logs").insert({
      source: "stripe",
      event_type: eventType,
      payload,
      status,
      processing_time_ms: processingTimeMs,
      error_message: errorMessage,
      processed_at: new Date().toISOString(),
    }).select().single();

    if (status === "failed" && data) {
      await supabase.from("webhook_failures").insert({
        webhook_log_id: data.id,
        source: "stripe",
        event_type: eventType,
        failure_reason: errorMessage || "Unknown error",
        payload,
        status: "pending",
        next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
    }
  } catch (e) {
    console.error("Failed to log webhook:", e);
  }
}

Deno.serve(async (req: Request) => {
  const startTime = Date.now();

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  let supabase: any;
  let eventType = "unknown";
  let eventPayload: any = {};

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!stripeSecretKey || !webhookSecret) {
      throw new Error("Stripe configuration missing");
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
    });

    supabase = createClient(supabaseUrl, supabaseServiceKey);

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      await logError(supabase, "webhook_failure", "high", "Missing Stripe signature", {
        headers: Object.fromEntries(req.headers.entries()),
      });
      return new Response(
        JSON.stringify({ error: "No signature provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      await logError(supabase, "webhook_failure", "high", "Webhook signature verification failed", {
        error: errorMessage,
      }, err instanceof Error ? err.stack : undefined);
      await logWebhook(supabase, "signature_failed", {}, "failed", Date.now() - startTime, errorMessage);
      return new Response(
        JSON.stringify({ error: "Webhook signature verification failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    eventType = event.type;
    eventPayload = event.data.object;

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const clientId = session.metadata?.client_id;

      if (!clientId) {
        await logError(supabase, "payment_failure", "high", "No client_id in session metadata", {
          session_id: session.id,
          customer_email: session.customer_email,
        });
        await logWebhook(supabase, eventType, eventPayload, "failed", Date.now() - startTime, "No client_id found");
        return new Response(JSON.stringify({ error: "No client_id found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const amountPaid = (session.amount_total || 0) / 100;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const { error: updateError } = await supabase
        .from("clients")
        .update({
          payment_status: "paid",
          profile_expires_at: expiresAt.toISOString(),
          payment_date: new Date().toISOString(),
          total_paid: amountPaid,
        })
        .eq("id", clientId);

      if (updateError) {
        await logError(supabase, "database_error", "critical", "Failed to update client after payment", {
          client_id: clientId,
          error: updateError.message,
          session_id: session.id,
        });
        await logWebhook(supabase, eventType, eventPayload, "failed", Date.now() - startTime, updateError.message);
        return new Response(
          JSON.stringify({ error: "Failed to update client" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const productType = session.metadata?.product_type || 'profile_retention';

      const { error: transactionError } = await supabase
        .from("payment_transactions")
        .insert({
          client_id: clientId,
          product_type: productType,
          stripe_payment_intent_id: session.payment_intent as string,
          stripe_session_id: session.id,
          amount: amountPaid,
          status: "succeeded",
          payment_method: session.payment_method_types?.[0] || "unknown",
          payment_date: new Date().toISOString(),
          metadata: {
            session_id: session.id,
            customer_email: session.customer_email,
            product_type: productType,
          },
        });

      if (transactionError) {
        await logError(supabase, "database_error", "medium", "Failed to record payment transaction", {
          client_id: clientId,
          error: transactionError.message,
          session_id: session.id,
        });
      }

      const manusApiKey = Deno.env.get("MANUS_API_KEY");
      if (manusApiKey) {
        try {
          const manusSyncUrl = `${supabaseUrl}/functions/v1/manus-sync`;
          const manusSyncResponse = await fetch(manusSyncUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ clientId }),
          });

          if (!manusSyncResponse.ok) {
            await logError(supabase, "service_unavailable", "medium", "Failed to sync with Manus", {
              client_id: clientId,
              status: manusSyncResponse.status,
              response: await manusSyncResponse.text(),
            });
          }
        } catch (manusError) {
          await logError(supabase, "service_unavailable", "medium", "Manus sync error", {
            client_id: clientId,
            error: manusError instanceof Error ? manusError.message : "Unknown error",
          });
        }
      }

      await logWebhook(supabase, eventType, eventPayload, "success", Date.now() - startTime);
    }

    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const lastError = paymentIntent.last_payment_error;

      await logError(supabase, "payment_failure", "critical", "Payment failed", {
        payment_intent_id: paymentIntent.id,
        customer_id: paymentIntent.customer,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        error_code: lastError?.code,
        error_message: lastError?.message,
        decline_code: lastError?.decline_code,
        payment_method_type: lastError?.payment_method?.type,
      });

      await logWebhook(supabase, eventType, eventPayload, "success", Date.now() - startTime);
    }

    if (event.type === "charge.failed") {
      const charge = event.data.object as Stripe.Charge;

      await logError(supabase, "payment_failure", "high", "Charge failed", {
        charge_id: charge.id,
        customer_id: charge.customer,
        amount: charge.amount / 100,
        currency: charge.currency,
        failure_code: charge.failure_code,
        failure_message: charge.failure_message,
      });

      await logWebhook(supabase, eventType, eventPayload, "success", Date.now() - startTime);
    }

    if (event.type === "charge.dispute.created") {
      const dispute = event.data.object as Stripe.Dispute;

      await logError(supabase, "payment_failure", "critical", "Payment disputed", {
        dispute_id: dispute.id,
        charge_id: dispute.charge,
        amount: dispute.amount / 100,
        currency: dispute.currency,
        reason: dispute.reason,
        status: dispute.status,
      });

      await logWebhook(supabase, eventType, eventPayload, "success", Date.now() - startTime);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const stackTrace = error instanceof Error ? error.stack : undefined;

    if (supabase) {
      await logError(supabase, "function_error", "critical", "Webhook processing error", {
        event_type: eventType,
        error: errorMessage,
      }, stackTrace);
      await logWebhook(supabase, eventType, eventPayload, "failed", Date.now() - startTime, errorMessage);
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
