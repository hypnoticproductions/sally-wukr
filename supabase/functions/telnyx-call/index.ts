import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CallRequest {
  client_id?: string;
  phone_number?: string;
  direction?: string;
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
    const TELNYX_PHONE_NUMBER = Deno.env.get("TELNYX_PHONE_NUMBER");
    const TELNYX_CONNECTION_ID = Deno.env.get("TELNYX_CONNECTION_ID");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!TELNYX_API_KEY || !TELNYX_PHONE_NUMBER || !TELNYX_CONNECTION_ID) {
      return new Response(
        JSON.stringify({ error: "Telnyx configuration missing" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Supabase configuration missing" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { client_id, phone_number, direction = "outbound" }: CallRequest = await req.json();

    if (!client_id && !phone_number) {
      return new Response(
        JSON.stringify({ error: "Either client_id or phone_number is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let clientData = null;
    let targetPhone = phone_number;

    if (client_id) {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, phone_number, call_preferences")
        .eq("id", client_id)
        .maybeSingle();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Client not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      clientData = data;
      targetPhone = data.phone_number;

      if (!targetPhone) {
        return new Response(
          JSON.stringify({ error: "Client has no phone number" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (data.call_preferences?.do_not_call) {
        return new Response(
          JSON.stringify({ error: "Client is on do-not-call list" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    const webhookUrl = `${SUPABASE_URL}/functions/v1/telnyx-webhook`;

    const telnyxResponse = await fetch("https://api.telnyx.com/v2/calls", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TELNYX_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        connection_id: TELNYX_CONNECTION_ID,
        to: targetPhone,
        from: TELNYX_PHONE_NUMBER,
        webhook_url: webhookUrl,
        record: "record-from-answer",
        record_channels: "dual",
      }),
    });

    if (!telnyxResponse.ok) {
      const errorData = await telnyxResponse.text();
      console.error("Telnyx API error:", errorData);
      return new Response(
        JSON.stringify({ error: "Failed to initiate call", details: errorData }),
        {
          status: telnyxResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const telnyxData = await telnyxResponse.json();
    const callControlId = telnyxData.data.call_control_id;
    const callSessionId = telnyxData.data.call_session_id;

    const { data: callRecord, error: dbError } = await supabase
      .from("calls")
      .insert({
        client_id: clientData?.id || null,
        call_control_id: callControlId,
        call_session_id: callSessionId,
        direction: direction,
        from_number: TELNYX_PHONE_NUMBER,
        to_number: targetPhone,
        call_state: "initiated",
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
    }

    if (clientData?.id) {
      await supabase
        .from("clients")
        .update({ last_call_at: new Date().toISOString() })
        .eq("id", clientData.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        call_control_id: callControlId,
        call_session_id: callSessionId,
        call_id: callRecord?.id,
        client_name: clientData?.name,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in telnyx-call:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
