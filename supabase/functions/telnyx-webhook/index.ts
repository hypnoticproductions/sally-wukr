import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TelnyxWebhookEvent {
  data: {
    event_type: string;
    id: string;
    occurred_at: string;
    payload: {
      call_control_id: string;
      call_session_id: string;
      call_leg_id: string;
      connection_id: string;
      from: string;
      to: string;
      direction: string;
      state?: string;
      start_time?: string;
      answer_time?: string;
      end_time?: string;
      hangup_cause?: string;
      recording_urls?: string[];
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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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
    const event: TelnyxWebhookEvent = await req.json();

    console.log("Telnyx webhook event:", event.data.event_type);

    const { event_type, payload } = event.data;
    const { call_control_id, from, to, direction } = payload;

    const { data: existingCall } = await supabase
      .from("calls")
      .select("*")
      .eq("call_control_id", call_control_id)
      .maybeSingle();

    switch (event_type) {
      case "call.initiated":
        if (!existingCall) {
          await supabase.from("calls").insert({
            call_control_id: call_control_id,
            call_session_id: payload.call_session_id,
            direction: direction,
            from_number: from,
            to_number: to,
            call_state: "initiated",
          });
        }
        break;

      case "call.ringing":
        if (existingCall) {
          await supabase
            .from("calls")
            .update({ call_state: "ringing" })
            .eq("call_control_id", call_control_id);
        }
        break;

      case "call.answered":
        if (existingCall) {
          await supabase
            .from("calls")
            .update({
              call_state: "answered",
              answered_at: payload.answer_time || new Date().toISOString(),
            })
            .eq("call_control_id", call_control_id);
        }
        break;

      case "call.hangup":
        if (existingCall) {
          const startTime = existingCall.answered_at
            ? new Date(existingCall.answered_at).getTime()
            : new Date(existingCall.created_at).getTime();
          const endTime = payload.end_time
            ? new Date(payload.end_time).getTime()
            : Date.now();
          const durationSeconds = Math.floor((endTime - startTime) / 1000);

          await supabase
            .from("calls")
            .update({
              call_state: "hangup",
              ended_at: payload.end_time || new Date().toISOString(),
              duration_seconds: durationSeconds,
            })
            .eq("call_control_id", call_control_id);

          if (payload.recording_urls && payload.recording_urls.length > 0) {
            await supabase.from("call_recordings").insert({
              call_id: existingCall.id,
              recording_url: payload.recording_urls[0],
              channel_count: 2,
            });
          }

          if (existingCall.call_state === "initiated" || existingCall.call_state === "ringing") {
            const status = payload.hangup_cause === "NO_ANSWER" ? "no_answer" :
                          payload.hangup_cause === "USER_BUSY" ? "busy" : "failed";

            await supabase.from("call_attempts").insert({
              client_id: existingCall.client_id,
              call_id: existingCall.id,
              attempt_number: 1,
              status: status,
              notes: `Call ended with: ${payload.hangup_cause}`,
            });
          } else {
            await supabase.from("call_attempts").insert({
              client_id: existingCall.client_id,
              call_id: existingCall.id,
              attempt_number: 1,
              status: "completed",
              notes: `Call completed successfully`,
            });
          }
        }
        break;

      case "call.machine.detection.ended":
        if (existingCall && payload.state === "machine") {
          await supabase
            .from("calls")
            .update({
              call_state: "no_answer",
              ai_summary: "Voicemail detected"
            })
            .eq("call_control_id", call_control_id);
        }
        break;

      case "call.recording.saved":
        if (existingCall && payload.recording_urls && payload.recording_urls.length > 0) {
          const { data: existingRecording } = await supabase
            .from("call_recordings")
            .select("id")
            .eq("call_id", existingCall.id)
            .maybeSingle();

          if (existingRecording) {
            await supabase
              .from("call_recordings")
              .update({ recording_url: payload.recording_urls[0] })
              .eq("id", existingRecording.id);
          } else {
            await supabase.from("call_recordings").insert({
              call_id: existingCall.id,
              recording_url: payload.recording_urls[0],
              channel_count: 2,
            });
          }
        }
        break;

      default:
        console.log("Unhandled event type:", event_type);
    }

    return new Response(
      JSON.stringify({ success: true, event_type }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in telnyx-webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
