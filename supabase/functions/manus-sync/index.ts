import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MANUS_API_BASE = "https://open.manus.ai/v1";

interface ManusTask {
  project_id?: string;
  task: string;
  context?: Record<string, any>;
  priority?: "low" | "medium" | "high";
}

async function createManusTask(apiKey: string, task: ManusTask) {
  const response = await fetch(`${MANUS_API_BASE}/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(task),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Manus API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const manusApiKey = Deno.env.get("MANUS_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!manusApiKey) {
      console.warn("MANUS_API_KEY not configured - skipping Manus sync");
      return new Response(
        JSON.stringify({
          success: false,
          message: "Manus integration not configured"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { clientId } = await req.json();

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: "Client ID is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError || !client) {
      return new Response(
        JSON.stringify({ error: "Client not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const expiresAt = client.profile_expires_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const taskDescription = `
## New Premium Client: ${client.name}

**Contact Information:**
- Name: ${client.name}
- Email: ${client.email}
${client.company ? `- Company: ${client.company}` : ''}
${client.industry ? `- Industry: ${client.industry}` : ''}

**Strategic Context:**
${client.pain_points ? `- Challenge: ${client.pain_points}` : ''}
${client.desired_outcome ? `- Desired Outcome: ${client.desired_outcome}` : ''}

**Account Details:**
- Payment Amount: $${client.total_paid || 30}
- Payment Date: ${new Date(client.payment_date).toLocaleDateString()}
- Profile Expires: ${new Date(expiresAt).toLocaleDateString()}
${client.conversation_quality_score ? `- Conversation Quality Score: ${client.conversation_quality_score}/100` : ''}

**Next Steps:**
1. Review client strategic context
2. Schedule initial consultation before ${new Date(new Date(expiresAt).getTime() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}
3. Prepare customized proposal based on pain points
4. Follow up 3 days before profile expiration

**Priority:** This is a paid client - high priority for Richard D. Fortune's consulting practice.

**Source:** Sally Wukr AI Assistant
**Client ID:** ${client.id}
    `.trim();

    const manusTask = await createManusTask(manusApiKey, {
      task: taskDescription,
      context: {
        type: "sally_paid_client",
        client_id: client.id,
        client_name: client.name,
        client_email: client.email,
        payment_amount: client.total_paid || 30,
        payment_date: client.payment_date,
        expires_at: expiresAt,
        conversation_score: client.conversation_quality_score,
        source: "Sally Wukr AI Assistant",
      },
      priority: "high",
    });

    const { error: updateError } = await supabase
      .from("clients")
      .update({ manus_task_id: manusTask.id || manusTask.task_id })
      .eq("id", clientId);

    if (updateError) {
      console.error("Failed to update client with Manus task ID:", updateError);
    }

    console.log(`Manus task created for client ${clientId}: ${manusTask.id || manusTask.task_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        manus_task_id: manusTask.id || manusTask.task_id,
        client_id: clientId
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Manus sync error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Manus sync failed",
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
