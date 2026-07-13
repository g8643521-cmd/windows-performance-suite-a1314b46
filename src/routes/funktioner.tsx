import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteLayout } from "@/components/site-layout";
import { FEATURES, CATEGORY_LABEL, type FeatureCategory } from "@/lib/features";
import { StatusChip } from "@/components/status-chip";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/funktioner")({
  head: () => ({
    meta: [
      { title: "Features — NOVYX" },
      { name: "description", content: "Alle NOVYX-moduler samlet ét sted: Deep System Scan, One-Click Boost, Precision Cleaner, Game Mode, Live Diagnostics og flere." },
      { property: "og:title", content: "Features — NOVYX" },
      { property: "og:description", content: "Modulær premium Windows-optimering." },
      { property: "og:url", content: "/funktioner" },
    ],
    links: [{ rel: "canonical", href: "/funktioner" }],
  }),
  component: Features,
});

const FILTERS: Array<{ key: "all" | FeatureCategory; label: string }> = [
  { key: "all", label: "Alle" },
  { key: "core", label: CATEGORY_LABEL.core },
  { key: "performance", label: CATEGORY_LABEL.performance },
  { key: "gaming", label: CATEGORY_LABEL.gaming },
  { key: "system", label: CATEGORY_LABEL.system },
];

function Features() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const list = filter === "all" ? FEATURES : FEATURES.filter((f) => f.category === filter);

  return (
    <SiteLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-mesh opacity-70" />
        <div className="mx-auto max-w-4xl px-6 pt-24 md:pt-32 pb-16 text-center">
          <div className="eyebrow">Feature stack</div>
          <h1 className="mt-4 font-display text-5xl md:text-7xl font-semibold tracking-tight leading-[1.02]">
            Alt værktøjet. <br className="hidden md:inline" />
            <span className="text-brand-gradient">Ét program.</span>
          </h1>
          <p className="mt-6 text-lg text-fg-muted max-w-xl mx-auto">
            Modulært opbygget. Kør kun det du bruger. Alt kan rulles tilbage.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="flex flex-wrap justify-center gap-2 mb-14">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={
                  "rounded-full px-4 py-2 text-xs font-medium transition-all " +
                  (active
                    ? "bg-gradient-to-b from-[#60A5FA] to-[#3B82F6] text-white border border-white/15 shadow-[0_1px_0_0_rgba(255,255,255,0.25)_inset,0_6px_20px_-6px_rgba(59,130,246,0.55)]"
                    : "border border-[var(--glass-border)] bg-white/[0.03] text-fg-muted hover:text-fg hover:border-[var(--glass-border-hover)]")
                }
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {list.map((f) => {
            const tone =
              f.status === "stable" ? "success" :
              f.status === "beta" ? "warning" : "neutral";
            const badge =
              f.status === "stable" ? "Stable" :
              f.status === "beta" ? "Beta" : "Coming";
            return (
              <article key={f.title} className="glass-card glass-card-hover p-7 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-b from-[rgba(59,130,246,0.22)] to-[rgba(59,130,246,0.06)] border border-[rgba(59,130,246,0.35)] text-[color:var(--accent-2)]">
                  <f.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="mt-4">
                  <StatusChip tone={tone as "success" | "warning" | "neutral"} dot={f.status === "stable"}>{badge}</StatusChip>
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold text-fg">{f.title}</h3>
                <p className="mt-2 text-sm text-fg-muted leading-relaxed">{f.description}</p>
                <div className="mt-5 pt-4 border-t border-[var(--glass-border)] text-[10px] uppercase tracking-widest text-fg-dim">
                  {CATEGORY_LABEL[f.category]}
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-16 glass-panel p-8 md:p-12 text-center">
          <h3 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-fg">Klar til at prøve NOVYX?</h3>
          <p className="mt-3 text-fg-muted">105 MB. Ingen registrering. Ingen reklamer.</p>
          <div className="mt-8 flex justify-center">
            <Link to="/changelog" className="btn-primary">
              Download NOVYX <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
