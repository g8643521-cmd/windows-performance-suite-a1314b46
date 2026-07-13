import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Wrench, ShieldCheck, ShieldAlert, Network, RefreshCw, Store, Printer, Monitor,
  Image as ImageIcon, Loader2, X, CheckCircle2, AlertTriangle, Play, RotateCcw,
  Terminal, Info,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PendingChip } from "../components/Pending";
import { isDesktop } from "../lib/hardware";
import { relaunchAsAdmin } from "../lib/hardware";
import {
  listRepairActions, isRepairElevated, startRepair, cancelRepair, subscribeRepair,
  type RepairAction, type RepairEvent, type RepairLogLevel,
} from "../lib/repair-center";

// ─────────────────────────────────────────────────────────────
// Icons pr. action-id (fallback = Wrench)
// ─────────────────────────────────────────────────────────────
const ICONS: Record<string, LucideIcon> = {
  "sfc": ShieldCheck,
  "dism-check": ShieldCheck,
  "dism-scan": ShieldCheck,
  "dism-restore": ShieldAlert,
  "flushdns": Network,
  "winsock-reset": Network,
  "ip-reset": Network,
  "wu-reset": RefreshCw,
  "wsreset": Store,
  "explorer-restart": Monitor,
  "spooler-restart": Printer,
  "iconcache-rebuild": ImageIcon,
  "network-repair": Network,
};

// Grupper til visuel struktur
const GROUPS: { title: string; ids: string[] }[] = [
  { title: "System-integritet",       ids: ["sfc", "dism-check", "dism-scan", "dism-restore"] },
  { title: "Netværk",                 ids: ["flushdns", "network-repair", "winsock-reset", "ip-reset"] },
  { title: "Services & Windows-shell", ids: ["wu-reset", "wsreset", "explorer-restart", "spooler-restart", "iconcache-rebuild"] },
];

type LogLine = { ts: number; level: RepairLogLevel; text: string };
type JobState =
  | { kind: "idle" }
  | { kind: "confirming"; action: RepairAction }
  | { kind: "running"; action: RepairAction; jobId: string; log: LogLine[]; startedAt: number }
  | { kind: "done"; action: RepairAction; log: LogLine[]; code: number; needsReboot: boolean; cancelled: boolean; error: string | null };

