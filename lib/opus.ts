const BASE_URL = (process.env.OPUS_BASE_URL || "https://operator.opus.com").trim();
const SERVICE_KEY = process.env.OPUS_SERVICE_KEY!.trim();
const WORKFLOW_ID = process.env.OPUS_WORKFLOW_ID!.trim();

const headers = () => ({
  "Content-Type": "application/json",
  "x-service-key": SERVICE_KEY,
});

export const WORKFLOW_INPUT_VAR = "workflow_input_j60l3wn60";

export const OUTPUT_VARS = {
  cptCodes: "workflow_output_oocfcvyvm",
  icd10Codes: "workflow_output_eewcq3j5i",
  emCodes: "workflow_output_vog70pb1w",
  hcpcsCodes: "workflow_output_rhrdp0ct5",
  modifiers: "workflow_output_mydmzzu29",
  reasoning: "workflow_output_hc4ibmnpl",
  confidenceScore: "workflow_output_aeekjso7g",
};

export async function getUploadUrl(): Promise<{
  presignedUrl: string;
  fileUrl: string;
}> {
  const res = await fetch(`${BASE_URL}/job/file/upload`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ fileExtension: ".pdf", accessScope: "unlisted" }),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try { const body = await res.json(); detail = JSON.stringify(body); } catch { /* ignore */ }
    throw new Error(`Failed to get upload URL (${res.status}): ${detail}`);
  }
  return res.json();
}

// Streams a ReadableStream straight to Opus — no buffering, no size limit
export async function uploadFileStream(
  presignedUrl: string,
  stream: ReadableStream,
  contentLength?: number
): Promise<void> {
  const uploadHeaders: Record<string, string> = { "Content-Type": "application/pdf" };
  if (contentLength) uploadHeaders["Content-Length"] = String(contentLength);

  const res = await fetch(presignedUrl, {
    method: "PUT",
    body: stream,
    headers: uploadHeaders,
    // @ts-expect-error — duplex is required for streaming request bodies in Node fetch
    duplex: "half",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`File upload to Opus failed (${res.status}): ${text}`);
  }
}

export async function initiateJob(
  title: string,
  description: string
): Promise<string> {
  const res = await fetch(`${BASE_URL}/job/initiate`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ workflowId: WORKFLOW_ID, title, description }),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try { const body = await res.json(); detail = JSON.stringify(body); } catch { /* ignore */ }
    throw new Error(`Failed to initiate job (${res.status}): ${detail}`);
  }
  const data = await res.json();
  return data.jobExecutionId;
}

export async function executeJob(
  jobExecutionId: string,
  fileUrl: string,
  filename: string
): Promise<void> {
  const res = await fetch(`${BASE_URL}/job/execute`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      jobExecutionId,
      jobPayloadSchemaInstance: {
        [WORKFLOW_INPUT_VAR]: {
          value: fileUrl,
          type: "file",
          displayName: "Scanned Clinical PDF File",
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Failed to execute job: ${res.statusText}`);
}

export async function getJobStatus(
  jobExecutionId: string
): Promise<"IN PROGRESS" | "COMPLETED" | "FAILED"> {
  const res = await fetch(`${BASE_URL}/job/${jobExecutionId}/status`, {
    headers: { "x-service-key": SERVICE_KEY },
  });
  if (!res.ok) throw new Error(`Failed to get status: ${res.statusText}`);
  const data = await res.json();
  return data.status;
}

export async function getJobResults(jobExecutionId: string): Promise<{
  cptCodes: string[];
  icd10Codes: string[];
  emCodes: string[];
  hcpcsCodes: string[];
  modifiers: string[];
  reasoning: string;
  confidenceScore: number;
}> {
  const res = await fetch(`${BASE_URL}/job/${jobExecutionId}/results`, {
    headers: { "x-service-key": SERVICE_KEY },
  });
  if (!res.ok) throw new Error(`Failed to get results: ${res.statusText}`);
  const data = await res.json();
  // Actual shape: { jobResultsPayloadSchema: { "workflow_output_xxx": { value: ... } } }
  const schema: Record<string, { value: unknown }> =
    data?.jobResultsPayloadSchema ??
    data?.results?.jobResultsPayloadSchema ??
    {};
  const dataObj: Record<string, unknown> = data?.results?.data ?? {};
  const flatObj: Record<string, unknown> = Array.isArray(data) ? (data[0] ?? {}) : {};
  const val = (key: string): unknown => {
    if (schema[key] !== undefined) return schema[key]?.value;
    if (key in dataObj) return dataObj[key];
    if (key in flatObj) return flatObj[key];
    return undefined;
  };
  const toStringArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.map(String) : [];
  const rawScore = val(OUTPUT_VARS.confidenceScore);
  return {
    cptCodes: toStringArray(val(OUTPUT_VARS.cptCodes)),
    icd10Codes: toStringArray(val(OUTPUT_VARS.icd10Codes)),
    emCodes: toStringArray(val(OUTPUT_VARS.emCodes)),
    hcpcsCodes: toStringArray(val(OUTPUT_VARS.hcpcsCodes)),
    modifiers: toStringArray(val(OUTPUT_VARS.modifiers)),
    reasoning: (val(OUTPUT_VARS.reasoning) as string) ?? "",
    confidenceScore: typeof rawScore === "number" ? rawScore : 0,
  };
}

export async function getJobAudit(
  jobExecutionId: string
): Promise<{ timestamp: string; actor: string; action: string }[]> {
  const res = await fetch(`${BASE_URL}/job/${jobExecutionId}/audit`, {
    headers: { "x-service-key": SERVICE_KEY },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.auditTrail || [];
}
