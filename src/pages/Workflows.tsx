import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, Zap, MoreHorizontal, Play, Trash2, Copy, Clock, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';

type Workflow = Tables<'workflows'>;

export default function Workflows() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/signin');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadWorkflows();
    }
  }, [user]);

  const loadWorkflows = async () => {
    try {
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setWorkflows(data || []);
    } catch (error) {
      console.error('Error loading workflows:', error);
      toast({
        title: 'Error',
        description: 'Failed to load workflows',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteWorkflow = async (id: string) => {
    try {
      const { error } = await supabase.from('workflows').delete().eq('id', id);
      if (error) throw error;
      setWorkflows(workflows.filter((w) => w.id !== id));
      toast({
        title: 'Deleted',
        description: 'Workflow deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting workflow:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete workflow',
        variant: 'destructive',
      });
    }
  };

  const duplicateWorkflow = async (workflow: Workflow) => {
    try {
      const { data, error } = await supabase
        .from('workflows')
        .insert({
          name: `${workflow.name} (Copy)`,
          nodes: workflow.nodes,
          edges: workflow.edges,
          user_id: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setWorkflows([data, ...workflows]);
        toast({
          title: 'Duplicated',
          description: 'Workflow duplicated successfully',
        });
      }
    } catch (error) {
      console.error('Error duplicating workflow:', error);
      toast({
        title: 'Error',
        description: 'Failed to duplicate workflow',
        variant: 'destructive',
      });
    }
  };

  const filteredWorkflows = workflows.filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success/10 text-success border-success/20';
      case 'paused': return 'bg-warning/10 text-warning border-warning/20';
      case 'draft': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center">
                <img src="/favicon.ico" alt="logo" className="h-full w-full" />
              </div>
              <span className="text-xl font-bold">CtrlChecks</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Button variant="outline" size="sm" onClick={() => signOut()}>Sign Out</Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Workflows</h1>
            <p className="text-muted-foreground mt-1">Manage and run your automation workflows</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('/executions')}
            >
              <History className="mr-2 h-4 w-4" /> Executions
            </Button>
            <Button
              className="gradient-primary text-primary-foreground"
              onClick={() => navigate('/workflow/new')}
            >
              <Plus className="mr-2 h-4 w-4" /> New Workflow
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workflows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Workflows Grid */}
        {filteredWorkflows.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="rounded-full bg-muted p-6 mb-4">
                <Zap className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {search ? 'No workflows found' : 'No workflows yet'}
              </h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                {search
                  ? 'Try a different search term'
                  : 'Create your first workflow to start automating your tasks'}
              </p>
              {!search && (
                <Button
                  className="gradient-primary text-primary-foreground"
                  onClick={() => navigate('/workflow/new')}
                >
                  <Plus className="mr-2 h-4 w-4" /> Create Your First Workflow
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredWorkflows.map((workflow) => (
              <Card
                key={workflow.id}
                className="hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/workflow/${workflow.id}`)}
              >
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{workflow.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {workflow.description || 'No description'}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/workflow/${workflow.id}`); }}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); duplicateWorkflow(workflow); }}>
                        <Copy className="mr-2 h-4 w-4" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => { e.stopPropagation(); deleteWorkflow(workflow.id); }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={getStatusColor(workflow.status)}>
                      {workflow.status}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(workflow.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
