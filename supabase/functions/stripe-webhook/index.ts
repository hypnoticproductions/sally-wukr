import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, stripe-signature",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
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
      console.error("Webhook signature verification failed:", err);
      return new Response(
        JSON.stringify({ error: "Webhook signature verification failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const clientId = session.metadata?.client_id;

      if (!clientId) {
        console.error("No client_id in session metadata");
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
        console.error("Failed to update client:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update client" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: transactionError } = await supabase
        .from("payment_transactions")
        .insert({
          client_id: clientId,
          stripe_payment_intent_id: session.payment_intent as string,
          amount: amountPaid,
          status: "succeeded",
          payment_method: session.payment_method_types?.[0] || "unknown",
          metadata: {
            session_id: session.id,
            customer_email: session.customer_email,
          },
        });

      if (transactionError) {
        console.error("Failed to record transaction:", transactionError);
      }

      console.log(`Payment processed for client ${clientId}`);
    }

    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      console.log(`Payment failed for intent ${paymentIntent.id}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Webhook processing failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
