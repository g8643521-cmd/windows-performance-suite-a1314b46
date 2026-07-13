import { useEffect, useMemo, useState } from "react";
import { Gamepad2, Search, Sparkles, Zap, RefreshCw, Play, Loader2 } from "lucide-react";
import { PendingChip, EmptyState, Switch } from "../components/Pending";
import { isDesktop, scanGames, launchGame, formatBytes, type DetectedGame } from "../lib/hardware";

const PLATFORM_LABEL: Record<DetectedGame["platform"], string> = {
  steam: "Steam", epic: "Epic",
};

const PLATFORM_HUES: Record<DetectedGame["platform"], { a: string; b: string; c: string }> = {
  steam: { a: "#1B2838", b: "#66C0F4", c: "#0B1520" },
  epic:  { a: "#0F172A", b: "#22D3EE", c: "#050912" },
};

function FallbackArt({ platform, name }: { platform: DetectedGame["platform"]; name: string }) {
  const hues = PLATFORM_HUES[platform];
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <defs>
        <radialGradient id={`fa-${platform}-${name}`} cx="30%" cy="30%" r="80%">
          <stop offset="0%" stopColor={hues.b} stopOpacity="0.9" />
          <stop offset="60%" stopColor={hues.a} stopOpacity="0.85" />
          <stop offset="100%" stopColor={hues.c} stopOpacity="1" />
        </radialGradient>
      </defs>
      <rect width="300" height="400" fill={`url(#fa-${platform}-${name})`} />
      <circle cx="240" cy="330" r="120" fill={hues.b} fillOpacity="0.15" />
      <text x="150" y="220" textAnchor="middle" fill="#ffffff" fillOpacity="0.85"
        fontSize="120" fontFamily="Inter Tight, sans-serif" fontWeight="700" letterSpacing="-4">
        {initials || "?"}
      </text>
    </svg>
  );
}

function GameCover({ game }: { game: DetectedGame }) {
  const [imgOk, setImgOk] = useState<boolean>(!!game.coverUrl);
  return (
    <div className="cover-tile__art">
      {imgOk && game.coverUrl ? (
        <img
          src={game.coverUrl}
          alt=""
          loading="lazy"
          onError={() => setImgOk(false)}
          className="h-full w-full object-cover"
        />
      ) : (
        <FallbackArt platform={game.platform} name={game.name} />
      )}
    </div>
  );
}

