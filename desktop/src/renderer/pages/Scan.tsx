import { useEffect, useState } from "react";
import {
  Cpu,
  MemoryStick,
  Zap,
  HardDrive,
  Monitor,
  Wifi,
  Battery,
  ThermometerSun,
  ScanSearch,
  Loader2,
  CheckCircle2,
  Server,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PendingChip } from "../components/Pending";
import { ErrorBanner } from "../components/ErrorBanner";
import {
  isDesktop,
  scanHardware,
  formatBytes,
  formatGHz,
  formatMHz,
  formatPercent,
  formatTemp,
  type HardwareReport,
} from "../lib/hardware";

type Status = "idle" | "scanning" | "done" | "error";

type Row = {
  key: string;
  title: string;
  hint: string;
  icon: LucideIcon;
  primary: string | null;
  details: { label: string; value: string }[];
};

function safePct(used: number | undefined, total: number | undefined): string {
  if (!used || !total || !Number.isFinite(used / total)) return "—";
  return formatPercent((used / total) * 100, 0);
}

function buildRows(report: HardwareReport | null): Row[] {
  const cpu = report?.cpu;
  const gpus = report?.gpus ?? [];
  const mem = report?.memory;
  const modules = mem?.modules ?? [];
  const drives = report?.storage?.drives ?? [];
  const fss = report?.storage?.filesystems ?? [];
  const displays = report?.displays ?? [];
  const net = report?.network;
  const batt = report?.battery;
  const sens = report?.sensors;
  const os = report?.os;

  const rows: Row[] = [];

  // ─── CPU ──────────────────────────────────────────────
  rows.push({
    key: "cpu",
    title: "Processor",
    hint: "Model, kerner, frekvens, aktuel belastning",
    icon: Cpu,
    primary: cpu ? `${cpu.brand ?? cpu.manufacturer ?? "CPU"}` : null,
    details: cpu
      ? [
          { label: "Producent", value: cpu.manufacturer || "—" },
          { label: "Kerner", value: `${cpu.physicalCores ?? "—"} fysiske · ${cpu.cores ?? "—"} tråde` },
          { label: "Base-frekvens", value: formatGHz(cpu.speed) },
          { label: "Boost-frekvens", value: formatGHz(cpu.speedMax) },
          { label: "Aktuel belastning", value: formatPercent(cpu.load, 1) },
          { label: "Aktuel temperatur", value: formatTemp(sens?.cpuMain ?? null) },
        ]
      : [],
  });

  // ─── GPU (én række pr. kort, dedikeret først) ────────
  const gpuKind = (g: HardwareReport["gpus"][number]): "dedicated" | "integrated" | "unknown" => {
    const s = `${g.vendor ?? ""} ${g.model ?? ""}`.toLowerCase();
    if (/intel.*(uhd|hd|iris|arc)|integrated|amd.*(vega|radeon graphics)|apu/.test(s)) return "integrated";
    if (/nvidia|geforce|rtx|gtx|quadro|radeon rx|radeon pro|arc a[0-9]/.test(s)) return "dedicated";
    if ((g.vram ?? 0) >= 2048) return "dedicated";
    return "unknown";
  };
  const gpuRank = { dedicated: 0, unknown: 1, integrated: 2 } as const;
  const sortedGpus = [...gpus]
    .map((g, i) => ({ g, i, kind: gpuKind(g) }))
    .sort((a, b) => gpuRank[a.kind] - gpuRank[b.kind] || (b.g.vram ?? 0) - (a.g.vram ?? 0) || a.i - b.i);

  if (sortedGpus.length === 0) {
    rows.push({
      key: "gpu-empty",
      title: "Grafikkort",
      hint: "Chipset, VRAM, driver, load, temperatur",
      icon: Zap,
      primary: null,
      details: [],
    });
  } else {
    sortedGpus.forEach(({ g, kind }, idx) => {
      const kindLabel = kind === "dedicated" ? "Dedikeret" : kind === "integrated" ? "Integreret" : "GPU";
      const title =
        sortedGpus.length > 1
          ? `${kindLabel === "GPU" ? "Grafikkort" : kindLabel + " GPU"}${idx === 0 ? " · primær" : ` #${idx + 1}`}`
          : kindLabel === "GPU"
            ? "Grafikkort"
            : `${kindLabel} GPU`;
      rows.push({
        key: `gpu-${idx}`,
        title,
        hint: idx === 0 ? "Chipset, VRAM, driver, load, temperatur" : "Sekundær grafikadapter",
        icon: Zap,
        primary: `${g.vendor ? g.vendor + " " : ""}${g.model ?? "GPU"}`.trim() || "GPU",
        details: [
          { label: "Producent", value: g.vendor || "—" },
          { label: "Chipset", value: g.model || "—" },
          { label: "Type", value: kindLabel === "GPU" ? "—" : kindLabel },
          { label: "VRAM", value: g.vram ? `${g.vram} MB` : "—" },
          { label: "Driver", value: g.driverVersion || "—" },
          { label: "Belastning", value: formatPercent(g.utilization) },
          { label: "Temperatur", value: formatTemp(g.temp) },
        ],
      });
    });
  }

  // ─── RAM ─────────────────────────────────────────────
  rows.push({
    key: "ram",
    title: "Hukommelse",
    hint: `${modules.length || 0} modul${modules.length === 1 ? "" : "er"} · kapacitet, type, hastighed`,
    icon: MemoryStick,
    primary: mem ? `${formatBytes(mem.total)} total` : null,
    details: mem
      ? [
          { label: "I brug", value: `${formatBytes(mem.used)} (${safePct(mem.used, mem.total)})` },
          { label: "Ledig", value: formatBytes(mem.free) },
          { label: "Antal moduler", value: modules.length > 0 ? String(modules.length) : "—" },
          ...modules.slice(0, 8).map((m, i) => ({
            label: `Modul ${i + 1}`,
            value: `${formatBytes(m.size)}${m.type ? " · " + m.type : ""}${
              m.clockSpeed ? " @ " + formatMHz(m.clockSpeed) : ""
            }${m.manufacturer ? " · " + m.manufacturer : ""}`,
          })),
        ]
      : [],
  });

  // ─── Storage (NVMe → SSD → HDD, større kapacitet først) ─
  const driveKind = (d: HardwareReport["storage"]["drives"][number]): "nvme" | "ssd" | "hdd" | "removable" | "unknown" => {
    const t = (d.type || "").toLowerCase();
    const iface = (d.interfaceType || "").toLowerCase();
    if (iface.includes("nvme") || t.includes("nvme")) return "nvme";
    if (t.includes("ssd")) return "ssd";
    if (t.includes("hdd") || t.includes("mechanical")) return "hdd";
    if (iface.includes("usb") || t.includes("removable")) return "removable";
    return "unknown";
  };
  const driveRank = { nvme: 0, ssd: 1, hdd: 2, unknown: 3, removable: 4 } as const;
  const driveTypeLabel = { nvme: "NVMe SSD", ssd: "SSD", hdd: "HDD", removable: "Ekstern", unknown: "Drev" } as const;
  const sortedDrives = [...drives]
    .map((d, i) => ({ d, i, kind: driveKind(d) }))
    .sort((a, b) => driveRank[a.kind] - driveRank[b.kind] || (b.d.size ?? 0) - (a.d.size ?? 0) || a.i - b.i);

  if (sortedDrives.length === 0 && fss.length === 0) {
    rows.push({
      key: "storage-empty",
      title: "Lager",
      hint: "SSD/HDD, størrelse, SMART-status",
      icon: HardDrive,
      primary: null,
      details: [],
    });
  } else {
    sortedDrives.forEach(({ d, kind }, idx) => {
      const typeLabel = driveTypeLabel[kind];
      rows.push({
        key: `drive-${idx}`,
        title:
          sortedDrives.length > 1
            ? `${typeLabel}${idx === 0 && kind !== "unknown" && kind !== "removable" ? " · system" : ` #${idx + 1}`}`
            : typeLabel,
        hint: `${d.interfaceType || typeLabel}${d.vendor ? " · " + d.vendor : ""}`,
        icon: HardDrive,
        primary: `${d.name || d.vendor || "Ukendt drev"}`,
        details: [
          { label: "Producent", value: d.vendor || "—" },
          { label: "Type", value: typeLabel },
          { label: "Interface", value: d.interfaceType || "—" },
          { label: "Kapacitet", value: formatBytes(d.size) },
          { label: "SMART-status", value: d.smartStatus || "—" },
        ],
      });
    });
    if (fss.length > 0) {
      const activeFss = fss.filter((f) => f.size > 0).sort((a, b) => b.size - a.size);
      rows.push({
        key: "partitions",
        title: "Partitioner",
        hint: `${activeFss.length} monteret filsystem${activeFss.length === 1 ? "" : "er"}`,
        icon: HardDrive,
        primary: `${activeFss.length} aktive`,
        details: activeFss.slice(0, 12).map((f) => ({
          label: `${f.mount || f.fs}${f.type ? " · " + f.type : ""}`,
          value: `${formatBytes(f.used)} / ${formatBytes(f.size)} (${safePct(f.used, f.size)})`,
        })),
      });
    }
  }

  // ─── Displays (primær først, derefter efter opløsning) ─
  const sortedDisplays = [...displays]
    .map((d, i) => ({ d, i }))
    .sort((a, b) => {
      if (!!b.d.main !== !!a.d.main) return b.d.main ? 1 : -1;
      const ap = (a.d.resolutionX ?? 0) * (a.d.resolutionY ?? 0);
      const bp = (b.d.resolutionX ?? 0) * (b.d.resolutionY ?? 0);
      return bp - ap || a.i - b.i;
    });

  if (sortedDisplays.length === 0) {
    rows.push({
      key: "display-empty",
      title: "Skærme",
      hint: "Opløsning, refresh rate",
      icon: Monitor,
      primary: null,
      details: [],
    });
  } else {
    sortedDisplays.forEach(({ d }, idx) => {
      const role = d.main ? "primær" : "sekundær";
      rows.push({
        key: `display-${idx}`,
        title: sortedDisplays.length > 1 ? `Skærm #${idx + 1} · ${role}` : "Skærm",
        hint: d.model || (d.main ? "Primær skærm" : "Aktiv skærm"),
        icon: Monitor,
        primary:
          d.resolutionX && d.resolutionY
            ? `${d.resolutionX} × ${d.resolutionY}${d.refreshRate ? " @ " + d.refreshRate + " Hz" : ""}`
            : "—",
        details: [
          { label: "Model", value: d.model || "—" },
          { label: "Opløsning", value: d.resolutionX && d.resolutionY ? `${d.resolutionX} × ${d.resolutionY}` : "—" },
          { label: "Refresh rate", value: d.refreshRate ? `${d.refreshRate} Hz` : "—" },
          { label: "Rolle", value: d.main ? "Primær" : "Sekundær" },
        ],
      });
    });
  }


  // ─── Netværk ─────────────────────────────────────────
  rows.push({
    key: "network",
    title: "Netværk",
    hint: "Aktiv adapter, IP, trafik",
    icon: Wifi,
    primary: net ? `${net.ifaceName || net.iface || "Netværk"} · ${net.type || ""}`.trim() : null,
    details: net
      ? [
          { label: "Adapter", value: net.ifaceName || net.iface || "—" },
          { label: "Type", value: net.type || "—" },
          { label: "IPv4", value: net.ip4 || "—" },
          { label: "Status", value: net.operstate || "—" },
          { label: "Link-hastighed", value: net.speed ? `${net.speed} Mbps` : "—" },
          {
            label: "Trafik",
            value:
              net.rxSec != null && net.txSec != null
                ? `↓ ${formatBytes(net.rxSec)}/s · ↑ ${formatBytes(net.txSec)}/s`
                : "—",
          },
        ]
      : [],
  });

  // ─── Batteri ─────────────────────────────────────────
  rows.push({
    key: "battery",
    title: "Batteri",
    hint: "Kapacitet, sundhed, opladning",
    icon: Battery,
    primary:
      batt && batt.hasBattery
        ? `${batt.percent ?? "—"}%${batt.isCharging ? " · oplader" : ""}`
        : batt && !batt.hasBattery
          ? "Intet batteri (stationær PC)"
          : null,
    details:
      batt && batt.hasBattery
        ? [
            { label: "Design-kapacitet", value: batt.designedCapacity ? `${batt.designedCapacity} mWh` : "—" },
            { label: "Aktuel maks", value: batt.maxCapacity ? `${batt.maxCapacity} mWh` : "—" },
            { label: "Cyklusser", value: batt.cycleCount != null ? String(batt.cycleCount) : "—" },
            {
              label: "Sundhed",
              value:
                batt.designedCapacity && batt.maxCapacity
                  ? formatPercent((batt.maxCapacity / batt.designedCapacity) * 100, 0)
                  : "—",
            },
          ]
        : [],
  });

  // ─── Sensorer ────────────────────────────────────────
  rows.push({
    key: "sensors",
    title: "Sensorer",
    hint: "CPU-temperatur pr. kerne",
    icon: ThermometerSun,
    primary: sens && sens.cpuMain != null ? formatTemp(sens.cpuMain) : null,
    details: sens
      ? [
          { label: "CPU aktuel", value: formatTemp(sens.cpuMain) },
          { label: "CPU peak", value: formatTemp(sens.cpuMax) },
          ...(sens.cores && sens.cores.length > 0
            ? sens.cores.map((c, i) => ({ label: `Kerne ${i + 1}`, value: formatTemp(c) }))
            : []),
        ]
      : [],
  });

  // ─── Operativsystem ──────────────────────────────────
  rows.push({
    key: "os",
    title: "Operativsystem",
    hint: "Windows-version, arkitektur, hostname",
    icon: Server,
    primary: os ? `${os.distro || os.platform || "Windows"}${os.release ? " " + os.release : ""}` : null,
    details: os
      ? [
          { label: "Distribution", value: os.distro || "—" },
          { label: "Version", value: os.release || "—" },
          { label: "Arkitektur", value: os.arch || "—" },
          { label: "Platform", value: os.platform || "—" },
          { label: "Hostname", value: os.hostname || "—" },
        ]
      : [],
  });

  return rows;
}


