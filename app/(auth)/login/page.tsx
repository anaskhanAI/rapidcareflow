"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import OpusLogo from "@/components/OpusLogo";
import { Btn } from "@/components/ui";

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
    <div className="min-h-screen flex items-center justify-center bg-stage px-4">
      <div className="w-full max-w-sm animate-reveal">
        {/* Brand */}
        <div className="flex flex-col items-center mb-10 text-center">
          <OpusLogo className="w-8 text-accent mb-5" />
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-accent mb-2">
            RapidCareFlow
          </p>
          <h1 className="font-display font-medium text-[1.9rem] leading-[1.05] tracking-[-0.025em] text-ink">
            {mode === "login" ? (
              <>
                Sign in.{" "}
                <span className="text-ink-faint font-normal">
                  Welcome back.
                </span>
              </>
            ) : (
              <>
                Create account.{" "}
                <span className="text-ink-faint font-normal">
                  Start coding.
                </span>
              </>
            )}
          </h1>
          <p className="text-[13.5px] leading-[1.75] text-ink-dim mt-3">
            AI-powered clinical coding platform
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-line rounded-[8px] px-6 py-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-faint mb-2">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@hospital.com"
                className="w-full bg-raised border border-line-strong focus:border-accent rounded-[6px] px-4 py-2.5 text-[13.5px] text-ink placeholder:text-ink-faint outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-faint mb-2">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-raised border border-line-strong focus:border-accent rounded-[6px] px-4 py-2.5 text-[13.5px] text-ink placeholder:text-ink-faint outline-none transition-colors"
              />
            </div>

            {error && (
              <p className="text-[12px] leading-[1.6] text-bad bg-bad-soft border border-bad/20 rounded-[6px] px-3 py-2">
                {error}
              </p>
            )}
            {success && (
              <p className="text-[12px] leading-[1.6] text-ok bg-ok-soft border border-ok/20 rounded-[6px] px-3 py-2">
                {success}
              </p>
            )}

            <Btn
              type="submit"
              variant="primary"
              size="lg"
              disabled={loading}
              className="w-full mt-1"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {mode === "login" ? "Sign in" : "Create account"}
            </Btn>
          </form>

          <div className="mt-5 pt-5 border-t border-line text-center">
            <p className="text-[12px] text-ink-dim">
              {mode === "login"
                ? "Don't have an account?"
                : "Already have an account?"}{" "}
              <button
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setError(null);
                  setSuccess(null);
                }}
                className="text-accent hover:text-accent-hot transition-colors font-medium cursor-pointer"
              >
                {mode === "login" ? "Sign up" : "Sign in"}
              </button>
            </p>
          </div>
        </div>

        <p className="text-center font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint mt-6">
          Powered by <span className="text-accent">Opus AI Platform</span>
        </p>
      </div>
    </div>
  );
}
