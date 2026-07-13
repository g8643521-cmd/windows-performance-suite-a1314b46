// Bridge til Electron main-process. Al hardware- og system-data hentes lokalt
// via IPC. Ingen mock, ingen fallback — mangler noget, returneres null.

export type HardwareReport = {
  generatedAt: number;
  cpu: {
    manufacturer?: string; brand?: string;
    cores?: number; physicalCores?: number;
    speed?: number; speedMax?: number;
    load: number | null;
  } | null;
  memory: {
    total: number; used: number; free: number;
    modules: { size: number; type?: string; clockSpeed?: number; manufacturer?: string }[];
  } | null;
  gpus: {
    model?: string; vendor?: string; vram?: number; driverVersion?: string;
    utilization: number | null; temp: number | null;
  }[];
  displays: {
    model?: string; main?: boolean;
    resolutionX: number | null; resolutionY: number | null; refreshRate: number | null;
  }[];
  storage: {
    drives: { name?: string; type?: string; vendor?: string; size?: number; interfaceType?: string; smartStatus?: string }[];
    filesystems: { fs: string; mount: string; type: string; size: number; used: number }[];
  };
  os: { platform?: string; distro?: string; release?: string; arch?: string; hostname?: string } | null;
  network: {
    iface?: string; ifaceName?: string; type?: string; speed?: number | null;
    ip4?: string; operstate?: string; rxSec: number | null; txSec: number | null;
  } | null;
  battery:
    | { hasBattery: false }
    | { hasBattery: true; percent?: number; isCharging?: boolean; designedCapacity?: number; maxCapacity?: number; cycleCount?: number };
  sensors: { cpuMain: number | null; cpuMax: number | null; cores: number[] } | null;
};

export type LiveSnapshot = {
  ts: number;
  cpuLoad: number | null;
  memUsed: number | null;
  memTotal: number | null;
  rxSec: number | null;
  txSec: number | null;
  cpuTemp: number | null;
  uptimeSec: number;
};

export type DetectedGame = {
  id: string;
  platform: "steam" | "epic";
  name: string;
  appId: string;
  sizeBytes: number | null;
  coverUrl: string | null;
  library: string;
};

export type RepairTool = { id: string; label: string; admin: boolean };

export type ProcessInfo = { pid: number; name: string; cpu: number; memBytes: number };
export type ProcessesReport = { total: number; running: number | null; list: ProcessInfo[] };
export type TempFolderInfo = { path: string; bytes: number; files: number };
export type CleanTempResult = { path: string; freed: number; removed: number; skipped: number };
export type HealthCheck = { id: string; label: string; level: "ok" | "notice" | "warn"; detail: string };
export type HealthReport = { ts: number; os: string | null; checks: HealthCheck[] };
export type TweakItem = { id: string; label: string; detail: string; target: string };
export type InstalledApp = {
  name: string; version: string | null; publisher: string | null;
  installDate: string | null; sizeKb: number | null; location: string | null;
};

export type SysInfo = {
  admin: boolean;
  bios: { version: string | null; vendor: string | null; releaseDate: number | null; serial: string | null } | null;
  system: { manufacturer: string | null; model: string | null; family: string | null } | null;
  board: { manufacturer: string | null; product: string | null; version: string | null } | null;
  os: {
    caption: string | null; version: string | null; build: string | null; arch: string | null;
    installDate: number | null; lastBoot: number | null; registeredUser: string | null;
  } | null;
  secureBoot: "on" | "off" | "unknown";
  tpm: { present: boolean; ready: boolean; enabled: boolean; manufacturer: string | null; version: string | null } | null;
  defender: {
    antivirusEnabled: boolean; realtimeEnabled: boolean; engineVersion: string | null;
    lastQuickScan: number | null; lastFullScan: number | null;
  } | null;
};

export type PingResult = {
  target: string; count: number; sent: number;
  avg: number | null; min: number | null; max: number | null; jitter: number | null; loss: number;
};

export type PersistedState = {
  lastScan?: { ts: number; issues: number | null; score: number | null };
  lastOptimize?: { ts: number; label: string; detail: string | null };
};

type Result<T> = { ok: true } & T | { ok: false; error: string };

