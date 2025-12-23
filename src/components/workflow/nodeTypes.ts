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
    type: 'webhook',
    label: 'Webhook',
    category: 'triggers',
    icon: 'Webhook',
    description: 'Trigger via HTTP webhook',
    defaultConfig: { method: 'POST' },
    configFields: [
      { key: 'method', label: 'Method', type: 'select', options: [
        { label: 'POST', value: 'POST' },
        { label: 'GET', value: 'GET' },
        { label: 'PUT', value: 'PUT' },
      ]},
    ],
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
  {
    type: 'app_trigger',
    label: 'App Trigger',
    category: 'triggers',
    icon: 'Zap',
    description: 'Trigger from app events',
    defaultConfig: { triggerType: 'event' },
    configFields: [
      { key: 'triggerType', label: 'Trigger Type', type: 'select', options: [
        { label: 'Event', value: 'event' },
        { label: 'Button Click', value: 'button' },
        { label: 'Form Submit', value: 'form' },
      ], required: true },
      { key: 'eventName', label: 'Event Name', type: 'text', placeholder: 'user.created' },
    ],
  },
  {
    type: 'polling_trigger',
    label: 'Polling Trigger',
    category: 'triggers',
    icon: 'RefreshCw',
    description: 'Poll an endpoint periodically',
    defaultConfig: { endpoint: '', interval: 60000 },
    configFields: [
      { key: 'endpoint', label: 'Endpoint URL', type: 'text', placeholder: 'https://api.example.com/poll', required: true },
      { key: 'interval', label: 'Poll Interval (ms)', type: 'number', defaultValue: 60000, required: true },
      { key: 'method', label: 'Method', type: 'select', options: [
        { label: 'GET', value: 'GET' },
        { label: 'POST', value: 'POST' },
      ], defaultValue: 'GET' },
      { key: 'headers', label: 'Headers (JSON)', type: 'json', placeholder: '{}' },
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
    type: 'stop_error',
    label: 'Stop and Error',
    category: 'logic',
    icon: 'XCircle',
    description: 'Stop workflow and throw error',
    defaultConfig: { errorMessage: 'An error occurred' },
    configFields: [
      { key: 'errorMessage', label: 'Error Message', type: 'textarea', placeholder: 'An error occurred', required: true },
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
    description: 'Run custom JavaScript code',
    defaultConfig: { code: 'return input;' },
    configFields: [
      { key: 'code', label: 'JavaScript Code', type: 'textarea', placeholder: 'return input;', required: true },
    ],
  },
  {
    type: 'function',
    label: 'Function',
    category: 'logic',
    icon: 'Code2',
    description: 'Execute a function',
    defaultConfig: { language: 'javascript', code: '' },
    configFields: [
      { key: 'language', label: 'Language', type: 'select', options: [
        { label: 'JavaScript', value: 'javascript' },
        { label: 'Python', value: 'python' },
      ], required: true },
      { key: 'code', label: 'Code', type: 'textarea', placeholder: 'function(input) { return input; }', required: true },
      { key: 'inputVariables', label: 'Input Variables (JSON)', type: 'json', placeholder: '[]' },
      { key: 'outputVariables', label: 'Output Variables (JSON)', type: 'json', placeholder: '[]' },
    ],
  },
  {
    type: 'function_item',
    label: 'Function Item',
    category: 'logic',
    icon: 'Code2',
    description: 'Execute function on each item',
    defaultConfig: { language: 'javascript', code: '' },
    configFields: [
      { key: 'language', label: 'Language', type: 'select', options: [
        { label: 'JavaScript', value: 'javascript' },
        { label: 'Python', value: 'python' },
      ], required: true },
      { key: 'code', label: 'Code', type: 'textarea', placeholder: 'function(item) { return item; }', required: true },
      { key: 'inputVariables', label: 'Input Variables (JSON)', type: 'json', placeholder: '[]' },
      { key: 'outputVariables', label: 'Output Variables (JSON)', type: 'json', placeholder: '[]' },
    ],
  },
  {
    type: 'code_execution',
    label: 'Code Execution',
    category: 'logic',
    icon: 'Code',
    description: 'Execute code (JavaScript/Python)',
    defaultConfig: { language: 'javascript', code: '' },
    configFields: [
      { key: 'language', label: 'Language', type: 'select', options: [
        { label: 'JavaScript', value: 'javascript' },
        { label: 'Python', value: 'python' },
      ], required: true },
      { key: 'code', label: 'Code', type: 'textarea', placeholder: 'return input;', required: true },
      { key: 'inputVariables', label: 'Input Variables (JSON)', type: 'json', placeholder: '[]' },
      { key: 'outputVariables', label: 'Output Variables (JSON)', type: 'json', placeholder: '[]' },
    ],
  },
  {
    type: 'code',
    label: 'Code',
    category: 'logic',
    icon: 'Code',
    description: 'Run code (JavaScript/Python)',
    defaultConfig: { language: 'javascript', code: '' },
    configFields: [
      { key: 'language', label: 'Language', type: 'select', options: [
        { label: 'JavaScript', value: 'javascript' },
        { label: 'Python', value: 'python' },
      ], required: true },
      { key: 'code', label: 'Code', type: 'textarea', placeholder: 'return input;', required: true },
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
    type: 'merge',
    label: 'Merge',
    category: 'data',
    icon: 'Combine',
    description: 'Merge objects or arrays',
    defaultConfig: { mode: 'merge' },
    configFields: [
      { key: 'mode', label: 'Mode', type: 'select', options: [
        { label: 'Merge Objects', value: 'merge' },
        { label: 'Concatenate Arrays', value: 'concat' },
      ], defaultValue: 'merge' },
    ],
  },
  {
    type: 'http_request',
    label: 'HTTP Request',
    category: 'data',
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
    type: 'set_variable',
    label: 'Set Variable',
    category: 'data',
    icon: 'Hash',
    description: 'Store value in variable',
    defaultConfig: {},
    configFields: [
      { key: 'name', label: 'Variable Name', type: 'text', placeholder: 'myVariable', required: true },
      { key: 'value', label: 'Value', type: 'textarea', placeholder: '{{input.data}}', required: true },
    ],
  },
  {
    type: 'set',
    label: 'Set',
    category: 'data',
    icon: 'Hash',
    description: 'Set a value',
    defaultConfig: {},
    configFields: [
      { key: 'name', label: 'Field Name', type: 'text', placeholder: 'fieldName', required: true },
      { key: 'value', label: 'Value', type: 'textarea', placeholder: '{{input.data}}', required: true },
    ],
  },
  {
    type: 'edit_fields',
    label: 'Edit Fields',
    category: 'data',
    icon: 'Edit',
    description: 'Edit field values',
    defaultConfig: { fieldMappings: {} },
    configFields: [
      { key: 'fieldMappings', label: 'Field Mappings (JSON)', type: 'json', placeholder: '{"field1": "value1", "field2": "{{input.field2}}"}', required: true },
    ],
  },
  {
    type: 'rename_keys',
    label: 'Rename Keys',
    category: 'data',
    icon: 'Tag',
    description: 'Rename object keys',
    defaultConfig: { fieldMappings: {} },
    configFields: [
      { key: 'fieldMappings', label: 'Key Mappings (JSON)', type: 'json', placeholder: '{"oldKey": "newKey"}', required: true },
    ],
  },
  {
    type: 'split_items',
    label: 'Split Items',
    category: 'data',
    icon: 'Scissors',
    description: 'Split items by delimiter',
    defaultConfig: { array: '', delimiter: ',' },
    configFields: [
      { key: 'array', label: 'Array Expression', type: 'text', placeholder: '{{input.items}}', required: true },
      { key: 'delimiter', label: 'Delimiter', type: 'text', placeholder: ',', defaultValue: ',', required: true },
    ],
  },
  {
    type: 'split_out_items',
    label: 'Split Out Items',
    category: 'data',
    icon: 'Scissors',
    description: 'Split out items from array',
    defaultConfig: { array: '', delimiter: ',' },
    configFields: [
      { key: 'array', label: 'Array Expression', type: 'text', placeholder: '{{input.items}}', required: true },
      { key: 'delimiter', label: 'Delimiter', type: 'text', placeholder: ',', defaultValue: ',', required: true },
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
    type: 'send_email',
    label: 'Send Email',
    category: 'output',
    icon: 'Mail',
    description: 'Send email',
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
    type: 'whatsapp',
    label: 'WhatsApp',
    category: 'output',
    icon: 'MessageSquare',
    description: 'Send WhatsApp message',
    defaultConfig: {},
    configFields: [
      { key: 'to', label: 'To (Phone Number)', type: 'text', placeholder: '+1234567890', required: true },
      { key: 'message', label: 'Message', type: 'textarea', placeholder: 'Hello!', required: true },
      { key: 'apiKey', label: 'API Key', type: 'text', placeholder: 'your-api-key' },
    ],
  },
  {
    type: 'telegram',
    label: 'Telegram',
    category: 'output',
    icon: 'Send',
    description: 'Send Telegram message',
    defaultConfig: {},
    configFields: [
      { key: 'chatId', label: 'Chat ID', type: 'text', placeholder: '123456789', required: true },
      { key: 'message', label: 'Message', type: 'textarea', placeholder: 'Hello!', required: true },
      { key: 'botToken', label: 'Bot Token', type: 'text', placeholder: 'your-bot-token', required: true },
    ],
  },
  {
    type: 'update_crm',
    label: 'Update CRM',
    category: 'output',
    icon: 'Users',
    description: 'Update CRM record',
    defaultConfig: { crmType: 'salesforce' },
    configFields: [
      { key: 'crmType', label: 'CRM Type', type: 'select', options: [
        { label: 'Salesforce', value: 'salesforce' },
        { label: 'HubSpot', value: 'hubspot' },
        { label: 'Pipedrive', value: 'pipedrive' },
        { label: 'Zoho', value: 'zoho' },
      ], required: true },
      { key: 'endpoint', label: 'Endpoint', type: 'text', placeholder: '/api/contacts/123', required: true },
      { key: 'data', label: 'Data (JSON)', type: 'json', placeholder: '{"name": "John Doe"}', required: true },
      { key: 'apiKey', label: 'API Key', type: 'text', placeholder: 'your-api-key' },
    ],
  },
  {
    type: 'jira_create_ticket',
    label: 'Create Jira Ticket',
    category: 'output',
    icon: 'Receipt',
    description: 'Create ticket in Jira',
    defaultConfig: { projectKey: '', issueType: 'Task' },
    configFields: [
      { key: 'projectKey', label: 'Project Key', type: 'text', placeholder: 'PROJ', required: true },
      { key: 'issueType', label: 'Issue Type', type: 'select', options: [
        { label: 'Task', value: 'Task' },
        { label: 'Bug', value: 'Bug' },
        { label: 'Story', value: 'Story' },
        { label: 'Epic', value: 'Epic' },
      ], required: true },
      { key: 'summary', label: 'Summary', type: 'text', placeholder: 'Ticket summary', required: true },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Ticket description' },
      { key: 'apiKey', label: 'API Key', type: 'text', placeholder: 'your-api-key', required: true },
      { key: 'domain', label: 'Jira Domain', type: 'text', placeholder: 'yourcompany.atlassian.net', required: true },
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
    type: 'mysql',
    label: 'MySQL',
    category: 'data',
    icon: 'Database',
    description: 'Query MySQL database',
    defaultConfig: { host: '', database: '', query: '' },
    configFields: [
      { key: 'host', label: 'Host', type: 'text', placeholder: 'localhost:3306', required: true },
      { key: 'database', label: 'Database', type: 'text', placeholder: 'mydb', required: true },
      { key: 'query', label: 'SQL Query', type: 'textarea', placeholder: 'SELECT * FROM users', required: true },
      { key: 'username', label: 'Username', type: 'text', placeholder: 'user' },
      { key: 'password', label: 'Password', type: 'text', placeholder: 'password' },
    ],
  },
  {
    type: 'postgresql',
    label: 'PostgreSQL',
    category: 'data',
    icon: 'Database',
    description: 'Query PostgreSQL database',
    defaultConfig: { host: '', database: '', query: '' },
    configFields: [
      { key: 'host', label: 'Host', type: 'text', placeholder: 'localhost:5432', required: true },
      { key: 'database', label: 'Database', type: 'text', placeholder: 'mydb', required: true },
      { key: 'query', label: 'SQL Query', type: 'textarea', placeholder: 'SELECT * FROM users', required: true },
      { key: 'username', label: 'Username', type: 'text', placeholder: 'user' },
      { key: 'password', label: 'Password', type: 'text', placeholder: 'password' },
    ],
  },
  {
    type: 'airtable',
    label: 'Airtable',
    category: 'data',
    icon: 'Table',
    description: 'Read from Airtable base',
    defaultConfig: { baseId: '', tableId: '' },
    configFields: [
      { key: 'baseId', label: 'Base ID', type: 'text', placeholder: 'appXXXXXXXXXXXXXX', required: true },
      { key: 'tableId', label: 'Table ID', type: 'text', placeholder: 'tblXXXXXXXXXXXXXX', required: true },
      { key: 'apiKey', label: 'API Key', type: 'text', placeholder: 'keyXXXXXXXXXXXXXX', required: true },
      { key: 'view', label: 'View (optional)', type: 'text', placeholder: 'Grid view' },
      { key: 'maxRecords', label: 'Max Records', type: 'number', defaultValue: 100 },
    ],
  },
  {
    type: 'notion',
    label: 'Notion',
    category: 'data',
    icon: 'FileText',
    description: 'Read from Notion database',
    defaultConfig: { databaseId: '' },
    configFields: [
      { key: 'databaseId', label: 'Database ID', type: 'text', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', required: true },
      { key: 'apiKey', label: 'API Key', type: 'text', placeholder: 'secret_...', required: true },
      { key: 'filter', label: 'Filter (JSON)', type: 'json', placeholder: '{}' },
      { key: 'sorts', label: 'Sorts (JSON)', type: 'json', placeholder: '[]' },
    ],
  },
  {
    type: 'crm_source',
    label: 'CRM Source',
    category: 'data',
    icon: 'Users',
    description: 'Read from CRM system',
    defaultConfig: { crmType: 'salesforce', endpoint: '' },
    configFields: [
      { key: 'crmType', label: 'CRM Type', type: 'select', options: [
        { label: 'Salesforce', value: 'salesforce' },
        { label: 'HubSpot', value: 'hubspot' },
        { label: 'Pipedrive', value: 'pipedrive' },
        { label: 'Zoho', value: 'zoho' },
      ], required: true },
      { key: 'endpoint', label: 'Endpoint', type: 'text', placeholder: '/api/contacts', required: true },
      { key: 'apiKey', label: 'API Key', type: 'text', placeholder: 'your-api-key' },
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
  {
    type: 'http_response',
    label: 'HTTP Response',
    category: 'output',
    icon: 'Globe',
    description: 'Return HTTP response',
    defaultConfig: { statusCode: 200 },
    configFields: [
      { key: 'statusCode', label: 'Status Code', type: 'number', placeholder: '200', defaultValue: 200, required: true },
      { key: 'body', label: 'Response Body (JSON)', type: 'json', placeholder: '{"message": "success"}' },
      { key: 'headers', label: 'Headers (JSON)', type: 'json', placeholder: '{"Content-Type": "application/json"}' },
    ],
  },
  {
    type: 'email_destination',
    label: 'Email Destination',
    category: 'output',
    icon: 'Mail',
    description: 'Send email as destination',
    defaultConfig: {},
    configFields: [
      { key: 'to', label: 'To', type: 'text', placeholder: 'recipient@example.com', required: true },
      { key: 'from', label: 'From', type: 'text', placeholder: 'sender@yourdomain.com', required: true },
      { key: 'subject', label: 'Subject', type: 'text', placeholder: 'Workflow Notification', required: true },
      { key: 'body', label: 'Body (HTML allowed)', type: 'textarea', placeholder: '<h1>Hello!</h1><p>Your workflow completed.</p>', required: true },
    ],
  },
  {
    type: 'file_upload',
    label: 'File Upload',
    category: 'output',
    icon: 'Upload',
    description: 'Upload file to storage',
    defaultConfig: { storageType: 's3' },
    configFields: [
      { key: 'storageType', label: 'Storage Type', type: 'select', options: [
        { label: 'S3', value: 's3' },
        { label: 'Google Cloud Storage', value: 'gcs' },
        { label: 'Azure Blob', value: 'azure' },
        { label: 'Local', value: 'local' },
      ], required: true },
      { key: 'path', label: 'File Path', type: 'text', placeholder: '/path/to/file.txt', required: true },
      { key: 'data', label: 'File Data', type: 'textarea', placeholder: 'Base64 encoded or file content' },
      { key: 'bucket', label: 'Bucket Name', type: 'text', placeholder: 'my-bucket' },
    ],
  },
  {
    type: 'notification',
    label: 'Notification',
    category: 'output',
    icon: 'Bell',
    description: 'Send notification',
    defaultConfig: { notificationMessage: 'Workflow completed' },
    configFields: [
      { key: 'notificationMessage', label: 'Notification Message', type: 'textarea', placeholder: 'Workflow completed', required: true },
      { key: 'type', label: 'Notification Type', type: 'select', options: [
        { label: 'Success', value: 'success' },
        { label: 'Info', value: 'info' },
        { label: 'Warning', value: 'warning' },
        { label: 'Error', value: 'error' },
      ], defaultValue: 'info' },
    ],
  },
];

export const getNodesByCategory = (category: NodeCategory) => 
  NODE_TYPES.filter((node) => node.category === category);

export const getNodeDefinition = (type: string) => 
  NODE_TYPES.find((node) => node.type === type);
