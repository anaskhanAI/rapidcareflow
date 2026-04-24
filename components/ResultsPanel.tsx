"use client";

import { cn } from "@/lib/utils";
import {
  FileCode2,
  Stethoscope,
  Package,
  Tags,
  Pencil,
  Brain,
  BarChart3,
} from "lucide-react";

interface CodingOutputs {
  cptCodes: string[];
  icd10Codes: string[];
  emCodes: string[];
  hcpcsCodes: string[];
  modifiers: string[];
  reasoning: string;
  confidenceScore: number;
}

interface ResultsPanelProps {
  outputs: CodingOutputs;
}

interface CodeSectionProps {
  icon: React.ReactNode;
  label: string;
  codes: string[];
  colorClass: string;
  dotClass: string;
}

function CodeSection({ icon, label, codes, colorClass, dotClass }: CodeSectionProps) {
  return (
    <div className="bg-surface-2 border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className={cn("text-xs", colorClass)}>{icon}</span>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <span className={cn("ml-auto text-xs font-mono font-semibold", colorClass)}>
          {codes.length}
        </span>
      </div>
      {codes.length === 0 ? (
        <p className="text-xs text-muted italic">No codes identified</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {codes.map((code, i) => (
            <span
              key={i}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-medium border",
                colorClass,
                "bg-current/5 border-current/20"
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full", dotClass)} />
              {code}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ResultsPanel({ outputs }: ResultsPanelProps) {
  const score = Math.round(outputs.confidenceScore * 100);

  const scoreColor =
    score >= 80
      ? "text-success"
      : score >= 60
      ? "text-warning"
      : "text-danger";

  const scoreBg =
    score >= 80
      ? "bg-success"
      : score >= 60
      ? "bg-warning"
      : "bg-danger";

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Confidence Score */}
      <div className="bg-surface-2 border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Confidence Score
            </p>
          </div>
          <span className={cn("text-2xl font-bold font-mono tabular-nums", scoreColor)}>
            {score}%
          </span>
        </div>
        <div className="h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-1000", scoreBg)}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {/* Code Sections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CodeSection
          icon={<FileCode2 className="w-3.5 h-3.5" />}
          label="CPT Codes"
          codes={outputs.cptCodes}
          colorClass="text-primary"
          dotClass="bg-primary"
        />
        <CodeSection
          icon={<Stethoscope className="w-3.5 h-3.5" />}
          label="ICD-10 Codes"
          codes={outputs.icd10Codes}
          colorClass="text-accent"
          dotClass="bg-accent"
        />
        <CodeSection
          icon={<Pencil className="w-3.5 h-3.5" />}
          label="E&M Codes"
          codes={outputs.emCodes}
          colorClass="text-warning"
          dotClass="bg-warning"
        />
        <CodeSection
          icon={<Package className="w-3.5 h-3.5" />}
          label="HCPCS Codes"
          codes={outputs.hcpcsCodes}
          colorClass="text-success"
          dotClass="bg-success"
        />
        <CodeSection
          icon={<Tags className="w-3.5 h-3.5" />}
          label="Modifiers"
          codes={outputs.modifiers}
          colorClass="text-orange-400"
          dotClass="bg-orange-400"
        />
      </div>

      {/* Reasoning */}
      <div className="bg-surface-2 border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Validated Reasoning
          </p>
        </div>
        <p className="text-sm text-foreground-dim leading-relaxed">
          {outputs.reasoning || "No reasoning provided."}
        </p>
      </div>
    </div>
  );
}
