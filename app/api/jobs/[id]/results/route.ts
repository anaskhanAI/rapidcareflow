import { NextRequest, NextResponse } from "next/server";
import { getJobResults } from "@/lib/opus";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const results = await getJobResults(id);

    // Persist results to Supabase
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
