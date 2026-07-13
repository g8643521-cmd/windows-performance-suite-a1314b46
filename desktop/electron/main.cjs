const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const { spawn } = require("child_process");

const isDev = !app.isPackaged;

/*
  Rendering QA: den uskarpe/glitchende tilstand opstod først efter første
  mousemove/hover repaint. Hold renderingen deterministisk og skarp i software.
*/
app.disableHardwareAcceleration();
app.commandLine.appendSwitch("force-color-profile", "srgb");
app.commandLine.appendSwitch("high-dpi-support", "1");
app.commandLine.appendSwitch("disable-gpu-rasterization");
app.commandLine.appendSwitch("disable-zero-copy");
app.commandLine.appendSwitch("disable-direct-composition");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");

let mainWindow = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: "#0B0B12",
    frame: true,
    autoHideMenuBar: true,
    show: false,
    paintWhenInitiallyHidden: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  mainWindow = win;

  win.webContents.setZoomFactor(1);
  win.webContents.on("did-finish-load", () => {
    win.webContents.setZoomFactor(1);
    win.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {});
  });

  win.once("ready-to-show", () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

// ─────────────────────────────────────────────────────────────
// Hardware — fuld scan via systeminformation
// ─────────────────────────────────────────────────────────────
async function readHardware() {
  const si = require("systeminformation");
  const [cpu, cpuLoad, mem, memLayout, gfx, disks, fs2, osi, net, netStats, batt, temp] =
    await Promise.all([
      si.cpu().catch(() => null),
      si.currentLoad().catch(() => null),
      si.mem().catch(() => null),
      si.memLayout().catch(() => []),
      si.graphics().catch(() => null),
      si.diskLayout().catch(() => []),
      si.fsSize().catch(() => []),
      si.osInfo().catch(() => null),
      si.networkInterfaces().catch(() => []),
      si.networkStats().catch(() => []),
      si.battery().catch(() => null),
      si.cpuTemperature().catch(() => null),
    ]);

  const primaryNet = Array.isArray(net)
    ? net.find((n) => n.default) || net.find((n) => !n.internal && n.operstate === "up")
    : null;
  const primaryNetStats = Array.isArray(netStats)
    ? netStats.find((s) => primaryNet && s.iface === primaryNet.iface) || netStats[0]
    : null;

  return {
    generatedAt: Date.now(),
    cpu: cpu && {
      manufacturer: cpu.manufacturer,
      brand: cpu.brand,
      cores: cpu.cores,
      physicalCores: cpu.physicalCores,
      speed: cpu.speed,
      speedMax: cpu.speedMax,
      load: cpuLoad?.currentLoad ?? null,
    },
    memory: mem && {
      total: mem.total,
      used: mem.active,
      free: mem.available,
      modules: (memLayout || []).map((m) => ({
        size: m.size, type: m.type, clockSpeed: m.clockSpeed, manufacturer: m.manufacturer,
      })),
    },
    gpus: (gfx?.controllers || []).map((g) => ({
      model: g.model, vendor: g.vendor, vram: g.vram, driverVersion: g.driverVersion,
      utilization: g.utilizationGpu ?? null, temp: g.temperatureGpu ?? null,
    })),
    displays: (gfx?.displays || []).map((d) => ({
      model: d.model, main: d.main,
      resolutionX: d.currentResX ?? d.resolutionX ?? null,
      resolutionY: d.currentResY ?? d.resolutionY ?? null,
      refreshRate: d.currentRefreshRate ?? null,
    })),
    storage: {
      drives: (disks || []).map((d) => ({
        name: d.name, type: d.type, vendor: d.vendor, size: d.size,
        interfaceType: d.interfaceType, smartStatus: d.smartStatus,
      })),
      filesystems: (fs2 || []).map((f) => ({
        fs: f.fs, mount: f.mount, type: f.type, size: f.size, used: f.used,
      })),
    },
    os: osi && {
      platform: osi.platform, distro: osi.distro, release: osi.release,
      arch: osi.arch, hostname: osi.hostname,
    },
    network: primaryNet && {
      iface: primaryNet.iface, ifaceName: primaryNet.ifaceName, type: primaryNet.type,
      speed: primaryNet.speed, ip4: primaryNet.ip4, operstate: primaryNet.operstate,
      rxSec: primaryNetStats?.rx_sec ?? null, txSec: primaryNetStats?.tx_sec ?? null,
    },
    battery: batt && batt.hasBattery
      ? { hasBattery: true, percent: batt.percent, isCharging: batt.isCharging,
          designedCapacity: batt.designedCapacity, maxCapacity: batt.maxCapacity, cycleCount: batt.cycleCount }
      : { hasBattery: false },
    sensors: temp && { cpuMain: temp.main ?? null, cpuMax: temp.max ?? null, cores: temp.cores || [] },
  };
}

ipcMain.handle("hardware:scan", async () => {
  try { return { ok: true, data: await readHardware() }; }
  catch (err) { return { ok: false, error: err?.message || String(err) }; }
});

// ─────────────────────────────────────────────────────────────
// Live system snapshot — hurtig, opdateres i loop fra renderer
// ─────────────────────────────────────────────────────────────
ipcMain.handle("system:live", async () => {
  try {
    const si = require("systeminformation");
    const [load, mem, netStats, temp] = await Promise.all([
      si.currentLoad().catch(() => null),
      si.mem().catch(() => null),
      si.networkStats().catch(() => []),
      si.cpuTemperature().catch(() => null),
    ]);
    const primary = Array.isArray(netStats) ? netStats[0] : null;
    return {
      ok: true,
      data: {
        ts: Date.now(),
        cpuLoad: load?.currentLoad ?? null,
        memUsed: mem?.active ?? null,
        memTotal: mem?.total ?? null,
        rxSec: primary?.rx_sec ?? null,
        txSec: primary?.tx_sec ?? null,
        cpuTemp: temp?.main ?? null,
        uptimeSec: Math.floor(os.uptime()),
      },
    };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

// ─────────────────────────────────────────────────────────────
// Game detection — Steam + Epic (rigtige installerede spil)
// ─────────────────────────────────────────────────────────────
function parseVdfLibraryFolders(text) {
  const paths = [];
  const re = /"path"\s*"([^"]+)"/gi;
  let m;
  while ((m = re.exec(text))) paths.push(m[1].replace(/\\\\/g, "\\"));
  return paths;
}

function parseAcf(text) {
  const get = (key) => {
    const r = new RegExp(`"${key}"\\s*"([^"]+)"`, "i");
    const m = r.exec(text);
    return m ? m[1] : null;
  };
  return { appid: get("appid"), name: get("name"), sizeOnDisk: get("SizeOnDisk") };
}

async function scanSteam() {
  if (process.platform !== "win32") return [];
  const roots = [];
  const guesses = [
    "C:\\Program Files (x86)\\Steam",
    "C:\\Program Files\\Steam",
    path.join(os.homedir(), "Steam"),
  ];
  for (const g of guesses) {
    try {
      const s = await fsp.stat(path.join(g, "steamapps"));
      if (s.isDirectory()) { roots.push(g); break; }
    } catch { /* not present */ }
  }
  if (roots.length === 0) return [];

  const libraries = [roots[0]];
  try {
    const vdf = await fsp.readFile(path.join(roots[0], "steamapps", "libraryfolders.vdf"), "utf8");
    for (const p of parseVdfLibraryFolders(vdf)) {
      if (!libraries.includes(p)) libraries.push(p);
    }
  } catch { /* older steam layout — main library still works */ }

  const games = [];
  for (const lib of libraries) {
    const dir = path.join(lib, "steamapps");
    let entries;
    try { entries = await fsp.readdir(dir); } catch { continue; }
    for (const e of entries) {
      if (!e.startsWith("appmanifest_") || !e.endsWith(".acf")) continue;
      try {
        const text = await fsp.readFile(path.join(dir, e), "utf8");
        const { appid, name, sizeOnDisk } = parseAcf(text);
        if (!appid || !name) continue;
        // Filter Steam-tools/redistributables/proton
        if (/^(Steamworks Common|Proton|Steam Linux Runtime|SteamVR)/i.test(name)) continue;
        games.push({
          id: `steam-${appid}`,
          platform: "steam",
          name,
          appId: appid,
          sizeBytes: sizeOnDisk ? Number(sizeOnDisk) : null,
          coverUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`,
          library: lib,
        });
      } catch { /* skip broken manifest */ }
    }
  }
  return games;
}

async function scanEpic() {
  if (process.platform !== "win32") return [];
  const manifest = "C:\\ProgramData\\Epic\\UnrealEngineLauncher\\LauncherInstalled.dat";
  try {
    const raw = await fsp.readFile(manifest, "utf8");
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed.InstallationList) ? parsed.InstallationList : [];
    return list
      .filter((g) => g && g.AppName && g.InstallLocation)
      .map((g) => ({
        id: `epic-${g.AppName}`,
        platform: "epic",
        name: g.AppName.replace(/([a-z])([A-Z])/g, "$1 $2"),
        appId: g.AppName,
        sizeBytes: g.AppSize ?? null,
        coverUrl: null,
        library: g.InstallLocation,
      }));
  } catch { return []; }
}

ipcMain.handle("games:scan", async () => {
  try {
    const [steam, epic] = await Promise.all([scanSteam(), scanEpic()]);
    return { ok: true, data: [...steam, ...epic].sort((a, b) => a.name.localeCompare(b.name)) };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

ipcMain.handle("games:launch", async (_e, id) => {
  try {
    if (typeof id !== "string") throw new Error("Ugyldigt spil-ID");
    if (id.startsWith("steam-")) {
      const appid = id.slice("steam-".length);
      await shell.openExternal(`steam://rungameid/${appid}`);
      return { ok: true };
    }
    if (id.startsWith("epic-")) {
      const name = id.slice("epic-".length);
      await shell.openExternal(`com.epicgames.launcher://apps/${name}?action=launch&silent=true`);
      return { ok: true };
    }
    return { ok: false, error: "Ukendt platform" };
  } catch (err) { return { ok: false, error: err?.message || String(err) }; }
});

// ─────────────────────────────────────────────────────────────
// Repair-værktøjer — rigtige Windows-kommandoer med admin-elevation
// ─────────────────────────────────────────────────────────────
const REPAIR_TOOLS = {
  "system-repair": {
    label: "Systemreparation (SFC + DISM)",
    admin: true,
    cmd: "sfc /scannow && DISM /Online /Cleanup-Image /RestoreHealth",
  },
  "disk-cleanup": {
    label: "Diskoprydning",
    admin: false,
    cmd: "cleanmgr /d C",
  },
  "network-reset": {
    label: "Netværksreset",
    admin: true,
    cmd: "ipconfig /flushdns && netsh int ip reset && netsh winsock reset",
    postNote: "Genstart Windows for at fuldføre.",
  },
  "driver-check": {
    label: "Driveropdatering (Windows Update)",
    admin: false,
    // Åbner Windows Update — brugerens klare valg
    cmd: null,
    open: "ms-settings:windowsupdate",
  },
  "security-scan": {
    label: "Sikkerhedsscanning (Defender)",
    admin: true,
    cmd: '"%ProgramFiles%\\Windows Defender\\MpCmdRun.exe" -Scan -ScanType 1',
  },
  "disk-check": {
    label: "Lagerreparation (CHKDSK - kun læs)",
    admin: true,
    cmd: "chkdsk C:",
  },
};

function runElevatedCmd(cmd) {
  // Åbner et cmd-vindue med admin-rettigheder via PowerShell Start-Process -Verb RunAs.
  // Brugeren ser UAC-prompt og outputtet i konsollen. NOVYX venter ikke på færdiggørelse.
  const ps = [
    "Start-Process",
    "-FilePath", "cmd.exe",
    "-ArgumentList", `'/k','${cmd.replace(/'/g, "''")}'`,
    "-Verb", "RunAs",
  ].join(" ");
  return new Promise((resolve) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-Command", ps], {
      windowsHide: true, detached: true, stdio: "ignore",
    });
    child.on("error", (e) => resolve({ ok: false, error: e.message }));
    child.on("spawn", () => resolve({ ok: true, launched: true }));
    // If neither event fires quickly, resolve after a short delay
    setTimeout(() => resolve({ ok: true, launched: true }), 300);
  });
}

function runNonElevatedCmd(cmd) {
  return new Promise((resolve) => {
    const child = spawn("cmd.exe", ["/c", `start "" ${cmd}`], {
      windowsHide: true, detached: true, stdio: "ignore",
    });
    child.on("error", (e) => resolve({ ok: false, error: e.message }));
    child.on("spawn", () => resolve({ ok: true, launched: true }));
    setTimeout(() => resolve({ ok: true, launched: true }), 300);
  });
}

ipcMain.handle("repair:run", async (_e, toolId) => {
  const tool = REPAIR_TOOLS[toolId];
  if (!tool) return { ok: false, error: "Ukendt værktøj" };
  if (process.platform !== "win32") return { ok: false, error: "Kun tilgængelig på Windows" };

  try {
    if (tool.open) {
      await shell.openExternal(tool.open);
      return { ok: true, launched: true, label: tool.label };
    }
    const res = tool.admin ? await runElevatedCmd(tool.cmd) : await runNonElevatedCmd(tool.cmd);
    return { ...res, label: tool.label, postNote: tool.postNote || null };
  } catch (err) { return { ok: false, error: err?.message || String(err) }; }
});

ipcMain.handle("repair:list", async () => Object.entries(REPAIR_TOOLS).map(([id, t]) => ({
  id, label: t.label, admin: !!t.admin,
})));

// ─────────────────────────────────────────────────────────────
// App-actions: autostart, external links, diagnostics-eksport
// ─────────────────────────────────────────────────────────────
ipcMain.handle("app:getAutoStart", async () => {
  try {
    const s = app.getLoginItemSettings();
    return { ok: true, enabled: !!s.openAtLogin };
  } catch (err) { return { ok: false, error: err?.message || String(err) }; }
});

ipcMain.handle("app:setAutoStart", async (_e, enabled) => {
  try {
    app.setLoginItemSettings({ openAtLogin: !!enabled, path: process.execPath });
    return { ok: true };
  } catch (err) { return { ok: false, error: err?.message || String(err) }; }
});

ipcMain.handle("app:openExternal", async (_e, url) => {
  try {
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
      // Tillad også ms-settings: og steam:// (whitelist)
      if (typeof url !== "string" || !/^(ms-settings|steam|com\.epicgames\.launcher):/i.test(url)) {
        throw new Error("Ugyldig URL");
      }
    }
    await shell.openExternal(url);
    return { ok: true };
  } catch (err) { return { ok: false, error: err?.message || String(err) }; }
});

