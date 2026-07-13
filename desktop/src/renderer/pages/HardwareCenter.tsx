import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Cpu, MonitorSmartphone, HardDrive, MemoryStick, Wifi, Battery, Shield,
  RefreshCw, Copy, Check, Search, FileJson, FileText, AlertTriangle, Info,
  Monitor, Server,
} from "lucide-react";
import { scanHardware2, exportReport, isDesktop, type HwReport } from "../lib/hardware2";
import { formatBytes } from "../lib/hardware";
import { cn } from "../lib/cn";

type Status = "ok" | "warn" | "err" | "info";

function statusColor(s: Status) {
  return s === "ok" ? "text-emerald-400" :
         s === "warn" ? "text-amber-400" :
         s === "err" ? "text-rose-400" : "text-sky-400";
}
function statusDotBg(s: Status) {
  return s === "ok" ? "bg-emerald-400" :
         s === "warn" ? "bg-amber-400" :
         s === "err" ? "bg-rose-400" : "bg-sky-400";
}

function StatusPill({ label, tone }: { label: string; tone: Status }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
      tone === "ok" && "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/25",
      tone === "warn" && "bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/25",
      tone === "err" && "bg-rose-400/10 text-rose-300 ring-1 ring-rose-400/25",
      tone === "info" && "bg-sky-400/10 text-sky-300 ring-1 ring-sky-400/25",
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full", statusDotBg(tone))} />
      {label}
    </span>
  );
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-[12px] text-[color:var(--ink-faint)]">{label}</span>
      <span className={cn("text-[13px] text-right text-[color:var(--ink-mid)] truncate max-w-[65%]", mono && "font-mono")}>
        {value == null || value === "" ? <span className="text-[color:var(--ink-faint)]">—</span> : value}
      </span>
    </div>
  );
}

function Card({
  icon: Icon, title, badge, children, className,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  badge?: { label: string; tone: Status };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mat-matte rounded-2xl p-5", className)}>
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.04] ring-1 ring-white/10">
            <Icon className="h-4.5 w-4.5 text-[color:var(--ink-mid)]" strokeWidth={1.75} />
          </div>
          <h3 className="text-[14px] font-semibold text-white tracking-tight">{title}</h3>
        </div>
        {badge && <StatusPill label={badge.label} tone={badge.tone} />}
      </header>
      <div className="divide-y divide-white/[0.04]">{children}</div>
    </section>
  );
}

function formatMHz(v: number | null | undefined) {
  if (v == null) return "—";
  if (v >= 1000) return `${(v / 1000).toFixed(2)} GHz`;
  return `${Math.round(v)} MHz`;
}
function formatDate(ms: number | null | undefined) {
  if (!ms) return "—";
  try { return new Date(ms).toLocaleString(); } catch { return "—"; }
}
function tempStatus(c: number | null): Status {
  if (c == null) return "info";
  if (c >= 90) return "err";
  if (c >= 80) return "warn";
  return "ok";
}
function loadStatus(p: number | null): Status {
  if (p == null) return "info";
  if (p >= 90) return "err";
  if (p >= 70) return "warn";
  return "ok";
}
function diskFreeStatus(free: number | null, size: number | null): Status {
  if (!free || !size) return "info";
  const pct = free / size;
  if (pct < 0.05) return "err";
  if (pct < 0.15) return "warn";
  return "ok";
}
function healthStatus(h: string | null): Status {
  if (!h) return "info";
  const s = h.toLowerCase();
  if (s.includes("healthy") || s === "ok") return "ok";
  if (s.includes("warn")) return "warn";
  return "err";
}
function batteryWearStatus(w: number | null): Status {
  if (w == null) return "info";
  if (w >= 30) return "err";
  if (w >= 15) return "warn";
  return "ok";
}

