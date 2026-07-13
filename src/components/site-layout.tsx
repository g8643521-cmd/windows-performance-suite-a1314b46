import { Link, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useState, useEffect } from "react";
import { Menu, X, Download, Github, MessageCircle, Circle } from "lucide-react";
import { NovyxMark, NovyxWordmark } from "@/components/brand/logo";
import { APP_VERSION, DOWNLOAD_PATH } from "@/lib/app-version";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/funktioner", label: "Features" },
  { to: "/changelog", label: "Download" },
  { to: "/faq", label: "FAQ" },
  { to: "/om", label: "Roadmap" },
  { to: "/kontakt", label: "Support" },
] as const;

function useActivePath() {
  return useRouterState({ select: (s) => s.location.pathname });
}

/**
 * NOVYX — Site Layout v4
 *  - Sticky glass top-nav (Linear / Vercel / Raycast style)
 *  - Center navigation, floating over content
 *  - Extra opacity + shadow on scroll
 *  - Big multi-column footer
 */
export function SiteLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const current = useActivePath();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setOpen(false); }, [current]);

  return (
    <div className="min-h-screen text-fg">
      {/* ========================= TOP NAV ========================= */}
      <header
        className={
          "fixed top-0 inset-x-0 z-50 transition-all duration-200 " +
          (scrolled
            ? "backdrop-blur-2xl bg-[rgba(8,10,16,0.72)] border-b border-[rgba(255,255,255,0.06)] shadow-[0_8px_32px_-16px_rgba(0,0,0,0.6)]"
            : "backdrop-blur-xl bg-[rgba(8,10,16,0.35)] border-b border-transparent")
        }
      >
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="h-[72px] md:h-[76px] grid grid-cols-[auto_1fr_auto] items-center gap-6">
            {/* Left — logo */}
            <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
              <NovyxMark className="h-8 w-8 transition-transform duration-200 group-hover:scale-105" />
              <NovyxWordmark className="text-[15px] hidden sm:inline-flex" />
            </Link>

            {/* Center — nav */}
            <nav className="hidden md:flex items-center justify-center">
              <div className="flex items-center gap-1 rounded-full border border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] backdrop-blur-xl p-1">
                {NAV.map((n) => {
                  const active = n.to === "/" ? current === "/" : current === n.to || current.startsWith(n.to + "/");
                  return (
                    <Link
                      key={n.to}
                      to={n.to}
                      className={
                        "relative px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all duration-150 " +
                        (active
                          ? "text-fg bg-[rgba(255,255,255,0.08)]"
                          : "text-fg-muted hover:text-fg")
                      }
                    >
                      {n.label}
                    </Link>
                  );
                })}
              </div>
            </nav>

            {/* Right — actions */}
            <div className="flex items-center gap-2 justify-end">
              <a
                href="https://github.com/"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub"
                className="hidden sm:grid h-9 w-9 place-items-center rounded-full border border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] text-fg-muted hover:text-fg hover:border-[var(--glass-border-hover)] transition-all"
              >
                <Github className="h-4 w-4" strokeWidth={1.75} />
              </a>
              <a
                href="https://discord.com/"
                target="_blank"
                rel="noreferrer"
                aria-label="Discord"
                className="hidden sm:grid h-9 w-9 place-items-center rounded-full border border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] text-fg-muted hover:text-fg hover:border-[var(--glass-border-hover)] transition-all"
              >
                <MessageCircle className="h-4 w-4" strokeWidth={1.75} />
              </a>
              <span className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1 text-[11px] text-fg-muted">
                <Circle className="h-1.5 w-1.5 fill-[color:var(--success)] text-[color:var(--success)]" />
                All systems online
              </span>
              <a
                href={DOWNLOAD_PATH}
                download={APP_VERSION.filename}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-b from-[#60A5FA] to-[#3B82F6] px-4 py-2 text-[13px] font-medium text-white border border-white/15 shadow-[0_1px_0_0_rgba(255,255,255,0.25)_inset,0_8px_24px_-8px_rgba(59,130,246,0.55)] hover:brightness-110 transition-all"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Download</span>
              </a>
              <button
                onClick={() => setOpen(true)}
                aria-label="Åbn menu"
                className="md:hidden grid h-9 w-9 place-items-center rounded-full border border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] text-fg-muted hover:text-fg"
              >
                <Menu className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-[60]">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-0 right-0 h-full w-[86%] max-w-sm bg-[rgba(10,12,19,0.96)] backdrop-blur-2xl border-l border-[var(--glass-border)] p-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <Link to="/" onClick={() => setOpen(false)} className="flex items-center gap-2.5">
                <NovyxMark className="h-8 w-8" />
                <NovyxWordmark className="text-sm" />
              </Link>
              <button
                onClick={() => setOpen(false)}
                aria-label="Luk menu"
                className="grid h-9 w-9 place-items-center rounded-full border border-[var(--glass-border)] text-fg-muted hover:text-fg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="mt-10 flex flex-col gap-1">
              {NAV.map((n) => {
                const active = n.to === "/" ? current === "/" : current === n.to;
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    onClick={() => setOpen(false)}
                    className={
                      "rounded-xl px-4 py-3 text-base font-medium transition-colors " +
                      (active ? "text-fg bg-[rgba(255,255,255,0.06)]" : "text-fg-muted hover:text-fg hover:bg-[rgba(255,255,255,0.04)]")
                    }
                  >
                    {n.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-8 pt-6 border-t border-[var(--glass-border)] flex items-center gap-3">
              <a href="https://github.com/" target="_blank" rel="noreferrer" aria-label="GitHub" className="grid h-10 w-10 place-items-center rounded-full border border-[var(--glass-border)] text-fg-muted hover:text-fg">
                <Github className="h-4 w-4" />
              </a>
              <a href="https://discord.com/" target="_blank" rel="noreferrer" aria-label="Discord" className="grid h-10 w-10 place-items-center rounded-full border border-[var(--glass-border)] text-fg-muted hover:text-fg">
                <MessageCircle className="h-4 w-4" />
              </a>
              <span className="ml-auto chip">v{APP_VERSION.latest}</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================= MAIN ========================= */}
      <main className="pt-[72px] md:pt-[76px]">{children}</main>

      {/* ========================= FOOTER ========================= */}
      <SiteFooter />
    </div>
  );
}

function SiteFooter() {
  const cols = [
    {
      title: "Product",
      links: [
        { to: "/funktioner", label: "Features" },
        { to: "/changelog", label: "Download" },
        { to: "/om", label: "Roadmap" },
        { to: "/faq", label: "FAQ" },
      ],
    },
    {
      title: "Support",
      links: [
        { to: "/kontakt", label: "Contact" },
        { to: "/faq", label: "Help center" },
        { href: "/api/public/install.ps1", label: "PowerShell installer", external: true },
        { href: "https://github.com/", label: "Report an issue", external: true },
      ],
    },
    {
      title: "Company",
      links: [
        { to: "/om", label: "About" },
        { to: "/om", label: "Manifesto" },
        { to: "/om", label: "Careers" },
        { to: "/kontakt", label: "Press" },
      ],
    },
    {
      title: "Community",
      links: [
        { href: "https://discord.com/", label: "Discord", external: true },
        { href: "https://github.com/", label: "GitHub", external: true },
        { href: "https://x.com/", label: "X / Twitter", external: true },
        { href: "https://status.novyx.app/", label: "Status", external: true },
      ],
    },
  ] as const;

  return (
    <footer className="mt-32 relative overflow-hidden border-t border-[var(--glass-border)]">
      <div className="absolute inset-0 bg-mesh opacity-40 pointer-events-none" />
      <div className="relative mx-auto max-w-7xl px-6 md:px-8 pt-20 pb-10">
        <div className="grid gap-12 md:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div>
            <Link to="/" className="flex items-center gap-2.5">
              <NovyxMark className="h-9 w-9" />
              <NovyxWordmark className="text-lg" />
            </Link>
            <p className="mt-5 text-sm text-fg-muted max-w-xs leading-relaxed">
              Premium Windows performance. Bygget til gamere og power-users
              der ikke går på kompromis. Tune. Boost. Play.
            </p>
            <div className="mt-6 flex items-center gap-2">
              <a href="https://github.com/" target="_blank" rel="noreferrer" aria-label="GitHub" className="grid h-9 w-9 place-items-center rounded-full border border-[var(--glass-border)] text-fg-muted hover:text-fg hover:border-[var(--glass-border-hover)] transition-all">
                <Github className="h-4 w-4" />
              </a>
              <a href="https://discord.com/" target="_blank" rel="noreferrer" aria-label="Discord" className="grid h-9 w-9 place-items-center rounded-full border border-[var(--glass-border)] text-fg-muted hover:text-fg hover:border-[var(--glass-border-hover)] transition-all">
                <MessageCircle className="h-4 w-4" />
              </a>
            </div>
          </div>

          {cols.map((c) => (
            <div key={c.title}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-dim">{c.title}</div>
              <ul className="mt-5 space-y-3">
                {c.links.map((l) => (
                  <li key={l.label}>
                    {"to" in l ? (
                      <Link to={l.to} className="text-sm text-fg-muted hover:text-fg transition-colors">
                        {l.label}
                      </Link>
                    ) : (
                      <a href={l.href} target={l.external ? "_blank" : undefined} rel={l.external ? "noreferrer" : undefined} className="text-sm text-fg-muted hover:text-fg transition-colors">
                        {l.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-[var(--glass-border)] flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div className="text-xs text-fg-dim">
            © {new Date().getFullYear()} NOVYX. Windows er et varemærke tilhørende Microsoft.
          </div>
          <div className="flex items-center gap-4 text-xs text-fg-dim">
            <span className="inline-flex items-center gap-1.5">
              <Circle className="h-1.5 w-1.5 fill-[color:var(--success)] text-[color:var(--success)]" />
              All systems online
            </span>
            <span className="font-mono">v{APP_VERSION.latest}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
