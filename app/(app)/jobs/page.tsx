import { createClient } from "@/lib/supabase/server";
import JobCard from "@/components/JobCard";
import { Briefcase, Plus } from "lucide-react";
import Link from "next/link";

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

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Briefcase className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-primary uppercase tracking-widest">
              Job History
            </span>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            All Coding Jobs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {jobs?.length ?? 0} job{jobs?.length !== 1 ? "s" : ""} run by your
            account
          </p>
        </div>

        <Link
          href="/dashboard"
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          New Job
        </Link>
      </div>

      {/* Summary stats */}
      {jobs && jobs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            {
              label: "Total Jobs",
              value: jobs.length,
              color: "text-foreground",
            },
            {
              label: "Completed",
              value: jobs.filter((j) => j.status === "COMPLETED").length,
              color: "text-success",
            },
            {
              label: "In Progress",
              value: jobs.filter((j) => j.status === "IN PROGRESS").length,
              color: "text-primary",
            },
            {
              label: "Failed",
              value: jobs.filter((j) => j.status === "FAILED").length,
              color: "text-danger",
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="bg-surface border border-border rounded-xl p-4"
            >
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Jobs list */}
      {error && (
        <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-xl px-4 py-3">
          Failed to load jobs: {error.message}
        </div>
      )}

      {!error && (!jobs || jobs.length === 0) && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mb-5">
            <Briefcase className="w-7 h-7 text-muted" />
          </div>
          <p className="text-base font-medium text-muted-foreground mb-1">
            No jobs yet
          </p>
          <p className="text-sm text-muted max-w-xs mb-6">
            Upload a clinical PDF from the dashboard to run your first coding
            job.
          </p>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            Run your first job
          </Link>
        </div>
      )}

      {jobs && jobs.length > 0 && (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
