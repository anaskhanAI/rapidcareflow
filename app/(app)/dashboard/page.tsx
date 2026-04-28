"use client";

import { useCallback, useRef, useState } from "react";
import {
  Upload, FileText, X, Play, Plus, Sparkles, ShieldCheck, Zap, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import StreamingAudit from "@/components/StreamingAudit";
import ResultsPanel from "@/components/ResultsPanel";
import Link from "next/link";

interface JobOutputs {
  cptCodes: string[];
  icd10Codes: string[];
  emCodes: string[];
  hcpcsCodes: string[];
  modifiers: string[];
  reasoning: string;
  confidenceScore: number;
}

interface ActiveJob {
  jobExecutionId: string;
  filename: string;
  startedAt: number;
  status: "IN PROGRESS" | "COMPLETED" | "FAILED";
  outputs: JobOutputs | null;
  activeTab: "audit" | "results";
}

type UploadPhase = "idle" | "uploading" | "starting" | "error";

export default function DashboardPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);

  // All active/completed jobs on this session
  const [jobs, setJobs] = useState<ActiveJob[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Map of jobExecutionId → polling interval
  const pollRefs = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const selectedJob = jobs.find(j => j.jobExecutionId === selectedId) ?? null;

  const handleFileSelect = useCallback((f: File) => {
    if (f.type !== "application/pdf") {
      setUploadError("Only PDF files are accepted.");
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setUploadError("File must be under 50 MB.");
      return;
    }
    setUploadError(null);
    setFile(f);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }, [handleFileSelect]);

  function startPolling(jobExecutionId: string) {
    if (pollRefs.current.has(jobExecutionId)) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobExecutionId}/status`);
        const { status } = await res.json();
        if (status === "COMPLETED") {
          clearInterval(interval);
          pollRefs.current.delete(jobExecutionId);
          const resultsRes = await fetch(`/api/jobs/${jobExecutionId}/results`);
          const { results } = await resultsRes.json();
          setJobs(prev => prev.map(j =>
            j.jobExecutionId === jobExecutionId
              ? { ...j, status: "COMPLETED", outputs: results, activeTab: "results" }
              : j
          ));
        } else if (status === "FAILED") {
          clearInterval(interval);
          pollRefs.current.delete(jobExecutionId);
          setJobs(prev => prev.map(j =>
            j.jobExecutionId === jobExecutionId
              ? { ...j, status: "FAILED" }
              : j
          ));
        }
      } catch { /* ignore transient errors */ }
    }, 5000);
    pollRefs.current.set(jobExecutionId, interval);
  }

  async function handleRunJob() {
    if (!file) return;
    setUploadError(null);

    try {
      setUploadPhase("uploading");
      const supabase = createClient();

      // Upload PDF to Supabase Storage
      const storagePath = `uploads/${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
      const { data: uploadData, error: storageErr } = await supabase.storage
        .from("job-uploads")
        .upload(storagePath, file, { contentType: "application/pdf", upsert: false });
      if (storageErr) throw new Error(`Storage upload failed: ${storageErr.message}`);

      // Generate short-lived signed URL for our server to fetch
      const { data: signedData, error: signedErr } = await supabase.storage
        .from("job-uploads")
        .createSignedUrl(uploadData.path, 600);
      if (signedErr || !signedData?.signedUrl) throw new Error("Failed to create signed URL");

      // Trigger the Opus job — server streams file to Opus then initiates workflow
      setUploadPhase("starting");
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedUrl: signedData.signedUrl, filename: file.name }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to start job");
      }

      const { jobExecutionId, filename } = await res.json();
      const newJob: ActiveJob = {
        jobExecutionId,
        filename,
        startedAt: Date.now(),
        status: "IN PROGRESS",
        outputs: null,
        activeTab: "audit",
      };

      setJobs(prev => [...prev, newJob]);
      setSelectedId(jobExecutionId);
      startPolling(jobExecutionId);

      // Reset upload area for the next job
      setFile(null);
      setUploadPhase("idle");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setUploadError(message);
      setUploadPhase("error");
    }
  }

  function setJobTab(jobExecutionId: string, tab: "audit" | "results") {
    setJobs(prev => prev.map(j =>
      j.jobExecutionId === jobExecutionId ? { ...j, activeTab: tab } : j
    ));
  }

  const isUploading = uploadPhase === "uploading" || uploadPhase === "starting";

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Hero */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-primary uppercase tracking-widest">AI Medical Coding</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight mb-2">
          Clinical Code Extraction
        </h1>
        <p className="text-muted-foreground max-w-xl">
          Upload a scanned clinical PDF and our AI agents will validate CPT, ICD-10, HCPCS, E&amp;M codes and Modifiers in seconds.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          {[
            { icon: ShieldCheck, label: "HIPAA-aware processing" },
            { icon: Zap, label: "Multi-agent validation" },
            { icon: ArrowRight, label: "Full audit trail" },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground bg-surface border border-border px-3 py-1 rounded-full">
              <Icon className="w-3 h-3 text-primary" />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left: Upload panel ── */}
        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-foreground mb-4">Upload Clinical Document</h2>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => !file && !isUploading && fileInputRef.current?.click()}
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
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
              />

              {!file ? (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                    <Upload className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">Drop your PDF here</p>
                  <p className="text-xs text-muted-foreground">or click to browse — up to 50 MB</p>
                  <p className="text-xs text-muted mt-2">Clinical notes, discharge summaries, op reports</p>
                </>
              ) : (
                <div className="flex items-center gap-3 w-full">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(file.size / 1024 / 1024).toFixed(2)} MB · PDF
                    </p>
                  </div>
                  {!isUploading && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setFile(null); setUploadError(null); }}
                      className="text-muted hover:text-danger transition-colors p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {uploadError && (
              <p className="mt-3 text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                {uploadError}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleRunJob}
                disabled={!file || isUploading}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all",
                  file && !isUploading
                    ? "bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/20"
                    : "bg-surface-2 text-muted cursor-not-allowed border border-border"
                )}
              >
                {isUploading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {uploadPhase === "uploading" ? "Uploading..." : "Starting..."}
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run Coding Job
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Active jobs sidebar list */}
          {jobs.length > 0 && (
            <div className="bg-surface border border-border rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Active Jobs ({jobs.length})
                </p>
                <Link href="/jobs" className="text-xs text-primary hover:text-accent transition-colors font-medium flex items-center gap-1">
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {jobs.map(job => (
                <button
                  key={job.jobExecutionId}
                  onClick={() => setSelectedId(job.jobExecutionId)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all",
                    selectedId === job.jobExecutionId
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-surface-2 border border-border hover:border-border-bright"
                  )}
                >
                  <div className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0",
                    job.status === "IN PROGRESS" && "bg-primary animate-pulse",
                    job.status === "COMPLETED" && "bg-success",
                    job.status === "FAILED" && "bg-danger",
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{job.filename}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {job.status === "IN PROGRESS" && "Processing..."}
                      {job.status === "COMPLETED" && `${(job.outputs?.icd10Codes?.length ?? 0) + (job.outputs?.cptCodes?.length ?? 0)} codes · ${Math.round((job.outputs?.confidenceScore ?? 0) * 100)}% confidence`}
                      {job.status === "FAILED" && "Failed — retry"}
                    </p>
                  </div>
                  {job.status === "IN PROGRESS" && (
                    <span className="flex-shrink-0 text-[10px] text-primary font-mono">
                      live
                    </span>
                  )}
                </button>
              ))}

              {/* Start new parallel job hint */}
              <div className="pt-1">
                <button
                  onClick={() => { setFile(null); setUploadError(null); fileInputRef.current?.click(); }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground border border-dashed border-border hover:border-primary/50 hover:text-primary transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Start New Parallel Job
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Audit / Results panel ── */}
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          {!selectedJob ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-center p-8">
              <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-border flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-muted" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">No active job</p>
              <p className="text-xs text-muted max-w-xs">
                Upload a PDF and click "Run Coding Job" to see live processing here.
              </p>
            </div>
          ) : (
            <>
              {/* Job header */}
              <div className="border-b border-border px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate">
                    {selectedJob.filename}
                  </span>
                </div>
                <div className={cn(
                  "flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full",
                  selectedJob.status === "IN PROGRESS" && "bg-primary/10 text-primary",
                  selectedJob.status === "COMPLETED" && "bg-success/10 text-success",
                  selectedJob.status === "FAILED" && "bg-danger/10 text-danger",
                )}>
                  {selectedJob.status === "IN PROGRESS" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  )}
                  {selectedJob.status === "IN PROGRESS" ? "Processing" : selectedJob.status === "COMPLETED" ? "Completed" : "Failed"}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border px-5">
                <button
                  onClick={() => setJobTab(selectedJob.jobExecutionId, "audit")}
                  className={cn(
                    "text-xs font-medium py-2.5 px-3 border-b-2 transition-colors -mb-px",
                    selectedJob.activeTab === "audit"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  Live Audit
                </button>
                {selectedJob.status === "COMPLETED" && (
                  <button
                    onClick={() => setJobTab(selectedJob.jobExecutionId, "results")}
                    className={cn(
                      "text-xs font-medium py-2.5 px-3 border-b-2 transition-colors -mb-px",
                      selectedJob.activeTab === "results"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Results
                  </button>
                )}
              </div>

              {/* Content */}
              <div className="p-5">
                {selectedJob.activeTab === "audit" && (
                  <StreamingAudit
                    key={selectedJob.jobExecutionId}
                    jobExecutionId={selectedJob.jobExecutionId}
                    status={selectedJob.status}
                    startedAt={selectedJob.startedAt}
                  />
                )}
                {selectedJob.activeTab === "results" && selectedJob.outputs && (
                  <ResultsPanel outputs={selectedJob.outputs} />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
