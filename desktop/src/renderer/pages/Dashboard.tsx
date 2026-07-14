import { useEffect, useState } from "react";
import {
  Rocket, Gauge, Sparkles, ArrowUpRight, ShieldCheck, ShieldAlert, Activity,
  Cpu, MemoryStick, Wifi, Clock, HardDrive, Zap,
  Server, Cpu as ChipIcon, Lock, Radio, RefreshCw, ShieldQuestion,
} from "lucide-react";
import { PendingChip } from "../components/Pending";
import { ErrorBanner } from "../components/ErrorBanner";
import {
  isDesktop, fetchLive, scanHardware, exportDiagnostics,
  fetchSysInfo, fetchPing, isElevated, relaunchAsAdmin,
  readPersistedState, markLastScan,
  formatBytes, formatPercent, formatUptime, formatTemp,
  type LiveSnapshot, type HardwareReport, type SysInfo, type PingResult, type PersistedState,
} from "../lib/hardware";

const HISTORY_KEY = "novyx.dashboard.history.v1";

type HistoryEntry = { ts: number; label: string; detail: string };

function readHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
  catch { return []; }
}
function appendHistory(entry: HistoryEntry) {
  const cur = readHistory();
  const next = [entry, ...cur].slice(0, 12);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

function computeScore(live: LiveSnapshot | null, hw: HardwareReport | null, ping: PingResult | null): number | null {
  if (!live) return null;
  const cpuPenalty = live.cpuLoad != null ? Math.min(35, live.cpuLoad * 0.35) : 0;
  const memPct = live.memUsed != null && live.memTotal ? (live.memUsed / live.memTotal) * 100 : 0;
  const memPenalty = Math.min(25, memPct * 0.25);
  const tempPenalty = live.cpuTemp && live.cpuTemp > 75 ? Math.min(15, (live.cpuTemp - 75)) : 0;
  const gpuPenalty = hw?.gpus?.[0]?.utilization != null ? Math.min(10, (hw.gpus[0].utilization || 0) * 0.1) : 0;
  const netPenalty = ping && ping.avg != null
    ? Math.min(15, Math.max(0, ping.avg - 30) * 0.1) + Math.min(5, (ping.jitter ?? 0) * 0.5) + (ping.loss > 0 ? 10 * ping.loss : 0)
    : 0;
  return Math.max(0, Math.round(100 - cpuPenalty - memPenalty - tempPenalty - gpuPenalty - netPenalty));
}

function formatMs(v: number | null | undefined, decimals = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(decimals)} ms`;
}

function relTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "for få sekunder siden";
  if (diff < 3600_000) return `for ${Math.floor(diff / 60_000)} min. siden`;
  if (diff < 86_400_000) return `for ${Math.floor(diff / 3600_000)} t. siden`;
  return new Date(ts).toLocaleDateString();
}

export function DashboardPage() {
  const desktop = isDesktop();
  const [live, setLive] = useState<LiveSnapshot | null>(null);
  const [hw, setHw] = useState<HardwareReport | null>(null);
  const [sys, setSys] = useState<SysInfo | null>(null);
  const [ping, setPing] = useState<PingResult | null>(null);
  const [elevated, setElevated] = useState<boolean>(false);
  const [persisted, setPersisted] = useState<PersistedState>({});
  const [history, setHistory] = useState<HistoryEntry[]>(() => readHistory());
  const [busy, setBusy] = useState<null | "scan" | "export" | "ping" | "elevate">(null);
  const [error, setError] = useState<string | null>(null);

  // Live-polling (3s med overlap-guard)
  useEffect(() => {
    if (!desktop) return;
    let mounted = true;
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try { const s = await fetchLive(); if (mounted) setLive(s); }
      catch { /* transient */ }
      finally { running = false; }
    };
    tick();
    const id = window.setInterval(tick, 3000);
    return () => { mounted = false; window.clearInterval(id); };
  }, [desktop]);


  // Persisted state + admin/sys på mount
  useEffect(() => {
    if (!desktop) return;
    (async () => {
      try {
        const [info, elev, state] = await Promise.all([
          fetchSysInfo(false).catch((e: unknown) => { setError(e instanceof Error ? e.message : String(e)); return null; }),
          isElevated().catch(() => false),
          readPersistedState().catch(() => ({} as PersistedState)),
        ]);
        if (info) setSys(info);
        setElevated(elev);
        setPersisted(state);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    // Hardware-scan i baggrund til GPU/drev-vinder
    scanHardware().then(setHw).catch(() => {});
  }, [desktop]);

  // Ping-loop (hver 30s)
  useEffect(() => {
    if (!desktop) return;
    let mounted = true;
    const doPing = async () => {
      try { const r = await fetchPing("1.1.1.1", 5); if (mounted) setPing(r); }
      catch { /* silent */ }
    };
    doPing();
    const id = window.setInterval(doPing, 30_000);
    return () => { mounted = false; window.clearInterval(id); };
  }, [desktop]);

  const score = computeScore(live, hw, ping);
  const scoreLabel =
    score == null ? "—" : score >= 85 ? "Fremragende" : score >= 65 ? "Sundt" : score >= 45 ? "OK" : "Belastet";

  const runScan = async () => {
    setBusy("scan");
    setError(null);
    try {
      const report = await scanHardware();
      setHw(report);
      // Optæl "issues" simpelt: fyldte drev >90% + temp >85 + memPct >90
      let issues = 0;
      for (const f of report.storage?.filesystems ?? []) if (f.size && f.used / f.size > 0.9) issues++;
      if (report.sensors?.cpuMain && report.sensors.cpuMain > 85) issues++;
      if (report.memory && report.memory.total && report.memory.used / report.memory.total > 0.9) issues++;
      const next = await markLastScan({ issues, score });
      setPersisted(next);
      setHistory(appendHistory({
        ts: Date.now(),
        label: "Hardware-scanning fuldført",
        detail: `${report.cpu?.brand ?? "CPU"} · ${formatBytes(report.memory?.total)} RAM · ${issues} problem${issues === 1 ? "" : "er"}`,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(null); }
  };

  const runExport = async () => {
    setBusy("export");
    try {
      const p = await exportDiagnostics();
      if (p) setHistory(appendHistory({ ts: Date.now(), label: "Diagnostik eksporteret", detail: p }));
    } catch { /* user cancelled */ }
    finally { setBusy(null); }
  };

  const runPing = async () => {
    setBusy("ping");
    try { setPing(await fetchPing("1.1.1.1", 8)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };

  const doElevate = async () => {
    setBusy("elevate");
    try { await relaunchAsAdmin(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(null); }
  };

  const memPct = live?.memUsed != null && live.memTotal ? (live.memUsed / live.memTotal) * 100 : null;
  const gpuLoad = hw?.gpus?.[0]?.utilization ?? null;
  const primaryFs = hw?.storage.filesystems?.find((f) => f.mount === "C:") ?? hw?.storage.filesystems?.[0];
  const diskPct = primaryFs && primaryFs.size ? (primaryFs.used / primaryFs.size) * 100 : null;

  return (
    <div className="h-full overflow-y-auto stage">
      <div className="page-container settle-list">

        {/* ══════════ HERO ══════════ */}
        <section className="relative pt-6 pb-10">
          <span aria-hidden className="spot spot--blue" style={{ left: -180, top: -160, width: 620, height: 620, opacity: 0.55 }} />
          <span aria-hidden className="spot spot--cyan" style={{ right: -140, top: 40, width: 460, height: 460, opacity: 0.4 }} />
          <span aria-hidden className="faint-grid" />

          <div className="relative grid grid-cols-1 items-center gap-16 lg:grid-cols-[1.2fr_auto]">
            <div className="min-w-0">
              <span className="kicker">Kontrolcenter</span>
              <h1 className="display-xl mt-6">
                God dag.
                <br />
                <span className="grad-text">Din PC er klar.</span>
              </h1>
              <p className="hero-lead" style={{ marginTop: 22, maxWidth: 580 }}>
                Live-status fra din maskine — CPU, hukommelse, netværk, temperatur, BIOS, TPM og Secure Boot.
                Alt hentes lokalt.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-3">
                <button
                  className="btn btn-primary btn-lg"
                  disabled={!desktop || busy !== null}
                  onClick={runScan}
                >
                  <Rocket className="h-[18px] w-[18px]" strokeWidth={2} />
                  {busy === "scan" ? "Scanner…" : "Kør hardware-analyse"}
                </button>
                <button
                  className="btn btn-secondary btn-lg"
                  disabled={!desktop || busy !== null}
                  onClick={runExport}
                >
                  <Gauge className="h-[18px] w-[18px]" strokeWidth={2} />
                  {busy === "export" ? "Gemmer…" : "Eksportér diagnostik"}
                </button>
                {desktop && !elevated && (
                  <button
                    className="btn btn-ghost btn-lg"
                    disabled={busy !== null}
                    onClick={doElevate}
                    data-tooltip="Genstart NOVYX med administrator-rettigheder for at få adgang til Secure Boot, TPM og system-reparationer"
                  >
                    <ShieldAlert className="h-[18px] w-[18px]" strokeWidth={2} />
                    {busy === "elevate" ? "Anmoder om admin…" : "Kør som administrator"}
                  </button>
                )}
                {!desktop && <PendingChip label="Kun i desktop-appen" />}
                {desktop && elevated && (
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium"
                    style={{ background: "rgba(52,211,153,0.10)", color: "#6EE7B7", border: "1px solid rgba(52,211,153,0.25)" }}>
                    <ShieldCheck className="h-4 w-4" strokeWidth={2} /> Administrator
                  </span>
                )}
              </div>

              {error && (
                <div className="mt-6 max-w-2xl">
                  <ErrorBanner message={error} />
                </div>
              )}
            </div>

            <div className="relative shrink-0 justify-self-center lg:justify-self-end">
              <div className="hero-orb float-slow" />
              <div className="mt-8 text-center">
                <div className="kicker">System score</div>
                <div
                  className="big-num mt-3"
                  style={{
                    color: score == null ? "var(--ink-faint)" :
                      score >= 65 ? "var(--ink-hi)" : score >= 45 ? "#F5C15A" : "#F87171",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {score ?? "—"}
                </div>
                <div className="mt-2 text-[11px] tracking-[0.22em] uppercase text-[color:var(--ink-faint)]">
                  {desktop ? scoreLabel : "Kun i desktop-appen"}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════ LIVE-METRICS (4 kort) ══════════ */}
        <section className="section">
          <div className="section-head">
            <div>
              <div className="section-title">Live systembelastning</div>
              <div className="section-lead">CPU · RAM · GPU · Disk — opdateres hvert 2. sekund.</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-4 md:grid-cols-2">
            <MetricCard
              icon={<Cpu className="h-5 w-5" strokeWidth={1.75} />}
              label="CPU"
              value={formatPercent(live?.cpuLoad, 0)}
              bar={live?.cpuLoad ?? null}
              sub={formatTemp(live?.cpuTemp)}
            />
            <MetricCard
              icon={<MemoryStick className="h-5 w-5" strokeWidth={1.75} />}
              label="Hukommelse"
              value={formatPercent(memPct, 0)}
              bar={memPct}
              sub={live?.memUsed != null ? `${formatBytes(live.memUsed)} / ${formatBytes(live.memTotal)}` : "—"}
            />
            <MetricCard
              icon={<Zap className="h-5 w-5" strokeWidth={1.75} />}
              label="GPU"
              value={gpuLoad != null ? formatPercent(gpuLoad, 0) : "—"}
              bar={gpuLoad}
              sub={hw?.gpus?.[0]
                ? `${hw.gpus[0].model ?? "GPU"}${hw.gpus[0].temp != null ? " · " + formatTemp(hw.gpus[0].temp) : ""}`
                : "Afventer scanning"}
            />
            <MetricCard
              icon={<HardDrive className="h-5 w-5" strokeWidth={1.75} />}
              label={`Disk ${primaryFs?.mount ?? ""}`.trim()}
              value={diskPct != null ? formatPercent(diskPct, 0) : "—"}
              bar={diskPct}
              sub={primaryFs ? `${formatBytes(primaryFs.used)} / ${formatBytes(primaryFs.size)}` : "—"}
            />
          </div>
        </section>

        {/* ══════════ NETVÆRK + OPPETID ══════════ */}
        <section className="section">
          <div className="section-head">
            <div>
              <div className="section-title">Netværk & drift</div>
              <div className="section-lead">Live download/upload, ping mod 1.1.1.1, oppetid.</div>
            </div>
            <button className="btn btn-ghost btn-sm" disabled={!desktop || busy !== null} onClick={runPing}>
              <RefreshCw className={`h-4 w-4 ${busy === "ping" ? "animate-spin" : ""}`} strokeWidth={2} />
              {busy === "ping" ? "Pinger…" : "Opdater ping"}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-4 md:grid-cols-2">
            <MetricCard
              icon={<Wifi className="h-5 w-5" strokeWidth={1.75} />}
              label="Download"
              value={live?.rxSec != null ? `${formatBytes(live.rxSec)}/s` : "—"}
              bar={null}
              sub={hw?.network?.ifaceName || hw?.network?.iface || "—"}
            />
            <MetricCard
              icon={<Wifi className="h-5 w-5" strokeWidth={1.75} />}
              label="Upload"
              value={live?.txSec != null ? `${formatBytes(live.txSec)}/s` : "—"}
              bar={null}
              sub={hw?.network?.type || "—"}
            />
            <MetricCard
              icon={<Radio className="h-5 w-5" strokeWidth={1.75} />}
              label="Ping"
              value={formatMs(ping?.avg, 1)}
              bar={null}
              sub={ping ? `jitter ${formatMs(ping.jitter, 1)} · tab ${(ping.loss * 100).toFixed(0)}%` : "—"}
            />
            <MetricCard
              icon={<Clock className="h-5 w-5" strokeWidth={1.75} />}
              label="Oppetid"
              value={live ? formatUptime(live.uptimeSec) : "—"}
              bar={null}
              sub={sys?.os?.caption ? `${sys.os.caption} · Build ${sys.os.build ?? "—"}` : (hw?.os ? `${hw.os.distro} ${hw.os.release}` : "—")}
            />
          </div>
        </section>

        {/* ══════════ SYSTEMSTATUS (BIOS/TPM/SECURE BOOT/DEFENDER) ══════════ */}
        <section className="section">
          <div className="section-head">
            <div>
              <div className="section-title">Systemstatus</div>
              <div className="section-lead">
                Windows, BIOS, sikkerhedsindstillinger.
                {sys && !elevated && sys.secureBoot === "unknown" && (
                  <span className="ml-2 text-[color:var(--ink-faint)]">
                    · Secure Boot og TPM kræver administrator-rettigheder
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-4 md:grid-cols-2">
            <StatusCard
              icon={<Server className="h-5 w-5" strokeWidth={1.75} />}
              label="Windows"
              value={sys?.os?.caption ?? "—"}
              detail={sys?.os
                ? `${sys.os.arch ?? ""} · Build ${sys.os.build ?? "—"} · v${sys.os.version ?? "—"}`
                : "Afventer …"}
              tone="info"
            />
            <StatusCard
              icon={<ChipIcon className="h-5 w-5" strokeWidth={1.75} />}
              label="BIOS / UEFI"
              value={sys?.bios?.version ?? "—"}
              detail={sys?.bios
                ? `${sys.bios.vendor ?? "—"}${sys.bios.releaseDate ? " · " + new Date(sys.bios.releaseDate).toLocaleDateString() : ""}`
                : "Afventer …"}
              tone="info"
            />
            <StatusCard
              icon={<Lock className="h-5 w-5" strokeWidth={1.75} />}
              label="Secure Boot"
              value={sys?.secureBoot === "on" ? "Aktiv" : sys?.secureBoot === "off" ? "Deaktiveret" : "Kræver admin"}
              detail={sys?.secureBoot === "on" ? "UEFI beskyttet opstart" : sys?.secureBoot === "off" ? "Anbefales aktiveret" : "Kør som administrator"}
              tone={sys?.secureBoot === "on" ? "good" : sys?.secureBoot === "off" ? "warn" : "muted"}
            />
            <StatusCard
              icon={<ShieldQuestion className="h-5 w-5" strokeWidth={1.75} />}
              label="TPM"
              value={sys?.tpm
                ? (sys.tpm.ready ? "Klar" : sys.tpm.present ? "Til stede" : "Ikke fundet")
                : (elevated ? "Ikke fundet" : "Kræver admin")}
              detail={sys?.tpm
                ? `${sys.tpm.manufacturer ?? "—"}${sys.tpm.version ? " · " + sys.tpm.version : ""}`
                : (elevated ? "Ingen TPM-chip detekteret" : "Kør som administrator")}
              tone={sys?.tpm?.ready ? "good" : sys?.tpm?.present ? "warn" : "muted"}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <StatusCard
              icon={<ShieldCheck className="h-5 w-5" strokeWidth={1.75} />}
              label="Windows Defender"
              value={sys?.defender
                ? (sys.defender.realtimeEnabled ? "Realtime aktiv" : "Realtime deaktiveret")
                : "—"}
              detail={sys?.defender
                ? `Motor ${sys.defender.engineVersion ?? "—"}${sys.defender.lastQuickScan ? " · scan " + relTime(sys.defender.lastQuickScan) : ""}`
                : "Afventer …"}
              tone={sys?.defender?.realtimeEnabled ? "good" : "warn"}
            />
            <StatusCard
              icon={<Activity className="h-5 w-5" strokeWidth={1.75} />}
              label="Seneste scanning"
              value={persisted.lastScan ? relTime(persisted.lastScan.ts) : "Aldrig"}
              detail={persisted.lastScan
                ? `${persisted.lastScan.issues ?? 0} problem${persisted.lastScan.issues === 1 ? "" : "er"} · score ${persisted.lastScan.score ?? "—"}`
                : "Ingen scanning kørt endnu"}
              tone={persisted.lastScan ? "info" : "muted"}
            />
            <StatusCard
              icon={<Sparkles className="h-5 w-5" strokeWidth={1.75} />}
              label="Seneste optimering"
              value={persisted.lastOptimize ? relTime(persisted.lastOptimize.ts) : "Aldrig"}
              detail={persisted.lastOptimize
                ? persisted.lastOptimize.label + (persisted.lastOptimize.detail ? " · " + persisted.lastOptimize.detail : "")
                : "Ingen optimering kørt endnu"}
              tone={persisted.lastOptimize ? "info" : "muted"}
            />
          </div>
        </section>

        {/* ══════════ ANBEFALET NU ══════════ */}
        <section className="section relative">
          <div className="section-head">
            <div>
              <div className="section-title">Anbefalet nu</div>
              <div className="section-lead">Én tydelig handling. Ingen støj.</div>
            </div>
          </div>

          <div className="mat-tinted reactive relative" style={{ padding: "44px 52px", minHeight: 200 }}>
            <span aria-hidden className="lightline lightline--top" />
            <span aria-hidden className="spot spot--blue" style={{ right: -80, top: -80, width: 320, height: 320, opacity: 0.35 }} />
            <div className="relative flex flex-wrap items-center gap-10">
              <div className="illus-ring">
                <Sparkles className="h-8 w-8 text-white" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="display-md">
                  {hw ? "Se din komplette hardware-rapport" : "Kør din første analyse"}
                </div>
                <div className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-[color:var(--ink-low)]">
                  {hw
                    ? `${hw.cpu?.brand ?? "CPU"} · ${formatBytes(hw.memory?.total)} RAM · ${hw.gpus?.[0]?.model ?? "GPU"} — åbn Specs for fuld gennemgang.`
                    : "NOVYX læser CPU, GPU, RAM, drev, sensorer og netværk lokalt fra din maskine. Intet forlader din PC."}
                </div>
              </div>
              <button className="btn btn-primary btn-lg shrink-0" disabled={!desktop || busy !== null} onClick={runScan}>
                {hw ? "Scan igen" : "Start scanning"}
                <ArrowUpRight className="h-[16px] w-[16px]" strokeWidth={2} />
              </button>
            </div>
          </div>
        </section>

        {/* ══════════ HISTORIK ══════════ */}
        <section className="section pb-8">
          <div className="section-head">
            <div>
              <div className="section-title">Historik</div>
              <div className="section-lead">Seneste kørsler i denne installation.</div>
            </div>
          </div>

          <div className="mat-frosted" style={{ padding: 20 }}>
            <div className="flex flex-col gap-2">
              {history.length === 0 ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 rounded-xl px-4 py-4"
                    style={{ background: "rgba(255,255,255,0.018)", border: "1px dashed var(--hairline-strong)" }}>
                    <span className="status-dot" />
                    <span className="text-[13px] text-[color:var(--ink-faint)]">Ingen aktivitet registreret</span>
                    <span className="ml-auto text-[11.5px] text-[color:var(--ink-faint)]">—</span>
                  </div>
                ))
              ) : (
                history.map((h) => (
                  <div key={h.ts} className="flex items-center gap-4 rounded-xl px-4 py-4"
                    style={{ background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span className="status-dot" style={{ background: "#34D399" }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] text-[color:var(--ink-hi)]">{h.label}</div>
                      <div className="mt-0.5 truncate text-[12px] text-[color:var(--ink-faint)]" title={h.detail}>{h.detail}</div>
                    </div>
                    <span className="ml-auto text-[11.5px] text-[color:var(--ink-faint)]">
                      {new Date(h.ts).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, sub, bar }: {
  icon: React.ReactNode; label: string; value: string; sub: string; bar: number | null;
}) {
  return (
    <div className="mat-frosted reactive relative" style={{ padding: 22, minHeight: 148 }}>
      <div className="flex items-center justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-xl"
          style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.28), rgba(34,211,238,0.14))",
            border: "1px solid rgba(59,130,246,0.28)", color: "white" }}>
          {icon}
        </span>
        <div className="kicker">{label}</div>
      </div>
      <div className="mt-4 text-[32px] font-semibold text-[color:var(--ink-hi)]"
        style={{ fontFamily: "var(--font-display)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
        {value}
      </div>
      {bar != null && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${Math.min(100, Math.max(0, bar))}%`,
              background: bar > 85 ? "#F87171" : bar > 65 ? "#F5C15A" : "linear-gradient(90deg,#22D3EE,#3B82F6)" }} />
        </div>
      )}
      <div className="mt-2 text-[12px] text-[color:var(--ink-low)]">{sub}</div>
    </div>
  );
}

function StatusCard({ icon, label, value, detail, tone }: {
  icon: React.ReactNode; label: string; value: string; detail: string;
  tone: "good" | "warn" | "info" | "muted";
}) {
  const palette = {
    good:  { bg: "rgba(52,211,153,0.10)", border: "rgba(52,211,153,0.28)", text: "#6EE7B7" },
    warn:  { bg: "rgba(245,193,90,0.10)", border: "rgba(245,193,90,0.28)", text: "#F5C15A" },
    info:  { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.28)", text: "#93C5FD" },
    muted: { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.10)", text: "var(--ink-faint)" },
  }[tone];
  return (
    <div className="mat-frosted reactive relative" style={{ padding: 22, minHeight: 132 }}>
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl"
          style={{ background: palette.bg, border: `1px solid ${palette.border}`, color: palette.text }}>
          {icon}
        </span>
        <div className="kicker">{label}</div>
      </div>
      <div className="mt-3 text-[18px] font-semibold text-[color:var(--ink-hi)] truncate"
        style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.015em" }} title={value}>
        {value}
      </div>
      <div className="mt-1 text-[12px] text-[color:var(--ink-low)] truncate" title={detail}>
        {detail}
      </div>
    </div>
  );
}
