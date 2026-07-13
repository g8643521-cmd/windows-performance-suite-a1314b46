import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg" | "xl";

const sizeClass: Record<Size, string> = {
  sm: "max-w-3xl",
  md: "max-w-5xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
};

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: Size;
}

/**
 * Ens vandret indramning på tværs af hele sitet.
 * Brug altid Container fremfor at gentage `mx-auto max-w-... px-6`.
 */
export function Container({ size = "lg", className, ...props }: ContainerProps) {
  return (
    <div
      className={cn("mx-auto w-full px-6", sizeClass[size], className)}
      {...props}
    />
  );
}
