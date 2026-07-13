import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Spacing = "sm" | "md" | "lg";

const spacingClass: Record<Spacing, string> = {
  sm: "py-10 md:py-14",
  md: "py-16 md:py-20",
  lg: "py-20 md:py-28",
};

interface SectionProps extends HTMLAttributes<HTMLElement> {
  spacing?: Spacing;
}

/**
 * Semantisk `<section>` med ens lodret spacing.
 * Kombinér med <Container> for vandret indramning.
 */
export function Section({ spacing = "md", className, ...props }: SectionProps) {
  return (
    <section
      className={cn(spacingClass[spacing], className)}
      {...props}
    />
  );
}