ipcMain.handle("app:openLogsFolder", async () => {
  try {
    const p = app.getPath("logs");
    await fsp.mkdir(p, { recursive: true });
    await shell.openPath(p);
    return { ok: true, path: p };
  } catch (err) { return { ok: false, error: err?.message || String(err) }; }
});

ipcMain.handle("app:version", async () => ({ ok: true, version: app.getVersion() }));

ipcMain.handle("diagnostics:export", async () => {
  try {
    const data = await readHardware();
    const payload = {
      app: "NOVYX",
      version: app.getVersion(),
      exportedAt: new Date().toISOString(),
      platform: process.platform,
      arch: process.arch,
      hardware: data,
    };
    const target = await dialog.showSaveDialog(mainWindow, {
      title: "Gem NOVYX diagnostik",
      defaultPath: path.join(app.getPath("downloads"),
        `novyx-diagnostik-${new Date().toISOString().replace(/[:.]/g, "-")}.json`),
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (target.canceled || !target.filePath) return { ok: false, error: "Annulleret" };
    await fsp.writeFile(target.filePath, JSON.stringify(payload, null, 2), "utf8");
    return { ok: true, path: target.filePath };
  } catch (err) { return { ok: false, error: err?.message || String(err) }; }
});

// ─────────────────────────────────────────────────────────────
// Optimize — top-processer, temp-mapper, cleanup, health scan
// ─────────────────────────────────────────────────────────────
ipcMain.handle("optimize:processes", async () => {
  try {
    const si = require("systeminformation");
    const p = await si.processes();
    const list = (p.list || [])
      .filter((x) => x.name && (x.cpu > 0.1 || x.memRss > 0))
      .sort((a, b) => (b.memRss || 0) - (a.memRss || 0))
      .slice(0, 20)
      .map((x) => ({
        pid: x.pid, name: x.name, cpu: x.cpu ?? 0,
        memBytes: (x.memRss || 0) * 1024, // memRss er i KB
      }));
    return { ok: true, data: { total: p.all ?? list.length, running: p.running ?? null, list } };
  } catch (err) { return { ok: false, error: err?.message || String(err) }; }
});

async function dirSize(dir) {
  let total = 0, files = 0;
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      try {
        if (e.isDirectory()) {
          const sub = await dirSize(full);
          total += sub.total; files += sub.files;
        } else {
          const s = await fsp.stat(full);
          total += s.size; files += 1;
        }
      } catch { /* skip locked */ }
    }
  } catch { /* skip inaccessible */ }
  return { total, files };
}

