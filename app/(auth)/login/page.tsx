"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, FileHeart, Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setSuccess(
          "Account created! Check your email to confirm, then sign in."
        );
        setMode("login");
      }
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-gradient-mesh px-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <FileHeart className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            RapidCareFlow
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-powered medical coding platform
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-foreground mb-1">
            {mode === "login" ? "Sign in" : "Create account"}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "login"
              ? "Welcome back. Enter your credentials to continue."
              : "Set up your access to start coding."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@hospital.com"
                  className="w-full bg-surface-2 border border-border text-foreground placeholder:text-muted rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-surface-2 border border-border text-foreground placeholder:text-muted rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {success && (
              <p className="text-xs text-success bg-success/10 border border-success/20 rounded-lg px-3 py-2">
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm mt-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-border text-center">
            <p className="text-xs text-muted-foreground">
              {mode === "login"
                ? "Don't have an account?"
                : "Already have an account?"}{" "}
              <button
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setError(null);
                  setSuccess(null);
                }}
                className="text-primary hover:text-accent transition-colors font-medium"
              >
                {mode === "login" ? "Sign up" : "Sign in"}
              </button>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted mt-6">
          Powered by{" "}
          <span className="text-primary font-medium">Opus AI Platform</span>
        </p>
      </div>
    </div>
  );
}
