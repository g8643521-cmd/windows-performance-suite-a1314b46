import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site-layout";
import { StatusChip } from "@/components/status-chip";
import { APP_VERSION, CHANGELOG, formatReleaseDate, getReleaseTypeMeta } from "@/lib/app-version";
import { Package, Download, Zap, ShieldCheck, Sparkles, Cpu } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/changelog")({
  head: () => ({
    meta: [
      { title: `Versionshistorik — NOVYX v${APP_VERSION.latest}` },
      { name: "description", content: `Fuld versionshistorik og release notes for NOVYX. ${CHANGELOG.length} udgivelser. Seneste: v${APP_VERSION.latest}.` },
      { property: "og:title", content: `NOVYX Versionshistorik` },
      { property: "og:description", content: `${CHANGELOG.length} udgivelser · seneste v${APP_VERSION.latest}` },
      { property: "og:url", content: "/changelog" },
    ],
    links: [{ rel: "canonical", href: "/changelog" }],
  }),
  component: ChangelogPage,
});

function ChangelogPage() {
  const [now, setNow] = useState<number | undefined>(undefined);
  const [openRelease, setOpenRelease] = useState<string | null>(CHANGELOG[0]?.version ?? null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <SiteLayout>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-mesh opacity-80" />
        <div className="absolute inset-0 -z-10 bg-grid opacity-30" />

        <div className="mx-auto max-w-5xl px-6 pt-20 md:pt-24 pb-6 text-center">
          <div className="eyebrow">Release notes</div>
          <h1 className="mt-4 font-display text-5xl md:text-6xl font-semibold tracking-tight leading-[1.02]">
            <span className="text-brand-gradient">Versionshistorik</span>
          </h1>
          <p className="mt-5 text-lg text-fg-muted max-w-2xl mx-auto leading-relaxed">
            Alle udgivelser af NOVYX — nyeste øverst. {CHANGELOG.length} udgivelser
            {now !== undefined && ` · seneste ${formatReleaseDate(CHANGELOG[0].date, CHANGELOG[0].time, now).relative}`}.
          </p>
        </div>

        {/* PROGRAM SHOWCASE */}
        <div className="relative mx-auto max-w-5xl px-6 pt-6 pb-4">
          <div className="glass-panel bg-noise overflow-hidden animate-scale-in" style={{ boxShadow: "var(--shadow-hero)" }}>
            {/* Title bar */}
            <div className="flex items-center gap-3 px-5 h-11 border-b border-[var(--glass-border)]">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              </div>
              <span className="text-[11px] text-fg-muted font-mono ml-2">NOVYX Optimizer · v{APP_VERSION.latest}</span>
              <StatusChip tone="success" dot className="ml-auto">Ready</StatusChip>
            </div>

            {/* App body */}
            <div className="grid md:grid-cols-[180px_1fr]">
              {/* Sidebar mock */}
              <aside className="hidden md:flex flex-col gap-1 p-4 border-r border-[var(--glass-border)] bg-[rgba(255,255,255,0.02)]">
                {[
                  { i: Sparkles, label: "Dashboard", active: true },
                  { i: Zap, label: "Boost" },
                  { i: Cpu, label: "System" },
                  { i: ShieldCheck, label: "Privacy" },
                  { i: Package, label: "Modules" },
                ].map((r) => (
                  <div
                    key={r.label}
                    className={
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] " +
                      (r.active
                        ? "bg-[rgba(59,130,246,0.14)] text-fg border border-[rgba(59,130,246,0.35)]"
                        : "text-fg-muted border border-transparent")
                    }
                  >
                    <r.i className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <span>{r.label}</span>
                  </div>
                ))}
                <div className="mt-auto pt-4 text-[10px] font-mono text-fg-dim">v{APP_VERSION.latest}</div>
              </aside>

              {/* Main mock */}
              <div className="p-6 md:p-8">
                <div className="grid gap-6 md:grid-cols-[1.15fr_1fr] items-center">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-fg-dim">Health Score</div>
                    <div className="mt-2 font-display text-6xl md:text-7xl font-semibold text-fg tabular-nums leading-none">
                      92<span className="text-fg-muted text-3xl">/100</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <StatusChip tone="accent" dot>Optimized</StatusChip>
                      <StatusChip tone="neutral">Windows 10 · 11</StatusChip>
                    </div>
                    <p className="mt-4 text-sm text-fg-muted max-w-sm">
                      One-Click Boost rydder cache, frigør RAM, tuner services og flusher DNS på under 30 sekunder.
                    </p>
                  </div>

                  <div className="grid gap-2.5">
                    {[
                      { label: "CPU", value: "12%", bar: 18 },
                      { label: "RAM", value: "8.2 / 16 GB", bar: 52 },
                      { label: "GPU", value: "24%", bar: 24 },
                      { label: "DISK", value: "3%", bar: 8 },
                    ].map((m) => (
                      <div key={m.label} className="glass-card p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-[0.2em] text-fg-dim">{m.label}</span>
                          <span className="font-mono text-xs text-fg tabular-nums">{m.value}</span>
                        </div>
                        <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-[#60A5FA] to-[#22D3EE]" style={{ width: `${m.bar}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 glass-card p-4 flex items-center gap-4">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-b from-[rgba(59,130,246,0.25)] to-[rgba(59,130,246,0.08)] border border-[rgba(59,130,246,0.35)] text-[color:var(--accent-2)]">
                    <Zap className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-fg font-medium">One-Click Boost</div>
                    <div className="text-xs text-fg-muted">Rydder cache · frigør RAM · flusher DNS</div>
                  </div>
                  <span className="btn-primary !py-2.5 !px-4 !text-xs pointer-events-none">Kør</span>
                </div>
              </div>
            </div>
          </div>

          {/* Meta strip under showcase */}
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { k: "Version", v: `v${APP_VERSION.latest}` },
              { k: "Størrelse", v: APP_VERSION.fileSize },
              { k: "Platform", v: "Windows 10 · 11" },
              { k: "Udgivelser", v: `${CHANGELOG.length}` },
            ].map((m) => (
              <div key={m.k} className="glass-card px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-fg-dim">{m.k}</div>
                <div className="mt-1 font-mono text-sm text-fg tabular-nums">{m.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Download CTA */}
        <div className="mx-auto max-w-5xl px-6 pt-6 pb-12 text-center">
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/download" className="btn-primary !text-base !py-3.5 !px-6">
              <Download className="h-4 w-4" /> Hent seneste (v{APP_VERSION.latest})
            </Link>
            <a href="#versions" className="btn-ghost !text-base !py-3.5 !px-5">
              Se versionshistorik
            </a>
          </div>
          <div className="mt-3 text-xs text-fg-dim">
            Gratis · Ingen konto · {APP_VERSION.fileSize} · Sikker download
          </div>
        </div>
      </section>

      {/* TIMELINE */}
      <section id="versions" className="mx-auto max-w-5xl px-6 pt-6 pb-24 scroll-mt-24">
        <div className="relative">
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
    </SiteLayout>
  );
}
