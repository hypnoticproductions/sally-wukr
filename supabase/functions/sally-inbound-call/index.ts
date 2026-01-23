import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InboundCallEvent {
  data: {
    event_type: string;
    payload: {
      call_control_id: string;
      call_session_id: string;
      from: string;
      to: string;
      direction: string;
    };
  };
}

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

    if (!TELNYX_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Configuration missing" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const event: InboundCallEvent = await req.json();

    const { event_type, payload } = event.data;
    const { call_control_id, from, to, direction } = payload;

    console.log("Inbound call event:", event_type, "from:", from);

    if (event_type === "call.initiated" && direction === "incoming") {
      const { data: client } = await supabase
        .from("clients")
        .select("id, name, email, company")
        .eq("phone_number", from)
        .maybeSingle();

      await fetch("https://api.telnyx.com/v2/calls/" + call_control_id + "/actions/answer", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${TELNYX_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      let greeting = "Hello! You've reached Sally with Dopa Buzz. ";

      if (client) {
        greeting += `Hi ${client.name}, it's great to hear from you! `;

        const quintapooUrl = `${SUPABASE_URL}/functions/v1/quintapoo-query`;
        const quintapooResponse = await fetch(quintapooUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: `What recent work have we done for ${client.name}?`,
            client_id: client.id,
          }),
        });

        if (quintapooResponse.ok) {
          const quintapooData = await quintapooResponse.json();
          if (quintapooData.context) {
            greeting += "I have your recent activity pulled up. ";
          }
        }

        greeting += "How can I help you today? Press 1 to speak with Richard, or press 2 to leave a message.";
      } else {
        greeting += "I don't recognize this number. Press 1 to speak with Richard about our services, or press 2 to leave a message.";
      }

      await fetch("https://api.telnyx.com/v2/calls/" + call_control_id + "/actions/gather_using_speak", {
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

      const { data: callRecord } = await supabase
        .from("calls")
        .insert({
          client_id: client?.id || null,
          call_control_id: call_control_id,
          call_session_id: payload.call_session_id,
          direction: "inbound",
          from_number: from,
          to_number: to,
          call_state: "answered",
          answered_at: new Date().toISOString(),
        })
        .select()
        .single();

      return new Response(
        JSON.stringify({ success: true, client_found: !!client }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (event_type === "call.gather.ended") {
      const digits = (event.data as any).payload?.digits;

      if (digits === "1" && RICHARD_PHONE_NUMBER) {
        await fetch("https://api.telnyx.com/v2/calls/" + call_control_id + "/actions/transfer", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${TELNYX_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: RICHARD_PHONE_NUMBER,
          }),
        });

        await supabase
          .from("calls")
          .update({ ai_summary: "Transferred to Richard" })
          .eq("call_control_id", call_control_id);
      } else if (digits === "2") {
        await fetch("https://api.telnyx.com/v2/calls/" + call_control_id + "/actions/speak", {
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

        setTimeout(async () => {
          await fetch("https://api.telnyx.com/v2/calls/" + call_control_id + "/actions/record_start", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${TELNYX_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              channels: "single",
              format: "mp3",
            }),
          });
        }, 3000);
      } else {
        await fetch("https://api.telnyx.com/v2/calls/" + call_control_id + "/actions/speak", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${TELNYX_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            payload: "I didn't understand that. Please call back and press 1 or 2. Goodbye.",
            voice: "female",
            language: "en-US",
          }),
        });

        setTimeout(async () => {
          await fetch("https://api.telnyx.com/v2/calls/" + call_control_id + "/actions/hangup", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${TELNYX_API_KEY}`,
              "Content-Type": "application/json",
            },
          });
        }, 2000);
      }

      return new Response(
        JSON.stringify({ success: true, action: digits }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, event_type }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in sally-inbound-call:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
