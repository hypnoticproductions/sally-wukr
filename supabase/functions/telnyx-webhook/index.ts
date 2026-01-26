import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  console.log("Telnyx webhook called");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    console.log("Raw body:", rawBody);

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.error("Failed to parse JSON");
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const eventData = body.data || body;
    const eventType = eventData.event_type || body.event_type;
    const payload = eventData.payload || eventData;

    const callControlId = payload.call_control_id;
    const from = payload.from;
    const to = payload.to;
    const direction = payload.direction;

    console.log("Parsed - Event:", eventType, "Direction:", direction, "CallControlId:", callControlId);

    if (!eventType) {
      console.log("No event type found, returning OK");
      return new Response(
        JSON.stringify({ success: true, message: "No event type" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY");
    const RICHARD_PHONE_NUMBER = Deno.env.get("RICHARD_PHONE_NUMBER");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (eventType === "call.initiated" && direction === "incoming") {
      console.log("Incoming call detected - answering");

      if (!TELNYX_API_KEY) {
        console.error("TELNYX_API_KEY not configured");
        return new Response(
          JSON.stringify({ error: "API key missing" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const answerUrl = `https://api.telnyx.com/v2/calls/${callControlId}/actions/answer`;
      console.log("Calling answer URL:", answerUrl);

      const answerResponse = await fetch(answerUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${TELNYX_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const answerResult = await answerResponse.text();
      console.log("Answer response:", answerResponse.status, answerResult);

      return new Response(
        JSON.stringify({ success: true, action: "answered", status: answerResponse.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (eventType === "call.answered") {
      console.log("Call answered - playing greeting");

      if (!TELNYX_API_KEY) {
        return new Response(
          JSON.stringify({ error: "API key missing" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const greeting = "Hello! You've reached Sally with Dopa Buzz. Press 1 to speak with Richard, or press 2 to leave a message.";

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
      console.log("Gather response:", gatherResponse.status, gatherResult);

      return new Response(
        JSON.stringify({ success: true, action: "greeting" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (eventType === "call.gather.ended") {
      const digits = payload.digits;
      console.log("Gather ended, digits:", digits);

      if (!TELNYX_API_KEY) {
        return new Response(
          JSON.stringify({ error: "API key missing" }),
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
      } else if (RICHARD_PHONE_NUMBER) {
        await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/transfer`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${TELNYX_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ to: RICHARD_PHONE_NUMBER }),
        });
      }

      return new Response(
        JSON.stringify({ success: true, digits }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (eventType === "call.hangup") {
      console.log("Call ended:", payload.hangup_cause);
    }

    return new Response(
      JSON.stringify({ success: true, event_type: eventType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
