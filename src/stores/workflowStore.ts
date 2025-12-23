import { create } from 'zustand';
import {
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  Connection,
  addEdge,
} from '@xyflow/react';

export type NodeCategory = 'triggers' | 'ai' | 'logic' | 'data' | 'output';

export interface NodeData {
  label: string;
  type: string;
  category: NodeCategory;
  icon: string;
  config: Record<string, unknown>;
  [key: string]: unknown;
}

export type WorkflowNode = Node<NodeData>;

interface WorkflowState {
  nodes: WorkflowNode[];
  edges: Edge[];
  selectedNode: WorkflowNode | null;
  workflowId: string | null;
  workflowName: string;
  isDirty: boolean;
  
  // Actions
  setNodes: (nodes: WorkflowNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: WorkflowNode) => void;
  updateNodeConfig: (nodeId: string, config: Record<string, unknown>) => void;
  selectNode: (node: WorkflowNode | null) => void;
  deleteSelectedNode: () => void;
  setWorkflowId: (id: string | null) => void;
  setWorkflowName: (name: string) => void;
  setIsDirty: (dirty: boolean) => void;
  resetWorkflow: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNode: null,
  workflowId: null,
  workflowName: 'Untitled Workflow',
  isDirty: false,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  
  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes) as WorkflowNode[],
      isDirty: true,
    });
  },
  
  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
      isDirty: true,
    });
  },
  
  onConnect: (connection) => {
    set({
      edges: addEdge(connection, get().edges),
      isDirty: true,
    });
  },
  
  addNode: (node) => {
    set({
      nodes: [...get().nodes, node],
      isDirty: true,
    });
  },
  
  updateNodeConfig: (nodeId, config) => {
    const updatedNodes = get().nodes.map((node) =>
      node.id === nodeId
        ? { ...node, data: { ...node.data, config: { ...node.data.config, ...config } } }
        : node
    );
    const selectedNode = get().selectedNode;
    const updatedSelectedNode = selectedNode?.id === nodeId
      ? updatedNodes.find(n => n.id === nodeId) || null
      : selectedNode;
    
    set({
      nodes: updatedNodes,
      selectedNode: updatedSelectedNode,
      isDirty: true,
    });
  },
  
  selectNode: (node) => set({ selectedNode: node }),
  
  deleteSelectedNode: () => {
    const { selectedNode, nodes, edges } = get();
    if (!selectedNode) return;
    
    set({
      nodes: nodes.filter((n) => n.id !== selectedNode.id),
      edges: edges.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id),
      selectedNode: null,
      isDirty: true,
    });
  },
  
  setWorkflowId: (id) => set({ workflowId: id }),
  setWorkflowName: (name) => set({ workflowName: name, isDirty: true }),
  setIsDirty: (dirty) => set({ isDirty: dirty }),
  
  resetWorkflow: () => set({
    nodes: [],
    edges: [],
    selectedNode: null,
    workflowId: null,
    workflowName: 'Untitled Workflow',
    isDirty: false,
  }),
}));
