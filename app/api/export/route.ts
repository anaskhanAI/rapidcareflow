import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDuration } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The `outputs` jsonb is stored in the parsed camelCase shape written by
// app/api/jobs/[id]/results/route.ts. We read that shape, but fall back to the
// raw Opus workflow_output_* keys in case any older rows stored those instead.
const RAW_KEYS = {
  cptCodes: "workflow_output_oocfcvyvm",
  icd10Codes: "workflow_output_eewcq3j5i",
  emCodes: "workflow_output_vog70pb1w",
  hcpcsCodes: "workflow_output_rhrdp0ct5",
  modifiers: "workflow_output_mydmzzu29",
  reasoning: "workflow_output_hc4ibmnpl",
} as const;

type Outputs = Record<string, unknown> | null;

// A real billing code is short and has no spaces (e.g. 99213, M54.5, J1885, 59).
// A stray "halt validation" style error string is long / contains spaces, so we
// drop it rather than dumping it into the sheet.
function isValidCode(value: unknown): boolean {
  if (typeof value !== "string" && typeof value !== "number") return false;
  const s = String(value).trim();
  return s.length > 0 && s.length <= 12 && /^[A-Za-z0-9.\- ]*$/.test(s) && !/\s/.test(s);
}

function codeList(outputs: Outputs, camelKey: keyof typeof RAW_KEYS): string[] {
  if (!outputs) return [];
  const raw = (outputs[camelKey] ?? outputs[RAW_KEYS[camelKey]]) as unknown;
  if (!Array.isArray(raw)) return [];
  return raw.map(String).map((s) => s.trim()).filter(isValidCode);
}

function reasoningText(outputs: Outputs): string {
  if (!outputs) return "";
  const r = outputs["reasoning"] ?? outputs[RAW_KEYS.reasoning];
  return typeof r === "string" ? r : "";
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Oldest first so case numbering is stable across exports.
    const { data: jobs, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let rows = jobs ?? [];

    // Optional 1-based inclusive range. startOffset preserves the global case
    // number so the "No." column stays stable regardless of the range chosen.
    const fromParam = request.nextUrl.searchParams.get("from");
    const toParam = request.nextUrl.searchParams.get("to");
    const from = fromParam ? parseInt(fromParam, 10) : null;
    const to = toParam ? parseInt(toParam, 10) : null;
    let startOffset = 0;
    if ((from && from > 0) || (to && to > 0)) {
      const startIdx = from && from > 0 ? from - 1 : 0;
      const endIdx = to && to > 0 ? to : rows.length;
      startOffset = startIdx;
      rows = rows.slice(startIdx, endIdx);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "RapidCareFlow";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("Cases");

    sheet.columns = [
      { header: "No.", key: "no", width: 6 },
      { header: "Case Name", key: "caseName", width: 32 },
      { header: "Date/Time Run", key: "dateRun", width: 22 },
      { header: "Duration", key: "duration", width: 12 },
      { header: "Codes Validated", key: "codesValidated", width: 16 },
      { header: "CPT Codes", key: "cpt", width: 20 },
      { header: "ICD-10 Codes", key: "icd10", width: 20 },
      { header: "E&M Codes", key: "em", width: 16 },
      { header: "HCPCS Codes", key: "hcpcs", width: 18 },
      { header: "Modifiers", key: "modifiers", width: 16 },
      { header: "Validated Reasoning", key: "reasoning", width: 60 },
    ];

    rows.forEach((job, i) => {
      const cpt = codeList(job.outputs, "cptCodes");
      const icd10 = codeList(job.outputs, "icd10Codes");
      const em = codeList(job.outputs, "emCodes");
      const hcpcs = codeList(job.outputs, "hcpcsCodes");
      const modifiers = codeList(job.outputs, "modifiers");
      const totalCodes =
        cpt.length + icd10.length + em.length + hcpcs.length + modifiers.length;

      sheet.addRow({
        no: startOffset + i + 1,
        caseName: job.filename ?? "",
        dateRun: job.created_at ? formatDate(job.created_at) : "",
        duration: job.completed_at
          ? formatDuration(job.created_at, job.completed_at)
          : "",
        codesValidated: totalCodes,
        cpt: cpt.join(", "),
        icd10: icd10.join(", "),
        em: em.join(", "),
        hcpcs: hcpcs.join(", "),
        modifiers: modifiers.join(", "),
        reasoning: reasoningText(job.outputs),
      });
    });

    // Bold + frozen header row.
    const header = sheet.getRow(1);
    header.font = { bold: true };
    header.alignment = { vertical: "middle" };
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    // Wrap the long reasoning column (column K = 11th).
    sheet.getColumn("reasoning").alignment = {
      wrapText: true,
      vertical: "top",
    };

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="rapidcareflow-cases.xlsx"',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
