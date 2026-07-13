import { useEffect, useState } from "react";
import {
  RotateCcw, ShieldCheck, LifeBuoy, FlaskConical, ChevronRight, Bell, Palette, Cog,
  CheckCircle2, ExternalLink, FolderOpen, Download,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Switch } from "../components/Pending";
import {
  isDesktop, getAutoStart, setAutoStart, openExternal, openLogsFolder, exportDiagnostics,
} from "../lib/hardware";
import { useSettings, setSetting } from "../lib/settings";

const PREFS_KEY = "novyx.prefs.v1";

type Prefs = {
  autoUpdates: boolean;
  reducedMotion: boolean;
  compact: boolean;
  notifyDone: boolean;
  notifyWeekly: boolean;
  quietInGame: boolean;
  restorePoint: boolean;
  requireAdminConfirm: boolean;
  backupBeforeTweaks: boolean;
  betaChannel: boolean;
  experimentalTweaks: boolean;
  devDetails: boolean;
};

const DEFAULT_PREFS: Prefs = {
  autoUpdates: true,
  reducedMotion: false,
  compact: false,
  notifyDone: true,
  notifyWeekly: false,
  quietInGame: true,
  restorePoint: true,
  requireAdminConfirm: true,
  backupBeforeTweaks: true,
  betaChannel: false,
  experimentalTweaks: false,
  devDetails: false,
};

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch { return DEFAULT_PREFS; }
}
function savePrefs(p: Prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

type Section = { id: string; title: string; description: string; icon: LucideIcon; group: string };

const SECTIONS: Section[] = [
  { id: "general",       title: "Generelt",      description: "Sprog, opstart og standardadfærd.",     icon: Cog,         group: "Program" },
  { id: "appearance",    title: "Udseende",      description: "Tema, tæthed og materialer.",           icon: Palette,     group: "Program" },
  { id: "notifications", title: "Notifikationer", description: "Hvornår NOVYX må afbryde dig.",        icon: Bell,        group: "Program" },
  { id: "rollback",      title: "Rollback",      description: "Fortryd ændringer.",                    icon: RotateCcw,   group: "System" },
  { id: "security",      title: "Sikkerhed",     description: "Admin-rettigheder og gendannelsespunkter.", icon: ShieldCheck, group: "System" },
  { id: "support",       title: "Support",       description: "Diagnostik, logs og direkte kontakt.",  icon: LifeBuoy,    group: "Hjælp" },
  { id: "beta",          title: "Beta-adgang",   description: "Tidlig adgang til nye funktioner.",     icon: FlaskConical, group: "Hjælp" },
];
const GROUPS = ["Program", "System", "Hjælp"];

function Row({ label, hint, right }: { label: string; hint?: string; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-2xl px-5 py-4"
      style={{ background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="min-w-0">
        <div className="text-[14px] font-medium text-[color:var(--ink-hi)]">{label}</div>
        {hint && <div className="mt-0.5 text-[12px] text-[color:var(--ink-faint)]">{hint}</div>}
      </div>
      {right}
    </div>
  );
}

function ToggleButton({ on, onChange, disabled = false }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={() => !disabled && onChange(!on)} disabled={disabled}
      className="shrink-0" aria-pressed={on}>
      <Switch on={on} disabled={disabled} />
    </button>
  );
}

export function SettingsPage() {
  const desktop = isDesktop();
  const localSettings = useSettings();
  const [activeId, setActiveId] = useState<string>("general");
  const active = SECTIONS.find((s) => s.id === activeId) ?? SECTIONS[0];
  const Icon = active.icon;

  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const [autostart, setAutostart] = useState<boolean>(false);
  const [version, setVersion] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!desktop) return;
    getAutoStart().then(setAutostart).catch(() => {});
    const bridge = (window as unknown as { novyx?: { app: { version: () => Promise<{ ok: boolean; version?: string }> } } }).novyx;
    bridge?.app.version().then((r) => r.ok && r.version && setVersion(r.version)).catch(() => {});
  }, [desktop]);

  const setPref = <K extends keyof Prefs>(k: K, v: Prefs[K]) => {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    savePrefs(next);
  };

  const toggleAutostart = async (v: boolean) => {
    try { await setAutoStart(v); setAutostart(v); showToast(v ? "Autostart aktiveret" : "Autostart deaktiveret"); }
    catch (e) { showToast(e instanceof Error ? e.message : "Kunne ikke ændre autostart"); }
  };

  const doExport = async () => {
    try {
      const p = await exportDiagnostics();
      if (p) showToast(`Gemt: ${p}`);
    } catch (e) { showToast(e instanceof Error ? e.message : "Eksport fejlede"); }
  };

  const doOpenLogs = async () => {
    try { const p = await openLogsFolder(); if (p) showToast(`Åbnet: ${p}`); }
    catch (e) { showToast(e instanceof Error ? e.message : "Kunne ikke åbne logs"); }
  };

  const clearHistory = () => {
    localStorage.removeItem("novyx.dashboard.history.v1");
    showToast("Historik ryddet");
  };

  const openHelp = () => openExternal("https://novyx.app/help").catch(() => {});
  const openStatus = () => openExternal("https://novyx.app/status").catch(() => {});
  const contactSupport = () => openExternal("mailto:support@novyx.app").catch(() => {});

  return (
    <div className="h-full overflow-y-auto stage">
      <div className="page-container settle">

        <section className="relative pb-4">
          <span className="kicker">Kontrol</span>
          <h1 className="display-md mt-4">Indstillinger</h1>
          <p className="section-lead mt-2" style={{ maxWidth: 640 }}>
            Alle indstillinger gemmes lokalt og træder i kraft med det samme.
          </p>
        </section>

        <section className="section grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="mat-matte settings-rail sh-soft self-start">
            {GROUPS.map((g) => (
              <div key={g}>
                <div className="settings-group">{g}</div>
                {SECTIONS.filter((s) => s.group === g).map((s) => {
                  const It = s.icon;
                  const isActive = s.id === activeId;
                  return (
                    <button key={s.id} onClick={() => setActiveId(s.id)}
                      className={`settings-rail__item ${isActive ? "settings-rail__item--active" : ""}`}>
                      <span className="settings-rail__icon"><It className="h-4 w-4" strokeWidth={1.75} /></span>
                      <span className="flex-1">{s.title}</span>
                      <ChevronRight className="h-4 w-4 text-[color:var(--ink-faint)]" strokeWidth={1.75} />
                    </button>
                  );
                })}
              </div>
            ))}
          </aside>

          <div className="mat-frosted sh-ambient relative overflow-hidden" style={{ padding: "36px 40px" }}>
            <span aria-hidden className="lightline lightline--top" style={{ left: "6%", right: "6%" }} />

            <div className="flex items-start justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white"
                  style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)), linear-gradient(135deg, rgba(59,130,246,0.35), rgba(34,211,238,0.15))",
                    border: "1px solid rgba(59,130,246,0.28)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14), 0 12px 28px -14px rgba(59,130,246,0.35)" }}>
                  <Icon className="h-6 w-6" strokeWidth={1.6} />
                </div>
                <div>
                  <div className="display-md" style={{ fontSize: 26 }}>{active.title}</div>
                  <div className="mt-1.5 text-[13.5px] text-[color:var(--ink-low)]">{active.description}</div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-2 settle-list">
              {activeId === "general" && (
                <>
                  <Row label="Start med Windows" hint={desktop ? "Kør NOVYX ved login" : "Kun i desktop-appen"}
                    right={<ToggleButton on={autostart} onChange={toggleAutostart} disabled={!desktop} />} />
                  <Row label="Automatiske opdateringer" hint="Installér nye versioner stille"
                    right={<ToggleButton on={prefs.autoUpdates} onChange={(v) => setPref("autoUpdates", v)} />} />
                  <Row label="Sprog" hint="Dansk" right={<ChevronRight className="h-4 w-4 text-[color:var(--ink-faint)]" strokeWidth={1.75} />} />
                </>
              )}

              {activeId === "appearance" && (
                <>
                  <Row label="Farvetema" hint="Automatisk (mørk)"
                    right={<ChevronRight className="h-4 w-4 text-[color:var(--ink-faint)]" strokeWidth={1.75} />} />
                  <Row label="Reduceret bevægelse" hint="Anvendes øjeblikkeligt"
                    right={<ToggleButton on={localSettings.reducedMotion} onChange={(v) => setSetting("reducedMotion", v)} />} />
                  <Row label="Kompakt tilstand" hint="Mere information pr. skærm"
                    right={<ToggleButton on={localSettings.compactSpacing} onChange={(v) => setSetting("compactSpacing", v)} />} />
                  <Row label="Tabulare tal" hint="Ens bredde på cifre i tabeller"
                    right={<ToggleButton on={localSettings.showTabularNumbers} onChange={(v) => setSetting("showTabularNumbers", v)} />} />
                </>
              )}

              {activeId === "notifications" && (
                <>
                  <Row label="Optimeringer færdig" hint="Windows-notifikation"
                    right={<ToggleButton on={prefs.notifyDone} onChange={(v) => setPref("notifyDone", v)} />} />
                  <Row label="Ugentlige rapporter" hint="Sammendrag hver mandag"
                    right={<ToggleButton on={prefs.notifyWeekly} onChange={(v) => setPref("notifyWeekly", v)} />} />
                  <Row label="Stille tilstand under spil"
                    right={<ToggleButton on={prefs.quietInGame} onChange={(v) => setPref("quietInGame", v)} />} />
                </>
              )}

              {activeId === "rollback" && (
                <>
                  <Row label="Ryd historik" hint="Fjerner alle registrerede handlinger i denne installation"
                    right={<button className="btn btn-secondary" onClick={clearHistory}>Ryd</button>} />
                  <Row label="Systemgendannelse" hint="Åbn Windows Systemgendannelse"
                    right={<button className="btn btn-secondary" disabled={!desktop}
                      onClick={() => openExternal("ms-settings:recovery").catch(() => {})}>Åbn</button>} />
                </>
              )}

              {activeId === "security" && (
                <>
                  <Row label="Opret gendannelsespunkt" hint="Før hver optimering"
                    right={<ToggleButton on={prefs.restorePoint} onChange={(v) => setPref("restorePoint", v)} />} />
                  <Row label="Kræv admin-bekræftelse"
                    right={<ToggleButton on={prefs.requireAdminConfirm} onChange={(v) => setPref("requireAdminConfirm", v)} />} />
                  <Row label="Backup før tweaks"
                    right={<ToggleButton on={prefs.backupBeforeTweaks} onChange={(v) => setPref("backupBeforeTweaks", v)} />} />
                </>
              )}

              {activeId === "support" && (
                <>
                  <Row label="Eksportér diagnostik-log" hint="Anonymiseret snapshot af hardware"
                    right={<button className="btn btn-secondary" disabled={!desktop} onClick={doExport}>
                      <Download className="h-4 w-4" strokeWidth={2} />Eksportér</button>} />
                  <Row label="Åbn logs-mappe" hint="Se lokale NOVYX-logs"
                    right={<button className="btn btn-secondary" disabled={!desktop} onClick={doOpenLogs}>
                      <FolderOpen className="h-4 w-4" strokeWidth={2} />Åbn</button>} />
                  <Row label="Kontakt support" hint="support@novyx.app"
                    right={<button className="btn btn-secondary" onClick={contactSupport}>
                      <ExternalLink className="h-4 w-4" strokeWidth={2} />Skriv</button>} />
                  <Row label="Åbn hjælpecenter" hint="novyx.app/help"
                    right={<button className="btn btn-secondary" onClick={openHelp}>
                      <ExternalLink className="h-4 w-4" strokeWidth={2} />Åbn</button>} />
                  <Row label="Status-side" hint="Drift og hændelser"
                    right={<button className="btn btn-secondary" onClick={openStatus}>
                      <ExternalLink className="h-4 w-4" strokeWidth={2} />Åbn</button>} />
                </>
              )}

              {activeId === "beta" && (
                <>
                  <Row label="Tilmeld beta-kanal" hint="Modtag tidlige builds"
                    right={<ToggleButton on={prefs.betaChannel} onChange={(v) => setPref("betaChannel", v)} />} />
                  <Row label="Eksperimentelle tweaks" hint="Kan være ustabile"
                    right={<ToggleButton on={prefs.experimentalTweaks} onChange={(v) => setPref("experimentalTweaks", v)} />} />
                  <Row label="Vis udvikler-detaljer"
                    right={<ToggleButton on={prefs.devDetails} onChange={(v) => setPref("devDetails", v)} />} />
                </>
              )}
            </div>

            <div className="mt-8 text-[11.5px] uppercase tracking-[0.22em] text-[color:var(--ink-faint)]">
              NOVYX{version ? ` v${version}` : ""}
            </div>
          </div>
        </section>

        {toast && (
          <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-2.5 text-[13px] text-white"
            style={{ background: "rgba(15,23,42,0.9)", border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 20px 40px -20px rgba(0,0,0,0.5)", backdropFilter: "blur(12px)" }}>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" strokeWidth={2} />
              {toast}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
