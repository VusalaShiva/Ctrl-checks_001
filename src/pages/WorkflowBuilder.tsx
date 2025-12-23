import { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useWorkflowStore, WorkflowNode } from '@/stores/workflowStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { NodeTypeDefinition } from '@/components/workflow/nodeTypes';
import WorkflowHeader from '@/components/workflow/WorkflowHeader';
import NodeLibrary from '@/components/workflow/NodeLibrary';
import WorkflowCanvas from '@/components/workflow/WorkflowCanvas';
import PropertiesPanel from '@/components/workflow/PropertiesPanel';
import ExecutionConsole from '@/components/workflow/ExecutionConsole';
import { Edge } from '@xyflow/react';
import { Json } from '@/integrations/supabase/types';
import { validateAndAutoCompleteWorkflow } from '@/lib/workflowValidator';
import { handleWorkflowError, validateBeforeExecution } from '@/lib/workflowErrorHandler';

export default function WorkflowBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [consoleExpanded, setConsoleExpanded] = useState(false);
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    setWorkflowId,
    setWorkflowName,
    setIsDirty,
    resetWorkflow,
  } = useWorkflowStore();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/signin');
    }
  }, [user, authLoading, navigate]);

  // Load workflow if editing - only reset for new workflows
  useEffect(() => {
    if (id && id !== 'new' && user) {
      loadWorkflow(id);
    } else if (id === 'new') {
      resetWorkflow();
    }
  }, [id, user]);

  const loadWorkflow = async (workflowId: string) => {
    try {
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', workflowId)
        .single();

      if (error) throw error;

      if (data) {
        setWorkflowId(data.id);
        setWorkflowName(data.name);
        
        // Validate and auto-complete workflow on load
        const loadedNodes = (data.nodes as unknown as WorkflowNode[]) || [];
        const loadedEdges = (data.edges as unknown as Edge[]) || [];
        const validated = validateAndAutoCompleteWorkflow(loadedNodes, loadedEdges);
        
        setNodes(validated.nodes);
        setEdges(validated.edges);
        setIsDirty(validated.workflowStatus === 'auto_fixed');
        
        // Show notification if workflow was auto-fixed
        if (validated.workflowStatus === 'auto_fixed') {
          const addedNodesMsg = validated.validationResult.addedNodes.length > 0
            ? `Added ${validated.validationResult.addedNodes.length} node(s). `
            : '';
          const fixedNodesMsg = validated.validationResult.fixedNodes.length > 0
            ? `Fixed ${validated.validationResult.fixedNodes.length} node(s). `
            : '';
          
          toast({
            title: 'Workflow Validated',
            description: `${addedNodesMsg}${fixedNodesMsg}Workflow has been auto-completed.`,
            variant: 'default',
          });
        }
      }
    } catch (error) {
      console.error('Error loading workflow:', error);
      
      // Auto-heal workflow on error
      try {
        const healed = handleWorkflowError(
          'Load workflow',
          { nodes: (data?.nodes as unknown as WorkflowNode[]) || [], edges: (data?.edges as unknown as Edge[]) || [] },
          error as Error
        );
        
        setNodes(healed.nodes);
        setEdges(healed.edges);
        setIsDirty(true);
        
        toast({
          title: 'Workflow Auto-Healed',
          description: `Fixed ${healed.fixes.length} issue(s). Workflow has been repaired.`,
          variant: 'default',
        });
      } catch (healError) {
        toast({
          title: 'Error',
          description: 'Failed to load and heal workflow',
          variant: 'destructive',
        });
      }
    }
  };

  const handleSave = useCallback(async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      // Validate and auto-complete workflow before saving
      const validated = validateAndAutoCompleteWorkflow(nodes, edges);

      // Update store with validated nodes and edges if auto-fixed
      if (validated.workflowStatus === 'auto_fixed') {
        setNodes(validated.nodes);
        setEdges(validated.edges);

        // Show notification about auto-fixes
        const addedNodesMsg = validated.validationResult.addedNodes.length > 0
          ? `Added ${validated.validationResult.addedNodes.length} node(s): ${validated.validationResult.addedNodes.join(', ')}. `
          : '';
        const fixedNodesMsg = validated.validationResult.fixedNodes.length > 0
          ? `Fixed ${validated.validationResult.fixedNodes.length} node(s). `
          : '';
        const warningsMsg = validated.validationResult.warnings.length > 0
          ? `Warnings: ${validated.validationResult.warnings.length}. `
          : '';

        toast({
          title: 'Workflow Auto-Fixed',
          description: `${addedNodesMsg}${fixedNodesMsg}${warningsMsg}Please review the changes.`,
          variant: 'default',
        });
      }

      // Show errors if validation failed
      if (validated.validationResult.errors.length > 0) {
        toast({
          title: 'Validation Errors',
          description: validated.validationResult.errors.join('. '),
          variant: 'destructive',
        });
      }

      const workflowData = {
        name: useWorkflowStore.getState().workflowName,
        nodes: validated.nodes as unknown as Json,
        edges: validated.edges as unknown as Json,
        user_id: user.id,
        updated_at: new Date().toISOString(),
        status: validated.workflowStatus === 'auto_fixed' ? 'auto_fixed' : 'draft',
      };

      const workflowId = useWorkflowStore.getState().workflowId;

      if (workflowId) {
        const { error } = await supabase
          .from('workflows')
          .update(workflowData)
          .eq('id', workflowId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('workflows')
          .insert(workflowData)
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setWorkflowId(data.id);
          navigate(`/workflow/${data.id}`, { replace: true });
        }
      }

      setIsDirty(false);
      toast({
        title: 'Saved',
        description: validated.workflowStatus === 'auto_fixed' 
          ? 'Workflow saved with auto-fixes applied'
          : 'Workflow saved successfully',
      });
    } catch (error) {
      console.error('Error saving workflow:', error);
      
      // Auto-heal workflow on error
      try {
        const healed = handleWorkflowError(
          useWorkflowStore.getState().workflowName,
          { nodes, edges },
          error as Error
        );
        
        setNodes(healed.nodes);
        setEdges(healed.edges);
        
        // Retry save with healed workflow
        const healedWorkflowData = {
          name: useWorkflowStore.getState().workflowName,
          nodes: healed.nodes as unknown as Json,
          edges: healed.edges as unknown as Json,
          user_id: user.id,
          updated_at: new Date().toISOString(),
          status: 'auto_fixed',
        };

        const workflowId = useWorkflowStore.getState().workflowId;
        if (workflowId) {
          await supabase
            .from('workflows')
            .update(healedWorkflowData)
            .eq('id', workflowId);
        } else {
          const { data: newData, error: insertError } = await supabase
            .from('workflows')
            .insert(healedWorkflowData)
            .select()
            .single();

          if (insertError) throw insertError;
          if (newData) {
            setWorkflowId(newData.id);
            navigate(`/workflow/${newData.id}`, { replace: true });
          }
        }

        setIsDirty(false);
        toast({
          title: 'Workflow Auto-Healed & Saved',
          description: `Fixed ${healed.fixes.length} issue(s) and saved successfully.`,
          variant: 'default',
        });
      } catch (healError) {
        toast({
          title: 'Error',
          description: 'Failed to save workflow',
          variant: 'destructive',
        });
      }
    } finally {
      setIsSaving(false);
    }
  }, [nodes, edges, user, navigate, setWorkflowId, setIsDirty, setNodes, setEdges]);

  const handleRun = useCallback(async () => {
    const workflowId = useWorkflowStore.getState().workflowId;
    
    if (nodes.length === 0) {
      toast({
        title: 'No nodes',
        description: 'Add some nodes to your workflow before running',
        variant: 'destructive',
      });
      return;
    }

    // Validate workflow before running
    const preValidation = validateBeforeExecution({ nodes, edges });
    
    if (!preValidation.valid) {
      // Auto-heal workflow
      const healed = handleWorkflowError(
        'Run workflow',
        { nodes, edges },
        preValidation.error || 'Workflow validation failed'
      );
      
      setNodes(healed.nodes);
      setEdges(healed.edges);
      
      toast({
        title: 'Workflow Auto-Healed',
        description: `Fixed ${healed.fixes.length} issue(s). Please save before running.`,
        variant: 'default',
      });
      return;
    }

    const validated = validateAndAutoCompleteWorkflow(nodes, edges);
    
    if (validated.validationResult.errors.length > 0) {
      // Auto-heal on validation errors
      const healed = handleWorkflowError(
        'Run workflow',
        { nodes, edges },
        validated.validationResult.errors.join('. ')
      );
      
      setNodes(healed.nodes);
      setEdges(healed.edges);
      
      toast({
        title: 'Workflow Auto-Healed',
        description: `Fixed ${healed.fixes.length} issue(s). Please save before running.`,
        variant: 'default',
      });
      return;
    }

    // Auto-fix if needed
    if (validated.workflowStatus === 'auto_fixed') {
      setNodes(validated.nodes);
      setEdges(validated.edges);
      toast({
        title: 'Workflow Auto-Fixed',
        description: 'Workflow has been auto-completed. Please save before running.',
        variant: 'default',
      });
      return;
    }

    if (!workflowId) {
      toast({
        title: 'Save required',
        description: 'Please save your workflow before running',
        variant: 'destructive',
      });
      return;
    }

    setIsRunning(true);
    // Expand console to show logs
    if (!consoleExpanded) {
      setConsoleExpanded(true);
    }
    
    toast({
      title: 'Running workflow',
      description: 'Execution started...',
    });

    try {
      const { data, error } = await supabase.functions.invoke('execute-workflow', {
        body: { workflowId, input: {} },
      });

      if (error) throw error;

      toast({
        title: data.status === 'success' ? 'Execution complete' : 'Execution failed',
        description: data.status === 'success' 
          ? `Completed in ${data.durationMs}ms` 
          : data.error || 'Unknown error',
        variant: data.status === 'success' ? 'default' : 'destructive',
      });

      // Don't navigate away - logs will show in console
      // The ExecutionConsole component will auto-update via realtime subscription
    } catch (error) {
      console.error('Execution error:', error);
      toast({
        title: 'Error',
        description: 'Failed to execute workflow',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  }, [nodes, consoleExpanded]);


  const onDragStart = useCallback((event: React.DragEvent, nodeType: NodeTypeDefinition) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeType));
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <WorkflowHeader
        onSave={handleSave}
        onRun={handleRun}
        isSaving={isSaving}
        isRunning={isRunning}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          <NodeLibrary onDragStart={onDragStart} />
          <WorkflowCanvas />
          <PropertiesPanel />
        </div>
        <ExecutionConsole 
          isExpanded={consoleExpanded} 
          onToggle={() => setConsoleExpanded(!consoleExpanded)} 
        />
      </div>
    </div>
  );
}
