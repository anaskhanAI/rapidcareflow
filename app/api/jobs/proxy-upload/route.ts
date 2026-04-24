import { NextRequest, NextResponse } from "next/server";

// Stream the file body directly to Opus — never buffers the full file in memory
export async function POST(request: NextRequest) {
  try {
    const presignedUrl = request.headers.get("x-upload-url");
    if (!presignedUrl) {
      return NextResponse.json({ error: "Missing x-upload-url header" }, { status: 400 });
    }

    const response = await fetch(presignedUrl, {
      method: "PUT",
      // Pipe the incoming ReadableStream straight to Opus — no buffering
      body: request.body,
      headers: { "Content-Type": "application/pdf" },
      // @ts-expect-error — duplex is required for streaming request bodies
      duplex: "half",
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(`Opus upload failed (${response.status}): ${text}`);
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Proxy upload failed";
    console.error("[proxy-upload]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