function buildTxt(r: HwReport): string {
  const L: string[] = [];
  L.push(`NOVYX Hardware Rapport`);
  L.push(`Genereret: ${new Date(r.generatedAt).toLocaleString()}`);
  L.push(`Vært: ${r.hostname || "—"}   Bruger: ${r.user || "—"}`);
  L.push("");
  L.push(`── System ──`);
  L.push(`Producent: ${r.computer?.manufacturer || "—"}`);
  L.push(`Model: ${r.computer?.model || "—"}`);
  L.push(`Familie: ${r.computer?.family || "—"}`);
  L.push(`Hypervisor: ${r.computer?.hypervisorPresent == null ? "—" : r.computer.hypervisorPresent ? "Ja" : "Nej"}`);
  L.push("");
  L.push(`── Bundkort ──`);
  L.push(`${r.board?.manufacturer || "—"} ${r.board?.product || ""} (${r.board?.version || "—"})`);
  L.push(`Serial: ${r.board?.serial || "—"}`);
  L.push("");
  L.push(`── BIOS ──`);
  L.push(`Vendor: ${r.bios?.vendor || "—"}`);
  L.push(`Version: ${r.bios?.version || "—"}`);
  L.push(`Dato: ${formatDate(r.bios?.releaseDate)}`);
  L.push(`SMBIOS: ${r.bios?.smbios || "—"}`);
  L.push("");
  L.push(`── OS ──`);
  L.push(`${r.os?.caption || "—"} (${r.os?.edition || "—"})`);
  L.push(`Version: ${r.os?.version || "—"}  Build ${r.os?.build || "—"}.${r.os?.ubr ?? "?"}  DisplayVersion: ${r.os?.displayVersion || "—"}`);
  L.push(`Arkitektur: ${r.os?.arch || "—"}`);
  L.push(`Installeret: ${formatDate(r.os?.installDate)}`);
  L.push(`Sidst startet: ${formatDate(r.os?.lastBoot)}`);
  L.push(`Aktivering: ${r.activation?.status || "—"} (${r.activation?.channel || "—"})`);
  L.push(`Firmware: ${r.firmware}   Secure Boot: ${r.secureBoot}   DirectX: ${r.directx || "—"}   HAGS: ${r.gpuScheduling}`);
  L.push("");
  L.push(`── CPU ──`);
  L.push(`${r.cpu?.name || "—"}`);
  L.push(`Producent: ${r.cpu?.manufacturer || "—"}   Socket: ${r.cpu?.socket || "—"}`);
  L.push(`Kerner: ${r.cpu?.cores ?? "—"}   Tråde: ${r.cpu?.threads ?? "—"}`);
  L.push(`Base: ${formatMHz(r.cpu?.baseClockMHz ?? null)}   Nu: ${formatMHz(r.cpu?.currentClockMHz ?? null)}`);
  L.push(`L2: ${r.cpu?.l2CacheKB ?? "—"} KB   L3: ${r.cpu?.l3CacheKB ?? "—"} KB`);
  L.push(`Belastning: ${r.cpu?.loadPercent ?? "—"} %   Temp: ${r.cpu?.tempC ?? "—"} °C`);
  L.push(`Virtualisering: ${r.cpu?.virtualization == null ? "—" : r.cpu.virtualization ? "Ja" : "Nej"}   SLAT: ${r.cpu?.slat == null ? "—" : r.cpu.slat ? "Ja" : "Nej"}`);
  L.push("");
  L.push(`── RAM ──`);
  L.push(`Installeret: ${formatBytes(r.memory.installedBytes)}   Slots: ${r.memory.slotsUsed}/${r.memory.slotsTotal ?? "?"}`);
  L.push(`I brug: ${r.memory.usedKb != null ? formatBytes(r.memory.usedKb * 1024) : "—"}   Ledig: ${r.memory.freeKb != null ? formatBytes(r.memory.freeKb * 1024) : "—"}`);
  for (const m of r.memory.modules) {
    L.push(`  • ${m.slot || m.bank || "?"}: ${formatBytes(m.capacity)} ${m.typeLabel || ""} @ ${m.configuredSpeed ?? m.ratedSpeed ?? "?"} MHz — ${m.manufacturer || ""} ${m.partNumber || ""}`);
  }
  L.push("");
  L.push(`── GPU ──`);
  for (const g of r.gpus) {
    L.push(`• ${g.name || "—"} [${g.vendor || "—"}]`);
    L.push(`  VRAM: ${formatBytes(g.vram)}   Driver: ${g.driverVersion || "—"} (${formatDate(g.driverDate)})`);
    L.push(`  Opløsning: ${g.currentResolution || "—"} @ ${g.currentRefreshRate ?? "—"} Hz   Status: ${g.status || "—"}`);
  }
  L.push("");
  L.push(`── Lager ──`);
  for (const d of r.storage.physical) {
    L.push(`• ${d.name || d.model || "—"} — ${d.mediaType || "?"} / ${d.busType || "?"} — ${formatBytes(d.size)}`);
    L.push(`  Health: ${d.health || "—"}   Firmware: ${d.firmware || "—"}   Serial: ${d.serial || "—"}`);
  }
  for (const v of r.storage.volumes) {
    L.push(`  ${v.letter} ${v.label ? `(${v.label})` : ""} — ${v.fileSystem || "?"} — ${formatBytes((v.size ?? 0) - (v.free ?? 0))} brugt af ${formatBytes(v.size)}`);
  }
  L.push("");
  L.push(`── Netværk ──`);
  for (const a of r.network.adapters) {
    L.push(`• ${a.name || a.description || "—"} [${a.status || "?"}]`);
    L.push(`  MAC: ${a.mac || "—"}   Link: ${a.linkSpeed || "—"}   Medie: ${a.mediaType || "—"}`);
    if (a.addresses?.length) L.push(`  IP: ${a.addresses.join(", ")}`);
  }
  L.push("");
  L.push(`── Skærme ──`);
  for (const m of r.monitors) L.push(`• ${m.manufacturer || "?"} ${m.name || ""} (${m.year || "?"}) serial ${m.serial || "—"}`);
  L.push("");
  L.push(`── TPM & Sikkerhed ──`);
  L.push(`TPM: ${r.tpm?.present ? `Tilstede (v${r.tpm.specVersion || "?"}) — ${r.tpm.manufacturer || "?"}` : "Ikke tilstede"}   Klar: ${r.tpm?.ready ? "Ja" : "Nej"}   Aktiveret: ${r.tpm?.enabled ? "Ja" : "Nej"}`);
  L.push(`Secure Boot: ${r.secureBoot}   Firmware: ${r.firmware}`);
  L.push("");
  if (r.battery.present) {
    L.push(`── Batteri ──`);
    L.push(`${r.battery.name || "—"} — ${r.battery.status || "?"} @ ${r.battery.percent ?? "—"} %`);
    L.push(`Design: ${r.battery.designCapacity ?? "—"} mWh   Fuld opladning: ${r.battery.fullChargeCapacity ?? "—"} mWh   Slid: ${r.battery.wearPercent ?? "—"} %   Cyklusser: ${r.battery.cycleCount ?? "—"}`);
  }
  return L.join("\n");
}

