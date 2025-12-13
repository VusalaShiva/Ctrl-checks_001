import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Zap, Plus, Play, Clock, CheckCircle, XCircle, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/signin");
    }
  }, [user, loading, navigate]);

  if (loading) {
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
            <div className="flex h-9 w-9 items-center justify-center">
              <img src="/favicon.ico" alt="logo" className="h-full w-full" />
            </div>
            <span className="text-xl font-bold">CtrlChecks</span>
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
            <h1 className="text-3xl font-bold">Welcome back!</h1>
            <p className="text-muted-foreground mt-1">Here's what's happening with your workflows</p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={() => navigate('/workflows')}
              className="hover:bg-accent hover:text-accent-foreground"
            >
              <FolderOpen className="mr-2 h-4 w-4" /> View Workflows
            </Button>
            <Button className="gradient-primary text-primary-foreground" onClick={() => navigate('/workflow/new')}>
              <Plus className="mr-2 h-4 w-4" /> New Workflow
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          {[
            { label: "Total Workflows", value: "0", icon: Zap, color: "text-primary" },
            { label: "Executions Today", value: "0", icon: Play, color: "text-secondary" },
            { label: "Success Rate", value: "100%", icon: CheckCircle, color: "text-success" },
            { label: "Failed", value: "0", icon: XCircle, color: "text-destructive" },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-6 mb-4">
              <Zap className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No workflows yet</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Create your first workflow to start automating your tasks with AI-powered intelligence.
            </p>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                onClick={() => navigate('/workflows')}
                className="hover:bg-accent hover:text-accent-foreground"
              >
                <FolderOpen className="mr-2 h-4 w-4" /> View All Workflows
              </Button>
              <Button className="gradient-primary text-primary-foreground" onClick={() => navigate('/workflow/new')}>
                <Plus className="mr-2 h-4 w-4" /> Create Your First Workflow
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
