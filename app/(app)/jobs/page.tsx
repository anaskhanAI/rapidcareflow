import { createClient } from "@/lib/supabase/server";
import JobCard from "@/components/JobCard";
import { Briefcase, Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader, SectionDivider } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  const stats = [
    { l: "Total jobs", n: jobs?.length ?? 0, cls: "text-ink" },
    {
      l: "Completed",
      n: jobs?.filter((j) => j.status === "COMPLETED").length ?? 0,
      cls: "text-ok",
    },
    {
      l: "In progress",
      n: jobs?.filter((j) => j.status === "IN PROGRESS").length ?? 0,
      cls: "text-accent",
    },
    {
      l: "Failed",
      n: jobs?.filter((j) => j.status === "FAILED").length ?? 0,
      cls: "text-bad",
    },
  ];

  return (
    <div className="px-6 md:px-12 pt-9 md:pt-12 pb-12 max-w-4xl mx-auto">
      <PageHeader
        eyebrow="Job history"
        title={
          <>
            All coding jobs.{" "}
            <span className="text-ink-faint font-normal">
              Every run, on record.
            </span>
          </>
        }
        subtitle={`${jobs?.length ?? 0} job${
          jobs?.length !== 1 ? "s" : ""
        } run by your account.`}
        action={
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-[4px] font-medium transition-colors bg-accent text-white hover:bg-accent-hot px-5 py-2.5 text-[13px]"
          >
            <Plus size={14} strokeWidth={1.75} />
            New job
          </Link>
        }
      />

      {/* Summary stats */}
      {jobs && jobs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-9">
          {stats.map(({ l, n, cls }) => (
            <div
              key={l}
              className="bg-white border border-line rounded-[8px] px-3 py-4 text-center"
            >
              <div
                className={`font-display font-semibold text-[1.5rem] leading-none ${cls}`}
              >
                {n}
              </div>
              <div className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-faint mt-1.5">
                {l}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Jobs list */}
      {error && (
        <div className="text-[12.5px] leading-[1.6] text-bad bg-bad-soft border border-bad/20 rounded-[6px] px-4 py-3">
          Failed to load jobs: {error.message}
        </div>
      )}

      {!error && (!jobs || jobs.length === 0) && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 rounded-[8px] bg-surface border border-line flex items-center justify-center mb-5">
            <Briefcase size={18} strokeWidth={1.5} className="text-ink-faint" />
          </div>
          <p className="text-[14px] font-medium text-ink mb-1">No jobs yet</p>
          <p className="text-[12.5px] leading-[1.7] text-ink-dim max-w-xs mb-6">
            Upload a clinical PDF from the dashboard to run your first coding
            job.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-[4px] font-medium transition-colors bg-accent text-white hover:bg-accent-hot px-5 py-2.5 text-[13px]"
          >
            <Plus size={14} strokeWidth={1.75} />
            Run your first job
          </Link>
        </div>
      )}

      {jobs && jobs.length > 0 && (
        <>
          <SectionDivider label="Runs" />
          <div className="space-y-3">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
