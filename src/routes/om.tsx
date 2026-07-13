import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site-layout";
import { StatusChip } from "@/components/status-chip";
import { NovyxMark } from "@/components/brand/logo";
import { Compass, Zap, ShieldCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/om")({
  head: () => ({
    meta: [
      { title: "Roadmap — NOVYX" },
      { name: "description", content: "NOVYX er et selvstændigt Windows-optimeringsprogram bygget til gamere og power-users. Lokalt, sikkert, uden telemetri." },
      { property: "og:title", content: "Roadmap — NOVYX" },
      { property: "og:description", content: "Vores mission og roadmap: premium Windows-performance uden bloatware." },
      { property: "og:url", content: "/om" },
    ],
    links: [{ rel: "canonical", href: "/om" }],
  }),
  component: About,
});

const PRINCIPLES = [
  { icon: Compass, title: "Målt, ikke gættet", desc: "Alt vi optimerer er baseret på faktiske målinger og benchmarks — ikke overtro." },
  { icon: ShieldCheck, title: "Lokalt eller intet", desc: "NOVYX sender ikke data ud af din PC. Ingen telemetri. Ingen konto. Ingen cloud." },
  { icon: Zap, title: "Hastighed før alt", desc: "Programmet er selv optimeret — under 1,5 MB app.asar, boot på under 900 ms." },
  { icon: Sparkles, title: "Design betyder noget", desc: "Et professionelt program skal se professionelt ud — ned til hver enkelt animation." },
];

const TIMELINE = [
  { badge: "Nu",       phase: "v0.7 — Rebrand", desc: "Nyt brand (NOVYX), Design System v4, Games-modul redesignet." },
  { badge: "Snart",    phase: "v0.8 — Gaming",  desc: "Game Mode GA, FPS Overlay, Latency Tuner ud af beta." },
  { badge: "Q4 2026",  phase: "v1.0 — GA",      desc: "Automatiske opdateringer, Registry Compactor, Storage Auditor." },
  { badge: "2027",     phase: "v1.x — Premium", desc: "Pro-plan, cloud-sync af profiler, community-tweaks." },
];

function About() {
  return (
    <SiteLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-mesh opacity-70" />
        <div className="mx-auto max-w-4xl px-6 pt-24 md:pt-32 pb-16 text-center">
          <div className="eyebrow">Roadmap & Manifesto</div>
          <h1 className="mt-4 font-display text-5xl md:text-7xl font-semibold tracking-tight leading-[1.02]">
            Performance,<br />
            <span className="text-brand-gradient">taget seriøst.</span>
          </h1>
          <p className="mt-6 mx-auto max-w-xl text-lg text-fg-muted leading-relaxed">
            NOVYX er bygget som et selvstændigt premium-produkt til folk der
            tager deres Windows-maskine seriøst. Ingen bloatware. Ingen
            telemetri. Ingen kompromiser.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <StatusChip tone="accent" dot>Aktivt udviklet</StatusChip>
            <StatusChip tone="success">Lokal-first</StatusChip>
            <StatusChip tone="neutral">Open PowerShell installer</StatusChip>
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-center max-w-2xl mx-auto">
          <div className="eyebrow">Principper</div>
          <h2 className="mt-4 font-display text-4xl md:text-5xl font-semibold tracking-tight">Hvad NOVYX står for</h2>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="glass-card glass-card-hover p-8 flex gap-5">
              <div className="shrink-0 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-b from-[rgba(59,130,246,0.22)] to-[rgba(59,130,246,0.06)] border border-[rgba(59,130,246,0.35)] text-[color:var(--accent-2)]">
                <p.icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-fg">{p.title}</h3>
                <p className="mt-2 text-sm text-fg-muted leading-relaxed">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Roadmap */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="text-center max-w-2xl mx-auto">
          <div className="eyebrow">Roadmap</div>
          <h2 className="mt-4 font-display text-4xl md:text-5xl font-semibold tracking-tight">Hvor NOVYX er på vej hen</h2>
        </div>

        <div className="mt-14 relative">
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-[rgba(59,130,246,0.4)] via-[var(--glass-border)] to-transparent" />
          <div className="space-y-5">
            {TIMELINE.map((t, i) => (
              <div key={t.phase} className="relative pl-14">
                <div className={"absolute left-0 top-4 grid h-10 w-10 place-items-center rounded-full border " + (i === 0 ? "bg-gradient-to-b from-[#60A5FA] to-[#3B82F6] border-white/20 text-white shadow-[0_0_0_4px_rgba(59,130,246,0.15)]" : "glass text-[color:var(--accent-2)]")}>
                  <span className="font-mono text-[10px]">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <div className="glass-panel p-6">
                  <div className="eyebrow">{t.badge}</div>
                  <div className="mt-2 font-display text-xl font-semibold text-fg">{t.phase}</div>
                  <p className="mt-2 text-sm text-fg-muted leading-relaxed">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Brand card */}
      <section className="mx-auto max-w-3xl px-6 pb-24">
        <div className="glass-panel bg-noise p-10 text-center">
          <NovyxMark className="mx-auto h-14 w-14" />
          <div className="mt-5 font-display text-2xl font-semibold text-fg">NOVYX</div>
          <div className="text-sm text-fg-muted mt-1">Tune. Boost. Play.</div>
          <p className="mt-6 mx-auto max-w-md text-sm text-fg-muted leading-relaxed">
            Uafhængigt Windows-optimeringsprogram. Ingen tilknytning til Microsoft eller andre hardware-mærker.
          </p>
        </div>
      </section>
    </SiteLayout>
  );
}
