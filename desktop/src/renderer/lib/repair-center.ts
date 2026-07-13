// M3 · Repair Center — bridge til Electron main-process.
// Rigtige Windows-reparations-kommandoer med live-log streaming.

export type RepairAction = {
  id: string;
  label: string;
  description: string;
  admin: boolean;
  cancelable: boolean;
  restoreOffered: boolean;
  needsReboot: boolean;
};

export type RepairLogLevel = "info" | "out" | "err" | "warn";

export type RepairEvent =
  | { jobId: string; kind: "started"; ts: number; actionId: string; label: string; admin: boolean; needsReboot: boolean }
  | { jobId: string; kind: "log"; ts: number; level: RepairLogLevel; line: string }
  | { jobId: string; kind: "done"; ts: number; code: number; needsReboot?: boolean; cancelled?: boolean; error?: string | null };

type Bridge = {
  repair2: {
    list: () => Promise<{ ok: true; actions: RepairAction[] } | { ok: false; error: string }>;
    elevated: () => Promise<{ ok: true; elevated: boolean } | { ok: false; error: string }>;
    run: (payload: { actionId: string; createRestorePoint?: boolean }) => Promise<
      { ok: true; jobId: string } | { ok: false; error: string; needsElevation?: boolean }
    >;
    cancel: (jobId: string) => Promise<{ ok: boolean; error?: string }>;
    onEvent: (cb: (evt: RepairEvent) => void) => () => void;
  };
};

function bridge(): Bridge["repair2"] | null {
  const w = window as unknown as { novyx?: Bridge };
  return w.novyx?.repair2 ?? null;
}

export function repairAvailable(): boolean {
  return bridge() !== null;
}

export async function listRepairActions(): Promise<RepairAction[]> {
  const b = bridge();
  if (!b) return [];
  const r = await b.list();
  if (!r.ok) throw new Error(r.error);
  return r.actions;
}

export async function isRepairElevated(): Promise<boolean> {
  const b = bridge();
  if (!b) return false;
  const r = await b.elevated();
  return r.ok ? r.elevated : false;
}

export async function startRepair(
  actionId: string,
  opts: { createRestorePoint?: boolean } = {},
): Promise<{ jobId: string }> {
  const b = bridge();
  if (!b) throw new Error("Kun tilgængelig i desktop-appen.");
  const r = await b.run({ actionId, createRestorePoint: !!opts.createRestorePoint });
  if (!r.ok) {
    const err: Error & { needsElevation?: boolean } = new Error(r.error);
    if (r.needsElevation) err.needsElevation = true;
    throw err;
  }
  return { jobId: r.jobId };
}

export async function cancelRepair(jobId: string): Promise<void> {
  const b = bridge();
  if (!b) return;
  await b.cancel(jobId);
}

export function subscribeRepair(cb: (evt: RepairEvent) => void): () => void {
  const b = bridge();
  if (!b) return () => {};
  return b.onEvent(cb);
}
