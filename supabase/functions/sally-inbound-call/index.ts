import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  console.log("sally-inbound-call received request");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const RICHARD_PHONE_NUMBER = Deno.env.get("RICHARD_PHONE_NUMBER");

    console.log("API Key exists:", !!TELNYX_API_KEY);

    const body = await req.json();
    console.log("Received webhook:", JSON.stringify(body).substring(0, 500));

    if (!TELNYX_API_KEY) {
      console.error("TELNYX_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "TELNYX_API_KEY missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const eventData = body.data || body;
    const eventType = eventData.event_type;
    const payload = eventData.payload || eventData;
    const callControlId = payload.call_control_id;
    const from = payload.from;
    const to = payload.to;
    const direction = payload.direction;
    const callSessionId = payload.call_session_id;

    console.log("Event:", eventType, "Direction:", direction, "From:", from, "CallControlId:", callControlId);

    if (eventType === "call.initiated" && direction === "incoming") {
      console.log("Answering incoming call (fire-and-forget)");

      fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/answer`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${TELNYX_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      })
        .then((res) => res.text().then((text) => console.log("Answer API response:", res.status, text)))
        .catch((err) => console.error("Answer API error:", err));

      return new Response(
        JSON.stringify({ success: true, action: "answering" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (eventType === "call.answered" && direction === "incoming") {
      console.log("Call answered, processing in background (fire-and-forget)");

      (async () => {
        try {
          let greeting = "Hello! You've reached Sally with Dopa Buzz. ";
          let clientId: string | null = null;

          if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
            const { data: client } = await supabase
              .from("clients")
              .select("id, name, email, company")
              .eq("phone_number", from)
              .maybeSingle();

            if (client) {
              clientId = client.id;
              greeting += `Hi ${client.name}, it's great to hear from you! `;
              greeting += "How can I help you today? Press 1 to speak with Richard, or press 2 to leave a message.";
            } else {
              greeting += "I don't recognize this number. Press 1 to speak with Richard about our services, or press 2 to leave a message.";
            }

            supabase
              .from("calls")
              .insert({
                client_id: clientId,
                call_control_id: callControlId,
                call_session_id: callSessionId,
                direction: "inbound",
                from_number: from,
                to_number: to,
                call_state: "answered",
                answered_at: new Date().toISOString(),
              })
              .then(() => console.log("Call record inserted"))
              .catch((err: Error) => console.error("Failed to insert call record:", err));
          }

          const gatherResponse = await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/gather_using_speak`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${TELNYX_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              payload: greeting,
              voice: "female",
              language: "en-US",
              minimum_digits: 1,
              maximum_digits: 1,
              timeout_millis: 10000,
            }),
          });

          const gatherResult = await gatherResponse.text();
          console.log("Gather API response:", gatherResponse.status, gatherResult);
        } catch (err) {
          console.error("Background processing error (call.answered):", err);
        }
      })();

      return new Response(
        JSON.stringify({ success: true, action: "processing_greeting" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (eventType === "call.gather.ended") {
      const digits = payload.digits;
      console.log("Gather ended, digits:", digits, "(fire-and-forget)");

      (async () => {
        try {
          if (digits === "1" && RICHARD_PHONE_NUMBER) {
            const res = await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/transfer`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${TELNYX_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ to: RICHARD_PHONE_NUMBER }),
            });
            console.log("Transfer API response:", res.status);
          } else if (digits === "2") {
            const res = await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/speak`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${TELNYX_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                payload: "Please leave your message after the beep, and we'll get back to you shortly.",
                voice: "female",
                language: "en-US",
              }),
            });
            console.log("Speak API response:", res.status);
          } else {
            await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/speak`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${TELNYX_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                payload: "I didn't catch that. Transferring you to Richard now.",
                voice: "female",
                language: "en-US",
              }),
            });

            if (RICHARD_PHONE_NUMBER) {
              const res = await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/transfer`, {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${TELNYX_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ to: RICHARD_PHONE_NUMBER }),
              });
              console.log("Transfer API response:", res.status);
            }
          }
        } catch (err) {
          console.error("Background processing error (gather.ended):", err);
        }
      })();

      return new Response(
        JSON.stringify({ success: true, action: "processing_gather", digits }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (eventType === "call.hangup") {
      console.log("Call ended (fire-and-forget)");

      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        supabase
          .from("calls")
          .update({
            call_state: "completed",
            ended_at: new Date().toISOString()
          })
          .eq("call_control_id", callControlId)
          .then(() => console.log("Call record updated to completed"))
          .catch((err: Error) => console.error("Failed to update call record:", err));
      }

      return new Response(
        JSON.stringify({ success: true, action: "hangup_processed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, event_type: eventType }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in sally-inbound-call:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
