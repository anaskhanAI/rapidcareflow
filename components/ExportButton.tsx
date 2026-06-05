"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

export default function ExportButton() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from.trim()) params.set("from", from.trim());
      if (to.trim()) params.set("to", to.trim());
      const qs = params.toString();
      const res = await fetch(`/api/export${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error(`Export failed (${res.status})`);

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "rapidcareflow-cases.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={1}
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        placeholder="From"
        className="w-20 bg-surface border border-border rounded-lg px-2.5 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors"
      />
      <input
        type="number"
        min={1}
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="To"
        className="w-20 bg-surface border border-border rounded-lg px-2.5 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors"
      />
      <button
        onClick={handleExport}
        disabled={loading}
        className="flex items-center gap-2 bg-primary hover:bg-primary-dark disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-primary/20"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        Export to Excel
      </button>
    </div>
  );
}
