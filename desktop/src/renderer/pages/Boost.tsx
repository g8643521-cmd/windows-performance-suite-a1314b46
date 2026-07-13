import { useEffect, useState } from "react";
import { Zap, Cpu, MemoryStick, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import { EmptyState } from "../components/Pending";
import { ErrorBanner } from "../components/ErrorBanner";
import {
  isDesktop, fetchLive, fetchProcesses, fetchTempInfo, cleanTemp,
  formatBytes, formatPercent, formatUptime,
  type LiveSnapshot, type ProcessesReport, type TempFolderInfo, type CleanTempResult,
} from "../lib/hardware";

export function BoostPage() {
  const desktop = isDesktop();
  const [live, setLive] = useState<LiveSnapshot | null>(null);
  const [procs, setProcs] = useState<ProcessesReport | null>(null);
  const [temp, setTemp] = useState<TempFolderInfo[] | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [cleaned, setCleaned] = useState<CleanTempResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!desktop) return;
    let cancelled = false;
    async function refresh() {
      try {
        const [l, p, t] = await Promise.all([fetchLive(), fetchProcesses(), fetchTempInfo()]);
        if (cancelled) return;
        setLive(l); setProcs(p); setTemp(t); setError(null);
      } catch (e) { if (!cancelled) setError((e as Error).message); }
    }
    refresh();
    const id = window.setInterval(() => { fetchLive().then(setLive).catch(() => {}); }, 2000);
    const idBig = window.setInterval(refresh, 15000);
    return () => { cancelled = true; window.clearInterval(id); window.clearInterval(idBig); };
  }, [desktop]);

  async function onClean() {
    setCleaning(true); setCleaned(null); setError(null);
    try { setCleaned(await cleanTemp()); await fetchTempInfo().then(setTemp); }
    catch (e) { setError((e as Error).message); }
    finally { setCleaning(false); }
  }

  if (!desktop) {
    return (
      <div className="h-full overflow-y-auto px-10 py-8">
        <EmptyState
          icon={<Zap className="h-6 w-6" />}
          title="Boost kræver desktop-appen"
          text="Live CPU/RAM-tal og oprydning kører kun i NOVYX til Windows."
        />
      </div>
    );
  }

  const memPct = live && live.memTotal ? (live.memUsed! / live.memTotal) * 100 : null;
  const tempTotal = temp?.reduce((a, b) => a + b.bytes, 0) ?? 0;
  const tempFiles = temp?.reduce((a, b) => a + b.files, 0) ?? 0;

  return (
    <div className="h-full overflow-y-auto px-10 py-8">
      {error && <ErrorBanner message={error} className="mb-6" />}

      <div className="grid grid-cols-3 gap-6">
        <Metric icon={<Cpu className="h-5 w-5" />} label="CPU-belastning"
          value={formatPercent(live?.cpuLoad, 1)}
          sub={live ? `Oppetid ${formatUptime(live.uptimeSec)}` : "—"} />
        <Metric icon={<MemoryStick className="h-5 w-5" />} label="Hukommelse"
          value={formatPercent(memPct, 0)}
          sub={live && live.memUsed && live.memTotal
            ? `${formatBytes(live.memUsed)} / ${formatBytes(live.memTotal)}` : "—"} />
        <Metric icon={<Trash2 className="h-5 w-5" />} label="Midlertidige filer"
          value={formatBytes(tempTotal)}
          sub={`${tempFiles.toLocaleString("da-DK")} filer i temp-mapper`} />
      </div>

      <div className="mt-8 glass-card" style={{ padding: "var(--card-pad)" }}>
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-low)]">
              Frigør plads
            </div>
            <h2 className="mt-2 text-[22px] font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
              Ryd op i midlertidige filer
            </h2>
            <p className="mt-2 max-w-[52ch] text-[13px] text-[color:var(--ink-mid)]">
              Sletter filer i din personlige TEMP-mappe. Låste eller aktive filer springes automatisk over.
              Kører ikke over system-mapper.
            </p>
            {cleaned && (
              <div className="mt-4 flex items-center gap-2 text-[13px] text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                Frigav {formatBytes(cleaned.freed)} · {cleaned.removed} filer fjernet · {cleaned.skipped} sprunget over
              </div>
            )}
          </div>
          <button
            onClick={onClean}
            disabled={cleaning}
            className="btn btn-primary shrink-0"
            style={{ padding: "10px 18px" }}
          >
            {cleaning ? (<><Loader2 className="h-4 w-4 animate-spin" /> Rydder op…</>)
                     : (<><Trash2 className="h-4 w-4" /> Ryd temp nu</>)}
          </button>
        </div>

        {temp && (
          <div className="mt-6 grid gap-2">
            {temp.map((t) => (
              <div key={t.path} className="flex items-center justify-between rounded-xl px-4 py-3 mat-matte">
                <div className="min-w-0">
                  <div className="truncate text-[12px] text-[color:var(--ink-mid)]">{t.path}</div>
                  <div className="text-[11px] text-[color:var(--ink-faint)]">{t.files.toLocaleString("da-DK")} filer</div>
                </div>
                <div className="text-[14px] font-semibold text-white">{formatBytes(t.bytes)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-[16px] font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
            Top processer efter hukommelse
          </h3>
          <div className="text-[11px] text-[color:var(--ink-faint)]">
            {procs ? `${procs.total} kørende` : "—"}
          </div>
        </div>
        <div className="glass-card overflow-hidden" style={{ padding: 0 }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-[0.18em] text-[color:var(--ink-faint)]">
                <th className="px-5 py-3 font-semibold">Proces</th>
                <th className="px-5 py-3 font-semibold">PID</th>
                <th className="px-5 py-3 text-right font-semibold">CPU</th>
                <th className="px-5 py-3 text-right font-semibold">RAM</th>
              </tr>
            </thead>
            <tbody>
              {(procs?.list ?? []).map((p) => (
                <tr key={p.pid} className="border-t border-white/[0.04] text-[color:var(--ink-mid)]">
                  <td className="truncate px-5 py-2.5 text-white">{p.name}</td>
                  <td className="px-5 py-2.5">{p.pid}</td>
                  <td className="px-5 py-2.5 text-right">{formatPercent(p.cpu, 1)}</td>
                  <td className="px-5 py-2.5 text-right">{formatBytes(p.memBytes)}</td>
                </tr>
              ))}
              {!procs && (
                <tr><td colSpan={4} className="px-5 py-6 text-center text-[color:var(--ink-faint)]">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Læser processer…
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="glass-card" style={{ padding: "var(--card-pad)", minHeight: 160 }}>
      <div className="flex items-start justify-between">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-low)]">{label}</div>
        <div className="grid h-10 w-10 place-items-center rounded-xl text-[color:var(--ink-hi)]"
          style={{ background: "var(--grad-primary-soft)", border: "1px solid rgba(59,130,246,0.24)" }}>
          {icon}
        </div>
      </div>
      <div className="mt-6 text-[36px] font-light text-white" style={{ fontFamily: "var(--font-display)" }}>{value}</div>
      <div className="mt-1 text-[12px] text-[color:var(--ink-faint)]">{sub}</div>
    </div>
  );
}
