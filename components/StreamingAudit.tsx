"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Matches actual workflow order: E&M → ICD-10 → CPT → HCPCS/J-codes → Modifiers → scoring
const STAGED_MESSAGES = [
  { delay: 0,     text: "Securely uploading clinical document to vault..." },
  { delay: 3500,  text: "Document received — spinning up Opus AI agents..." },
  { delay: 8000,  text: "Parsing encounter notes and clinical structure..." },
  { delay: 14000, text: "Identifying Evaluation & Management (E&M) level..." },
  { delay: 21000, text: "Cross-referencing E&M against time and MDM criteria..." },
  { delay: 28000, text: "Extracting ICD-10 diagnosis codes from clinical findings..." },
  { delay: 36000, text: "Validating ICD-10 specificity, laterality and sequencing..." },
  { delay: 44000, text: "Hunting CPT procedure codes from operative notes..." },
  { delay: 52000, text: "Mapping HCPCS supply codes and J-codes for injectables..." },
  { delay: 60000, text: "Checking modifiers, bundling rules and unbundling flags..." },
  { delay: 68000, text: "Running confidence scoring engine across all codes..." },
  { delay: 75000, text: "Final payer policy and compliance validation..." },
];

interface AuditEntry {
  id: string;
  text: string;
  type: "staged" | "system" | "opus";
  timestamp: string;
}

interface StreamingAuditProps {
  jobExecutionId: string;
  status: "IN PROGRESS" | "COMPLETED" | "FAILED";
  startedAt: number;
}

export default function StreamingAudit({ jobExecutionId, status, startedAt }: StreamingAuditProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const auditPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenTimestamps = useRef<Set<string>>(new Set());
  const addedStages = useRef<Set<number>>(new Set());

  // Elapsed clock
  useEffect(() => {
    if (status !== "IN PROGRESS") return;
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status, startedAt]);

  // Timed staged messages
  useEffect(() => {
    if (status !== "IN PROGRESS") return;
    const elapsedMs = elapsed * 1000;
    STAGED_MESSAGES.forEach((msg, idx) => {
      if (elapsedMs >= msg.delay && !addedStages.current.has(idx)) {
        addedStages.current.add(idx);
        setEntries(prev => [...prev, {
          id: `stage-${idx}`,
          text: msg.text,
          type: "staged",
          timestamp: new Date().toISOString(),
        }]);
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
        const trail: { timestamp: string; actor: string; action: string }[] = data.auditTrail || [];
        trail.forEach(entry => {
          if (!seenTimestamps.current.has(entry.timestamp)) {
            seenTimestamps.current.add(entry.timestamp);
            setEntries(prev => [...prev, {
              id: entry.timestamp,
              text: `[${entry.actor}] ${entry.action}`,
              type: entry.actor === "SYSTEM" ? "system" : "opus",
              timestamp: entry.timestamp,
            }]);
          }
        });
      } catch { /* ignore transient errors */ }
    }
    fetchAudit();
    auditPollRef.current = setInterval(fetchAudit, 6000);
    return () => { if (auditPollRef.current) clearInterval(auditPollRef.current); };
  }, [jobExecutionId, status]);

  // Final status entries
  useEffect(() => {
    if (status === "COMPLETED") {
      setEntries(prev => [...prev, {
        id: "done",
        text: "✓ Coding complete — results are ready.",
        type: "system",
        timestamp: new Date().toISOString(),
      }]);
    } else if (status === "FAILED") {
      setEntries(prev => [...prev, {
        id: "failed",
        text: "✗ Workflow encountered an error. Please retry.",
        type: "system",
        timestamp: new Date().toISOString(),
      }]);
    }
  }, [status]);

  // Auto-scroll the log container only — never the page
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [entries]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Status bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          {status === "IN PROGRESS" && (
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              Processing
            </span>
          )}
          {status === "COMPLETED" && (
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ok">
              <span className="w-1.5 h-1.5 rounded-full bg-ok" />
              Complete
            </span>
          )}
          {status === "FAILED" && (
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-bad">
              <span className="w-1.5 h-1.5 rounded-full bg-bad" />
              Failed
            </span>
          )}
        </div>
        {status === "IN PROGRESS" && (
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint tabular-nums">
            {formatElapsed(elapsed)}
          </span>
        )}
      </div>

      {/* Log window */}
      <div
        ref={logRef}
        className="flex-1 bg-surface border border-line rounded-[8px] overflow-y-auto p-4 min-h-[300px] max-h-[420px] font-mono text-[11px] leading-relaxed space-y-1.5"
      >
        {entries.length === 0 && (
          <p className="text-ink-faint animate-pulse">Initializing workflow engine...</p>
        )}
        {entries.map((entry, i) => {
          const isLatest = i === entries.length - 1 && status === "IN PROGRESS";
          return (
            <div
              key={entry.id}
              className={cn(
                "flex gap-2.5 items-start animate-slide-in",
                isLatest ? "text-ink" : "text-ink-dim"
              )}
            >
              <span className="shrink-0 text-ink-faint text-[9.5px] tabular-nums pt-0.5 w-[64px]">
                {fmt(entry.timestamp)}
              </span>
              <span className={cn(
                "shrink-0 text-[10px] pt-px",
                entry.type === "staged" && "text-ink-faint",
                (entry.type === "system" || entry.type === "opus") && "text-accent",
                isLatest && "text-accent"
              )}>
                {entry.type === "staged" ? "›" : entry.type === "system" ? "◆" : "⬡"}
              </span>
              <span className={cn(
                (entry.type === "system" || entry.type === "opus") && "text-accent",
                isLatest && "text-ink font-medium"
              )}>
                {entry.text}
                {isLatest && (
                  <span className="inline-block w-1.5 h-3 bg-accent ml-1 animate-pulse align-middle" />
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