type NovyxBridge = {
  hardware: { scan: () => Promise<Result<{ data: HardwareReport }>> };
  system: { live: () => Promise<Result<{ data: LiveSnapshot }>> };
  optimize: {
    processes:  () => Promise<Result<{ data: ProcessesReport }>>;
    tempInfo:   () => Promise<Result<{ data: TempFolderInfo[] }>>;
    cleanTemp:  () => Promise<Result<{ data: CleanTempResult }>>;
    healthScan: () => Promise<Result<{ data: HealthReport }>>;
  };
  tweaks: { list: () => Promise<TweakItem[]> };
  apps:   { list: () => Promise<Result<{ data: InstalledApp[] }>> };
  games: {
    scan: () => Promise<Result<{ data: DetectedGame[] }>>;
    launch: (id: string) => Promise<Result<Record<string, never>>>;
  };
  repair: {
    list: () => Promise<RepairTool[]>;
    run: (toolId: string) => Promise<Result<{ launched?: boolean; label?: string; postNote?: string | null }>>;
  };
  app: {
    version: () => Promise<Result<{ version: string }>>;
    openExternal: (url: string) => Promise<Result<Record<string, never>>>;
    openLogsFolder: () => Promise<Result<{ path?: string }>>;
    getAutoStart: () => Promise<Result<{ enabled: boolean }>>;
    setAutoStart: (enabled: boolean) => Promise<Result<Record<string, never>>>;
    isElevated: () => Promise<Result<{ elevated: boolean }>>;
    relaunchAsAdmin: () => Promise<Result<Record<string, never>>>;
  };
  sys: {
    info: (opts?: { force?: boolean }) => Promise<Result<{ data: SysInfo; cached?: boolean }>>;
    ping: (opts?: { target?: string; count?: number }) => Promise<Result<{ data: PingResult }>>;
  };
  state: {
    read: () => Promise<Result<{ data: PersistedState }>>;
    setLastScan: (payload: { issues?: number | null; score?: number | null }) => Promise<Result<{ data: PersistedState }>>;
    setLastOptimize: (payload: { label?: string; detail?: string | null }) => Promise<Result<{ data: PersistedState }>>;
  };
  diagnostics: { export: () => Promise<Result<{ path?: string }>> };
};


export function getBridge(): NovyxBridge | null {
  const w = window as unknown as { novyx?: NovyxBridge };
  return w.novyx ?? null;
}

export function isDesktop(): boolean {
  return getBridge() !== null;
}

async function unwrap<T>(p: Promise<Result<T>>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(r.error);
  return r as T;
}

export async function scanHardware(): Promise<HardwareReport> {
  const b = getBridge(); if (!b) throw new Error("Ikke tilgængelig uden desktop-appen.");
  const r = await unwrap(b.hardware.scan());
  return (r as { data: HardwareReport }).data;
}

export async function fetchLive(): Promise<LiveSnapshot> {
  const b = getBridge(); if (!b) throw new Error("Kun i desktop-appen.");
  const r = await unwrap(b.system.live());
  return (r as { data: LiveSnapshot }).data;
}

export async function scanGames(): Promise<DetectedGame[]> {
  const b = getBridge(); if (!b) throw new Error("Kun i desktop-appen.");
  const r = await unwrap(b.games.scan());
  return (r as { data: DetectedGame[] }).data;
}

export async function launchGame(id: string): Promise<void> {
  const b = getBridge(); if (!b) throw new Error("Kun i desktop-appen.");
  await unwrap(b.games.launch(id));
}

export async function listRepairTools(): Promise<RepairTool[]> {
  const b = getBridge(); if (!b) return [];
  return b.repair.list();
}

export async function runRepair(id: string): Promise<{ launched?: boolean; label?: string; postNote?: string | null }> {
  const b = getBridge(); if (!b) throw new Error("Kun i desktop-appen.");
  return unwrap(b.repair.run(id));
}

export async function openExternal(url: string): Promise<void> {
  const b = getBridge();
  if (!b) { window.open(url, "_blank", "noopener"); return; }
  await unwrap(b.app.openExternal(url));
}

export async function openLogsFolder(): Promise<string | undefined> {
  const b = getBridge(); if (!b) throw new Error("Kun i desktop-appen.");
  const r = await unwrap(b.app.openLogsFolder());
  return (r as { path?: string }).path;
}

export async function getAutoStart(): Promise<boolean> {
  const b = getBridge(); if (!b) return false;
  const r = await unwrap(b.app.getAutoStart());
  return (r as { enabled: boolean }).enabled;
}

export async function setAutoStart(enabled: boolean): Promise<void> {
  const b = getBridge(); if (!b) throw new Error("Kun i desktop-appen.");
  await unwrap(b.app.setAutoStart(enabled));
}

