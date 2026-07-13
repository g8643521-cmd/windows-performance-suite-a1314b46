import { useEffect, useState } from "react";
import { Radar, Loader2, CheckCircle2, AlertTriangle, Info, RefreshCw } from "lucide-react";
import { EmptyState } from "../components/Pending";
import { ErrorBanner } from "../components/ErrorBanner";
import { isDesktop, runHealthScan, type HealthReport, type HealthCheck } from "../lib/hardware";

export function HealthScanPage() {
  const desktop = isDesktop();
  const [report, setReport] = useState<HealthReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true); setError(null);
    try { setReport(await runHealthScan()); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  useEffect(() => { if (desktop) run(); }, [desktop]);

  if (!desktop) {
    return (
      <div className="h-full overflow-y-auto px-10 py-8">
        <EmptyState icon={<Radar className="h-6 w-6" />} title="Scan kræver desktop-appen"
          text="Systemtjek læser rigtige tal fra din PC og kører kun i NOVYX til Windows." />
      </div>
    );
  }

  const summary = report ? summarize(report.checks) : null;

  return (
    <div className="h-full overflow-y-auto px-10 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-low)]">
            Systemtjek
          </div>
          <h2 className="mt-2 text-[22px] font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
            {summary?.headline ?? "Kører tjek…"}
          </h2>
          {report?.os && <div className="mt-1 text-[12px] text-[color:var(--ink-faint)]">{report.os}</div>}
        </div>
        <button onClick={run} disabled={busy} className="btn btn-primary" style={{ padding: "10px 18px" }}>
          {busy ? (<><Loader2 className="h-4 w-4 animate-spin" /> Scanner…</>)
                : (<><RefreshCw className="h-4 w-4" /> Scan igen</>)}
        </button>
      </div>

      {error && <ErrorBanner message={error} className="mb-6" />}

      <div className="grid gap-3">
        {(report?.checks ?? []).map((c) => <CheckRow key={c.id} c={c} />)}
        {!report && !error && (
          <div className="glass-card grid place-items-center py-14 text-[color:var(--ink-faint)]" style={{ padding: 24 }}>
            <Loader2 className="mb-3 h-5 w-5 animate-spin" />
            Kører systemtjek…
          </div>
        )}
      </div>
    </div>
  );
}

function summarize(checks: HealthCheck[]) {
  const warn = checks.filter((c) => c.level === "warn").length;
  const notice = checks.filter((c) => c.level === "notice").length;
  if (warn > 0) return { headline: `${warn} advarsel${warn === 1 ? "" : "sler"} · ${notice} anbefaling${notice === 1 ? "" : "er"}` };
  if (notice > 0) return { headline: `Alt kører · ${notice} anbefaling${notice === 1 ? "" : "er"}` };
  return { headline: "Alt kører optimalt" };
}

function CheckRow({ c }: { c: HealthCheck }) {
  const style = c.level === "warn"
    ? { icon: <AlertTriangle className="h-4 w-4" />, color: "text-amber-300", border: "border-amber-500/25", bg: "bg-amber-500/10" }
    : c.level === "notice"
    ? { icon: <Info className="h-4 w-4" />, color: "text-sky-300", border: "border-sky-500/25", bg: "bg-sky-500/10" }
    : { icon: <CheckCircle2 className="h-4 w-4" />, color: "text-emerald-300", border: "border-emerald-500/20", bg: "bg-emerald-500/10" };
  return (
    <div className={`flex items-center gap-4 rounded-2xl border ${style.border} ${style.bg} px-5 py-4`}>
      <div className={`grid h-9 w-9 place-items-center rounded-xl ${style.color} bg-black/20`}>{style.icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-white">{c.label}</div>
        <div className="text-[12px] text-[color:var(--ink-mid)]">{c.detail}</div>
      </div>
      <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${style.color}`}>
        {c.level === "warn" ? "Advarsel" : c.level === "notice" ? "Anbefaling" : "OK"}
      </div>
    </div>
  );
}
