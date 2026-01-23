import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Manus-Signature",
};

interface ManusWebhookPayload {
  event: "task.created" | "task.completed" | "task.scheduled" | "action.required" | "reminder.triggered";
  task_id: string;
  client_id?: string;
  task_description?: string;
  brief_content?: string;
  priority?: "low" | "medium" | "high";
  context?: Record<string, any>;
  action?: "make_call" | "send_email" | "schedule_meeting" | "follow_up";
  scheduled_time?: string;
  deliverables?: Array<{
    type: string;
    title: string;
    content?: string;
    file_url?: string;
    metadata?: Record<string, any>;
  }>;
  completion_metadata?: Record<string, any>;
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
        return new Response(
          JSON.stringify({
            error: "Missing X-Manus-Signature header",
            success: false,
          }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (signature !== manusWebhookSecret) {
        return new Response(
          JSON.stringify({
            error: "Invalid webhook signature",
            success: false,
          }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log("Webhook signature verified successfully");
    } else {
      console.warn("MANUS_WEBHOOK_SECRET not configured - webhook is not secured");
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
      case "task.created": {
        console.log(`Creating new task ${task_id} in knowledge base`);

        const { data: existingTask } = await supabase
          .from("tasks")
          .select("id")
          .eq("manus_task_id", task_id)
          .maybeSingle();

        if (existingTask) {
          console.log(`Task ${task_id} already exists, skipping creation`);
          result.task_existed = true;
        } else {
          const { data: newTask, error: taskError } = await supabase
            .from("tasks")
            .insert({
              manus_task_id: task_id,
              client_id: client_id || null,
              brief_content: payload.brief_content || "",
              task_description: payload.task_description || "Task created from Manus",
              status: "created",
              priority: payload.priority || "medium",
              context: payload.context || {},
            })
            .select()
            .maybeSingle();

          if (taskError) {
            console.error("Failed to create task:", taskError);
            result.task_error = taskError.message;
          } else {
            console.log(`Task ${task_id} created successfully with ID ${newTask.id}`);
            result.task_created = true;
            result.task_internal_id = newTask.id;

            if (payload.context) {
              for (const [key, value] of Object.entries(payload.context)) {
                await supabase
                  .from("task_metadata")
                  .insert({
                    task_id: newTask.id,
                    key: key,
                    value: value,
                  });
              }
            }
          }
        }

        if (client_id) {
          const { error: clientUpdateError } = await supabase
            .from("clients")
            .update({
              manus_task_id: task_id,
              last_manus_update: new Date().toISOString(),
              manus_task_status: "created",
            })
            .eq("id", client_id);

          if (clientUpdateError) {
            console.error("Failed to update client:", clientUpdateError);
          } else {
            result.client_updated = true;
          }
        }

        break;
      }

      case "task.completed": {
        console.log(`Task ${task_id} completed, storing deliverables`);

        const { data: task } = await supabase
          .from("tasks")
          .select("id, client_id")
          .eq("manus_task_id", task_id)
          .maybeSingle();

        if (!task) {
          console.warn(`Task ${task_id} not found in database, creating it now`);

          const { data: newTask } = await supabase
            .from("tasks")
            .insert({
              manus_task_id: task_id,
              client_id: client_id || null,
              brief_content: "",
              task_description: "Task completed (created retroactively)",
              status: "completed",
              priority: "medium",
              context: payload.completion_metadata || {},
              completed_at: new Date().toISOString(),
            })
            .select()
            .maybeSingle();

          if (newTask) {
            result.task_created_retroactively = true;
            result.task_internal_id = newTask.id;

            if (payload.deliverables && payload.deliverables.length > 0) {
              for (const deliverable of payload.deliverables) {
                await supabase
                  .from("task_deliverables")
                  .insert({
                    task_id: newTask.id,
                    deliverable_type: deliverable.type || "other",
                    title: deliverable.title,
                    content: deliverable.content || null,
                    file_url: deliverable.file_url || null,
                    metadata: deliverable.metadata || {},
                  });
              }
              result.deliverables_stored = payload.deliverables.length;
            }
          }
        } else {
          const { error: updateError } = await supabase
            .from("tasks")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
            })
            .eq("id", task.id);

          if (updateError) {
            console.error("Failed to update task status:", updateError);
          } else {
            result.task_updated = true;
          }

          if (payload.deliverables && payload.deliverables.length > 0) {
            for (const deliverable of payload.deliverables) {
              const { error: deliverableError } = await supabase
                .from("task_deliverables")
                .insert({
                  task_id: task.id,
                  deliverable_type: deliverable.type || "other",
                  title: deliverable.title,
                  content: deliverable.content || null,
                  file_url: deliverable.file_url || null,
                  metadata: deliverable.metadata || {},
                });

              if (deliverableError) {
                console.error("Failed to store deliverable:", deliverableError);
              }
            }
            result.deliverables_stored = payload.deliverables.length;
          }

          if (payload.completion_metadata) {
            for (const [key, value] of Object.entries(payload.completion_metadata)) {
              await supabase
                .from("task_metadata")
                .insert({
                  task_id: task.id,
                  key: `completion_${key}`,
                  value: value,
                });
            }
          }
        }

        const targetClientId = task?.client_id || client_id;
        if (targetClientId) {
          const { error: updateError } = await supabase
            .from("clients")
            .update({
              last_manus_update: new Date().toISOString(),
              manus_task_status: "completed",
            })
            .eq("id", targetClientId);

          if (updateError) {
            console.error("Failed to update client:", updateError);
          } else {
            result.client_updated = true;
          }
        }

        setTimeout(() => {
          supabase.rpc("refresh_task_summary").then(() => {
            console.log("Task summary refreshed");
          }).catch((err) => {
            console.error("Failed to refresh task summary:", err);
          });
        }, 1000);

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

        const { data: task } = await supabase
          .from("tasks")
          .select("id")
          .eq("manus_task_id", task_id)
          .maybeSingle();

        if (task) {
          await supabase
            .from("tasks")
            .update({
              status: "scheduled",
            })
            .eq("id", task.id);
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

        const { data: task } = await supabase
          .from("tasks")
          .select("id")
          .eq("manus_task_id", task_id)
          .maybeSingle();

        if (task) {
          await supabase
            .from("task_metadata")
            .insert({
              task_id: task.id,
              key: "action_required",
              value: { action, timestamp: new Date().toISOString() },
            });
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