export function GamesPage() {
  const desktop = isDesktop();
  const [games, setGames] = useState<DetectedGame[] | null>(null);
  const [status, setStatus] = useState<"idle" | "scanning" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<"all" | "steam" | "epic">("all");
  const [autoMode, setAutoMode] = useState<boolean>(() => {
    try { return localStorage.getItem("novyx.autogamemode") === "1"; } catch { return false; }
  });
  const [launching, setLaunching] = useState<string | null>(null);

  const runScan = async () => {
    if (!desktop) return;
    setStatus("scanning"); setError(null);
    try { setGames(await scanGames()); setStatus("done"); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); setStatus("error"); }
  };

  useEffect(() => { if (desktop) runScan(); /* eslint-disable-next-line */ }, [desktop]);

  const filtered = useMemo(() => {
    if (!games) return [];
    return games.filter((g) =>
      (platform === "all" || g.platform === platform) &&
      (query.trim() === "" || g.name.toLowerCase().includes(query.toLowerCase())));
  }, [games, platform, query]);

  const featured = filtered[0];
  const rest = filtered.slice(1);

  const toggleAuto = () => {
    const v = !autoMode;
    setAutoMode(v);
    try { localStorage.setItem("novyx.autogamemode", v ? "1" : "0"); } catch { /* ignore */ }
  };

  const doLaunch = async (g: DetectedGame) => {
    setLaunching(g.id);
    try { await launchGame(g.id); } catch { /* ignore */ }
    finally { setTimeout(() => setLaunching(null), 800); }
  };

  return (
    <div className="h-full overflow-y-auto stage">
      <div className="page-container settle-list">

        {/* ══════════ HERO ══════════ */}
        <section className="relative pt-4">
          <span aria-hidden className="spot spot--cyan" style={{ right: -160, top: -140, width: 560, height: 560, opacity: 0.5 }} />
          <span aria-hidden className="spot spot--blue" style={{ left: -140, top: 100, width: 420, height: 420, opacity: 0.35 }} />

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-center">
            <div className="min-w-0">
              <span className="kicker">Play</span>
              <h1 className="display-lg mt-5">
                Dit <span className="grad-text">spilbibliotek</span>,
                <br />uden ventetid.
              </h1>
              <p className="hero-lead" style={{ marginTop: 18 }}>
                Steam og Epic detekteres automatisk lokalt. Klik "Start" for at
                lancere spil direkte via platformen — ingen manuelle skift.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={toggleAuto}
                  className="mat-tinted reactive flex items-center gap-4"
                  style={{ padding: "14px 20px", cursor: "pointer" }}
                >
                  <Zap className="h-5 w-5 text-white/90" strokeWidth={1.75} />
                  <div className="text-left">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-white/70">Auto Game Mode</div>
                    <div className="text-[13.5px] font-semibold text-white">
                      {autoMode ? "Aktiveret" : "Deaktiveret"}
                    </div>
                  </div>
                  <Switch on={autoMode} />
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={runScan}
                  disabled={!desktop || status === "scanning"}
                >
                  {status === "scanning"
                    ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                    : <RefreshCw className="h-4 w-4" strokeWidth={2} />}
                  Scan igen
                </button>
                {!desktop && <PendingChip label="Kun i desktop-appen" />}
              </div>
            </div>

            {/* Featured cover */}
            <div className="relative">
              {featured ? (
                <div className="cover-tile cover-tile--featured reactive"
                  style={{ boxShadow: "0 50px 100px -30px rgba(0,0,0,0.75), 0 0 80px -20px rgba(59,130,246,0.35)" }}>
                  <GameCover game={featured} />
                  <div className="cover-tile__scrim" />
                  <div className="cover-tile__sheen" />
                  <div className="cover-tile__meta">
                    <div className="kicker text-white/70">{PLATFORM_LABEL[featured.platform]}</div>
                    <div className="mt-2 display-md" style={{ fontSize: 28 }}>{featured.name}</div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {featured.sizeBytes != null && (
                        <span className="chip">{formatBytes(featured.sizeBytes)}</span>
                      )}
                      <button
                        className="btn btn-primary"
                        onClick={() => doLaunch(featured)}
                        disabled={launching === featured.id}
                        style={{ marginLeft: "auto" }}
                      >
                        <Play className="h-4 w-4" strokeWidth={2} />
                        {launching === featured.id ? "Starter…" : "Start spil"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="cover-tile cover-tile--featured"
                  style={{ display: "grid", placeItems: "center", minHeight: 340, opacity: 0.5 }}>
                  <div className="text-center">
                    <Gamepad2 className="mx-auto h-10 w-10 text-white/70" strokeWidth={1.5} />
                    <div className="mt-3 text-[13px] text-white/70">
                      {status === "scanning" ? "Scanner installerede spil…" : "Ingen spil fundet endnu"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ══════════ FILTERS ══════════ */}
        <section className="section flex flex-wrap items-center gap-3">
          <div className="glass-input min-w-[280px] max-w-md flex-1">
            <Search className="h-[15px] w-[15px] text-[color:var(--ink-low)]" strokeWidth={1.75} />
            <input placeholder="Søg spil…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="tabs">
            {(["all", "steam", "epic"] as const).map((p) => (
              <button key={p}
                onClick={() => setPlatform(p)}
                className={`tab ${platform === p ? "tab--active" : ""}`}>
                {p === "all" ? "Alle" : PLATFORM_LABEL[p]}
                {games && <span className="ml-2 text-[11px] opacity-70">
                  {p === "all" ? games.length : games.filter((g) => g.platform === p).length}
                </span>}
              </button>
            ))}
          </div>
        </section>

        {/* ══════════ GRID ══════════ */}
        <section className="section">
          <div className="section-head">
            <div>
              <div className="section-title">Dit bibliotek</div>
              <div className="section-lead">
                {status === "scanning" ? "Scanner …"
                  : games ? `${games.length} spil fundet lokalt`
                  : desktop ? "Klik Scan igen for at læse dine spil."
                  : "Åbn NOVYX desktop-appen for at scanne."}
              </div>
            </div>
            {error && <PendingChip label={error} />}
          </div>

          {rest.length > 0 ? (
            <div className="grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-4">
              {rest.map((g) => (
                <button
                  key={g.id}
                  onClick={() => doLaunch(g)}
                  disabled={launching === g.id}
                  className="cover-tile text-left"
                  title={`Start ${g.name}`}
                >
                  <GameCover game={g} />
                  <div className="cover-tile__scrim" />
                  <div className="cover-tile__sheen" />
                  <div className="cover-tile__meta">
                    <div className="text-[10.5px] uppercase tracking-[0.2em] text-white/60">
                      {PLATFORM_LABEL[g.platform]}{g.sizeBytes ? ` · ${formatBytes(g.sizeBytes)}` : ""}
                    </div>
                    <div className="mt-1 text-[15px] font-semibold text-white line-clamp-2"
                      style={{ fontFamily: "var(--font-display)" }}>
                      {g.name}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : featured ? null : (
            <div className="section mat-frosted pb-2">
              <EmptyState
                icon={<Gamepad2 className="h-8 w-8 text-white" strokeWidth={1.5} />}
                title={status === "scanning" ? "Scanner installerede spil …" : "Ingen spil fundet endnu"}
                text={desktop
                  ? "Installér spil via Steam eller Epic — de dukker automatisk op her efter en scanning."
                  : "Auto-detektion virker kun i NOVYX desktop-appen."}
                action={
                  <button className="btn btn-secondary" onClick={runScan} disabled={!desktop || status === "scanning"}>
                    <Sparkles className="h-4 w-4" strokeWidth={2} />
                    Scan bibliotek
                  </button>
                }
              />
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
