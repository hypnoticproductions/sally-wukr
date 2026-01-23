import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/quintapoo-query\/?/, "");

    switch (path) {
      case "task-by-client": {
        const clientId = url.searchParams.get("client_id");

        if (!clientId) {
          return new Response(
            JSON.stringify({ error: "client_id parameter is required" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const { data: tasks, error } = await supabase
          .from("tasks")
          .select(`
            *,
            task_deliverables(*),
            task_metadata(*)
          `)
          .eq("client_id", clientId)
          .order("created_at", { ascending: false });

        if (error) {
          throw error;
        }

        return new Response(
          JSON.stringify({
            success: true,
            client_id: clientId,
            tasks: tasks || [],
            count: tasks?.length || 0,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "task-status": {
        const taskId = url.searchParams.get("task_id");
        const manusTaskId = url.searchParams.get("manus_task_id");

        if (!taskId && !manusTaskId) {
          return new Response(
            JSON.stringify({ error: "task_id or manus_task_id parameter is required" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        let query = supabase
          .from("tasks")
          .select("*");

        if (taskId) {
          query = query.eq("id", taskId);
        } else if (manusTaskId) {
          query = query.eq("manus_task_id", manusTaskId);
        }

        const { data: task, error } = await query.maybeSingle();

        if (error) {
          throw error;
        }

        if (!task) {
          return new Response(
            JSON.stringify({ error: "Task not found" }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            task,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "deliverables": {
        const taskId = url.searchParams.get("task_id");
        const manusTaskId = url.searchParams.get("manus_task_id");

        if (!taskId && !manusTaskId) {
          return new Response(
            JSON.stringify({ error: "task_id or manus_task_id parameter is required" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        let taskQuery = supabase
          .from("tasks")
          .select("id");

        if (taskId) {
          taskQuery = taskQuery.eq("id", taskId);
        } else if (manusTaskId) {
          taskQuery = taskQuery.eq("manus_task_id", manusTaskId);
        }

        const { data: task, error: taskError } = await taskQuery.maybeSingle();

        if (taskError) {
          throw taskError;
        }

        if (!task) {
          return new Response(
            JSON.stringify({ error: "Task not found" }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const { data: deliverables, error: deliverablesError } = await supabase
          .from("task_deliverables")
          .select("*")
          .eq("task_id", task.id)
          .order("created_at", { ascending: false });

        if (deliverablesError) {
          throw deliverablesError;
        }

        return new Response(
          JSON.stringify({
            success: true,
            task_id: task.id,
            deliverables: deliverables || [],
            count: deliverables?.length || 0,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "active-tasks": {
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const status = url.searchParams.get("status") || "created,in_progress,scheduled";
        const statusArray = status.split(",");

        const { data: tasks, error } = await supabase
          .from("tasks")
          .select(`
            *,
            clients(name, email, company)
          `)
          .in("status", statusArray)
          .order("priority", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) {
          throw error;
        }

        return new Response(
          JSON.stringify({
            success: true,
            tasks: tasks || [],
            count: tasks?.length || 0,
            filters: {
              status: statusArray,
              limit,
            },
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "search-tasks": {
        if (req.method !== "POST") {
          return new Response(
            JSON.stringify({ error: "POST method required for search" }),
            {
              status: 405,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const { query, limit = 20, include_deliverables = false } = await req.json();

        if (!query || query.trim().length === 0) {
          return new Response(
            JSON.stringify({ error: "query parameter is required" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const searchQuery = query.trim().split(/\s+/).map((term: string) => `${term}:*`).join(" & ");

        const { data: taskResults, error: taskError } = await supabase
          .from("tasks")
          .select(`
            *,
            clients(name, email, company)
          `)
          .textSearch("search_vector", searchQuery, {
            type: "websearch",
            config: "english",
          })
          .limit(limit);

        if (taskError) {
          console.error("Task search error:", taskError);
        }

        let deliverableResults = [];
        if (include_deliverables) {
          const { data: delResults, error: delError } = await supabase
            .from("task_deliverables")
            .select(`
              *,
              tasks(
                manus_task_id,
                client_id,
                status,
                clients(name, email)
              )
            `)
            .textSearch("search_vector", searchQuery, {
              type: "websearch",
              config: "english",
            })
            .limit(limit);

          if (delError) {
            console.error("Deliverable search error:", delError);
          } else {
            deliverableResults = delResults || [];
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            query,
            tasks: taskResults || [],
            deliverables: deliverableResults,
            task_count: taskResults?.length || 0,
            deliverable_count: deliverableResults?.length || 0,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "client-history": {
        const clientId = url.searchParams.get("client_id");

        if (!clientId) {
          return new Response(
            JSON.stringify({ error: "client_id parameter is required" }),
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

        if (clientError) {
          throw clientError;
        }

        if (!client) {
          return new Response(
            JSON.stringify({ error: "Client not found" }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const { data: tasks, error: tasksError } = await supabase
          .from("tasks")
          .select(`
            id,
            manus_task_id,
            task_description,
            status,
            priority,
            created_at,
            completed_at,
            task_deliverables(count)
          `)
          .eq("client_id", clientId)
          .order("created_at", { ascending: false });

        if (tasksError) {
          throw tasksError;
        }

        const { data: sessions, error: sessionsError } = await supabase
          .from("sessions")
          .select(`
            id,
            domain,
            started_at,
            ended_at,
            status,
            messages(count)
          `)
          .eq("client_id", clientId)
          .order("started_at", { ascending: false });

        if (sessionsError) {
          throw sessionsError;
        }

        return new Response(
          JSON.stringify({
            success: true,
            client,
            tasks: tasks || [],
            sessions: sessions || [],
            summary: {
              total_tasks: tasks?.length || 0,
              completed_tasks: tasks?.filter((t) => t.status === "completed").length || 0,
              active_tasks: tasks?.filter((t) => ["created", "in_progress", "scheduled"].includes(t.status)).length || 0,
              total_sessions: sessions?.length || 0,
            },
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "task-summary": {
        const { data: summary, error } = await supabase
          .from("task_summary")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) {
          throw error;
        }

        return new Response(
          JSON.stringify({
            success: true,
            summary: summary || [],
            count: summary?.length || 0,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      default: {
        return new Response(
          JSON.stringify({
            error: "Invalid endpoint",
            available_endpoints: [
              "task-by-client?client_id=<uuid>",
              "task-status?task_id=<uuid> or ?manus_task_id=<string>",
              "deliverables?task_id=<uuid> or ?manus_task_id=<string>",
              "active-tasks?limit=<number>&status=<comma-separated>",
              "search-tasks (POST) with body: { query, limit?, include_deliverables? }",
              "client-history?client_id=<uuid>",
              "task-summary",
            ],
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }
  } catch (error) {
    console.error("Query processing error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Query processing failed",
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
