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

async function fetchEventDetails(inviteeUri: string) {
  try {
    const response = await fetch(inviteeUri, {
      headers: {
        "Authorization": `Bearer ${CALENDLY_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Calendly API error: ${response.status}`);
    }

    const data = await response.json();
    return data.resource;
  } catch (error) {
    console.error("Error fetching event details from Calendly:", error);
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
    console.error("Error creating client:", error);
    return null;
  }

  return newClient;
}

async function handleInviteeCreated(supabase: any, payload: CalendlyWebhookPayload) {
  console.log("Processing invitee.created event");

  const { email, name, uri: inviteeUri, event: eventUri } = payload.payload;

  const client = await getOrCreateClient(supabase, email, name);
  if (!client) {
    throw new Error("Failed to create or fetch client");
  }

  const eventDetails = await fetchEventDetails(inviteeUri);

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
    console.error("Error creating consultation:", error);
    throw error;
  }

  await supabase
    .from("clients")
    .update({
      has_active_consultation: true,
      consultation_count: client.consultation_count + 1,
    })
    .eq("id", client.id);

  console.log("Consultation created successfully:", consultation.id);
  return consultation;
}

async function handleInviteeCanceled(supabase: any, payload: CalendlyWebhookPayload) {
  console.log("Processing invitee.canceled event");

  const { uri: inviteeUri } = payload.payload;
  const isRescheduled = payload.payload.rescheduled || false;

  const { data: consultation } = await supabase
    .from("consultations")
    .select("*")
    .eq("invitee_uri", inviteeUri)
    .maybeSingle();

  if (!consultation) {
    console.log("No consultation found for invitee URI:", inviteeUri);
    return;
  }

  const updateData: any = {
    status: isRescheduled ? "rescheduled" : "cancelled",
    cancellation_reason: payload.payload.cancellation?.reason || null,
    canceled_by: payload.payload.cancellation?.canceled_by || null,
  };

  await supabase
    .from("consultations")
    .update(updateData)
    .eq("id", consultation.id);

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

  console.log("Consultation updated to", updateData.status);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: CalendlyWebhookPayload = await req.json();

    await supabase.from("webhook_logs").insert({
      source: "calendly",
      event_type: payload.event,
      payload: payload,
      processed_at: new Date().toISOString(),
    });

    if (payload.event === "invitee.created") {
      await handleInviteeCreated(supabase, payload);
    } else if (payload.event === "invitee.canceled") {
      await handleInviteeCanceled(supabase, payload);
    } else {
      console.log("Unhandled event type:", payload.event);
    }

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
    console.error("Error processing webhook:", error);

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
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
