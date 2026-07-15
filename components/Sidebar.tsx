"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LayoutGrid, Briefcase, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import OpusLogo from "@/components/OpusLogo";

const navLinks = [
  { href: "/dashboard", label: "New Job", icon: LayoutGrid },
  { href: "/jobs", label: "All Jobs", icon: Briefcase },
];

export default function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = userEmail.slice(0, 2).toUpperCase();

  const sidebar = (
    <div className="flex flex-col h-full w-[218px] shrink-0 border-r border-line bg-surface">
      {/* Logo */}
      <Link
        href="/dashboard"
        className="flex items-center gap-2.5 px-5 pt-6 pb-5"
        onClick={() => setMobileOpen(false)}
      >
        <OpusLogo className="w-5 text-accent" />
        <div className="min-w-0">
          <p className="font-display font-medium text-[14px] tracking-[-0.01em] text-ink leading-tight">
            RapidCareFlow
          </p>
          <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-faint mt-0.5">
            Medical coding
          </p>
        </div>
      </Link>

      <div className="mx-5 h-px bg-line" />

      {/* Nav */}
      <nav className="flex-1 px-3 pt-4 space-y-1">
        <p className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-faint px-2 pb-2">
          Workspace
        </p>
        {navLinks.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-[4px] font-mono text-[11px] uppercase tracking-[0.14em] transition-colors",
                active
                  ? "bg-accent-soft text-accent"
                  : "text-ink-dim hover:bg-raised hover:text-ink"
              )}
            >
              <Icon size={13} strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 pb-4">
        <div className="mx-2 h-px bg-line mb-3" />
        <div className="flex items-center gap-2.5 px-2.5 py-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-mono text-[10px]"
            style={{
              background: "rgba(4,38,205,0.08)",
              border: "1px solid rgba(4,38,205,0.19)",
              color: "var(--color-accent)",
            }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11.5px] text-ink truncate">{userEmail}</p>
            <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-faint mt-0.5">
              Coder
            </p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-1.5 rounded-[4px] text-ink-faint hover:text-bad hover:bg-raised transition-colors cursor-pointer"
          >
            <LogOut size={13} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 p-2 rounded-[4px] bg-white border border-line text-ink-dim cursor-pointer"
        aria-label="Open navigation"
      >
        <Menu size={15} strokeWidth={1.75} />
      </button>

      {/* Mobile slide-in */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-ink/20"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 animate-slide-in">
            {sidebar}
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-5 right-3 p-1.5 text-ink-faint hover:text-ink cursor-pointer"
              aria-label="Close navigation"
            >
              <X size={14} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      )}

      {/* Desktop */}
      <aside className="hidden md:block h-full">{sidebar}</aside>
    </>
  );
}
