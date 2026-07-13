import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site-layout";
import { FEATURES } from "@/lib/features";
import { APP_VERSION, SOURCE_VERSION, SOURCE_AHEAD_OF_BUILD, DOWNLOAD_PATH } from "@/lib/app-version";
import { StatusChip } from "@/components/status-chip";
import { Download, ArrowRight, Shield, Activity, Gamepad2, Zap, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NOVYX — Premium Windows Performance" },
      { name: "description", content: "NOVYX er et premium Windows-optimeringsprogram. Kør ét-klik boost, ryd systemet og få mere ud af din PC — bygget til gamere og power-users." },
      { property: "og:title", content: "NOVYX — Premium Windows Performance" },
      { property: "og:description", content: "NOVYX er et premium Windows-optimeringsprogram. Kør ét-klik boost, ryd systemet og få mere ud af din PC — bygget til gamere og power-users." },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Home,
});

function Home() {
  const featured = FEATURES.slice(0, 6);

  return (
    <SiteLayout>
      {/* ============================ HERO ============================ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-mesh" />
          <div className="absolute inset-0 bg-grid opacity-40" />
        </div>

        <div className="mx-auto max-w-6xl px-6 pt-24 md:pt-32 pb-20 md:pb-28 text-center">
          <div className="inline-flex items-center gap-2 chip animate-fade-in">
            <Sparkles className="h-3 w-3 text-[color:var(--accent-2)]" />
            <span className="text-fg">Introducing NOVYX</span>
            <span className="text-fg-dim">·</span>
            <span>Download v{APP_VERSION.latest}</span>
            {SOURCE_AHEAD_OF_BUILD && (
              <>
                <span className="text-fg-dim">·</span>
                <span className="text-[color:var(--accent-2)]">Kildekode v{SOURCE_VERSION}</span>
              </>
            )}
          </div>

          <h1 className="mt-8 font-display text-[52px] leading-[1.02] md:text-[92px] md:leading-[0.98] font-semibold tracking-tight animate-rise">
            <span className="text-gradient">Premium performance</span><br />
            <span className="text-brand-gradient">for din PC.</span>
          </h1>

          <p className="mt-8 mx-auto max-w-2xl text-lg md:text-xl text-fg-muted leading-relaxed animate-rise">
            Et Windows-optimeringsprogram bygget som et rigtigt produkt.
            Ren ydelse, elegant UI, nul bloatware — designet til folk der tager
            deres maskine seriøst.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-3 animate-rise">
            <a href={DOWNLOAD_PATH} download={APP_VERSION.filename} className="btn-primary">
              <Download className="h-4 w-4" /> Download NOVYX
            </a>
            <Link to="/funktioner" className="btn-ghost">
              Se funktioner <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-6 text-xs text-fg-dim">
            Gratis · Ingen konto · 105 MB · Windows 10 & 11
          </div>
        </div>

        {/* App preview — glass */}
        <div className="relative mx-auto max-w-5xl px-6 pb-28">
          <div className="glass-panel bg-noise overflow-hidden animate-scale-in" style={{ boxShadow: "var(--shadow-hero)" }}>
            <div className="flex items-center gap-3 px-5 h-11 border-b border-[var(--glass-border)]">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              </div>
              <span className="text-[11px] text-fg-muted font-mono ml-2">novyx / control-center</span>
              <StatusChip tone="success" dot className="ml-auto">Live</StatusChip>
            </div>

            <div className="p-8 md:p-12">
              <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] items-center">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-fg-dim">Health Score</div>
                  <div className="mt-3 font-display text-6xl md:text-7xl font-semibold text-fg tabular-nums">
                    92<span className="text-fg-muted text-3xl">/100</span>
                  </div>
                  <div className="mt-3">
                    <StatusChip tone="accent" dot>Optimized</StatusChip>
                  </div>
                </div>

                <div className="grid gap-3">
                  {[
                    { label: "CPU", value: "12%", bar: 18 },
                    { label: "RAM", value: "8.2 / 16 GB", bar: 52 },
                    { label: "GPU", value: "24%", bar: 24 },
                  ].map((m) => (
                    <div key={m.label} className="glass-card p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-fg-dim">{m.label}</span>
                        <span className="font-mono text-sm text-fg tabular-nums">{m.value}</span>
                      </div>
                      <div className="mt-3 h-1 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#60A5FA] to-[#22D3EE]" style={{ width: `${m.bar}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 glass-card p-4 flex items-center gap-4">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-b from-[rgba(59,130,246,0.25)] to-[rgba(59,130,246,0.08)] border border-[rgba(59,130,246,0.35)] text-[color:var(--accent-2)]">
                  <Zap className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-fg font-medium">One-Click Boost</div>
                  <div className="text-xs text-fg-muted">Rydder cache, frigør RAM, flusher DNS</div>
                </div>
                <button className="btn-primary !py-2.5 !px-4 !text-xs">Kør</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ METRICS ============================ */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-y-14 gap-x-6 grid-cols-2 md:grid-cols-4 text-center">
          {[
            { k: "+42%", v: "gennemsnitlig FPS-gain" },
            { k: "< 30s", v: "fuld optimering" },
            { k: "14", v: "sikre moduler" },
            { k: "0", v: "telemetri" },
          ].map((m) => (
            <div key={m.k}>
              <div className="font-display text-5xl md:text-6xl font-semibold text-brand-gradient tabular-nums">{m.k}</div>
              <div className="mt-3 text-sm text-fg-muted">{m.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================ FEATURES ============================ */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-center max-w-2xl mx-auto">
          <div className="eyebrow">Feature stack</div>
          <h2 className="mt-4 font-display text-4xl md:text-5xl font-semibold tracking-tight">
            Alt du behøver.<br />
            <span className="text-fg-muted">Intet fyld.</span>
          </h2>
          <p className="mt-5 text-fg-muted">
            Modulært opbygget. Kør kun det du bruger. Alt kan rulles tilbage.
          </p>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {featured.map((f) => (
            <article key={f.title} className="glass-card glass-card-hover p-7 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-b from-[rgba(59,130,246,0.22)] to-[rgba(59,130,246,0.06)] border border-[rgba(59,130,246,0.35)] text-[color:var(--accent-2)]">
                <f.icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              {f.status === "beta" && <div className="mt-4"><StatusChip tone="warning">Beta</StatusChip></div>}
              {f.status === "coming" && <div className="mt-4"><StatusChip tone="neutral">Soon</StatusChip></div>}
              <h3 className="mt-5 font-display text-lg font-semibold text-fg">{f.title}</h3>
              <p className="mt-2 text-sm text-fg-muted leading-relaxed">{f.description}</p>
            </article>
          ))}
        </div>

        <div className="mt-14 flex justify-center">
          <Link to="/funktioner" className="btn-ghost">
            Se alle funktioner <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ============================ PILLARS ============================ */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-12 md:grid-cols-3 text-center">
          {[
            { icon: Shield, title: "Sikkert som standard", desc: "Ingen registry-hacks. Ingen risikable ændringer. Rollback på alt kritisk." },
            { icon: Activity, title: "Målt, ikke gættet", desc: "Live diagnostics og performance-score baseret på faktiske målinger." },
            { icon: Gamepad2, title: "Gaming-first", desc: "Game Mode, FPS overlay og latency-tuning bygget ind fra dag ét." },
          ].map((p) => (
            <div key={p.title} className="flex flex-col items-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl glass text-[color:var(--accent-2)]">
                <p.icon className="h-6 w-6" strokeWidth={1.75} />
              </div>
              <h3 className="mt-6 font-display text-xl font-semibold text-fg">{p.title}</h3>
              <p className="mt-3 text-sm text-fg-muted leading-relaxed max-w-xs">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============================ CTA ============================ */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="glass-panel bg-noise relative overflow-hidden p-12 md:p-20 text-center">
          <div className="absolute inset-0 bg-aurora opacity-70 pointer-events-none" />
          <div className="relative">
            <div className="eyebrow">Ready</div>
            <h2 className="mt-4 font-display text-4xl md:text-6xl font-semibold tracking-tight">
              Klar. Sat. <span className="text-brand-gradient">Boost.</span>
            </h2>
            <p className="mt-6 mx-auto max-w-md text-fg-muted">
              Hent NOVYX gratis — 105 MB, ingen registrering, ingen reklamer.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <a href={DOWNLOAD_PATH} download={APP_VERSION.filename} className="btn-primary">
                <Download className="h-4 w-4" /> Download til Windows
              </a>
              <Link to="/funktioner" className="btn-ghost">
                Udforsk funktioner <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