export function RepairsPage() {
  const desktop = isDesktop();
  const [actions, setActions] = useState<RepairAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [elevated, setElevated] = useState<boolean | null>(null);
  const [job, setJob] = useState<JobState>({ kind: "idle" });
  const [createRP, setCreateRP] = useState(true);
  const logRef = useRef<HTMLDivElement | null>(null);

  // Hent liste + admin-status
  useEffect(() => {
    if (!desktop) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const [list, elev] = await Promise.all([listRepairActions(), isRepairElevated()]);
        if (cancelled) return;
        setActions(list);
        setElevated(elev);
      } catch (e) {
        if (!cancelled) setListError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [desktop]);

  // Live-stream event subscription (aktiv altid, filtrerer på jobId)
  useEffect(() => {
    if (!desktop) return;
    const off = subscribeRepair((evt: RepairEvent) => {
      setJob((prev) => {
        if (prev.kind !== "running" || evt.jobId !== prev.jobId) return prev;
        if (evt.kind === "log") {
          return { ...prev, log: [...prev.log, { ts: evt.ts, level: evt.level, text: evt.line }] };
        }
        if (evt.kind === "done") {
          return {
            kind: "done",
            action: prev.action,
            log: prev.log,
            code: evt.code,
            needsReboot: !!evt.needsReboot,
            cancelled: !!evt.cancelled,
            error: evt.error ?? (evt.code === 0 ? null : `Afsluttet med kode ${evt.code}`),
          };
        }
        return prev;
      });
    });
    return off;
  }, [desktop]);

  // Auto-scroll log
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [job.kind === "running" ? (job as { log: LogLine[] }).log.length : 0, job.kind]);

  const byId = useMemo(() => {
    const m = new Map<string, RepairAction>();
    actions.forEach((a) => m.set(a.id, a));
    return m;
  }, [actions]);

  const requestRun = useCallback((action: RepairAction) => {
    setCreateRP(action.restoreOffered);
    setJob({ kind: "confirming", action });
  }, []);

  const confirmRun = useCallback(async () => {
    if (job.kind !== "confirming") return;
    const action = job.action;
    if (action.admin && elevated === false) {
      setJob({
        kind: "done", action, log: [],
        code: -1, needsReboot: false, cancelled: false,
        error: "Kræver administrator. Genstart NOVYX som admin fra Indstillinger.",
      });
      return;
    }
    try {
      const { jobId } = await startRepair(action.id, { createRestorePoint: createRP && action.restoreOffered });
      setJob({ kind: "running", action, jobId, log: [], startedAt: Date.now() });
    } catch (e) {
      const err = e as Error & { needsElevation?: boolean };
      setJob({
        kind: "done", action, log: [],
        code: -1, needsReboot: false, cancelled: false,
        error: err.message,
      });
    }
  }, [job, elevated, createRP]);

  const doCancel = useCallback(async () => {
    if (job.kind !== "running") return;
    await cancelRepair(job.jobId);
  }, [job]);

  const dismissResult = useCallback(() => setJob({ kind: "idle" }), []);

  const onRelaunchAdmin = useCallback(async () => {
    try { await relaunchAsAdmin(); } catch { /* Ignoreret */ }
  }, []);

  return (
    <div className="h-full overflow-y-auto stage">
      <div className="page-container settle-list">

        {/* ══════════ HERO ══════════ */}
        <section className="relative pt-4">
          <span aria-hidden className="spot spot--blue" style={{ left: -140, top: -120, width: 460, height: 460, opacity: 0.35 }} />
          <div className="mat-frosted sh-ambient relative overflow-hidden" style={{ padding: "56px 56px", borderRadius: "var(--r-hero)" }}>
            <span aria-hidden className="lightline lightline--top" style={{ left: "10%", right: "10%" }} />
            <div className="grid grid-cols-1 items-start gap-14 lg:grid-cols-[1.3fr_auto]">
              <div className="max-w-2xl">
                <span className="kicker">Repair Center</span>
                <h1 className="display-lg mt-5">
                  Rigtige Windows-<br />
                  <span className="grad-text">reparationer.</span>
                </h1>
                <p className="hero-lead" style={{ marginTop: 20 }}>
                  SFC, DISM, netværks-reset og shell-værktøjer kører direkte i NOVYX
                  med live-log, cancel og valgfrit systemgendannelsespunkt.
                </p>
                <div className="mt-10 flex flex-wrap items-center gap-3">
                  {elevated === true && (
                    <span className="chip chip-emerald">
                      <ShieldCheck className="h-3 w-3" strokeWidth={2.2} />
                      Kører som administrator
                    </span>
                  )}
                  {elevated === false && (
                    <>
                      <span className="chip" style={{ background: "rgba(251,146,60,0.14)", color: "#fbbf24" }}>
                        <ShieldAlert className="h-3 w-3" strokeWidth={2.2} />
                        Ikke elevated — admin-værktøjer er låst
                      </span>
                      <button className="btn btn-secondary" onClick={onRelaunchAdmin}>
                        Genstart som admin
                      </button>
                    </>
                  )}
                  {!desktop && <PendingChip label="Kun i desktop-appen" />}
                </div>
              </div>
              <div className="relative shrink-0 justify-self-center lg:justify-self-end">
                <div
                  className="relative grid h-[200px] w-[180px] place-items-center overflow-hidden"
                  style={{
                    background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)), linear-gradient(135deg, rgba(59,130,246,0.35), rgba(34,211,238,0.18) 60%, rgba(8,10,16,0.9))",
                    border: "1px solid rgba(59,130,246,0.3)",
                    borderRadius: "44% 44% 42% 42% / 32% 32% 55% 55%",
                    boxShadow: "0 40px 80px -20px rgba(59,130,246,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
                  }}
                >
                  <Wrench className="h-24 w-24 text-white" strokeWidth={1.25} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════ FEJL / LOADING ══════════ */}
        {loading && (
          <section className="section">
            <div className="calm-row"><Loader2 className="h-4 w-4 animate-spin" /> Henter reparations-værktøjer…</div>
          </section>
        )}
        {listError && (
          <section className="section">
            <div className="calm-row" style={{ color: "#fca5a5" }}>
              <AlertTriangle className="h-4 w-4" /> {listError}
            </div>
          </section>
        )}

        {/* ══════════ VÆRKTØJS-GRUPPER ══════════ */}
        {!loading && !listError && desktop && GROUPS.map((group) => {
          const rows = group.ids.map((id) => byId.get(id)).filter(Boolean) as RepairAction[];
          if (rows.length === 0) return null;
          return (
            <section key={group.title} className="section">
              <div className="section-head">
                <div>
                  <div className="section-title">{group.title}</div>
                </div>
              </div>
              <div className="settle-list flex flex-col gap-3">
                {rows.map((a) => {
                  const Icon = ICONS[a.id] ?? Wrench;
                  const disabled = job.kind === "running" || job.kind === "confirming";
                  const locked = a.admin && elevated === false;
                  return (
                    <div key={a.id} className="calm-row">
                      <div className="calm-row__icon">
                        <Icon className="h-6 w-6 text-white/90" strokeWidth={1.6} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[17px] font-semibold text-white"
                          style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
                          {a.label}
                          {a.admin && <span className="chip ml-3" style={{ verticalAlign: "middle" }}>Admin</span>}
                          {a.needsReboot && <span className="chip ml-2" style={{ verticalAlign: "middle", background: "rgba(251,146,60,0.14)", color: "#fbbf24" }}>Kræver genstart</span>}
                          {a.cancelable && <span className="chip ml-2" style={{ verticalAlign: "middle" }}>Kan annulleres</span>}
                        </div>
                        <div className="mt-1 text-[13.5px] leading-relaxed text-[color:var(--ink-mid)]">
                          {a.description}
                        </div>
                        {locked && (
                          <div className="mt-2 inline-flex items-center gap-2 text-[12px] text-amber-300">
                            <ShieldAlert className="h-3.5 w-3.5" /> Kræver at NOVYX genstartes som admin
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <button
                          className="btn btn-secondary"
                          disabled={disabled || locked}
                          onClick={() => requestRun(a)}
                        >
                          <Play className="h-4 w-4" strokeWidth={2} /> Kør
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* Padding for sticky panel */}
        {(job.kind === "running" || job.kind === "done") && <div style={{ height: 320 }} aria-hidden />}
      </div>

      {/* ══════════ BEKRÆFTELSE MODAL ══════════ */}
      {job.kind === "confirming" && (
        <ConfirmModal
          action={job.action}
          createRestorePoint={createRP}
          setCreateRestorePoint={setCreateRP}
          onCancel={() => setJob({ kind: "idle" })}
          onConfirm={confirmRun}
        />
      )}

      {/* ══════════ LIVE-LOG PANEL (sticky bund) ══════════ */}
      {(job.kind === "running" || job.kind === "done") && (
        <LivePanel
          job={job}
          logRef={logRef}
          onCancel={doCancel}
          onClose={dismissResult}
          onRunAgain={() => job.kind === "done" && requestRun(job.action)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Bekræftelses-modal
// ─────────────────────────────────────────────────────────────
function ConfirmModal({
  action, createRestorePoint, setCreateRestorePoint, onCancel, onConfirm,
}: {
  action: RepairAction;
  createRestorePoint: boolean;
  setCreateRestorePoint: (v: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center"
      style={{ background: "rgba(4,6,12,0.72)", backdropFilter: "blur(8px)" }}
      onClick={onCancel}
    >
      <div
        className="mat-frosted sh-ambient relative w-[min(560px,92vw)] p-8"
        style={{ borderRadius: "var(--r-hero)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className="calm-row__icon"><Info className="h-6 w-6 text-white/90" strokeWidth={1.6} /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[18px] font-semibold text-white" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
              Bekræft: {action.label}
            </div>
            <div className="mt-2 text-[13.5px] leading-relaxed text-[color:var(--ink-mid)]">
              {action.description}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {action.admin && <span className="chip">Admin</span>}
              {action.needsReboot && <span className="chip" style={{ background: "rgba(251,146,60,0.14)", color: "#fbbf24" }}>Kræver genstart bagefter</span>}
              {action.cancelable && <span className="chip">Kan annulleres</span>}
            </div>

            {action.restoreOffered && (
              <label className="mt-5 flex cursor-pointer items-center gap-3 text-[13.5px] text-white/90">
                <input
                  type="checkbox"
                  checked={createRestorePoint}
                  onChange={(e) => setCreateRestorePoint(e.target.checked)}
                  className="h-4 w-4"
                />
                Opret systemgendannelsespunkt før handlingen (anbefales)
              </label>
            )}
          </div>
        </div>
        <div className="mt-7 flex items-center justify-end gap-3">
          <button className="btn btn-secondary" onClick={onCancel}>Annullér</button>
          <button className="btn btn-primary" onClick={onConfirm}>
            <Play className="h-4 w-4" strokeWidth={2} /> Kør nu
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Live-log panel (sticky bund)
// ─────────────────────────────────────────────────────────────
function LivePanel({
  job, logRef, onCancel, onClose, onRunAgain,
}: {
  job: Extract<JobState, { kind: "running" }> | Extract<JobState, { kind: "done" }>;
  logRef: React.MutableRefObject<HTMLDivElement | null>;
  onCancel: () => void;
  onClose: () => void;
  onRunAgain: () => void;
}) {
  const running = job.kind === "running";
  const success = job.kind === "done" && !job.error && !job.cancelled && job.code === 0;
  const cancelled = job.kind === "done" && job.cancelled;
  const failed = job.kind === "done" && !!job.error;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10"
      style={{
        background: "linear-gradient(180deg, rgba(11,11,18,0.92), rgba(6,7,13,0.98))",
        backdropFilter: "blur(14px)",
        boxShadow: "0 -18px 60px -20px rgba(0,0,0,0.6)",
      }}
    >
      <div className="mx-auto max-w-[1200px] px-8 py-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-full"
            style={{ background: running ? "rgba(59,130,246,0.18)" : success ? "rgba(16,185,129,0.18)" : cancelled ? "rgba(148,163,184,0.18)" : "rgba(239,68,68,0.18)" }}>
            {running && <Loader2 className="h-4 w-4 animate-spin text-blue-300" strokeWidth={2.2} />}
            {success && <CheckCircle2 className="h-4 w-4 text-emerald-300" strokeWidth={2.2} />}
            {cancelled && <X className="h-4 w-4 text-slate-300" strokeWidth={2.2} />}
            {failed && <AlertTriangle className="h-4 w-4 text-red-300" strokeWidth={2.2} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-white">
              <Terminal className="h-4 w-4 text-white/60" />
              {job.action.label}
              {running && <span className="chip ml-2">Kører…</span>}
              {success && <span className="chip chip-emerald ml-2">Færdig</span>}
              {cancelled && <span className="chip ml-2">Annulleret</span>}
              {failed && <span className="chip ml-2" style={{ background: "rgba(239,68,68,0.16)", color: "#fca5a5" }}>Fejl</span>}
              {job.kind === "done" && job.needsReboot && (
                <span className="chip ml-2" style={{ background: "rgba(251,146,60,0.14)", color: "#fbbf24" }}>Genstart Windows</span>
              )}
            </div>
            {job.kind === "done" && job.error && (
              <div className="mt-1 text-[12.5px] text-red-300">{job.error}</div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {running && job.action.cancelable && (
              <button className="btn btn-secondary" onClick={onCancel}>
                <X className="h-4 w-4" strokeWidth={2} /> Annullér
              </button>
            )}
            {job.kind === "done" && (
              <>
                <button className="btn btn-secondary" onClick={onRunAgain}>
                  <RotateCcw className="h-4 w-4" strokeWidth={2} /> Kør igen
                </button>
                <button className="btn btn-secondary" onClick={onClose}>Luk</button>
              </>
            )}
          </div>
        </div>

        <div
          ref={logRef}
          className="max-h-[220px] overflow-y-auto rounded-lg border border-white/10 p-3 font-mono text-[12px] leading-relaxed"
          style={{ background: "rgba(2,4,8,0.65)" }}
        >
          {job.log.length === 0 ? (
            <div className="text-white/40">Venter på output…</div>
          ) : (
            job.log.map((l, i) => (
              <div key={i} className="whitespace-pre-wrap" style={{ color: colorFor(l.level) }}>
                <span className="mr-2 text-white/30">{formatTs(l.ts)}</span>
                {l.text}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function colorFor(level: RepairLogLevel): string {
  switch (level) {
    case "err":  return "#fca5a5";
    case "warn": return "#fbbf24";
    case "info": return "#93c5fd";
    default:     return "#d1d5db";
  }
}

function formatTs(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
