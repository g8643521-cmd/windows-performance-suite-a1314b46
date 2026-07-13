import { memo } from "react";
import { Search, Bell, RefreshCw } from "lucide-react";

export const TopBar = memo(function TopBar({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
  crumbs?: string[];
}) {
  return (
    <div className="drag-region mat-acrylic flex items-center justify-between gap-8 border-b border-white/[0.06] px-12 py-7">
      <div className="min-w-0">
        <h1
          className="truncate text-[26px] font-semibold leading-[32px] tracking-tight text-white"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}
        >
          {title}
        </h1>
        {subtitle && (
          <div className="mt-1 truncate text-[12.5px] text-[color:var(--ink-low)]">
            {subtitle}
          </div>
        )}
      </div>

      <div className="no-drag flex shrink-0 items-center gap-3">
        <div className="glass-input w-80">
          <Search className="h-[15px] w-[15px] text-[color:var(--ink-low)]" strokeWidth={1.75} />
          <input placeholder="Søg overalt…" />
        </div>
        <button className="btn btn-secondary btn-icon" data-tooltip="Genindlæs" aria-label="Genindlæs">
          <RefreshCw className="h-[16px] w-[16px]" strokeWidth={1.75} />
        </button>
        <button className="btn btn-secondary btn-icon" data-tooltip="Notifikationer" aria-label="Notifikationer">
          <Bell className="h-[16px] w-[16px]" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
});