export function HardwareCenterPage() {
  const desktop = isDesktop();
  const [report, setReport] = useState<HwReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<null | "json" | "txt">(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    if (!desktop) { setLoading(false); setErr("Hardware Center kræver desktop-appen."); return; }
    setLoading(true); setErr(null);
    try { setReport(await scanHardware2(force)); }
    catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  }, [desktop]);

  useEffect(() => { void load(false); }, [load]);

  // auto-refresh belastning hvert 15s
  useEffect(() => {
    if (!desktop) return;
    const t = setInterval(() => { void load(true); }, 15_000);
    return () => clearInterval(t);
  }, [desktop, load]);

  const q = query.trim().toLowerCase();
  const matches = useCallback((s: string) => !q || s.toLowerCase().includes(q), [q]);

  const doCopy = useCallback(async (kind: "json" | "txt") => {
    if (!report) return;
    const content = kind === "json" ? JSON.stringify(report, null, 2) : buildTxt(report);
    try { await navigator.clipboard.writeText(content); setCopied(kind); setTimeout(() => setCopied(null), 1500); } catch {}
  }, [report]);

  const doExport = useCallback(async (format: "json" | "txt") => {
    if (!report) return;
    setExportMsg(null);
    try {
      const content = format === "json" ? JSON.stringify(report, null, 2) : buildTxt(report);
      const r = await exportReport(format, content);
      if (r.cancelled) return;
      if (r.path) setExportMsg(`Gemt: ${r.path}`);
      setTimeout(() => setExportMsg(null), 4000);
    } catch (e) { setExportMsg((e as Error).message); }
  }, [report]);

  const cpuTone = useMemo<Status>(() => tempStatus(report?.cpu?.tempC ?? null), [report]);
  const cpuLoadTone = useMemo<Status>(() => loadStatus(report?.cpu?.loadPercent ?? null), [report]);

  if (!desktop) {
    return (
      <div className="p-8 text-[color:var(--ink-mid)]">
        <div className="mat-matte rounded-2xl p-8 text-center">
          <Info className="mx-auto h-8 w-8 text-sky-400" />
          <h2 className="mt-3 text-lg font-semibold text-white">Hardware Center</h2>
          <p className="mt-2 text-sm">Denne side læser fysisk hardware via Windows og kan kun bruges i desktop-appen.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.04] px-8 py-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-faint)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søg efter kort, felt, model, serienummer…"
            className="w-full rounded-xl bg-white/[0.04] pl-9 pr-3 py-2 text-[13px] text-white placeholder:text-[color:var(--ink-faint)] ring-1 ring-white/10 focus:outline-none focus:ring-white/20"
          />
        </div>
        <div className="flex flex-1 items-center justify-end gap-2">
          <button
            onClick={() => void load(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-[12.5px] font-medium text-white ring-1 ring-white/10 hover:bg-white/[0.08] disabled:opacity-60"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} strokeWidth={2} />
            Opdatér
          </button>
          <button onClick={() => void doCopy("txt")} className="inline-flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-[12.5px] font-medium text-white ring-1 ring-white/10 hover:bg-white/[0.08]">
            {copied === "txt" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            Kopiér rapport
          </button>
          <button onClick={() => void doExport("txt")} className="inline-flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-[12.5px] font-medium text-white ring-1 ring-white/10 hover:bg-white/[0.08]">
            <FileText className="h-3.5 w-3.5" /> TXT
          </button>
          <button onClick={() => void doExport("json")} className="inline-flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-[12.5px] font-medium text-white ring-1 ring-white/10 hover:bg-white/[0.08]">
            <FileJson className="h-3.5 w-3.5" /> JSON
          </button>
        </div>
        {exportMsg && <div className="w-full text-[12px] text-[color:var(--ink-faint)]">{exportMsg}</div>}
        {err && (
          <div className="w-full rounded-xl bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-200 ring-1 ring-rose-500/25">
            <AlertTriangle className="mr-2 inline h-3.5 w-3.5" /> {err}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading && !report && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="mat-matte h-52 animate-pulse rounded-2xl" />
            ))}
          </div>
        )}

        {report && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">

            {matches("system computer producent model") && report.computer && (
              <Card icon={Server} title="System">
                <Field label="Producent" value={report.computer.manufacturer} />
                <Field label="Model" value={report.computer.model} />
                <Field label="Familie" value={report.computer.family} />
                <Field label="Værtsnavn" value={report.hostname} mono />
                <Field label="Bruger" value={report.user} mono />
                <Field label="Hypervisor" value={report.computer.hypervisorPresent == null ? "—" : report.computer.hypervisorPresent ? "Ja" : "Nej"} />
              </Card>
            )}

            {matches("cpu processor") && report.cpu && (
              <Card icon={Cpu} title="CPU" badge={{ label: report.cpu.loadPercent != null ? `${Math.round(report.cpu.loadPercent)}% belastning` : "—", tone: cpuLoadTone }}>
                <Field label="Model" value={report.cpu.name} />
                <Field label="Producent" value={report.cpu.manufacturer} />
                <Field label="Socket" value={report.cpu.socket} />
                <Field label="Kerner / Tråde" value={`${report.cpu.cores ?? "—"} / ${report.cpu.threads ?? "—"}`} />
                <Field label="Base" value={formatMHz(report.cpu.baseClockMHz)} />
                <Field label="Aktuel" value={formatMHz(report.cpu.currentClockMHz)} />
                <Field label="L2 cache" value={report.cpu.l2CacheKB != null ? `${report.cpu.l2CacheKB} KB` : "—"} />
                <Field label="L3 cache" value={report.cpu.l3CacheKB != null ? `${(report.cpu.l3CacheKB / 1024).toFixed(1)} MB` : "—"} />
                <Field label="Temperatur" value={<span className={statusColor(cpuTone)}>{report.cpu.tempC != null ? `${report.cpu.tempC} °C` : "—"}</span>} />
                <Field label="Virtualisering" value={report.cpu.virtualization == null ? "—" : report.cpu.virtualization ? "Aktiveret" : "Deaktiveret"} />
                <Field label="SLAT" value={report.cpu.slat == null ? "—" : report.cpu.slat ? "Ja" : "Nej"} />
              </Card>
            )}

            {matches("ram memory hukommelse") && (
              <Card icon={MemoryStick} title="Hukommelse" badge={{ label: `${report.memory.slotsUsed}/${report.memory.slotsTotal ?? "?"} slots`, tone: "info" }}>
                <Field label="Installeret" value={formatBytes(report.memory.installedBytes)} />
                <Field label="I brug" value={report.memory.usedKb != null ? formatBytes(report.memory.usedKb * 1024) : "—"} />
                <Field label="Ledig" value={report.memory.freeKb != null ? formatBytes(report.memory.freeKb * 1024) : "—"} />
                <Field label="Max kapacitet" value={report.memory.maxCapacityKb != null ? formatBytes(report.memory.maxCapacityKb * 1024) : "—"} />
                <div className="pt-3 space-y-2">
                  {report.memory.modules.map((m, i) => (
                    <div key={i} className="rounded-lg bg-white/[0.03] px-3 py-2 text-[12px] ring-1 ring-white/5">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-white">{m.slot || `Slot ${i+1}`}</span>
                        <span className="text-[color:var(--ink-faint)]">{formatBytes(m.capacity)} · {m.typeLabel || "?"} · {m.configuredSpeed ?? m.ratedSpeed ?? "?"} MHz</span>
                      </div>
                      <div className="mt-0.5 truncate text-[11.5px] text-[color:var(--ink-faint)]">
                        {[m.manufacturer, m.partNumber].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {matches("gpu graphics") && report.gpus.length > 0 && (
              <Card icon={MonitorSmartphone} title="Grafik">
                {report.gpus.map((g, i) => (
                  <div key={i} className="py-2">
                    <div className="text-[13px] font-medium text-white">{g.name || "—"}</div>
                    <div className="mt-0.5 text-[11.5px] text-[color:var(--ink-faint)]">{g.vendor || "—"}</div>
                    <div className="mt-2 space-y-0.5">
                      <Field label="VRAM" value={formatBytes(g.vram)} />
                      <Field label="Driver" value={g.driverVersion} mono />
                      <Field label="Driver-dato" value={formatDate(g.driverDate)} />
                      <Field label="Opløsning" value={g.currentResolution ? `${g.currentResolution} @ ${g.currentRefreshRate ?? "?"} Hz` : "—"} />
                      <Field label="Status" value={g.status} />
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {matches("bundkort motherboard board") && report.board && (
              <Card icon={Server} title="Bundkort">
                <Field label="Producent" value={report.board.manufacturer} />
                <Field label="Produkt" value={report.board.product} />
                <Field label="Version" value={report.board.version} />
                <Field label="Serienummer" value={report.board.serial} mono />
              </Card>
            )}

            {matches("bios") && report.bios && (
              <Card icon={Shield} title="BIOS / UEFI">
                <Field label="Vendor" value={report.bios.vendor} />
                <Field label="Version" value={report.bios.version} mono />
                <Field label="Dato" value={formatDate(report.bios.releaseDate)} />
                <Field label="SMBIOS" value={report.bios.smbios} />
                <Field label="Firmware-mode" value={report.firmware} />
                <Field label="Secure Boot" value={<StatusPill label={report.secureBoot} tone={report.secureBoot === "on" ? "ok" : report.secureBoot === "off" ? "warn" : "info"} />} />
              </Card>
            )}

            {matches("os windows") && report.os && (
              <Card icon={Info} title="Operativsystem"
                badge={{ label: report.activation?.status || "—", tone: report.activation?.status === "Licensed" ? "ok" : report.activation?.status ? "warn" : "info" }}>
                <Field label="Version" value={report.os.caption} />
                <Field label="Edition" value={report.os.edition} />
                <Field label="Build" value={`${report.os.build || "—"}.${report.os.ubr ?? "?"} (${report.os.displayVersion || "—"})`} mono />
                <Field label="Arkitektur" value={report.os.arch} />
                <Field label="Installeret" value={formatDate(report.os.installDate)} />
                <Field label="Sidst startet" value={formatDate(report.os.lastBoot)} />
                <Field label="System-drev" value={report.os.systemDrive} />
                <Field label="DirectX" value={report.directx} />
                <Field label="GPU Scheduling" value={report.gpuScheduling === "hardware" ? "Hardware (HAGS)" : report.gpuScheduling === "software" ? "Software" : "Ukendt"} />
              </Card>
            )}

            {matches("tpm secure sikkerhed") && (
              <Card icon={Shield} title="TPM & Sikkerhed"
                badge={{
                  label: report.tpm?.ready ? "Klar" : report.tpm?.present ? "Ikke klar" : "Mangler",
                  tone: report.tpm?.ready ? "ok" : report.tpm?.present ? "warn" : "err",
                }}>
                <Field label="Tilstede" value={report.tpm?.present ? "Ja" : "Nej"} />
                <Field label="Klar" value={report.tpm?.ready ? "Ja" : "Nej"} />
                <Field label="Aktiveret" value={report.tpm?.enabled == null ? "—" : report.tpm?.enabled ? "Ja" : "Nej"} />
                <Field label="Spec" value={report.tpm?.specVersion} />
                <Field label="Producent" value={report.tpm?.manufacturer} />
                <Field label="Manuf. version" value={report.tpm?.manufacturerVersion} mono />
                <Field label="Firmware" value={report.firmware} />
                <Field label="Secure Boot" value={report.secureBoot} />
              </Card>
            )}

            {matches("storage lager disk drev") && (
              <Card icon={HardDrive} title="Lager" className="xl:col-span-2">
                <div className="pb-3">
                  <div className="mb-2 text-[11.5px] font-medium uppercase tracking-wider text-[color:var(--ink-faint)]">Fysiske diske</div>
                  <div className="space-y-2">
                    {report.storage.physical.map((d, i) => (
                      <div key={i} className="rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-[13px] font-medium text-white">{d.name || d.model || "—"}</span>
                          <StatusPill label={d.health || "—"} tone={healthStatus(d.health)} />
                        </div>
                        <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11.5px] text-[color:var(--ink-faint)] sm:grid-cols-4">
                          <div>{d.mediaType || "?"} · {d.busType || "?"}</div>
                          <div>{formatBytes(d.size)}</div>
                          <div>FW: {d.firmware || "—"}</div>
                          <div className="truncate">SN: {d.serial || "—"}</div>
                        </div>
                      </div>
                    ))}
                    {report.storage.physical.length === 0 && report.storage.drives.map((d, i) => (
                      <div key={i} className="rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/5 text-[12px]">
                        {d.model} — {d.interface} — {formatBytes(d.size)}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pt-3">
                  <div className="mb-2 text-[11.5px] font-medium uppercase tracking-wider text-[color:var(--ink-faint)]">Volumener</div>
                  <div className="space-y-2">
                    {report.storage.volumes.map((v, i) => {
                      const used = (v.size ?? 0) - (v.free ?? 0);
                      const pct = v.size ? Math.min(100, Math.max(0, (used / v.size) * 100)) : 0;
                      const tone = diskFreeStatus(v.free, v.size);
                      return (
                        <div key={i} className="rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/5">
                          <div className="flex items-center justify-between text-[13px]">
                            <span className="font-medium text-white">{v.letter} {v.label ? <span className="text-[color:var(--ink-faint)]">({v.label})</span> : null}</span>
                            <span className="text-[11.5px] text-[color:var(--ink-faint)]">{formatBytes(used)} af {formatBytes(v.size)} · {v.fileSystem || "?"}</span>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                            <div className={cn("h-full", tone === "err" ? "bg-rose-400" : tone === "warn" ? "bg-amber-400" : "bg-emerald-400")} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            )}

            {matches("network netværk adapter ip") && report.network.adapters.length > 0 && (
              <Card icon={Wifi} title="Netværk" className="xl:col-span-2">
                <div className="space-y-2 pt-1">
                  {report.network.adapters.map((a, i) => {
                    const up = /up/i.test(a.status || "");
                    return (
                      <div key={i} className="rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-[13px] font-medium text-white">{a.name || a.description || "—"}</span>
                          <StatusPill label={a.status || "—"} tone={up ? "ok" : "info"} />
                        </div>
                        <div className="mt-0.5 truncate text-[11.5px] text-[color:var(--ink-faint)]">{a.description || ""}</div>
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11.5px] text-[color:var(--ink-mid)] sm:grid-cols-4">
                          <div>MAC: <span className="font-mono">{a.mac || "—"}</span></div>
                          <div>Link: {a.linkSpeed || "—"}</div>
                          <div>Medie: {a.mediaType || "—"}</div>
                          <div className="truncate">Driver: {a.driverVersion || "—"}</div>
                        </div>
                        {a.addresses.length > 0 && (
                          <div className="mt-1.5 text-[11.5px] text-[color:var(--ink-mid)]">
                            {a.addresses.map((ip, j) => <span key={j} className="mr-2 font-mono">{ip}</span>)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {matches("monitor skærm display") && report.monitors.length > 0 && (
              <Card icon={Monitor} title="Skærme">
                {report.monitors.map((m, i) => (
                  <div key={i} className="py-1.5">
                    <div className="text-[13px] font-medium text-white">{m.manufacturer || "?"} {m.name || ""}</div>
                    <div className="text-[11.5px] text-[color:var(--ink-faint)]">Årgang: {m.year || "—"} · Serial: <span className="font-mono">{m.serial || "—"}</span></div>
                  </div>
                ))}
                {report.gpus.map((g, i) => g.currentResolution && (
                  <Field key={i} label={g.name?.slice(0, 24) || `GPU ${i}`} value={`${g.currentResolution} @ ${g.currentRefreshRate ?? "?"} Hz`} />
                ))}
              </Card>
            )}

            {matches("battery batteri") && report.battery.present && (
              <Card icon={Battery} title="Batteri"
                badge={{
                  label: report.battery.wearPercent != null ? `${report.battery.wearPercent}% slid` : (report.battery.status || "—"),
                  tone: batteryWearStatus(report.battery.wearPercent),
                }}>
                <Field label="Status" value={report.battery.status} />
                <Field label="Opladning" value={report.battery.percent != null ? `${report.battery.percent} %` : "—"} />
                <Field label="Design-kapacitet" value={report.battery.designCapacity != null ? `${report.battery.designCapacity} mWh` : "—"} />
                <Field label="Fuld opladning" value={report.battery.fullChargeCapacity != null ? `${report.battery.fullChargeCapacity} mWh` : "—"} />
                <Field label="Cyklusser" value={report.battery.cycleCount} />
                <Field label="Navn" value={report.battery.name} />
              </Card>
            )}

            {report.smart.length > 0 && matches("smart") && (
              <Card icon={AlertTriangle} title="SMART-status">
                {report.smart.map((s, i) => (
                  <Field key={i}
                    label={s.instance || `Enhed ${i}`}
                    value={<StatusPill label={s.predictFailure ? "Fejl forudset" : "OK"} tone={s.predictFailure ? "err" : "ok"} />}
                  />
                ))}
              </Card>
            )}

          </div>
        )}

        {report && (
          <div className="mt-6 flex items-center justify-between text-[11px] text-[color:var(--ink-faint)]">
            <span>Sidst opdateret {new Date(report.generatedAt).toLocaleTimeString()}</span>
            <span>Auto-opdatering hver 15 sek.</span>
          </div>
        )}
      </div>
    </div>
  );
}
