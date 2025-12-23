import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers (inlined from _shared/cors.ts)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

// LLM Adapter (inlined from _shared/llm-adapter.ts - only Gemini part needed)
interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  stream?: boolean;
}

interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  finishReason?: string;
}

// Simplified LLM Adapter - only Gemini support (what we need)
class LLMAdapter {
  async chatGemini(
    messages: LLMMessage[],
    options: LLMOptions
  ): Promise<LLMResponse> {
    const apiKey = options.apiKey || Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('Gemini API key required. Provide apiKey in options or set GEMINI_API_KEY environment variable.');
    }

    // Map model names to actual Gemini API model identifiers
    // Use gemini-2.5-flash as default (user's preferred model)
    const modelMap: Record<string, string> = {
      'gemini-2.5-flash': 'gemini-2.5-flash', // Try exact name first
      'gemini-2.5-pro': 'gemini-2.5-pro',
      'gemini-2.5-flash-lite': 'gemini-2.5-flash-lite',
      'gemini-1.5-flash': 'gemini-1.5-flash',
      'gemini-1.5-pro': 'gemini-1.5-pro',
      'gemini-pro': 'gemini-1.5-flash', // Fallback to 1.5-flash
    };

    // Use gemini-2.5-flash as default (user's preferred model)
    const model = modelMap[options.model] || 'gemini-2.5-flash';