function tempFolders() {
  const list = [];
  if (process.env.TEMP) list.push(process.env.TEMP);
  const local = process.env.LOCALAPPDATA;
  if (local) {
    const t = path.join(local, "Temp");
    if (!list.includes(t)) list.push(t);
  }
  if (process.platform === "win32") {
    const win = path.join(process.env.SystemRoot || "C:\\Windows", "Temp");
    if (!list.includes(win)) list.push(win);
  }
  return list;
}

ipcMain.handle("optimize:tempInfo", async () => {
  try {
    const folders = tempFolders();
    const results = await Promise.all(folders.map(async (f) => {
      const s = await dirSize(f);
      return { path: f, bytes: s.total, files: s.files };
    }));
    return { ok: true, data: results };
  } catch (err) { return { ok: false, error: err?.message || String(err) }; }
});

async function cleanDir(dir) {
  let freed = 0, removed = 0, skipped = 0;
  let entries = [];
  try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return { freed, removed, skipped }; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    try {
      const st = await fsp.stat(full);
      if (e.isDirectory()) {
        const sub = await cleanDir(full);
        freed += sub.freed; removed += sub.removed; skipped += sub.skipped;
        try { await fsp.rmdir(full); } catch { /* not empty / locked */ }
      } else {
        await fsp.unlink(full);
        freed += st.size; removed += 1;
      }
    } catch { skipped += 1; }
  }
  return { freed, removed, skipped };
}

