import { cn } from "@/lib/utils";

/* ── Button ─────────────────────────────────────────────────────────── */

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

const btnVariants = {
  primary:
    "bg-accent text-white border border-transparent hover:bg-accent-hot disabled:hover:bg-accent",
  ghost:
    "bg-white text-ink-dim border border-line hover:border-line-strong hover:text-ink",
  danger:
    "bg-white text-bad border border-line hover:border-bad/40 hover:bg-bad-soft",
};

const btnSizes = {
  sm: "px-2.5 py-1.5 text-[11.5px]",
  md: "px-3.5 py-2 text-[12.5px]",
  lg: "px-5 py-2.5 text-[13px]",
};

export function Btn({
  variant = "ghost",
  size = "md",
  className,
  ...props
}: BtnProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[4px] font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
        btnVariants[variant],
        btnSizes[size],
        className
      )}
      {...props}
    />
  );
}

/* ── Page header ────────────────────────────────────────────────────── */

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 mb-9">
      <div className="min-w-0">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-accent mb-2.5">
          {eyebrow}
        </p>
        <h1 className="font-display font-medium text-[clamp(1.9rem,3.6vw,2.7rem)] leading-[1.05] tracking-[-0.025em] text-ink">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[13.5px] leading-[1.75] text-ink-dim mt-3 max-w-xl">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0 pt-1">{action}</div>}
    </div>
  );
}

/* ── Section divider with mono label ────────────────────────────────── */

export function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="flex-1 h-px bg-line" />
      <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent">
        {label}
      </span>
      <div className="flex-1 h-px bg-line" />
    </div>
  );
}

/* ── Status pill ────────────────────────────────────────────────────── */

export type JobStatus = "IN PROGRESS" | "COMPLETED" | "FAILED";

const statusConfig: Record<
  JobStatus,
  { label: string; dot: string; text: string; ring: string }
> = {
  "IN PROGRESS": {
    label: "Processing",
    dot: "bg-accent animate-pulse",
    text: "text-accent",
    ring: "border-accent/20 bg-accent/5",
  },
  COMPLETED: {
    label: "Completed",
    dot: "bg-ok",
    text: "text-ok",
    ring: "border-ok/20 bg-ok-soft",
  },
  FAILED: {
    label: "Failed",
    dot: "bg-bad",
    text: "text-bad",
    ring: "border-bad/20 bg-bad-soft",
  },
};

export function StatusPill({ status }: { status: JobStatus }) {
  const c = statusConfig[status] ?? statusConfig["IN PROGRESS"];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border shrink-0",
        c.ring
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", c.dot)} />
      <span
        className={cn(
          "font-mono text-[9.5px] uppercase tracking-[0.14em]",
          c.text
        )}
      >
        {c.label}
      </span>
    </span>
  );
}

/* ── Mono meta label ────────────────────────────────────────────────── */

export function Meta({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint",
        className
      )}
    >
      {children}
    </span>
  );
}