    const systemInstruction = messages.find(m => m.role === 'system')?.content;
    const conversationParts = messages
      .filter(m => m.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

    // Try v1beta first (supports more models), fallback to v1 if needed
    let apiVersion = 'v1beta';
    let attemptModel = model;
    
    try {
      let url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${attemptModel}:generateContent?key=${apiKey}`;
      
      let response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: conversationParts,
          systemInstruction: systemInstruction ? {
            parts: [{ text: systemInstruction }],
          } : undefined,
          generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxTokens,
          },
        }),
      });

      // If 404, try fallback models in order
      if (response.status === 404) {
        // Try gemini-2.5-flash variants first, then fallback to 1.5 models
        const fallbackModels = [
          'gemini-2.5-flash',            // Try exact 2.5 flash name
          'gemini-2.0-flash-exp',        // Try 2.5 flash variant
          'gemini-1.5-flash',            // Fallback to 1.5 flash
          'gemini-1.5-pro',              // Fallback to 1.5 pro
        ];
        
        for (const fallbackModel of fallbackModels) {
          if (attemptModel === fallbackModel) continue; // Skip if already tried
          
          console.warn(`Model ${attemptModel} not found, trying fallback: ${fallbackModel}`);
          attemptModel = fallbackModel;
          url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${fallbackModel}:generateContent?key=${apiKey}`;
          
          response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: conversationParts,
              systemInstruction: systemInstruction ? {
                parts: [{ text: systemInstruction }],
              } : undefined,
              generationConfig: {
                temperature: options.temperature ?? 0.7,
                maxOutputTokens: options.maxTokens,
              },
            }),
          });
          
          // If this model works, break out of loop
          if (response.ok) {
            console.log(`Successfully using fallback model: ${fallbackModel}`);
            break;
          }
        }
      }

      // If still 404 after fallbacks, try v1 API
      if (response.status === 404 && apiVersion === 'v1beta') {
        console.warn('v1beta API failed, trying v1 API');
        apiVersion = 'v1';
        url = `https://generativelanguage.googleapis.com/v1/models/${attemptModel}:generateContent?key=${apiKey}`;
        
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: conversationParts,
            systemInstruction: systemInstruction ? {
              parts: [{ text: systemInstruction }],
            } : undefined,
            generationConfig: {
              temperature: options.temperature ?? 0.7,
              maxOutputTokens: options.maxTokens,
            },
          }),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Gemini API error: ${response.status}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          const apiError = errorJson.error || errorJson;
          errorMessage = apiError.message || apiError.error?.message || errorMessage;
          
          // Add more context for 404 errors
          if (response.status === 404) {
            errorMessage = `Model "${attemptModel}" not found in ${apiVersion} API. ${errorMessage}. Please verify your API key has access to Gemini models and check available models.`;
          }
        } catch {
          errorMessage += ` - ${errorText}`;
        }
        
        console.error('Gemini API error response:', {
          status: response.status,
          statusText: response.statusText,
          errorText,
          model: attemptModel,
          originalModel: model,
          apiVersion,
          url,
        });
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const usageInfo = data.usageMetadata;

      // Log successful response
      if (attemptModel !== model) {
        console.log(`Successfully used fallback model: ${attemptModel} (requested: ${model})`);
      }

      return {
        content,
        usage: usageInfo ? {
          promptTokens: usageInfo.promptTokenCount || 0,
          completionTokens: usageInfo.candidatesTokenCount || 0,
          totalTokens: usageInfo.totalTokenCount || 0,
        } : undefined,
        model: data.model || attemptModel,
        finishReason: data.candidates?.[0]?.finishReason,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Gemini API request failed: ${String(error)}`);
    }
  }

  async chat(
    provider: 'openai' | 'gemini',
    messages: LLMMessage[],
    options: LLMOptions
  ): Promise<LLMResponse> {
    if (provider === 'gemini') {
      return this.chatGemini(messages, options);
    }
    throw new Error(`Unsupported provider: ${provider}`);
  }
}

// Available node types for workflow generation
const AVAILABLE_NODES = {
  triggers: ['manual_trigger', 'webhook', 'schedule', 'http_trigger'],
  ai: ['openai_gpt', 'anthropic_claude', 'google_gemini', 'text_summarizer', 'sentiment_analyzer'],
  logic: ['if_else', 'switch', 'loop', 'wait', 'error_handler', 'filter'],
  data: ['javascript', 'json_parser', 'csv_processor', 'text_formatter', 'merge_data', 'http_request', 'set_variable', 'google_sheets'],
  output: ['http_post', 'email_resend', 'slack_message', 'slack_webhook', 'discord_webhook', 'database_write', 'log_output'],
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Length': '0',
      }
    });
  }

  try {
    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Accept both 'prompt' and 'description' for compatibility
    const prompt = requestBody.prompt || requestBody.description;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'description is required and must be a non-empty string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get auth token from request (optional for now, but recommended)
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    let user = null;
    
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '').replace('bearer ', '');
        const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser(token);
        if (!authError && authUser) {
          user = authUser;
        }
      } catch (authErr) {
        console.warn('Auth verification failed:', authErr);
        // Continue without auth for now
      }
    }

    // Build comprehensive system prompt with all available node types and descriptions
    const nodeDescriptions = `
TRIGGERS:
- manual_trigger: Start workflow manually (no config needed)
- webhook: Trigger via HTTP webhook (config: method: POST/GET/PUT)
- schedule: Run on a schedule (config: cron expression like "0 9 * * *")
- http_trigger: Trigger by polling an API (config: url, method, headers, interval)

AI PROCESSING:
- openai_gpt: Process with OpenAI GPT models (config: apiKey, model: gpt-4o/gpt-4o-mini/gpt-4-turbo, prompt, temperature, memory)
- anthropic_claude: Process with Claude models (config: apiKey, model: claude-3-5-sonnet/claude-3-opus/claude-3-haiku, prompt, temperature, memory)
- google_gemini: Process with Google Gemini models (config: apiKey, model: gemini-2.5-flash/gemini-2.5-pro, prompt, temperature, memory)
- text_summarizer: Summarize text using AI (config: apiKey, maxLength, style: concise/bullets/detailed, memory)
- sentiment_analyzer: Analyze text sentiment (config: apiKey, memory)
- memory: Store/retrieve conversation memory (config: operation: store/retrieve/clear/search, memoryType: short/long/both, ttl, maxMessages)
- llm_chain: Chain multiple prompts (config: steps as JSON array)

LOGIC & CONTROL:
- if_else: Conditional branching (config: condition expression like "{{input.value}} > 10")
- switch: Multiple case branching (config: expression, cases as JSON array)
- loop: Iterate over items (config: array expression, maxIterations)
- wait: Pause execution (config: duration in milliseconds)
- error_handler: Handle errors gracefully (config: retries, retryDelay, fallbackValue)
- filter: Filter array items (config: array expression, condition)

DATA TRANSFORM:
- javascript: Run custom JavaScript code (config: code)
- json_parser: Parse/transform JSON using JSONPath (config: expression like "$.data.items[*]")
- csv_processor: Process CSV data (config: delimiter, hasHeader)
- text_formatter: Format text with templates (config: template like "Hello {{name}}!")
- merge_data: Combine multiple inputs (config: mode: merge/concat)
- http_request: Make HTTP API call (config: url, method: GET/POST/PUT/PATCH/DELETE, headers, body, timeout)
- set_variable: Store value in variable (config: name, value)
- google_sheets: Read/write Google Sheets (config: operation: read/write/append/update, spreadsheetId, sheetName, range, outputFormat)
- database_read: Read from database (config: table, columns, filters, limit, orderBy, ascending)

OUTPUT ACTIONS:
- http_post: Send HTTP POST request (config: url, headers, bodyTemplate)
- email_resend: Send email via Resend (config: to, from, subject, body, replyTo)
- slack_message: Send Slack notification (config: webhookUrl, channel, username, iconEmoji, message, blocks)
- slack_webhook: Simple Slack webhook (config: webhookUrl, text)
- discord_webhook: Send Discord message (config: webhookUrl, content, username, avatarUrl)
- database_write: Write to database (config: table, operation: insert/update/upsert/delete, data, matchColumn)
- log_output: Log data for debugging (config: message, level: info/warn/error/debug)
`;

    // Build system prompt for workflow generation
    const systemPrompt = `You are an expert workflow automation assistant. Your task is to analyze a user's workflow description and generate a structured workflow with nodes and edges using ONLY the available node types listed below.

${nodeDescriptions}

You must respond with a valid JSON object in this exact format:
{
  "name": "Workflow name based on description",
  "nodes": [
    {
      "id": "unique_node_id",
      "type": "node_type_from_available_list",
      "position": {"x": number, "y": number},
      "config": { /* node-specific configuration */ }
    }
  ],
  "edges": [
    {
      "id": "unique_edge_id",
      "source": "source_node_id",
      "target": "target_node_id"
    }
  ]
}

CRITICAL RULES:
1. Always start with a trigger node (manual_trigger, webhook, schedule, or http_trigger)
2. Connect nodes in a logical flow from trigger to output - each node should connect to the next
3. Position nodes with x spacing of 300px and y spacing of 150px (start at x:250, y:100)
4. Use ONLY the node types listed above - do not invent new node types
5. Include ALL necessary configuration for each node:
   - For AI nodes: include prompt, model, temperature (0.7 default), memory (10 default)
   - For HTTP nodes: include url, method, headers if needed
   - For webhook: include method (POST default)
   - For schedule: include cron expression
   - For email: include to, from, subject, body
   - For database: include table name and operation
6. Keep workflows simple and focused - don't overcomplicate
7. If description mentions AI/LLM/GPT/Claude/Gemini, use appropriate AI node (openai_gpt, anthropic_claude, or google_gemini)
8. Always end with an output action (http_post, email_resend, slack_message, discord_webhook, database_write, or log_output) if the workflow should produce results
9. Use proper node IDs: format like "trigger_1", "ai_1", "output_1" etc.
10. Ensure all edges connect valid node IDs

Generate a workflow based on this description. Return ONLY valid JSON, no markdown or explanations:`;

    // Use Google Gemini (free version) to generate workflow
    const llmAdapter = new LLMAdapter();
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      console.error('GEMINI_API_KEY not found in environment variables');
      return new Response(
        JSON.stringify({ 
          error: 'GEMINI_API_KEY is not configured. Please set it in Supabase project settings under Edge Functions secrets.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const provider = 'gemini';
    // Use gemini-2.5-flash as default (user's preferred model)
    // Maps to gemini-2.0-flash-exp in the API
    const model = 'gemini-2.5-flash';

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ];

    console.log('Calling Gemini API with model:', model);
    let response;
    try {
      response = await llmAdapter.chat('gemini', messages, {
        model,
        temperature: 0.7,
        apiKey,
      });
      console.log('Gemini API response received, content length:', response.content?.length || 0);
    } catch (llmError) {
      console.error('Gemini API call failed:', llmError);
      const llmErrorMessage = llmError instanceof Error ? llmError.message : String(llmError);
      throw new Error(`Failed to generate workflow with AI: ${llmErrorMessage}`);
    }

    // Parse AI response
    let workflowData;
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonText = response.content.trim();
      if (jsonText.includes('```json')) {
        jsonText = jsonText.split('```json')[1].split('```')[0].trim();
      } else if (jsonText.includes('```')) {
        jsonText = jsonText.split('```')[1].split('```')[0].trim();
      }
      
      workflowData = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', response.content);
      // Fallback: create a simple workflow
      workflowData = {
        name: `Workflow: ${prompt.substring(0, 50)}`,
        nodes: [
          {
            id: 'trigger_1',
            type: 'manual_trigger',
            position: { x: 250, y: 100 },
            config: {},
          },
          {
            id: 'output_1',
            type: 'log_output',
            position: { x: 550, y: 100 },
            config: { message: 'Workflow executed' },
          },
        ],
        edges: [
          {
            id: 'edge_1',
            source: 'trigger_1',
            target: 'output_1',
          },
        ],
      };
    }

    // Validate and clean workflow data
    if (!workflowData.nodes || !Array.isArray(workflowData.nodes)) {
      throw new Error('Invalid workflow structure: nodes array is required');
    }

    if (!workflowData.edges || !Array.isArray(workflowData.edges)) {
      workflowData.edges = [];
    }

    // Ensure all node IDs are unique and valid
    const nodeIds = new Set<string>();
    workflowData.nodes = workflowData.nodes.map((node: any, index: number) => {
      const nodeId = node.id || `node_${index}_${Date.now()}`;
      if (nodeIds.has(nodeId)) {
        return { ...node, id: `${nodeId}_${index}` };
      }
      nodeIds.add(nodeId);
      return {
        ...node,
        id: nodeId,
        position: node.position || { x: 250 + (index % 3) * 300, y: 100 + Math.floor(index / 3) * 150 },
      };
    });

    // Validate edges reference existing nodes
    const validNodeIds = new Set(workflowData.nodes.map((n: any) => n.id));
    workflowData.edges = workflowData.edges.filter((edge: any) => 
      validNodeIds.has(edge.source) && validNodeIds.has(edge.target)
    );

    // Ensure at least one trigger node exists
    const hasTrigger = workflowData.nodes.some((node: any) => 
      AVAILABLE_NODES.triggers.includes(node.type)
    );

    if (!hasTrigger) {
      // Add a manual trigger at the beginning
      workflowData.nodes.unshift({
        id: 'trigger_manual',
        type: 'manual_trigger',
        position: { x: 250, y: 100 },
        config: {},
      });

      // Connect trigger to first non-trigger node
      const firstNonTrigger = workflowData.nodes.find((n: any) => 
        !AVAILABLE_NODES.triggers.includes(n.type) && n.id !== 'trigger_manual'
      );
      if (firstNonTrigger) {
        workflowData.edges.unshift({
          id: 'edge_trigger',
          source: 'trigger_manual',
          target: firstNonTrigger.id,
        });
      }
    }

    return new Response(
      JSON.stringify(workflowData),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error generating workflow:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Log full error details for debugging
    console.error('Full error details:', {
      message: errorMessage,
      stack: errorStack,
      error: error,
    });
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: Deno.env.get('ENVIRONMENT') === 'development' ? errorStack : undefined
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

