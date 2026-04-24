"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FileHeart, LayoutGrid, Briefcase, LogOut, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function Navbar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = userEmail.slice(0, 2).toUpperCase();

  const navLinks = [
    { href: "/dashboard", label: "New Job", icon: LayoutGrid },
    { href: "/jobs", label: "All Jobs", icon: Briefcase },
  ];

  return (
    <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-md border-b border-border">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 group-hover:bg-primary/20 transition-colors">
            <FileHeart className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-foreground text-sm tracking-tight">
            RapidCareFlow
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                pathname === href
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          ))}
        </nav>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-2 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-semibold text-primary">
              {initials}
            </div>
            <span className="text-xs text-muted-foreground hidden sm:block max-w-[120px] truncate">
              {userEmail}
            </span>
            <ChevronDown className="w-3 h-3 text-muted" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-48 bg-surface border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs font-medium text-foreground truncate">
                  {userEmail}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Coder</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-danger hover:bg-danger/5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
