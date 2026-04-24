"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGED_MESSAGES = [
  { delay: 0, text: "Uploading clinical document to secure vault..." },
  { delay: 3000, text: "File received — initializing Opus AI workflow..." },
  { delay: 7000, text: "Agents getting to work..." },
  { delay: 12000, text: "Parsing clinical document structure..." },
  { delay: 18000, text: "Hunting CPT procedure codes..." },
  { delay: 25000, text: "Tinkering ICD-10 diagnosis codes..." },
  { delay: 33000, text: "Mapping HCPCS supply & service codes..." },
  { delay: 40000, text: "Validating E&M evaluation & management codes..." },
  { delay: 47000, text: "Cross-checking Modifiers..." },
  { delay: 54000, text: "Running confidence scoring engine..." },
  { delay: 60000, text: "Assembling validated coding output..." },
  { delay: 67000, text: "Final compliance check in progress..." },
];

interface AuditEntry {
  id: string;
  text: string;
  type: "system" | "opus" | "staged";
  timestamp: string;
}

interface StreamingAuditProps {
  jobExecutionId: string;
  status: "IN PROGRESS" | "COMPLETED" | "FAILED";
  startedAt: number;
}

export default function StreamingAudit({
  jobExecutionId,
  status,
  startedAt,
}: StreamingAuditProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const auditPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenTimestamps = useRef<Set<string>>(new Set());
  const addedStages = useRef<Set<number>>(new Set());

  // Elapsed timer
  useEffect(() => {
    if (status !== "IN PROGRESS") return;
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, startedAt]);

  // Stage messages by elapsed time
  useEffect(() => {
    if (status !== "IN PROGRESS") return;
    const elapsedMs = elapsed * 1000;
    STAGED_MESSAGES.forEach((msg, idx) => {
      if (elapsedMs >= msg.delay && !addedStages.current.has(idx)) {
        addedStages.current.add(idx);
        setEntries((prev) => [
          ...prev,
          {
            id: `stage-${idx}`,
            text: msg.text,
            type: "staged",
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    });
  }, [elapsed, status]);

  // Poll real Opus audit log
  useEffect(() => {
    if (status !== "IN PROGRESS") return;
    async function fetchAudit() {
      try {
        const res = await fetch(`/api/jobs/${jobExecutionId}/audit`);
        const data = await res.json();
        const trail: { timestamp: string; actor: string; action: string }[] =
          data.auditTrail || [];
        trail.forEach((entry) => {
          if (!seenTimestamps.current.has(entry.timestamp)) {
            seenTimestamps.current.add(entry.timestamp);
            setEntries((prev) => [
              ...prev,
              {
                id: entry.timestamp,
                text: `[${entry.actor}] ${entry.action}`,
                type: entry.actor === "SYSTEM" ? "system" : "opus",
                timestamp: entry.timestamp,
              },
            ]);
          }
        });
      } catch {
        // silently ignore
      }
    }
    fetchAudit();
    auditPollRef.current = setInterval(fetchAudit, 6000);
    return () => {
      if (auditPollRef.current) clearInterval(auditPollRef.current);
    };
  }, [jobExecutionId, status]);

  // Scroll to bottom on new entries
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  // Final status message
  useEffect(() => {
    if (status === "COMPLETED") {
      setEntries((prev) => [
        ...prev,
        {
          id: "done",
          text: "Coding complete. Results are ready.",
          type: "system",
          timestamp: new Date().toISOString(),
        },
      ]);
    } else if (status === "FAILED") {
      setEntries((prev) => [
        ...prev,
        {
          id: "failed",
          text: "Workflow encountered an error. Please retry.",
          type: "system",
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, [status]);

  const formatTs = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {status === "IN PROGRESS" && (
            <span className="flex items-center gap-1.5 text-xs text-primary font-medium">
              <Loader2 className="w-3 h-3 animate-spin" />
              Processing
            </span>
          )}
          {status === "COMPLETED" && (
            <span className="flex items-center gap-1.5 text-xs text-success font-medium">
              <CheckCircle2 className="w-3 h-3" />
              Complete
            </span>
          )}
          {status === "FAILED" && (
            <span className="flex items-center gap-1.5 text-xs text-danger font-medium">
              <XCircle className="w-3 h-3" />
              Failed
            </span>
          )}
        </div>
        {status === "IN PROGRESS" && (
          <span className="text-xs text-muted font-mono tabular-nums">
            {elapsed}s elapsed
          </span>
        )}
      </div>

      {/* Terminal */}
      <div className="flex-1 bg-background border border-border rounded-xl overflow-y-auto p-4 min-h-[280px] max-h-[380px] font-mono text-xs space-y-1.5">
        {entries.length === 0 && (
          <p className="text-muted animate-pulse">
            Initializing workflow engine...
          </p>
        )}
        {entries.map((entry, i) => (
          <div
            key={entry.id}
            className={cn(
              "flex gap-2.5 items-start animate-slide-in",
              i === entries.length - 1 && status === "IN PROGRESS"
                ? "text-foreground"
                : "text-muted-foreground"
            )}
          >
            <span className="shrink-0 text-muted text-[10px] tabular-nums pt-0.5 w-20">
              {formatTs(entry.timestamp)}
            </span>
            <span className="shrink-0 pt-0.5">
              {i === entries.length - 1 && status === "IN PROGRESS" ? (
                <Circle className="w-2.5 h-2.5 text-primary fill-primary animate-pulse" />
              ) : (
                <Circle className="w-2.5 h-2.5 text-border fill-border" />
              )}
            </span>
            <span
              className={cn(
                entry.type === "staged" && "text-foreground-dim",
                entry.type === "system" && "text-accent",
                entry.type === "opus" && "text-primary",
                i === entries.length - 1 &&
                  status === "IN PROGRESS" &&
                  "text-foreground"
              )}
            >
              {entry.text}
              {i === entries.length - 1 && status === "IN PROGRESS" && (
                <span className="inline-block w-1.5 h-3.5 bg-primary ml-0.5 animate-pulse align-middle" />
              )}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
