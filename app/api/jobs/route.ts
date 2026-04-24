import { NextRequest, NextResponse } from "next/server";
import { initiateJob, executeJob } from "@/lib/opus";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  let step = "auth";
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    step = "parse-body";
    const { fileUrl, filename } = await request.json();
    if (!fileUrl || !filename) {
      return NextResponse.json({ error: "fileUrl and filename are required" }, { status: 400 });
    }

    step = "initiate-job";
    const jobExecutionId = await initiateJob(
      `Medical Coding — ${filename}`,
      `Automated ICD-10, CPT, HCPCS, E&M and Modifier coding for ${filename}`
    );

    step = "execute-job";
    await executeJob(jobExecutionId, fileUrl, filename);

    step = "save-to-db";
    const { error: dbError } = await supabase.from("jobs").insert({
      user_id: user.id,
      user_email: user.email,
      job_execution_id: jobExecutionId,
      filename,
      status: "IN PROGRESS",
    });
    if (dbError) console.error("Supabase insert error:", dbError);

    return NextResponse.json({ jobExecutionId, filename }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error(`[POST /api/jobs] step=${step}`, message);
    return NextResponse.json({ error: `[${step}] ${message}` }, { status: 500 });
  }
}
