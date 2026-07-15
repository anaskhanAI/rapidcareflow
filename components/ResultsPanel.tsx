"use client";

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

function CodeSection({ label, codes }: { label: string; codes: string[] }) {
  return (
    <div className="bg-surface border border-line rounded-[8px] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-faint">
          {label}
        </p>
        <span className="font-mono text-[10.5px] text-accent">
          {codes.length}
        </span>
      </div>
      {codes.length === 0 ? (
        <p className="text-[11.5px] text-ink-faint italic">
          No codes identified
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {codes.map((code, i) => (
            <span
              key={i}
              className="inline-flex items-center px-2 py-1 rounded-[4px] font-mono text-[11px] text-ink bg-white border border-line"
            >
              {code}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ResultsPanel({ outputs }: ResultsPanelProps) {
  return (
    <div className="space-y-3 animate-reveal">
      {/* Code Sections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CodeSection label="CPT codes" codes={outputs.cptCodes} />
        <CodeSection label="ICD-10 codes" codes={outputs.icd10Codes} />
        <CodeSection label="E&M codes" codes={outputs.emCodes} />
        <CodeSection label="HCPCS codes" codes={outputs.hcpcsCodes} />
        <CodeSection label="Modifiers" codes={outputs.modifiers} />
      </div>

      {/* Reasoning */}
      <div
        className="bg-white border border-line rounded-[8px] p-4"
        style={{ borderLeft: "3px solid var(--color-accent)" }}
      >
        <p className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-faint mb-3">
          Validated reasoning
        </p>
        <p className="text-[13.5px] leading-[1.75] text-ink-dim">
          {outputs.reasoning || "No reasoning provided."}
        </p>
      </div>
    </div>
  );
}
