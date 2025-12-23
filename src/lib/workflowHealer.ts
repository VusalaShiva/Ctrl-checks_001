import { WorkflowNode, NodeData } from '@/stores/workflowStore';
import { Edge } from '@xyflow/react';
import { validateAndAutoCompleteWorkflow, WORKFLOW_NODE_LIBRARY, getNodeSchema } from './workflowValidator';
import { getNodeDefinition } from '@/components/workflow/nodeTypes';

// ============================================
// WORKFLOW HEALER - AUTO-REPAIR ENGINE
// ============================================

export interface HealedWorkflow {
  nodes: WorkflowNode[];
  edges: Edge[];
  status: 'AUTO_HEALED';
  fixes: string[];
  originalError: string;
}

export interface ErrorContext {
  userRequest?: string;
  brokenWorkflow?: {
    nodes: WorkflowNode[];
    edges: Edge[];
  };
  errorMessage: string;
}

/**
 * Main healing function - auto-repairs broken workflows
 */
export function healWorkflow(context: ErrorContext): HealedWorkflow {
  const fixes: string[] = [];
  let nodes: WorkflowNode[] = [];
  let edges: Edge[] = [];

  // Step 1: Parse and validate JSON
  try {
    if (context.brokenWorkflow) {
      nodes = Array.isArray(context.brokenWorkflow.nodes) 
        ? context.brokenWorkflow.nodes 
        : [];
      edges = Array.isArray(context.brokenWorkflow.edges) 
        ? context.brokenWorkflow.edges 
        : [];
    }
  } catch (error) {
    fixes.push('Fixed invalid JSON structure');
    nodes = [];
    edges = [];
  }

  // Step 2: Clean and validate nodes
  nodes = nodes.filter(node => node && node.id && node.data);
  nodes = nodes.map(node => cleanNode(node));

  // Step 3: Clean and validate edges
  edges = edges.filter(edge => {
    if (!edge || !edge.id || !edge.source || !edge.target) return false;
    const sourceExists = nodes.some(n => n.id === edge.source);
    const targetExists = nodes.some(n => n.id === edge.target);
    if (!sourceExists || !targetExists) {
      fixes.push(`Removed orphaned edge: ${edge.id}`);
      return false;
    }
    return true;
  });

  // Step 4: Ensure exactly ONE trigger node
  const triggerNodes = nodes.filter(n => n.data.category === 'triggers');
  if (triggerNodes.length === 0) {
    const trigger = createDefaultNode('manual_trigger', { x: 100, y: 100 });
    nodes.unshift(trigger);
    fixes.push('Added missing trigger node');
  } else if (triggerNodes.length > 1) {
    // Keep only the first trigger, remove others
    const firstTrigger = triggerNodes[0];
    const extraTriggers = triggerNodes.slice(1);
    nodes = nodes.filter(n => !extraTriggers.includes(n));
    edges = edges.filter(e => !extraTriggers.some(t => t.id === e.source || t.id === e.target));
    fixes.push(`Removed ${extraTriggers.length} duplicate trigger node(s), kept first`);
  }

  // Step 5: Ensure at least ONE destination node
  const destinationNodes = nodes.filter(n => {
    const schema = WORKFLOW_NODE_LIBRARY.find(s => 
      s.type === n.data.type && (s.category === 'destination' || s.category === 'action')
    );
    return schema !== undefined || n.data.category === 'output';
  });

  if (destinationNodes.length === 0) {
    const lastNode = nodes[nodes.length - 1];
    const position = lastNode 
      ? { x: lastNode.position.x + 350, y: lastNode.position.y }
      : { x: 400, y: 100 };
    const destination = createDefaultNode('log_output', position);
    nodes.push(destination);
    fixes.push('Added missing destination node');

    // Connect to last non-trigger node
    const nodeToConnect = nodes.find(n => n.id !== destination.id && n.data.category !== 'triggers') || nodes[0];
    if (nodeToConnect) {
      edges.push({
        id: `e_${nodeToConnect.id}_${destination.id}`,
        source: nodeToConnect.id,
        target: destination.id,
      });
      fixes.push('Connected destination node to workflow');
    }
  }

  // Step 6: Fix node properties
  nodes = nodes.map(node => {
    const schema = WORKFLOW_NODE_LIBRARY.find(s => s.type === node.data.type);
    if (!schema) {
      // Try to find alternative node type
      const alternative = findAlternativeNodeType(node.data.type);
      if (alternative) {
        fixes.push(`Replaced unsupported node type "${node.data.type}" with "${alternative}"`);
        return createDefaultNode(alternative, node.position);
      }
      return node;
    }

    // Fix missing required properties
    const config = node.data.config || {};
    const missingProps: string[] = [];
    schema.requiredProperties.forEach(prop => {
      if (config[prop] === undefined || config[prop] === '' || config[prop] === null) {
        missingProps.push(prop);
        config[prop] = schema.defaultConfig[prop] ?? getPlaceholderValue(prop, node.data.type);
      }
    });

    if (missingProps.length > 0) {
      fixes.push(`Fixed missing properties in "${node.data.label}": ${missingProps.join(', ')}`);
    }

    return {
      ...node,
      data: {
        ...node.data,
        config: { ...schema.defaultConfig, ...config },
      },
    };
  });

  // Step 7: Ensure all nodes are connected
  const connectedNodeIds = new Set<string>();
  edges.forEach(edge => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });

  const triggerNode = nodes.find(n => n.data.category === 'triggers');
  const isolatedNodes = nodes.filter(n => 
    !connectedNodeIds.has(n.id) && n.data.category !== 'triggers'
  );

  if (isolatedNodes.length > 0 && triggerNode) {
    isolatedNodes.forEach((isolatedNode, index) => {
      const prevNode = index === 0 
        ? triggerNode 
        : isolatedNodes[index - 1];
      
      if (prevNode) {
        edges.push({
          id: `e_${prevNode.id}_${isolatedNode.id}_${Date.now()}`,
          source: prevNode.id,
          target: isolatedNode.id,
        });
      }
    });
    fixes.push(`Connected ${isolatedNodes.length} isolated node(s)`);
  }

  // Step 8: Add stop_error node if missing
  const hasErrorHandler = nodes.some(n => 
    n.data.type === 'error_handler' || n.data.type === 'stop_error'
  );
  
  if (!hasErrorHandler) {
    const lastNode = nodes[nodes.length - 1];
    const position = lastNode
      ? { x: lastNode.position.x + 300, y: lastNode.position.y + 100 }
      : { x: 400, y: 200 };
    const errorHandler = createDefaultNode('error_handler', position);
    nodes.push(errorHandler);
    fixes.push('Added error handler node');
  }

  // Step 9: Recalculate positions for clean layout
  nodes = recalculatePositions(nodes, edges);

  // Step 10: Final validation
  const validated = validateAndAutoCompleteWorkflow(nodes, edges);
  if (validated.workflowStatus === 'auto_fixed') {
    fixes.push('Applied final validation fixes');
  }

  return {
    nodes: validated.nodes,
    edges: validated.edges,
    status: 'AUTO_HEALED',
    fixes,
    originalError: context.errorMessage,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function cleanNode(node: WorkflowNode): WorkflowNode {
  return {
    id: node.id || `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: node.type || 'custom',
    position: node.position || { x: 0, y: 0 },
    data: {
      label: node.data?.label || 'Unnamed Node',
      type: node.data?.type || 'manual_trigger',
      category: node.data?.category || 'triggers',
      icon: node.data?.icon || 'Box',
      config: node.data?.config || {},
    },
  };
}

function createDefaultNode(
  nodeType: string,
  position: { x: number; y: number }
): WorkflowNode {
  const schema = WORKFLOW_NODE_LIBRARY.find(s => s.type === nodeType);
  const nodeDefinition = getNodeDefinition(nodeType);

  if (!schema) {
    // Fallback to manual_trigger if node type not found
    return createDefaultNode('manual_trigger', position);
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

function mapCategoryToNodeCategory(
  category: 'triggers' | 'source' | 'logic' | 'action' | 'destination'
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

function findAlternativeNodeType(originalType: string): string | null {
  const alternatives: Record<string, string> = {
    'schedule_cron': 'schedule',
    'google_sheets_read': 'google_sheets',
    'google_sheets_create_row': 'google_sheets',
    'send_email': 'email_resend',
    'database_insert': 'database_write',
    'http_response': 'http_post',
    'email_destination': 'email_resend',
    'split_out_items': 'split_items',
    'code': 'javascript',
    'code_execution': 'javascript',
  };

  return alternatives[originalType] || null;
}

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
    errorMessage: 'An error occurred',
    statusCode: 200,
    storageType: 's3',
    path: '',
    notificationMessage: 'Workflow completed',
    projectKey: '',
    issueType: 'Task',
    crmType: 'salesforce',
    baseId: '',
    tableId: '',
    databaseId: '',
    delimiter: ',',
    fieldMappings: {},
    language: 'javascript',
  };

  return placeholders[property] ?? '';
}

function recalculatePositions(nodes: WorkflowNode[], edges: Edge[]): WorkflowNode[] {
  // Build execution graph
  const graph: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};
  
  nodes.forEach(node => {
    graph[node.id] = [];
    inDegree[node.id] = 0;
  });

  edges.forEach(edge => {
    if (graph[edge.source]) {
      graph[edge.source].push(edge.target);
      inDegree[edge.target] = (inDegree[edge.target] || 0) + 1;
    }
  });

  // Topological sort for execution order
  const queue: string[] = [];
  Object.entries(inDegree).forEach(([nodeId, degree]) => {
    if (degree === 0) queue.push(nodeId);
  });

  const executionOrder: string[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    executionOrder.push(nodeId);

    graph[nodeId].forEach(neighbor => {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    });
  }

  // Position nodes in layers
  const layerMap: Record<number, string[]> = {};
  const nodeLayer: Record<string, number> = {};
  
  executionOrder.forEach((nodeId, index) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Calculate layer based on longest path from trigger
    let layer = 0;
    edges.filter(e => e.target === nodeId).forEach(edge => {
      const sourceLayer = nodeLayer[edge.source] || 0;
      layer = Math.max(layer, sourceLayer + 1);
    });

    nodeLayer[nodeId] = layer;
    if (!layerMap[layer]) layerMap[layer] = [];
    layerMap[layer].push(nodeId);
  });

  // Assign positions
  const updatedNodes = nodes.map(node => {
    const layer = nodeLayer[node.id] || 0;
    const nodesInLayer = layerMap[layer] || [];
    const indexInLayer = nodesInLayer.indexOf(node.id);

    return {
      ...node,
      position: {
        x: 100 + layer * 350,
        y: 100 + indexInLayer * 120,
      },
    };
  });

  return updatedNodes;
}

/**
 * Quick heal function for common errors
 */
export function quickHeal(workflow: { nodes: WorkflowNode[]; edges: Edge[] }, error: string): HealedWorkflow {
  return healWorkflow({
    brokenWorkflow: workflow,
    errorMessage: error,
  });
}