ipcMain.handle("optimize:cleanTemp", async () => {
  try {
    // Kun brugerens egen TEMP — aldrig systemets, aldrig LocalAppData\Temp uden bekræftelse.
    const target = process.env.TEMP;
    if (!target) return { ok: false, error: "Ingen TEMP-mappe fundet" };
    const res = await cleanDir(target);
    return { ok: true, data: { path: target, ...res } };
  } catch (err) { return { ok: false, error: err?.message || String(err) }; }
});

ipcMain.handle("optimize:healthScan", async () => {
  try {
    const si = require("systeminformation");
    const [mem, load, fss, temp, osi] = await Promise.all([
      si.mem().catch(() => null),
      si.currentLoad().catch(() => null),
      si.fsSize().catch(() => []),
      si.cpuTemperature().catch(() => null),
      si.osInfo().catch(() => null),
    ]);
    const tempFolder = process.env.TEMP;
    const tempStat = tempFolder ? await dirSize(tempFolder) : { total: 0, files: 0 };

    const checks = [];
    if (mem) {
      const usedPct = (mem.active / mem.total) * 100;
      checks.push({
        id: "memory", label: "Hukommelsesforbrug",
        level: usedPct > 85 ? "warn" : "ok",
        detail: `${usedPct.toFixed(0)}% i brug`,
      });
    }
    if (load) {
      checks.push({
        id: "cpu", label: "CPU-belastning",
        level: load.currentLoad > 80 ? "warn" : "ok",
        detail: `${load.currentLoad.toFixed(0)}% aktuel`,
      });
    }
    for (const f of fss.slice(0, 4)) {
      if (!f.size) continue;
      const usedPct = (f.used / f.size) * 100;
      checks.push({
        id: `disk-${f.fs}`, label: `Diskplads ${f.mount || f.fs}`,
        level: usedPct > 90 ? "warn" : usedPct > 80 ? "notice" : "ok",
        detail: `${usedPct.toFixed(0)}% brugt`,
      });
    }
    if (temp && temp.main != null) {
      checks.push({
        id: "temp", label: "CPU-temperatur",
        level: temp.main > 85 ? "warn" : temp.main > 75 ? "notice" : "ok",
        detail: `${temp.main.toFixed(0)}°C`,
      });
    }
    checks.push({
      id: "tempfiles", label: "Midlertidige filer",
      level: tempStat.total > 1_000_000_000 ? "notice" : "ok",
      detail: `${(tempStat.total / 1e9).toFixed(2)} GB · ${tempStat.files} filer`,
    });
    checks.push({
      id: "uptime", label: "Oppetid",
      level: os.uptime() > 7 * 24 * 3600 ? "notice" : "ok",
      detail: `${Math.floor(os.uptime() / 3600)} timer siden genstart`,
    });

    return {
      ok: true,
      data: {
        ts: Date.now(),
        os: osi ? `${osi.distro} ${osi.release}` : null,
        checks,
      },
    };
  } catch (err) { return { ok: false, error: err?.message || String(err) }; }
});

// ─────────────────────────────────────────────────────────────
// Tweaks — åbn rigtige Windows-indstillinger via ms-settings:
// ─────────────────────────────────────────────────────────────
ipcMain.handle("tweaks:list", async () => ([
  { id: "gamemode",       label: "Game Mode",              detail: "Windows game mode og optimering",         target: "ms-settings:gaming-gamemode" },
  { id: "graphics",       label: "Grafik-præstation",      detail: "Pr. app GPU-præference",                 target: "ms-settings:display-advancedgraphics" },
  { id: "power",          label: "Strømplan",              detail: "Ultimate Performance / Høj ydelse",      target: "ms-settings:powersleep" },
  { id: "startup",        label: "Opstartsprogrammer",     detail: "Deaktiver tunge autostart-apps",         target: "ms-settings:startupapps" },
  { id: "storage",        label: "Storage Sense",          detail: "Automatisk oprydning",                    target: "ms-settings:storagesense" },
  { id: "notifications",  label: "Fokus / Notifikationer", detail: "Reducer afbrydelser i spil",             target: "ms-settings:notifications" },
  { id: "privacy-bg",     label: "Baggrundsapps",          detail: "Stop apps der kører i baggrunden",       target: "ms-settings:privacy-backgroundapps" },
  { id: "network",        label: "Netværksstatus",         detail: "Latency, datamåler, adapter",            target: "ms-settings:network-status" },
  { id: "display",        label: "Skærm & refresh",        detail: "Opløsning, HDR, refresh rate",           target: "ms-settings:display" },
  { id: "sound",          label: "Lyd",                    detail: "Spatial audio, output device",           target: "ms-settings:sound" },
]));

// ─────────────────────────────────────────────────────────────
// Installerede programmer — læses fra Uninstall-registry via PowerShell
// ─────────────────────────────────────────────────────────────
ipcMain.handle("apps:list", async () => {
  if (process.platform !== "win32") return { ok: false, error: "Kun tilgængelig på Windows" };
  const script = [
    "$paths=@(",
    "'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',",
    "'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',",
    "'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'",
    ");",
    "$apps = foreach($p in $paths){",
    "  try { Get-ItemProperty $p -ErrorAction SilentlyContinue |",
    "    Where-Object { $_.DisplayName -and -not $_.SystemComponent -and -not $_.ParentKeyName } |",
    "    Select-Object DisplayName,DisplayVersion,Publisher,InstallDate,EstimatedSize,InstallLocation } catch {}",
    "}",
    "$apps | Sort-Object DisplayName -Unique | ConvertTo-Json -Depth 3 -Compress",
  ].join(" ");
  return await new Promise((resolve) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
      windowsHide: true,
    });
    let out = "", err = "";
    child.stdout.on("data", (b) => { out += b.toString(); });
    child.stderr.on("data", (b) => { err += b.toString(); });
    child.on("close", () => {
      try {
        const trimmed = out.trim();
        if (!trimmed) return resolve({ ok: true, data: [] });
        const parsed = JSON.parse(trimmed);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        const data = arr.map((a) => ({
          name: a.DisplayName,
          version: a.DisplayVersion || null,
          publisher: a.Publisher || null,
          installDate: a.InstallDate || null,
          sizeKb: typeof a.EstimatedSize === "number" ? a.EstimatedSize : null,
          location: a.InstallLocation || null,
        })).filter((a) => a.name);
        resolve({ ok: true, data });
      } catch (e) {
        resolve({ ok: false, error: err || e?.message || "Kunne ikke læse programmer" });
      }
    });
  });
});

