import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // First, check if we have a valid session (even if there are error params)
        // Sometimes Supabase can authenticate successfully even with minor errors
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        // If we have a valid session, proceed to dashboard regardless of error params
        if (session && session.user) {
          // Clean up the URL
          if (window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname);
          } else if (window.location.search) {
            // Remove query parameters
            window.history.replaceState(null, '', window.location.pathname);
          }
          
          // Check for non-critical errors (like profile retrieval issues)
          const error = searchParams.get("error");
          const errorDescription = searchParams.get("error_description");
          
          if (error && error !== "server_error") {
            // Only show error for critical errors, not server_error which might be profile-related
            console.warn("OAuth warning:", error, errorDescription);
          }
          
          // Redirect to dashboard on success
          navigate("/dashboard");
          return;
        }

        // No valid session - check for errors
        const error = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");
        
        if (error) {
          console.error("OAuth error:", error, errorDescription);
          toast({
            title: "Authentication Failed",
            description: errorDescription || "An error occurred during Google authentication",
            variant: "destructive",
          });
          navigate("/signin");
          return;
        }

        // Check for hash fragments (Supabase OAuth success)
        if (window.location.hash) {
          // Wait a moment for Supabase to process the hash
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Check session again after processing
          const { data: { session: hashSession } } = await supabase.auth.getSession();
          
          if (hashSession && hashSession.user) {
            // Clean up the hash from URL
            window.history.replaceState(null, '', window.location.pathname);
            // Redirect to dashboard on success
            navigate("/dashboard");
          } else {
            // No session found, redirect to sign in
            navigate("/signin");
          }
        } else {
          // No hash fragments and no session, redirect to sign in
          navigate("/signin");
        }
      } catch (err) {
        console.error("OAuth callback error:", err);
        toast({
          title: "Authentication Error",
          description: "An unexpected error occurred during authentication",
          variant: "destructive",
        });
        navigate("/signin");
      }
    };

    handleCallback();
  }, [searchParams, navigate, toast]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <div className="mb-4 text-lg">Completing authentication...</div>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
      </div>
    </div>
  );
}

