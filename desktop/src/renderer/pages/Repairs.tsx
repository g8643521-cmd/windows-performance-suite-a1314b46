import { useState } from "react";
import { Wrench, ShieldCheck, HardDrive, Network, Trash2, RefreshCw, LifeBuoy, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PendingChip } from "../components/Pending";
import { isDesktop, runRepair, openExternal } from "../lib/hardware";

type Tool = {
  id: string;
  title: string;
  description: string;
  detail: string;
  icon: LucideIcon;
  admin: boolean;
};

const TOOLS: Tool[] = [
  { id: "system-repair",  title: "Systemreparation",  description: "Genopret Windows-integritet efter uventede fejl eller opdateringer.",
    detail: "Kører SFC /scannow og DISM RestoreHealth i et admin-vindue.", icon: Wrench, admin: true },
  { id: "disk-cleanup",   title: "Diskoprydning",     description: "Fjern midlertidige filer og cache — sikkert og fortrydeligt.",
    detail: "Åbner Windows Diskoprydning (cleanmgr) for C:.", icon: Trash2, admin: false },
  { id: "network-reset",  title: "Netværksreset",     description: "Nulstil TCP/IP, DNS og Winsock hvis din forbindelse driller.",
    detail: "Kræver admin. Genstart Windows for at fuldføre. Din Wi-Fi-adgangskode bevares.", icon: Network, admin: true },
  { id: "driver-check",   title: "Driveropdatering",  description: "Kontrollér drivere og firmware via Windows Update.",
    detail: "Åbner Indstillinger › Windows Update. NOVYX installerer aldrig drivere uden dit valg.", icon: RefreshCw, admin: false },
  { id: "security-scan",  title: "Sikkerhedsscanning", description: "Kør Windows Defender hurtigscan.",
    detail: "Tager typisk 4–8 minutter. Kan pauses fra Defender.", icon: ShieldCheck, admin: true },
  { id: "disk-check",     title: "Lagerreparation",   description: "Undersøg diskens sundhed med CHKDSK.",
    detail: "Læs-verifikation kun. Skrive-reparation kræver din bekræftelse i Windows.", icon: HardDrive, admin: true },
];

type ToolState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "launched"; note: string | null }
  | { kind: "error"; error: string };

