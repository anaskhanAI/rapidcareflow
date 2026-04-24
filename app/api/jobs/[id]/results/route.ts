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
    console.log("[results] raw response:", JSON.stringify(raw, null, 2));

    // Try both possible structures: data.results.data and data.results directly
    const d = raw?.results?.data ?? raw?.results ?? raw?.data ?? {};
    console.log("[results] extracted data keys:", Object.keys(d));

    const results = {
      cptCodes: d[OUTPUT_VARS.cptCodes] ?? [],
      icd10Codes: d[OUTPUT_VARS.icd10Codes] ?? [],
      emCodes: d[OUTPUT_VARS.emCodes] ?? [],
      hcpcsCodes: d[OUTPUT_VARS.hcpcsCodes] ?? [],
      modifiers: d[OUTPUT_VARS.modifiers] ?? [],
      reasoning: d[OUTPUT_VARS.reasoning] ?? "",
      confidenceScore: d[OUTPUT_VARS.confidenceScore] ?? 0,
      _raw: raw, // include raw for debugging
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
