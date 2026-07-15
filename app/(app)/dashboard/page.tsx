"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, FileText, X, Plus, ArrowRight, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import StreamingAudit from "@/components/StreamingAudit";
import ResultsPanel from "@/components/ResultsPanel";
import Link from "next/link";
import { Btn, PageHeader, SectionDivider, StatusPill, Meta } from "@/components/ui";

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

  // Hydrate jobs from Supabase on mount so navigation doesn't wipe the view
  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      const supabase = createClient();
      const { data } = await supabase
        .from("jobs")
        .select("job_execution_id, filename, status, outputs, created_at")
        .order("created_at", { ascending: false })
        .limit(10);

      if (cancelled || !data || data.length === 0) return;

      const hydrated: ActiveJob[] = data.map(row => ({
        jobExecutionId: row.job_execution_id,
        filename: row.filename,
        startedAt: new Date(row.created_at).getTime(),
        status: row.status as ActiveJob["status"],
        outputs: row.outputs ?? null,
        activeTab: row.status === "COMPLETED" ? "results" : "audit",
      }));

      setJobs(hydrated);
      // Select the most recent job by default
      setSelectedId(hydrated[0].jobExecutionId);

      // Resume polling for any still-running jobs
      hydrated
        .filter(j => j.status === "IN PROGRESS")
        .forEach(j => startPolling(j.jobExecutionId));
    }
    hydrate();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      setJobs(prev => [newJob, ...prev]);
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

  async function handleDeleteJob(e: React.MouseEvent, jobExecutionId: string, filename: string) {
    e.stopPropagation();
    if (!confirm(`Delete "${filename}" from your run history?`)) return;
    try {
      const res = await fetch(`/api/jobs/${jobExecutionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setUploadError("Failed to delete the run. Please try again.");
      return;
    }
    // Stop polling and drop from the queue
    const interval = pollRefs.current.get(jobExecutionId);
    if (interval) {
      clearInterval(interval);
      pollRefs.current.delete(jobExecutionId);
    }
    const remaining = jobs.filter(j => j.jobExecutionId !== jobExecutionId);
    setJobs(remaining);
    if (selectedId === jobExecutionId) {
      setSelectedId(remaining[0]?.jobExecutionId ?? null);
    }
  }

  function setJobTab(jobExecutionId: string, tab: "audit" | "results") {
    setJobs(prev => prev.map(j =>
      j.jobExecutionId === jobExecutionId ? { ...j, activeTab: tab } : j
    ));
  }

  const isUploading = uploadPhase === "uploading" || uploadPhase === "starting";

  return (
    <div className="px-6 md:px-12 pt-9 md:pt-12 pb-12 max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Coding console"
        title={
          <>
            Clinical code extraction.{" "}
            <span className="text-ink-faint font-normal">
              Upload, run, review.
            </span>
          </>
        }
        subtitle="Upload a scanned clinical PDF and our AI agents will extract and validate E&M, ICD-10, CPT, HCPCS, and Modifier codes in seconds."
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Left: Upload panel + session queue ── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-line rounded-[8px] p-5">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-faint mb-4">
              Upload clinical document
            </p>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => !file && !isUploading && fileInputRef.current?.click()}
              className={cn(
                "relative border border-dashed rounded-[6px] transition-colors flex flex-col items-center justify-center text-center",
                file ? "p-4 cursor-default" : "p-10 cursor-pointer",
                dragging
                  ? "border-accent bg-accent-soft"
                  : file
                  ? "border-line bg-surface"
                  : "border-line-strong bg-surface hover:border-accent"
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
                  <Upload size={20} strokeWidth={1.5} className="text-ink-faint mb-4" />
                  <p className="text-[13.5px] font-medium text-ink mb-1">
                    Drop your PDF here
                  </p>
                  <p className="text-[12px] text-ink-dim">
                    or click to browse
                  </p>
                  <Meta className="mt-3">PDF · max 50 MB</Meta>
                  <Meta className="mt-1">Clinical notes · discharge summaries · op reports</Meta>
                </>
              ) : (
                <div className="flex items-center gap-3 w-full">
                  <div className="w-9 h-9 rounded-[6px] bg-accent-soft border border-accent/20 flex items-center justify-center shrink-0">
                    <FileText size={15} strokeWidth={1.75} className="text-accent" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[13px] font-medium text-ink truncate">{file.name}</p>
                    <Meta className="mt-1 block">
                      {(file.size / 1024 / 1024).toFixed(2)} MB · PDF
                    </Meta>
                  </div>
                  {!isUploading && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setFile(null); setUploadError(null); }}
                      className="text-ink-faint hover:text-bad transition-colors p-1 cursor-pointer"
                    >
                      <X size={14} strokeWidth={1.75} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {uploadError && (
              <p className="mt-3 text-[12px] leading-[1.6] text-bad bg-bad-soft border border-bad/20 rounded-[6px] px-3 py-2">
                {uploadError}
              </p>
            )}

            <Btn
              variant="primary"
              size="lg"
              onClick={handleRunJob}
              disabled={!file || isUploading}
              className="w-full mt-4"
            >
              {isUploading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {uploadPhase === "uploading" ? "Uploading…" : "Starting…"}
                </>
              ) : (
                <>Run coding job</>
              )}
            </Btn>
          </div>

          {/* Session queue */}
          {jobs.length > 0 && (
            <div>
              <SectionDivider label={`Session queue · ${jobs.length}`} />
              <div className="space-y-2">
                {jobs.map(job => {
                  const selected = selectedId === job.jobExecutionId;
                  return (
                    <div
                      key={job.jobExecutionId}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(job.jobExecutionId)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setSelectedId(job.jobExecutionId);
                      }}
                      className={cn(
                        "group w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[6px] text-left transition-colors cursor-pointer bg-white border border-line hover:border-line-strong"
                      )}
                      style={
                        selected
                          ? { borderLeft: "3px solid var(--color-accent)" }
                          : { borderLeft: "3px solid transparent" }
                      }
                    >
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          job.status === "IN PROGRESS" && "bg-accent animate-pulse",
                          job.status === "COMPLETED" && "bg-ok",
                          job.status === "FAILED" && "bg-bad"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-medium text-ink truncate">
                          {job.filename}
                        </p>
                        <Meta className="mt-0.5 block normal-case tracking-[0.08em]">
                          {job.status === "IN PROGRESS" && "Processing…"}
                          {job.status === "COMPLETED" &&
                            `${(job.outputs?.icd10Codes?.length ?? 0) + (job.outputs?.cptCodes?.length ?? 0)} codes`}
                          {job.status === "FAILED" && "Failed — retry"}
                        </Meta>
                      </div>
                      {job.status === "IN PROGRESS" && (
                        <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-accent">
                          Live
                        </span>
                      )}
                      <button
                        onClick={(e) => handleDeleteJob(e, job.jobExecutionId, job.filename)}
                        title="Delete run"
                        className="shrink-0 p-1.5 rounded-[4px] text-ink-faint opacity-0 group-hover:opacity-100 hover:text-bad hover:bg-bad-soft transition-all cursor-pointer"
                      >
                        <Trash2 size={12} strokeWidth={1.75} />
                      </button>
                    </div>
                  );
                })}

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => { setFile(null); setUploadError(null); fileInputRef.current?.click(); }}
                    className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint hover:text-accent transition-colors cursor-pointer"
                  >
                    <Plus size={11} strokeWidth={1.75} />
                    New parallel job
                  </button>
                  <Link
                    href="/jobs"
                    className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-accent hover:text-accent-hot transition-colors"
                  >
                    View all <ArrowRight size={11} strokeWidth={1.75} />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Audit / Results panel ── */}
        <div className="lg:col-span-3 bg-white border border-line rounded-[8px] overflow-hidden self-start">
          {!selectedJob ? (
            <div className="flex flex-col items-center justify-center min-h-[480px] text-center p-8">
              <div className="w-12 h-12 rounded-[8px] bg-surface border border-line flex items-center justify-center mb-4">
                <FileText size={18} strokeWidth={1.5} className="text-ink-faint" />
              </div>
              <p className="text-[13.5px] font-medium text-ink mb-1">No active job</p>
              <p className="text-[12.5px] leading-[1.7] text-ink-dim max-w-xs">
                Upload a PDF and run a coding job to see live processing here.
              </p>
            </div>
          ) : (
            <>
              {/* Job header */}
              <div className="border-b border-line px-5 py-3.5 flex items-center justify-between gap-3 bg-surface">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText size={13} strokeWidth={1.75} className="text-ink-faint shrink-0" />
                  <span className="text-[13px] font-medium text-ink truncate">
                    {selectedJob.filename}
                  </span>
                </div>
                <StatusPill status={selectedJob.status} />
              </div>

              {/* Tabs */}
              <div className="flex gap-7 px-5 pt-4 border-b border-line">
                <button
                  onClick={() => setJobTab(selectedJob.jobExecutionId, "audit")}
                  className={cn(
                    "font-mono text-[11px] uppercase tracking-[0.18em] whitespace-nowrap pb-2.5 border-b transition-colors cursor-pointer -mb-px",
                    selectedJob.activeTab === "audit"
                      ? "text-accent border-accent"
                      : "text-ink-faint border-transparent hover:text-ink-dim"
                  )}
                >
                  Live audit
                </button>
                {selectedJob.status === "COMPLETED" && (
                  <button
                    onClick={() => setJobTab(selectedJob.jobExecutionId, "results")}
                    className={cn(
                      "font-mono text-[11px] uppercase tracking-[0.18em] whitespace-nowrap pb-2.5 border-b transition-colors cursor-pointer -mb-px",
                      selectedJob.activeTab === "results"
                        ? "text-accent border-accent"
                        : "text-ink-faint border-transparent hover:text-ink-dim"
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
