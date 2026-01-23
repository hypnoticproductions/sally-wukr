import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Manus-Signature",
};

interface ManusWebhookPayload {
  event: "task.completed" | "task.scheduled" | "action.required" | "reminder.triggered";
  task_id: string;
  client_id?: string;
  action?: "make_call" | "send_email" | "schedule_meeting" | "follow_up";
  scheduled_time?: string;
  metadata?: {
    client_name?: string;
    call_purpose?: string;
    notes?: string;
    [key: string]: any;
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const manusWebhookSecret = Deno.env.get("MANUS_WEBHOOK_SECRET");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (manusWebhookSecret) {
      const signature = req.headers.get("X-Manus-Signature");
      if (!signature) {
        console.warn("No Manus signature provided - proceeding without verification");
      }
    }

    const payload: ManusWebhookPayload = await req.json();

    console.log("Received Manus webhook:", payload);

    const { event, task_id, client_id, action, scheduled_time, metadata } = payload;

    const webhookLog = await supabase
      .from("webhook_logs")
      .insert({
        source: "manus",
        event_type: event,
        payload: payload,
        processed_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();

    if (webhookLog.error) {
      console.warn("Failed to log webhook (table may not exist):", webhookLog.error);
    }

    let result: any = { received: true };

    switch (event) {
      case "task.completed": {
        if (client_id) {
          const { error: updateError } = await supabase
            .from("clients")
            .update({
              last_manus_update: new Date().toISOString(),
              manus_task_status: "completed",
            })
            .eq("id", client_id);

          if (updateError) {
            console.error("Failed to update client:", updateError);
          } else {
            result.client_updated = true;
          }
        }

        console.log(`Task ${task_id} completed for client ${client_id}`);
        break;
      }

      case "task.scheduled": {
        if (client_id && scheduled_time) {
          const { error: scheduleError } = await supabase
            .from("clients")
            .update({
              next_follow_up: scheduled_time,
              last_manus_update: new Date().toISOString(),
            })
            .eq("id", client_id);

          if (scheduleError) {
            console.error("Failed to schedule follow-up:", scheduleError);
          } else {
            result.follow_up_scheduled = true;
          }
        }

        console.log(`Task ${task_id} scheduled for ${scheduled_time}`);
        break;
      }

      case "action.required": {
        if (action === "make_call" && client_id) {
          result.action = "call_scheduled";
          result.message = `Call action received for client ${client_id}`;
        } else if (action === "follow_up" && client_id) {
          const { error: followUpError } = await supabase
            .from("clients")
            .update({
              requires_follow_up: true,
              last_manus_update: new Date().toISOString(),
            })
            .eq("id", client_id);

          if (!followUpError) {
            result.follow_up_flagged = true;
          }
        }

        console.log(`Action required: ${action} for client ${client_id}`);
        break;
      }

      case "reminder.triggered": {
        if (client_id) {
          const { error: reminderError } = await supabase
            .from("clients")
            .update({
              last_reminder_sent: new Date().toISOString(),
            })
            .eq("id", client_id);

          if (!reminderError) {
            result.reminder_logged = true;
          }
        }

        console.log(`Reminder triggered for client ${client_id}`);
        break;
      }

      default: {
        console.warn(`Unknown event type: ${event}`);
        result.warning = `Unknown event type: ${event}`;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        event,
        task_id,
        ...result,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Webhook processing failed",
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
