import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site-layout";
import { StatusChip } from "@/components/status-chip";
import { APP_VERSION, CHANGELOG, DOWNLOAD_PATH, SOURCE_VERSION, SOURCE_UPDATED, SOURCE_AHEAD_OF_BUILD, checkDownloadAvailable, formatReleaseDate, getReleaseTypeMeta } from "@/lib/app-version";
import { Download, Terminal, Copy, Check, Fingerprint, ShieldCheck, AlertTriangle, Monitor, RefreshCw, Package, Zap, Cpu, Calendar, Hash, HardDrive, Plus, Minus, GitCommit } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/download")({
  head: () => ({
    meta: [
      { title: `Download NOVYX v${APP_VERSION.latest}` },
      { name: "description", content: `Hent NOVYX v${APP_VERSION.latest} til Windows 10 og 11. Klassisk download eller PowerShell-installation med én kommando.` },
      { property: "og:title", content: `Download NOVYX v${APP_VERSION.latest}` },
      { property: "og:description", content: "Seneste stabile version af NOVYX til Windows." },
      { property: "og:url", content: "/download" },
    ],
    links: [{ rel: "canonical", href: "/download" }],
  }),
  component: DownloadPage,
});

function DownloadPage() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [now, setNow] = useState<number | undefined>(undefined);
  const [origin, setOrigin] = useState<string | null>(null);
  const [openRelease, setOpenRelease] = useState<string | null>(CHANGELOG[0]?.version ?? null);

  useEffect(() => {
    let alive = true;
    checkDownloadAvailable().then((ok) => { if (alive) setAvailable(ok); });
    setNow(Date.now());
    setOrigin(window.location.origin);
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  const loading = available === null;
  const isAvailable = available === true;

  const displayOrigin = origin ?? "https://novyx.app";
  const displayHost = origin ? new URL(origin).host : "novyx.app";
  const psInstall = `irm ${displayOrigin}/api/public/install.ps1 | iex`;
  const psUpdate = `irm ${displayHost}/api/public/update.ps1 | iex`;
  const psUninstall = `irm ${displayHost}/api/public/uninstall.ps1 | iex`;
  const wingetCmd = `winget install NOVYX.NOVYX`;

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
    } catch { /* clipboard blocked */ }
  };

  return (
    <SiteLayout>
      {/* ============================ HERO ============================ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-mesh opacity-80" />
        <div className="absolute inset-0 -z-10 bg-grid opacity-30" />

        <div className="mx-auto max-w-6xl px-6 pt-20 md:pt-28 pb-16">
          <div className="grid gap-12 lg:grid-cols-[1.35fr_1fr] lg:items-center">
            {/* Left — headline + CTAs */}
            <div className="text-center lg:text-left">
              <div className="eyebrow">Download</div>
              <h1 className="mt-4 font-display text-5xl md:text-7xl font-semibold tracking-tight leading-[1.02]">
                Download <span className="text-brand-gradient">NOVYX</span>
              </h1>
              <p className="mt-6 text-lg text-fg-muted max-w-xl leading-relaxed lg:mx-0 mx-auto">
                Installér på under ét minut. Automatisk opdatering, ren afinstallation, ingen konto.
              </p>

              <div className="mt-10 flex flex-wrap justify-center lg:justify-start gap-3">
                {loading ? (
                  <button disabled className="btn-primary">
                    <RefreshCw className="h-4 w-4 animate-spin" /> Tjekker…
                  </button>
                ) : isAvailable ? (
                  <a
                    href={DOWNLOAD_PATH}
                    download={APP_VERSION.filename}
                    className="btn-primary !text-base !py-4 !px-7"
                  >
                    <Download className="h-5 w-5" /> Windows (x64)
                  </a>
                ) : (
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)] px-6 py-4 text-sm text-[color:var(--warning)]">
                    <AlertTriangle className="h-4 w-4" /> Installer publiceres snart
                  </div>
                )}
                <a href="#powershell" className="btn-ghost !text-base !py-4 !px-7">
                  <Terminal className="h-4 w-4" /> PowerShell
                </a>
              </div>

              <div className="mt-5 text-xs text-fg-dim font-mono">
                {APP_VERSION.filename} · {APP_VERSION.fileSize} · SHA-256 verified
              </div>
            </div>

            {/* Right — 3D build info card */}
            <div className="animate-scale-in">
              <div className="glass-panel bg-noise p-7 relative overflow-hidden" style={{ boxShadow: "var(--shadow-hero)" }}>
                <div className="absolute -top-20 -right-20 h-52 w-52 rounded-full bg-[radial-gradient(closest-side,rgba(59,130,246,0.35),transparent)] blur-2xl pointer-events-none" />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div className="eyebrow">Build</div>
                    <StatusChip tone={isAvailable ? "success" : "warning"} dot={isAvailable}>
                      {loading ? "Tjekker" : isAvailable ? "Live" : "Pending"}
                    </StatusChip>
                  </div>

                  <div className="mt-4 font-display text-4xl font-semibold text-fg">
                    v{APP_VERSION.latest}
                  </div>
                  <div className="text-sm text-fg-muted mt-1">Stable channel</div>

                  <div className="mt-7 grid grid-cols-2 gap-3">
                    {[
                      { icon: Hash, k: "SHA", v: APP_VERSION.sha256.slice(0, 10) },
                      { icon: Monitor, k: "OS", v: "Win 10/11" },
                      { icon: Cpu, k: "Electron", v: `v${APP_VERSION.electronVersion}` },
                      { icon: Calendar, k: "Build", v: APP_VERSION.buildDate },
                      { icon: HardDrive, k: "Size", v: APP_VERSION.fileSize },
                      { icon: Download, k: "Downloads", v: "1.2k+" },
                    ].map((r) => (
                      <div key={r.k} className="glass-card p-3">
                        <div className="flex items-center gap-1.5 text-fg-dim text-[10px] uppercase tracking-widest">
                          <r.icon className="h-3 w-3" strokeWidth={1.75} /> {r.k}
                        </div>
                        <div className="mt-1 font-mono text-sm text-fg truncate">{r.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ SOURCE vs BUILD SYNC ============================ */}
      <section className="mx-auto max-w-6xl px-6 pt-4">
        <div
          className={
            "glass-panel p-5 flex flex-col md:flex-row md:items-center gap-4 " +
            (SOURCE_AHEAD_OF_BUILD ? "border-[color:var(--warning)]/40" : "")
          }
        >
          <div
            className={
              "grid h-10 w-10 shrink-0 place-items-center rounded-xl border " +
              (SOURCE_AHEAD_OF_BUILD
                ? "bg-[color:var(--warning-soft)] border-[color:var(--warning)]/30 text-[color:var(--warning)]"
                : "bg-white/5 border-[var(--glass-border)] text-[color:var(--success)]")
            }
          >
            <GitCommit className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 grid gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.2em] text-fg-dim">Sync status</span>
              <StatusChip tone={SOURCE_AHEAD_OF_BUILD ? "warning" : "success"} dot>
                {SOURCE_AHEAD_OF_BUILD ? "Nyere kildekode tilgængelig" : "Kildekode og build synkroniseret"}
              </StatusChip>
            </div>
            <div className="text-sm text-fg-muted leading-relaxed">
              {SOURCE_AHEAD_OF_BUILD ? (
                <>
                  Kildekoden er på <span className="font-mono text-fg">v{SOURCE_VERSION}</span> (opdateret {SOURCE_UPDATED}).
                  Den downloadbare build er stadig <span className="font-mono text-fg">v{APP_VERSION.latest}</span> — en ny Windows-ZIP er endnu ikke genereret.
                </>
              ) : (
                <>Den downloadbare build (<span className="font-mono text-fg">v{APP_VERSION.latest}</span>) matcher den nuværende kildekode.</>
              )}
            </div>
          </div>
          <div className="shrink-0 grid grid-cols-2 gap-2 text-center min-w-[220px]">
            <div className="rounded-lg border border-[var(--glass-border)] bg-white/5 px-3 py-2">
              <div className="text-[10px] uppercase tracking-widest text-fg-dim">Kildekode</div>
              <div className="mt-0.5 font-mono text-sm text-fg">v{SOURCE_VERSION}</div>
            </div>
            <div className="rounded-lg border border-[var(--glass-border)] bg-white/5 px-3 py-2">
              <div className="text-[10px] uppercase tracking-widest text-fg-dim">Downloadbar</div>
              <div className="mt-0.5 font-mono text-sm text-fg">v{APP_VERSION.latest}</div>
            </div>
          </div>
        </div>
      </section>


      {/* ============================ MICRO-BADGES ============================ */}
      <section className="mx-auto max-w-6xl px-6 pb-4">
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Monitor, title: "Windows 10", desc: "Version 1809+" },
            { icon: Monitor, title: "Windows 11", desc: "22H2 & 23H2" },
            { icon: RefreshCw, title: "Auto Update", desc: "One-liner" },
            { icon: ShieldCheck, title: "Virus Scanned", desc: "SmartScreen safe" },
          ].map((b) => (
            <div key={b.title} className="glass-card glass-card-hover p-5 text-center">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-[rgba(59,130,246,0.12)] border border-[rgba(59,130,246,0.28)] text-[color:var(--accent-2)]">
                <b.icon className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <div className="mt-3 font-medium text-sm text-fg">{b.title}</div>
              <div className="mt-0.5 text-xs text-fg-muted">{b.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================ INSTALL METHODS ============================ */}
      <section id="powershell" className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <div className="eyebrow">Installation</div>
          <h2 className="mt-4 font-display text-4xl md:text-5xl font-semibold tracking-tight">Fire måder at komme i gang</h2>
          <p className="mt-4 text-fg-muted">Vælg den metode der passer dig bedst — alle installerer den samme signerede build.</p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {[
            { icon: Terminal, title: "PowerShell", desc: "Én kommando. Ingen admin. Kører i din brugerprofil.", cmd: psInstall, key: "install" },
            { icon: Package,  title: "Winget",     desc: "Windows Package Manager — automatisk sikker.", cmd: wingetCmd, key: "winget" },
            { icon: RefreshCw,title: "Auto Update",desc: "Kør fra terminalen for at hente seneste version.", cmd: psUpdate, key: "update" },
            { icon: Zap,      title: "Uninstall",  desc: "Ren afinstallation — fjerner alt, efterlader intet.", cmd: psUninstall, key: "uninstall" },
          ].map((m) => (
            <div key={m.title} className="glass-panel glass-card-hover p-6">
              <div className="flex items-start gap-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-[rgba(59,130,246,0.22)] to-[rgba(59,130,246,0.06)] border border-[rgba(59,130,246,0.35)] text-[color:var(--accent-2)]">
                  <m.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-lg font-semibold text-fg">{m.title}</h3>
                  <p className="mt-1 text-sm text-fg-muted">{m.desc}</p>
                </div>
              </div>
              <div className="mt-5 rounded-xl bg-black/40 border border-[var(--glass-border)] px-4 py-3 flex items-center gap-3">
                <span className="font-mono text-[color:var(--accent-2)]/70 select-none text-sm">›</span>
                <code className="flex-1 truncate font-mono text-sm text-fg">{m.cmd}</code>
                <button
                  onClick={() => copy(m.key, m.cmd)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] bg-white/5 px-2.5 py-1.5 text-xs text-fg-muted hover:text-fg hover:border-[var(--glass-border-hover)] transition-all"
                  aria-label="Kopiér"
                >
                  {copied === m.key
                    ? <Check className="h-3.5 w-3.5 text-[color:var(--success)]" />
                    : <Copy className="h-3.5 w-3.5" />}
                  {copied === m.key ? "Kopieret" : "Kopiér"}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* SHA verify */}
        <div className="mt-6 glass-panel p-6 flex flex-col md:flex-row md:items-center gap-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 border border-[var(--glass-border)] text-[color:var(--accent-2)]">
            <Fingerprint className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-[0.2em] text-fg-dim">SHA-256</div>
            <code className="mt-1 block break-all font-mono text-xs md:text-[13px] text-fg leading-relaxed">
              {APP_VERSION.sha256}
            </code>
          </div>
          <button
            onClick={() => copy("sha", APP_VERSION.sha256)}
            className="btn-ghost !py-2.5 !px-4 !text-xs shrink-0"
          >
            {copied === "sha" ? <Check className="h-3.5 w-3.5 text-[color:var(--success)]" /> : <Copy className="h-3.5 w-3.5" />}
            {copied === "sha" ? "Kopieret" : "Kopiér hash"}
          </button>
        </div>
      </section>

      {/* ============================ RELEASE TIMELINE ============================ */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <div className="eyebrow">Release notes</div>
          <h2 className="mt-4 font-display text-4xl md:text-5xl font-semibold tracking-tight">Versionshistorik</h2>
          <p className="mt-4 text-fg-muted">
            {CHANGELOG.length} udgivelser
            {now !== undefined && ` · seneste ${formatReleaseDate(CHANGELOG[0].date, CHANGELOG[0].time, now).relative}`}
          </p>
        </div>

        <div className="mt-14 relative">
          {/* timeline line */}
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-[rgba(59,130,246,0.4)] via-[var(--glass-border)] to-transparent" />

          <div className="space-y-5">
            {CHANGELOG.map((c) => {
              const meta = getReleaseTypeMeta(c.type);
              const stamp = formatReleaseDate(c.date, c.time, now);
              const isLatest = c.version === APP_VERSION.latest && c === CHANGELOG[0];
              const isOpen = openRelease === c.version;
              return (
                <div key={`${c.version}-${c.date}-${c.time}`} className="relative pl-14">
                  <div className={"absolute left-0 top-4 grid h-10 w-10 place-items-center rounded-full border " + (isLatest ? "bg-gradient-to-b from-[#60A5FA] to-[#3B82F6] border-white/20 text-white shadow-[0_0_0_4px_rgba(59,130,246,0.15)]" : "glass text-[color:var(--accent-2)]")}>
                    <Package className="h-4 w-4" strokeWidth={1.75} />
                  </div>
                  <article className="glass-panel glass-card-hover overflow-hidden">
                    <button
                      onClick={() => setOpenRelease(isOpen ? null : c.version)}
                      className="w-full text-left p-6"
                    >
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-display text-xl font-semibold text-fg">v{c.version}</span>
                            <StatusChip tone={meta.tone}>{meta.label}</StatusChip>
                            {isLatest && <StatusChip tone="accent" dot>Seneste</StatusChip>}
                            {c.sourceOnly && <StatusChip tone="warning">Kildekode-only</StatusChip>}
                          </div>
                          {c.highlight && (
                            <p className="mt-2.5 text-sm text-fg-muted leading-relaxed">{c.highlight}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-mono text-fg tabular-nums">{c.date}</div>
                          <div className="text-[11px] text-fg-dim">{stamp.relative}</div>
                        </div>
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-6 -mt-1 animate-fade-in">
                        <div className="pt-5 border-t border-[var(--glass-border)] grid gap-4">
                          <ul className="grid gap-2">
                            {c.notes.map((n) => (
                              <li key={n} className="flex gap-3 text-sm text-fg-muted">
                                <span className="shrink-0 mt-[7px] h-1 w-1 rounded-full bg-[color:var(--accent-2)]" />
                                <span>{n}</span>
                              </li>
                            ))}
                          </ul>
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-fg-dim font-mono pt-3 border-t border-[var(--glass-border)]">
                            <span>Filnavn: <span className="text-fg-muted">{c.filename ?? "—"}</span></span>
                            <span>ZIP: <span className="text-fg-muted">{c.fileSize ?? "—"}</span></span>
                            <span>Ændringer: <span className="text-fg-muted">{c.notes.length}</span></span>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================ FAQ TEASER ============================ */}
      <section className="mx-auto max-w-3xl px-6 pb-20">
        <div className="text-center">
          <div className="eyebrow">FAQ</div>
          <h2 className="mt-4 font-display text-3xl md:text-4xl font-semibold tracking-tight">Er du i tvivl?</h2>
          <p className="mt-3 text-fg-muted">Hurtige svar på de mest almindelige spørgsmål.</p>
        </div>
        <div className="mt-10 glass-panel overflow-hidden divide-y divide-[var(--glass-border)]">
          {[
            { q: "Er PowerShell-scriptet sikkert?", a: "Ja — det er open source og kan læses direkte via /api/public/install.ps1. Det installerer i din brugerprofil og kræver ikke administrator." },
            { q: "Hvordan opdaterer jeg?", a: "Kør update-kommandoen ovenfor, eller vent på auto-update i v1.0. Alle udgivelser er signerede." },
            { q: "Kan jeg afinstallere rent?", a: "Ja. Uninstall-scriptet fjerner alt — binærer, cache og indstillinger. Der efterlades intet." },
          ].map((f) => (
            <details key={f.q} className="group">
              <summary className="list-none cursor-pointer px-6 py-5 flex items-center gap-4">
                <span className="flex-1 font-medium text-sm text-fg">{f.q}</span>
                <span className="grid h-7 w-7 place-items-center rounded-full border border-[var(--glass-border)] text-fg-muted group-open:hidden">
                  <Plus className="h-3.5 w-3.5" />
                </span>
                <span className="hidden group-open:grid h-7 w-7 place-items-center rounded-full border border-[var(--glass-border)] text-fg-muted">
                  <Minus className="h-3.5 w-3.5" />
                </span>
              </summary>
              <div className="px-6 pb-6 text-sm text-fg-muted leading-relaxed animate-fade-in">{f.a}</div>
            </details>
          ))}
        </div>
      </section>
    </SiteLayout>
  );
}
