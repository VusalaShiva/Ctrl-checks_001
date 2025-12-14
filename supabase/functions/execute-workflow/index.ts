// Deno global type declaration for TypeScript
declare const Deno: {
  readTextFile(path: string | URL): Promise<string>;
  env: {
    get(key: string): string | undefined;
  };
  cwd(): string;
};

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WorkflowNode {
  id: string;
  type: string;
  data: {
    label: string;
    type: string;
    category: string;
    config: Record<string, unknown>;
  };
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

interface ExecutionLog {
  nodeId: string;
  nodeName: string;
  status: "running" | "success" | "failed" | "skipped";
  startedAt: string;
  finishedAt?: string;
  input?: unknown;
  output?: unknown;
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { workflowId, executionId: providedExecutionId, input = {} } = await req.json();

    if (!workflowId) {
      return new Response(JSON.stringify({ error: "workflowId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch workflow
    const { data: workflow, error: workflowError } = await supabase
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .single();

    if (workflowError || !workflow) {
      console.error("Workflow fetch error:", workflowError);
      return new Response(JSON.stringify({ error: "Workflow not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nodes = workflow.nodes as WorkflowNode[];
    const edges = workflow.edges as WorkflowEdge[];

    let executionId: string;
    let execution: { id: string; started_at: string };

    // If executionId is provided (from webhook-trigger), use existing execution
    if (providedExecutionId) {
      console.log(`Using existing execution: ${providedExecutionId}`);
      const { data: existingExecution, error: fetchError } = await supabase
        .from("executions")
        .select("id, started_at, input")
        .eq("id", providedExecutionId)
        .single();
      
      console.log(`Fetched execution:`, JSON.stringify(existingExecution));

      if (fetchError || !existingExecution) {
        console.error("Execution fetch error:", fetchError);
        return new Response(JSON.stringify({ error: "Execution not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      executionId = existingExecution.id;
      execution = existingExecution;
      
      // If started_at is not set, set it now
      if (!execution.started_at) {
        const startedAt = new Date().toISOString();
        await supabase
          .from("executions")
          .update({ started_at: startedAt })
          .eq("id", executionId);
        execution.started_at = startedAt;
      }

      // Update execution status to "running"
      await supabase
        .from("executions")
        .update({ status: "running" })
        .eq("id", executionId);
      
      console.log(`Execution ${executionId} status updated to running`);
    } else {
      // Create new execution record (for manual triggers)
      console.log("Creating new execution record");
      const { data: newExecution, error: execError } = await supabase
        .from("executions")
        .insert({
          workflow_id: workflowId,
          user_id: workflow.user_id,
          status: "running",
          trigger: "manual",
          input,
          logs: [],
        })
        .select()
        .single();

      if (execError || !newExecution) {
        console.error("Execution creation error:", execError);
        return new Response(JSON.stringify({ error: "Failed to create execution" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      executionId = newExecution.id;
      execution = newExecution;
    }
    const logs: ExecutionLog[] = [];
    const nodeOutputs: Record<string, unknown> = { trigger: input };

    // Build execution order (topological sort)
    const executionOrder = topologicalSort(nodes, edges);
    console.log("Execution order:", executionOrder.map(n => n.data.label));
    console.log(`Total nodes to execute: ${executionOrder.length}`);

    // Initialize finalOutput with input in case no nodes execute
    let finalOutput: unknown = input;
    let hasError = false;
    let errorMessage = "";

    // If no nodes to execute, return input as output
    if (executionOrder.length === 0) {
      console.warn("No nodes to execute in workflow");
      await supabase
        .from("executions")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          duration_ms: 0,
          output: input,
          logs: [],
        })
        .eq("id", executionId);
      
      return new Response(
        JSON.stringify({
          executionId,
          status: "success",
          output: input,
          logs: [],
          durationMs: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Execute nodes in order
    for (const node of executionOrder) {
      const log: ExecutionLog = {
        nodeId: node.id,
        nodeName: node.data.label,
        status: "running",
        startedAt: new Date().toISOString(),
      };

      try {
        // Get inputs from connected nodes
        const inputEdges = edges.filter(e => e.target === node.id);
        let nodeInput: unknown;
        
        if (inputEdges.length > 0) {
          // If there's only one connected node, use its output directly
          // Otherwise, combine all connected node outputs
          if (inputEdges.length === 1) {
            nodeInput = nodeOutputs[inputEdges[0].source];
            console.log(`Node ${node.data.label} getting input from connected node ${inputEdges[0].source}:`, JSON.stringify(nodeInput));
          } else {
            nodeInput = inputEdges.reduce((acc, edge) => ({ ...acc, [edge.source]: nodeOutputs[edge.source] }), {});
            console.log(`Node ${node.data.label} getting input from multiple connected nodes:`, JSON.stringify(nodeInput));
          }
        } else {
          // For trigger nodes (no input edges), use the workflow input
          nodeInput = input;
          console.log(`Trigger node ${node.data.label} (${node.data.type}) using workflow input:`, JSON.stringify(nodeInput));
        }

        log.input = nodeInput;
        console.log(`Executing node: ${node.data.label} (${node.data.type})`);
        console.log(`Node input value:`, JSON.stringify(nodeInput));
        console.log(`Node input type:`, typeof nodeInput);
        console.log(`Node input is null?:`, nodeInput === null);
        console.log(`Node input is undefined?:`, nodeInput === undefined);

        // Execute node based on type
        // For AI nodes, retrieve conversation history based on node's memory limit
        let history: Array<{role: string; content: string}> = [];
        const isAINode = ["openai_gpt", "anthropic_claude", "google_gemini", "text_summarizer", "sentiment_analyzer"].includes(node.data.type);
        
        if (isAINode) {
          // Get memory limit from node config (default: 10 turns)
          const memoryLimit = (node.data.config.memory as number) || 10;
          
          // Get session_id from workflow input (passed from webhook-trigger)
          const sessionId = (input as any)?._session_id || (input as any)?.session_id;
          
          if (sessionId && memoryLimit > 0) {
            try {
              history = await retrieveConversationHistory(supabase, workflowId, sessionId, memoryLimit);
              console.log(`Retrieved ${history.length} messages for ${node.data.label} (memory limit: ${memoryLimit} turns)`);
            } catch (historyError) {
              console.error(`Error retrieving conversation history for ${node.data.label}:`, historyError);
              // Continue without history if retrieval fails
            }
          }
        }
        
        const output = await executeNode(node, nodeInput, lovableApiKey, history);
        
        console.log(`Node output value:`, JSON.stringify(output));
        console.log(`Node output type:`, typeof output);
        console.log(`Node output is null?:`, output === null);
        console.log(`Node output is undefined?:`, output === undefined);
        
        // Store output - ensure we store the actual value, not null/undefined
        let outputToStore = output;
        if (output === null || output === undefined) {
          console.error(`Node ${node.data.label} (${node.data.type}) returned null/undefined output!`);
          console.error(`Node input was:`, JSON.stringify(nodeInput));
          // For trigger nodes, if output is null, use the input instead
          if (node.data.type === "webhook" || node.data.type === "manual_trigger" || 
              node.data.type === "schedule" || node.data.type === "http_trigger") {
            outputToStore = nodeInput || {};
            console.log(`Using input as output for trigger node:`, JSON.stringify(outputToStore));
          }
        }
        
        // Store the output (use outputToStore which has fallback for trigger nodes)
        nodeOutputs[node.id] = outputToStore;
        finalOutput = outputToStore;
        
        console.log(`Stored output for node ${node.data.label}:`, JSON.stringify(outputToStore));
        console.log(`NodeOutputs keys:`, Object.keys(nodeOutputs));
        console.log(`NodeOutputs[${node.id}]:`, JSON.stringify(nodeOutputs[node.id]));
        
        log.output = outputToStore;
        log.status = "success";
        log.finishedAt = new Date().toISOString();
      } catch (error) {
        console.error(`Node ${node.id} error:`, error);
        log.status = "failed";
        log.error = error instanceof Error ? error.message : "Unknown error";
        log.finishedAt = new Date().toISOString();
        hasError = true;
        errorMessage = log.error;
      }

      logs.push(log);

      // Update execution with current logs and status (incremental updates)
      try {
        await supabase
          .from("executions")
          .update({ 
            logs,
            status: hasError ? "failed" : "running", // Update status as we go
          })
          .eq("id", executionId);
      } catch (updateError) {
        console.error("Failed to update execution logs:", updateError);
        // Continue execution even if log update fails
      }

      if (hasError) break;
    }

    // Finalize execution
    const finishedAt = new Date().toISOString();
    const durationMs = new Date(finishedAt).getTime() - new Date(execution.started_at).getTime();

    // Ensure finalOutput is never null - use last successful node output or input
    let finalOutputToStore = finalOutput;
    if (finalOutputToStore === null || finalOutputToStore === undefined) {
      console.warn("Final output is null/undefined, using last node output or input");
      // Try to get the last successful node output from logs
      const lastSuccessfulLog = logs.filter(l => l.status === "success" && l.output !== null && l.output !== undefined).pop();
      if (lastSuccessfulLog && lastSuccessfulLog.output !== null && lastSuccessfulLog.output !== undefined) {
        finalOutputToStore = lastSuccessfulLog.output;
        console.log(`Using last successful node output:`, JSON.stringify(finalOutputToStore));
      } else {
        // Fallback to input
        finalOutputToStore = input;
        console.log(`Using input as fallback:`, JSON.stringify(finalOutputToStore));
      }
    }

    console.log(`Finalizing execution with output:`, JSON.stringify(finalOutputToStore));
    console.log(`Final output type:`, typeof finalOutputToStore);
    console.log(`Has error:`, hasError);
    console.log(`Total logs:`, logs.length);

    await supabase
      .from("executions")
      .update({
        status: hasError ? "failed" : "success",
        finished_at: finishedAt,
        duration_ms: durationMs,
        output: finalOutputToStore,
        error: hasError ? errorMessage : null,
        logs,
      })
      .eq("id", executionId);

    return new Response(
      JSON.stringify({
        executionId,
        status: hasError ? "failed" : "success",
        output: finalOutputToStore,
        logs,
        durationMs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Execute workflow error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // If we have an executionId, update it to failed status
    if (executionId) {
      try {
        await supabase
          .from("executions")
          .update({
            status: "failed",
            error: errorMessage,
            finished_at: new Date().toISOString(),
            logs: logs.length > 0 ? logs : [
              {
                nodeId: "system",
                nodeName: "Workflow Execution",
                status: "failed",
                startedAt: new Date().toISOString(),
                finishedAt: new Date().toISOString(),
                error: errorMessage,
              }
            ],
          })
          .eq("id", executionId);
      } catch (updateError) {
        console.error("Failed to update execution status:", updateError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        executionId: executionId || null,
        status: "failed",
        error: errorMessage,
        logs: logs.length > 0 ? logs : [],
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const inDegree: Record<string, number> = {};
  const adjacency: Record<string, string[]> = {};
  const nodeMap: Record<string, WorkflowNode> = {};

  nodes.forEach(node => {
    inDegree[node.id] = 0;
    adjacency[node.id] = [];
    nodeMap[node.id] = node;
  });

  edges.forEach(edge => {
    adjacency[edge.source].push(edge.target);
    inDegree[edge.target] = (inDegree[edge.target] || 0) + 1;
  });

  const queue: string[] = [];
  Object.entries(inDegree).forEach(([nodeId, degree]) => {
    if (degree === 0) queue.push(nodeId);
  });

  const sorted: WorkflowNode[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    sorted.push(nodeMap[nodeId]);

    adjacency[nodeId].forEach(neighbor => {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) queue.push(neighbor);
    });
  }

  return sorted;
}

// Retrieve conversation history for a session with a specific memory limit
async function retrieveConversationHistory(
  supabase: any,
  workflowId: string,
  sessionId: string,
  memoryLimitTurns: number
): Promise<Array<{role: string; content: string}>> {
  const MAX_EXECUTIONS_TO_CHECK = memoryLimitTurns * 2; // Check more executions to find session matches
  
  try {
    const { data: previousExecutions } = await supabase
      .from("executions")
      .select("input, output, logs")
      .eq("workflow_id", workflowId)
      .eq("trigger", "webhook")
      .not("input", "is", null)
      .order("started_at", { ascending: false })
      .limit(MAX_EXECUTIONS_TO_CHECK);

    if (!previousExecutions) {
      return [];
    }

    // Filter executions from the same session and build conversation history
    const sessionExecutions = previousExecutions.filter(exec => {
      const execInput = exec.input as any;
      return execInput?.session_id === sessionId || execInput?._session_id === sessionId;
    }).slice(0, memoryLimitTurns); // Last N conversation turns in this session

    const conversationHistory: Array<{role: string; content: string}> = [];

    // Build conversation history from previous messages (reverse to get chronological order)
    for (const exec of sessionExecutions.reverse()) {
      const execInput = exec.input as any;
      const execOutput = exec.output;
      
      if (execInput?.message) {
        conversationHistory.push({
          role: "user",
          content: execInput.message
        });
      }
      
      if (execOutput) {
        // Extract AI response from output
        let aiResponse = "";
        if (typeof execOutput === "string") {
          aiResponse = execOutput;
        } else if (typeof execOutput === "object") {
          aiResponse = (execOutput as any).text || 
                      (execOutput as any).content || 
                      (execOutput as any).message ||
                      JSON.stringify(execOutput);
        }
        
        if (aiResponse) {
          conversationHistory.push({
            role: "assistant",
            content: aiResponse
          });
        }
      }
    }

    return conversationHistory;
  } catch (error) {
    console.error("Error retrieving conversation history:", error);
    return [];
  }
}

async function executeNode(
  node: WorkflowNode,
  input: unknown,
  lovableApiKey?: string,
  conversationHistory?: Array<{role: string; content: string}>
): Promise<unknown> {
  const { type, config } = node.data;

  switch (type) {
    case "manual_trigger":
    case "webhook":
    case "schedule":
    case "http_trigger":
      // For trigger nodes, return the input directly
      // If input is null/undefined, return an empty object to prevent null outputs
      if (input === null || input === undefined) {
        console.warn(`Trigger node ${node.data.label} received null/undefined input`);
        return {};
      }
      console.log(`Trigger node ${node.data.label} returning input:`, JSON.stringify(input));
      return input;

    case "http_request": {
      const url = replaceTemplates(config.url as string, input);
      const method = (config.method as string) || "GET";
      const headersStr = config.headers as string;
      const headers = headersStr ? JSON.parse(replaceTemplates(headersStr, input)) : {};
      const bodyStr = config.body as string;
      const body = bodyStr ? JSON.parse(replaceTemplates(bodyStr, input)) : undefined;
      const timeout = (config.timeout as number) || 30000;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json", ...headers },
          body: method !== "GET" ? JSON.stringify(body || input) : undefined,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        const text = await response.text();
        try {
          return JSON.parse(text);
        } catch {
          return { text, status: response.status };
        }
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    }

    case "http_post": {
      const url = replaceTemplates(config.url as string, input);
      const headersStr = config.headers as string;
      const headers = headersStr ? JSON.parse(replaceTemplates(headersStr, input)) : {};
      const bodyTemplate = config.bodyTemplate as string;
      const body = bodyTemplate ? replaceTemplates(bodyTemplate, input) : JSON.stringify(input);

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body,
      });

      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        return { text, status: response.status };
      }
    }

    case "openai_gpt":
    case "anthropic_claude":
    case "google_gemini":
    case "text_summarizer":
    case "sentiment_analyzer": {
      const nodeApiKey = config.apiKey as string;

      // Google Gemini uses direct API call
      if (type === "google_gemini") {
        if (!nodeApiKey || !nodeApiKey.trim()) {
          throw new Error(`API Key is required for ${node.data.label || "Google Gemini"} node. Please add your Gemini API key in the node properties.`);
        }
        return executeGeminiNode(config, input, nodeApiKey, conversationHistory);
      }

      // For other AI nodes, API key is mandatory
      if (!nodeApiKey || !nodeApiKey.trim()) {
        const nodeName = type === "openai_gpt" ? "OpenAI GPT" : 
                        type === "anthropic_claude" ? "Anthropic Claude" : 
                        type === "text_summarizer" ? "Text Summarizer" :
                        "Sentiment Analyzer";
        throw new Error(`API Key is required for ${node.data.label || nodeName} node. Please add your API key in the node properties.`);
      }

      const finalApiKey = nodeApiKey;

      let prompt = (config.prompt as string) || "";
      const temperature = (config.temperature as number) || 0.7;

      // Map node type to model
      let model = "google/gemini-pro";
      if (type === "openai_gpt") {
        const configModel = config.model as string;
        if (configModel === "gpt-4o") model = "openai/gpt-4o";
        else if (configModel === "gpt-4-turbo") model = "openai/gpt-4-turbo";
      } else if (type === "anthropic_claude") {
        const configModel = config.model as string;
        if (configModel === "claude-3-opus") model = "anthropic/claude-3-opus";
        else if (configModel === "claude-3-sonnet") model = "anthropic/claude-3-sonnet";
      }

      // Special prompts for specific node types
      if (type === "text_summarizer") {
        const maxLength = (config.maxLength as number) || 200;
        const style = (config.style as string) || "concise";
        prompt = `Summarize the following text in a ${style} manner. Keep it under ${maxLength} words. ${style === "bullets" ? "Use bullet points." : ""}`;
      } else if (type === "sentiment_analyzer") {
        prompt = "Analyze the sentiment of the following text. Return a JSON object with 'sentiment' (positive/negative/neutral), 'confidence' (0-1), and 'emotions' (array of detected emotions).";
      }

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${finalApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: (() => {
            // Build messages array with conversation history
            const messages: Array<{role: string; content: string}> = [
              { role: "system", content: prompt || "You are a helpful assistant." }
            ];
            
            // Add conversation history if available (for memory)
            if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
              messages.push(...conversationHistory);
            }
            
            // Add current user message
            const userMessage = (() => {
              // Extract message from input - handle different input formats
              if (typeof input === "string") {
                return input;
              } else if (typeof input === "object" && input !== null) {
                const inputObj = input as Record<string, unknown>;
                // Try to extract message from common fields
                return (inputObj.message as string) || 
                       (inputObj.text as string) || 
                       (inputObj.content as string) ||
                       (inputObj.input as string) ||
                       JSON.stringify(input);
              } else {
                return String(input);
              }
            })();
            
            messages.push({ role: "user", content: userMessage });
            
            return messages;
          })(),
          temperature,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 429) {
          throw new Error("AI rate limit exceeded. Please try again later.");
        }
        if (response.status === 402) {
          throw new Error("AI credits exhausted. Please add more credits.");
        }
        throw new Error(`AI request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      
      // Try to parse as JSON for sentiment analyzer
      if (type === "sentiment_analyzer") {
        try {
          return JSON.parse(content);
        } catch {
          return { raw: content };
        }
      }
      return content;
    }

    case "slack_message":
    case "slack_webhook": {
      const webhookUrl = config.webhookUrl as string;
      if (!webhookUrl) throw new Error("Slack webhook URL is required");

      const payload: Record<string, unknown> = {};
      
      if (type === "slack_message") {
        payload.text = replaceTemplates(config.message as string, input);
        if (config.channel) payload.channel = config.channel;
        if (config.username) payload.username = config.username;
        if (config.iconEmoji) payload.icon_emoji = config.iconEmoji;
        
        const blocksStr = config.blocks as string;
        if (blocksStr) {
          try {
            const blocks = JSON.parse(replaceTemplates(blocksStr, input));
            if (Array.isArray(blocks) && blocks.length > 0) {
              payload.blocks = blocks;
            }
          } catch {
            // Do nothing, we'll fall back to using the text
          }
        }
      } else {
        payload.text = replaceTemplates(config.text as string, input);
      }

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Slack webhook failed: ${response.status} - ${errorText}`);
      }

      return { success: true, message: "Slack message sent" };
    }

    case "discord_webhook": {
      const webhookUrl = config.webhookUrl as string;
      if (!webhookUrl) throw new Error("Discord webhook URL is required");

      const payload: Record<string, unknown> = {
        content: replaceTemplates(config.content as string, input),
      };
      if (config.username) payload.username = config.username;
      if (config.avatarUrl) payload.avatar_url = config.avatarUrl;

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Discord webhook failed: ${response.status} - ${errorText}`);
      }

      return { success: true, message: "Discord message sent" };
    }

    case "email_resend": {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) {
        throw new Error("RESEND_API_KEY not configured. Add it to your secrets.");
      }

      const to = replaceTemplates(config.to as string, input);
      const from = replaceTemplates(config.from as string, input);
      const subject = replaceTemplates(config.subject as string, input);
      const body = replaceTemplates(config.body as string, input);
      const replyTo = config.replyTo ? replaceTemplates(config.replyTo as string, input) : undefined;

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: to.split(",").map(e => e.trim()),
          subject,
          html: body,
          reply_to: replyTo,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Email send failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return { success: true, emailId: data.id };
    }

    case "if_else": {
      const condition = config.condition as string;
      const result = evaluateCondition(condition, input);
      return { condition: result, input };
    }

    case "filter": {
      const arrayExpr = config.array as string;
      const conditionExpr = config.condition as string;
      
      let items: unknown[] = [];
      if (arrayExpr) {
        items = extractValue(arrayExpr, input) as unknown[] || [];
      } else if (Array.isArray(input)) {
        items = input;
      }

      if (!Array.isArray(items)) {
        throw new Error("Filter requires an array input");
      }

      return items.filter((item) => {
        try {
          const fn = new Function("item", `return ${conditionExpr};`);
          return fn(item);
        } catch {
          return false;
        }
      });
    }

    case "wait": {
      const duration = (config.duration as number) || 1000;
      await new Promise(resolve => setTimeout(resolve, Math.min(duration, 10000)));
      return input;
    }

    case "javascript": {
      const code = config.code as string;
      try {
        const fn = new Function("input", `return (${code})(input);`);
        return fn(input);
      } catch {
        const fn = new Function("input", code);
        return fn(input);
      }
    }

    case "json_parser": {
      const expression = config.expression as string;
      if (!expression) return input;
      return extractValue(expression, input);
    }

    case "text_formatter": {
      const template = config.template as string;
      if (!template) return input;
      return replaceTemplates(template, input);
    }

    case "set_variable": {
      const name = config.name as string;
      const valueExpr = config.value as string;
      const value = replaceTemplates(valueExpr, input);
      return { [name]: value, ...((typeof input === "object" && input) || {}) };
    }

    case "merge_data": {
      if (typeof input === "object" && input !== null) {
        const mode = config.mode as string;
        if (mode === "concat" && Array.isArray(input)) {
          return (input as unknown[]).flat();
        }
        return Object.assign({}, ...Object.values(input as Record<string, unknown>).filter(v => typeof v === "object"));
      }
      return input;
    }

    case "log_output": {
      const message = replaceTemplates(config.message as string, input);
      const level = (config.level as string) || "info";
      console.log(`[${level.toUpperCase()}] ${message}`);
      return { logged: message, level, input };
    }

    case "database_read": {
      // Note: Database operations require supabase client to be passed
      // This is a placeholder - actual implementation would need DB access
      console.log("Database read node - requires integration setup");
      return { warning: "Database nodes require additional setup", config };
    }

    case "database_write": {
      console.log("Database write node - requires integration setup");
      return { warning: "Database nodes require additional setup", config };
    }

    default:
      console.log(`Node type ${type} executed with passthrough`);
      return input;
  }
}

async function executeGeminiNode(
  config: Record<string, unknown>,
  input: unknown,
  apiKey: string,
  conversationHistory?: Array<{role: string; content: string}>
): Promise<unknown> {
  const model = (config.model as string) || "gemini-pro";
  const prompt = (config.prompt as string) || "You are a helpful assistant.";
  const temperature = (config.temperature as number) || 0.7;

  // Extract message from input - handle different input formats
  let userMessage = "";
  if (typeof input === "string") {
    userMessage = input;
  } else if (typeof input === "object" && input !== null) {
    const inputObj = input as Record<string, unknown>;
    // Try to extract message from common fields
    userMessage = (inputObj.message as string) || 
                  (inputObj.text as string) || 
                  (inputObj.content as string) ||
                  (inputObj.input as string) ||
                  JSON.stringify(input);
  } else {
    userMessage = String(input);
  }

  // Build conversation history for Gemini
  const conversationParts: Array<{text: string}> = [];
  
  // Add system prompt
  conversationParts.push({ text: prompt });
  
  // Add conversation history if available (for memory)
  if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
    // Format conversation history for Gemini
    const historyText = conversationHistory
      .map(msg => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
      .join("\n\n");
    conversationParts.push({ text: `Previous conversation:\n${historyText}\n\nCurrent message:` });
  }
  
  // Add current user message
  conversationParts.push({ text: userMessage });

  const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: conversationParts,
        },
      ],
      generationConfig: {
        temperature,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Gemini request failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}


function replaceTemplates(template: string, input: unknown): string {
  if (!template) return "";
  
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    if (path === "input") {
      return typeof input === "string" ? input : JSON.stringify(input);
    }
    
    const value = extractValue(`$.${path}`, input);
    if (value === undefined) return match;
    return typeof value === "string" ? value : JSON.stringify(value);
  });
}

function extractValue(expression: string, input: unknown): unknown {
  if (!expression) return input;
  
  // Handle {{input}} and {{input.field}} patterns
  const cleanExpr = expression.replace(/^\$\.?/, "").replace(/^input\.?/, "");
  
  if (!cleanExpr) return input;
  
  const parts = cleanExpr.split(".");
  let result: unknown = input;
  
  for (const part of parts) {
    if (result && typeof result === "object") {
      // Handle array indexing like items[0]
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, key, index] = arrayMatch;
        const arr = (result as Record<string, unknown>)[key];
        if (Array.isArray(arr)) {
          result = arr[parseInt(index, 10)];
        } else {
          result = undefined;
        }
      } else {
        result = (result as Record<string, unknown>)[part];
      }
    } else {
      return undefined;
    }
  }
  
  return result;
}

function evaluateCondition(condition: string, input: unknown): boolean {
  try {
    const sanitized = condition
      .replace(/\{\{input\.(\w+)\}\}/g, (_, key) => {
        if (input && typeof input === "object") {
          const value = (input as Record<string, unknown>)[key];
          return typeof value === "string" ? `"${value}"` : String(value);
        }
        return "null";
      })
      .replace(/\{\{input\}\}/g, JSON.stringify(input));

    const fn = new Function(`return ${sanitized};`);
    return Boolean(fn());
  } catch (error) {
    console.error("Condition evaluation error:", error);
    return false;
  }
}
