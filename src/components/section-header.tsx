import type { ReactNode } from "react";

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  align?: "left" | "center";
}) {
  const isCenter = align === "center";
  return (
    <div
      className={
        "flex flex-wrap items-end gap-6 " +
        (isCenter ? "justify-center text-center flex-col" : "justify-between")
      }
    >
      <div className={isCenter ? "max-w-2xl" : "min-w-0"}>
        {eyebrow && (
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-accent">
            {eyebrow}
          </div>
        )}
        <h2 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-fg">
          {title}
        </h2>
        {description && (
          <p className={"mt-3 text-sm md:text-base text-fg-muted " + (isCenter ? "mx-auto" : "max-w-xl")}>
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
