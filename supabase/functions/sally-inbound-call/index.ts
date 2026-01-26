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
    const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const RICHARD_PHONE_NUMBER = Deno.env.get("RICHARD_PHONE_NUMBER");

    const body = await req.json();
    console.log("Received webhook:", JSON.stringify(body));

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

    console.log("Event type:", eventType, "Direction:", direction, "From:", from, "Call ID:", callControlId);

    if (eventType === "call.initiated" && direction === "incoming") {
      console.log("Answering incoming call...");

      const answerResponse = await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/answer`, {
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
        JSON.stringify({ success: true, action: "answered" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (eventType === "call.answered" && direction === "incoming") {
      console.log("Call answered, playing greeting...");

      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

      const { data: client } = await supabase
        .from("clients")
        .select("id, name, email, company")
        .eq("phone_number", from)
        .maybeSingle();

      let greeting = "Hello! You've reached Sally with Dopa Buzz. ";

      if (client) {
        greeting += `Hi ${client.name}, it's great to hear from you! `;
        greeting += "How can I help you today? Press 1 to speak with Richard, or press 2 to leave a message.";
      } else {
        greeting += "I don't recognize this number. Press 1 to speak with Richard about our services, or press 2 to leave a message.";
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
      console.log("Gather response:", gatherResponse.status, gatherResult);

      await supabase
        .from("calls")
        .insert({
          client_id: client?.id || null,
          call_control_id: callControlId,
          call_session_id: payload.call_session_id,
          direction: "inbound",
          from_number: from,
          to_number: to,
          call_state: "answered",
          answered_at: new Date().toISOString(),
        });

      return new Response(
        JSON.stringify({ success: true, client_found: !!client }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (eventType === "call.gather.ended") {
      const digits = payload.digits;
      console.log("Gather ended, digits:", digits);

      if (digits === "1" && RICHARD_PHONE_NUMBER) {
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
            payload: "Please leave your message after the beep, and we'll get back to you shortly.",
            voice: "female",
            language: "en-US",
          }),
        });
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
        JSON.stringify({ success: true, action: digits }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (eventType === "call.hangup") {
      console.log("Call ended");

      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase
          .from("calls")
          .update({
            call_state: "completed",
            ended_at: new Date().toISOString()
          })
          .eq("call_control_id", callControlId);
      }
    }

    return new Response(
      JSON.stringify({ success: true, event_type: eventType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in sally-inbound-call:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
