"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn, formatDate, formatDuration } from "@/lib/utils";
import { FileText, ChevronDown, ChevronUp, Trash2, Loader2 } from "lucide-react";
import StreamingAudit from "./StreamingAudit";
import ResultsPanel from "./ResultsPanel";
import { StatusPill, Meta, type JobStatus } from "./ui";

interface Job {
  id: string;
  job_execution_id: string;
  filename: string;
  status: string;
  user_email: string;
  created_at: string;
  completed_at: string | null;
  outputs: {
    cptCodes: string[];
    icd10Codes: string[];
    emCodes: string[];
    hcpcsCodes: string[];
    modifiers: string[];
    reasoning: string;
    confidenceScore: number;
  } | null;
}

interface JobCardProps {
  job: Job;
}

export default function JobCard({ job: initialJob }: JobCardProps) {
  const router = useRouter();
  const [job, setJob] = useState<Job>(initialJob);
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [activeTab, setActiveTab] = useState<"audit" | "results">(
    initialJob.status === "COMPLETED" && initialJob.outputs ? "results" : "audit"
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(new Date(initialJob.created_at).getTime());

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${job.job_execution_id}/status`);
      const { status } = await res.json();

      if (status !== job.status) {
        if (status === "COMPLETED") {
          const resultsRes = await fetch(
            `/api/jobs/${job.job_execution_id}/results`
          );
          const { results } = await resultsRes.json();
          setJob((prev) => ({
            ...prev,
            status,
            outputs: results,
            completed_at: new Date().toISOString(),
          }));
          setActiveTab("results");
        } else {
          setJob((prev) => ({ ...prev, status }));
        }
        if (status === "COMPLETED" || status === "FAILED") {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }
    } catch {
      // ignore
    }
  }, [job.job_execution_id, job.status]);

  useEffect(() => {
    if (job.status === "IN PROGRESS") {
      pollRef.current = setInterval(pollStatus, 5000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
  }, [job.status, pollStatus]);

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete "${job.filename}" from your run history?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/jobs/${job.job_execution_id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      if (pollRef.current) clearInterval(pollRef.current);
      setDeleted(true);
      router.refresh();
    } catch {
      setDeleting(false);
      alert("Failed to delete the run. Please try again.");
    }
  }

  if (deleted) return null;

  const totalCodes = job.outputs
    ? job.outputs.cptCodes.length +
      job.outputs.icd10Codes.length +
      job.outputs.emCodes.length +
      job.outputs.hcpcsCodes.length +
      job.outputs.modifiers.length
    : null;

  return (
    <div
      className="bg-white border border-line rounded-[8px] overflow-hidden transition-colors hover:border-line-strong"
      style={
        job.status === "IN PROGRESS"
          ? { borderLeft: "3px solid var(--color-accent)" }
          : undefined
      }
    >
      {/* Card Header */}
      <div
        className="px-4 py-3.5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-3">
          {/* File icon */}
          <div className="shrink-0 w-8 h-8 rounded-[6px] bg-surface border border-line flex items-center justify-center mt-0.5">
            <FileText size={13} strokeWidth={1.75} className="text-ink-faint" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <p className="text-[13px] font-medium text-ink truncate max-w-xs">
                {job.filename}
              </p>
              <StatusPill status={job.status as JobStatus} />
              {job.status === "IN PROGRESS" && (
                <Meta className="animate-pulse">
                  {formatDuration(job.created_at)} elapsed
                </Meta>
              )}
            </div>

            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <Meta className="normal-case tracking-[0.06em]">
                {job.user_email}
              </Meta>
              <Meta>{formatDate(job.created_at)}</Meta>
              {job.completed_at && (
                <Meta>
                  Duration {formatDuration(job.created_at, job.completed_at)}
                </Meta>
              )}
              {totalCodes !== null && (
                <Meta>
                  <span className="text-accent">{totalCodes}</span> codes
                  validated
                </Meta>
              )}
            </div>
          </div>

          {/* Delete + expand toggle */}
          <div className="flex items-center gap-1 shrink-0 pt-0.5">
            <button
              onClick={handleDelete}
              disabled={deleting}
              title="Delete run"
              className="p-1.5 rounded-[4px] text-ink-faint hover:text-bad hover:bg-bad-soft transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting ? (
                <Loader2 size={13} strokeWidth={1.75} className="animate-spin" />
              ) : (
                <Trash2 size={13} strokeWidth={1.75} />
              )}
            </button>
            <span className="text-ink-faint p-1.5">
              {expanded ? (
                <ChevronUp size={14} strokeWidth={1.75} />
              ) : (
                <ChevronDown size={14} strokeWidth={1.75} />
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-line animate-reveal">
          {/* Tabs — Results first, Audit Log second */}
          <div className="flex gap-7 px-4 pt-3 border-b border-line bg-surface">
            {(job.status === "COMPLETED" || job.outputs) && (
              <button
                onClick={() => setActiveTab("results")}
                className={cn(
                  "font-mono text-[11px] uppercase tracking-[0.18em] whitespace-nowrap pb-2.5 border-b transition-colors cursor-pointer -mb-px",
                  activeTab === "results"
                    ? "text-accent border-accent"
                    : "text-ink-faint border-transparent hover:text-ink-dim"
                )}
              >
                Results
              </button>
            )}
            <button
              onClick={() => setActiveTab("audit")}
              className={cn(
                "font-mono text-[11px] uppercase tracking-[0.18em] whitespace-nowrap pb-2.5 border-b transition-colors cursor-pointer -mb-px",
                activeTab === "audit"
                  ? "text-accent border-accent"
                  : "text-ink-faint border-transparent hover:text-ink-dim"
              )}
            >
              Audit log
            </button>
          </div>

          <div className="p-4">
            {activeTab === "audit" && (
              <StreamingAudit
                jobExecutionId={job.job_execution_id}
                status={job.status as "IN PROGRESS" | "COMPLETED" | "FAILED"}
                startedAt={startedAt.current}
              />
            )}
            {activeTab === "results" && job.outputs && (
              <ResultsPanel outputs={job.outputs} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