export async function exportDiagnostics(): Promise<string | undefined> {
  const b = getBridge(); if (!b) throw new Error("Kun i desktop-appen.");
  const r = await unwrap(b.diagnostics.export());
  return (r as { path?: string }).path;
}

export async function fetchProcesses(): Promise<ProcessesReport> {
  const b = getBridge(); if (!b) throw new Error("Kun i desktop-appen.");
  const r = await unwrap(b.optimize.processes());
  return (r as { data: ProcessesReport }).data;
}
export async function fetchTempInfo(): Promise<TempFolderInfo[]> {
  const b = getBridge(); if (!b) throw new Error("Kun i desktop-appen.");
  const r = await unwrap(b.optimize.tempInfo());
  return (r as { data: TempFolderInfo[] }).data;
}
export async function cleanTemp(): Promise<CleanTempResult> {
  const b = getBridge(); if (!b) throw new Error("Kun i desktop-appen.");
  const r = await unwrap(b.optimize.cleanTemp());
  return (r as { data: CleanTempResult }).data;
}
export async function runHealthScan(): Promise<HealthReport> {
  const b = getBridge(); if (!b) throw new Error("Kun i desktop-appen.");
  const r = await unwrap(b.optimize.healthScan());
  return (r as { data: HealthReport }).data;
}
export async function listTweaks(): Promise<TweakItem[]> {
  const b = getBridge(); if (!b) return [];
  return b.tweaks.list();
}
export async function listInstalledApps(): Promise<InstalledApp[]> {
  const b = getBridge(); if (!b) throw new Error("Kun i desktop-appen.");
  const r = await unwrap(b.apps.list());
  return (r as { data: InstalledApp[] }).data;
}

// ─────────── M1: Windows system info, ping, persisted state ───────────
export async function fetchSysInfo(force = false): Promise<SysInfo> {
  const b = getBridge(); if (!b) throw new Error("Kun i desktop-appen.");
  const r = await unwrap(b.sys.info({ force }));
  return (r as { data: SysInfo }).data;
}

export async function fetchPing(target = "1.1.1.1", count = 5): Promise<PingResult> {
  const b = getBridge(); if (!b) throw new Error("Kun i desktop-appen.");
  const r = await unwrap(b.sys.ping({ target, count }));
  return (r as { data: PingResult }).data;
}

export async function isElevated(): Promise<boolean> {
  const b = getBridge(); if (!b) return false;
  const r = await unwrap(b.app.isElevated());
  return (r as { elevated: boolean }).elevated;
}

export async function relaunchAsAdmin(): Promise<void> {
  const b = getBridge(); if (!b) throw new Error("Kun i desktop-appen.");
  await unwrap(b.app.relaunchAsAdmin());
}

export async function readPersistedState(): Promise<PersistedState> {
  const b = getBridge(); if (!b) return {};
  const r = await unwrap(b.state.read());
  return (r as { data: PersistedState }).data;
}

export async function markLastScan(payload: { issues?: number | null; score?: number | null }): Promise<PersistedState> {
  const b = getBridge(); if (!b) return {};
  const r = await unwrap(b.state.setLastScan(payload));
  return (r as { data: PersistedState }).data;
}

export async function markLastOptimize(payload: { label?: string; detail?: string | null }): Promise<PersistedState> {
  const b = getBridge(); if (!b) return {};
  const r = await unwrap(b.state.setLastOptimize(payload));
  return (r as { data: PersistedState }).data;
}


// ─────────── formatters ───────────
export function formatBytes(n: number | null | undefined, decimals = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / Math.pow(1024, i);
  return `${v.toFixed(i >= 3 ? decimals : 0)} ${units[i]}`;
}

export function formatMHz(mhz: number | null | undefined): string {
  if (mhz == null) return "—";
  if (mhz >= 1000) return `${(mhz / 1000).toFixed(2)} GHz`;
  return `${Math.round(mhz)} MHz`;
}

export function formatGHz(ghz: number | null | undefined): string {
  if (ghz == null) return "—";
  return `${ghz.toFixed(2)} GHz`;
}

export function formatPercent(v: number | null | undefined, decimals = 0): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(decimals)}%`;
}

export function formatTemp(c: number | null | undefined): string {
  if (c == null || !Number.isFinite(c) || c <= 0) return "—";
  return `${Math.round(c)} °C`;
}

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}t`;
  if (h > 0) return `${h}t ${m}m`;
  return `${m}m`;
}
