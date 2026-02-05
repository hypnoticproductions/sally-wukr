import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CALENDLY_ACCESS_TOKEN = Deno.env.get("CALENDLY_ACCESS_TOKEN");
const CALENDLY_API_BASE = "https://api.calendly.com";

interface CalendlyWebhookPayload {
  event: string;
  created_at: string;
  payload: {
    uri: string;
    email: string;
    name: string;
    status: string;
    timezone: string;
    event: string;
    questions_and_answers?: Array<{
      question: string;
      answer: string;
    }>;
    tracking?: {
      utm_campaign?: string;
      utm_source?: string;
      utm_medium?: string;
      utm_content?: string;
      utm_term?: string;
    };
    rescheduled?: boolean;
    old_invitee?: string;
    new_invitee?: string;
    cancel_url?: string;
    reschedule_url?: string;
    cancellation?: {
      canceled_by: string;
      reason?: string;
    };
  };
}

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
      source: "calendly-webhook",
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
      source: "calendly",
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
        source: "calendly",
        event_type: eventType,
        failure_reason: errorMessage || "Unknown error",
        payload,
        status: "pending",
        next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
    }

    return data;
  } catch (e) {
    console.error("Failed to log webhook:", e);
    return null;
  }
}

async function fetchEventDetails(inviteeUri: string, supabase: any) {
  try {
    const response = await fetch(inviteeUri, {
      headers: {
        "Authorization": `Bearer ${CALENDLY_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      await logError(supabase, "service_unavailable", "medium", "Calendly API error", {
        status: response.status,
        invitee_uri: inviteeUri,
      });
      return null;
    }

    const data = await response.json();
    return data.resource;
  } catch (error) {
    await logError(supabase, "service_unavailable", "medium", "Error fetching event details from Calendly", {
      invitee_uri: inviteeUri,
      error: error instanceof Error ? error.message : "Unknown error",
    }, error instanceof Error ? error.stack : undefined);
    return null;
  }
}

async function getOrCreateClient(supabase: any, email: string, name: string) {
  const { data: existingClient } = await supabase
    .from("clients")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (existingClient) {
    return existingClient;
  }

  const nameParts = name.split(" ");
  const firstName = nameParts[0] || "";
  const company = nameParts.length > 1 ? "Unknown" : "Unknown";

  const { data: newClient, error } = await supabase
    .from("clients")
    .insert({
      name: name,
      email: email,
      company: company,
      payment_status: "free",
      client_value_score: 0,
      returning_client: false,
    })
    .select()
    .single();

  if (error) {
    await logError(supabase, "database_error", "high", "Error creating client", {
      email,
      name,
      error: error.message,
    });
    return null;
  }

  return newClient;
}

async function handleInviteeCreated(supabase: any, payload: CalendlyWebhookPayload) {
  const { email, name, uri: inviteeUri, event: eventUri } = payload.payload;

  const client = await getOrCreateClient(supabase, email, name);
  if (!client) {
    throw new Error("Failed to create or fetch client");
  }

  const eventDetails = await fetchEventDetails(inviteeUri, supabase);

  let eventStartTime = null;
  let eventEndTime = null;
  let meetingLink = null;

  if (eventDetails) {
    eventStartTime = eventDetails.start_time;
    eventEndTime = eventDetails.end_time;
    meetingLink = eventDetails.location?.join_url || null;
  }

  const { data: consultation, error } = await supabase
    .from("consultations")
    .insert({
      client_id: client.id,
      event_uri: eventUri,
      invitee_uri: inviteeUri,
      scheduled_at: payload.created_at,
      event_start_time: eventStartTime,
      event_end_time: eventEndTime,
      status: "scheduled",
      meeting_link: meetingLink,
      rescheduled: payload.payload.rescheduled || false,
      old_invitee_uri: payload.payload.old_invitee || null,
      questions_and_answers: payload.payload.questions_and_answers || null,
      timezone: payload.payload.timezone,
      tracking_data: payload.payload.tracking || null,
    })
    .select()
    .single();

  if (error) {
    await logError(supabase, "database_error", "high", "Error creating consultation", {
      client_id: client.id,
      invitee_uri: inviteeUri,
      error: error.message,
    });
    throw error;
  }

  const { error: updateError } = await supabase
    .from("clients")
    .update({
      has_active_consultation: true,
      consultation_count: client.consultation_count + 1,
    })
    .eq("id", client.id);

  if (updateError) {
    await logError(supabase, "database_error", "medium", "Error updating client consultation status", {
      client_id: client.id,
      error: updateError.message,
    });
  }

  return consultation;
}

async function handleInviteeCanceled(supabase: any, payload: CalendlyWebhookPayload) {
  const { uri: inviteeUri } = payload.payload;
  const isRescheduled = payload.payload.rescheduled || false;

  const { data: consultation } = await supabase
    .from("consultations")
    .select("*")
    .eq("invitee_uri", inviteeUri)
    .maybeSingle();

  if (!consultation) {
    await logError(supabase, "webhook_failure", "low", "No consultation found for cancellation", {
      invitee_uri: inviteeUri,
    });
    return;
  }

  const updateData: any = {
    status: isRescheduled ? "rescheduled" : "cancelled",
    cancellation_reason: payload.payload.cancellation?.reason || null,
    canceled_by: payload.payload.cancellation?.canceled_by || null,
  };

  const { error: updateError } = await supabase
    .from("consultations")
    .update(updateData)
    .eq("id", consultation.id);

  if (updateError) {
    await logError(supabase, "database_error", "medium", "Error updating consultation cancellation", {
      consultation_id: consultation.id,
      error: updateError.message,
    });
  }

  const { data: upcomingConsultations } = await supabase
    .from("consultations")
    .select("id")
    .eq("client_id", consultation.client_id)
    .eq("status", "scheduled")
    .gte("event_start_time", new Date().toISOString());

  const hasActiveConsultation = upcomingConsultations && upcomingConsultations.length > 0;

  await supabase
    .from("clients")
    .update({ has_active_consultation: hasActiveConsultation })
    .eq("id", consultation.client_id);
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
  let payload: CalendlyWebhookPayload | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    supabase = createClient(supabaseUrl, supabaseServiceKey);

    payload = await req.json();
    eventType = payload?.event || "unknown";

    if (payload?.event === "invitee.created") {
      await handleInviteeCreated(supabase, payload);
    } else if (payload?.event === "invitee.canceled") {
      await handleInviteeCanceled(supabase, payload);
    } else {
      await logError(supabase, "webhook_failure", "low", "Unhandled Calendly event type", {
        event_type: payload?.event,
      });
    }

    await logWebhook(supabase, eventType, payload, "success", Date.now() - startTime);

    return new Response(
      JSON.stringify({ success: true, message: "Webhook processed" }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const stackTrace = error instanceof Error ? error.stack : undefined;

    if (supabase) {
      await logError(supabase, "function_error", "high", "Webhook processing error", {
        event_type: eventType,
        error: errorMessage,
      }, stackTrace);
      await logWebhook(supabase, eventType, payload, "failed", Date.now() - startTime, errorMessage);
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
