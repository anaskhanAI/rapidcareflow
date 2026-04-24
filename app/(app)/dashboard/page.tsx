"use client";

import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Upload,
  FileText,
  X,
  Play,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import StreamingAudit from "@/components/StreamingAudit";
import ResultsPanel from "@/components/ResultsPanel";
import Link from "next/link";

type JobPhase = "idle" | "uploading" | "processing" | "done" | "error";

interface ActiveJob {
  jobExecutionId: string;
  filename: string;
  startedAt: number;
  status: "IN PROGRESS" | "COMPLETED" | "FAILED";
  outputs: null | {
    cptCodes: string[];
    icd10Codes: string[];
    emCodes: string[];
    hcpcsCodes: string[];
    modifiers: string[];
    reasoning: string;
    confidenceScore: number;
  };
}

export default function DashboardPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<JobPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [activeTab, setActiveTab] = useState<"audit" | "results">("audit");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleFileSelect = useCallback((f: File) => {
    if (f.type !== "application/pdf") {
      setError("Only PDF files are accepted.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("File must be under 10 MB.");
      return;
    }
    setError(null);
    setFile(f);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFileSelect(f);
    },
    [handleFileSelect]
  );

  const startPolling = (jobExecutionId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobExecutionId}/status`);
        const { status } = await res.json();

        if (status === "COMPLETED") {
          clearInterval(pollRef.current!);
          const resultsRes = await fetch(`/api/jobs/${jobExecutionId}/results`);
          const { results } = await resultsRes.json();
          setActiveJob((prev) =>
            prev ? { ...prev, status: "COMPLETED", outputs: results } : prev
          );
          setPhase("done");
          setActiveTab("results");
        } else if (status === "FAILED") {
          clearInterval(pollRef.current!);
          setActiveJob((prev) =>
            prev ? { ...prev, status: "FAILED" } : prev
          );
          setPhase("error");
          setError("The workflow encountered an error. Please try again.");
        }
      } catch {
        // ignore transient errors
      }
    }, 5000);
  };

  async function handleRunJob() {
    if (!file) return;
    setError(null);
    setActiveJob(null);
    setActiveTab("audit");

    try {
      setPhase("uploading");
      const supabase = createClient();

      // Step 1: Upload PDF directly to Supabase Storage from the browser
      // Supabase has proper CORS headers — no 413 issue since it's not going through Vercel
      const storagePath = `uploads/${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("job-uploads")
        .upload(storagePath, file, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

      // Step 2: Generate a short-lived signed URL (10 min — enough for our server to fetch it)
      const { data: signedData, error: signedError } = await supabase.storage
        .from("job-uploads")
        .createSignedUrl(uploadData.path, 600);
      if (signedError || !signedData?.signedUrl) {
        throw new Error("Failed to create signed download URL");
      }

      // Step 3: Pass the signed URL to our server — server downloads and streams to Opus, no size limit
      setPhase("processing");
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedUrl: signedData.signedUrl, filename: file.name }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start job");
      }

      const { jobExecutionId, filename } = await res.json();
      const job: ActiveJob = {
        jobExecutionId,
        filename,
        startedAt: Date.now(),
        status: "IN PROGRESS",
        outputs: null,
      };
      setActiveJob(job);
      startPolling(jobExecutionId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      setPhase("error");
    }
  }

  function handleNewJob() {
    setFile(null);
    setPhase("idle");
    setError(null);
  }

  const isRunning = phase === "processing" || phase === "uploading";
  const isDone = phase === "done";

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Hero */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-primary uppercase tracking-widest">
            AI Medical Coding
          </span>
        </div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight mb-2">
          Clinical Code Extraction
        </h1>
        <p className="text-muted-foreground max-w-xl">
          Upload a scanned clinical PDF and our AI agents will validate CPT,
          ICD-10, HCPCS, E&M codes and Modifiers in seconds.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2 mt-4">
          {[
            { icon: ShieldCheck, label: "HIPAA-aware processing" },
            { icon: Zap, label: "Multi-agent validation" },
            { icon: ArrowRight, label: "Full audit trail" },
          ].map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="flex items-center gap-1.5 text-xs text-muted-foreground bg-surface border border-border px-3 py-1 rounded-full"
            >
              <Icon className="w-3 h-3 text-primary" />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — Upload + controls */}
        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-foreground mb-4">
              Upload Clinical Document
            </h2>

            {/* Drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => !file && fileInputRef.current?.click()}
              className={cn(
                "relative border-2 border-dashed rounded-xl transition-all duration-200 flex flex-col items-center justify-center text-center",
                file ? "p-4 cursor-default" : "p-12 cursor-pointer",
                dragging
                  ? "border-primary bg-primary/5"
                  : file
                  ? "border-border bg-surface-2"
                  : "border-border hover:border-primary/50 hover:bg-surface-2/50"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
              />

              {!file ? (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                    <Upload className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">
                    Drop your PDF here
                  </p>
                  <p className="text-xs text-muted-foreground">
                    or click to browse — max 10 MB
                  </p>
                  <p className="text-xs text-muted mt-2">
                    Supported: Clinical notes, discharge summaries, op reports
                  </p>
                </>
              ) : (
                <div className="flex items-center gap-3 w-full">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-foreground truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(file.size / 1024 / 1024).toFixed(2)} MB · PDF
                    </p>
                  </div>
                  {phase === "idle" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      className="text-muted hover:text-danger transition-colors p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {error && (
              <p className="mt-3 text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleRunJob}
                disabled={!file || isRunning || isDone}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all",
                  file && !isRunning && phase !== "done" && phase !== "error"
                    ? "bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/20"
                    : "bg-surface-2 text-muted cursor-not-allowed border border-border"
                )}
              >
                <Play className="w-4 h-4" />
                {isRunning ? "Running..." : "Run Coding Job"}
              </button>

              {(phase === "done" || phase === "error") && (
                <button
                  onClick={handleNewJob}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-border text-muted-foreground hover:text-foreground hover:border-border-bright transition-colors"
                >
                  New Job
                </button>
              )}
            </div>
          </div>

          {/* Info card */}
          <div className="bg-surface border border-border rounded-2xl p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              What gets extracted
            </p>
            <div className="space-y-2">
              {[
                { label: "CPT Codes", desc: "Procedure codes" },
                { label: "ICD-10 Codes", desc: "Diagnosis codes" },
                { label: "E&M Codes", desc: "Evaluation & management" },
                { label: "HCPCS Codes", desc: "Supplies & services" },
                { label: "Modifiers", desc: "Procedure modifications" },
              ].map(({ label, desc }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground-dim">
                    {label}
                  </span>
                  <span className="text-xs text-muted">{desc}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-border">
              <Link
                href="/jobs"
                className="flex items-center gap-1.5 text-xs text-primary hover:text-accent transition-colors font-medium"
              >
                View all job history
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Right — Audit stream + results */}
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          {!activeJob ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-center p-8">
              <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-border flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-muted" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                No active job
              </p>
              <p className="text-xs text-muted max-w-xs">
                Upload a PDF and click "Run Coding Job" to see live processing
                here.
              </p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate">
                    {activeJob.filename}
                  </span>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border px-5">
                <button
                  onClick={() => setActiveTab("audit")}
                  className={cn(
                    "text-xs font-medium py-2.5 px-3 border-b-2 transition-colors -mb-px",
                    activeTab === "audit"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  Live Audit
                </button>
                {activeJob.status === "COMPLETED" && (
                  <button
                    onClick={() => setActiveTab("results")}
                    className={cn(
                      "text-xs font-medium py-2.5 px-3 border-b-2 transition-colors -mb-px",
                      activeTab === "results"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Results
                  </button>
                )}
              </div>

              <div className="p-5">
                {activeTab === "audit" && (
                  <StreamingAudit
                    jobExecutionId={activeJob.jobExecutionId}
                    status={activeJob.status}
                    startedAt={activeJob.startedAt}
                  />
                )}
                {activeTab === "results" && activeJob.outputs && (
                  <ResultsPanel outputs={activeJob.outputs} />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
