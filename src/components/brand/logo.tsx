import type { SVGProps } from "react";

/**
 * NOVYX mark — the "N" is cut open by an accent slash that runs diagonally
 * through the mark. Reads as a single distinct glyph at 16px and up.
 */
export function NovyxMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id="novyx-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2E7BFF" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="39" height="39" rx="9" fill="#0F1117" stroke="#2B3445" />
      {/* left vertical */}
      <rect x="9" y="9" width="4" height="22" rx="1" fill="url(#novyx-mark)" />
      {/* right vertical */}
      <rect x="27" y="9" width="4" height="22" rx="1" fill="url(#novyx-mark)" />
      {/* diagonal */}
      <path
        d="M13 9 L31 31"
        stroke="url(#novyx-mark)"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function NovyxWordmark({ className }: { className?: string }) {
  return (
    <span
      className={
        "font-display font-semibold tracking-[0.14em] text-fg " + (className ?? "")
      }
    >
      NOVYX
    </span>
  );
}
