import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteLayout } from "@/components/site-layout";
import { StatusChip } from "@/components/status-chip";
import { Mail, MessageSquare, CheckCircle2, Github, Twitter, Send, User } from "lucide-react";

export const Route = createFileRoute("/kontakt")({
  head: () => ({
    meta: [
      { title: "Support — NOVYX" },
      { name: "description", content: "Kontakt NOVYX-teamet med spørgsmål, feedback eller support-forespørgsler." },
      { property: "og:title", content: "Support — NOVYX" },
      { property: "og:description", content: "Skriv til os med spørgsmål eller feedback." },
      { property: "og:url", content: "/kontakt" },
    ],
    links: [{ rel: "canonical", href: "/kontakt" }],
  }),
  component: Kontakt,
});

const CHANNELS = [
  { icon: Mail, label: "Email", value: "hej@novyx.app", href: "mailto:hej@novyx.app" },
  { icon: Github, label: "GitHub", value: "github.com/novyx", href: "https://github.com/" },
  { icon: Twitter, label: "X", value: "@novyx_app", href: "https://x.com/" },
];

function Kontakt() {
  const [sent, setSent] = useState(false);
  const [topic, setTopic] = useState("Support");

  return (
    <SiteLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-mesh opacity-70" />
        <div className="mx-auto max-w-4xl px-6 pt-24 md:pt-32 pb-16 text-center">
          <div className="eyebrow">Support</div>
          <h1 className="mt-4 font-display text-5xl md:text-7xl font-semibold tracking-tight leading-[1.02]">
            Skriv til <span className="text-brand-gradient">os.</span>
          </h1>
          <p className="mt-6 mx-auto max-w-xl text-lg text-fg-muted leading-relaxed">
            Bug reports, feature requests, kommercielle henvendelser eller bare feedback —
            vi læser alt og vender som regel tilbage inden for 24 timer.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          {sent ? (
            <div className="glass-panel p-12 text-center animate-scale-in">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[color:var(--success-soft)] text-[color:var(--success)] border border-[color:var(--success)]/30">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h2 className="mt-6 font-display text-2xl font-semibold text-fg">Tak for din besked!</h2>
              <p className="mt-2 text-sm text-fg-muted">Vi vender tilbage så hurtigt vi kan.</p>
              <button onClick={() => setSent(false)} className="btn-ghost mt-8">
                Send en ny besked
              </button>
            </div>
          ) : (
            <form
              className="glass-panel p-8 md:p-10 space-y-6"
              onSubmit={(e) => { e.preventDefault(); setSent(true); }}
            >
              <div className="flex flex-wrap gap-2 pb-5 border-b border-[var(--glass-border)]">
                {["Support", "Bug report", "Feature request", "Business"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTopic(t)}
                    className={
                      "rounded-full px-3.5 py-1.5 text-xs font-medium transition-all " +
                      (topic === t
                        ? "bg-gradient-to-b from-[#60A5FA] to-[#3B82F6] text-white border border-white/15 shadow-[0_1px_0_0_rgba(255,255,255,0.2)_inset,0_6px_20px_-6px_rgba(59,130,246,0.55)]"
                        : "border border-[var(--glass-border)] bg-white/[0.03] text-fg-muted hover:text-fg hover:border-[var(--glass-border-hover)]")
                    }
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Navn" icon={User}>
                  <input
                    required
                    className="w-full rounded-xl border border-[var(--glass-border)] bg-white/[0.03] px-4 py-3 text-sm text-fg outline-none focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-ring)] transition-all placeholder:text-fg-dim"
                    placeholder="Dit navn"
                  />
                </Field>
                <Field label="Email" icon={Mail}>
                  <input
                    required
                    type="email"
                    className="w-full rounded-xl border border-[var(--glass-border)] bg-white/[0.03] px-4 py-3 text-sm text-fg outline-none focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-ring)] transition-all placeholder:text-fg-dim"
                    placeholder="din@email.dk"
                  />
                </Field>
              </div>
              <Field label="Besked" icon={MessageSquare}>
                <textarea
                  required
                  rows={7}
                  className="w-full rounded-xl border border-[var(--glass-border)] bg-white/[0.03] px-4 py-3 text-sm text-fg outline-none focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-ring)] transition-all resize-none placeholder:text-fg-dim"
                  placeholder={`Beskriv din ${topic.toLowerCase()}…`}
                />
              </Field>
              <button className="btn-primary w-full">
                <Send className="h-4 w-4" /> Send besked
              </button>
            </form>
          )}
        </div>

        <aside className="space-y-5">
          <div className="glass-panel p-6">
            <div className="eyebrow">Kanaler</div>
            <ul className="mt-5 space-y-3">
              {CHANNELS.map((c) => (
                <li key={c.label}>
                  <a
                    href={c.href}
                    className="flex items-center gap-3 rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] p-3.5 hover:border-[var(--glass-border-hover)] hover:bg-white/[0.05] transition-all group"
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-b from-[rgba(59,130,246,0.22)] to-[rgba(59,130,246,0.06)] border border-[rgba(59,130,246,0.28)] text-[color:var(--accent-2)]">
                      <c.icon className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-widest text-fg-dim">{c.label}</div>
                      <div className="text-sm text-fg font-mono truncate group-hover:text-[color:var(--accent-2)] transition-colors">{c.value}</div>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-panel p-6">
            <div className="eyebrow">Response</div>
            <div className="mt-4 flex items-center gap-3">
              <StatusChip tone="success" dot>Under 24t</StatusChip>
              <span className="text-xs text-fg-muted">gennemsnitlig svartid</span>
            </div>
            <p className="mt-4 text-xs text-fg-muted leading-relaxed">
              Bug reports med logs (Diagnostics → Eksportér rapport) prioriteres
              og løses typisk i næste minor-release.
            </p>
          </div>
        </aside>
      </section>
    </SiteLayout>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon: typeof Mail; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-widest text-fg-dim flex items-center gap-1.5 mb-2">
        <Icon className="h-3.5 w-3.5 text-[color:var(--accent-2)]" strokeWidth={1.75} /> {label}
      </span>
      {children}
    </label>
  );
}
