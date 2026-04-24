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

    // Opus returns results at: results.jobResultsPayloadSchema.{variable_name}.value
    const schema = raw?.results?.jobResultsPayloadSchema ?? {};

    const val = (key: string) => schema[key]?.value;

    const results = {
      cptCodes: val(OUTPUT_VARS.cptCodes) ?? [],
      icd10Codes: val(OUTPUT_VARS.icd10Codes) ?? [],
      emCodes: val(OUTPUT_VARS.emCodes) ?? [],
      hcpcsCodes: val(OUTPUT_VARS.hcpcsCodes) ?? [],
      modifiers: val(OUTPUT_VARS.modifiers) ?? [],
      reasoning: val(OUTPUT_VARS.reasoning) ?? "",
      confidenceScore: val(OUTPUT_VARS.confidenceScore) ?? 0,
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
