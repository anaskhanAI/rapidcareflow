import { NextRequest, NextResponse } from "next/server";
import { getJobStatus } from "@/lib/opus";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const status = await getJobStatus(id);

    if (status === "COMPLETED" || status === "FAILED") {
      const supabase = await createClient();
      await supabase
        .from("jobs")
        .update({
          status,
          completed_at: new Date().toISOString(),
        })
        .eq("job_execution_id", id);
    }

    return NextResponse.json({ status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
