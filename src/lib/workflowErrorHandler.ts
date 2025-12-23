import { WorkflowNode } from '@/stores/workflowStore';
import { Edge } from '@xyflow/react';
import { healWorkflow, HealedWorkflow } from './workflowHealer';

// ============================================
// WORKFLOW ERROR HANDLER
// ============================================

export interface WorkflowError {
  type: 'json' | 'schema' | 'nodes' | 'edges' | 'properties' | 'execution' | 'unknown';
  message: string;
  details?: unknown;
}

/**
 * Detects and handles workflow errors automatically
 */
export function handleWorkflowError(
  userRequest: string,
  workflow: { nodes: WorkflowNode[]; edges: Edge[] },
  error: Error | string
): HealedWorkflow {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorType = detectErrorType(errorMessage);

  const healed = healWorkflow({
    userRequest,
    brokenWorkflow: workflow,
    errorMessage,
  });

  return healed;
}

/**
 * Detects error type from error message
 */
function detectErrorType(errorMessage: string): WorkflowError['type'] {
  const lowerMessage = errorMessage.toLowerCase();

  if (lowerMessage.includes('json') || lowerMessage.includes('parse')) {
    return 'json';
  }
  if (lowerMessage.includes('schema') || lowerMessage.includes('validation')) {
    return 'schema';
  }
  if (lowerMessage.includes('node') && (lowerMessage.includes('missing') || lowerMessage.includes('invalid'))) {
    return 'nodes';
  }
  if (lowerMessage.includes('edge') || lowerMessage.includes('connect')) {
    return 'edges';
  }
  if (lowerMessage.includes('property') || lowerMessage.includes('config') || lowerMessage.includes('required')) {
    return 'properties';
  }
  if (lowerMessage.includes('execution') || lowerMessage.includes('execute')) {
    return 'execution';
  }

  return 'unknown';
}

/**
 * Validates workflow before execution
 */
export function validateBeforeExecution(workflow: {
  nodes: WorkflowNode[];
  edges: Edge[];
}): { valid: boolean; error?: string } {
  // Check for trigger
  const triggers = workflow.nodes.filter(n => n.data.category === 'triggers');
  if (triggers.length === 0) {
    return { valid: false, error: 'Missing required trigger node' };
  }
  if (triggers.length > 1) {
    return { valid: false, error: 'Multiple trigger nodes found, only one allowed' };
  }

  // Check for destination
  const destinations = workflow.nodes.filter(n => {
    return n.data.category === 'output' || 
           ['log_output', 'http_post', 'email_resend', 'database_write'].includes(n.data.type);
  });
  if (destinations.length === 0) {
    return { valid: false, error: 'Missing required destination node' };
  }

  // Check node connectivity
  const connectedIds = new Set<string>();
  workflow.edges.forEach(e => {
    connectedIds.add(e.source);
    connectedIds.add(e.target);
  });

  const isolated = workflow.nodes.filter(n => 
    !connectedIds.has(n.id) && n.data.category !== 'triggers'
  );
  if (isolated.length > 0) {
    return { valid: false, error: `Found ${isolated.length} isolated node(s)` };
  }

  return { valid: true };
}

