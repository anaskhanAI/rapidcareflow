import { NextRequest, NextResponse } from "next/server";

const BASE_URL = (process.env.OPUS_BASE_URL || "https://operator.opus.com").trim();
const SERVICE_KEY = process.env.OPUS_SERVICE_KEY!.trim();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [statusRes, resultsRes] = await Promise.all([
    fetch(`${BASE_URL}/job/${id}/status`, { headers: { "x-service-key": SERVICE_KEY } }),
    fetch(`${BASE_URL}/job/${id}/results`, { headers: { "x-service-key": SERVICE_KEY } }),
  ]);

  const status = await statusRes.json();
  const results = await resultsRes.json();

  return NextResponse.json({ status, results }, { status: 200 });
}
