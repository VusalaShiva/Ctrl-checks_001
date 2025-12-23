import { WorkflowNode, NodeData } from '@/stores/workflowStore';
import { Edge } from '@xyflow/react';
import { getNodeDefinition } from '@/components/workflow/nodeTypes';

// ============================================
// WORKFLOW NODE LIBRARY
// ============================================
// This library organizes nodes according to the workflow structure:
//
// 1. TRIGGER NODES
//    - Webhook
//    - Schedule (Cron)
//    - Manual Trigger
//    - App Triggers
//    - Polling Triggers
//
// 2. SOURCE NODES
//    - HTTP Request
//    - Google Sheets (Read)
//    - MySQL / PostgreSQL
//    - Airtable
//    - Notion
//    - CRM tools
//
// 3. LOGIC NODES
//    a) Data Transformation: Set, Edit Fields, Rename Keys, Merge, Split Out Items
//    b) Logic & Conditions: IF, Switch, Filter, Wait, Stop and Error
//    c) Code Execution: Function, Function Item, Code (JavaScript/Python)
//
// 4. ACTION NODES
//    - Send Email
//    - Slack Message
//    - WhatsApp / Telegram
//    - Create Google Sheet Row
//    - Update CRM Record
//    - Create Ticket (Jira)
//
// 5. DESTINATION NODES
//    - HTTP Response
//    - Email
//    - File Upload
//    - Database Insert
//    - Notification
//
// Note: AI Processing nodes (openai_gpt, anthropic_claude, google_gemini, etc.)
// are kept separate in the 'ai' category and are not included in this validator.
// ============================================

