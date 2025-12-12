import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkflowStore } from '@/stores/workflowStore';
import { 
  CheckCircle, XCircle, Loader2, Clock, ChevronDown, ChevronUp, 
  Terminal, RefreshCw, Trash2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Json } from '@/integrations/supabase/types';

interface Execution {
  id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  error: string | null;
  logs: Json | null;
  output: Json | null;
}

interface ExecutionConsoleProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export default function ExecutionConsole({ isExpanded, onToggle }: ExecutionConsoleProps) {
  const { workflowId } = useWorkflowStore();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(null);

  const loadExecutions = async () => {
    if (!workflowId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('executions')
        .select('id, status, started_at, finished_at, duration_ms, error, logs, output')
        .eq('workflow_id', workflowId)
        .order('started_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setExecutions(data || []);
      if (data && data.length > 0 && !selectedExecution) {
        setSelectedExecution(data[0]);
      }
    } catch (error) {
      console.error('Error loading executions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (workflowId && isExpanded) {
      loadExecutions();
    }
  }, [workflowId, isExpanded]);

  // Real-time subscription for live updates
  useEffect(() => {
    if (!workflowId) return;

    const channel = supabase
      .channel(`executions-${workflowId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'executions',
          filter: `workflow_id=eq.${workflowId}`
        },
        (payload) => {
          console.log('Realtime execution update:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newExecution = payload.new as Execution;
            setExecutions(prev => [newExecution, ...prev.slice(0, 9)]);
            setSelectedExecution(newExecution);
          } else if (payload.eventType === 'UPDATE') {
            const updatedExecution = payload.new as Execution;
            setExecutions(prev => 
              prev.map(exec => exec.id === updatedExecution.id ? updatedExecution : exec)
            );
            if (selectedExecution?.id === updatedExecution.id) {
              setSelectedExecution(updatedExecution);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workflowId, selectedExecution?.id]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-3 w-3 text-success" />;
      case 'failed': return <XCircle className="h-3 w-3 text-destructive" />;
      case 'running': return <Loader2 className="h-3 w-3 text-primary animate-spin" />;
      default: return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-success/10 text-success border-success/20';
      case 'failed': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'running': return 'bg-primary/10 text-primary border-primary/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatLogs = (logs: Json | null): string => {
    if (!logs) return 'No logs available';
    if (Array.isArray(logs)) {
      return logs.map((log, i) => `[${i + 1}] ${typeof log === 'object' ? JSON.stringify(log, null, 2) : log}`).join('\n');
    }
    return JSON.stringify(logs, null, 2);
  };

  return (
    <div className={cn(
      "border-t border-border bg-card transition-all duration-300",
      isExpanded ? "h-64" : "h-10"
    )}>
      {/* Console Header */}
      <div 
        className="h-10 px-4 flex items-center justify-between cursor-pointer hover:bg-muted/50"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Execution Console</span>
          {executions.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {executions.length} runs
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isExpanded && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={(e) => { e.stopPropagation(); loadExecutions(); }}
            >
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
            </Button>
          )}
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Console Content */}
      {isExpanded && (
        <div className="h-[calc(100%-40px)] flex">
          {/* Execution List */}
          <div className="w-64 border-r border-border">
            <ScrollArea className="h-full">
              {!workflowId ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  Save workflow to see executions
                </div>
              ) : executions.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  No executions yet
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {executions.map((exec) => (
                    <div
                      key={exec.id}
                      className={cn(
                        "p-2 rounded-md cursor-pointer text-xs transition-colors",
                        selectedExecution?.id === exec.id 
                          ? "bg-primary/10 border border-primary/20" 
                          : "hover:bg-muted"
                      )}
                      onClick={() => setSelectedExecution(exec)}
                    >
                      <div className="flex items-center gap-2">
                        {getStatusIcon(exec.status)}
                        <span className="font-mono">{exec.id.slice(0, 8)}...</span>
                      </div>
                      <div className="flex items-center justify-between mt-1 text-muted-foreground">
                        <span>{new Date(exec.started_at).toLocaleTimeString()}</span>
                        <span>{formatDuration(exec.duration_ms)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Execution Details */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              {selectedExecution ? (
                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={getStatusColor(selectedExecution.status)}>
                      {selectedExecution.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(selectedExecution.started_at).toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Duration: {formatDuration(selectedExecution.duration_ms)}
                    </span>
                  </div>

                  {selectedExecution.error && (
                    <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                      <div className="text-xs font-medium text-destructive mb-1">Error</div>
                      <pre className="text-xs text-destructive/80 whitespace-pre-wrap">
                        {selectedExecution.error}
                      </pre>
                    </div>
                  )}

                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-2">Logs</div>
                    <pre className="p-3 rounded-md bg-muted text-xs font-mono whitespace-pre-wrap">
                      {formatLogs(selectedExecution.logs)}
                    </pre>
                  </div>

                  {selectedExecution.output && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-2">Output</div>
                      <pre className="p-3 rounded-md bg-muted text-xs font-mono whitespace-pre-wrap">
                        {JSON.stringify(selectedExecution.output, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Select an execution to view details
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
}
