import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Gamepad2, Search, Zap, Shield, Cpu, Wifi, Activity, RefreshCw,
  Loader2, CheckCircle2, AlertTriangle, Rocket, Undo2, HardDrive, Sparkles,
} from "lucide-react";
import { PendingChip, EmptyState, Switch } from "../components/Pending";
import { isDesktop, formatBytes } from "../lib/hardware";
import {
  scanBoostGames, listLaunchers, analyzeBoost, listBoostTweaks, applyBoost,
  listBoostBackups, restoreBoost, applyGameProfile, restoreGameProfile, listGameProfiles,
  type BoostGame, type LauncherInfo, type BoostAnalyze, type BoostTweak, type BoostBackup,
} from "../lib/game-boost";

const PLATFORM_LABEL: Record<BoostGame["platform"], string> = {
  steam: "Steam", epic: "Epic", ubisoft: "Ubisoft", gog: "GOG",
};

const LAUNCHER_ICON: Record<string, string> = {
  steam: "◆", epic: "◇", ea: "△", ubisoft: "◈", battlenet: "❖",
  riot: "▲", gog: "◉", xbox: "▩", minecraft: "▣",
};

function Kpi({ label, value, hint, ok }: { label: string; value: string; hint?: string; ok?: boolean }) {
  return (
    <div className="mat-tinted" style={{ padding: "14px 18px", borderRadius: 14, minWidth: 160 }}>
      <div className="text-[10.5px] uppercase tracking-[0.22em] text-white/60">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <div className="text-[18px] font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>{value}</div>
        {ok === true && <CheckCircle2 className="h-4 w-4 text-emerald-400" strokeWidth={2} />}
        {ok === false && <AlertTriangle className="h-4 w-4 text-amber-400" strokeWidth={2} />}
      </div>
      {hint && <div className="mt-1 text-[11.5px] text-white/55">{hint}</div>}
    </div>
  );
}

function labelForAnalyze(a: BoostAnalyze) {
  return {
    gameMode: { value: a.gameMode === 1 ? "Til" : a.gameMode === 0 ? "Fra" : "Ukendt", ok: a.gameMode === 1 },
    hags: {
      value: a.hags === 2 ? "Til" : a.hags === 1 ? "Fra" : a.hags == null ? "Ikke sat" : String(a.hags),
      ok: a.hags === 2,
    },
    mmcss: { value: a.mmcssResp == null ? "20 (default)" : String(a.mmcssResp), ok: a.mmcssResp != null && a.mmcssResp <= 10 },
    power: { value: a.activePlanName || "Ukendt", ok: /ultimate|high/i.test(a.activePlanName || "") },
    nagle: { value: `${a.nagleDisabled}/${a.nagleTotal}`, ok: a.nagleTotal > 0 && a.nagleDisabled === a.nagleTotal },
    games: {
      value: a.gamesPri != null ? `Pri ${a.gamesPri} · GPU ${a.gamesGpuPri ?? "?"}` : "Default",
      ok: (a.gamesPri ?? 0) >= 6 && (a.gamesGpuPri ?? 0) >= 8,
    },
    fse: {
      value: a.fseBehavior === 2 ? "Fuld exklusiv" : a.fseBehavior == null ? "Default" : `Mode ${a.fseBehavior}`,
      ok: a.fseBehavior === 2,
    },
  };
}

const SAFE_IDS = ["gamemode", "gamebar-panel", "hags", "mmcss-resp", "games-gpu-pri", "games-pri", "games-sched", "games-sfio", "power-high"];
const ADV_IDS = ["power-ultimate", "fse-off", "nagle-off"];

