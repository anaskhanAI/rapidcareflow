const BASE_URL = process.env.OPUS_BASE_URL || "https://operator.opus.com";
const SERVICE_KEY = process.env.OPUS_SERVICE_KEY!;
const WORKFLOW_ID = process.env.OPUS_WORKFLOW_ID!;

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
    body: JSON.stringify({ fileExtension: ".pdf", accessScope: "organization" }),
  });
  if (!res.ok) throw new Error(`Failed to get upload URL: ${res.statusText}`);
  return res.json();
}

export async function uploadFile(
  presignedUrl: string,
  fileBuffer: Buffer
): Promise<void> {
  const res = await fetch(presignedUrl, {
    method: "PUT",
    body: fileBuffer as unknown as BodyInit,
    headers: { "Content-Type": "application/pdf" },
  });
  if (!res.ok) throw new Error(`File upload failed: ${res.statusText}`);
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
  if (!res.ok) throw new Error(`Failed to initiate job: ${res.statusText}`);
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
  const d = data.results?.data || {};
  return {
    cptCodes: d[OUTPUT_VARS.cptCodes] || [],
    icd10Codes: d[OUTPUT_VARS.icd10Codes] || [],
    emCodes: d[OUTPUT_VARS.emCodes] || [],
    hcpcsCodes: d[OUTPUT_VARS.hcpcsCodes] || [],
    modifiers: d[OUTPUT_VARS.modifiers] || [],
    reasoning: d[OUTPUT_VARS.reasoning] || "",
    confidenceScore: d[OUTPUT_VARS.confidenceScore] || 0,
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
