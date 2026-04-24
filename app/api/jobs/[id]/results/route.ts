import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BASE_URL = (process.env.OPUS_BASE_URL || "https://operator.opus.com").trim();
const SERVICE_KEY = process.env.OPUS_SERVICE_KEY!.trim();

const OUTPUT_VARS = {
  cptCodes: "workflow_output_oocfcvyvm",
  icd10Codes: "workflow_output_eewcq3j5i",
  emCodes: "workflow_output_vog70pb1w",
  hcpcsCodes: "workflow_output_rhrdp0ct5",
  modifiers: "workflow_output_mydmzzu29",
  reasoning: "workflow_output_hc4ibmnpl",
  confidenceScore: "workflow_output_aeekjso7g",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const res = await fetch(`${BASE_URL}/job/${id}/results`, {
      headers: { "x-service-key": SERVICE_KEY },
    });
    if (!res.ok) throw new Error(`Failed to get results: ${res.statusText}`);

    const raw = await res.json();
    console.log("[results] raw Opus response:", JSON.stringify(raw).slice(0, 500));

    // Opus can return two shapes:
    //   Shape A (flat array): [{ "workflow_output_xxx": value, ... }]
    //   Shape B (nested):     { results: { jobResultsPayloadSchema: { "key": { value: ... } } } }
    const flatObj: Record<string, unknown> = Array.isArray(raw) ? (raw[0] ?? {}) : {};
    const schema: Record<string, { value: unknown }> = raw?.results?.jobResultsPayloadSchema ?? {};

    const val = (key: string): unknown => {
      // Shape A
      if (key in flatObj) return flatObj[key];
      // Shape B
      return schema[key]?.value;
    };

    // Normalise code arrays to strings (Opus sometimes returns numbers e.g. [99443])
    const toStringArray = (v: unknown): string[] =>
      Array.isArray(v) ? v.map(String) : [];

    const rawScore = val(OUTPUT_VARS.confidenceScore);
    // Opus returns 0–1 float; keep as-is (ResultsPanel multiplies by 100)
    const confidenceScore = typeof rawScore === "number" ? rawScore : 0;

    const results = {
      cptCodes: toStringArray(val(OUTPUT_VARS.cptCodes)),
      icd10Codes: toStringArray(val(OUTPUT_VARS.icd10Codes)),
      emCodes: toStringArray(val(OUTPUT_VARS.emCodes)),
      hcpcsCodes: toStringArray(val(OUTPUT_VARS.hcpcsCodes)),
      modifiers: toStringArray(val(OUTPUT_VARS.modifiers)),
      reasoning: (val(OUTPUT_VARS.reasoning) as string) ?? "",
      confidenceScore,
    };

    // Persist to Supabase
    const supabase = await createClient();
    await supabase
      .from("jobs")
      .update({ outputs: results, status: "COMPLETED", completed_at: new Date().toISOString() })
      .eq("job_execution_id", id);

    return NextResponse.json({ results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching results";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
