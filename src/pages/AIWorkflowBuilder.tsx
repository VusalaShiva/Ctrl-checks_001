import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useWorkflowStore, WorkflowNode } from '@/stores/workflowStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, ArrowLeft, Loader2, Wand2 } from 'lucide-react';
import { NODE_TYPES, NodeTypeDefinition } from '@/components/workflow/nodeTypes';
import { Edge } from '@xyflow/react';

export default function AIWorkflowBuilder() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { setNodes, setEdges, setWorkflowName, setWorkflowId, resetWorkflow } = useWorkflowStore();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/signin');
    }
  }, [user, authLoading, navigate]);

  const generateWorkflow = async () => {
    if (!prompt.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a workflow description',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      // Get the current session to include auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      // Call Supabase edge function to generate workflow
      // Use direct fetch to get better error messages
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const functionUrl = `${supabaseUrl}/functions/v1/generate-workflow`;
      
      let response: Response;
      let responseData: any;
      
      try {
        response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': session ? `Bearer ${session.access_token}` : '',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
          },
          body: JSON.stringify({ prompt: prompt.trim() }),
        });

        // Parse response body
        const responseText = await response.text();
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { error: responseText || 'Invalid response from server' };
        }

        // Check for error status
        if (!response.ok) {
          const errorMessage = responseData?.error || responseData?.message || `Server error: ${response.status}`;
          console.error('Function error response:', {
            status: response.status,
            statusText: response.statusText,
            body: responseData,
          });
          throw new Error(errorMessage);
        }

        // Check if response contains error even with 200 status
        if (responseData?.error) {
          throw new Error(typeof responseData.error === 'string' 
            ? responseData.error 
            : responseData.error.message || 'Unknown error');
        }
      } catch (fetchError: any) {
        console.error('Function call failed:', fetchError);
        
        // If it's already an Error with a message, use it
        if (fetchError instanceof Error && fetchError.message) {
          throw fetchError;
        }
        
        // Otherwise create a meaningful error
        throw new Error(fetchError?.message || 'Failed to generate workflow. Please check your connection and try again.');
      }
      
      const data = responseData;

      if (data && data.nodes && data.edges) {
        // Reset workflow first
        resetWorkflow();

        // Set workflow name from AI or use default
        const workflowName = data.name || `AI Generated: ${prompt.substring(0, 50)}`;
        setWorkflowName(workflowName);

        // Convert AI response to workflow nodes and edges
        const nodes: WorkflowNode[] = data.nodes.map((nodeData: any, index: number) => {
          const nodeType = NODE_TYPES.find(nt => nt.type === nodeData.type);
          if (!nodeType) {
            throw new Error(`Unknown node type: ${nodeData.type}`);
          }

          return {
            id: nodeData.id || `${nodeData.type}_${Date.now()}_${index}`,
            type: 'custom',
            position: nodeData.position || { x: 250 + (index % 3) * 300, y: 100 + Math.floor(index / 3) * 150 },
            data: {
              label: nodeType.label,
              type: nodeData.type,
              category: nodeType.category,
              icon: nodeType.icon,
              config: { ...nodeType.defaultConfig, ...(nodeData.config || {}) },
            },
          };
        });

        const edges: Edge[] = data.edges.map((edgeData: any) => ({
          id: edgeData.id || `edge_${edgeData.source}_${edgeData.target}`,
          source: edgeData.source,
          target: edgeData.target,
          type: 'smoothstep',
        }));

        // Create workflow in database first
        const workflowData = {
          name: workflowName,
          nodes: nodes as unknown as any,
          edges: edges as unknown as any,
          user_id: user?.id,
          updated_at: new Date().toISOString(),
        };

        const { data: workflow, error: createError } = await supabase
          .from('workflows')
          .insert(workflowData)
          .select()
          .single();

        if (createError) throw createError;

        // Set workflow ID and data in store AFTER creation
        // This ensures the workflow is available when navigating
        setWorkflowId(workflow.id);
        setNodes(nodes);
        setEdges(edges);
        setWorkflowName(workflowName);

        toast({
          title: 'Success',
          description: 'Workflow generated successfully!',
        });

        // Navigate to the workflow builder - it will load the workflow from the store
        navigate(`/workflow/${workflow.id}`, { replace: true });
      } else {
        throw new Error('Invalid response from AI service');
      }
    } catch (error: any) {
      console.error('Error generating workflow:', error);
      
      // Extract error message from various error types
      let errorMessage = 'Failed to generate workflow. Please try again.';
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.error?.message) {
        errorMessage = error.error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      // Check for specific error types
      if (errorMessage.includes('GEMINI_API_KEY')) {
        errorMessage = 'Gemini API key is not configured. Please contact support.';
      } else if (errorMessage.includes('Failed to generate workflow with AI')) {
        errorMessage = 'AI service error. Please check your API key configuration.';
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Blurred Background */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md" />
      
      {/* Content */}
      <div className="relative z-10 w-full max-w-3xl px-4 py-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/workflows')}
          className="mb-4"
          size="sm"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        <Card className="mb-4">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl font-semibold">AI Workflow Generator</CardTitle>
                <CardDescription className="text-sm mt-0.5">
                  Describe your workflow and let AI create it automatically
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt" className="text-sm font-medium">Workflow Description</Label>
              <Textarea
                id="prompt"
                placeholder="Example: Create a workflow that receives a webhook, processes the data with GPT-4, and sends an email notification..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                className="resize-none text-sm"
                disabled={isGenerating}
              />
              <p className="text-xs text-muted-foreground">
                Be specific about triggers, processing steps, and outputs
              </p>
            </div>

            <Button
              onClick={generateWorkflow}
              disabled={isGenerating || !prompt.trim()}
              className="w-full gradient-primary text-primary-foreground"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Workflow...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Generate Workflow
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Tips for Best Results</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Specify the trigger type (webhook, schedule, manual, etc.)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Describe the data processing steps (AI models, transformations, etc.)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Mention the output actions (email, HTTP POST, Slack, etc.)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Include any conditional logic or branching requirements</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

