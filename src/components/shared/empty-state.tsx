import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Ens tomt-state visning: ikon, titel, beskrivelse og valgfri handling.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center rounded-lg border border-border/60 bg-card/40 py-14 px-6",
        className,
      )}
    >
      {Icon && (
        <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-secondary/60 text-muted-foreground">
          <Icon className="h-6 w-6" />
        </span>
      )}
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-muted-foreground max-w-md">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
