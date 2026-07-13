// M5 · Hardware Center bridge — kun typer + tynd IPC-wrapper.
// Alle data kommer fra Windows via PowerShell/CIM i main-processen.

export type HwCpu = {
  name: string | null;
  manufacturer: string | null;
  cores: number | null;
  threads: number | null;
  baseClockMHz: number | null;
  currentClockMHz: number | null;
  l2CacheKB: number | null;
  l3CacheKB: number | null;
  socket: string | null;
  loadPercent: number | null;
  virtualization: boolean | null;
  slat: boolean | null;
  tempC: number | null;
  count: number;
};

export type HwGpu = {
  name: string | null;
  vendor: string | null;
  vram: number | null;
  driverVersion: string | null;
  driverDate: number | null;
  videoProcessor: string | null;
  currentResolution: string | null;
  currentRefreshRate: number | null;
  status: string | null;
  pnpId: string | null;
};

export type HwMemoryModule = {
  bank: string | null;
  slot: string | null;
  capacity: number | null;
  configuredSpeed: number | null;
  ratedSpeed: number | null;
  manufacturer: string | null;
  partNumber: string | null;
  serial: string | null;
  formFactor: string | null;
  typeLabel: string | null;
};

export type HwMemory = {
  installedBytes: number | null;
  totalBytes: number | null;
  totalKb: number | null;
  freeKb: number | null;
  usedKb: number | null;
  slotsUsed: number;
  slotsTotal: number | null;
  maxCapacityKb: number | null;
  modules: HwMemoryModule[];
};

export type HwPhysicalDisk = {
  name: string | null; mediaType: string | null; busType: string | null;
  size: number | null; serial: string | null; health: string | null;
  manufacturer: string | null; model: string | null; firmware: string | null;
  spindleSpeed: number | null;
};

export type HwDrive = {
  model: string | null; interface: string | null; size: number | null;
  serial: string | null; mediaType: string | null; firmware: string | null;
  status: string | null; partitions: number | null;
};

export type HwVolume = {
  letter: string | null; label: string | null; fileSystem: string | null;
  size: number | null; free: number | null;
};

export type HwAdapter = {
  name: string | null; description: string | null; mac: string | null;
  linkSpeed: string | null; mediaType: string | null; status: string | null;
  ifIndex: number | null; driverVersion: string | null; driverProvider: string | null;
  addresses: string[];
};

export type HwMonitor = {
  name: string | null; manufacturer: string | null; serial: string | null;
  year: number | null; instance: string | null;
};

export type HwBattery =
  | { present: false }
  | {
      present: true;
      name: string | null; chemistry: number | null;
      percent: number | null; status: string | null;
      designCapacity: number | null; fullChargeCapacity: number | null;
      wearPercent: number | null; cycleCount: number | null;
    };

export type HwReport = {
  generatedAt: number;
  hostname: string | null;
  user: string | null;
  cpu: HwCpu | null;
  computer: { manufacturer: string | null; model: string | null; family: string | null; hypervisorPresent: boolean | null } | null;
  bios: { version: string | null; vendor: string | null; releaseDate: number | null; serial: string | null; smbios: string | null } | null;
  board: { manufacturer: string | null; product: string | null; version: string | null; serial: string | null } | null;
  os: {
    caption: string | null; version: string | null; build: string | null; ubr: number | null;
    arch: string | null; edition: string | null; displayVersion: string | null;
    installDate: number | null; lastBoot: number | null; registeredUser: string | null; systemDrive: string | null;
  } | null;
  firmware: "UEFI" | "Legacy" | "unknown";
  secureBoot: "on" | "off" | "unknown";
  tpm: {
    present: boolean; ready: boolean; enabled: boolean; activated: boolean | null;
    manufacturer: string | null; manufacturerVersion: string | null; specVersion: string | null;
  } | null;
  directx: string | null;
  gpuScheduling: "hardware" | "software" | "unknown" | string;
  activation: { status: string | null; description: string | null; channel: string | null } | null;
  memory: HwMemory;
  gpus: HwGpu[];
  storage: { physical: HwPhysicalDisk[]; drives: HwDrive[]; volumes: HwVolume[] };
  network: { adapters: HwAdapter[]; ips: unknown[] };
  monitors: HwMonitor[];
  battery: HwBattery;
  smart: { instance: string | null; predictFailure: boolean; reason: number | null }[];
};

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

type Bridge = {
  hardware2?: {
    scan: (opts?: { force?: boolean }) => Promise<Result<{ data: HwReport; cached?: boolean }>>;
    export: (payload: { format: "json" | "txt"; content: string }) => Promise<Result<{ path?: string; cancelled?: boolean }>>;
  };
};

function bridge(): Bridge["hardware2"] | null {
  const w = window as unknown as { novyx?: Bridge };
  return w.novyx?.hardware2 ?? null;
}

export function isDesktop(): boolean { return bridge() !== null; }

export async function scanHardware2(force = false): Promise<HwReport> {
  const b = bridge();
  if (!b) throw new Error("Kun tilgængelig i desktop-appen.");
  const r = await b.scan({ force });
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

export async function exportReport(format: "json" | "txt", content: string): Promise<{ path?: string; cancelled?: boolean }> {
  const b = bridge();
  if (!b) throw new Error("Kun tilgængelig i desktop-appen.");
  const r = await b.export({ format, content });
  if (!r.ok) throw new Error(r.error);
  return r;
}
