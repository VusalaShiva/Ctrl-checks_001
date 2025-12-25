import { NodeCategory } from '@/stores/workflowStore';

export interface NodeUsageGuide {
  overview: string;
  inputs: string[];
  outputs: string[];
  example: string;
  tips?: string[];
}

export interface NodeTypeDefinition {
  type: string;
  label: string;
  category: NodeCategory;
  icon: string;
  description: string;
  defaultConfig: Record<string, unknown>;
  configFields: ConfigField[];
  usageGuide?: NodeUsageGuide;
}

export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'boolean' | 'json' | 'cron';
  placeholder?: string;
  options?: { label: string; value: string }[];
  required?: boolean;
  defaultValue?: unknown;
  helpText?: string;
}

export const NODE_CATEGORIES: { id: NodeCategory; label: string; color: string }[] = [
  { id: 'triggers', label: 'Triggers', color: 'hsl(var(--primary))' },
  { id: 'ai', label: 'AI Processing', color: 'hsl(var(--accent))' },
  { id: 'logic', label: 'Logic & Control', color: 'hsl(var(--secondary))' },
  { id: 'data', label: 'Data Transform', color: 'hsl(142 71% 45%)' },
  { id: 'http_api', label: 'HTTP & API Nodes', color: 'hsl(221 83% 53%)' },
  { id: 'output', label: 'Output Actions', color: 'hsl(25 95% 53%)' },
];

