import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const workflowId = pathParts[pathParts.length - 1];

    if (!workflowId) {
      console.error("No workflow ID provided");
      return new Response(
        JSON.stringify({ error: "Workflow ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Webhook triggered for workflow: ${workflowId}`);

    // Get request body if present
    let input = {};
    if (req.method === "POST") {
      try {
        const body = await req.text();
        if (body) {
          input = JSON.parse(body);
        }
      } catch (e) {
        console.log("No JSON body or invalid JSON, using empty input");
      }
    }

    // Query params as additional input
    const queryParams: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    const fullInput = { ...queryParams, ...input, _webhook: true, _method: req.method };

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify workflow exists and has webhook enabled
    const { data: workflow, error: workflowError } = await supabase
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .single();

    if (workflowError || !workflow) {
      console.error("Workflow not found:", workflowError);
      return new Response(
        JSON.stringify({ error: "Workflow not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!workflow.webhook_url) {
      console.error("Webhook not enabled for workflow:", workflowId);
      return new Response(
        JSON.stringify({ error: "Webhook not enabled for this workflow" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (workflow.status !== "active") {
      console.error("Workflow is not active:", workflow.status);
      return new Response(
        JSON.stringify({ error: "Workflow is not active" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create execution record
    const { data: execution, error: execError } = await supabase
      .from("executions")
      .insert({
        workflow_id: workflowId,
        user_id: workflow.user_id,
        status: "pending",
        trigger: "webhook",
        input: fullInput,
        logs: [],
      })
      .select()
      .single();

    if (execError) {
      console.error("Failed to create execution:", execError);
      return new Response(
        JSON.stringify({ error: "Failed to create execution" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Created execution ${execution.id} for webhook trigger`);

    // Call the execute-workflow function
    const executeUrl = `${supabaseUrl}/functions/v1/execute-workflow`;
    const executeResponse = await fetch(executeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        workflowId,
        executionId: execution.id,
        input: fullInput,
      }),
    });

    if (!executeResponse.ok) {
      const errorText = await executeResponse.text();
      console.error("Execute workflow failed:", errorText);
    }

    return new Response(
      JSON.stringify({
        success: true,
        executionId: execution.id,
        message: "Workflow execution started",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook handler error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
