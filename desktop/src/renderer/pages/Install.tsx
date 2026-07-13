import { useEffect, useMemo, useState } from "react";
import { Package, Search, Loader2, RefreshCw } from "lucide-react";
import { EmptyState } from "../components/Pending";
import { ErrorBanner } from "../components/ErrorBanner";
import { isDesktop, listInstalledApps, formatBytes, type InstalledApp } from "../lib/hardware";

export function InstallPage() {
  const desktop = isDesktop();
  const [apps, setApps] = useState<InstalledApp[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  async function refresh() {
    setBusy(true); setError(null);
    try { setApps(await listInstalledApps()); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  useEffect(() => { if (desktop) refresh(); }, [desktop]);

  const filtered = useMemo(() => {
    if (!apps) return [];
    const s = q.trim().toLowerCase();
    return s ? apps.filter((a) =>
      a.name.toLowerCase().includes(s) || (a.publisher ?? "").toLowerCase().includes(s)) : apps;
  }, [apps, q]);

  if (!desktop) {
    return (
      <div className="h-full overflow-y-auto px-10 py-8">
        <EmptyState icon={<Package className="h-6 w-6" />} title="Install kræver desktop-appen"
          text="Læser installerede programmer fra Windows-registret. Ikke tilgængeligt i browseren." />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-10 py-8">
      <div className="mb-5 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-faint)]" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Søg efter program eller udgiver…"
            className="w-full rounded-2xl bg-white/[0.03] py-3 pl-11 pr-4 text-[14px] text-white outline-none placeholder:text-[color:var(--ink-faint)]"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}
          />
        </div>
        <div className="text-[12px] text-[color:var(--ink-faint)]">
          {apps ? `${apps.length} programmer` : "—"}
        </div>
        <button onClick={refresh} disabled={busy} className="btn btn-primary" style={{ padding: "10px 16px" }}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Genindlæs
        </button>
      </div>

      {error && <ErrorBanner message={error} className="mb-5" />}

      <div className="glass-card overflow-hidden" style={{ padding: 0 }}>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[10.5px] uppercase tracking-[0.18em] text-[color:var(--ink-faint)]">
              <th className="px-5 py-3 font-semibold">Program</th>
              <th className="px-5 py-3 font-semibold">Udgiver</th>
              <th className="px-5 py-3 font-semibold">Version</th>
              <th className="px-5 py-3 text-right font-semibold">Størrelse</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a, i) => (
              <tr key={`${a.name}-${i}`} className="border-t border-white/[0.04]">
                <td className="px-5 py-2.5 text-white">{a.name}</td>
                <td className="px-5 py-2.5 text-[color:var(--ink-mid)]">{a.publisher ?? "—"}</td>
                <td className="px-5 py-2.5 text-[color:var(--ink-mid)]">{a.version ?? "—"}</td>
                <td className="px-5 py-2.5 text-right text-[color:var(--ink-mid)]">
                  {a.sizeKb ? formatBytes(a.sizeKb * 1024) : "—"}
                </td>
              </tr>
            ))}
            {!apps && !error && (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-[color:var(--ink-faint)]">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Læser programmer fra registret…
              </td></tr>
            )}
            {apps && filtered.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-[color:var(--ink-faint)]">
                Ingen programmer matcher søgningen.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
