import { useEffect, useState } from "react";
import { Sliders, ExternalLink, Loader2 } from "lucide-react";
import { EmptyState } from "../components/Pending";
import { isDesktop, listTweaks, openExternal, type TweakItem } from "../lib/hardware";

export function TweaksPage() {
  const desktop = isDesktop();
  const [items, setItems] = useState<TweakItem[] | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => { if (desktop) listTweaks().then(setItems).catch(() => setItems([])); }, [desktop]);

  if (!desktop) {
    return (
      <div className="h-full overflow-y-auto px-10 py-8">
        <EmptyState icon={<Sliders className="h-6 w-6" />} title="Tweaks kræver desktop-appen"
          text="Åbner rigtige Windows-indstillinger direkte — ikke tilgængeligt i browseren." />
      </div>
    );
  }

  async function open(t: TweakItem) {
    setPending(t.id);
    try { await openExternal(t.target); }
    finally { setPending(null); }
  }

  return (
    <div className="h-full overflow-y-auto px-10 py-8">
      <p className="mb-6 max-w-[64ch] text-[13px] text-[color:var(--ink-mid)]">
        Hver tweak åbner det pågældende Windows-indstillingspanel direkte. NOVYX ændrer intet i registret uden din bekræftelse.
      </p>
      <div className="grid grid-cols-2 gap-4">
        {(items ?? []).map((t) => (
          <button
            key={t.id}
            onClick={() => open(t)}
            className="glass-card card-lift group flex items-start gap-4 text-left"
            style={{ padding: "var(--card-pad)" }}
          >
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[color:var(--ink-hi)]"
              style={{ background: "var(--grad-primary-soft)", border: "1px solid rgba(59,130,246,0.24)" }}>
              <Sliders className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold text-white">{t.label}</div>
              <div className="mt-1 text-[12px] text-[color:var(--ink-mid)]">{t.detail}</div>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-low)]">
                {pending === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
                Åbn i Windows
              </div>
            </div>
          </button>
        ))}
        {items && items.length === 0 && (
          <div className="col-span-2 text-[13px] text-[color:var(--ink-faint)]">Ingen tweaks tilgængelige.</div>
        )}
      </div>
    </div>
  );
}
