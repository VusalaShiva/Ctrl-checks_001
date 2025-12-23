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
import { executeGoogleSheetsOperation, getGoogleAccessToken } from "../_shared/google-sheets.ts";
import { LLMAdapter } from "../_shared/llm-adapter.ts";

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
  sourceHandle?: string;
  targetHandle?: string;
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

  // Declare variables outside try block so they're accessible in catch block
  let executionId: string | undefined;
  let logs: ExecutionLog[] = [];

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
    logs = [];
    const nodeOutputs: Record<string, unknown> = { trigger: input };
    const ifElseResults: Record<string, boolean> = {}; // Track If/Else condition results
    const switchResults: Record<string, string | null> = {}; // Track Switch matched cases

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
        // Get all input edges for this node
        const inputEdges = edges.filter(e => e.target === node.id);

        // Filter out edges from If/Else and Switch nodes that are on the wrong path
        const validInputEdges = inputEdges.filter(edge => {
          // If edge has a sourceHandle, it's from an If/Else or Switch node
          if (edge.sourceHandle) {
            const sourceNodeId = edge.source;
            const sourceNode = nodes.find(n => n.id === sourceNodeId);
            const expectedPath = edge.sourceHandle; // "true"/"false" for If/Else, case value for Switch

            console.log(`Checking edge from ${edge.source} (${edge.sourceHandle}) to ${node.data.label}`);

            // Handle If/Else nodes
            if (sourceNode?.data.type === "if_else") {
              console.log(`If/Else results:`, JSON.stringify(ifElseResults));

              // Check if we have the condition result
              if (ifElseResults[sourceNodeId] !== undefined) {
                const actualResult = ifElseResults[sourceNodeId];
                const isValid = (expectedPath === "true" && actualResult) || (expectedPath === "false" && !actualResult);
                console.log(`Edge from ${edge.source} (${expectedPath}) - condition was ${actualResult}, isValid: ${isValid}`);
                return isValid;
              }
              // If condition not evaluated yet, exclude this edge (shouldn't happen in topological order)
              console.log(`If/Else node ${sourceNodeId} hasn't been evaluated yet, excluding edge`);
              return false;
            }

            // Handle Switch nodes
            if (sourceNode?.data.type === "switch") {
              console.log(`Switch results:`, JSON.stringify(switchResults));

              // Check if we have the switch result
              if (switchResults[sourceNodeId] !== undefined) {
                const matchedCase = switchResults[sourceNodeId];

                // If sourceHandle is set, use it for routing
                if (expectedPath) {
                  const isValid = matchedCase !== null && String(matchedCase) === String(expectedPath);
                  console.log(`Edge from ${edge.source} (${expectedPath}) - matched case was ${matchedCase}, isValid: ${isValid}`);
                  return isValid;
                } else {
                  // If sourceHandle is not set, this edge shouldn't be used for Switch routing
                  // All Switch edges should have sourceHandle set to the case value
                  console.warn(`Edge from Switch node ${sourceNodeId} to ${node.data.label} doesn't have sourceHandle set. Switch routing requires sourceHandle to be set to the case value.`);
                  return false;
                }
              }
              // If switch not evaluated yet, exclude this edge
              console.log(`Switch node ${sourceNodeId} hasn't been evaluated yet, excluding edge`);
              return false;
            }

            // Unknown node type with sourceHandle
            console.log(`Unknown node type ${sourceNode?.data.type} with sourceHandle, excluding edge`);
            return false;
          }
          // Regular edges (no sourceHandle) are always valid
          return true;
        });

        console.log(`Node ${node.data.label} - Total input edges: ${inputEdges.length}, Valid edges: ${validInputEdges.length}`);
        inputEdges.forEach(e => {
          console.log(`  Edge: ${e.source} -> ${e.target}, sourceHandle: ${e.sourceHandle || 'none'}`);
        });

        // If node only has If/Else or Switch inputs and none are valid, skip this node
        const hasOnlyConditionalInputs = inputEdges.length > 0 && inputEdges.every(e => {
          if (!e.sourceHandle) return false;
          const sourceNode = nodes.find(n => n.id === e.source);
          return sourceNode?.data.type === "if_else" || sourceNode?.data.type === "switch";
        });
        if (hasOnlyConditionalInputs && validInputEdges.length === 0) {
          console.log(`Skipping node ${node.data.label} - all conditional inputs are on wrong path`);
          log.status = "skipped";
          log.finishedAt = new Date().toISOString();
          logs.push(log);
          continue;
        }

        let nodeInput: unknown;

        if (validInputEdges.length > 0) {
          // If there's only one connected node, use its output directly
          // For If/Else nodes, extract the 'input' property for downstream nodes
          if (validInputEdges.length === 1) {
            const sourceOutput = nodeOutputs[validInputEdges[0].source];
            const sourceNode = nodes.find(n => n.id === validInputEdges[0].source);

            // If source is If/Else node, extract the 'input' property
            if (sourceNode?.data.type === "if_else" && sourceOutput && typeof sourceOutput === "object") {
              const outputObj = sourceOutput as Record<string, unknown>;
              nodeInput = outputObj.input !== undefined ? outputObj.input : sourceOutput;
              console.log(`Node ${node.data.label} getting input from If/Else node, extracted input:`, JSON.stringify(nodeInput));
            } else {
              nodeInput = sourceOutput;
              console.log(`Node ${node.data.label} getting input from connected node ${validInputEdges[0].source}:`, JSON.stringify(nodeInput));
            }
          } else {
            nodeInput = validInputEdges.reduce((acc, edge) => ({ ...acc, [edge.source]: nodeOutputs[edge.source] }), {});
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
        let history: Array<{ role: string; content: string }> = [];
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

        // Add user_id and workflow_id to node input for context
        const enrichedInput = {
          ...(typeof nodeInput === 'object' && nodeInput !== null ? nodeInput : { value: nodeInput }),
          _user_id: workflow.user_id,
          _workflow_id: workflowId,
        };
        const output = await executeNode(node, enrichedInput, lovableApiKey, history, workflow.user_id);

        // If this is an If/Else node, store the condition result
        if (node.data.type === "if_else" && typeof output === "object" && output !== null) {
          const outputObj = output as Record<string, unknown>;
          if (typeof outputObj.condition === "boolean") {
            ifElseResults[node.id] = outputObj.condition;
            console.log(`If/Else node ${node.data.label} condition result: ${outputObj.condition}`);
          }
        }

        // If this is a Switch node, store the matched case
        if (node.data.type === "switch" && typeof output === "object" && output !== null) {
          const outputObj = output as Record<string, unknown>;
          if (outputObj.matchedCase !== undefined) {
            switchResults[node.id] = outputObj.matchedCase as string | null;
            console.log(`Switch node ${node.data.label} matched case: ${outputObj.matchedCase}`);
          }
        }

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
): Promise<Array<{ role: string; content: string }>> {
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

    const conversationHistory: Array<{ role: string; content: string }> = [];

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
  conversationHistory?: Array<{ role: string; content: string }>,
  userId?: string
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

      // Retry logic for transient connection errors
      const maxRetries = 2;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
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
          lastError = error instanceof Error ? error : new Error(String(error));

          const errorMessage = lastError.message;

          // Retry on TLS/connection errors (transient issues)
          if (attempt < maxRetries && (
            errorMessage.includes("TLS") ||
            errorMessage.includes("connection error") ||
            errorMessage.includes("close_notify") ||
            errorMessage.includes("unexpected_eof")
          )) {
            console.log(`HTTP Request attempt ${attempt + 1} failed, retrying... (${attempt + 1}/${maxRetries + 1})`);
            // Wait a bit before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
            continue;
          }

          // Provide better error messages for common network issues
          if (errorMessage.includes("TLS") || errorMessage.includes("connection error") || errorMessage.includes("close_notify") || errorMessage.includes("unexpected_eof")) {
            // Check if it's httpstat.us (known to have TLS issues with Deno)
            if (url.includes("httpstat.us")) {
              throw new Error(
                `HTTP Request failed: TLS connection error with httpstat.us\n\n` +
                `URL: ${url}\n` +
                `Error: ${errorMessage}\n\n` +
                `⚠️ Known Issue: httpstat.us has TLS compatibility issues with Deno/rustls.\n\n` +
                `✅ Recommended Test Endpoints:\n` +
                `  - https://jsonplaceholder.typicode.com/posts/1\n` +
                `  - https://api.github.com\n` +
                `  - https://httpbin.org/get\n` +
                `  - https://reqres.in/api/users/1\n\n` +
                `These endpoints work reliably with Deno's fetch implementation.`
              );
            } else {
              throw new Error(
                `HTTP Request failed: Connection/TLS error\n\n` +
                `URL: ${url}\n` +
                `Error: ${errorMessage}\n\n` +
                `Possible causes:\n` +
                `  - Server closed connection unexpectedly\n` +
                `  - TLS/SSL handshake failed\n` +
                `  - Network timeout or connectivity issue\n` +
                `  - Server may be down or unreachable\n\n` +
                `Solutions:\n` +
                `  - Check if the URL is correct and accessible\n` +
                `  - Try increasing the timeout value\n` +
                `  - Verify the server supports HTTPS/TLS\n` +
                `  - Check your network connection\n` +
                `  - Try a different endpoint (e.g., https://jsonplaceholder.typicode.com/posts/1)`
              );
            }
          } else if (errorMessage.includes("aborted") || errorMessage.includes("timeout")) {
            throw new Error(
              `HTTP Request timeout: Request took longer than ${timeout}ms\n\n` +
              `URL: ${url}\n` +
              `Timeout: ${timeout}ms\n\n` +
              `Solutions:\n` +
              `  - Increase timeout in node properties (current: ${timeout}ms)\n` +
              `  - Check if the server is responding\n` +
              `  - Verify the URL is correct`
            );
          } else if (errorMessage.includes("Failed to fetch") || errorMessage.includes("network")) {
            throw new Error(
              `HTTP Request failed: Network error\n\n` +
              `URL: ${url}\n` +
              `Error: ${errorMessage}\n\n` +
              `Possible causes:\n` +
              `  - No internet connection\n` +
              `  - DNS resolution failed\n` +
              `  - Server is unreachable\n` +
              `  - Firewall blocking the request\n\n` +
              `Solutions:\n` +
              `  - Check your internet connection\n` +
              `  - Verify the URL is correct\n` +
              `  - Try accessing the URL in a browser`
            );
          }

          // For other errors, throw with context
          throw new Error(`HTTP Request failed: ${errorMessage}\n\nURL: ${url}`);
        }
      }

      // If we get here, all retries failed
      throw lastError || new Error(`HTTP Request failed after ${maxRetries + 1} attempts`);
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

      // Map node type/model selection to gateway model id
      const configModel = (config.model as string) || "";
      let model = "google/gemini-pro"; // fallback

      const setOpenAI = (val: string) => {
        if (val === "gpt-4o") return "openai/gpt-4o";
        if (val === "gpt-4o-mini" || val === "gpt-4o-mini-2024-07-18" || val === "gpt-4o-mini-2024-07-18") return "openai/gpt-4o-mini";
        if (val === "gpt-4-turbo") return "openai/gpt-4-turbo";
        return undefined;
      };

      const setClaude = (val: string) => {
        if (val === "claude-3-5-sonnet") return "anthropic/claude-3-5-sonnet";
        if (val === "claude-3-5-haiku") return "anthropic/claude-3-5-haiku";
        if (val === "claude-3-sonnet") return "anthropic/claude-3-sonnet";
        if (val === "claude-3-opus") return "anthropic/claude-3-opus";
        if (val === "claude-3-haiku") return "anthropic/claude-3-haiku";
        return undefined;
      };

      const setGemini = (val: string) => {
        if (val === "gemini-2.5-flash") return "google/gemini-2.5-flash";
        if (val === "gemini-2.5-pro") return "google/gemini-2.5-pro";
        if (val === "gemini-2.5-flash-lite") return "google/gemini-2.5-flash-lite";
        return undefined;
      };

      if (type === "openai_gpt") {
        model = setOpenAI(configModel) || model;
      } else if (type === "anthropic_claude") {
        model = setClaude(configModel) || model;
      } else if (type === "text_summarizer" || type === "sentiment_analyzer") {
        // Allow selecting any supported provider for summarizer/sentiment
        // Try all providers in order of preference
        model = setOpenAI(configModel) || setClaude(configModel) || setGemini(configModel) || model;
      }
      // Note: google_gemini is handled earlier with early return, so we don't need to check it here

      // Special prompts for specific node types
      if (type === "text_summarizer") {
        const maxLength = (config.maxLength as number) || 200;
        const style = (config.style as string) || "concise";
        prompt = `Summarize the following text in a ${style} manner. Keep it under ${maxLength} words. ${style === "bullets" ? "Use bullet points." : ""}`;
      } else if (type === "sentiment_analyzer") {
        prompt = "Analyze the sentiment of the following text. Return a JSON object with 'sentiment' (positive/negative/neutral), 'confidence' (0-1), and 'emotions' (array of detected emotions).";
      }

      // Build messages array with conversation history
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: "system", content: prompt || "You are a helpful assistant." }
      ];

      // Add conversation history if available (for memory)
      if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
        messages.push(...conversationHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })));
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

      // Use LLM Adapter for unified interface
      try {
        const response = await llmAdapter.chat(provider, messages, {
          model,
          temperature,
          apiKey: finalApiKey,
        });

        const content = response.content;

        // Try to parse as JSON for sentiment analyzer
        if (type === "sentiment_analyzer") {
          try {
            return JSON.parse(content);
          } catch {
            return { raw: content };
          }
        }

        return content;
      } catch (error) {
        // Fallback to gateway for backward compatibility
        console.warn("LLM Adapter failed, falling back to gateway:", error);

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${finalApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages,
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
        console.warn("RESEND_API_KEY not configured. Email node will be skipped.");
        return {
          success: false,
          skipped: true,
          message: "Email skipped: RESEND_API_KEY not configured. Add it to your Supabase secrets to enable email sending.",
          input: input // Pass through input so workflow continues
        };
      }

      // Extract and validate email fields
      const to = replaceTemplates(config.to as string, input);
      const from = replaceTemplates(config.from as string, input);
      const subject = replaceTemplates(config.subject as string, input);
      const body = replaceTemplates(config.body as string, input);
      const replyTo = config.replyTo ? replaceTemplates(config.replyTo as string, input) : undefined;

      // Validate required fields
      if (!to || !to.trim()) {
        throw new Error("Email 'To' field is required. Please configure the recipient email address in the node properties.");
      }

      if (!from || !from.trim()) {
        throw new Error("Email 'From' field is required. Please configure the sender email address in the node properties. Format: 'email@example.com' or 'Name <email@example.com>'");
      }

      // Validate email format (basic check)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const fromEmailMatch = from.match(/<([^>]+)>/) || from.match(/^([^\s<]+)$/);
      const fromEmail = fromEmailMatch ? fromEmailMatch[1] : from.trim();

      if (!emailRegex.test(fromEmail)) {
        // Provide helpful error message with examples
        const currentValue = from.trim();
        let helpfulMessage = `Invalid 'From' email format: "${currentValue}"\n\n`;
        helpfulMessage += `Current value appears to be a domain/URL, not an email address.\n\n`;
        helpfulMessage += `Please update the "From" field in the email node properties to:\n`;
        helpfulMessage += `  - A valid email: "notifications@ctrl-checks-001.vercel.app"\n`;
        helpfulMessage += `  - Or with name: "CtrlChecks <notifications@ctrl-checks-001.vercel.app>"\n\n`;
        helpfulMessage += `Note: The email domain must be verified in your Resend account.`;
        throw new Error(helpfulMessage);
      }

      // Validate 'To' emails
      const toEmails = to.split(",").map(e => e.trim()).filter(e => e);
      if (toEmails.length === 0) {
        throw new Error("Email 'To' field must contain at least one valid email address.");
      }

      for (const email of toEmails) {
        if (!emailRegex.test(email)) {
          throw new Error(`Invalid 'To' email format: "${email}". Use format: 'email@example.com'`);
        }
      }

      if (!subject || !subject.trim()) {
        throw new Error("Email 'Subject' field is required. Please configure the email subject in the node properties.");
      }

      if (!body || !body.trim()) {
        throw new Error("Email 'Body' field is required. Please configure the email body content in the node properties.");
      }

      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: from.trim(),
            to: toEmails,
            subject: subject.trim(),
            html: body.trim(),
            reply_to: replyTo ? replyTo.trim() : undefined,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = `Email send failed: ${response.status}`;
          try {
            const errorJson = JSON.parse(errorText);
            const resendMessage = errorJson.message || errorText;
            errorMessage += ` - ${resendMessage}`;

            // Provide helpful guidance for common Resend errors
            if (response.status === 403 && resendMessage.includes("domain is not verified")) {
              errorMessage += `\n\n`;
              errorMessage += `🔧 SOLUTION:\n`;
              errorMessage += `Your email domain is not verified in Resend.\n\n`;
              errorMessage += `Option 1 (Testing): Use Resend's test domain:\n`;
              errorMessage += `  From: onboarding@resend.dev\n`;
              errorMessage += `  To: delivered@resend.dev\n\n`;
              errorMessage += `Option 2 (Production): Verify your domain:\n`;
              errorMessage += `  1. Go to https://resend.com/domains\n`;
              errorMessage += `  2. Add and verify your domain: ${fromEmail.split('@')[1] || 'your-domain.com'}\n`;
              errorMessage += `  3. Add the required DNS records\n`;
              errorMessage += `  4. Wait for verification (usually a few minutes)\n\n`;
              errorMessage += `For more help: https://resend.com/docs/dashboard/domains/introduction`;
            } else if (response.status === 403 && (resendMessage.includes("free public domains") || resendMessage.includes("don't allow"))) {
              errorMessage += `\n\n`;
              errorMessage += `❌ ISSUE: Resend doesn't allow free subdomains (like vercel.app, netlify.app, etc.)\n\n`;
              errorMessage += `🔧 SOLUTIONS:\n\n`;
              errorMessage += `Option 1 (Testing - Recommended):\n`;
              errorMessage += `  Use Resend's test domain (works immediately):\n`;
              errorMessage += `  From: onboarding@resend.dev\n`;
              errorMessage += `  To: delivered@resend.dev\n\n`;
              errorMessage += `Option 2 (Production):\n`;
              errorMessage += `  Use a domain you own (not a free subdomain):\n`;
              errorMessage += `  - Buy a domain (e.g., yourdomain.com)\n`;
              errorMessage += `  - Or use your existing domain\n`;
              errorMessage += `  - Verify it in Resend: https://resend.com/domains\n\n`;
              errorMessage += `Option 3 (Skip Email):\n`;
              errorMessage += `  Remove or disconnect the email node if you don't need it.\n`;
            } else if (response.status === 403) {
              errorMessage += `\n\n`;
              errorMessage += `This is likely a domain verification or API key issue.\n`;
              errorMessage += `Check: https://resend.com/domains`;
            }
          } catch {
            errorMessage += ` - ${errorText}`;
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        return { success: true, emailId: data.id, message: "Email sent successfully" };
      } catch (error) {
        console.error("Email send error:", error);
        throw error;
      }
    }

    case "if_else": {
      const condition = config.condition as string;
      // Extract the actual input data (in case it's wrapped)
      const actualInput = (input && typeof input === "object" && "input" in input)
        ? (input as Record<string, unknown>).input
        : input;

      console.log(`If/Else node evaluating condition: "${condition}"`);
      console.log(`If/Else node input:`, JSON.stringify(actualInput));

      const result = evaluateCondition(condition, actualInput);

      console.log(`If/Else condition result: ${result}`);

      // Return the original input structure for downstream nodes
      return { condition: result, input: actualInput };
    }

    case "switch": {
      const expression = config.expression as string;

      if (!expression || !expression.trim()) {
        throw new Error("Switch expression is required. Please configure the expression in the node properties.");
      }

      // Parse cases - can be a JSON string or already an array
      let cases: Array<{ value: string; label?: string }> = [];
      const casesConfig = config.cases;

      if (casesConfig) {
        if (typeof casesConfig === "string") {
          // Parse JSON string
          try {
            cases = JSON.parse(casesConfig);
          } catch (parseError) {
            console.error("Switch: Failed to parse cases JSON:", parseError);
            throw new Error(`Switch cases must be valid JSON array. Error: ${parseError instanceof Error ? parseError.message : "Invalid JSON"}`);
          }
        } else if (Array.isArray(casesConfig)) {
          // Already an array
          cases = casesConfig;
        } else {
          throw new Error("Switch cases must be a JSON array. Format: [{\"value\": \"active\", \"label\": \"Active\"}]");
        }
      }

      if (!Array.isArray(cases)) {
        throw new Error(`Switch cases must be an array. Received: ${typeof cases}. Please configure cases as JSON array in node properties.`);
      }

      // Evaluate the expression to get the value to match
      const expressionValue = replaceTemplates(expression, input);
      const matchValue = expressionValue.trim();

      console.log(`Switch node evaluating expression: "${expression}"`);
      console.log(`Switch node input:`, JSON.stringify(input));
      console.log(`Switch expression result: "${matchValue}"`);
      console.log(`Switch cases:`, JSON.stringify(cases));

      // Find matching case
      const matchingCase = cases.find(c => String(c.value) === matchValue);

      if (matchingCase) {
        console.log(`Switch matched case: "${matchingCase.value}" (${matchingCase.label || 'no label'})`);
        // Return input with case information for routing
        return {
          matchedCase: matchingCase.value,
          caseLabel: matchingCase.label,
          input: input
        };
      } else {
        console.log(`Switch: No matching case found for "${matchValue}"`);
        console.log(`Available cases:`, cases.map(c => c.value).join(", "));
        // Return input with no match (could route to default branch if implemented)
        return {
          matchedCase: null,
          caseLabel: null,
          input: input
        };
      }
    }

    case "filter": {
      const arrayExpr = config.array as string;
      const conditionExpr = config.condition as string;

      if (!conditionExpr || !conditionExpr.trim()) {
        throw new Error("Filter condition is required. Please configure the filter condition in the node properties.");
      }

      let items: unknown[] = [];

      // Try to extract array from expression
      if (arrayExpr && arrayExpr.trim()) {
        // Handle different expression formats
        const cleanExpr = arrayExpr.trim();

        // If expression starts with input., extractValue should handle it
        if (cleanExpr.startsWith("input.") || cleanExpr.startsWith("{{input.")) {
          // Remove template syntax if present
          const expr = cleanExpr.replace(/^\{\{|\}\}$/g, "").replace(/^input\./, "");
          items = extractValue(expr, input) as unknown[] || [];
        } else {
          // Try direct extraction
          items = extractValue(cleanExpr, input) as unknown[] || [];
        }
      }

      // If no array found, try common patterns
      if (!Array.isArray(items) || items.length === 0) {
        // Check if input itself is an array
        if (Array.isArray(input)) {
          items = input;
        }
        // Check if input has an 'items' property
        else if (typeof input === "object" && input !== null) {
          const inputObj = input as Record<string, unknown>;
          if (Array.isArray(inputObj.items)) {
            items = inputObj.items;
          } else if (Array.isArray(inputObj.data)) {
            items = inputObj.data;
          } else if (Array.isArray(inputObj.array)) {
            items = inputObj.array;
          } else {
            // Try to find any array property
            const arrayKey = Object.keys(inputObj).find(key => Array.isArray(inputObj[key]));
            if (arrayKey) {
              items = inputObj[arrayKey] as unknown[];
            }
          }
        }
      }

      if (!Array.isArray(items)) {
        throw new Error(
          `Filter requires an array input.\n\n` +
          `Received: ${typeof input === "object" ? JSON.stringify(input).substring(0, 200) : String(input)}\n\n` +
          `Please configure the "Array Expression" field to point to an array property.\n` +
          `Examples: "items", "input.items", "{{input.items}}"`
        );
      }

      console.log(`Filter: Processing ${items.length} items with condition: ${conditionExpr}`);

      const filtered = items.filter((item) => {
        try {
          // Evaluate condition with item in scope
          const fn = new Function("item", `return ${conditionExpr};`);
          const result = fn(item);
          console.log(`Filter: Item ${JSON.stringify(item).substring(0, 50)}... -> ${result}`);
          return Boolean(result);
        } catch (error) {
          console.error(`Filter condition evaluation error for item:`, item, error);
          return false;
        }
      });

      console.log(`Filter: Filtered ${items.length} items down to ${filtered.length} items`);
      return filtered;
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

      // Flatten nested Set Variable outputs for easier template access
      // If input has nested objects from Set Variable nodes, merge them
      let flattenedInput = input;
      if (typeof input === "object" && input !== null) {
        const inputObj = input as Record<string, unknown>;
        const keys = Object.keys(inputObj);

        // Check if this looks like multiple Set Variable outputs (nested objects with variable names)
        const hasNestedVariables = keys.some(key => {
          const value = inputObj[key];
          return typeof value === "object" && value !== null && !Array.isArray(value);
        });

        if (hasNestedVariables) {
          // Flatten: merge all nested objects into one
          flattenedInput = {};
          keys.forEach(key => {
            const value = inputObj[key];
            if (typeof value === "object" && value !== null && !Array.isArray(value)) {
              // Merge nested object properties
              Object.assign(flattenedInput as Record<string, unknown>, value as Record<string, unknown>);
            } else {
              // Keep non-object values as-is
              (flattenedInput as Record<string, unknown>)[key] = value;
            }
          });
          console.log(`Text Formatter: Flattened input from ${keys.length} sources:`, JSON.stringify(flattenedInput));
        }
      }

      return replaceTemplates(template, flattenedInput);
    }

    case "set_variable": {
      const name = config.name as string;
      const valueExpr = config.value as string;
      const value = replaceTemplates(valueExpr, input);
      return { [name]: value, ...((typeof input === "object" && input) || {}) };
    }

    case "csv_processor": {
      const delimiter = (config.delimiter as string) || ",";
      const hasHeader = config.hasHeader !== false; // Default to true

      // Extract CSV string from input
      let csvString = "";
      if (typeof input === "string") {
        csvString = input;
      } else if (typeof input === "object" && input !== null) {
        const inputObj = input as Record<string, unknown>;
        // Try to find CSV string in common fields
        csvString = (inputObj.csv as string) ||
          (inputObj.data as string) ||
          (inputObj.text as string) ||
          (inputObj.content as string) ||
          "";

        // If no CSV field found, try to stringify the whole object
        if (!csvString && Object.keys(inputObj).length === 1) {
          const firstValue = Object.values(inputObj)[0];
          if (typeof firstValue === "string") {
            csvString = firstValue;
          }
        }
      }

      if (!csvString || !csvString.trim()) {
        console.warn("CSV Processor: No CSV string found in input");
        return input; // Return input unchanged if no CSV found
      }

      // Parse CSV
      const lines = csvString.trim().split("\n").filter(line => line.trim());
      if (lines.length === 0) {
        return [];
      }

      let headers: string[] = [];
      const rows: Record<string, string>[] = [];

      lines.forEach((line, index) => {
        const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ""));

        if (index === 0 && hasHeader) {
          headers = values;
        } else {
          if (hasHeader && headers.length > 0) {
            const row: Record<string, string> = {};
            headers.forEach((header, i) => {
              row[header] = values[i] || "";
            });
            rows.push(row);
          } else {
            // No header row - use column indices
            const row: Record<string, string> = {};
            values.forEach((value, i) => {
              row[`column${i + 1}`] = value;
            });
            rows.push(row);
          }
        }
      });

      console.log(`CSV Processor: Parsed ${rows.length} rows with ${hasHeader ? headers.length : 'no'} headers`);

      // Return parsed data, preserving other input fields if they exist
      if (typeof input === "object" && input !== null) {
        const inputObj = input as Record<string, unknown>;
        return {
          ...inputObj,
          csvData: rows,
          csvRows: rows.length,
          csvHeaders: hasHeader ? headers : []
        };
      }

      return rows;
    }

    case "merge_data": {
      const mode = (config.mode as string) || "merge";

      // If input is an object with multiple source nodes, merge them
      if (typeof input === "object" && input !== null) {
        const inputObj = input as Record<string, unknown>;
        const keys = Object.keys(inputObj);

        if (mode === "concat") {
          // Concatenate arrays
          const arrays: unknown[] = [];
          keys.forEach(key => {
            const value = inputObj[key];
            if (Array.isArray(value)) {
              arrays.push(...value);
            } else if (value !== undefined && value !== null) {
              arrays.push(value);
            }
          });
          return arrays;
        } else {
          // Merge mode: combine all object properties
          const merged: Record<string, unknown> = {};

          keys.forEach(key => {
            const value = inputObj[key];
            if (value !== undefined && value !== null) {
              if (typeof value === "object" && !Array.isArray(value)) {
                // Merge object properties
                Object.assign(merged, value as Record<string, unknown>);
              } else {
                // Keep array or primitive as-is
                merged[key] = value;
              }
            }
          });

          return merged;
        }
      }

      // If input is an array and mode is concat, flatten it
      if (Array.isArray(input) && mode === "concat") {
        return input.flat();
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

    case "google_sheets": {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

      const operation = (config.operation as string) || 'read';
      const spreadsheetId = replaceTemplates(config.spreadsheetId as string, input);
      const sheetName = config.sheetName ? replaceTemplates(config.sheetName as string, input) : undefined;
      const range = config.range ? replaceTemplates(config.range as string, input) : undefined;
      const outputFormat = (config.outputFormat as string) || 'json';
      const readDirection = (config.readDirection as string) || 'rows';
      const allowWrite = (config.allowWrite as boolean) || false;

      // Get user ID from workflow context
      const userId = (input as any)?._user_id;
      if (!userId) {
        throw new Error('Google Sheets node: User ID not found in workflow context');
      }

      // Check write permissions - REMOVED ADMIN CHECK per user request
      /*
      if ((operation === 'write' || operation === 'append' || operation === 'update') && !allowWrite) {
        // Check if user is admin
        const { data: userRole } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .single();

        if (!userRole) {
          throw new Error('Write access to Google Sheets requires admin privileges. Please enable "Allow Write Access" in node settings (admin only).');
        }
      }
      */

      // Get Google OAuth access token
      const accessToken = await getGoogleAccessToken(supabaseClient, userId);

      if (!accessToken) {
        throw new Error('Google OAuth token not found. Please authenticate with Google first.');
      }

      // Prepare data for write operations
      let writeData: unknown[][] | undefined;
      if (operation === 'write' || operation === 'append' || operation === 'update') {
        const dataConfig = config.data;
        if (dataConfig) {
          if (typeof dataConfig === 'string') {
            try {
              writeData = JSON.parse(replaceTemplates(dataConfig, input));
            } catch {
              throw new Error('Invalid JSON format for write data. Expected 2D array: [["col1", "col2"], ["val1", "val2"]]');
            }
          } else if (Array.isArray(dataConfig)) {
            writeData = dataConfig as unknown[][];
          } else {
            throw new Error('Write data must be a 2D array (array of rows)');
          }
        } else {
          // Try to extract from input
          const inputData = (input as any)?.data || (input as any)?.rows || input;
          if (Array.isArray(inputData)) {
            // Check if it's already a 2D array
            if (Array.isArray(inputData[0])) {
              writeData = inputData as unknown[][];
            } else {
              // Convert 1D array to 2D (single row)
              writeData = [inputData as unknown[]];
            }
          } else {
            throw new Error('No data provided for write operation. Add data in node config or pass it in input.');
          }
        }
      }

      // Execute Google Sheets operation
      const result = await executeGoogleSheetsOperation({
        spreadsheetId,
        sheetName,
        range,
        operation: operation as 'read' | 'write' | 'append' | 'update',
        outputFormat: outputFormat as 'json' | 'keyvalue' | 'text',
        readDirection: readDirection as 'rows' | 'columns',
        data: writeData,
        accessToken,
      });

      if (!result.success) {
        throw new Error(result.error || 'Google Sheets operation failed');
      }

      // Return formatted result
      return {
        data: result.data,
        rows: result.rows,
        columns: result.columns,
        operation,
        spreadsheetId,
        sheetName: sheetName || 'Sheet1',
        range: range || 'All',
        formatted: outputFormat,
      };
    }

    case "memory": {
      // Import memory service
      const { HybridMemoryService } = await import("../_shared/memory.ts");

      const operation = (config.operation as string) || 'store';
      const memoryType = (config.memoryType as string) || 'both';
      const ttl = (config.ttl as number) || 3600;
      const maxMessages = (config.maxMessages as number) || 100;

      // Get session ID from input or generate one
      const sessionId = (input as any)?._session_id ||
        (input as any)?.session_id ||
        `session-${Date.now()}`;

      // Get workflow ID from context (passed from execution)
      const workflowId = (input as any)?._workflow_id || '';

      // Initialize memory service
      const memoryService = new HybridMemoryService(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { type: memoryType === 'short' ? 'redis' : memoryType === 'long' ? 'vector' : 'hybrid', ttl, maxMessages }
      );

      await memoryService.initialize();

      // Ensure session exists in database
      if (workflowId) {
        await memoryService.getOrCreateSession(workflowId, sessionId, (input as any)?._user_id);
      }

      if (operation === 'store') {
        // Extract message from input
        let message = '';
        let role: 'user' | 'assistant' | 'system' = 'user';

        if (typeof input === 'string') {
          message = input;
        } else if (typeof input === 'object' && input !== null) {
          const inputObj = input as Record<string, unknown>;
          message = (inputObj.message as string) ||
            (inputObj.content as string) ||
            (inputObj.text as string) ||
            JSON.stringify(input);
          role = (inputObj.role as 'user' | 'assistant' | 'system') || 'user';
        }

        if (!message) {
          throw new Error('Memory node (store): No message content found in input');
        }

        await memoryService.store(sessionId, role, message, (input as any)?.metadata);

        return {
          success: true,
          stored: true,
          sessionId,
          message: 'Message stored in memory',
          role,
          content: message.substring(0, 100) + (message.length > 100 ? '...' : '')
        };
      }
      else if (operation === 'retrieve') {
        const messages = await memoryService.retrieve(sessionId, maxMessages);

        return {
          messages,
          count: messages.length,
          sessionId,
          // Also pass through original input for downstream nodes
          ...(typeof input === 'object' && input !== null ? input : {})
        };
      }
      else if (operation === 'clear') {
        await memoryService.clear(sessionId);
        return {
          success: true,
          cleared: true,
          sessionId,
          message: 'Memory cleared'
        };
      }
      else if (operation === 'search') {
        const query = (input as any)?.query ||
          (input as any)?.search ||
          (typeof input === 'string' ? input : '');

        if (!query) {
          throw new Error('Memory node (search): Search query is required');
        }

        const messages = await memoryService.search(sessionId, query, maxMessages);
        return {
          messages,
          query,
          count: messages.length,
          sessionId
        };
      }

      throw new Error(`Unknown memory operation: ${operation}`);
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
  conversationHistory?: Array<{ role: string; content: string }>
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
  const conversationParts: Array<{ text: string }> = [];

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

  console.log(`[TEMPLATE] Replacing templates in: "${template}"`);
  console.log(`[TEMPLATE] Input:`, JSON.stringify(input));

  // First replace {{input.property}} patterns
  let result = template.replace(/\{\{input\.([\w.]+)\}\}/g, (match, path) => {
    console.log(`[TEMPLATE] Replacing ${match} with path: ${path}`);

    if (input && typeof input === "object" && input !== null) {
      const inputObj = input as Record<string, unknown>;
      const keys = path.split('.');
      let value: unknown = inputObj;

      for (const key of keys) {
        if (value && typeof value === "object" && value !== null && key in value) {
          value = (value as Record<string, unknown>)[key];
        } else {
          console.log(`[TEMPLATE] Failed to find key "${key}" in path "${path}"`);
          return match; // Return original if not found
        }
      }

      console.log(`[TEMPLATE] Extracted value for "${path}":`, value);

      // Return the value as string (don't JSON.stringify strings)
      if (typeof value === "string") {
        return value;
      } else if (value === null || value === undefined) {
        return String(value);
      } else {
        return String(value);
      }
    }

    return match; // Return original if input is not an object
  });

  // Then replace {{input}} pattern
  result = result.replace(/\{\{input\}\}/g, () => {
    return typeof input === "string" ? input : JSON.stringify(input);
  });

  console.log(`[TEMPLATE] Final result: "${result}"`);
  return result;
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
    if (!condition || !condition.trim()) {
      console.error("Empty condition provided");
      return false;
    }

    console.log(`[CONDITION] Starting evaluation`);
    console.log(`[CONDITION] Original condition: "${condition}"`);
    console.log(`[CONDITION] Input:`, JSON.stringify(input));

    // First, replace template variables with actual values
    // IMPORTANT: Replace {{input.property}} FIRST, then {{input}}
    let sanitized = condition.trim();

    // Replace {{input.property}} with actual values FIRST
    sanitized = sanitized.replace(/\{\{input\.([\w.]+)\}\}/g, (match, path) => {
      console.log(`[CONDITION] Replacing ${match} with path: ${path}`);
      if (input && typeof input === "object" && input !== null) {
        const inputObj = input as Record<string, unknown>;
        const keys = path.split('.');
        let value: unknown = inputObj;

        for (const key of keys) {
          if (value && typeof value === "object" && value !== null && key in value) {
            value = (value as Record<string, unknown>)[key];
          } else {
            console.log(`[CONDITION] Failed to find key "${key}" in path "${path}"`);
            console.log(`[CONDITION] Current value:`, value, `(type: ${typeof value})`);
            return "undefined";
          }
        }

        console.log(`[CONDITION] Extracted value for "${path}":`, value, `(type: ${typeof value})`);

        // Return properly formatted value for JavaScript evaluation
        if (typeof value === "string") {
          return `"${value.replace(/"/g, '\\"')}"`;
        } else if (value === null) {
          return "null";
        } else if (value === undefined) {
          return "undefined";
        } else if (typeof value === "boolean") {
          return String(value);
        } else {
          return String(value);
        }
      }
      console.log(`[CONDITION] Input is not an object, returning undefined`);
      return "undefined";
    });

    // Then replace {{input}} with the full input object (only if not already replaced)
    sanitized = sanitized.replace(/\{\{input\}\}/g, () => {
      return JSON.stringify(input);
    });

    console.log(`[CONDITION] Sanitized condition: "${sanitized}"`);

    // Evaluate the condition
    const fn = new Function(`return ${sanitized};`);
    const result = fn();
    const boolResult = Boolean(result);

    console.log(`[CONDITION] Evaluation result: ${result} -> ${boolResult}`);
    return boolResult;
  } catch (error) {
    console.error("[CONDITION] Evaluation error:", error);
    console.error("[CONDITION] Condition was:", condition);
    console.error("[CONDITION] Input was:", JSON.stringify(input));
    if (error instanceof Error) {
      console.error("[CONDITION] Error message:", error.message);
      console.error("[CONDITION] Error stack:", error.stack);
    }
    return false;
  }
}
