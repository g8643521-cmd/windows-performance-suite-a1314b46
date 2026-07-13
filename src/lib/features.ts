// Central liste over funktioner i NOVYX.
import {
  Search, Zap, Trash2, MemoryStick, Rocket, Globe, Wifi, Gamepad2,
  Gauge, Database, HardDriveDownload, HardDrive, Cpu, Activity,
  type LucideIcon,
} from "lucide-react";

export type FeatureCategory = "core" | "performance" | "gaming" | "system";
export type FeatureStatus = "stable" | "beta" | "coming";

export type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
  category: FeatureCategory;
  status: FeatureStatus;
};

export const CATEGORY_LABEL: Record<FeatureCategory, string> = {
  core: "Core",
  performance: "Performance",
  gaming: "Gaming",
  system: "System",
};

export const FEATURES: Feature[] = [
  { icon: Search,             title: "Deep System Scan",       description: "Fuld analyse af Windows med kategoriseret rapport og handlingsforslag.",   category: "core",        status: "stable" },
  { icon: Zap,                title: "One-Click Boost",        description: "Kør alle sikre optimeringer på under 30 sekunder — uden dialoger.",       category: "core",        status: "stable" },
  { icon: Trash2,             title: "Precision Cleaner",      description: "14 sikre oprydningsmål — cache, prefetch, dumps, event logs, mere.",      category: "core",        status: "stable" },
  { icon: MemoryStick,        title: "RAM Reclaim",            description: "Frigør ubrugt hukommelse fra baggrundsprocesser i realtid.",              category: "performance", status: "stable" },
  { icon: Globe,              title: "Network Flush",          description: "Rens DNS, ARP og TCP-cache. Skift til Cloudflare, Quad9 eller Google.",   category: "performance", status: "stable" },
  { icon: Cpu,                title: "Hardware Insight",       description: "CPU, GPU, RAM, disk, bundkort, BIOS — alt på ét skærmbillede.",           category: "system",      status: "stable" },
  { icon: Rocket,             title: "Startup Manager",        description: "Se og deaktiver programmer der starter med Windows. Zero-guess ranking.", category: "system",      status: "beta" },
  { icon: Wifi,               title: "Latency Tuner",          description: "Optimer TCP-parametre og QoS til lavere ping i realtid.",                category: "gaming",      status: "beta" },
  { icon: Gamepad2,           title: "Game Mode",              description: "Frigør ressourcer, luk baggrundsapps og prioritér spillet.",             category: "gaming",      status: "coming" },
  { icon: Gauge,              title: "FPS Overlay",            description: "Lightweight overlay der viser FPS, frametime og systembelastning.",       category: "gaming",      status: "coming" },
  { icon: Database,           title: "Registry Compactor",     description: "Fjern orphan-nøgler og komprimér registry — med rollback.",              category: "system",      status: "coming" },
  { icon: HardDriveDownload,  title: "Driver Radar",           description: "Find forældede drivere med link til officielle downloads.",              category: "system",      status: "coming" },
  { icon: HardDrive,          title: "Storage Auditor",        description: "Kortlæg disken visuelt og find de største ressourcetyve.",               category: "system",      status: "coming" },
  { icon: Activity,           title: "Live Diagnostics",       description: "Realtids CPU/RAM/GPU/net + performance alerts og export.",              category: "performance", status: "stable" },
];
