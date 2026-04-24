import { NextRequest, NextResponse } from "next/server";
import {
  getUploadUrl,
  uploadFile,
  initiateJob,
  executeJob,
} from "@/lib/opus";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  let step = "auth";
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    step = "parse-form";
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file || file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "A valid PDF file is required" },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be under 10 MB" },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name;

    // Step 1: Get presigned upload URL from Opus
    step = "get-upload-url";
    const { presignedUrl, fileUrl } = await getUploadUrl();

    // Step 2: Upload file to S3
    step = "upload-file";
    await uploadFile(presignedUrl, fileBuffer);

    // Step 3: Initiate job
    step = "initiate-job";
    const jobExecutionId = await initiateJob(
      `Medical Coding — ${filename}`,
      `Automated ICD-10, CPT, HCPCS, E&M and Modifier coding for ${filename}`
    );

    // Step 4: Execute job
    step = "execute-job";
    await executeJob(jobExecutionId, fileUrl, filename);

    // Step 5: Persist job to Supabase
    step = "save-to-db";
    const { error: dbError } = await supabase.from("jobs").insert({
      user_id: user.id,
      user_email: user.email,
      job_execution_id: jobExecutionId,
      filename,
      status: "IN PROGRESS",
    });

    if (dbError) {
      console.error("Supabase insert error:", dbError);
    }

    return NextResponse.json({ jobExecutionId, filename }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error(`[POST /api/jobs] step=${step}`, message);
    return NextResponse.json({ error: `[${step}] ${message}` }, { status: 500 });
  }
}