export const NODE_TYPES: NodeTypeDefinition[] = [
  // Triggers
  {
    type: 'manual_trigger',
    label: 'Manual Trigger',
    category: 'triggers',
    icon: 'Play',
    description: 'Start workflow manually',
    defaultConfig: {},
    configFields: [],
  },
  {
    type: 'schedule',
    label: 'Schedule',
    category: 'triggers',
    icon: 'Clock',
    description: 'Run on a schedule',
    defaultConfig: { cron: '0 9 * * *' },
    configFields: [
      { key: 'cron', label: 'Cron Expression', type: 'cron', placeholder: '0 9 * * *', required: true },
    ],
  },
  {
    type: 'http_trigger',
    label: 'HTTP Request Trigger',
    category: 'triggers',
    icon: 'Globe',
    description: 'Trigger by polling an API',
    defaultConfig: { method: 'GET', url: '', interval: 60000 },
    configFields: [
      { key: 'url', label: 'URL', type: 'text', placeholder: 'https://api.example.com', required: true },
      { key: 'method', label: 'Method', type: 'select', options: [
        { label: 'GET', value: 'GET' },
        { label: 'POST', value: 'POST' },
      ]},
      { key: 'headers', label: 'Headers (JSON)', type: 'json', placeholder: '{}' },
      { key: 'interval', label: 'Poll Interval (ms)', type: 'number', defaultValue: 60000 },
    ],
  },

  // AI Processing
  {
    type: 'openai_gpt',
    label: 'OpenAI GPT',
    category: 'ai',
    icon: 'Brain',
    description: 'Process with GPT models',
    defaultConfig: { model: 'gpt-4o', temperature: 0.7, memory: 10 },
    configFields: [
      { key: 'apiKey', label: 'API Key', type: 'text', placeholder: 'sk-... (required)', required: true },
      { key: 'model', label: 'Model', type: 'select', options: [
        { label: 'GPT-4o', value: 'gpt-4o' },
        { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
        { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
      ]},
      { key: 'prompt', label: 'System Prompt', type: 'textarea', placeholder: 'You are a helpful assistant...', required: true },
      { key: 'temperature', label: 'Temperature', type: 'number', defaultValue: 0.7 },
      { key: 'memory', label: 'Memory', type: 'number', defaultValue: 10, placeholder: '10', helpText: 'Number of conversation turns to remember (each turn = 1 user + 1 AI message)' },
    ],
  },
  {
    type: 'anthropic_claude',
    label: 'Anthropic Claude',
    category: 'ai',
    icon: 'Sparkles',
    description: 'Process with Claude models',
    defaultConfig: { model: 'claude-3-sonnet', temperature: 0.7, memory: 10 },
    configFields: [
      { key: 'apiKey', label: 'API Key', type: 'text', placeholder: 'sk-ant-... (required)', required: true },
      { key: 'model', label: 'Model', type: 'select', options: [
        { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet' },
        { label: 'Claude 3 Opus', value: 'claude-3-opus' },
        { label: 'Claude 3 Haiku', value: 'claude-3-haiku' },
      ]},
      { key: 'prompt', label: 'System Prompt', type: 'textarea', placeholder: 'You are a helpful assistant...', required: true },
      { key: 'temperature', label: 'Temperature', type: 'number', defaultValue: 0.7 },
      { key: 'memory', label: 'Memory', type: 'number', defaultValue: 10, placeholder: '10', helpText: 'Number of conversation turns to remember (each turn = 1 user + 1 AI message)' },
    ],
  },
  {
    type: 'memory',
    label: 'Memory',
    category: 'ai',
    icon: 'Database',
    description: 'Store and retrieve conversation memory (Redis + Vector)',
    defaultConfig: {
      operation: 'store',
      memoryType: 'both',
      ttl: 3600,
      maxMessages: 100,
    },
    configFields: [
      {
        key: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { label: 'Store', value: 'store' },
          { label: 'Retrieve', value: 'retrieve' },
          { label: 'Clear', value: 'clear' },
          { label: 'Search', value: 'search' },
        ],
        required: true,
        helpText: 'What operation to perform on memory',
      },
      {
        key: 'memoryType',
        label: 'Memory Type',
        type: 'select',
        options: [
          { label: 'Short-term (Redis)', value: 'short' },
          { label: 'Long-term (Vector)', value: 'long' },
          { label: 'Both (Hybrid)', value: 'both' },
        ],
        defaultValue: 'both',
        helpText: 'Where to store/retrieve memory',
      },
      {
        key: 'ttl',
        label: 'TTL (seconds)',
        type: 'number',
        defaultValue: 3600,
        helpText: 'Time to live for short-term memory (Redis)',
      },
      {
        key: 'maxMessages',
        label: 'Max Messages',
        type: 'number',
        defaultValue: 100,
        helpText: 'Maximum messages to retrieve',
      },
    ],
  },
  {
    type: 'google_gemini',
    label: 'Google Gemini',
    category: 'ai',
    icon: 'Gem',
    description: 'Process with Gemini models',
    defaultConfig: { model: 'gemini-2.5-flash', temperature: 0.7, memory: 10 },
    configFields: [
      { key: 'apiKey', label: 'API Key', type: 'text', placeholder: 'AIza... (required)', required: true },
      { key: 'model', label: 'Model', type: 'select', options: [
        { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
        { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
        { label: 'Gemini 2.5 Flash Lite', value: 'gemini-2.5-flash-lite' },
      ]},
      { key: 'prompt', label: 'System Prompt', type: 'textarea', placeholder: 'You are a helpful assistant...', required: true },
      { key: 'temperature', label: 'Temperature', type: 'number', defaultValue: 0.7 },
      { key: 'memory', label: 'Memory', type: 'number', defaultValue: 10, placeholder: '10', helpText: 'Number of conversation turns to remember (each turn = 1 user + 1 AI message)' },
    ],
  },
  {
    type: 'llm_chain',
    label: 'LLM Chain',
    category: 'ai',
    icon: 'Link',
    description: 'Chain multiple prompts',
    defaultConfig: { steps: [] },
    configFields: [
      { key: 'steps', label: 'Chain Steps (JSON)', type: 'json', placeholder: '[]' },
    ],
  },
  {
    type: 'sentiment_analyzer',
    label: 'Sentiment Analysis',
    category: 'ai',
    icon: 'Heart',
    description: 'Analyze text sentiment',
    defaultConfig: { apiKey: '', memory: 10 },
    configFields: [
      { key: 'apiKey', label: 'API Key', type: 'text', placeholder: 'sk-... (required)', required: true },
      { key: 'memory', label: 'Memory', type: 'number', defaultValue: 10, placeholder: '10', helpText: 'Number of conversation turns to remember (each turn = 1 user + 1 AI message)' },
    ],
  },

  // Logic & Control
  {
    type: 'if_else',
    label: 'If/Else',
    category: 'logic',
    icon: 'GitBranch',
    description: 'Conditional branching',
    defaultConfig: { condition: '' },
    configFields: [
      { key: 'condition', label: 'Condition', type: 'text', placeholder: '{{input.value}} > 10', required: true },
    ],
  },
  {
    type: 'switch',
    label: 'Switch',
    category: 'logic',
    icon: 'GitMerge',
    description: 'Multiple case branching',
    defaultConfig: { cases: [] },
    configFields: [
      { key: 'expression', label: 'Expression', type: 'text', placeholder: '{{input.status}}', required: true },
      { key: 'cases', label: 'Cases (JSON)', type: 'json', placeholder: '[{"value": "active", "label": "Active"}]' },
    ],
  },
  {
    type: 'loop',
    label: 'Loop',
    category: 'logic',
    icon: 'Repeat',
    description: 'Iterate over items',
    defaultConfig: { maxIterations: 100 },
    configFields: [
      { key: 'array', label: 'Array Expression', type: 'text', placeholder: '{{input.items}}', required: true },
      { key: 'maxIterations', label: 'Max Iterations', type: 'number', defaultValue: 100 },
    ],
  },
  {
    type: 'wait',
    label: 'Wait/Delay',
    category: 'logic',
    icon: 'Timer',
    description: 'Pause execution',
    defaultConfig: { duration: 1000 },
    configFields: [
      { key: 'duration', label: 'Duration (ms)', type: 'number', defaultValue: 1000, required: true },
    ],
  },
  {
    type: 'error_handler',
    label: 'Error Handler',
    category: 'logic',
    icon: 'ShieldAlert',
    description: 'Handle errors gracefully',
    defaultConfig: { retries: 3, retryDelay: 1000 },
    configFields: [
      { key: 'retries', label: 'Max Retries', type: 'number', defaultValue: 3 },
      { key: 'retryDelay', label: 'Retry Delay (ms)', type: 'number', defaultValue: 1000 },
      { key: 'fallbackValue', label: 'Fallback Value', type: 'json', placeholder: 'null' },
    ],
  },
  {
    type: 'filter',
    label: 'Filter',
    category: 'logic',
    icon: 'Filter',
    description: 'Filter array items',
    defaultConfig: { condition: '' },
    configFields: [
      { key: 'array', label: 'Array Expression', type: 'text', placeholder: '{{input.items}}', required: true },
      { key: 'condition', label: 'Filter Condition', type: 'text', placeholder: 'item.active === true', required: true },
    ],
  },

  // Data Transformation
  {
    type: 'javascript',
    label: 'JavaScript',
    category: 'data',
    icon: 'Code',
    description: 'Run custom code',
    defaultConfig: { code: 'return input;' },
    configFields: [
      { key: 'code', label: 'JavaScript Code', type: 'textarea', placeholder: 'return input;', required: true },
    ],
  },
  {
    type: 'json_parser',
    label: 'JSON Parser',
    category: 'data',
    icon: 'Braces',
    description: 'Parse/transform JSON',
    defaultConfig: { expression: '' },
    configFields: [
      { key: 'expression', label: 'JSONPath Expression', type: 'text', placeholder: '$.data.items[*]' },
    ],
  },
  {
    type: 'csv_processor',
    label: 'CSV Processor',
    category: 'data',
    icon: 'Table',
    description: 'Process CSV data',
    defaultConfig: { delimiter: ',' },
    configFields: [
      { key: 'delimiter', label: 'Delimiter', type: 'text', defaultValue: ',' },
      { key: 'hasHeader', label: 'Has Header Row', type: 'boolean', defaultValue: true },
    ],
  },
  {
    type: 'text_formatter',
    label: 'Text Formatter',
    category: 'data',
    icon: 'Type',
    description: 'Format text content',
    defaultConfig: { template: '' },
    configFields: [
      { key: 'template', label: 'Template', type: 'textarea', placeholder: 'Hello {{name}}!', required: true },
    ],
  },
  {
    type: 'merge_data',
    label: 'Merge Data',
    category: 'data',
    icon: 'Combine',
    description: 'Combine multiple inputs',
    defaultConfig: { mode: 'merge' },
    configFields: [
      { key: 'mode', label: 'Mode', type: 'select', options: [
        { label: 'Merge Objects', value: 'merge' },
        { label: 'Concatenate Arrays', value: 'concat' },
      ]},
    ],
  },
  {
    type: 'set_variable',
    label: 'Set Variable',
    category: 'data',
    icon: 'Variable',
    description: 'Store value in variable',
    defaultConfig: {},
    configFields: [
      { key: 'name', label: 'Variable Name', type: 'text', placeholder: 'myVariable', required: true },
      { key: 'value', label: 'Value', type: 'textarea', placeholder: '{{input.data}}', required: true },
    ],
  },
  {
    type: 'google_sheets',
    label: 'Google Sheets',
    category: 'data',
    icon: 'Table',
    description: 'Read or write data from Google Sheets',
    defaultConfig: {
      operation: 'read',
      spreadsheetId: '',
      sheetName: '',
      range: '',
      outputFormat: 'json',
      allowWrite: false,
    },
    configFields: [
      { 
        key: 'operation', 
        label: 'Operation', 
        type: 'select', 
        options: [
          { label: 'Read', value: 'read' },
          { label: 'Write', value: 'write' },
          { label: 'Append', value: 'append' },
          { label: 'Update', value: 'update' },
        ],
        defaultValue: 'read',
        required: true,
      },
      { 
        key: 'spreadsheetId', 
        label: 'Spreadsheet ID', 
        type: 'text', 
        placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms', 
        required: true,
        helpText: 'The ID from the Google Sheets URL (the long string between /d/ and /edit)',
      },
      { 
        key: 'sheetName', 
        label: 'Sheet Name (Tab)', 
        type: 'text', 
        placeholder: 'Sheet1',
        helpText: 'Leave empty to use the first sheet',
      },
      { 
        key: 'range', 
        label: 'Range (e.g., A1:D100)', 
        type: 'text', 
        placeholder: 'A1:D100',
        helpText: 'Leave empty to read all used cells. For write/update, specify the target range.',
      },
      { 
        key: 'outputFormat', 
        label: 'Output Format', 
        type: 'select', 
        options: [
          { label: 'JSON Array', value: 'json' },
          { label: 'Key-Value Pairs', value: 'keyvalue' },
          { label: 'Plain Text Table', value: 'text' },
        ],
        defaultValue: 'json',
        helpText: 'How to format the extracted data',
      },
      { 
        key: 'readDirection', 
        label: 'Read Direction', 
        type: 'select', 
        options: [
          { label: 'Row-wise (default)', value: 'rows' },
          { label: 'Column-wise', value: 'columns' },
        ],
        defaultValue: 'rows',
        helpText: 'How to read the data',
      },
      { 
        key: 'allowWrite', 
        label: 'Allow Write Access', 
        type: 'boolean', 
        defaultValue: false,
        helpText: '⚠️ Admin only: Enable write/update operations',
      },
      { 
        key: 'data', 
        label: 'Data to Write (JSON)', 
        type: 'json', 
        placeholder: '[["Name", "Email"], ["John", "john@example.com"]]',
        helpText: 'Required for write/append/update operations. Use JSON array format.',
      },
    ],
  },

  // HTTP & API Nodes
  {
    type: 'http_request',
    label: 'HTTP Request',
    category: 'http_api',
    icon: 'Globe',
    description: 'Make HTTP API call',
    defaultConfig: { method: 'GET', url: '' },
    configFields: [
      { key: 'url', label: 'URL', type: 'text', placeholder: 'https://api.example.com/data', required: true },
      { key: 'method', label: 'Method', type: 'select', options: [
        { label: 'GET', value: 'GET' },
        { label: 'POST', value: 'POST' },
        { label: 'PUT', value: 'PUT' },
        { label: 'PATCH', value: 'PATCH' },
        { label: 'DELETE', value: 'DELETE' },
      ]},
      { key: 'headers', label: 'Headers (JSON)', type: 'json', placeholder: '{"Authorization": "Bearer token"}' },
      { key: 'body', label: 'Body (JSON)', type: 'json', placeholder: '{}' },
      { key: 'timeout', label: 'Timeout (ms)', type: 'number', defaultValue: 30000 },
    ],
  },
  {
    type: 'graphql',
    label: 'GraphQL',
    category: 'http_api',
    icon: 'Braces',
    description: 'Execute GraphQL query',
    defaultConfig: { url: '', query: '', operationName: '' },
    configFields: [
      { key: 'url', label: 'GraphQL Endpoint', type: 'text', placeholder: 'https://api.example.com/graphql', required: true },
      { key: 'query', label: 'Query', type: 'textarea', placeholder: 'query { user(id: 1) { name } }', required: true },
      { key: 'operationName', label: 'Operation Name', type: 'text', placeholder: 'GetUser' },
      { key: 'variables', label: 'Variables (JSON)', type: 'json', placeholder: '{"id": 1}' },
      { key: 'headers', label: 'Headers (JSON)', type: 'json', placeholder: '{"Authorization": "Bearer token"}' },
      { key: 'timeout', label: 'Timeout (ms)', type: 'number', defaultValue: 30000 },
    ],
  },
  {
    type: 'webhook_trigger_response',
    label: 'Webhook',
    category: 'http_api',
    icon: 'Webhook',
    description: 'Receive HTTP webhook',
    defaultConfig: { method: 'POST' },
    configFields: [
      { key: 'method', label: 'Method', type: 'select', options: [
        { label: 'POST', value: 'POST' },
        { label: 'GET', value: 'GET' },
        { label: 'PUT', value: 'PUT' },
        { label: 'DELETE', value: 'DELETE' },
      ]},
    ],
  },
  {
    type: 'respond_to_webhook',
    label: 'Respond to Webhook',
    category: 'http_api',
    icon: 'Send',
    description: 'Send response to webhook caller',
    defaultConfig: { statusCode: 200, responseBody: '' },
    configFields: [
      { key: 'statusCode', label: 'Status Code', type: 'number', defaultValue: 200, required: true },
      { key: 'responseBody', label: 'Response Body (JSON)', type: 'json', placeholder: '{"message": "success"}' },
      { key: 'headers', label: 'Custom Headers (JSON)', type: 'json', placeholder: '{"Content-Type": "application/json"}' },
    ],
  },

  // Output Actions
  {
    type: 'http_post',
    label: 'HTTP POST',
    category: 'output',
    icon: 'Send',
    description: 'Send HTTP POST request',
    defaultConfig: { url: '', method: 'POST' },
    configFields: [
      { key: 'url', label: 'URL', type: 'text', placeholder: 'https://api.example.com/webhook', required: true },
      { key: 'headers', label: 'Headers (JSON)', type: 'json', placeholder: '{}' },
      { key: 'bodyTemplate', label: 'Body Template', type: 'textarea', placeholder: '{"data": "{{input}}"}' },
    ],
  },
  {
    type: 'email_resend',
    label: 'Send Email (Resend)',
    category: 'output',
    icon: 'Mail',
    description: 'Send email via Resend',
    defaultConfig: {},
    configFields: [
      { key: 'to', label: 'To', type: 'text', placeholder: 'recipient@example.com', required: true },
      { key: 'from', label: 'From', type: 'text', placeholder: 'sender@yourdomain.com', required: true },
      { key: 'subject', label: 'Subject', type: 'text', placeholder: 'Workflow Notification', required: true },
      { key: 'body', label: 'Body (HTML allowed)', type: 'textarea', placeholder: '<h1>Hello!</h1><p>Your workflow completed.</p>', required: true },
      { key: 'replyTo', label: 'Reply-To', type: 'text', placeholder: 'reply@example.com' },
    ],
  },
  {
    type: 'slack_message',
    label: 'Slack Message',
    category: 'output',
    icon: 'MessageSquare',
    description: 'Send Slack notification',
    defaultConfig: {},
    configFields: [
      { key: 'webhookUrl', label: 'Webhook URL', type: 'text', placeholder: 'https://hooks.slack.com/services/...', required: true },
      { key: 'channel', label: 'Channel (optional)', type: 'text', placeholder: '#general' },
      { key: 'username', label: 'Bot Name', type: 'text', placeholder: 'Workflow Bot', defaultValue: 'CtrlChecks Bot' },
      { key: 'iconEmoji', label: 'Icon Emoji', type: 'text', placeholder: ':robot_face:', defaultValue: ':zap:' },
      { key: 'message', label: 'Message', type: 'textarea', placeholder: 'Workflow completed successfully!', required: true },
      { key: 'blocks', label: 'Blocks (JSON, optional)', type: 'json', placeholder: '[]' },
    ],
  },
  {
    type: 'slack_webhook',
    label: 'Slack Incoming Webhook',
    category: 'output',
    icon: 'Hash',
    description: 'Simple Slack webhook',
    defaultConfig: {},
    configFields: [
      { key: 'webhookUrl', label: 'Webhook URL', type: 'text', placeholder: 'https://hooks.slack.com/services/...', required: true },
      { key: 'text', label: 'Message Text', type: 'textarea', placeholder: 'Hello from CtrlChecks!', required: true },
    ],
  },
  {
    type: 'discord_webhook',
    label: 'Discord Webhook',
    category: 'output',
    icon: 'MessageCircle',
    description: 'Send Discord message',
    defaultConfig: {},
    configFields: [
      { key: 'webhookUrl', label: 'Webhook URL', type: 'text', placeholder: 'https://discord.com/api/webhooks/...', required: true },
      { key: 'content', label: 'Message', type: 'textarea', placeholder: 'Hello from CtrlChecks!', required: true },
      { key: 'username', label: 'Username', type: 'text', placeholder: 'CtrlChecks Bot' },
      { key: 'avatarUrl', label: 'Avatar URL', type: 'text', placeholder: 'https://example.com/avatar.png' },
    ],
  },
  {
    type: 'database_write',
    label: 'Database Write',
    category: 'output',
    icon: 'Database',
    description: 'Write to database',
    defaultConfig: { table: '' },
    configFields: [
      { key: 'table', label: 'Table Name', type: 'text', placeholder: 'my_table', required: true },
      { key: 'operation', label: 'Operation', type: 'select', options: [
        { label: 'Insert', value: 'insert' },
        { label: 'Update', value: 'update' },
        { label: 'Upsert', value: 'upsert' },
        { label: 'Delete', value: 'delete' },
      ]},
      { key: 'data', label: 'Data Template', type: 'json', placeholder: '{"column": "{{input.value}}"}' },
      { key: 'matchColumn', label: 'Match Column (for update/upsert)', type: 'text', placeholder: 'id' },
    ],
  },
  {
    type: 'database_read',
    label: 'Database Read',
    category: 'data',
    icon: 'DatabaseZap',
    description: 'Read from database',
    defaultConfig: { table: '' },
    configFields: [
      { key: 'table', label: 'Table Name', type: 'text', placeholder: 'my_table', required: true },
      { key: 'columns', label: 'Columns', type: 'text', placeholder: '*', defaultValue: '*' },
      { key: 'filters', label: 'Filters (JSON)', type: 'json', placeholder: '{"column": "value"}' },
      { key: 'limit', label: 'Limit', type: 'number', defaultValue: 100 },
      { key: 'orderBy', label: 'Order By', type: 'text', placeholder: 'created_at' },
      { key: 'ascending', label: 'Ascending', type: 'boolean', defaultValue: false },
    ],
  },
  {
    type: 'log_output',
    label: 'Log Output',
    category: 'output',
    icon: 'FileOutput',
    description: 'Log data for debugging',
    defaultConfig: {},
    configFields: [
      { key: 'message', label: 'Log Message', type: 'textarea', placeholder: 'Debug: {{input}}', required: true },
      { key: 'level', label: 'Log Level', type: 'select', options: [
        { label: 'Info', value: 'info' },
        { label: 'Warning', value: 'warn' },
        { label: 'Error', value: 'error' },
        { label: 'Debug', value: 'debug' },
      ], defaultValue: 'info' },
    ],
  },
];

export const getNodesByCategory = (category: NodeCategory) => 
  NODE_TYPES.filter((node) => node.category === category);

export const getNodeDefinition = (type: string) => 
  NODE_TYPES.find((node) => node.type === type);
