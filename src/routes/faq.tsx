import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteLayout } from "@/components/site-layout";
import { HelpCircle, Plus, Minus } from "lucide-react";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — NOVYX" },
      { name: "description", content: "Svar på ofte stillede spørgsmål om NOVYX: sikkerhed, privatliv, systemkrav, prissætning og opdateringer." },
      { property: "og:title", content: "FAQ — NOVYX" },
      { property: "og:description", content: "Ofte stillede spørgsmål om NOVYX." },
      { property: "og:url", content: "/faq" },
    ],
    links: [{ rel: "canonical", href: "/faq" }],
  }),
  component: FAQ,
});

type Item = { q: string; a: string; cat: "generelt" | "sikkerhed" | "installation" | "roadmap" };

const items: Item[] = [
  { cat: "sikkerhed",   q: "Er NOVYX sikkert at bruge?", a: "Ja. NOVYX udfører kun anerkendte og reversible optimeringer. Registry-ændringer og systemtjenester ændres aldrig uden en forudgående bekræftelse og et rollback-punkt." },
  { cat: "generelt",    q: "Koster NOVYX noget?", a: "Nej. Nuværende version er 100% gratis uden reklamer og uden konto. En fremtidig Pro-plan er planlagt, men kernefunktionerne forbliver frit tilgængelige." },
  { cat: "sikkerhed",   q: "Sender NOVYX data om mig?", a: "Nej. Al optimering og diagnostik foregår lokalt. NOVYX indeholder ingen telemetri, analytics eller call-home." },
  { cat: "installation",q: "Hvilke Windows-versioner understøttes?", a: "Windows 10 og Windows 11, begge 64-bit. ARM- og Windows Server-understøttelse er ikke prioriteret." },
  { cat: "installation",q: "Skal jeg have administrator-rettigheder?", a: "Nej — NOVYX installeres i din brugerprofil (%LOCALAPPDATA%). Enkelte moduler (fx TCP-tuning) beder om admin ved brug." },
  { cat: "installation",q: "Kan jeg installere via PowerShell?", a: "Ja. Kør `irm https://novyx.app/api/public/install.ps1 | iex` i PowerShell. Scriptet er open source og kan læses direkte i browseren." },
  { cat: "generelt",    q: "Kan jeg fortryde en optimering?", a: "Ja. NOVYX opretter automatisk et gendannelsespunkt før større ændringer, og alle Cleaner-operationer kan gennemses i historik og eksporteres." },
  { cat: "generelt",    q: "Hvor ofte bør jeg køre optimering?", a: "For de fleste brugere: One-Click Boost én gang om ugen. Cleaner-modulet én gang om måneden. Diagnostics kan køre løbende." },
  { cat: "roadmap",     q: "Hvornår kommer Game Mode?", a: "Game Mode og FPS Overlay er planlagt til v0.8. Latency Tuner er allerede i beta i den nuværende version." },
  { cat: "roadmap",     q: "Kommer der automatiske opdateringer?", a: "Ja — auto-update er planlagt til v1.0. Indtil da kan du bruge `irm .../update.ps1 | iex` for at opdatere med én kommando." },
];

const CATS = [
  { key: "alle", label: "Alle" },
  { key: "generelt", label: "Generelt" },
  { key: "sikkerhed", label: "Sikkerhed" },
  { key: "installation", label: "Installation" },
  { key: "roadmap", label: "Roadmap" },
] as const;

function FAQ() {
  const [filter, setFilter] = useState<(typeof CATS)[number]["key"]>("alle");
  const [open, setOpen] = useState<string | null>(items[0].q);

  const list = filter === "alle" ? items : items.filter((i) => i.cat === filter);

  return (
    <SiteLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-mesh opacity-70" />
        <div className="mx-auto max-w-3xl px-6 pt-24 md:pt-32 pb-16 text-center">
          <div className="eyebrow">Support</div>
          <h1 className="mt-4 font-display text-5xl md:text-7xl font-semibold tracking-tight leading-[1.02]">
            Ofte stillede <br className="hidden md:inline" />
            <span className="text-brand-gradient">spørgsmål.</span>
          </h1>
          <p className="mt-6 text-lg text-fg-muted max-w-xl mx-auto">
            Kan du ikke finde svar? Skriv til os — vi vender som regel tilbage inden for 24 timer.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-24">
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {CATS.map((c) => {
            const active = filter === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setFilter(c.key)}
                className={
                  "rounded-full px-4 py-2 text-xs font-medium transition-all " +
                  (active
                    ? "bg-gradient-to-b from-[#60A5FA] to-[#3B82F6] text-white border border-white/15 shadow-[0_1px_0_0_rgba(255,255,255,0.25)_inset,0_6px_20px_-6px_rgba(59,130,246,0.55)]"
                    : "border border-[var(--glass-border)] bg-white/[0.03] text-fg-muted hover:text-fg hover:border-[var(--glass-border-hover)]")
                }
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="glass-panel overflow-hidden divide-y divide-[var(--glass-border)]">
          {list.map((i) => {
            const isOpen = open === i.q;
            return (
              <div key={i.q}>
                <button
                  onClick={() => setOpen(isOpen ? null : i.q)}
                  className="w-full flex items-center gap-4 px-6 py-5 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <HelpCircle className="h-4 w-4 text-[color:var(--accent-2)] shrink-0" strokeWidth={1.75} />
                  <span className="flex-1 font-medium text-fg text-[15px]">{i.q}</span>
                  <span className="grid h-7 w-7 place-items-center rounded-full border border-[var(--glass-border)] text-fg-muted shrink-0">
                    {isOpen ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-6 pb-6 pl-16 text-sm text-fg-muted leading-relaxed animate-fade-in">
                    {i.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </SiteLayout>
  );
}