export function ScanPage() {
  const desktop = isDesktop();
  const [status, setStatus] = useState<Status>("idle");
  const [report, setReport] = useState<HardwareReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runScan = async () => {
    setStatus("scanning");
    setError(null);
    try {
      const data = await scanHardware();
      setReport(data);
      setStatus("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  };

  // Auto-scan første gang i desktop-appen
  useEffect(() => {
    if (desktop && status === "idle") runScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desktop]);

  const rows = buildRows(report);
  const scannedAt = report ? new Date(report.generatedAt) : null;

  return (
    <div className="h-full overflow-y-auto stage">
      <div className="page-container settle-list">

        {/* ══════════ HERO ══════════ */}
        <section className="relative pt-4">
          <span
            aria-hidden
            className="spot spot--blue"
            style={{ left: "50%", top: -160, width: 520, height: 520, opacity: 0.45, transform: "translateX(-50%)" }}
          />
          <span aria-hidden className="faint-grid" />

          <div
            className="mat-frosted sh-ambient relative overflow-hidden"
            style={{ padding: "56px 56px", borderRadius: "var(--r-hero)" }}
          >
            <span aria-hidden className="lightline lightline--top" style={{ left: "10%", right: "10%" }} />

            <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-[1fr_auto]">
              <div className="max-w-2xl">
                <span className="kicker">Hardware</span>
                <h1 className="display-lg mt-5">
                  Din maskine — <span className="grad-text">helt oplyst.</span>
                </h1>
                <p className="hero-lead" style={{ marginTop: 20 }}>
                  Rigtige specifikationer, sensorer og ydelse — hentet lokalt fra din PC.
                  Intet forlader maskinen.
                </p>

                <div className="mt-10 flex flex-wrap items-center gap-3">
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={runScan}
                    disabled={!desktop || status === "scanning"}
                    data-tooltip={!desktop ? "Kun tilgængelig i desktop-appen" : undefined}
                  >
                    {status === "scanning" ? (
                      <Loader2 className="h-[18px] w-[18px] animate-spin" strokeWidth={2} />
                    ) : (
                      <ScanSearch className="h-[18px] w-[18px]" strokeWidth={2} />
                    )}
                    {status === "scanning"
                      ? "Scanner …"
                      : status === "done"
                        ? "Scan igen"
                        : "Start scanning"}
                  </button>

                  {!desktop && <PendingChip label="Kun i desktop-appen" />}
                  {desktop && status === "done" && scannedAt && (
                    <span className="inline-flex items-center gap-2 text-[13px] text-[color:var(--ink-low)]">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" strokeWidth={2} />
                      Opdateret {scannedAt.toLocaleTimeString()}
                    </span>
                  )}
                  {status === "error" && error && (
                    <div className="w-full max-w-2xl">
                      <ErrorBanner message={error} />
                    </div>
                  )}
                </div>

                {/* System-linje */}
                {report?.os && (
                  <div
                    className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[12px] uppercase tracking-[0.14em] text-[color:var(--ink-low)]"
                  >
                    <span>{report.os.distro} {report.os.release}</span>
                    <span>{report.os.arch}</span>
                    <span>{report.os.hostname}</span>
                  </div>
                )}
              </div>

              {/* Chip-illustration */}
              <div className="relative shrink-0 justify-self-center lg:justify-self-end">
                <div
                  className="relative grid h-[220px] w-[220px] place-items-center rounded-[36px] overflow-hidden"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02) 55%), linear-gradient(135deg, rgba(59,130,246,0.35), rgba(34,211,238,0.18) 60%, rgba(8,10,16,0.9))",
                    border: "1px solid rgba(59,130,246,0.35)",
                    boxShadow:
                      "0 40px 80px -20px rgba(59,130,246,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
                  }}
                >
                  <span aria-hidden className="spot spot--cyan" style={{ inset: "-20%", opacity: 0.35 }} />
                  <Cpu className="relative z-[1] h-24 w-24 text-white" strokeWidth={1.25} />
                  {[...Array(8)].map((_, i) => (
                    <span
                      key={`t-${i}`}
                      className="absolute h-2 w-4 rounded-b-sm bg-white/20"
                      style={{ top: -2, left: 30 + i * 22 }}
                    />
                  ))}
                  {[...Array(8)].map((_, i) => (
                    <span
                      key={`b-${i}`}
                      className="absolute h-2 w-4 rounded-t-sm bg-white/20"
                      style={{ bottom: -2, left: 30 + i * 22 }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════ SPEC-RÆKKER ══════════ */}
        <section className="section">
          <div className="section-head">
            <div>
              <div className="section-title">Specifikationer</div>
              <div className="section-lead">
                {status === "done"
                  ? "Live data fra din maskine."
                  : status === "scanning"
                    ? "Henter data fra din maskine …"
                    : desktop
                      ? "Klik Start scanning for at læse din hardware."
                      : "Åbn NOVYX desktop-appen for at læse hardware."}
              </div>
            </div>
          </div>

          <div className="settle-list">
            {rows.map((r) => {
              const Icon = r.icon;
              const has = r.primary != null;
              return (
                <div key={r.key} className="spec-row reactive">
                  <div className="spec-row__glyph">
                    <Icon className="h-7 w-7" strokeWidth={1.6} />
                  </div>

                  <div className="min-w-0">
                    <div className="display-md" style={{ fontSize: 22 }}>{r.title}</div>
                    <div className="mt-1 text-[13px] text-[color:var(--ink-low)]">{r.hint}</div>

                    {has && r.details.length > 0 && (
                      <div className="mt-4 grid gap-x-8 gap-y-1.5 text-[13px] sm:grid-cols-2">
                        {r.details.map((d, i) => (
                          <div key={i} className="flex justify-between gap-4">
                            <span className="text-[color:var(--ink-low)]">{d.label}</span>
                            <span
                              className="truncate text-right text-[color:var(--ink-high)]"
                              style={{ fontVariantNumeric: "tabular-nums" }}
                              title={d.value}
                            >
                              {d.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-[180px] flex-col items-end gap-2">
                    {has ? (
                      <div
                        className="text-right font-semibold text-[color:var(--ink-high)]"
                        style={{ fontSize: 20, fontVariantNumeric: "tabular-nums" }}
                      >
                        {r.primary}
                      </div>
                    ) : status === "scanning" ? (
                      <div className="value-pending" style={{ fontSize: 28 }}>
                        <Loader2 className="h-6 w-6 animate-spin" strokeWidth={2} />
                      </div>
                    ) : (
                      <>
                        <div className="value-pending" style={{ fontSize: 28 }}>—</div>
                        <PendingChip label={desktop ? "Afventer scanning" : "Kun i desktop-appen"} />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </div>
  );
}
