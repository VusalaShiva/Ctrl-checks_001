import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    type: string;
    category: string;
    icon: string;
    config: Record<string, unknown>;
  };
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

interface HealRequest {
  userRequest?: string;
  brokenWorkflow?: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  };
  errorMessage: string;
  workflowId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userRequest, brokenWorkflow, errorMessage, workflowId }: HealRequest = await req.json();

    if (!errorMessage) {
      return new Response(
        JSON.stringify({ error: "errorMessage is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If workflowId provided, fetch workflow
    let workflow = brokenWorkflow;
    if (workflowId && !workflow) {
      const { data, error } = await supabase
        .from("workflows")
        .select("nodes, edges")
        .eq("id", workflowId)
        .single();

      if (error) throw error;
      workflow = {
        nodes: (data.nodes as unknown as WorkflowNode[]) || [],
        edges: (data.edges as unknown as WorkflowEdge[]) || [],
      };
    }

    // Heal workflow (simplified version - in production, use full healer logic)
    const healed = await healWorkflowLogic(workflow || { nodes: [], edges: [] }, errorMessage);

    // If workflowId provided, save healed workflow
    if (workflowId) {
      const { error: updateError } = await supabase
        .from("workflows")
        .update({
          nodes: healed.nodes,
          edges: healed.edges,
          status: "auto_fixed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", workflowId);

      if (updateError) {
        console.error("Error updating workflow:", updateError);
      }
    }

    return new Response(
      JSON.stringify({
        status: "AUTO_HEALED",
        nodes: healed.nodes,
        edges: healed.edges,
        fixes: healed.fixes,
        originalError: errorMessage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Heal workflow error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function healWorkflowLogic(
  workflow: { nodes: WorkflowNode[]; edges: WorkflowEdge[] },
  errorMessage: string
): Promise<{ nodes: WorkflowNode[]; edges: WorkflowEdge[]; fixes: string[] }> {
  const fixes: string[] = [];
  let nodes = workflow.nodes || [];
  let edges = workflow.edges || [];

  // Clean nodes
  nodes = nodes.filter(n => n && n.id && n.data);
  edges = edges.filter(e => {
    if (!e || !e.id || !e.source || !e.target) return false;
    return nodes.some(n => n.id === e.source) && nodes.some(n => n.id === e.target);
  });

  // Ensure trigger
  const triggers = nodes.filter(n => n.data.category === "triggers");
  if (triggers.length === 0) {
    nodes.unshift({
      id: `manual_trigger_${Date.now()}`,
      type: "custom",
      position: { x: 100, y: 100 },
      data: {
        label: "Manual Trigger",
        type: "manual_trigger",
        category: "triggers",
        icon: "Play",
        config: {},
      },
    });
    fixes.push("Added missing trigger node");
  } else if (triggers.length > 1) {
    const firstTrigger = triggers[0];
    nodes = nodes.filter(n => n.id === firstTrigger.id || n.data.category !== "triggers");
    edges = edges.filter(e => {
      const sourceNode = nodes.find(n => n.id === e.source);
      const targetNode = nodes.find(n => n.id === e.target);
      return sourceNode && targetNode;
    });
    fixes.push(`Removed ${triggers.length - 1} duplicate trigger node(s)`);
  }

  // Ensure destination
  const destinations = nodes.filter(n => 
    n.data.category === "output" || 
    ["log_output", "http_post", "email_resend"].includes(n.data.type)
  );
  if (destinations.length === 0) {
    const lastNode = nodes[nodes.length - 1];
    const position = lastNode 
      ? { x: lastNode.position.x + 350, y: lastNode.position.y }
      : { x: 400, y: 100 };
    
    nodes.push({
      id: `log_output_${Date.now()}`,
      type: "custom",
      position,
      data: {
        label: "Log Output",
        type: "log_output",
        category: "output",
        icon: "FileOutput",
        config: { message: "Workflow completed", level: "info" },
      },
    });
    fixes.push("Added missing destination node");

    const nodeToConnect = nodes.find(n => n.id !== `log_output_${Date.now()}` && n.data.category !== "triggers") || nodes[0];
    if (nodeToConnect) {
      edges.push({
        id: `e_${nodeToConnect.id}_log_output_${Date.now()}`,
        source: nodeToConnect.id,
        target: `log_output_${Date.now()}`,
      });
    }
  }

  // Fix node properties
  nodes = nodes.map(node => {
    const config = node.data.config || {};
    if (!config.message && node.data.type === "log_output") {
      config.message = "Workflow completed";
      config.level = "info";
      fixes.push(`Fixed missing properties in "${node.data.label}"`);
    }
    return {
      ...node,
      data: { ...node.data, config },
    };
  });

  // Connect isolated nodes
  const connectedIds = new Set<string>();
  edges.forEach(e => {
    connectedIds.add(e.source);
    connectedIds.add(e.target);
  });

  const triggerNode = nodes.find(n => n.data.category === "triggers");
  const isolated = nodes.filter(n => !connectedIds.has(n.id) && n.data.category !== "triggers");
  
  if (isolated.length > 0 && triggerNode) {
    isolated.forEach((isolatedNode, index) => {
      const prevNode = index === 0 ? triggerNode : isolated[index - 1];
      if (prevNode) {
        edges.push({
          id: `e_${prevNode.id}_${isolatedNode.id}_${Date.now()}`,
          source: prevNode.id,
          target: isolatedNode.id,
        });
      }
    });
    fixes.push(`Connected ${isolated.length} isolated node(s)`);
  }

  return { nodes, edges, fixes };
}

