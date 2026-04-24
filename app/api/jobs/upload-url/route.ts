import { NextResponse } from "next/server";
import { getUploadUrl } from "@/lib/opus";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { presignedUrl, fileUrl } = await getUploadUrl();
    return NextResponse.json({ presignedUrl, fileUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get upload URL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
