import { useState } from "react";
import { AlertTriangle, Copy, Check } from "lucide-react";

export function ErrorBanner({ message, className = "" }: { message: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // fallback: create hidden textarea
      const ta = document.createElement("textarea");
      ta.value = message;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* noop */ }
      ta.remove();
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-200 ${className}`}
    >
      <AlertTriangle className="mt-[2px] h-4 w-4 shrink-0" strokeWidth={2} />
      <div className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-[12.5px] leading-[1.55] select-text">
        {message}
      </div>
      <button
        onClick={copy}
        className="no-drag inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[11.5px] font-medium text-amber-100 transition hover:bg-amber-500/20"
        title="Kopiér fejl"
        aria-label="Kopiér fejlbesked"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" strokeWidth={2.25} /> Kopieret
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" strokeWidth={2} /> Kopiér
          </>
        )}
      </button>
    </div>
  );
}
