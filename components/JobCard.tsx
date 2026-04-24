"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn, formatDate, formatDuration } from "@/lib/utils";
import {
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  Terminal,
} from "lucide-react";
import StreamingAudit from "./StreamingAudit";
import ResultsPanel from "./ResultsPanel";

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
  const [job, setJob] = useState<Job>(initialJob);
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"audit" | "results">("audit");
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

  const statusIcon = {
    "IN PROGRESS": (
      <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
    ),
    COMPLETED: <CheckCircle2 className="w-3.5 h-3.5 text-success" />,
    FAILED: <XCircle className="w-3.5 h-3.5 text-danger" />,
  }[job.status];

  const statusLabel = {
    "IN PROGRESS": "Processing",
    COMPLETED: "Completed",
    FAILED: "Failed",
  }[job.status];

  const statusColor = {
    "IN PROGRESS": "text-primary bg-primary/10 border-primary/20",
    COMPLETED: "text-success bg-success/10 border-success/20",
    FAILED: "text-danger bg-danger/10 border-danger/20",
  }[job.status];

  const totalCodes = job.outputs
    ? job.outputs.cptCodes.length +
      job.outputs.icd10Codes.length +
      job.outputs.emCodes.length +
      job.outputs.hcpcsCodes.length +
      job.outputs.modifiers.length
    : null;

  return (
    <div
      className={cn(
        "bg-surface border rounded-2xl overflow-hidden transition-all duration-300",
        job.status === "IN PROGRESS"
          ? "border-primary/30 shadow-lg shadow-primary/5"
          : "border-border"
      )}
    >
      {/* Card Header */}
      <div
        className="p-4 cursor-pointer hover:bg-surface-2/40 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-3">
          {/* File icon */}
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-surface-2 border border-border flex items-center justify-center mt-0.5">
            <FileText className="w-4 h-4 text-muted-foreground" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-foreground truncate max-w-xs">
                {job.filename}
              </p>
              <span
                className={cn(
                  "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border",
                  statusColor
                )}
              >
                {statusIcon}
                {statusLabel}
              </span>
              {job.status === "IN PROGRESS" && (
                <span className="text-xs text-muted animate-pulse">
                  {formatDuration(job.created_at)} elapsed
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 mt-1.5 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="w-3 h-3" />
                {job.user_email}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {formatDate(job.created_at)}
              </span>
              {job.completed_at && (
                <span className="text-xs text-muted-foreground">
                  Duration:{" "}
                  <span className="text-foreground-dim font-mono">
                    {formatDuration(job.created_at, job.completed_at)}
                  </span>
                </span>
              )}
              {totalCodes !== null && (
                <span className="text-xs text-muted-foreground">
                  <span className="text-primary font-semibold font-mono">
                    {totalCodes}
                  </span>{" "}
                  codes validated
                </span>
              )}
              {job.outputs && (
                <span className="text-xs text-muted-foreground">
                  Confidence:{" "}
                  <span
                    className={cn(
                      "font-semibold font-mono",
                      job.outputs.confidenceScore >= 0.8
                        ? "text-success"
                        : job.outputs.confidenceScore >= 0.6
                        ? "text-warning"
                        : "text-danger"
                    )}
                  >
                    {Math.round(job.outputs.confidenceScore * 100)}%
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Expand toggle */}
          <button className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border animate-fade-in">
          {/* Tabs */}
          <div className="flex border-b border-border px-4">
            <button
              onClick={() => setActiveTab("audit")}
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium py-2.5 px-3 border-b-2 transition-colors -mb-px",
                activeTab === "audit"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Terminal className="w-3 h-3" />
              Audit Log
            </button>
            {(job.status === "COMPLETED" || job.outputs) && (
              <button
                onClick={() => setActiveTab("results")}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium py-2.5 px-3 border-b-2 transition-colors -mb-px",
                  activeTab === "results"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <CheckCircle2 className="w-3 h-3" />
                Results
              </button>
            )}
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
