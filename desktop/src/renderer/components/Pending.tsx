import type { ReactNode } from "react";

/** Ensartet placeholder for alle værdier som kræver backend/systemtjeneste. */
export function PendingValue({ label = "Ikke tilgængelig endnu" }: { label?: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span
        className="text-[36px] font-light leading-none text-[color:var(--ink-faint)]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        —
      </span>
      <span className="pending-label">{label}</span>
    </div>
  );
}

export function PendingChip({ label = "Afventer backend" }: { label?: string }) {
  return (
    <span className="chip chip-pending">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[color:var(--ink-faint)]" />
      {label}
    </span>
  );
}

/** Canonical KPI/spec card — same radius, padding, min-height everywhere. */
export function GlassCard({
  icon,
  title,
  subtitle,
  children,
  className = "",
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`glass-card card-lift flex flex-col gap-6 ${className}`}
      style={{ padding: "var(--card-pad)", minHeight: 188 }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div
            className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-low)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {title}
          </div>
          {subtitle && (
            <div className="mt-1.5 text-[12px] text-[color:var(--ink-faint)]">{subtitle}</div>
          )}
        </div>
        {icon && (
          <div
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[color:var(--ink-hi)]"
            style={{
              background: "var(--grad-primary-soft)",
              border: "1px solid rgba(59,130,246,0.24)",
              boxShadow: "0 8px 20px rgba(59,130,246,0.18), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            {icon}
          </div>

        )}
      </div>
      <div className="flex min-h-[64px] items-end">{children ?? <PendingValue />}</div>
    </div>
  );
}

/** Reusable switch (visual only — no backend). */
export function Switch({ on = false, disabled = false }: { on?: boolean; disabled?: boolean }) {
  return (
    <span
      className={`switch ${on ? "switch--on" : ""} ${disabled ? "switch--disabled" : ""}`}
      aria-hidden
    >
      <span className="switch__thumb" />
    </span>
  );
}

/** Reusable empty state. */
export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">{icon}</div>
      <div className="empty-state__title" style={{ fontFamily: "var(--font-display)" }}>
        {title}
      </div>
      <div className="empty-state__text">{text}</div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