// ─────────────────────────────────────────────────────────────
// M1 · Windows system info — BIOS, TPM, Secure Boot, admin, build
// ─────────────────────────────────────────────────────────────
function runPowerShell(script, timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (process.platform !== "win32") return resolve({ ok: false, error: "Kun Windows" });
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: true },
    );
    let out = "", err = "", done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    const t = setTimeout(() => { try { child.kill(); } catch {} finish({ ok: false, error: "Timeout" }); }, timeoutMs);
    child.stdout.on("data", (b) => { out += b.toString(); });
    child.stderr.on("data", (b) => { err += b.toString(); });
    child.on("close", () => {
      clearTimeout(t);
      const trimmed = out.trim();
      if (!trimmed) return finish({ ok: false, error: err.trim() || "Tomt svar" });
      try { finish({ ok: true, data: JSON.parse(trimmed) }); }
      catch (e) { finish({ ok: false, error: e.message + " | " + trimmed.slice(0, 200) }); }
    });
    child.on("error", (e) => { clearTimeout(t); finish({ ok: false, error: e.message }); });
  });
}

let sysInfoCache = null;
let sysInfoCacheAt = 0;

const SYS_INFO_PS = [
  "$ErrorActionPreference='SilentlyContinue'",
  "$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)",
  "$bios = Get-CimInstance -ClassName Win32_BIOS | Select-Object -First 1 SMBIOSBIOSVersion,Manufacturer,ReleaseDate,SerialNumber",
  "$cs = Get-CimInstance Win32_ComputerSystem | Select-Object -First 1 Manufacturer,Model,SystemFamily,TotalPhysicalMemory",
  "$osi = Get-CimInstance Win32_OperatingSystem | Select-Object -First 1 Caption,Version,BuildNumber,OSArchitecture,InstallDate,LastBootUpTime,RegisteredUser",
  "$baseboard = Get-CimInstance Win32_BaseBoard | Select-Object -First 1 Manufacturer,Product,Version",
  "try { $sb = if ($isAdmin) { Confirm-SecureBootUEFI } else { $null } } catch { $sb = $null }",
  "try { $tpm = Get-Tpm | Select-Object TpmPresent,TpmReady,TpmEnabled_InitialValue,ManufacturerIdTxt,ManufacturerVersion } catch { $tpm = $null }",
  "$defender = try { Get-MpComputerStatus | Select-Object AntivirusEnabled,RealTimeProtectionEnabled,AMEngineVersion,QuickScanStartTime,FullScanStartTime } catch { $null }",
  "[PSCustomObject]@{ admin=$isAdmin; bios=$bios; cs=$cs; os=$osi; board=$baseboard; secureBoot=$sb; tpm=$tpm; defender=$defender } | ConvertTo-Json -Depth 4 -Compress",
].join("; ");

ipcMain.handle("sys:info", async (_e, opts) => {
  const force = !!(opts && opts.force);
  if (!force && sysInfoCache && Date.now() - sysInfoCacheAt < 30_000) {
    return { ok: true, data: sysInfoCache, cached: true };
  }
  const r = await runPowerShell(SYS_INFO_PS, 12_000);
  if (!r.ok) return r;
  const d = r.data || {};
  // Normalisér til et fladt shape renderer'en kan bruge direkte.
  const parseWmiDate = (s) => {
    // WMI-datoer kommer som "/Date(1673827200000)/"
    if (!s) return null;
    const m = /\/Date\((\d+)\)/.exec(String(s));
    return m ? Number(m[1]) : null;
  };
  const normalised = {
    admin: !!d.admin,
    bios: d.bios ? {
      version: d.bios.SMBIOSBIOSVersion || null,
      vendor: d.bios.Manufacturer || null,
      releaseDate: parseWmiDate(d.bios.ReleaseDate),
      serial: d.bios.SerialNumber || null,
    } : null,
    system: d.cs ? {
      manufacturer: d.cs.Manufacturer || null,
      model: d.cs.Model || null,
      family: d.cs.SystemFamily || null,
    } : null,
    board: d.board ? {
      manufacturer: d.board.Manufacturer || null,
      product: d.board.Product || null,
      version: d.board.Version || null,
    } : null,
    os: d.os ? {
      caption: d.os.Caption || null,
      version: d.os.Version || null,
      build: d.os.BuildNumber ? String(d.os.BuildNumber) : null,
      arch: d.os.OSArchitecture || null,
      installDate: parseWmiDate(d.os.InstallDate),
      lastBoot: parseWmiDate(d.os.LastBootUpTime),
      registeredUser: d.os.RegisteredUser || null,
    } : null,
    secureBoot: d.secureBoot === null || d.secureBoot === undefined
      ? (d.admin ? "off" : "unknown")
      : (d.secureBoot ? "on" : "off"),
    tpm: d.tpm ? {
      present: !!d.tpm.TpmPresent,
      ready: !!d.tpm.TpmReady,
      enabled: !!d.tpm.TpmEnabled_InitialValue,
      manufacturer: d.tpm.ManufacturerIdTxt || null,
      version: d.tpm.ManufacturerVersion || null,
    } : null,
    defender: d.defender ? {
      antivirusEnabled: !!d.defender.AntivirusEnabled,
      realtimeEnabled: !!d.defender.RealTimeProtectionEnabled,
      engineVersion: d.defender.AMEngineVersion || null,
      lastQuickScan: parseWmiDate(d.defender.QuickScanStartTime),
      lastFullScan: parseWmiDate(d.defender.FullScanStartTime),
    } : null,
  };
  sysInfoCache = normalised;
  sysInfoCacheAt = Date.now();
  return { ok: true, data: normalised, cached: false };
});