export function RepairsPage() {
  const desktop = isDesktop();
  const [state, setState] = useState<Record<string, ToolState>>({});

  const run = async (tool: Tool) => {
    setState((s) => ({ ...s, [tool.id]: { kind: "running" } }));
    try {
      const r = await runRepair(tool.id);
      setState((s) => ({
        ...s,
        [tool.id]: {
          kind: "launched",
          note: r.postNote ?? (tool.admin ? "Bekræft admin-prompt fra Windows." : "Startet."),
        },
      }));
    } catch (e) {
      setState((s) => ({
        ...s,
        [tool.id]: { kind: "error", error: e instanceof Error ? e.message : String(e) },
      }));
    }
  };

  const supportOpen = () =>
    openExternal("mailto:support@novyx.app?subject=NOVYX%20support").catch(() => {});

  return (
    <div className="h-full overflow-y-auto stage">
      <div className="page-container settle-list">

        {/* ══════════ HERO ══════════ */}
        <section className="relative pt-4">
          <span aria-hidden className="spot spot--blue" style={{ left: -140, top: -120, width: 460, height: 460, opacity: 0.35 }} />

          <div className="mat-frosted sh-ambient relative overflow-hidden" style={{ padding: "56px 56px", borderRadius: "var(--r-hero)" }}>
            <span aria-hidden className="lightline lightline--top" style={{ left: "10%", right: "10%" }} />

            <div className="grid grid-cols-1 items-start gap-14 lg:grid-cols-[1.3fr_auto]">
              <div className="max-w-2xl">
                <span className="kicker">Vedligeholdelse</span>
                <h1 className="display-lg mt-5">
                  Rolig reparation.
                  <br />
                  <span className="grad-text">Ingen overraskelser.</span>
                </h1>
                <p className="hero-lead" style={{ marginTop: 20 }}>
                  Alle værktøjer kører rigtige Windows-kommandoer i et admin-vindue,
                  så du kan følge outputtet live og altid annullere.
                </p>
                <div className="mt-10 flex flex-wrap items-center gap-3">
                  <span className="chip chip-emerald">
                    <ShieldCheck className="h-3 w-3" strokeWidth={2.2} />
                    Kører i eget vindue
                  </span>
                  <span className="chip">Admin kræves for de fleste</span>
                  {!desktop && <PendingChip label="Kun i desktop-appen" />}
                </div>
              </div>

              <div className="relative shrink-0 justify-self-center lg:justify-self-end">
                <div
                  className="relative grid h-[200px] w-[180px] place-items-center overflow-hidden"
                  style={{
                    background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)), linear-gradient(135deg, rgba(59,130,246,0.35), rgba(34,211,238,0.18) 60%, rgba(8,10,16,0.9))",
                    border: "1px solid rgba(59,130,246,0.3)",
                    borderRadius: "44% 44% 42% 42% / 32% 32% 55% 55%",
                    boxShadow: "0 40px 80px -20px rgba(59,130,246,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
                  }}
                >
                  <ShieldCheck className="h-24 w-24 text-white" strokeWidth={1.25} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════ VÆRKTØJS-RÆKKER ══════════ */}
        <section className="section">
          <div className="section-head">
            <div>
              <div className="section-title">Værktøjer</div>
              <div className="section-lead">Store forklaringer. Enkle valg. Kør ét ad gangen.</div>
            </div>
          </div>

          <div className="settle-list flex flex-col gap-3">
            {TOOLS.map((t) => {
              const Icon = t.icon;
              const st = state[t.id] ?? { kind: "idle" };
              return (
                <div key={t.id} className="calm-row">
                  <div className="calm-row__icon">
                    <Icon className="h-6 w-6 text-white/90" strokeWidth={1.6} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[17px] font-semibold text-white"
                      style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
                      {t.title}
                      {t.admin && <span className="chip ml-3" style={{ verticalAlign: "middle" }}>Admin</span>}
                    </div>
                    <div className="mt-1 text-[13.5px] leading-relaxed text-[color:var(--ink-mid)]">{t.description}</div>
                    <div className="mt-1.5 text-[12px] text-[color:var(--ink-faint)]">{t.detail}</div>

                    {st.kind === "launched" && (
                      <div className="mt-3 inline-flex items-center gap-2 text-[12.5px] text-emerald-300">
                        <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                        Startet — {st.note}
                      </div>
                    )}
                    {st.kind === "error" && (
                      <div className="mt-3 inline-flex items-center gap-2 text-[12.5px] text-amber-300">
                        <AlertTriangle className="h-4 w-4" strokeWidth={2} />
                        {st.error}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      className="btn btn-secondary"
                      disabled={!desktop || st.kind === "running"}
                      onClick={() => run(t)}
                    >
                      {st.kind === "running" && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />}
                      {st.kind === "running" ? "Starter…" : st.kind === "launched" ? "Kør igen" : "Kør"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ══════════ SUPPORT ══════════ */}
        <section className="section pb-6">
          <div className="mat-tinted reactive relative flex flex-wrap items-center gap-8" style={{ padding: "28px 32px" }}>
            <div className="illus-ring" style={{ height: 84, width: 84 }}>
              <LifeBuoy className="h-8 w-8 text-white" strokeWidth={1.6} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="display-md" style={{ fontSize: 22 }}>Har du brug for hjælp?</div>
              <div className="mt-1.5 text-[13.5px] text-[color:var(--ink-low)]">
                Skriv til supportteamet direkte. Eksportér din diagnostik-log fra Dashboard før du sender.
              </div>
            </div>
            <button className="btn btn-secondary" onClick={supportOpen}>Åbn support</button>
          </div>
        </section>

      </div>
    </div>
  );
}