export function GameBoostPage() {
  const desktop = isDesktop();
  const [games, setGames] = useState<BoostGame[] | null>(null);
  const [launchers, setLaunchers] = useState<LauncherInfo[] | null>(null);
  const [analyze, setAnalyze] = useState<BoostAnalyze | null>(null);
  const [tweaks, setTweaks] = useState<BoostTweak[]>([]);
  const [backups, setBackups] = useState<BoostBackup[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { exePath: string; ts: number }>>({});
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn" | "err"; text: string } | null>(null);
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<"all" | BoostGame["platform"]>("all");
  const [tier, setTier] = useState<"safe" | "advanced">("safe");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<null | { ids: string[]; label: string }>(null);

  const refreshAll = useCallback(async () => {
    if (!desktop) return;
    setScanning(true);
    try {
      const [g, l, a, t, b, p] = await Promise.all([
        scanBoostGames(),
        listLaunchers(),
        analyzeBoost().catch(() => null),
        listBoostTweaks(),
        listBoostBackups(),
        listGameProfiles(),
      ]);
      setGames(g); setLaunchers(l); setAnalyze(a); setTweaks(t); setBackups(b); setProfiles(p);
    } catch (e) {
      setMsg({ tone: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setScanning(false);
    }
  }, [desktop]);

  useEffect(() => { void refreshAll(); }, [refreshAll]);

  // Preselect tier defaults when tier changes
  useEffect(() => {
    if (tweaks.length === 0) return;
    const ids = new Set(tweaks.filter((t) => t.tier === tier).map((t) => t.id));
    // Safe tier: alle. Advanced: alle safe + alle advanced (så brugeren ser kombineret)
    if (tier === "advanced") for (const s of SAFE_IDS) ids.add(s);
    setSelected(ids);
  }, [tier, tweaks]);

  const filteredGames = useMemo(() => {
    if (!games) return [];
    const q = query.trim().toLowerCase();
    return games.filter((g) =>
      (platform === "all" || g.platform === platform) &&
      (q === "" || g.name.toLowerCase().includes(q)));
  }, [games, query, platform]);

  const analyzeLabels = analyze ? labelForAnalyze(analyze) : null;
  const safeApplied = analyze ? Object.values(analyzeLabels!).filter((v) => v.ok).length : 0;
  const safeTotal = analyze ? Object.keys(analyzeLabels!).length : 0;

  const toggleTweak = (id: string) => {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const doApply = async (ids: string[], label: string) => {
    setApplying(label); setMsg(null);
    try {
      const r = await applyBoost(ids);
      setMsg({
        tone: "ok",
        text: `${r.applied.length} tweaks anvendt. Backup: ${r.backupId}.${r.needsReboot ? " Genstart anbefales." : ""}`,
      });
      const [a, b] = await Promise.all([analyzeBoost().catch(() => null), listBoostBackups()]);
      setAnalyze(a); setBackups(b);
    } catch (e) {
      const err = e as Error & { needsElevation?: boolean };
      setMsg({ tone: err.needsElevation ? "warn" : "err", text: err.message });
    } finally { setApplying(null); setConfirming(null); }
  };

  const doRestore = async (id: string) => {
    setApplying(`restore:${id}`); setMsg(null);
    try {
      const r = await restoreBoost(id);
      setMsg({ tone: "ok", text: `${r.restored.length} tweaks nulstillet fra backup ${id}.` });
      const [a, b] = await Promise.all([analyzeBoost().catch(() => null), listBoostBackups()]);
      setAnalyze(a); setBackups(b);
    } catch (e) {
      const err = e as Error & { needsElevation?: boolean };
      setMsg({ tone: err.needsElevation ? "warn" : "err", text: err.message });
    } finally { setApplying(null); }
  };

  const doGameBoost = async (g: BoostGame) => {
    if (!g.exePath) { setMsg({ tone: "warn", text: `Ingen .exe fundet for ${g.name}. Kun launcher-detektion muligt.` }); return; }
    setApplying(`game:${g.id}`); setMsg(null);
    try {
      await applyGameProfile(g.id, g.exePath);
      setProfiles({ ...profiles, [g.id]: { exePath: g.exePath, ts: Date.now() } });
      setMsg({ tone: "ok", text: `Profil aktiveret for ${g.name}: high-performance GPU + exclusive fullscreen.` });
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message });
    } finally { setApplying(null); }
  };

  const doGameRestore = async (g: BoostGame) => {
    const exe = profiles[g.id]?.exePath || g.exePath;
    if (!exe) return;
    setApplying(`game:${g.id}`); setMsg(null);
    try {
      await restoreGameProfile(g.id, exe);
      const p = { ...profiles }; delete p[g.id]; setProfiles(p);
      setMsg({ tone: "ok", text: `Profil nulstillet for ${g.name}.` });
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message });
    } finally { setApplying(null); }
  };

  const lastBackup = backups[0];

  return (
    <div className="h-full overflow-y-auto stage">
      <div className="page-container settle-list">

        {/* ══════════ HERO ══════════ */}
        <section className="relative pt-4">
          <span aria-hidden className="spot spot--cyan" style={{ right: -160, top: -140, width: 560, height: 560, opacity: 0.5 }} />
          <span aria-hidden className="spot spot--blue" style={{ left: -140, top: 100, width: 420, height: 420, opacity: 0.35 }} />

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-start">
            <div className="min-w-0">
              <span className="kicker">Game Boost</span>
              <h1 className="display-lg mt-5">
                Rigtige Windows-tweaks. <br />
                <span className="grad-text">Med backup — altid.</span>
              </h1>
              <p className="hero-lead" style={{ marginTop: 18 }}>
                NOVYX læser din nuværende registry-tilstand, viser hvad der ændres og hvorfor,
                og gemmer et snapshot før hver ændring. Ét klik gendanner alt.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  className="btn btn-primary"
                  disabled={!desktop || applying !== null}
                  onClick={() => setConfirming({ ids: SAFE_IDS.filter((id) => tweaks.some((t) => t.id === id)), label: "Safe Boost" })}
                >
                  <Rocket className="h-4 w-4" strokeWidth={2} />
                  {applying === "Safe Boost" ? "Anvender…" : "Kør Safe Boost"}
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={!desktop || applying !== null || !lastBackup}
                  onClick={() => lastBackup && doRestore(lastBackup.id)}
                >
                  <Undo2 className="h-4 w-4" strokeWidth={2} />
                  Gendan seneste
                </button>
                <button className="btn btn-secondary" disabled={!desktop || scanning} onClick={refreshAll}>
                  {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Scan igen
                </button>
                {!desktop && <PendingChip label="Kun i desktop-appen" />}
              </div>

              {msg && (
                <div
                  className="mt-5 mat-tinted"
                  style={{
                    padding: "12px 16px", borderRadius: 12, borderLeft: `3px solid ${
                      msg.tone === "ok" ? "#34d399" : msg.tone === "warn" ? "#fbbf24" : "#f87171"
                    }`,
                  }}
                >
                  <div className="text-[13px] text-white/90">{msg.text}</div>
                </div>
              )}
            </div>

            {/* Analysepanel */}
            <div className="mat-frosted" style={{ padding: 22, borderRadius: 20 }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="kicker">Systemanalyse</div>
                  <div className="mt-2 display-md" style={{ fontSize: 24 }}>
                    {analyze ? `${safeApplied} af ${safeTotal} anbefalinger aktive` : "Analyserer…"}
                  </div>
                </div>
                <Activity className="h-6 w-6 text-white/60" strokeWidth={1.5} />
              </div>
              {analyze && analyzeLabels ? (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Kpi label="Game Mode"    value={analyzeLabels.gameMode.value} ok={analyzeLabels.gameMode.ok} />
                  <Kpi label="HAGS"         value={analyzeLabels.hags.value}     ok={analyzeLabels.hags.ok} />
                  <Kpi label="Power Plan"   value={analyzeLabels.power.value}    ok={analyzeLabels.power.ok} />
                  <Kpi label="MMCSS resp."  value={analyzeLabels.mmcss.value}    ok={analyzeLabels.mmcss.ok} />
                  <Kpi label="Games task"   value={analyzeLabels.games.value}    ok={analyzeLabels.games.ok} />
                  <Kpi label="Nagle disabled" value={analyzeLabels.nagle.value}  ok={analyzeLabels.nagle.ok} />
                  <Kpi label="Fullscreen mode" value={analyzeLabels.fse.value}   ok={analyzeLabels.fse.ok} />
                  <Kpi label="Seneste boost" value={lastBackup ? new Date(lastBackup.ts).toLocaleString() : "—"} />
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-2 text-white/60 text-[13px]">
                  <Loader2 className="h-4 w-4 animate-spin" /> Læser registry…
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ══════════ LAUNCHERS ══════════ */}
        <section className="section">
          <div className="section-head">
            <div>
              <div className="section-title">Registrerede launchers</div>
              <div className="section-lead">Detektion via registry og filsystem — kun rigtige installationer vises som "installeret".</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {(launchers ?? []).map((l) => (
              <div key={l.id} className="mat-tinted" style={{ padding: 14, borderRadius: 14, opacity: l.installed ? 1 : 0.4 }}>
                <div className="flex items-center justify-between">
                  <div className="text-[15px] font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
                    <span className="mr-2 text-white/60">{LAUNCHER_ICON[l.id] || "•"}</span>{l.name}
                  </div>
                  {l.installed
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    : <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">ej fundet</span>}
                </div>
                <div className="mt-1 text-[11.5px] text-white/55">
                  {l.installed
                    ? (l.count != null ? `${l.count} spil registreret` : "Installeret")
                    : "Ikke installeret"}
                </div>
              </div>
            ))}
            {!launchers && <div className="text-white/60 text-[13px]"><Loader2 className="inline h-4 w-4 animate-spin" /> Detekterer launchers…</div>}
          </div>
        </section>

        {/* ══════════ TWEAKS ══════════ */}
        <section className="section">
          <div className="section-head">
            <div>
              <div className="section-title">Optimeringer</div>
              <div className="section-lead">
                Hver tweak viser den præcise registry-nøgle eller strøm-handling der ændres,
                og hvorfor. Backup skrives før hver ændring.
              </div>
            </div>
            <div className="tabs">
              {(["safe", "advanced"] as const).map((t) => (
                <button key={t} onClick={() => setTier(t)} className={`tab ${tier === t ? "tab--active" : ""}`}>
                  {t === "safe" ? <Shield className="mr-2 inline h-3.5 w-3.5" /> : <Zap className="mr-2 inline h-3.5 w-3.5" />}
                  {t === "safe" ? "Safe Boost" : "Advanced"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {tweaks.filter((t) => tier === "advanced" || t.tier === "safe").map((t) => {
              const active = selected.has(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTweak(t.id)}
                  className="mat-tinted text-left"
                  style={{
                    padding: 16, borderRadius: 14, cursor: "pointer",
                    outline: active ? "1.5px solid rgba(96,165,250,0.6)" : "1.5px solid transparent",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {t.kind === "reg" || t.kind === "reg-multi"
                          ? <Cpu className="h-4 w-4 text-white/70" strokeWidth={1.75} />
                          : t.kind === "nagle" ? <Wifi className="h-4 w-4 text-white/70" strokeWidth={1.75} />
                          : <HardDrive className="h-4 w-4 text-white/70" strokeWidth={1.75} />}
                        <div className="text-[14.5px] font-semibold text-white">{t.label}</div>
                      </div>
                      <div className="mt-1 text-[12.5px] text-white/60">{t.reason}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="chip" style={{ fontSize: 10 }}>{t.tier === "safe" ? "SAFE" : "ADVANCED"}</span>
                        {t.admin && <span className="chip" style={{ fontSize: 10 }}>Admin</span>}
                        {t.needsReboot && <span className="chip" style={{ fontSize: 10 }}>Genstart</span>}
                      </div>
                    </div>
                    <Switch on={active} />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              className="btn btn-primary"
              disabled={!desktop || applying !== null || selected.size === 0}
              onClick={() => setConfirming({ ids: Array.from(selected), label: `${selected.size} valgte tweaks` })}
            >
              <Sparkles className="h-4 w-4" strokeWidth={2} />
              {applying?.startsWith(String(selected.size)) ? "Anvender…" : `Anvend ${selected.size} tweaks`}
            </button>
            <div className="text-[12.5px] text-white/55">
              {tier === "advanced" && "Advanced tweaks kan påvirke stabilitet. Backup + gendannelse er altid tilgængeligt."}
            </div>
          </div>
        </section>

        {/* ══════════ SPIL ══════════ */}
        <section className="section">
          <div className="section-head">
            <div>
              <div className="section-title">Dine spil</div>
              <div className="section-lead">
                {games ? `${games.length} spil detekteret via Steam, Epic, Ubisoft Connect og GOG.` : "Scanner…"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="glass-input min-w-[280px] max-w-md flex-1">
              <Search className="h-[15px] w-[15px] text-[color:var(--ink-low)]" />
              <input placeholder="Søg spil…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="tabs">
              {(["all", "steam", "epic", "ubisoft", "gog"] as const).map((p) => (
                <button key={p} onClick={() => setPlatform(p)} className={`tab ${platform === p ? "tab--active" : ""}`}>
                  {p === "all" ? "Alle" : PLATFORM_LABEL[p]}
                  {games && <span className="ml-2 text-[11px] opacity-70">
                    {p === "all" ? games.length : games.filter((g) => g.platform === p).length}
                  </span>}
                </button>
              ))}
            </div>
          </div>

          {filteredGames.length === 0 ? (
            <div className="section mat-frosted pb-2 mt-4">
              <EmptyState
                icon={<Gamepad2 className="h-8 w-8 text-white" strokeWidth={1.5} />}
                title={scanning ? "Scanner…" : "Ingen spil matcher"}
                text={desktop ? "Justér filtre eller kør scanning igen." : "Kun i desktop-appen."}
              />
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredGames.map((g) => {
                const active = !!profiles[g.id];
                const busy = applying === `game:${g.id}`;
                return (
                  <div key={g.id} className="mat-tinted" style={{ padding: 14, borderRadius: 14 }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10.5px] uppercase tracking-[0.2em] text-white/55">{PLATFORM_LABEL[g.platform]}</div>
                        <div className="mt-1 text-[15px] font-semibold text-white line-clamp-1" style={{ fontFamily: "var(--font-display)" }}>{g.name}</div>
                        <div className="mt-1 text-[11.5px] text-white/50 line-clamp-1">
                          {g.exePath ? g.exePath : g.library ? g.library : "Sti ikke fundet"}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {g.sizeBytes != null && <span className="chip" style={{ fontSize: 10 }}>{formatBytes(g.sizeBytes)}</span>}
                          {active && <span className="chip" style={{ fontSize: 10, background: "rgba(52,211,153,0.15)", color: "#a7f3d0" }}>Boostet</span>}
                          {!g.exePath && <span className="chip" style={{ fontSize: 10 }}>Ingen exe fundet</span>}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      {active ? (
                        <button className="btn btn-secondary" disabled={busy} onClick={() => doGameRestore(g)}>
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                          Gendan
                        </button>
                      ) : (
                        <button className="btn btn-primary" disabled={busy || !g.exePath} onClick={() => doGameBoost(g)}>
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                          Boost spil
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ══════════ BACKUPS ══════════ */}
        <section className="section">
          <div className="section-head">
            <div>
              <div className="section-title">Backups</div>
              <div className="section-lead">Hver anvendelse gemmes med registry-snapshot. Ét klik gendanner alt.</div>
            </div>
          </div>
          {backups.length === 0 ? (
            <div className="text-[13px] text-white/55">Ingen backups endnu — dine ændringer vil dukke op her.</div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {backups.map((b) => (
                <div key={b.id} className="mat-tinted flex items-center justify-between gap-3" style={{ padding: "12px 16px", borderRadius: 12 }}>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-white">{new Date(b.ts).toLocaleString()}</div>
                    <div className="text-[11.5px] text-white/55">
                      {b.appliedIds.length} tweaks{b.needsReboot ? " · genstart anbefales" : ""} · id {b.id}
                    </div>
                  </div>
                  <button className="btn btn-secondary" disabled={applying === `restore:${b.id}`} onClick={() => doRestore(b.id)}>
                    {applying === `restore:${b.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                    Gendan
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      {/* ══════════ CONFIRM MODAL ══════════ */}
      {confirming && (
        <div
          onClick={() => applying === null && setConfirming(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(4,6,12,0.65)",
            display: "grid", placeItems: "center", zIndex: 50, padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="mat-frosted"
            style={{ padding: 26, borderRadius: 18, maxWidth: 560, width: "100%" }}
          >
            <div className="kicker">Bekræft anvendelse</div>
            <div className="mt-2 display-md" style={{ fontSize: 22 }}>{confirming.label}</div>
            <div className="mt-3 text-[13px] text-white/70">
              NOVYX laver et snapshot af de berørte registry-værdier og strøm-plan før ændringen.
              Ét klik i "Backups" nulstiller det hele igen.
            </div>
            <ul className="mt-4 flex flex-col gap-1.5 max-h-[240px] overflow-y-auto">
              {confirming.ids.map((id) => {
                const t = tweaks.find((x) => x.id === id);
                if (!t) return null;
                return (
                  <li key={id} className="text-[12.5px] text-white/80">
                    <span className="text-white">•</span> <strong>{t.label}</strong>
                    <span className="text-white/50"> — {t.reason}</span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button className="btn btn-secondary" disabled={applying !== null} onClick={() => setConfirming(null)}>Annuller</button>
              <button
                className="btn btn-primary"
                disabled={applying !== null}
                onClick={() => doApply(confirming.ids, confirming.label)}
              >
                {applying === confirming.label ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                Anvend nu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
