// Kun rigtige data — hentes fra browser/Electron renderer APIs.
// Værdier der kræver IPC til main-process eller Windows-services returnerer null.
// UI skal vise "Ikke tilgængelig" for null.

import { useEffect, useState } from "react";

export type Metric<T> = { value: T | null; source: string };

export function useOnline(): boolean {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

export function useUptimeMs(): number {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(performance.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}t ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function useBattery(): {
  supported: boolean;
  level: number | null;
  charging: boolean | null;
} {
  const [state, setState] = useState<{
    supported: boolean;
    level: number | null;
    charging: boolean | null;
  }>({ supported: false, level: null, charging: null });

  useEffect(() => {
    const nav = navigator as unknown as {
      getBattery?: () => Promise<{
        level: number;
        charging: boolean;
        addEventListener: (e: string, cb: () => void) => void;
        removeEventListener: (e: string, cb: () => void) => void;
      }>;
    };
    if (!nav.getBattery) return;
    let battery: Awaited<ReturnType<NonNullable<typeof nav.getBattery>>> | null =
      null;
    const update = () => {
      if (!battery) return;
      setState({
        supported: true,
        level: battery.level,
        charging: battery.charging,
      });
    };
    nav.getBattery().then((b) => {
      battery = b;
      update();
      b.addEventListener("levelchange", update);
      b.addEventListener("chargingchange", update);
    });
    return () => {
      if (!battery) return;
      battery.removeEventListener("levelchange", update);
      battery.removeEventListener("chargingchange", update);
    };
  }, []);

  return state;
}

export function getLogicalCores(): number | null {
  return typeof navigator !== "undefined" && navigator.hardwareConcurrency
    ? navigator.hardwareConcurrency
    : null;
}

export function getDeviceMemoryGb(): number | null {
  const n = navigator as unknown as { deviceMemory?: number };
  return typeof n.deviceMemory === "number" ? n.deviceMemory : null;
}

export function getPlatform(): string | null {
  // navigator.userAgentData er mere pålidelig end platform-strengen
  const uaData = (navigator as unknown as {
    userAgentData?: { platform?: string };
  }).userAgentData;
  if (uaData?.platform) return uaData.platform;
  if (navigator.platform) return navigator.platform;
  return null;
}

export function useConnection(): {
  supported: boolean;
  effectiveType: string | null;
  downlinkMbps: number | null;
  rttMs: number | null;
} {
  const [state, setState] = useState({
    supported: false,
    effectiveType: null as string | null,
    downlinkMbps: null as number | null,
    rttMs: null as number | null,
  });

  useEffect(() => {
    const conn = (navigator as unknown as {
      connection?: {
        effectiveType?: string;
        downlink?: number;
        rtt?: number;
        addEventListener?: (e: string, cb: () => void) => void;
        removeEventListener?: (e: string, cb: () => void) => void;
      };
    }).connection;
    if (!conn) return;
    const update = () =>
      setState({
        supported: true,
        effectiveType: conn.effectiveType ?? null,
        downlinkMbps: conn.downlink ?? null,
        rttMs: conn.rtt ?? null,
      });
    update();
    conn.addEventListener?.("change", update);
    return () => conn.removeEventListener?.("change", update);
  }, []);

  return state;
}

export function useHeapMb(): number | null {
  const [mb, setMb] = useState<number | null>(null);
  useEffect(() => {
    const perf = performance as unknown as {
      memory?: { usedJSHeapSize: number };
    };
    if (!perf.memory) return;
    const tick = () =>
      setMb(Math.round((perf.memory!.usedJSHeapSize / 1024 / 1024) * 10) / 10);
    tick();
    const id = window.setInterval(tick, 2000);
    return () => window.clearInterval(id);
  }, []);
  return mb;
}
