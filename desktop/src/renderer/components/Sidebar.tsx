import { memo } from "react";
import {
  Zap, Radar, Cpu, Sliders, Gamepad2, Gauge, Wrench, Package,
  FlaskConical, Settings2, UserRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../lib/cn";

type NavItem = { id: string; label: string; icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    label: "Optimize",
    items: [
      { id: "boost", label: "Boost", icon: Zap },
      { id: "scan",  label: "Scan",  icon: Radar },
    ],
  },
  {
    label: "Your PC",
    items: [
      { id: "specs",  label: "Specs",  icon: Cpu },
      { id: "tweaks", label: "Tweaks", icon: Sliders },
    ],
  },
  {
    label: "Games",
    items: [
      { id: "arcade",    label: "Arcade",    icon: Gamepad2 },
      { id: "benchmark", label: "Benchmark", icon: Gauge },
    ],
  },
  {
    label: "Maintenance",
    items: [
      { id: "repairs", label: "Repairs", icon: Wrench },
      { id: "install", label: "Install", icon: Package },
      { id: "lab",     label: "Lab",     icon: FlaskConical },
    ],
  },
  {
    label: "System",
    items: [{ id: "settings", label: "Settings", icon: Settings2 }],
  },
];

function Group({
  label, items, active, onNavigate,
}: {
  label: string; items: NavItem[]; active: string; onNavigate?: (id: string) => void;
}) {
  return (
    <div className="mt-7 first:mt-4">
      <div className="px-7 pb-3 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-[color:var(--ink-faint)]">
        {label}
      </div>
      <div className="space-y-1 px-4">
        {items.map((it) => {
          const isActive = it.id === active;
          const Icon = it.icon;
          return (
            <button
              key={it.id}
              onClick={() => onNavigate?.(it.id)}
              className={cn(
                "no-drag group nav-item relative flex w-full items-center gap-4 rounded-2xl px-4 py-2.5 text-[14px] leading-5",
                isActive ? "nav-item--active text-white" : "text-[color:var(--ink-mid)] hover:text-white",
              )}
            >
              {isActive && <span aria-hidden className="nav-active-bar" />}
              <Icon
                className={cn(
                  "h-[19px] w-[19px] shrink-0 relative z-[1]",
                  isActive ? "text-white" : "text-[color:var(--ink-low)] group-hover:text-white",
                )}
                strokeWidth={1.75}
              />
              <span className="flex-1 text-left font-medium tracking-[-0.005em] relative z-[1]">{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const Sidebar = memo(function Sidebar({
  active = "boost",
  onNavigate,
}: {
  active?: string;
  onNavigate?: (id: string) => void;
}) {
  return (
    <aside className="drag-region relative flex h-full flex-col mat-satin">
      <span aria-hidden className="lightline lightline--top" />

      <div className="flex items-center gap-4 px-7 pb-8 pt-10">
        <div
          className="relative grid h-[54px] w-[54px] place-items-center rounded-[18px] text-[20px] font-bold text-white overflow-hidden"
          style={{
            background: "var(--grad-primary)",
            boxShadow:
              "0 14px 40px rgba(59,130,246,0.55), 0 0 24px rgba(34,211,238,0.30), inset 0 1px 0 rgba(255,255,255,0.35)",
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.02em",
          }}
        >
          <span className="relative z-[1]">N</span>
          <span
            aria-hidden
            className="absolute inset-0"
            style={{ background: "radial-gradient(120% 60% at 50% 0%, rgba(255,255,255,0.35), transparent 60%)" }}
          />
        </div>
        <div className="leading-tight">
          <div
            className="text-[20px] font-semibold tracking-tight text-white"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.025em" }}
          >
            NOVYX
          </div>
          <div className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.20em] text-[color:var(--ink-faint)]">
            v0.15.0-a · Preview
          </div>
        </div>
      </div>

      <nav className="no-drag flex-1 overflow-y-auto pb-4">
        {GROUPS.map((g) => (
          <Group key={g.label} label={g.label} items={g.items} active={active} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="no-drag m-4 flex items-center gap-3 rounded-2xl px-4 py-3 mat-matte">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[color:var(--ink-mid)]"
          style={{ background: "rgba(59,130,246,0.10)", border: "1px solid rgba(59,130,246,0.20)" }}
        >
          <UserRound className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13px] font-semibold text-white">Lokal session</div>
          <div className="truncate text-[11px] text-[color:var(--ink-faint)]">
            Konto ikke tilknyttet
          </div>
        </div>
      </div>
    </aside>
  );
});
