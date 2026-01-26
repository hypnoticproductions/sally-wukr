import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY");
    const RICHARD_PHONE_NUMBER = Deno.env.get("RICHARD_PHONE_NUMBER");

    const body = await req.json();
    console.log("Telnyx webhook received:", JSON.stringify(body));

    const eventData = body.data || body;
    const eventType = eventData.event_type;
    const payload = eventData.payload || eventData;
    const callControlId = payload.call_control_id;
    const from = payload.from;
    const to = payload.to;
    const direction = payload.direction;

    console.log("Event:", eventType, "Direction:", direction, "From:", from);

    if (eventType === "call.initiated" && direction === "incoming") {
      console.log("Incoming call - answering...");

      if (!TELNYX_API_KEY) {
        console.error("TELNYX_API_KEY not set!");
        return new Response(
          JSON.stringify({ error: "TELNYX_API_KEY missing" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const answerResponse = await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/answer`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${TELNYX_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      console.log("Answer response:", answerResponse.status);

      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase.from("calls").insert({
          call_control_id: callControlId,
          call_session_id: payload.call_session_id,
          direction: "inbound",
          from_number: from,
          to_number: to,
          call_state: "initiated",
        });
      }

      return new Response(
        JSON.stringify({ success: true, action: "answered" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (eventType === "call.answered" && direction === "incoming") {
      console.log("Call answered - playing greeting...");

      if (!TELNYX_API_KEY) {
        return new Response(
          JSON.stringify({ error: "TELNYX_API_KEY missing" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let clientName = null;
      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: client } = await supabase
          .from("clients")
          .select("name")
          .eq("phone_number", from)
          .maybeSingle();
        clientName = client?.name;
      }

      let greeting = "Hello! You've reached Sally with Dopa Buzz. ";
      if (clientName) {
        greeting += `Hi ${clientName}, great to hear from you! `;
      }
      greeting += "Press 1 to speak with Richard, or press 2 to leave a message.";

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

      console.log("Gather response:", gatherResponse.status);

      return new Response(
        JSON.stringify({ success: true, action: "greeting_played" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (eventType === "call.gather.ended") {
      const digits = payload.digits;
      console.log("Gather ended, digits:", digits);

      if (!TELNYX_API_KEY) {
        return new Response(
          JSON.stringify({ error: "TELNYX_API_KEY missing" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (digits === "1" && RICHARD_PHONE_NUMBER) {
        await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/speak`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${TELNYX_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            payload: "Connecting you to Richard now, please hold.",
            voice: "female",
            language: "en-US",
          }),
        });

        await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/transfer`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${TELNYX_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ to: RICHARD_PHONE_NUMBER }),
        });
      } else if (digits === "2") {
        await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/speak`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${TELNYX_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            payload: "Please leave your message after the beep.",
            voice: "female",
            language: "en-US",
          }),
        });

        await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/record_start`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${TELNYX_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channels: "single",
            format: "mp3",
            play_beep: true,
          }),
        });
      } else {
        if (RICHARD_PHONE_NUMBER) {
          await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/speak`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${TELNYX_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              payload: "Connecting you to Richard now.",
              voice: "female",
              language: "en-US",
            }),
          });

          await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/transfer`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${TELNYX_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ to: RICHARD_PHONE_NUMBER }),
          });
        }
      }

      return new Response(
        JSON.stringify({ success: true, digits }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (eventType === "call.hangup") {
      console.log("Call ended:", payload.hangup_cause);

      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase
          .from("calls")
          .update({
            call_state: "completed",
            ended_at: new Date().toISOString(),
          })
          .eq("call_control_id", callControlId);
      }
    }

    return new Response(
      JSON.stringify({ success: true, event_type: eventType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in telnyx-webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
