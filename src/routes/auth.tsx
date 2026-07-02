import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, Mail, Github, Chrome, ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"signin" | "signup" | "magiclink">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && user) {
      navigate({ to: "/" });
    }
  }, [user, authLoading, navigate]);

  // Handle OAuth errors redirected back to the URL
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const queryParams = new URLSearchParams(window.location.search);

    const errorDescription =
      hashParams.get("error_description") || queryParams.get("error_description");
    const error = hashParams.get("error") || queryParams.get("error");

    if (errorDescription || error) {
      const message = errorDescription || error;
      toast.error(decodeURIComponent(message!).replace(/\+/g, " "));

      // Clean up the URL parameters so the toast doesn't reappear on reload
      const cleanUrl = window.location.pathname + window.location.search;
      window.history.replaceState(null, "", cleanUrl);
    }
  }, []);

  const validateForm = () => {
    let valid = true;
    setEmailError("");
    setPasswordError("");

    if (!email) {
      setEmailError("Email is required");
      valid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError("Please enter a valid email address");
      valid = false;
    }

    if (activeTab !== "magiclink") {
      if (!password) {
        setPasswordError("Password is required");
        valid = false;
      } else if (password.length < 6) {
        setPasswordError("Password must be at least 6 characters long");
        valid = false;
      }
    }

    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      if (activeTab === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Welcome back! Signed in successfully.");
        navigate({ to: "/" });
      } else if (activeTab === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Account created! Check your email to confirm your registration.");
      } else if (activeTab === "magiclink") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Magic link sent! Check your email inbox.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred during authentication.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: "github" | "google") => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || `Failed to sign in with ${provider}`);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading secure session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-background overflow-hidden px-4 md:px-6">
      {/* Premium ambient light effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[radial-gradient(circle,rgba(124,58,237,0.08)_0%,transparent_70%)] dark:bg-[radial-gradient(circle,rgba(124,58,237,0.15)_0%,transparent_70%)] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[radial-gradient(circle,rgba(6,182,212,0.08)_0%,transparent_70%)] dark:bg-[radial-gradient(circle,rgba(6,182,212,0.15)_0%,transparent_70%)] rounded-full blur-[120px] pointer-events-none" />

      {/* Decorative floating grids */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Main card wrapper */}
      <div className="w-full max-w-[440px] z-10 transition-all duration-300">
        {/* Top Actions */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Back to Home</span>
          </Link>
          <ThemeToggle />
        </div>

        {/* Auth Card */}
        <div className="backdrop-blur-xl bg-card/40 border border-border/60 shadow-2xl rounded-2xl p-6 md:p-8 relative overflow-hidden">
          {/* Card Top Border Light */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

          {/* Header */}
          <div className="text-center mb-6">
            <div className="mx-auto w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold mb-3 shadow-[0_0_15px_rgba(124,58,237,0.4)]">
              {"</>"}
            </div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              {activeTab === "signin"
                ? "Welcome back"
                : activeTab === "signup"
                  ? "Create an account"
                  : "Passwordless Login"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              {activeTab === "signin"
                ? "Enter your credentials to access your rooms"
                : activeTab === "signup"
                  ? "Sign up to track and access all your coding sessions"
                  : "Enter your email to receive a magic sign-in link"}
            </p>
          </div>

          {/* Custom Tabs */}
          <div className="flex p-1 bg-black/40 border border-border/40 rounded-lg mb-6">
            <button
              onClick={() => {
                setActiveTab("signin");
                setEmailError("");
                setPasswordError("");
              }}
              className={`flex-1 text-center py-2 text-xs md:text-sm font-medium rounded-md transition-all duration-200 ${
                activeTab === "signin"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setActiveTab("signup");
                setEmailError("");
                setPasswordError("");
              }}
              className={`flex-1 text-center py-2 text-xs md:text-sm font-medium rounded-md transition-all duration-200 ${
                activeTab === "signup"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign Up
            </button>
            <button
              onClick={() => {
                setActiveTab("magiclink");
                setEmailError("");
                setPasswordError("");
              }}
              className={`flex-1 text-center py-2 text-xs md:text-sm font-medium rounded-md transition-all duration-200 ${
                activeTab === "magiclink"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Magic Link
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground pointer-events-none">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError("");
                  }}
                  placeholder="you@example.com"
                  className={`w-full bg-black/40 border ${
                    emailError
                      ? "border-destructive/80 focus:ring-destructive/30"
                      : "border-border/60 focus:border-primary/80 focus:ring-primary/20"
                  } rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground outline-none transition-all focus:ring-2`}
                  disabled={loading}
                />
              </div>
              {emailError && (
                <p className="text-[11px] text-destructive font-medium mt-1">{emailError}</p>
              )}
            </div>

            {/* Password Field */}
            {activeTab !== "magiclink" && (
              <div className="space-y-1.5 transition-all duration-300 animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-medium text-slate-300">Password</label>
                  {activeTab === "signin" && (
                    <button
                      type="button"
                      onClick={() =>
                        toast.info(
                          "Password reset link will be sent to your email (needs SMTP config)",
                        )
                      }
                      className="text-[11px] text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordError) setPasswordError("");
                    }}
                    placeholder="••••••••"
                    className={`w-full bg-black/40 border ${
                      passwordError
                        ? "border-destructive/80 focus:ring-destructive/30"
                        : "border-border/60 focus:border-primary/80 focus:ring-primary/20"
                    } rounded-lg pl-10 pr-10 py-2.5 text-sm text-foreground outline-none transition-all focus:ring-2`}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-[11px] text-destructive font-medium mt-1">{passwordError}</p>
                )}
              </div>
            )}

            {/* Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-medium rounded-lg py-2.5 text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_20px_rgba(124,58,237,0.25)] hover:shadow-[0_4px_20px_rgba(124,58,237,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : activeTab === "signin" ? (
                "Sign In"
              ) : activeTab === "signup" ? (
                "Sign Up"
              ) : (
                "Send Magic Link"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/40"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#0b0820] px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          {/* Social Logins */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleOAuthLogin("github")}
              disabled={loading}
              className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-black/40 border border-border/60 hover:bg-accent/40 text-sm font-medium transition cursor-pointer"
            >
              <Github className="w-4 h-4" />
              <span>GitHub</span>
            </button>
            <button
              onClick={() => handleOAuthLogin("google")}
              disabled={loading}
              className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-black/40 border border-border/60 hover:bg-accent/40 text-sm font-medium transition cursor-pointer"
            >
              <Chrome className="w-4 h-4" />
              <span>Google</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
