import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "muted";

const toneClass: Record<Tone, string> = {
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  danger: "bg-red-500",
  info: "bg-sky-400",
  muted: "bg-muted-foreground/60",
};

interface StatusDotProps {
  tone?: Tone;
  pulse?: boolean;
  className?: string;
  label?: string;
}

/**
 * Lille farvet prik der signalerer status. Brug label-prop for a11y hvis
 * prikken er den eneste informationsbærer.
 */
export function StatusDot({ tone = "info", pulse, className, label }: StatusDotProps) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-label={label}
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        toneClass[tone],
        pulse && "animate-glow-pulse",
        className,
      )}
    />
  );
}
