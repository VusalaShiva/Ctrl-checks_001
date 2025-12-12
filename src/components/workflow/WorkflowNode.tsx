import { memo } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { NodeData } from '@/stores/workflowStore';
import { NODE_CATEGORIES } from './nodeTypes';
import { 
  Play, Webhook, Clock, Globe, Brain, Sparkles, Gem, Link, GitBranch, 
  GitMerge, Repeat, Timer, ShieldAlert, Code, Braces, Table, Type, 
  Combine, Send, Mail, MessageSquare, Database, Box 
} from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Play, Webhook, Clock, Globe, Brain, Sparkles, Gem, Link, GitBranch,
  GitMerge, Repeat, Timer, ShieldAlert, Code, Braces, Table, Type,
  Combine, Send, Mail, MessageSquare, Database, Box
};

type WorkflowNodeProps = Node<NodeData>;

const WorkflowNode = memo(({ data, selected }: NodeProps<WorkflowNodeProps>) => {
  const category = NODE_CATEGORIES.find((c) => c.id === data.category);
  const IconComponent = iconMap[data.icon] || Box;

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-lg border-2 bg-card shadow-md min-w-[180px] transition-all',
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-muted-foreground/50'
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
      />
      
      <div className="flex items-center gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-md"
          style={{ backgroundColor: category?.color + '20', color: category?.color }}
        >
          <IconComponent className="h-4 w-4" />
        </div>
        <div>
          <div className="font-medium text-sm">{data.label}</div>
          <div className="text-xs text-muted-foreground capitalize">{data.category}</div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
      />
    </div>
  );
});

WorkflowNode.displayName = 'WorkflowNode';

export default WorkflowNode;