// ─────────────────────────────────────────────────────────────
// M1 · Ping + jitter (System.Net.NetworkInformation.Ping)
// ─────────────────────────────────────────────────────────────
const PING_PS = (target, count) => [
  "$ErrorActionPreference='SilentlyContinue'",
  "$p = New-Object System.Net.NetworkInformation.Ping",
  "$times=@()",
  `for ($i=0; $i -lt ${count}; $i++) {`,
  `  try { $r = $p.Send('${target.replace(/'/g, "''")}', 1200); if ($r.Status -eq 'Success') { $times += [double]$r.RoundtripTime } } catch {}`,
  "  Start-Sleep -Milliseconds 120",
  "}",
  "if ($times.Count -gt 0) {",
  "  $avg = ($times | Measure-Object -Average).Average",
  "  $min = ($times | Measure-Object -Minimum).Minimum",
  "  $max = ($times | Measure-Object -Maximum).Maximum",
  "  $sq  = $times | ForEach-Object { ($_ - $avg) * ($_ - $avg) }",
  "  $var = if ($sq.Count -gt 0) { ($sq | Measure-Object -Average).Average } else { 0 }",
  "  $jit = [Math]::Sqrt($var)",
  `  [PSCustomObject]@{ target='${target}'; count=$times.Count; sent=${count}; avg=$avg; min=$min; max=$max; jitter=$jit; loss=(${count}-$times.Count)/${count} } | ConvertTo-Json -Compress`,
  "} else {",
  `  [PSCustomObject]@{ target='${target}'; count=0; sent=${count}; avg=$null; min=$null; max=$null; jitter=$null; loss=1 } | ConvertTo-Json -Compress`,
  "}",
].join("; ");

ipcMain.handle("sys:ping", async (_e, opts) => {
  const target = (opts && opts.target) || "1.1.1.1";
  const count = Math.max(2, Math.min(10, (opts && opts.count) || 5));
  const r = await runPowerShell(PING_PS(target, count), 5000 + count * 1400);
  return r;
});

// ─────────────────────────────────────────────────────────────
// M1 · Persistent state — lastScan, lastOptimize, issues, score
// ─────────────────────────────────────────────────────────────
function stateFile() { return path.join(app.getPath("userData"), "state.json"); }

async function readState() {
  try { return JSON.parse(await fsp.readFile(stateFile(), "utf8")); }
  catch { return {}; }
}
async function writeState(patch) {
  const cur = await readState();
  const next = { ...cur, ...patch };
  try { await fsp.writeFile(stateFile(), JSON.stringify(next, null, 2), "utf8"); } catch {}
  return next;
}

ipcMain.handle("state:read", async () => {
  try { return { ok: true, data: await readState() }; }
  catch (err) { return { ok: false, error: err?.message || String(err) }; }
});

ipcMain.handle("state:setLastScan", async (_e, payload) => {
  const next = await writeState({
    lastScan: { ts: Date.now(), issues: (payload && payload.issues) ?? null, score: (payload && payload.score) ?? null },
  });
  return { ok: true, data: next };
});

ipcMain.handle("state:setLastOptimize", async (_e, payload) => {
  const next = await writeState({
    lastOptimize: { ts: Date.now(), label: (payload && payload.label) || "Optimering", detail: (payload && payload.detail) || null },
  });
  return { ok: true, data: next };
});

// ─────────────────────────────────────────────────────────────
// M1 · Relaunch as admin (single UAC-prompt → hele appen elevated)
// ─────────────────────────────────────────────────────────────
ipcMain.handle("app:isElevated", async () => {
  if (process.platform !== "win32") return { ok: true, elevated: false };
  const r = await runPowerShell(
    "([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) | ConvertTo-Json -Compress",
    3000,
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, elevated: !!r.data };
});