export interface NodeSchema {
  type: string;
  category: 'triggers' | 'source' | 'logic' | 'action' | 'destination';
  requiredProperties: string[];
  defaultConfig: Record<string, unknown>;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export const WORKFLOW_NODE_LIBRARY: NodeSchema[] = [
  // ============================================
  // TRIGGER NODES
  // ============================================
  {
    type: 'webhook',
    category: 'triggers',
    requiredProperties: ['method'],
    defaultConfig: {
      method: 'POST',
      webhookUrl: '',
    },
  },
  {
    type: 'schedule',
    category: 'triggers',
    requiredProperties: ['cron'],
    defaultConfig: {
      cron: '0 9 * * *',
      schedule: '0 9 * * *',
    },
  },
  // Alias for 'schedule_cron' node type
  {
    type: 'schedule_cron',
    category: 'triggers',
    requiredProperties: ['cron', 'schedule'],
    defaultConfig: {
      cron: '0 9 * * *',
      schedule: '0 9 * * *',
    },
  },
  {
    type: 'manual_trigger',
    category: 'triggers',
    requiredProperties: [],
    defaultConfig: {},
  },
  {
    type: 'http_trigger',
    category: 'triggers',
    requiredProperties: ['url', 'method'],
    defaultConfig: {
      url: '',
      method: 'GET',
      interval: 60000,
      headers: {},
    },
  },
  {
    type: 'app_trigger',
    category: 'triggers',
    requiredProperties: ['triggerType'],
    defaultConfig: {
      triggerType: 'event',
    },
  },
  {
    type: 'polling_trigger',
    category: 'triggers',
    requiredProperties: ['endpoint', 'interval'],
    defaultConfig: {
      endpoint: '',
      interval: 60000,
    },
  },

  // ============================================
  // SOURCE NODES
  // ============================================
  {
    type: 'http_request',
    category: 'source',
    requiredProperties: ['url', 'method'],
    defaultConfig: {
      url: '',
      method: 'GET',
      headers: {},
      timeout: 30000,
      authentication: 'none',
      inputMapping: {},
    },
  },
  {
    type: 'google_sheets',
    category: 'source',
    requiredProperties: ['operation', 'spreadsheetId'],
    defaultConfig: {
      operation: 'read',
      spreadsheetId: '',
      sheetName: '',
      range: '',
      authentication: 'oauth',
      inputMapping: {},
    },
  },
  // Alias for 'google_sheets_read' node type
  {
    type: 'google_sheets_read',
    category: 'source',
    requiredProperties: ['spreadsheetId'],
    defaultConfig: {
      operation: 'read',
      spreadsheetId: '',
      sheetName: '',
      range: '',
      authentication: 'oauth',
      inputMapping: {},
    },
  },
  {
    type: 'database_read',
    category: 'source',
    requiredProperties: ['table'],
    defaultConfig: {
      table: '',
      columns: '*',
      filters: {},
      authentication: 'database',
      inputMapping: {},
    },
  },
  {
    type: 'mysql',
    category: 'source',
    requiredProperties: ['host', 'database', 'query'],
    defaultConfig: {
      host: '',
      database: '',
      query: '',
      authentication: 'credentials',
      inputMapping: {},
    },
  },
  {
    type: 'postgresql',
    category: 'source',
    requiredProperties: ['host', 'database', 'query'],
    defaultConfig: {
      host: '',
      database: '',
      query: '',
      authentication: 'credentials',
      inputMapping: {},
    },
  },
  {
    type: 'airtable',
    category: 'source',
    requiredProperties: ['baseId', 'tableId'],
    defaultConfig: {
      baseId: '',
      tableId: '',
      authentication: 'api_key',
      inputMapping: {},
    },
  },
  {
    type: 'notion',
    category: 'source',
    requiredProperties: ['databaseId'],
    defaultConfig: {
      databaseId: '',
      authentication: 'oauth',
      inputMapping: {},
    },
  },
  {
    type: 'crm_source',
    category: 'source',
    requiredProperties: ['crmType', 'endpoint'],
    defaultConfig: {
      crmType: 'salesforce',
      endpoint: '',
      authentication: 'oauth',
      inputMapping: {},
    },
  },

  // ============================================
  // LOGIC NODES
  // ============================================
  // a) Data Transformation: Set, Edit Fields, Rename Keys, Merge, Split Out Items
  // ============================================
  {
    type: 'set_variable',
    category: 'logic',
    requiredProperties: ['name', 'value'],
    defaultConfig: {
      name: '',
      value: '',
      fieldMappings: {},
    },
  },
  // Alias for 'set' node type
  {
    type: 'set',
    category: 'logic',
    requiredProperties: ['name', 'value'],
    defaultConfig: {
      name: '',
      value: '',
      fieldMappings: {},
    },
  },
  {
    type: 'edit_fields',
    category: 'logic',
    requiredProperties: ['fieldMappings'],
    defaultConfig: {
      fieldMappings: {},
      transformationRules: {},
    },
  },
  {
    type: 'rename_keys',
    category: 'logic',
    requiredProperties: ['fieldMappings'],
    defaultConfig: {
      fieldMappings: {},
      transformationRules: {},
    },
  },
  {
    type: 'split_items',
    category: 'logic',
    requiredProperties: ['array', 'delimiter'],
    defaultConfig: {
      array: '',
      delimiter: ',',
      fieldMappings: {},
      transformationRules: {},
    },
  },
  // Alias for 'split_out_items' node type
  {
    type: 'split_out_items',
    category: 'logic',
    requiredProperties: ['array', 'delimiter'],
    defaultConfig: {
      array: '',
      delimiter: ',',
      fieldMappings: {},
      transformationRules: {},
    },
  },
  {
    type: 'text_formatter',
    category: 'logic',
    requiredProperties: ['template'],
    defaultConfig: {
      template: '',
      fieldMappings: {},
      transformationRules: {},
    },
  },
  {
    type: 'merge_data',
    category: 'logic',
    requiredProperties: ['mode'],
    defaultConfig: {
      mode: 'merge',
      fieldMappings: {},
      transformationRules: {},
    },
  },
  // Alias for 'merge' node type
  {
    type: 'merge',
    category: 'logic',
    requiredProperties: ['mode'],
    defaultConfig: {
      mode: 'merge',
      fieldMappings: {},
      transformationRules: {},
    },
  },
  {
    type: 'javascript',
    category: 'logic',
    requiredProperties: ['code'],
    defaultConfig: {
      code: 'return input;',
      fieldMappings: {},
      transformationRules: {},
    },
  },
  {
    type: 'json_parser',
    category: 'logic',
    requiredProperties: [],
    defaultConfig: {
      expression: '',
      fieldMappings: {},
      transformationRules: {},
    },
  },

  // ============================================
  // b) Logic & Conditions: IF, Switch, Filter, Wait, Stop and Error
  // ============================================
  {
    type: 'if_else',
    category: 'logic',
    requiredProperties: ['condition'],
    defaultConfig: {
      condition: '',
      conditionExpression: '',
    },
  },
  {
    type: 'switch',
    category: 'logic',
    requiredProperties: ['expression', 'cases'],
    defaultConfig: {
      expression: '',
      cases: [],
      conditionExpression: '',
    },
  },
  {
    type: 'filter',
    category: 'logic',
    requiredProperties: ['array', 'condition'],
    defaultConfig: {
      array: '',
      condition: '',
      conditionExpression: '',
    },
  },
  {
    type: 'wait',
    category: 'logic',
    requiredProperties: ['duration'],
    defaultConfig: {
      duration: 1000,
      timeout: 1000,
    },
  },
  {
    type: 'error_handler',
    category: 'logic',
    requiredProperties: [],
    defaultConfig: {
      retries: 3,
      retryDelay: 1000,
      errorMessage: 'An error occurred',
    },
  },
  // Alias for 'stop_error' node type
  {
    type: 'stop_error',
    category: 'logic',
    requiredProperties: ['errorMessage'],
    defaultConfig: {
      errorMessage: 'An error occurred',
      retries: 0,
      retryDelay: 0,
    },
  },
  {
    type: 'loop',
    category: 'logic',
    requiredProperties: ['array'],
    defaultConfig: {
      array: '',
      maxIterations: 100,
    },
  },

  // ============================================
  // c) Code Execution: Function, Function Item, Code (JavaScript/Python)
  // ============================================
  {
    type: 'function',
    category: 'logic',
    requiredProperties: ['language', 'code'],
    defaultConfig: {
      language: 'javascript',
      code: '',
      inputVariables: [],
      outputVariables: [],
    },
  },
  {
    type: 'function_item',
    category: 'logic',
    requiredProperties: ['language', 'code'],
    defaultConfig: {
      language: 'javascript',
      code: '',
      inputVariables: [],
      outputVariables: [],
    },
  },
  {
    type: 'code_execution',
    category: 'logic',
    requiredProperties: ['language', 'code'],
    defaultConfig: {
      language: 'javascript',
      code: '',
      inputVariables: [],
      outputVariables: [],
    },
  },
  // Alias for 'code' node type (JavaScript/Python)
  {
    type: 'code',
    category: 'logic',
    requiredProperties: ['language', 'code'],
    defaultConfig: {
      language: 'javascript',
      code: '',
      inputVariables: [],
      outputVariables: [],
    },
  },

  // ============================================
  // ACTION NODES
  // ============================================
  {
    type: 'email_resend',
    category: 'action',
    requiredProperties: ['to', 'from', 'subject', 'body'],
    defaultConfig: {
      to: '',
      from: '',
      subject: '',
      body: '',
      credentials: 'resend_api_key',
      payload: {},
      destinationConfig: {},
    },
  },
  // Alias for 'send_email' node type
  {
    type: 'send_email',
    category: 'action',
    requiredProperties: ['to', 'from', 'subject', 'body'],
    defaultConfig: {
      to: '',
      from: '',
      subject: '',
      body: '',
      credentials: 'resend_api_key',
      payload: {},
      destinationConfig: {},
    },
  },
  {
    type: 'slack_message',
    category: 'action',
    requiredProperties: ['webhookUrl', 'message'],
    defaultConfig: {
      webhookUrl: '',
      message: '',
      channel: '',
      credentials: 'slack_webhook',
      payload: {},
      destinationConfig: {},
    },
  },
  {
    type: 'slack_webhook',
    category: 'action',
    requiredProperties: ['webhookUrl', 'text'],
    defaultConfig: {
      webhookUrl: '',
      text: '',
      credentials: 'slack_webhook',
      payload: {},
      destinationConfig: {},
    },
  },
  {
    type: 'discord_webhook',
    category: 'action',
    requiredProperties: ['webhookUrl', 'content'],
    defaultConfig: {
      webhookUrl: '',
      content: '',
      credentials: 'discord_webhook',
      payload: {},
      destinationConfig: {},
    },
  },
  {
    type: 'http_post',
    category: 'action',
    requiredProperties: ['url'],
    defaultConfig: {
      url: '',
      method: 'POST',
      headers: {},
      credentials: 'none',
      payload: {},
      destinationConfig: {},
    },
  },
  {
    type: 'whatsapp',
    category: 'action',
    requiredProperties: ['to', 'message'],
    defaultConfig: {
      to: '',
      message: '',
      credentials: 'whatsapp_api',
      payload: {},
      destinationConfig: {},
    },
  },
  {
    type: 'telegram',
    category: 'action',
    requiredProperties: ['chatId', 'message'],
    defaultConfig: {
      chatId: '',
      message: '',
      credentials: 'telegram_bot',
      payload: {},
      destinationConfig: {},
    },
  },
  {
    type: 'google_sheets',
    category: 'action',
    requiredProperties: ['operation', 'spreadsheetId'],
    defaultConfig: {
      operation: 'append',
      spreadsheetId: '',
      sheetName: '',
      credentials: 'google_oauth',
      payload: {},
      destinationConfig: {},
    },
  },
  // Alias for 'google_sheets_create_row' node type
  {
    type: 'google_sheets_create_row',
    category: 'action',
    requiredProperties: ['spreadsheetId'],
    defaultConfig: {
      operation: 'append',
      spreadsheetId: '',
      sheetName: '',
      credentials: 'google_oauth',
      payload: {},
      destinationConfig: {},
    },
  },
  {
    type: 'update_crm',
    category: 'action',
    requiredProperties: ['crmType', 'endpoint'],
    defaultConfig: {
      crmType: 'salesforce',
      endpoint: '',
      credentials: 'oauth',
      payload: {},
      destinationConfig: {},
    },
  },
  {
    type: 'jira_create_ticket',
    category: 'action',
    requiredProperties: ['projectKey', 'issueType'],
    defaultConfig: {
      projectKey: '',
      issueType: 'Task',
      credentials: 'jira_api',
      payload: {},
      destinationConfig: {},
    },
  },
  {
    type: 'database_write',
    category: 'action',
    requiredProperties: ['table', 'operation'],
    defaultConfig: {
      table: '',
      operation: 'insert',
      credentials: 'database',
      payload: {},
      destinationConfig: {},
    },
  },

  // ============================================
  // DESTINATION NODES
  // ============================================
  {
    type: 'http_post',
    category: 'destination',
    requiredProperties: ['url'],
    defaultConfig: {
      url: '',
      method: 'POST',
      responseFormat: 'json',
      storageConfig: {},
    },
  },
  {
    type: 'email_resend',
    category: 'destination',
    requiredProperties: ['to', 'from', 'subject', 'body'],
    defaultConfig: {
      to: '',
      from: '',
      subject: '',
      body: '',
      responseFormat: 'html',
      storageConfig: {},
    },
  },
  {
    type: 'database_write',
    category: 'destination',
    requiredProperties: ['table'],
    defaultConfig: {
      table: '',
      operation: 'insert',
      responseFormat: 'json',
      storageConfig: {},
    },
  },
  // Alias for 'database_insert' node type
  {
    type: 'database_insert',
    category: 'destination',
    requiredProperties: ['table'],
    defaultConfig: {
      table: '',
      operation: 'insert',
      responseFormat: 'json',
      storageConfig: {},
    },
  },
  // Alias for 'http_response' node type
  {
    type: 'http_response',
    category: 'destination',
    requiredProperties: ['statusCode'],
    defaultConfig: {
      statusCode: 200,
      responseFormat: 'json',
      storageConfig: {},
    },
  },
  // Alias for 'email_destination' node type
  {
    type: 'email_destination',
    category: 'destination',
    requiredProperties: ['to', 'from', 'subject', 'body'],
    defaultConfig: {
      to: '',
      from: '',
      subject: '',
      body: '',
      responseFormat: 'html',
      storageConfig: {},
    },
  },
  {
    type: 'log_output',
    category: 'destination',
    requiredProperties: ['message'],
    defaultConfig: {
      message: '',
      level: 'info',
      responseFormat: 'text',
      storageConfig: {},
      notificationMessage: '',
    },
  },
  {
    type: 'file_upload',
    category: 'destination',
    requiredProperties: ['storageType', 'path'],
    defaultConfig: {
      storageType: 's3',
      path: '',
      responseFormat: 'binary',
      storageConfig: {},
    },
  },
  {
    type: 'notification',
    category: 'destination',
    requiredProperties: ['notificationMessage'],
    defaultConfig: {
      notificationMessage: 'Workflow completed',
      responseFormat: 'text',
      storageConfig: {},
    },
  },
];

// ============================================
// VALIDATION RULES
// ============================================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  autoFixed: boolean;
  addedNodes: string[];
  fixedNodes: string[];
}

