import type { ReactNode } from "react";

type Tone = "success" | "warning" | "danger" | "accent" | "neutral";

const toneStyles: Record<Tone, string> = {
  success: "border-[color:var(--success)]/30 bg-[color:var(--success-soft)] text-[color:var(--success)]",
  warning: "border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
  danger:  "border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
  accent:  "border-[color:var(--accent)]/30 bg-[color:var(--accent-soft)] text-[color:var(--accent)]",
  neutral: "border-border bg-card text-fg-muted",
};

export function StatusChip({
  tone = "neutral",
  dot = false,
  children,
  className = "",
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none " +
        toneStyles[tone] +
        " " + className
      }
    >
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-full pulse-dot"
          style={{ background: "currentColor" }}
        />
      )}
      {children}
    </span>
  );
}
