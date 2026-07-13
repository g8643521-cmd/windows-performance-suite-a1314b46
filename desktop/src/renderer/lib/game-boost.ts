// M4 · Game Boost Center — bridge til Electron main process.
// Rigtige Windows-tweaks, backup/restore, per-spil profiler.

export type BoostGame = {
  id: string;
  platform: "steam" | "epic" | "ubisoft" | "gog";
  name: string;
  appId?: string;
  sizeBytes?: number | null;
  coverUrl?: string | null;
  library?: string | null;
  installDir?: string | null;
  exePath?: string | null;
};

export type LauncherInfo = {
  id: string;
  name: string;
  installed: boolean;
  path?: string | null;
  count?: number | null;
};

export type BoostAnalyze = {
  gameMode: number | null;
  gameBarPanel: number | null;
  hags: number | null;
  mmcssResp: number | null;
  gamesGpuPri: number | null;
  gamesPri: number | null;
  fseBehavior: number | null;
  activePlanGuid: string | null;
  activePlanName: string | null;
  schemes: Array<{ guid: string; name: string }>;
  nagleDisabled: number;
  nagleTotal: number;
};

export type BoostTweak = {
  id: string;
  tier: "safe" | "advanced";
  label: string;
  reason: string;
  admin: boolean;
  needsReboot: boolean;
  kind: "reg" | "reg-multi" | "power" | "nagle";
};

export type BoostBackup = {
  id: string;
  ts: number;
  appliedIds: string[];
  needsReboot: boolean;
};

type Bridge = {
  boost2: {
    launchers:    () => Promise<{ ok: true; data: LauncherInfo[] } | { ok: false; error: string }>;
    scanGames:    () => Promise<{ ok: true; data: BoostGame[] } | { ok: false; error: string }>;
    analyze:      () => Promise<{ ok: true; data: BoostAnalyze } | { ok: false; error: string }>;
    tweaks:       () => Promise<{ ok: true; tweaks: BoostTweak[] }>;
    apply:        (ids: string[]) => Promise<
      { ok: true; backupId: string; applied: string[]; needsReboot: boolean }
      | { ok: false; error: string; needsElevation?: boolean }
    >;
    backups:      () => Promise<{ ok: true; data: BoostBackup[] }>;
    restore:      (id: string) => Promise<
      { ok: true; restored: string[] } | { ok: false; error: string; needsElevation?: boolean }
    >;
    gameProfile:  (payload: { gameId: string; exePath?: string | null; action: "apply" | "restore" | "status" }) => Promise<
      { ok: true; active?: boolean; applied?: unknown; restored?: boolean } | { ok: false; error: string }
    >;
    gameProfiles: () => Promise<{ ok: true; data: Record<string, { exePath: string; ts: number }> }>;
  };
};

function b() {
  const w = window as unknown as { novyx?: Bridge };
  return w.novyx?.boost2 ?? null;
}

export const boostAvailable = () => b() !== null;

async function unwrap<T>(p: Promise<{ ok: true } & T | { ok: false; error: string; needsElevation?: boolean }>): Promise<T> {
  const r = await p;
  if (!r.ok) {
    const err: Error & { needsElevation?: boolean } = new Error(r.error);
    if ("needsElevation" in r && r.needsElevation) err.needsElevation = true;
    throw err;
  }
  const { ok: _ok, ...rest } = r;
  return rest as T;
}

export async function listLaunchers() { const x = b(); if (!x) return []; const r = await x.launchers(); return r.ok ? r.data : []; }
export async function scanBoostGames() { const x = b(); if (!x) return []; const r = await x.scanGames(); return r.ok ? r.data : []; }
export async function analyzeBoost() { const x = b(); if (!x) throw new Error("Kun i desktop-appen"); return (await unwrap(x.analyze())).data as BoostAnalyze; }
export async function listBoostTweaks() { const x = b(); if (!x) return []; const r = await x.tweaks(); return r.tweaks; }
export async function applyBoost(ids: string[]) { const x = b(); if (!x) throw new Error("Kun i desktop-appen"); return await unwrap(x.apply(ids)); }
export async function listBoostBackups() { const x = b(); if (!x) return []; const r = await x.backups(); return r.data; }
export async function restoreBoost(id: string) { const x = b(); if (!x) throw new Error("Kun i desktop-appen"); return await unwrap(x.restore(id)); }
export async function applyGameProfile(gameId: string, exePath: string) {
  const x = b(); if (!x) throw new Error("Kun i desktop-appen");
  return await unwrap(x.gameProfile({ gameId, exePath, action: "apply" }));
}
export async function restoreGameProfile(gameId: string, exePath: string) {
  const x = b(); if (!x) throw new Error("Kun i desktop-appen");
  return await unwrap(x.gameProfile({ gameId, exePath, action: "restore" }));
}
export async function listGameProfiles() {
  const x = b(); if (!x) return {};
  const r = await x.gameProfiles();
  return r.data;
}
