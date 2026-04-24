import { NextRequest, NextResponse } from "next/server";
import { getJobAudit } from "@/lib/opus";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auditTrail = await getJobAudit(id);
    return NextResponse.json({ auditTrail });
  } catch {
    return NextResponse.json({ auditTrail: [] });
  }
}
