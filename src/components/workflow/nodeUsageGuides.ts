import { NodeUsageGuide } from './nodeTypes';

export const NODE_USAGE_GUIDES: Record<string, NodeUsageGuide> = {
  // Triggers
  manual_trigger: {
    overview: 'Starts your workflow when you click the "Run" button. Perfect for testing or on-demand tasks.',
    inputs: ['None - This is a start node'],
    outputs: ['trigger_data', 'timestamp'],
    example: `Connect → OpenAI GPT → Slack Message

When you click Run, the workflow executes.
Output: { triggered_at: "2024-01-15T10:30:00Z" }`,
    tips: ['Use for testing before adding automated triggers', 'Can pass custom input data when running'],
  },

  webhook: {
    overview: 'Receives HTTP requests from external services. Use this to trigger workflows from other apps, APIs, or services.',
    inputs: ['HTTP request body', 'Headers', 'Query params'],
    outputs: ['body', 'headers', 'method', 'query'],
    example: `Webhook URL: https://your-app.com/api/webhook/abc123

External Service sends POST:
{
  "event": "order_created",
  "data": { "id": 123, "total": 99.99 }
}

Output: { body: {...}, method: "POST" }`,
    tips: ['Copy the webhook URL after saving', 'Supports GET, POST, PUT methods', 'Headers are available in output'],
  },

  schedule: {
    overview: 'Runs your workflow automatically on a schedule using cron expressions. Great for daily reports, periodic checks, or recurring tasks.',
    inputs: ['None - Triggered by schedule'],
    outputs: ['scheduled_time', 'execution_id'],
    example: `Cron: "0 9 * * 1-5"
Meaning: Every weekday at 9:00 AM

Common patterns:
• "0 * * * *" - Every hour
• "0 9 * * *" - Daily at 9 AM
• "0 0 * * 0" - Every Sunday midnight
• "*/15 * * * *" - Every 15 minutes`,
    tips: ['Use crontab.guru to build expressions', 'Times are in UTC', 'Test with manual trigger first'],
  },

  http_trigger: {
    overview: 'Polls an external API at regular intervals and triggers when new data is detected. Use for APIs without webhooks.',
    inputs: ['None - Polls automatically'],
    outputs: ['response_data', 'status_code', 'headers'],
    example: `URL: https://api.github.com/repos/user/repo/issues
Interval: 60000 (1 minute)

Every minute, checks for new issues.
When found, triggers with issue data.`,
    tips: ['Set appropriate poll intervals to avoid rate limits', 'Use headers for API authentication'],
  },

  // AI Processing
  openai_gpt: {
    overview: 'Processes text using OpenAI GPT models. Provide a system prompt and the input will be sent as the user message.',
    inputs: ['text', 'any JSON data'],
    outputs: ['response', 'usage', 'model'],
    example: `System Prompt: "You are a helpful assistant that summarizes emails."

Input: { text: "Meeting tomorrow at 3pm..." }
Output: { response: "Summary: Meeting scheduled for tomorrow afternoon", usage: { tokens: 45 } }

Connect: Webhook → OpenAI GPT → Slack`,
    tips: ['Leave API Key empty to use Lovable AI (free)', 'Lower temperature = more focused responses', 'Use {{input.text}} in prompts for dynamic content'],
  },

  anthropic_claude: {
    overview: 'Processes text using Anthropic Claude models. Known for nuanced understanding and detailed responses.',
    inputs: ['text', 'any JSON data'],
    outputs: ['response', 'usage', 'model'],
    example: `System Prompt: "Analyze customer feedback and categorize sentiment."

Input: { text: "Great product but shipping was slow" }
Output: { 
  response: "Mixed sentiment. Positive: product quality. Negative: shipping speed.",
  sentiment: "mixed"
}`,
    tips: ['Claude excels at analysis and nuanced tasks', 'Great for longer documents', 'Sonnet offers best balance of speed/quality'],
  },

  google_gemini: {
    overview: 'Processes text using Google Gemini models. Fast and efficient with strong reasoning capabilities.',
    inputs: ['text', 'any JSON data'],
    outputs: ['response', 'usage', 'model'],
    example: `System Prompt: "Extract key dates and action items from text."

Input: { text: "Call John on Friday about Q2 review" }
Output: { 
  response: "Date: Friday\nAction: Call John\nTopic: Q2 review"
}`,
    tips: ['Gemini Flash is fastest for simple tasks', 'Flash Lite for high volume, low cost', 'Pro for complex reasoning'],
  },

  text_summarizer: {
    overview: 'Automatically summarizes long text content. Choose between concise summaries, detailed overviews, or bullet points.',
    inputs: ['text', 'content'],
    outputs: ['summary', 'word_count'],
    example: `Input: { text: "Long article about AI trends..." }
Style: "bullets"
Max Length: 100

Output: {
  summary: "• AI adoption growing 40% YoY\n• Focus on automation\n• Privacy concerns rising",
  word_count: 15
}`,
    tips: ['Use bullets for quick scanning', 'Detailed for comprehensive summaries', 'Adjust max length for your needs'],
  },

  sentiment_analyzer: {
    overview: 'Analyzes the emotional tone of text. Returns sentiment score and classification (positive, negative, neutral).',
    inputs: ['text'],
    outputs: ['sentiment', 'score', 'confidence'],
    example: `Input: { text: "I love this product!" }
Output: {
  sentiment: "positive",
  score: 0.95,
  confidence: 0.92
}

Connect: Webhook → Sentiment → If/Else (route by sentiment)`,
    tips: ['Score ranges from -1 (negative) to 1 (positive)', 'Use with If/Else to route messages', 'Great for customer feedback analysis'],
  },

  // Logic & Control
  if_else: {
    overview: 'Routes workflow based on conditions. Creates two branches: one for when condition is true, another for false.',
    inputs: ['any data to evaluate'],
    outputs: ['true_branch', 'false_branch'],
    example: `Condition: {{input.score}} > 0.5

If score is 0.8 → Takes TRUE branch
If score is 0.3 → Takes FALSE branch

Connect TRUE → Send Happy Email
Connect FALSE → Send Followup Email`,
    tips: ['Use {{input.field}} to reference data', 'Supports ==, !=, >, <, >=, <=', 'Combine conditions with && or ||'],
  },

  switch: {
    overview: 'Routes to different branches based on matching values. Like multiple if/else statements combined.',
    inputs: ['value to match'],
    outputs: ['matched_case', 'default'],
    example: `Expression: {{input.status}}
Cases: [
  {"value": "pending", "label": "Pending"},
  {"value": "approved", "label": "Approved"},
  {"value": "rejected", "label": "Rejected"}
]

Connects to different nodes based on status value.`,
    tips: ['Add a default case for unmatched values', 'Great for status-based routing', 'Each case can connect to different nodes'],
  },

  loop: {
    overview: 'Iterates over an array of items, executing connected nodes for each item. Useful for batch processing.',
    inputs: ['array of items'],
    outputs: ['current_item', 'index', 'results'],
    example: `Input: { items: ["email1", "email2", "email3"] }
Array Expression: {{input.items}}

Loop executes 3 times:
• Iteration 1: current_item = "email1"
• Iteration 2: current_item = "email2"
• Iteration 3: current_item = "email3"`,
    tips: ['Set max iterations to prevent infinite loops', 'Access current item with {{loop.item}}', 'Results collected after all iterations'],
  },

  wait: {
    overview: 'Pauses workflow execution for a specified duration. Use for rate limiting or delays between actions.',
    inputs: ['any (passes through)'],
    outputs: ['input (unchanged)'],
    example: `Duration: 5000 (5 seconds)

API Call → Wait (5s) → API Call
Prevents hitting rate limits.

Common durations:
• 1000ms = 1 second
• 60000ms = 1 minute`,
    tips: ['Use between API calls to avoid rate limits', 'Data passes through unchanged', 'Duration is in milliseconds'],
  },

  error_handler: {
    overview: 'Catches errors from connected nodes and provides retry logic or fallback values. Prevents workflow failures.',
    inputs: ['any (wraps connected node)'],
    outputs: ['result', 'error', 'attempts'],
    example: `Max Retries: 3
Retry Delay: 2000 (2 seconds)
Fallback: {"status": "failed"}

If connected node fails:
1. Retry up to 3 times
2. Wait 2s between retries
3. If still failing, return fallback`,
    tips: ['Wrap unreliable API calls', 'Set appropriate retry delays', 'Log errors for debugging'],
  },

  filter: {
    overview: 'Filters an array to keep only items matching a condition. Removes items that do not meet criteria.',
    inputs: ['array of items'],
    outputs: ['filtered_array', 'removed_count'],
    example: `Array: {{input.users}}
Condition: item.age >= 18

Input: [
  {name: "John", age: 25},
  {name: "Jane", age: 16},
  {name: "Bob", age: 30}
]
Output: [John, Bob] (filtered out Jane)`,
    tips: ['Use "item" to reference current element', 'Returns new array, original unchanged', 'Chain multiple filters for complex logic'],
  },

  // Data Transformation
  javascript: {
    overview: 'Execute custom JavaScript code. Full access to input data with ability to transform, calculate, or process as needed.',
    inputs: ['any data as "input"'],
    outputs: ['return value'],
    example: `Code:
const total = input.items.reduce(
  (sum, item) => sum + item.price, 0
);
return {
  total,
  count: input.items.length,
  average: total / input.items.length
};

Input: {items: [{price: 10}, {price: 20}]}
Output: {total: 30, count: 2, average: 15}`,
    tips: ['Always return a value', 'Input available as "input" variable', 'Use for complex transformations'],
  },

  json_parser: {
    overview: 'Extract specific values from JSON using JSONPath expressions. Navigate nested data structures easily.',
    inputs: ['JSON data'],
    outputs: ['extracted_value'],
    example: `Input: {
  "data": {
    "users": [
      {"name": "John", "email": "john@test.com"},
      {"name": "Jane", "email": "jane@test.com"}
    ]
  }
}

Expression: $.data.users[*].email
Output: ["john@test.com", "jane@test.com"]`,
    tips: ['$ represents root', '[*] selects all items', 'Use .field for nested access'],
  },

  text_formatter: {
    overview: 'Format text using templates with variable substitution. Create dynamic messages, emails, or any text content.',
    inputs: ['data for template variables'],
    outputs: ['formatted_text'],
    example: `Template: "Hello {{name}}! Your order #{{orderId}} ships on {{shipDate}}."

Input: {name: "John", orderId: 123, shipDate: "Jan 20"}
Output: "Hello John! Your order #123 ships on Jan 20."`,
    tips: ['Use {{variable}} for substitution', 'Supports nested: {{user.name}}', 'Great for email/message templates'],
  },

  http_request: {
    overview: 'Make HTTP requests to external APIs. Fetch data, call webhooks, or interact with any REST API.',
    inputs: ['URL params', 'body data'],
    outputs: ['response', 'status', 'headers'],
    example: `URL: https://api.example.com/users/{{input.userId}}
Method: GET
Headers: {"Authorization": "Bearer {{input.token}}"}

Output: {
  response: {id: 1, name: "John"},
  status: 200
}`,
    tips: ['Use {{input.x}} in URL for dynamic values', 'Add auth headers for protected APIs', 'Set timeout for slow APIs'],
  },

  set_variable: {
    overview: 'Store a value for use later in the workflow. Variables persist throughout the workflow execution.',
    inputs: ['any value'],
    outputs: ['variable_name', 'value'],
    example: `Variable Name: totalCount
Value: {{input.items.length}}

Later nodes can access: {{variables.totalCount}}

Useful for storing computed values to use in multiple places.`,
    tips: ['Access with {{variables.name}}', 'Great for values used multiple times', 'Persists through entire workflow'],
  },

  merge_data: {
    overview: 'Combine data from multiple sources. Merge objects together or concatenate arrays.',
    inputs: ['multiple data inputs'],
    outputs: ['merged_data'],
    example: `Mode: "merge"
Inputs from two nodes:
  1: {name: "John", age: 30}
  2: {email: "john@test.com"}

Output: {name: "John", age: 30, email: "john@test.com"}

Mode: "concat" for arrays:
  [1,2] + [3,4] = [1,2,3,4]`,
    tips: ['Merge combines object properties', 'Concat joins arrays', 'Connect multiple nodes as inputs'],
  },

  database_read: {
    overview: 'Read data from your database tables. Query with filters, ordering, and limits.',
    inputs: ['filter criteria'],
    outputs: ['rows', 'count'],
    example: `Table: orders
Columns: id, customer_name, total
Filters: {"status": "pending"}
Limit: 10
Order By: created_at

Output: [
  {id: 1, customer_name: "John", total: 99},
  {id: 2, customer_name: "Jane", total: 150}
]`,
    tips: ['Use * for all columns', 'Filters use exact match', 'Combine with Loop for batch processing'],
  },

  // Output Actions
  http_post: {
    overview: 'Send data to external APIs via HTTP POST. Perfect for webhooks, API integrations, and data sync.',
    inputs: ['data to send'],
    outputs: ['response', 'status'],
    example: `URL: https://api.example.com/webhook
Headers: {"Content-Type": "application/json"}
Body: {"event": "workflow_complete", "data": "{{input}}"}

Sends POST request with workflow data.`,
    tips: ['Use body template for dynamic content', 'Add auth headers if needed', 'Check response for errors'],
  },

  email_resend: {
    overview: 'Send emails using Resend. Supports HTML content, templates, and dynamic content from workflow data.',
    inputs: ['email content', 'recipient data'],
    outputs: ['message_id', 'status'],
    example: `To: {{input.customer.email}}
From: notifications@yourapp.com
Subject: Order Confirmed #{{input.orderId}}
Body: "<h1>Thank you!</h1><p>Order {{input.orderId}} confirmed.</p>"

Sends personalized order confirmation.`,
    tips: ['Requires RESEND_API_KEY secret', 'Use HTML for rich emails', 'Use {{input.x}} for personalization'],
  },

  slack_message: {
    overview: 'Send messages to Slack channels. Supports rich formatting, blocks, and custom bot appearance.',
    inputs: ['message content'],
    outputs: ['message_id', 'channel'],
    example: `Webhook URL: https://hooks.slack.com/services/...
Channel: #alerts
Message: "New order: {{input.orderId}} - Total: {{input.total}}"
Icon: :robot_face:

Sends formatted alert to Slack channel.`,
    tips: ['Create webhook at api.slack.com', 'Use emoji for visual appeal', 'Blocks for rich formatting'],
  },

  discord_webhook: {
    overview: 'Send messages to Discord channels via webhook. Great for notifications and alerts.',
    inputs: ['message content'],
    outputs: ['message_id'],
    example: `Webhook URL: https://discord.com/api/webhooks/...
Message: "✅ Workflow completed successfully!"
Username: "Alert Bot"

Sends message to Discord channel.`,
    tips: ['Create webhook in Discord channel settings', 'Customize username and avatar', 'Supports markdown formatting'],
  },

  database_write: {
    overview: 'Write data to your database tables. Supports insert, update, upsert, and delete operations.',
    inputs: ['data to write'],
    outputs: ['affected_rows', 'inserted_id'],
    example: `Table: orders
Operation: insert
Data: {
  "customer_id": "{{input.userId}}",
  "total": "{{input.cart.total}}",
  "status": "pending"
}

Creates new order record from workflow data.`,
    tips: ['Use upsert to update or insert', 'Match column required for updates', 'Data uses {{input.x}} for dynamic values'],
  },

  log_output: {
    overview: 'Log data for debugging and monitoring. View logs in the execution history.',
    inputs: ['any data'],
    outputs: ['logged (passes input through)'],
    example: `Message: "Processing order: {{input.orderId}}"
Level: info

Appears in execution logs:
[INFO] Processing order: 12345

Useful for debugging workflow flow.`,
    tips: ['Use different levels for filtering', 'Data passes through to next node', 'Check execution history for logs'],
  },

  llm_chain: {
    overview: 'Chain multiple AI prompts together where each step builds on the previous. Great for complex reasoning tasks.',
    inputs: ['initial text/data'],
    outputs: ['final_response', 'step_outputs'],
    example: `Steps: [
  {"prompt": "Summarize: {{input}}"},
  {"prompt": "Extract key points from: {{previous}}"},
  {"prompt": "Format as bullet list: {{previous}}"}
]

Each step uses output from previous step.`,
    tips: ['Use {{previous}} to reference last output', 'Build complex reasoning chains', 'Each step can use different prompts'],
  },

  csv_processor: {
    overview: 'Parse and process CSV data. Converts CSV text to JSON array for further processing.',
    inputs: ['CSV text'],
    outputs: ['rows', 'headers', 'count'],
    example: `Input CSV:
"name,email,age
John,john@test.com,30
Jane,jane@test.com,25"

Output: [
  {name: "John", email: "john@test.com", age: "30"},
  {name: "Jane", email: "jane@test.com", age: "25"}
]`,
    tips: ['Set correct delimiter (comma, tab, etc)', 'Enable "has header" for column names', 'Output is JSON array'],
  },

  slack_webhook: {
    overview: 'Simple Slack webhook for quick messages. Less features than Slack Message but easier to set up.',
    inputs: ['message text'],
    outputs: ['status'],
    example: `Webhook URL: https://hooks.slack.com/services/...
Text: "Workflow completed at {{input.timestamp}}"

Sends simple text message to Slack.`,
    tips: ['Simplest Slack integration', 'No blocks or rich formatting', 'Good for basic alerts'],
  },
};