export interface ValidatedWorkflow {
  nodes: WorkflowNode[];
  edges: Edge[];
  workflowStatus: 'valid' | 'auto_fixed' | 'invalid';
  validationResult: ValidationResult;
}

// ============================================
// VALIDATION ENGINE
// ============================================

/**
 * Validates and auto-completes a workflow
 */
export function validateAndAutoCompleteWorkflow(
  nodes: WorkflowNode[],
  edges: Edge[]
): ValidatedWorkflow {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    autoFixed: false,
    addedNodes: [],
    fixedNodes: [],
  };

  let updatedNodes = [...nodes];
  let updatedEdges = [...edges];

  // ============================================
  // RULE 1: Must have at least ONE trigger node
  // ============================================
  const triggerNodes = updatedNodes.filter(
    (node) => node.data.category === 'triggers'
  );

  if (triggerNodes.length === 0) {
    result.isValid = false;
    result.errors.push('Workflow must have at least one trigger node');
    result.autoFixed = true;

    // Calculate position for trigger node (top-left area)
    let position = { x: 100, y: 100 };
    
    // If there are existing nodes, place trigger to the left of them
    if (updatedNodes.length > 0) {
      const leftmostNode = updatedNodes.reduce((prev, current) => 
        (current.position.x < prev.position.x) ? current : prev
      );
      position = {
        x: Math.max(50, leftmostNode.position.x - 250),
        y: leftmostNode.position.y,
      };
    }

    const manualTrigger = createNodeFromSchema('manual_trigger', position);
    updatedNodes.push(manualTrigger);
    result.addedNodes.push('manual_trigger');
  }

  // ============================================
  // RULE 2: Must have at least ONE destination node
  // ============================================
  // Check for output nodes (destination/action nodes)
  const outputNodes = updatedNodes.filter(
    (node) => {
      // Check if it's an output category node
      if (node.data.category === 'output') return true;
      
      // Check if it matches destination or action schema
      const schema = WORKFLOW_NODE_LIBRARY.find(s => s.type === node.data.type && (s.category === 'destination' || s.category === 'action'));
      return schema !== undefined;
    }
  );

  if (outputNodes.length === 0) {
    result.isValid = false;
    result.errors.push('Workflow must have at least one destination or action node');
    result.autoFixed = true;

    // Calculate position for new node
    let position = { x: 400, y: 100 };
    
    // Try to find the rightmost node to place the destination after it
    if (updatedNodes.length > 0) {
      const rightmostNode = updatedNodes.reduce((prev, current) => 
        (current.position.x > prev.position.x) ? current : prev
      );
      position = {
        x: rightmostNode.position.x + 350,
        y: rightmostNode.position.y,
      };
    }

    const logOutput = createNodeFromSchema('log_output', position);
    updatedNodes.push(logOutput);
    result.addedNodes.push('log_output');

    // Connect to the rightmost node or trigger node
    const nodeToConnect = updatedNodes.find(n => n.id !== logOutput.id);
    if (nodeToConnect) {
      const newEdge: Edge = {
        id: `e_${nodeToConnect.id}_${logOutput.id}_${Date.now()}`,
        source: nodeToConnect.id,
        target: logOutput.id,
      };
      updatedEdges.push(newEdge);
    }
  }

  // ============================================
  // RULE 3: Check for required properties in existing nodes
  // ============================================
  updatedNodes = updatedNodes.map((node) => {
    // Try to find schema matching both type and category
    let schema = WORKFLOW_NODE_LIBRARY.find((s) => {
      if (s.type !== node.data.type) return false;
      
      // Map node category to schema category
      const nodeCategory = node.data.category;
      if (nodeCategory === 'triggers' && s.category === 'triggers') return true;
      if (nodeCategory === 'data' && s.category === 'source') return true;
      if (nodeCategory === 'logic' && s.category === 'logic') return true;
      if (nodeCategory === 'output' && (s.category === 'action' || s.category === 'destination')) return true;
      
      return false;
    });
    
    // Fallback to first match by type if category doesn't match
    if (!schema) {
      schema = WORKFLOW_NODE_LIBRARY.find((s) => s.type === node.data.type);
    }
    
    if (!schema) return node;

    const missingProps: string[] = [];
    schema.requiredProperties.forEach((prop) => {
      if (!node.data.config || node.data.config[prop] === undefined || node.data.config[prop] === '') {
        missingProps.push(prop);
      }
    });

    if (missingProps.length > 0) {
      result.warnings.push(
        `Node "${node.data.label}" (${node.data.type}) is missing required properties: ${missingProps.join(', ')}`
      );
      result.autoFixed = true;

      // Auto-populate missing properties with defaults
      const updatedConfig = { ...node.data.config };
      missingProps.forEach((prop) => {
        if (schema.defaultConfig[prop] !== undefined) {
          updatedConfig[prop] = schema.defaultConfig[prop];
        } else {
          // Set placeholder values
          updatedConfig[prop] = getPlaceholderValue(prop, node.data.type);
        }
      });

      if (!result.fixedNodes.includes(node.id)) {
        result.fixedNodes.push(node.id);
      }

      return {
        ...node,
        data: {
          ...node.data,
          config: updatedConfig,
        },
      };
    }

    return node;
  });

  // ============================================
  // RULE 4: Ensure all nodes are connected
  // ============================================
  const connectedNodeIds = new Set<string>();
  updatedEdges.forEach((edge) => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });

  const isolatedNodes = updatedNodes.filter(
    (node) => !connectedNodeIds.has(node.id) && node.data.category !== 'triggers'
  );

  if (isolatedNodes.length > 0) {
    result.warnings.push(
      `Found ${isolatedNodes.length} isolated node(s) that are not connected`
    );

    // Try to connect isolated nodes to the workflow
    const triggerNode = updatedNodes.find((n) => n.data.category === 'triggers');
    if (triggerNode) {
      isolatedNodes.forEach((isolatedNode) => {
        // Check if there's already an edge
        const existingEdge = updatedEdges.find(
          (e) => e.source === triggerNode.id && e.target === isolatedNode.id
        );

        if (!existingEdge) {
          const newEdge: Edge = {
            id: `e_${triggerNode.id}_${isolatedNode.id}`,
            source: triggerNode.id,
            target: isolatedNode.id,
          };
          updatedEdges.push(newEdge);
          result.autoFixed = true;
        }
      });
    }
  }

  // ============================================
  // RULE 5: Always add stop_error node if missing
  // ============================================
  const hasErrorHandler = updatedNodes.some(
    (node) => node.data.type === 'error_handler'
  );

  if (!hasErrorHandler) {
    result.warnings.push('No error handler node found. Consider adding one for better error handling.');
    // Note: We don't auto-add this as it's optional, but we warn about it
  }

  // ============================================
  // RULE 6: Check for source nodes if external data is referenced
  // ============================================
  // This is a heuristic check - if nodes reference external data patterns
  const hasSourceNodes = updatedNodes.some(
    (node) => {
      // Check if it's a data category node (which includes sources)
      if (node.data.category === 'data') {
        const schema = WORKFLOW_NODE_LIBRARY.find(s => s.type === node.data.type && s.category === 'source');
        return schema !== undefined;
      }
      return false;
    }
  );

  // Check if any node config references external APIs/data sources
  const referencesExternalData = updatedNodes.some((node) => {
    const config = node.data.config || {};
    const configStr = JSON.stringify(config).toLowerCase();
    return (
      configStr.includes('api') ||
      configStr.includes('http') ||
      configStr.includes('database') ||
      configStr.includes('sheet')
    );
  });

  if (referencesExternalData && !hasSourceNodes) {
    result.warnings.push(
      'Workflow references external data sources but has no source nodes. Consider adding a source node.'
    );
  }

  // ============================================
  // Determine final status
  // ============================================
  let workflowStatus: 'valid' | 'auto_fixed' | 'invalid' = 'valid';
  if (result.autoFixed) {
    workflowStatus = 'auto_fixed';
  } else if (result.errors.length > 0) {
    workflowStatus = 'invalid';
  }

  return {
    nodes: updatedNodes,
    edges: updatedEdges,
    workflowStatus,
    validationResult: result,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Creates a node from a schema definition
 */
function createNodeFromSchema(
  nodeType: string,
  position: { x: number; y: number }
): WorkflowNode {
  const schema = WORKFLOW_NODE_LIBRARY.find((s) => s.type === nodeType);
  const nodeDefinition = getNodeDefinition(nodeType);

  if (!schema) {
    throw new Error(`Node schema not found for type: ${nodeType}`);
  }

  const nodeId = `${nodeType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return {
    id: nodeId,
    type: 'custom',
    position,
    data: {
      label: nodeDefinition?.label || nodeType,
      type: nodeType,
      category: mapCategoryToNodeCategory(schema.category),
      icon: nodeDefinition?.icon || 'Box',
      config: { ...schema.defaultConfig },
    },
  };
}

/**
 * Maps validation category to node category
 */
function mapCategoryToNodeCategory(
  category: NodeSchema['category']
): 'triggers' | 'ai' | 'logic' | 'data' | 'output' {
  switch (category) {
    case 'triggers':
      return 'triggers';
    case 'source':
      return 'data';
    case 'logic':
      return 'logic';
    case 'action':
      return 'output';
    case 'destination':
      return 'output';
    default:
      return 'logic';
  }
}

/**
 * Gets placeholder value for a required property
 */
function getPlaceholderValue(property: string, nodeType: string): unknown {
  const placeholders: Record<string, unknown> = {
    url: '',
    webhookUrl: '',
    endpoint: '',
    method: 'GET',
    cron: '0 9 * * *',
    schedule: '0 9 * * *',
    table: '',
    query: '',
    code: 'return input;',
    condition: '',
    expression: '',
    template: '',
    message: '',
    to: '',
    from: '',
    subject: '',
    body: '',
    name: '',
    value: '',
    array: '',
    duration: 1000,
    timeout: 1000,
    interval: 60000,
    authentication: 'none',
    credentials: 'placeholder',
    triggerType: 'event',
    host: '',
    database: '',
    spreadsheetId: '',
    operation: 'read',
  };

  return placeholders[property] ?? '';
}

/**
 * Gets node schema by type and optional category
 */
export function getNodeSchema(nodeType: string, category?: NodeSchema['category']): NodeSchema | undefined {
  if (category) {
    return WORKFLOW_NODE_LIBRARY.find((s) => s.type === nodeType && s.category === category);
  }
  // Return first match if no category specified
  return WORKFLOW_NODE_LIBRARY.find((s) => s.type === nodeType);
}

/**
 * Gets all node schemas by category
 */
export function getNodeSchemasByCategory(
  category: NodeSchema['category']
): NodeSchema[] {
  return WORKFLOW_NODE_LIBRARY.filter((s) => s.category === category);
}

