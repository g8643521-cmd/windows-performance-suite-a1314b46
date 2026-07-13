import { useEffect, useState } from "react";
import {
  ScanSearch, Loader2, RefreshCw, AlertTriangle, Info, CheckCircle2,
  Trash2, HelpCircle, Sparkles,
} from "lucide-react";
import { EmptyState } from "../components/Pending";
import { ErrorBanner } from "../components/ErrorBanner";
import { isDesktop, formatBytes } from "../lib/hardware";

type Severity = "ok" | "notice" | "warn" | "unknown";

type FixSpec = { id: string; label: string; admin?: boolean };

type Category = {
  id: string;
  label: string;
  detail?: string;
  bytes: number;
  severity: Severity;
  fix: FixSpec | null;
  items?: unknown[];
  error?: string;
};

type ScanReport = {
  ts: number;
  durationMs: number;
  totalReclaimable: number;
  categories: Category[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const scanApi = () => (window as any)?.novyx?.scan as
  | { full: () => Promise<{ ok: boolean; data?: ScanReport; error?: string }>;
      fix: (id: string) => Promise<{ ok: boolean; error?: string; data?: unknown }>; }
  | undefined;

export function SystemScanPage() {
  const desktop = isDesktop();
  const [report, setReport] = useState<ScanReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fixing, setFixing] = useState<string | null>(null);
  const [fixMsg, setFixMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  async function run() {
    const api = scanApi();
    if (!api) { setError("Desktop-API ikke tilgængelig"); return; }
    setBusy(true); setError(null); setFixMsg(null);
    const r = await api.full();
    if (!r.ok || !r.data) setError(r.error || "Scan fejlede");
    else setReport(r.data);
    setBusy(false);
  }

  async function runFix(fix: FixSpec) {
    const api = scanApi();
    if (!api) return;
    setFixing(fix.id); setFixMsg(null);
    const r = await api.fix(fix.id);
    setFixing(null);
    if (r.ok) {
      setFixMsg({ id: fix.id, ok: true, text: `${fix.label} fuldført` });
      run();
    } else {
      setFixMsg({ id: fix.id, ok: false, text: r.error || "Handling fejlede" });
    }
  }

  useEffect(() => { if (desktop) run(); /* eslint-disable-next-line */ }, [desktop]);

  if (!desktop) {
    return (
      <div className="h-full overflow-y-auto px-10 py-8">
        <EmptyState icon={<ScanSearch className="h-6 w-6" />} title="System Scan kræver desktop-appen"
          text="Denne scan læser rigtige data fra din Windows-PC og kører kun i NOVYX-appen." />
      </div>
    );
  }

  const cats = report?.categories ?? [];
  const warnCount = cats.filter((c) => c.severity === "warn").length;
  const noticeCount = cats.filter((c) => c.severity === "notice").length;
  const reclaimable = report?.totalReclaimable ?? 0;

  return (
    <div className="h-full overflow-y-auto px-10 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-low)]">
            Intelligent System Scan
          </div>
          <h2 className="mt-2 text-[22px] font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
            {busy ? "Scanner…"
              : reclaimable > 0
                ? `${formatBytes(reclaimable)} kan frigøres`
                : warnCount > 0
                  ? `${warnCount} advarsel${warnCount === 1 ? "" : "sler"} · ${noticeCount} anbefaling${noticeCount === 1 ? "" : "er"}`
                  : report ? "Alt ser rent ud" : "Klar til scan"}
          </h2>
          {report && (
            <div className="mt-1 text-[12px] text-[color:var(--ink-faint)]">
              {cats.length} kategorier · {(report.durationMs / 1000).toFixed(1)}s
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {reclaimable > 0 && (
            <button
              onClick={() => {
                const safeIds = new Set(["temp", "recyclebin", "browsercache", "wucache"]);
                const safeFixes = cats.filter((c) => c.fix && safeIds.has(c.fix.id));
                safeFixes.reduce<Promise<void>>((p, c) => p.then(() => c.fix ? runFix(c.fix) : Promise.resolve()), Promise.resolve());
              }}
              disabled={busy || !!fixing}
              className="btn"
              style={{ padding: "10px 16px" }}
            >
              <Sparkles className="h-4 w-4" /> Fix alt sikkert
            </button>
          )}
          <button onClick={run} disabled={busy} className="btn btn-primary" style={{ padding: "10px 18px" }}>
            {busy ? (<><Loader2 className="h-4 w-4 animate-spin" /> Scanner…</>)
                  : (<><RefreshCw className="h-4 w-4" /> Scan igen</>)}
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} className="mb-6" />}

      {!report && !error && (
        <div className="glass-card grid place-items-center py-14 text-[color:var(--ink-faint)]" style={{ padding: 24 }}>
          <Loader2 className="mb-3 h-5 w-5 animate-spin" />
          Kører system scan…
        </div>
      )}

      <div className="grid gap-3">
        {cats.map((c) => (
          <CategoryRow
            key={c.id}
            c={c}
            fixing={fixing === c.fix?.id}
            onFix={() => c.fix && runFix(c.fix)}
            msg={fixMsg && c.fix && fixMsg.id === c.fix.id ? fixMsg : null}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryRow({
  c, fixing, onFix, msg,
}: {
  c: Category;
  fixing: boolean;
  onFix: () => void;
  msg: { text: string; ok: boolean } | null;
}) {
  const style = c.severity === "warn"
    ? { icon: <AlertTriangle className="h-4 w-4" />, color: "text-amber-300", border: "border-amber-500/25", bg: "bg-amber-500/10", label: "Advarsel" }
    : c.severity === "notice"
    ? { icon: <Info className="h-4 w-4" />, color: "text-sky-300", border: "border-sky-500/25", bg: "bg-sky-500/10", label: "Anbefaling" }
    : c.severity === "unknown"
    ? { icon: <HelpCircle className="h-4 w-4" />, color: "text-white/60", border: "border-white/10", bg: "bg-white/5", label: "Ukendt" }
    : { icon: <CheckCircle2 className="h-4 w-4" />, color: "text-emerald-300", border: "border-emerald-500/20", bg: "bg-emerald-500/10", label: "OK" };

  return (
    <div className={`flex items-center gap-4 rounded-2xl border ${style.border} ${style.bg} px-5 py-4`}>
      <div className={`grid h-9 w-9 place-items-center rounded-xl ${style.color} bg-black/20`}>{style.icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <div className="text-[14px] font-semibold text-white">{c.label}</div>
          {c.bytes > 0 && (
            <div className="text-[12px] font-mono text-[color:var(--ink-mid)]">{formatBytes(c.bytes)}</div>
          )}
        </div>
        <div className="text-[12px] text-[color:var(--ink-mid)]">
          {c.error ? <span className="text-amber-300/80">Fejl: {c.error}</span> : c.detail}
        </div>
        {msg && (
          <div className={`mt-1 text-[11px] ${msg.ok ? "text-emerald-300" : "text-rose-300"}`}>{msg.text}</div>
        )}
      </div>
      <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${style.color}`}>{style.label}</div>
      {c.fix && (
        <button
          onClick={onFix}
          disabled={fixing}
          className="btn"
          style={{ padding: "8px 14px", fontSize: 12 }}
          title={c.fix.admin ? "Kræver administrator" : undefined}
        >
          {fixing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          {c.fix.label}{c.fix.admin ? " ⚡" : ""}
        </button>
      )}
    </div>
  );
}