ipcMain.handle("app:relaunchAsAdmin", async () => {
  if (process.platform !== "win32") return { ok: false, error: "Kun Windows" };
  try {
    const exe = process.execPath.replace(/'/g, "''");
    const ps = `Start-Process -FilePath '${exe}' -Verb RunAs`;
    const child = spawn("powershell.exe", ["-NoProfile", "-Command", ps], {
      windowsHide: true, detached: true, stdio: "ignore",
    });
    child.unref();
    setTimeout(() => { try { app.quit(); } catch {} }, 500);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

// ═════════════════════════════════════════════════════════════
// M2 · Intelligent System Scan
// Aggregerer 9 kategorier med rigtig størrelse + Fix-handling.
// Hver subscan er isoleret: en fejl i én kategori afbryder ikke resten.
// ═════════════════════════════════════════════════════════════

// ---------- Browser-cache stier (Windows) ----------
function browserCachePaths() {
  const local = process.env.LOCALAPPDATA;
  const roaming = process.env.APPDATA;
  const out = [];
  if (local) {
    out.push({ browser: "Chrome",  path: path.join(local, "Google", "Chrome", "User Data", "Default", "Cache") });
    out.push({ browser: "Edge",    path: path.join(local, "Microsoft", "Edge", "User Data", "Default", "Cache") });
    out.push({ browser: "Brave",   path: path.join(local, "BraveSoftware", "Brave-Browser", "User Data", "Default", "Cache") });
    out.push({ browser: "Opera",   path: path.join(local, "Opera Software", "Opera Stable", "Cache") });
  }
  if (roaming) {
    // Firefox har profil-mapper — vi udvider dem separat
    out.push({ browser: "Firefox", path: path.join(roaming, "Mozilla", "Firefox", "Profiles"), isFirefox: true });
  }
  return out;
}

async function firefoxCacheDirs(profilesDir) {
  try {
    const entries = await fsp.readdir(profilesDir, { withFileTypes: true });
    const dirs = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const c2 = path.join(profilesDir, e.name, "cache2");
      try { const st = await fsp.stat(c2); if (st.isDirectory()) dirs.push(c2); } catch {}
    }
    return dirs;
  } catch { return []; }
}

// ---------- Sub-scans ----------
async function scanTemp() {
  const folders = tempFolders();
  const results = await Promise.all(folders.map(async (f) => {
    const s = await dirSize(f);
    return { path: f, bytes: s.total, files: s.files };
  }));
  const bytes = results.reduce((a, b) => a + b.bytes, 0);
  const files = results.reduce((a, b) => a + b.files, 0);
  return {
    id: "temp",
    label: "Midlertidige filer",
    detail: `${files.toLocaleString("da-DK")} filer i ${results.length} mapper`,
    bytes,
    severity: bytes > 2e9 ? "warn" : bytes > 5e8 ? "notice" : "ok",
    fix: bytes > 0 ? { id: "temp", label: "Slet midlertidige filer" } : null,
    items: results,
  };
}

async function scanRecycleBin() {
  const r = await runPowerShell(
    "$s=(New-Object -ComObject Shell.Application).NameSpace(0xA); $items=@($s.Items()); $b=0; foreach($i in $items){ $b += $i.Size }; [PSCustomObject]@{count=$items.Count; bytes=$b} | ConvertTo-Json -Compress",
    6000,
  );
  if (!r.ok) return { id: "recyclebin", label: "Papirkurv", detail: "Kunne ikke læse", bytes: 0, severity: "unknown", fix: null, error: r.error };
  const d = r.data || {};
  return {
    id: "recyclebin",
    label: "Papirkurv",
    detail: `${d.count || 0} elementer`,
    bytes: Number(d.bytes) || 0,
    severity: (d.bytes || 0) > 1e9 ? "notice" : "ok",
    fix: (d.count || 0) > 0 ? { id: "recyclebin", label: "Tøm papirkurv" } : null,
  };
}

async function scanWindowsUpdateCache() {
  const dir = path.join(process.env.SystemRoot || "C:\\Windows", "SoftwareDistribution", "Download");
  const s = await dirSize(dir);
  return {
    id: "wucache",
    label: "Windows Update-cache",
    detail: `${s.files.toLocaleString("da-DK")} filer`,
    bytes: s.total,
    severity: s.total > 2e9 ? "notice" : "ok",
    fix: s.total > 0 ? { id: "wucache", label: "Ryd WU-cache (admin)", admin: true } : null,
  };
}

async function scanBrowserCaches() {
  const bases = browserCachePaths();
  const perBrowser = [];
  for (const b of bases) {
    if (b.isFirefox) {
      const dirs = await firefoxCacheDirs(b.path);
      let bytes = 0, files = 0;
      for (const d of dirs) { const s = await dirSize(d); bytes += s.total; files += s.files; }
      perBrowser.push({ browser: b.browser, bytes, files, paths: dirs });
    } else {
      try { await fsp.stat(b.path); } catch { continue; }
      const s = await dirSize(b.path);
      perBrowser.push({ browser: b.browser, bytes: s.total, files: s.files, paths: [b.path] });
    }
  }
  const bytes = perBrowser.reduce((a, b) => a + b.bytes, 0);
  return {
    id: "browsercache",
    label: "Browser-cache",
    detail: perBrowser.length ? perBrowser.map((b) => b.browser).join(" · ") : "Ingen browsere fundet",
    bytes,
    severity: bytes > 1e9 ? "notice" : "ok",
    fix: bytes > 0 ? { id: "browsercache", label: "Slet browser-cache" } : null,
    items: perBrowser,
  };
}

async function scanStartup() {
  const r = await runPowerShell(
    "Get-CimInstance Win32_StartupCommand | Select-Object Name,Command,Location,User | ConvertTo-Json -Compress",
    6000,
  );
  if (!r.ok) return { id: "startup", label: "Opstartsprogrammer", detail: "Kunne ikke læse", bytes: 0, severity: "unknown", fix: null, error: r.error };
  const arr = Array.isArray(r.data) ? r.data : r.data ? [r.data] : [];
  return {
    id: "startup",
    label: "Opstartsprogrammer",
    detail: `${arr.length} programmer starter med Windows`,
    bytes: 0,
    severity: arr.length > 15 ? "notice" : "ok",
    fix: { id: "startup", label: "Åbn Task Manager" },
    items: arr.map((a) => ({ name: a.Name, command: a.Command, location: a.Location, user: a.User })),
  };
}

async function scanServices() {
  const r = await runPowerShell(
    "Get-Service | Where-Object { $_.StartType -eq 'Automatic' -and $_.Status -ne 'Running' } | Select-Object Name,DisplayName,Status,StartType | ConvertTo-Json -Compress",
    6000,
  );
  if (!r.ok) return { id: "services", label: "Tjenester", detail: "Kunne ikke læse", bytes: 0, severity: "unknown", fix: null, error: r.error };
  const arr = Array.isArray(r.data) ? r.data : r.data ? [r.data] : [];
  return {
    id: "services",
    label: "Tjenester (automatiske men stoppede)",
    detail: `${arr.length} tjenester`,
    bytes: 0,
    severity: arr.length > 5 ? "notice" : "ok",
    fix: { id: "services", label: "Åbn services.msc" },
    items: arr.map((a) => ({ name: a.Name, displayName: a.DisplayName, status: a.Status, startType: a.StartType })),
  };
}

async function scanScheduledTasks() {
  const r = await runPowerShell(
    "Get-ScheduledTask | Where-Object { $_.State -eq 'Ready' -and $_.TaskPath -notlike '\\Microsoft\\*' } | Select-Object TaskName,TaskPath,State,Author | ConvertTo-Json -Compress",
    8000,
  );
  if (!r.ok) return { id: "tasks", label: "Planlagte opgaver", detail: "Kunne ikke læse", bytes: 0, severity: "unknown", fix: null, error: r.error };
  const arr = Array.isArray(r.data) ? r.data : r.data ? [r.data] : [];
  return {
    id: "tasks",
    label: "Planlagte opgaver (tredjeparts)",
    detail: `${arr.length} opgaver`,
    bytes: 0,
    severity: arr.length > 20 ? "notice" : "ok",
    fix: { id: "tasks", label: "Åbn taskschd.msc" },
    items: arr,
  };
}

async function scanLargeFiles() {
  const home = os.homedir().replace(/'/g, "''");
  const r = await runPowerShell(
    `Get-ChildItem -LiteralPath '${home}' -Recurse -File -Force -ErrorAction SilentlyContinue | Where-Object { $_.Length -gt 524288000 } | Sort-Object Length -Descending | Select-Object -First 20 FullName,Length,LastWriteTime | ConvertTo-Json -Compress`,
    30000,
  );
  if (!r.ok) return { id: "largefiles", label: "Store filer (>500 MB)", detail: "Kunne ikke scanne", bytes: 0, severity: "unknown", fix: null, error: r.error };
  const arr = Array.isArray(r.data) ? r.data : r.data ? [r.data] : [];
  const bytes = arr.reduce((a, b) => a + (Number(b.Length) || 0), 0);
  return {
    id: "largefiles",
    label: "Store filer i din brugermappe",
    detail: `Top ${arr.length} filer over 500 MB`,
    bytes,
    severity: arr.length > 10 ? "notice" : "ok",
    fix: null,
    items: arr.map((a) => ({ path: a.FullName, bytes: Number(a.Length) || 0, mtime: a.LastWriteTime })),
  };
}

async function scanSmart() {
  const r = await runPowerShell(
    "Get-PhysicalDisk | Select-Object FriendlyName,MediaType,HealthStatus,OperationalStatus,Size,BusType | ConvertTo-Json -Compress",
    6000,
  );
  if (!r.ok) return { id: "smart", label: "SMART-diskstatus", detail: "Kunne ikke læse", bytes: 0, severity: "unknown", fix: null, error: r.error };
  const arr = Array.isArray(r.data) ? r.data : r.data ? [r.data] : [];
  const bad = arr.filter((d) => d.HealthStatus && d.HealthStatus !== "Healthy");
  return {
    id: "smart",
    label: "SMART-diskstatus",
    detail: arr.length ? arr.map((d) => `${d.FriendlyName}: ${d.HealthStatus}`).join(" · ") : "Ingen diske fundet",
    bytes: 0,
    severity: bad.length > 0 ? "warn" : "ok",
    fix: null,
    items: arr.map((d) => ({
      name: d.FriendlyName, mediaType: d.MediaType, health: d.HealthStatus,
      status: d.OperationalStatus, bytes: Number(d.Size) || 0, bus: d.BusType,
    })),
  };
}

// ---------- Aggregator ----------
ipcMain.handle("scan:full", async () => {
  if (process.platform !== "win32") {
    return { ok: false, error: "M2 System Scan er kun tilgængelig på Windows" };
  }
  const started = Date.now();
  const results = await Promise.all([
    scanTemp().catch((e) => ({ id: "temp", label: "Midlertidige filer", error: e?.message || String(e), bytes: 0, severity: "unknown", fix: null })),
    scanRecycleBin().catch((e) => ({ id: "recyclebin", label: "Papirkurv", error: e?.message || String(e), bytes: 0, severity: "unknown", fix: null })),
    scanWindowsUpdateCache().catch((e) => ({ id: "wucache", label: "Windows Update-cache", error: e?.message || String(e), bytes: 0, severity: "unknown", fix: null })),
    scanBrowserCaches().catch((e) => ({ id: "browsercache", label: "Browser-cache", error: e?.message || String(e), bytes: 0, severity: "unknown", fix: null })),
    scanStartup().catch((e) => ({ id: "startup", label: "Opstartsprogrammer", error: e?.message || String(e), bytes: 0, severity: "unknown", fix: null })),
    scanServices().catch((e) => ({ id: "services", label: "Tjenester", error: e?.message || String(e), bytes: 0, severity: "unknown", fix: null })),
    scanScheduledTasks().catch((e) => ({ id: "tasks", label: "Planlagte opgaver", error: e?.message || String(e), bytes: 0, severity: "unknown", fix: null })),
    scanLargeFiles().catch((e) => ({ id: "largefiles", label: "Store filer", error: e?.message || String(e), bytes: 0, severity: "unknown", fix: null })),
    scanSmart().catch((e) => ({ id: "smart", label: "SMART-diskstatus", error: e?.message || String(e), bytes: 0, severity: "unknown", fix: null })),
  ]);
  const totalReclaimable = results
    .filter((r) => r.fix && (r.bytes || 0) > 0)
    .reduce((a, b) => a + (b.bytes || 0), 0);
  return {
    ok: true,
    data: {
      ts: started,
      durationMs: Date.now() - started,
      totalReclaimable,
      categories: results,
    },
  };
});

// ---------- Fix-handlinger ----------
async function fixRecycleBin() {
  const r = await runPowerShell("Clear-RecycleBin -Force -ErrorAction Stop; [PSCustomObject]@{ok=$true} | ConvertTo-Json -Compress", 15000);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

async function fixWuCache() {
  const script = [
    "Stop-Service -Name wuauserv -Force -ErrorAction SilentlyContinue",
    "Stop-Service -Name bits -Force -ErrorAction SilentlyContinue",
    "Remove-Item -Path 'C:\\Windows\\SoftwareDistribution\\Download\\*' -Recurse -Force -ErrorAction SilentlyContinue",
    "Start-Service -Name bits -ErrorAction SilentlyContinue",
    "Start-Service -Name wuauserv -ErrorAction SilentlyContinue",
    "[PSCustomObject]@{ok=$true} | ConvertTo-Json -Compress",
  ].join("; ");
  const r = await runPowerShell(script, 30000);
  return r.ok ? { ok: true } : { ok: false, error: r.error, requiresAdmin: true };
}

async function fixBrowserCaches() {
  const bases = browserCachePaths();
  let freed = 0, removed = 0, skipped = 0;
  for (const b of bases) {
    if (b.isFirefox) {
      const dirs = await firefoxCacheDirs(b.path);
      for (const d of dirs) { const s = await cleanDir(d); freed += s.freed; removed += s.removed; skipped += s.skipped; }
    } else {
      try { await fsp.stat(b.path); } catch { continue; }
      const s = await cleanDir(b.path);
      freed += s.freed; removed += s.removed; skipped += s.skipped;
    }
  }
  return { ok: true, freed, removed, skipped };
}

ipcMain.handle("scan:fix", async (_e, fixId) => {
  if (process.platform !== "win32") return { ok: false, error: "Kun Windows" };
  try {
    switch (fixId) {
      case "temp": {
        const target = process.env.TEMP;
        if (!target) return { ok: false, error: "Ingen TEMP-mappe" };
        const r = await cleanDir(target);
        return { ok: true, data: { path: target, ...r } };
      }
      case "recyclebin":   return await fixRecycleBin();
      case "wucache":      return await fixWuCache();
      case "browsercache": return { ok: true, data: await fixBrowserCaches() };
      case "startup":      await shell.openExternal("ms-settings:startupapps"); return { ok: true, opened: true };
      case "services":     { const child = spawn("services.msc", [], { shell: true, detached: true, stdio: "ignore" }); child.unref(); return { ok: true, opened: true }; }
      case "tasks":        { const child = spawn("taskschd.msc", [], { shell: true, detached: true, stdio: "ignore" }); child.unref(); return { ok: true, opened: true }; }
      default: return { ok: false, error: "Ukendt fix-id" };
    }
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

