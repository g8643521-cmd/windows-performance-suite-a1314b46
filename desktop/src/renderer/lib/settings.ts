// Lokale, persistente brugerindstillinger.
// Alt der kræver Windows-tjeneste er MARKERET som "afventer" og gemmes IKKE her —
// UI viser toggles som deaktiveret indtil IPC-broen er koblet på.

import { useEffect, useState } from "react";

const STORAGE_KEY = "novyx.settings.v1";

export type Locale = "da" | "en";
export type Accent = "cyan-violet" | "emerald" | "amber" | "rose";

export type LocalSettings = {
  locale: Locale;
  accent: Accent;
  reducedMotion: boolean;
  showTabularNumbers: boolean;
  compactSpacing: boolean;
};

export const DEFAULT_SETTINGS: LocalSettings = {
  locale: "da",
  accent: "cyan-violet",
  reducedMotion: false,
  showTabularNumbers: true,
  compactSpacing: false,
};

function read(): LocalSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<LocalSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function write(s: LocalSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* quota / private mode — silently ignore, det er lokal komfort */
  }
}

let CURRENT: LocalSettings = typeof window !== "undefined" ? read() : DEFAULT_SETTINGS;
const listeners = new Set<(s: LocalSettings) => void>();

export function getSettings(): LocalSettings {
  return CURRENT;
}

export function subscribeSettings(listener: (s: LocalSettings) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setSetting<K extends keyof LocalSettings>(
  key: K,
  value: LocalSettings[K],
) {
  CURRENT = { ...CURRENT, [key]: value };
  write(CURRENT);
  listeners.forEach((l) => l(CURRENT));
}

export function resetSettings() {
  CURRENT = { ...DEFAULT_SETTINGS };
  write(CURRENT);
  listeners.forEach((l) => l(CURRENT));
}

export function exportSettingsJson(): string {
  return JSON.stringify(
    {
      app: "NOVYX",
      exported: new Date().toISOString(),
      settings: CURRENT,
    },
    null,
    2,
  );
}

export type ImportResult =
  | { ok: true; imported: LocalSettings }
  | { ok: false; error: string };

export function importSettingsJson(raw: string): ImportResult {
  try {
    const parsed = JSON.parse(raw) as {
      settings?: Partial<LocalSettings>;
    };
    if (!parsed.settings || typeof parsed.settings !== "object") {
      return { ok: false, error: "Manglende 'settings'-blok i JSON" };
    }
    const merged: LocalSettings = { ...DEFAULT_SETTINGS, ...parsed.settings };
    CURRENT = merged;
    write(CURRENT);
    listeners.forEach((l) => l(CURRENT));
    return { ok: true, imported: merged };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Ugyldig JSON",
    };
  }
}

export function useSettings(): LocalSettings {
  const [s, setS] = useState<LocalSettings>(CURRENT);
  useEffect(() => {
    const l = (next: LocalSettings) => setS(next);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return s;
}
