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

// ═════════════════════════════════════════════════════════════
// M3 · Repair Center
// Rigtige Windows-reparations-kommandoer med live-log streaming,
// admin-check, valgfrit systemgendannelsespunkt og cancel-support.
// ═════════════════════════════════════════════════════════════

const REPAIR2_ACTIONS = {
  sfc: {
    label: "SFC /scannow", admin: true, cancelable: true, restoreOffered: true,
    description: "Verificerer og reparerer beskyttede Windows-systemfiler.",
    exec: () => ({ exe: "sfc.exe", args: ["/scannow"] }),
  },
  "dism-check": {
    label: "DISM · CheckHealth", admin: true, cancelable: true,
    description: "Hurtig kontrol af Windows-image (ingen ændringer).",
    exec: () => ({ exe: "dism.exe", args: ["/Online", "/Cleanup-Image", "/CheckHealth"] }),
  },
  "dism-scan": {
    label: "DISM · ScanHealth", admin: true, cancelable: true,
    description: "Grundig scanning af Windows-image (tager længere tid).",
    exec: () => ({ exe: "dism.exe", args: ["/Online", "/Cleanup-Image", "/ScanHealth"] }),
  },
  "dism-restore": {
    label: "DISM · RestoreHealth", admin: true, cancelable: true, restoreOffered: true,
    description: "Reparerer Windows-image via Windows Update-komponenter.",
    exec: () => ({ exe: "dism.exe", args: ["/Online", "/Cleanup-Image", "/RestoreHealth"] }),
  },
  flushdns: {
    label: "Flush DNS", admin: false, cancelable: false,
    description: "Rydder DNS-resolver-cachen (ipconfig /flushdns).",
    exec: () => ({ exe: "ipconfig.exe", args: ["/flushdns"] }),
  },
  "winsock-reset": {
    label: "Winsock Reset", admin: true, cancelable: false, restoreOffered: true, needsReboot: true,
    description: "Nulstiller Winsock-kataloget. Kræver genstart.",
    exec: () => ({ exe: "netsh.exe", args: ["winsock", "reset"] }),
  },
  "ip-reset": {
    label: "IP Reset", admin: true, cancelable: false, restoreOffered: true, needsReboot: true,
    description: "Nulstiller TCP/IP-stakken (netsh int ip reset). Kræver genstart.",
    exec: () => ({ exe: "netsh.exe", args: ["int", "ip", "reset"] }),
  },
  "wu-reset": {
    label: "Windows Update Reset", admin: true, cancelable: false, restoreOffered: true,
    description: "Stopper WU-services, rydder SoftwareDistribution + catroot2, starter services igen.",
    exec: () => {
      const script = [
        "Write-Output '-> Stopper Windows Update services...'",
        "Stop-Service -Name wuauserv,cryptSvc,bits,msiserver -Force -ErrorAction SilentlyContinue",
        "Write-Output '-> Omdoeber SoftwareDistribution + catroot2...'",
        "$stamp = Get-Date -Format yyyyMMddHHmmss",
        "Rename-Item -Path (Join-Path $env:SystemRoot 'SoftwareDistribution') -NewName (\"SoftwareDistribution.old.$stamp\") -Force -ErrorAction SilentlyContinue",
        "Rename-Item -Path (Join-Path $env:SystemRoot 'System32\\catroot2') -NewName (\"catroot2.old.$stamp\") -Force -ErrorAction SilentlyContinue",
        "Write-Output '-> Starter services igen...'",
        "Start-Service -Name wuauserv,cryptSvc,bits,msiserver -ErrorAction SilentlyContinue",
        "Write-Output 'OK - Windows Update-komponenter nulstillet.'",
      ].join("; ");
      return { exe: "powershell.exe", args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script] };
    },
  },
  wsreset: {
    label: "Microsoft Store Reset", admin: false, cancelable: false,
    description: "Nulstiller Microsoft Store-cache (wsreset.exe).",
    exec: () => ({ exe: "wsreset.exe", args: [] }),
  },
  "explorer-restart": {
    label: "Genstart Explorer", admin: false, cancelable: false,
    description: "Genstarter Windows Stifinder og proceslinjen.",
    exec: () => {
      const script = "taskkill /f /im explorer.exe | Out-Null; Start-Sleep -Milliseconds 500; Start-Process explorer.exe; Write-Output 'Explorer genstartet.'";
      return { exe: "powershell.exe", args: ["-NoProfile", "-Command", script] };
    },
  },
  "spooler-restart": {
    label: "Print Spooler Restart", admin: true, cancelable: false,
    description: "Stopper og starter Print Spooler (Spooler) tjenesten.",
    exec: () => {
      const script = "Stop-Service -Name Spooler -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 400; Start-Service -Name Spooler; Write-Output ('Spooler status: ' + (Get-Service Spooler).Status)";
      return { exe: "powershell.exe", args: ["-NoProfile", "-Command", script] };
    },
  },
  "iconcache-rebuild": {
    label: "Genopbyg ikon-cache", admin: false, cancelable: false,
    description: "Sletter ikon- og miniature-cache og genstarter Explorer.",
    exec: () => {
      const script = [
        "taskkill /f /im explorer.exe 2>$null | Out-Null",
        "Start-Sleep -Milliseconds 400",
        "$targets = @((Join-Path $env:LOCALAPPDATA 'IconCache.db'), (Join-Path $env:LOCALAPPDATA 'Microsoft\\Windows\\Explorer\\iconcache_*.db'), (Join-Path $env:LOCALAPPDATA 'Microsoft\\Windows\\Explorer\\thumbcache_*.db'))",
        "foreach ($t in $targets) { Get-ChildItem -Path $t -Force -ErrorAction SilentlyContinue | ForEach-Object { Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue; Write-Output ('Slettet: ' + $_.FullName) } }",
        "Start-Process explorer.exe",
        "Write-Output 'Ikon-cache genopbygget.'",
      ].join("; ");
      return { exe: "powershell.exe", args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script] };
    },
  },
  "network-repair": {
    label: "Netværksreparation", admin: true, cancelable: false,
    description: "ipconfig /release + /renew + /flushdns og ARP-cache nulstilling.",
    exec: () => {
      const script = "ipconfig /release; ipconfig /renew; ipconfig /flushdns; arp -d *; Write-Output 'Netvaerks-reset udfoert.'";
      return { exe: "powershell.exe", args: ["-NoProfile", "-Command", script] };
    },
  },
};

const activeRepairJobs = new Map(); // jobId -> child process

function repairJobId() {
  return "job_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
}

function emitRepair(win, jobId, kind, payload) {
  if (!win || win.isDestroyed()) return;
  try { win.webContents.send("repair2:event", { jobId, kind, ts: Date.now(), ...(payload || {}) }); } catch {}
}

function streamRepair(win, jobId, exe, args) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(exe, args, { windowsHide: true });
    } catch (e) {
      emitRepair(win, jobId, "log", { level: "err", line: `Kunne ikke starte ${exe}: ${e.message}` });
      return resolve({ code: -1, error: e.message });
    }
    activeRepairJobs.set(jobId, child);

    let outBuf = "", errBuf = "";
    const flushLine = (buf, level) => {
      const parts = buf.split(/\r\n|\n|\r/);
      const rest = parts.pop();
      for (const p of parts) {
        const s = p.replace(/\x00/g, "").trim();
        if (s) emitRepair(win, jobId, "log", { level, line: s });
      }
      return rest;
    };
    child.stdout.on("data", (b) => { outBuf = flushLine(outBuf + b.toString("utf8"), "out"); });
    child.stderr.on("data", (b) => { errBuf = flushLine(errBuf + b.toString("utf8"), "err"); });
    child.on("error", (e) => {
      emitRepair(win, jobId, "log", { level: "err", line: e.message });
      activeRepairJobs.delete(jobId);
      resolve({ code: -1, error: e.message });
    });
    child.on("close", (code, signal) => {
      if (outBuf.trim()) emitRepair(win, jobId, "log", { level: "out", line: outBuf.trim() });
      if (errBuf.trim()) emitRepair(win, jobId, "log", { level: "err", line: errBuf.trim() });
      activeRepairJobs.delete(jobId);
      resolve({ code: code == null ? -1 : code, signal });
    });
  });
}

async function isProcessElevated() {
  const r = await runPowerShell(
    "([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) | ConvertTo-Json -Compress",
    4000,
  );
  return r.ok && !!r.data;
}

async function createRestorePoint(win, jobId, description) {
  emitRepair(win, jobId, "log", { level: "info", line: `-> Opretter systemgendannelsespunkt: "${description}"` });
  const script = [
    "$ErrorActionPreference='Stop'",
    "try {",
    "  Enable-ComputerRestore -Drive 'C:\\' -ErrorAction SilentlyContinue | Out-Null",
    `  Checkpoint-Computer -Description '${description.replace(/'/g, "''")}' -RestorePointType 'MODIFY_SETTINGS'`,
    "  Write-Output 'RESTORE_OK'",
    "} catch { Write-Output ('RESTORE_FAIL: ' + $_.Exception.Message) }",
  ].join("; ");
  return streamRepair(win, jobId, "powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script]);
}

ipcMain.handle("repair2:list", async () => ({
  ok: true,
  actions: Object.entries(REPAIR2_ACTIONS).map(([id, a]) => ({
    id, label: a.label, description: a.description,
    admin: !!a.admin, cancelable: !!a.cancelable,
    restoreOffered: !!a.restoreOffered, needsReboot: !!a.needsReboot,
  })),
}));

ipcMain.handle("repair2:elevated", async () => {
  if (process.platform !== "win32") return { ok: true, elevated: false };
  return { ok: true, elevated: await isProcessElevated() };
});

ipcMain.handle("repair2:run", async (e, payload) => {
  if (process.platform !== "win32") return { ok: false, error: "Kun tilgængelig på Windows" };
  const { actionId, createRestorePoint: doRestore } = payload || {};
  const action = REPAIR2_ACTIONS[actionId];
  if (!action) return { ok: false, error: "Ukendt handling" };

  if (action.admin) {
    const elevated = await isProcessElevated();
    if (!elevated) return { ok: false, needsElevation: true, error: "Kræver administrator. Genstart NOVYX som admin i Indstillinger." };
  }

  const win = BrowserWindow.fromWebContents(e.sender) || mainWindow;
  const jobId = repairJobId();

  (async () => {
    emitRepair(win, jobId, "started", { actionId, label: action.label, admin: !!action.admin, needsReboot: !!action.needsReboot });
    try {
      if (action.restoreOffered && doRestore) {
        const rp = await createRestorePoint(win, jobId, `NOVYX før ${action.label}`);
        if (rp.code !== 0) {
          emitRepair(win, jobId, "log", { level: "warn", line: "Systemgendannelsespunkt kunne ikke oprettes — fortsætter uden." });
        }
      }
      const { exe, args } = action.exec();
      emitRepair(win, jobId, "log", { level: "info", line: `-> ${exe} ${args.join(" ")}` });
      const res = await streamRepair(win, jobId, exe, args);
      if (res.signal === "SIGTERM" || res.signal === "SIGKILL") {
        emitRepair(win, jobId, "done", { code: res.code, cancelled: true, needsReboot: false });
      } else {
        emitRepair(win, jobId, "done", { code: res.code, needsReboot: !!action.needsReboot, error: res.error || null });
      }
    } catch (err) {
      emitRepair(win, jobId, "done", { code: -1, error: err?.message || String(err) });
    }
  })();

  return { ok: true, jobId };
});

ipcMain.handle("repair2:cancel", async (_e, jobId) => {
  const child = activeRepairJobs.get(jobId);
  if (!child) return { ok: false, error: "Job kører ikke længere" };
  try { child.kill(); } catch {}
  return { ok: true };
});

// ═════════════════════════════════════════════════════════════
// M4 · Game Boost Center
// Rigtig registry-analyse, Safe/Advanced tweaks, backup + restore,
// per-spil high-perf GPU + fullscreen-optimering. Ingen mock-data.
// ═════════════════════════════════════════════════════════════

function boostBackupDir() {
  const d = path.join(app.getPath("userData"), "game-boost-backups");
  try { fs.mkdirSync(d, { recursive: true }); } catch {}
  return d;
}

const BOOST_ANALYZE_PS = String.raw`
$ErrorActionPreference='SilentlyContinue'
function Get-Val($path,$name){
  try { (Get-ItemProperty -Path $path -Name $name -ErrorAction Stop).$name } catch { $null }
}
$gameMode      = Get-Val 'HKCU:\Software\Microsoft\GameBar' 'AutoGameModeEnabled'
$gameBarShow   = Get-Val 'HKCU:\Software\Microsoft\GameBar' 'ShowStartupPanel'
$hags          = Get-Val 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'HwSchMode'
$mmcssResp     = Get-Val 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile' 'SystemResponsiveness'
$gamesGpuPri   = Get-Val 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' 'GPU Priority'
$gamesPri      = Get-Val 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' 'Priority'
$fseBehavior   = Get-Val 'HKCU:\System\GameConfigStore' 'GameDVR_FSEBehaviorMode'
$active = (powercfg /getactivescheme) 2>$null
$activeGuid = $null; $activeName = $null
if ($active -match 'GUID: ([0-9a-fA-F-]+)\s+\((.+)\)') { $activeGuid = $matches[1]; $activeName = $matches[2] }
$schemes = @()
$list = (powercfg /list) 2>$null
foreach ($ln in $list) {
  if ($ln -match 'GUID: ([0-9a-fA-F-]+)\s+\((.+)\)') { $schemes += [PSCustomObject]@{ guid=$matches[1]; name=$matches[2] } }
}
$nagleCount = 0; $nagleTotal = 0
try {
  Get-ChildItem 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces' -ErrorAction SilentlyContinue | ForEach-Object {
    $nagleTotal++
    $ack = (Get-ItemProperty -Path $_.PSPath -Name 'TcpAckFrequency' -ErrorAction SilentlyContinue).TcpAckFrequency
    if ($ack -eq 1) { $nagleCount++ }
  }
} catch {}
[PSCustomObject]@{
  gameMode=$gameMode; gameBarPanel=$gameBarShow; hags=$hags; mmcssResp=$mmcssResp
  gamesGpuPri=$gamesGpuPri; gamesPri=$gamesPri; fseBehavior=$fseBehavior
  activePlanGuid=$activeGuid; activePlanName=$activeName; schemes=$schemes
  nagleDisabled=$nagleCount; nagleTotal=$nagleTotal
} | ConvertTo-Json -Depth 5 -Compress
`;

const BOOST_LAUNCHERS_PS = String.raw`
$ErrorActionPreference='SilentlyContinue'
function TestReg($p){ Test-Path $p }
function TestDir($p){ Test-Path -LiteralPath $p -PathType Container }
$out = @()
$steamPath = (Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\Valve\Steam' -ErrorAction SilentlyContinue).InstallPath
$out += [PSCustomObject]@{ id='steam'; name='Steam'; installed=[bool]$steamPath; path=$steamPath; count=$null }
$epicManifest = 'C:\ProgramData\Epic\UnrealEngineLauncher\LauncherInstalled.dat'
$epicCount = 0
if (Test-Path $epicManifest) { try { $epicCount = (Get-Content $epicManifest -Raw | ConvertFrom-Json).InstallationList.Count } catch {} }
$out += [PSCustomObject]@{ id='epic'; name='Epic Games'; installed=(Test-Path $epicManifest); path='C:\Program Files (x86)\Epic Games'; count=$epicCount }
$eaKey = 'HKLM:\SOFTWARE\Electronic Arts\EA Desktop'
$out += [PSCustomObject]@{ id='ea'; name='EA App'; installed=(TestReg $eaKey); path=(Get-ItemProperty $eaKey -ErrorAction SilentlyContinue).'InstallLocation'; count=$null }
$ubiKey = 'HKLM:\SOFTWARE\WOW6432Node\Ubisoft\Launcher'
$ubiCount = 0
if (TestReg $ubiKey) { try { $ubiCount = (Get-ChildItem "$ubiKey\Installs" -ErrorAction SilentlyContinue | Measure-Object).Count } catch {} }
$out += [PSCustomObject]@{ id='ubisoft'; name='Ubisoft Connect'; installed=(TestReg $ubiKey); path=(Get-ItemProperty $ubiKey -ErrorAction SilentlyContinue).'InstallDir'; count=$ubiCount }
$bnetDir = "$env:ProgramData\Battle.net"
$out += [PSCustomObject]@{ id='battlenet'; name='Battle.net'; installed=(TestDir $bnetDir); path=$bnetDir; count=$null }
$riotDir = 'C:\Riot Games\Riot Client'
$out += [PSCustomObject]@{ id='riot'; name='Riot Client'; installed=(TestDir $riotDir); path=$riotDir; count=$null }
$gogRoot = 'HKLM:\SOFTWARE\WOW6432Node\GOG.com\Games'
$gogCount = 0
if (TestReg $gogRoot) { try { $gogCount = (Get-ChildItem $gogRoot -ErrorAction SilentlyContinue | Measure-Object).Count } catch {} }
$out += [PSCustomObject]@{ id='gog'; name='GOG Galaxy'; installed=(TestReg $gogRoot); path=$null; count=$gogCount }
$xboxApp = Get-AppxPackage -Name Microsoft.GamingApp -ErrorAction SilentlyContinue | Select-Object -First 1
$out += [PSCustomObject]@{ id='xbox'; name='Xbox App'; installed=[bool]$xboxApp; path=$xboxApp.InstallLocation; count=$null }
$mcDir = "$env:APPDATA\.minecraft"
$out += [PSCustomObject]@{ id='minecraft'; name='Minecraft'; installed=(TestDir $mcDir); path=$mcDir; count=$null }
$out | ConvertTo-Json -Depth 3 -Compress
`;

async function findLargestExe(dir, maxDepth) {
  let best = null;
  async function walk(d, depth) {
    if (depth > maxDepth) return;
    let entries;
    try { entries = await fsp.readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) { await walk(full, depth + 1); }
      else if (e.isFile() && e.name.toLowerCase().endsWith(".exe")) {
        if (/redist|crash|setup|unins|vcredist|launcher|installer|helper/i.test(e.name)) continue;
        try {
          const s = await fsp.stat(full);
          if (!best || s.size > best.size) best = { path: full, size: s.size };
        } catch {}
      }
    }
  }
  await walk(dir, 0);
  return best ? best.path : null;
}

async function scanSteamRich() {
  const games = await scanSteam();
  for (const g of games) {
    try {
      const acfPath = path.join(g.library, "steamapps", `appmanifest_${g.appId}.acf`);
      const txt = await fsp.readFile(acfPath, "utf8");
      const m = /"installdir"\s+"([^"]+)"/.exec(txt);
      if (!m) continue;
      const gameDir = path.join(g.library, "steamapps", "common", m[1]);
      g.installDir = gameDir;
      const exe = await findLargestExe(gameDir, 3);
      if (exe) g.exePath = exe;
    } catch {}
  }
  return games;
}

async function scanEpicRich() {
  const games = await scanEpic();
  for (const g of games) {
    if (g.library) {
      const exe = await findLargestExe(g.library, 2);
      if (exe) g.exePath = exe;
    }
  }
  return games;
}

async function scanUbisoft() {
  const r = await runPowerShell(String.raw`
$out=@()
$root='HKLM:\SOFTWARE\WOW6432Node\Ubisoft\Launcher\Installs'
if (Test-Path $root) {
  Get-ChildItem $root -ErrorAction SilentlyContinue | ForEach-Object {
    $id = $_.PSChildName
    $dir = (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).InstallDir
    if ($dir) { $out += [PSCustomObject]@{ id=$id; dir=$dir; name=(Split-Path $dir -Leaf) } }
  }
}
$out | ConvertTo-Json -Compress
`, 8000);
  if (!r.ok) return [];
  const raw = Array.isArray(r.data) ? r.data : r.data ? [r.data] : [];
  const games = [];
  for (const g of raw) {
    const exe = await findLargestExe(g.dir, 2);
    games.push({
      id: `ubisoft-${g.id}`, platform: "ubisoft", name: g.name || `Ubisoft ${g.id}`,
      appId: g.id, sizeBytes: null, coverUrl: null, library: g.dir, exePath: exe,
    });
  }
  return games;
}

async function scanGog() {
  const r = await runPowerShell(String.raw`
$out=@()
$root='HKLM:\SOFTWARE\WOW6432Node\GOG.com\Games'
if (Test-Path $root) {
  Get-ChildItem $root -ErrorAction SilentlyContinue | ForEach-Object {
    $p = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
    if ($p.gameName -and $p.path) {
      $out += [PSCustomObject]@{ id=$_.PSChildName; name=$p.gameName; dir=$p.path; exe=$p.exe }
    }
  }
}
$out | ConvertTo-Json -Compress
`, 6000);
  if (!r.ok) return [];
  const raw = Array.isArray(r.data) ? r.data : r.data ? [r.data] : [];
  return raw.map((g) => ({
    id: `gog-${g.id}`, platform: "gog", name: g.name, appId: g.id,
    sizeBytes: null, coverUrl: null, library: g.dir,
    exePath: g.exe ? path.join(g.dir, g.exe) : null,
  }));
}

ipcMain.handle("boost2:launchers", async () => {
  if (process.platform !== "win32") return { ok: false, error: "Kun Windows" };
  const r = await runPowerShell(BOOST_LAUNCHERS_PS, 15000);
  if (!r.ok) return r;
  const arr = Array.isArray(r.data) ? r.data : [r.data];
  return { ok: true, data: arr };
});

ipcMain.handle("boost2:scanGames", async () => {
  if (process.platform !== "win32") return { ok: false, error: "Kun Windows" };
  try {
    const [steam, epic, ubi, gog] = await Promise.all([
      scanSteamRich(), scanEpicRich(), scanUbisoft(), scanGog(),
    ]);
    const all = [...steam, ...epic, ...ubi, ...gog].sort((a, b) => a.name.localeCompare(b.name));
    return { ok: true, data: all };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

ipcMain.handle("boost2:analyze", async () => {
  if (process.platform !== "win32") return { ok: false, error: "Kun Windows" };
  return await runPowerShell(BOOST_ANALYZE_PS, 12000);
});

const HKLM_MMCSS   = "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile";
const HKLM_GAMES   = HKLM_MMCSS + "\\Tasks\\Games";
const HKLM_GFX     = "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers";
const HKCU_GAMEBAR = "HKCU:\\Software\\Microsoft\\GameBar";
const HKCU_GDVR    = "HKCU:\\System\\GameConfigStore";

const BOOST_TWEAKS = [
  { id: "gamemode", tier: "safe", label: "Windows Game Mode",
    reason: "Prioriterer CPU/GPU til det aktive spil og dæmper baggrundsopgaver.",
    admin: false, kind: "reg", hive: HKCU_GAMEBAR, name: "AutoGameModeEnabled", type: "DWord", value: 1 },
  { id: "gamebar-panel", tier: "safe", label: "Skjul Xbox Game Bar-tips",
    reason: "Fjerner Game Bar-notifikationer der kan forstyrre gameplay.",
    admin: false, kind: "reg", hive: HKCU_GAMEBAR, name: "ShowStartupPanel", type: "DWord", value: 0 },
  { id: "hags", tier: "safe", label: "Hardware Accelerated GPU Scheduling",
    reason: "Lader GPU'en styre sin egen scheduling og aflaster CPU'en.",
    admin: true, kind: "reg", hive: HKLM_GFX, name: "HwSchMode", type: "DWord", value: 2, needsReboot: true },
  { id: "mmcss-resp", tier: "safe", label: "MMCSS SystemResponsiveness = 10",
    reason: "Reducerer tiden Windows reserverer til non-multimedia (20 % → 10 %).",
    admin: true, kind: "reg", hive: HKLM_MMCSS, name: "SystemResponsiveness", type: "DWord", value: 10 },
  { id: "games-gpu-pri", tier: "safe", label: "Games task · GPU Priority 8",
    reason: "MMCSS 'Games'-profilen får maks. GPU-prioritet.",
    admin: true, kind: "reg", hive: HKLM_GAMES, name: "GPU Priority", type: "DWord", value: 8 },
  { id: "games-pri", tier: "safe", label: "Games task · Priority 6",
    reason: "MMCSS 'Games' får høj CPU-prioritet (default 2).",
    admin: true, kind: "reg", hive: HKLM_GAMES, name: "Priority", type: "DWord", value: 6 },
  { id: "games-sched", tier: "safe", label: "Games task · Scheduling High",
    reason: "MMCSS 'Games' scheduling category sat til High.",
    admin: true, kind: "reg", hive: HKLM_GAMES, name: "Scheduling Category", type: "String", value: "High" },
  { id: "games-sfio", tier: "safe", label: "Games task · SFIO Priority High",
    reason: "Storage I/O prioritet for spil-tråde sat til High.",
    admin: true, kind: "reg", hive: HKLM_GAMES, name: "SFIO Priority", type: "String", value: "High" },
  { id: "power-high", tier: "safe", label: "Power Plan · High Performance",
    reason: "Aktiverer High Performance-strømplan.",
    admin: true, kind: "power", plan: "high" },

  { id: "power-ultimate", tier: "advanced", label: "Power Plan · Ultimate Performance",
    reason: "Duplikerer og aktiverer Ultimate Performance-strømplan.",
    admin: true, kind: "power", plan: "ultimate" },
  { id: "fse-off", tier: "advanced", label: "Deaktiver Fullscreen Optimizations globalt",
    reason: "Fremtvinger exclusive fullscreen for alle spil (kan reducere input-lag).",
    admin: false, kind: "reg-multi", writes: [
      { hive: HKCU_GDVR, name: "GameDVR_FSEBehaviorMode", type: "DWord", value: 2 },
      { hive: HKCU_GDVR, name: "GameDVR_HonorUserFSEBehaviorMode", type: "DWord", value: 1 },
      { hive: HKCU_GDVR, name: "GameDVR_DXGIHonorFSEWindowsCompatible", type: "DWord", value: 1 },
    ] },
  { id: "nagle-off", tier: "advanced", label: "Deaktiver Nagle (TCP) på alle interfaces",
    reason: "Fjerner TCP Nagle-forsinkelse. Kan sænke latency i online spil.",
    admin: true, kind: "nagle" },
];

function psReadValue(hive, name) {
  return `@{exists=[bool]((Get-ItemProperty -Path '${hive}' -Name '${name}' -ErrorAction SilentlyContinue).PSObject.Properties.Name -contains '${name}'); value=(Get-ItemProperty -Path '${hive}' -Name '${name}' -ErrorAction SilentlyContinue).'${name}'}`;
}
function psWriteValue(hive, name, type, value) {
  const v = type === "String" ? `'${String(value).replace(/'/g, "''")}'` : String(value);
  return `New-Item -Path '${hive}' -Force | Out-Null; Set-ItemProperty -Path '${hive}' -Name '${name}' -Type ${type} -Value ${v} -Force`;
}
function psRemoveValue(hive, name) {
  return `Remove-ItemProperty -Path '${hive}' -Name '${name}' -ErrorAction SilentlyContinue`;
}

async function readBoostSnapshot() {
  const parts = [];
  for (const t of BOOST_TWEAKS) {
    if (t.kind === "reg") parts.push(`'${t.id}'=${psReadValue(t.hive, t.name)}`);
    else if (t.kind === "reg-multi") {
      parts.push(`'${t.id}'=@(${t.writes.map((w) => psReadValue(w.hive, w.name)).join(",")})`);
    }
  }
  parts.push(`'_powerActive'=(powercfg /getactivescheme | Out-String)`);
  parts.push(`'_nagle'=@(Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces' -ErrorAction SilentlyContinue | ForEach-Object { $p=$_.PSPath; [PSCustomObject]@{ guid=$_.PSChildName; ack=(Get-ItemProperty -Path $p -Name 'TcpAckFrequency' -ErrorAction SilentlyContinue).TcpAckFrequency; nodelay=(Get-ItemProperty -Path $p -Name 'TCPNoDelay' -ErrorAction SilentlyContinue).TCPNoDelay } })`);
  const script = `@{${parts.join(";")}} | ConvertTo-Json -Depth 6 -Compress`;
  return await runPowerShell(script, 15000);
}

ipcMain.handle("boost2:tweaks", async () => ({
  ok: true,
  tweaks: BOOST_TWEAKS.map((t) => ({
    id: t.id, tier: t.tier, label: t.label, reason: t.reason,
    admin: !!t.admin, needsReboot: !!t.needsReboot, kind: t.kind,
  })),
}));

ipcMain.handle("boost2:apply", async (_e, payload) => {
  if (process.platform !== "win32") return { ok: false, error: "Kun Windows" };
  const ids = Array.isArray(payload?.ids) ? payload.ids : [];
  const chosen = BOOST_TWEAKS.filter((t) => ids.includes(t.id));
  if (chosen.length === 0) return { ok: false, error: "Ingen tweaks valgt" };

  if (chosen.some((t) => t.admin) && !(await isProcessElevated())) {
    return { ok: false, needsElevation: true, error: "Kræver administrator. Genstart NOVYX som admin." };
  }

  const snap = await readBoostSnapshot();
  if (!snap.ok) return { ok: false, error: "Snapshot fejlede: " + snap.error };

  const lines = ["$ErrorActionPreference='Continue'", "$applied=@()"];
  for (const t of chosen) {
    if (t.kind === "reg") {
      lines.push(psWriteValue(t.hive, t.name, t.type, t.value));
      lines.push(`$applied += '${t.id}'`);
    } else if (t.kind === "reg-multi") {
      for (const w of t.writes) lines.push(psWriteValue(w.hive, w.name, w.type, w.value));
      lines.push(`$applied += '${t.id}'`);
    } else if (t.kind === "power") {
      if (t.plan === "high") lines.push("powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c | Out-Null");
      else if (t.plan === "ultimate") {
        lines.push("$dup = powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61 2>$null");
        lines.push("if ($dup -match 'GUID: ([0-9a-fA-F-]+)') { powercfg /setactive $matches[1] | Out-Null } else { powercfg /setactive e9a42b02-d5df-448d-aa00-03f14749eb61 | Out-Null }");
      }
      lines.push(`$applied += '${t.id}'`);
    } else if (t.kind === "nagle") {
      lines.push(String.raw`Get-ChildItem 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces' -ErrorAction SilentlyContinue | ForEach-Object { Set-ItemProperty -Path $_.PSPath -Name 'TcpAckFrequency' -Type DWord -Value 1 -Force; Set-ItemProperty -Path $_.PSPath -Name 'TCPNoDelay' -Type DWord -Value 1 -Force }`);
      lines.push(`$applied += '${t.id}'`);
    }
  }
  lines.push("[PSCustomObject]@{ok=$true;applied=$applied} | ConvertTo-Json -Compress");
  const apply = await runPowerShell(lines.join("; "), 30000);
  if (!apply.ok) return { ok: false, error: "Apply fejlede: " + apply.error };

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = {
    id: stamp, ts: Date.now(), appliedIds: chosen.map((t) => t.id),
    snapshot: snap.data, needsReboot: chosen.some((t) => t.needsReboot),
  };
  const backupPath = path.join(boostBackupDir(), `backup-${stamp}.json`);
  try { await fsp.writeFile(backupPath, JSON.stringify(backup, null, 2), "utf8"); }
  catch (e) { return { ok: false, error: "Kunne ikke gemme backup: " + e.message }; }
  await writeState({ lastBoost: { ts: Date.now(), backupId: stamp, appliedIds: backup.appliedIds } });
  return { ok: true, backupId: stamp, applied: apply.data?.applied || [], needsReboot: backup.needsReboot };
});

ipcMain.handle("boost2:backups", async () => {
  const dir = boostBackupDir();
  let entries = [];
  try { entries = await fsp.readdir(dir); } catch { return { ok: true, data: [] }; }
  const out = [];
  for (const f of entries.sort().reverse()) {
    if (!f.startsWith("backup-") || !f.endsWith(".json")) continue;
    try {
      const j = JSON.parse(await fsp.readFile(path.join(dir, f), "utf8"));
      out.push({ id: j.id, ts: j.ts, appliedIds: j.appliedIds || [], needsReboot: !!j.needsReboot });
    } catch {}
  }
  return { ok: true, data: out };
});

ipcMain.handle("boost2:restore", async (_e, payload) => {
  if (process.platform !== "win32") return { ok: false, error: "Kun Windows" };
  const id = payload?.id;
  if (!id) return { ok: false, error: "Manglende backup-id" };
  const bpath = path.join(boostBackupDir(), `backup-${id}.json`);
  let backup;
  try { backup = JSON.parse(await fsp.readFile(bpath, "utf8")); }
  catch (e) { return { ok: false, error: "Kan ikke læse backup: " + e.message }; }

  const admin = backup.appliedIds.some((tid) => BOOST_TWEAKS.find((t) => t.id === tid)?.admin);
  if (admin && !(await isProcessElevated())) return { ok: false, needsElevation: true, error: "Kræver administrator." };

  const snap = backup.snapshot || {};
  const lines = ["$ErrorActionPreference='Continue'", "$restored=@()"];
  for (const tid of backup.appliedIds) {
    const t = BOOST_TWEAKS.find((x) => x.id === tid);
    if (!t) continue;
    if (t.kind === "reg") {
      const prev = snap[tid];
      if (prev && prev.exists) lines.push(psWriteValue(t.hive, t.name, t.type, prev.value));
      else lines.push(psRemoveValue(t.hive, t.name));
      lines.push(`$restored += '${tid}'`);
    } else if (t.kind === "reg-multi") {
      const prevArr = snap[tid] || [];
      t.writes.forEach((w, i) => {
        const prev = prevArr[i];
        if (prev && prev.exists) lines.push(psWriteValue(w.hive, w.name, w.type, prev.value));
        else lines.push(psRemoveValue(w.hive, w.name));
      });
      lines.push(`$restored += '${tid}'`);
    } else if (t.kind === "power") {
      const m = /GUID: ([0-9a-fA-F-]+)/.exec(String(snap._powerActive || ""));
      if (m) lines.push(`powercfg /setactive ${m[1]} | Out-Null`);
      lines.push(`$restored += '${tid}'`);
    } else if (t.kind === "nagle") {
      const nagleArr = Array.isArray(snap._nagle) ? snap._nagle : [];
      for (const nif of nagleArr) {
        const base = `HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces\\${nif.guid}`;
        if (nif.ack == null) lines.push(`Remove-ItemProperty -Path '${base}' -Name 'TcpAckFrequency' -ErrorAction SilentlyContinue`);
        else lines.push(`Set-ItemProperty -Path '${base}' -Name 'TcpAckFrequency' -Type DWord -Value ${Number(nif.ack)} -Force`);
        if (nif.nodelay == null) lines.push(`Remove-ItemProperty -Path '${base}' -Name 'TCPNoDelay' -ErrorAction SilentlyContinue`);
        else lines.push(`Set-ItemProperty -Path '${base}' -Name 'TCPNoDelay' -Type DWord -Value ${Number(nif.nodelay)} -Force`);
      }
      lines.push(`$restored += '${tid}'`);
    }
  }
  lines.push("[PSCustomObject]@{ok=$true;restored=$restored} | ConvertTo-Json -Compress");
  const r = await runPowerShell(lines.join("; "), 30000);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, restored: r.data?.restored || [] };
});

// Per-spil profil: high-perf GPU + fullscreen-opt override.
ipcMain.handle("boost2:gameProfile", async (_e, payload) => {
  if (process.platform !== "win32") return { ok: false, error: "Kun Windows" };
  const { gameId, exePath, action } = payload || {};
  if (!gameId) return { ok: false, error: "Manglende gameId" };
  const GPU = "HKCU:\\Software\\Microsoft\\DirectX\\UserGpuPreferences";
  const LAY = "HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\AppCompatFlags\\Layers";
  const store = path.join(boostBackupDir(), "game-profiles.json");
  let cur = {};
  try { cur = JSON.parse(await fsp.readFile(store, "utf8")); } catch {}

  if (action === "status") return { ok: true, active: !!cur[gameId] };

  if (!exePath) return { ok: false, error: "Ingen exe kunne findes for dette spil" };
  const exe = String(exePath).replace(/'/g, "''");

  if (action === "apply") {
    const before = await runPowerShell(
      `@{ gpu=(Get-ItemProperty -Path '${GPU}' -Name '${exe}' -ErrorAction SilentlyContinue).'${exe}'; lay=(Get-ItemProperty -Path '${LAY}' -Name '${exe}' -ErrorAction SilentlyContinue).'${exe}' } | ConvertTo-Json -Compress`,
      6000,
    );
    const script = [
      `New-Item -Path '${GPU}' -Force | Out-Null`,
      `Set-ItemProperty -Path '${GPU}' -Name '${exe}' -Value 'GpuPreference=2;' -Force`,
      `New-Item -Path '${LAY}' -Force | Out-Null`,
      `Set-ItemProperty -Path '${LAY}' -Name '${exe}' -Value '~ DISABLEDXMAXIMIZEDWINDOWEDMODE' -Force`,
      "[PSCustomObject]@{ok=$true} | ConvertTo-Json -Compress",
    ].join("; ");
    const w = await runPowerShell(script, 8000);
    if (!w.ok) return { ok: false, error: w.error };
    cur[gameId] = { exePath, ts: Date.now(), before: before.ok ? before.data : null };
    try { await fsp.writeFile(store, JSON.stringify(cur, null, 2), "utf8"); } catch {}
    return { ok: true, applied: { highPerfGpu: true, disableFsOpt: true } };
  }

  if (action === "restore") {
    const b = cur[gameId];
    const before = b?.before || { gpu: null, lay: null };
    const lines = [];
    if (before.gpu) lines.push(`Set-ItemProperty -Path '${GPU}' -Name '${exe}' -Value '${String(before.gpu).replace(/'/g,"''")}' -Force`);
    else lines.push(`Remove-ItemProperty -Path '${GPU}' -Name '${exe}' -ErrorAction SilentlyContinue`);
    if (before.lay) lines.push(`Set-ItemProperty -Path '${LAY}' -Name '${exe}' -Value '${String(before.lay).replace(/'/g,"''")}' -Force`);
    else lines.push(`Remove-ItemProperty -Path '${LAY}' -Name '${exe}' -ErrorAction SilentlyContinue`);
    lines.push("[PSCustomObject]@{ok=$true} | ConvertTo-Json -Compress");
    const r = await runPowerShell(lines.join("; "), 8000);
    if (!r.ok) return { ok: false, error: r.error };
    delete cur[gameId];
    try { await fsp.writeFile(store, JSON.stringify(cur, null, 2), "utf8"); } catch {}
    return { ok: true, restored: true };
  }

  return { ok: false, error: "Ukendt action" };
});

ipcMain.handle("boost2:gameProfiles", async () => {
  const store = path.join(boostBackupDir(), "game-profiles.json");
  try { return { ok: true, data: JSON.parse(await fsp.readFile(store, "utf8")) }; }
  catch { return { ok: true, data: {} }; }
});

// ─────────────────────────────────────────────────────────────
// M5 · Hardware Center — komplet Windows-scan via CIM/PowerShell
// Ingen mock. Hvert felt er null hvis Windows ikke leverer det.
// ─────────────────────────────────────────────────────────────
const HARDWARE_PS = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'

$cpu = Get-CimInstance Win32_Processor | Select-Object Name,Manufacturer,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed,CurrentClockSpeed,L2CacheSize,L3CacheSize,SocketDesignation,ProcessorId,LoadPercentage,VirtualizationFirmwareEnabled,SecondLevelAddressTranslationExtensions
$cs  = Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer,Model,SystemFamily,TotalPhysicalMemory,PCSystemType,HypervisorPresent,NumberOfProcessors
$bios = Get-CimInstance Win32_BIOS | Select-Object SMBIOSBIOSVersion,Manufacturer,ReleaseDate,SerialNumber,SMBIOSMajorVersion,SMBIOSMinorVersion
$board = Get-CimInstance Win32_BaseBoard | Select-Object Manufacturer,Product,Version,SerialNumber
$osi = Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,BuildNumber,OSArchitecture,InstallDate,LastBootUpTime,RegisteredUser,SerialNumber,SystemDrive,FreePhysicalMemory,TotalVisibleMemorySize

$firmware = 'unknown'
try {
  $sysDisk = Get-Disk | Where-Object { $_.IsSystem -or $_.IsBoot } | Select-Object -First 1
  if ($sysDisk) { $firmware = if ($sysDisk.PartitionStyle -eq 'GPT') { 'UEFI' } else { 'Legacy' } }
} catch {}

$secureBoot = $null
try { $secureBoot = [bool](Confirm-SecureBootUEFI) } catch { $secureBoot = $null }

$tpm = $null
try {
  $t = Get-Tpm
  $tpm = [PSCustomObject]@{
    Present = [bool]$t.TpmPresent; Ready = [bool]$t.TpmReady; Enabled = [bool]$t.TpmEnabled; Activated = [bool]$t.TpmActivated
    Manufacturer = $t.ManufacturerIdTxt; ManufacturerVersion = $t.ManufacturerVersion
    SpecVersion = ($t.TpmVersion) | Out-String | ForEach-Object { $_.Trim() }
  }
} catch {
  try {
    $wt = Get-CimInstance -Namespace 'root\CIMV2\Security\MicrosoftTpm' -ClassName Win32_Tpm
    if ($wt) {
      $tpm = [PSCustomObject]@{
        Present = $true; Ready = [bool]$wt.IsEnabled_InitialValue; Enabled = [bool]$wt.IsEnabled_InitialValue
        Activated = [bool]$wt.IsActivated_InitialValue; Manufacturer = $wt.ManufacturerIdTxt
        ManufacturerVersion = $wt.ManufacturerVersion; SpecVersion = $wt.SpecVersion
      }
    }
  } catch {}
}

$memModules = Get-CimInstance Win32_PhysicalMemory | Select-Object BankLabel,DeviceLocator,Capacity,ConfiguredClockSpeed,Speed,Manufacturer,PartNumber,SerialNumber,FormFactor,MemoryType,SMBIOSMemoryType
$memArray = Get-CimInstance Win32_PhysicalMemoryArray | Select-Object -First 1 MemoryDevices,MaxCapacity

$gpus = Get-CimInstance Win32_VideoController | Select-Object Name,AdapterCompatibility,DriverVersion,DriverDate,AdapterRAM,VideoModeDescription,CurrentHorizontalResolution,CurrentVerticalResolution,CurrentRefreshRate,VideoProcessor,PNPDeviceID,Status

$physicalDisks = @()
try { $physicalDisks = Get-PhysicalDisk | Select-Object FriendlyName,MediaType,BusType,Size,SerialNumber,HealthStatus,SpindleSpeed,Manufacturer,Model,FirmwareVersion } catch {}
$diskDrives = Get-CimInstance Win32_DiskDrive | Select-Object Model,InterfaceType,Size,SerialNumber,MediaType,FirmwareRevision,Status,Partitions
$smart = @()
try { $smart = Get-CimInstance -Namespace 'root\wmi' -ClassName MSStorageDriver_FailurePredictStatus | Select-Object InstanceName,PredictFailure,Reason } catch {}

$logicalDisks = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID,VolumeName,FileSystem,Size,FreeSpace,ProviderName

$adapters = @()
try { $adapters = Get-NetAdapter | Where-Object { $_.Status -ne 'Not Present' } | Select-Object Name,InterfaceDescription,MacAddress,LinkSpeed,MediaType,Status,ifIndex,DriverVersion,DriverProvider } catch {
  $adapters = Get-CimInstance Win32_NetworkAdapter | Where-Object { $_.PhysicalAdapter } | Select-Object Name,Description,MACAddress,Speed,NetConnectionStatus
}
$ips = @()
try { $ips = Get-NetIPAddress | Where-Object { $_.AddressState -eq 'Preferred' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object InterfaceIndex,IPAddress,AddressFamily,PrefixLength } catch {}

$monitors = @()
try {
  $monitors = Get-CimInstance -Namespace 'root\wmi' -ClassName WmiMonitorID | ForEach-Object {
    $name = -join ([char[]] ($_.UserFriendlyName | Where-Object { $_ -ne 0 }))
    $manu = -join ([char[]] ($_.ManufacturerName | Where-Object { $_ -ne 0 }))
    $serial = -join ([char[]] ($_.SerialNumberID | Where-Object { $_ -ne 0 }))
    [PSCustomObject]@{ Name = $name; Manufacturer = $manu; Serial = $serial; YearOfManufacture = $_.YearOfManufacture; InstanceName = $_.InstanceName }
  }
} catch {}

$battery = $null
try {
  $b = Get-CimInstance Win32_Battery | Select-Object -First 1
  if ($b) {
    $fullCharge = $null; $designCap = $null; $cycleCount = $null
    try {
      $fullCharge = (Get-CimInstance -Namespace 'root\wmi' -ClassName BatteryFullChargedCapacity | Select-Object -First 1).FullChargedCapacity
      $designCap  = (Get-CimInstance -Namespace 'root\wmi' -ClassName BatteryStaticData      | Select-Object -First 1).DesignedCapacity
      $cycleCount = (Get-CimInstance -Namespace 'root\wmi' -ClassName BatteryCycleCount      | Select-Object -First 1).CycleCount
    } catch {}
    $battery = [PSCustomObject]@{
      Name = $b.Name; Manufacturer = $b.DeviceID; Chemistry = $b.Chemistry
      EstimatedChargeRemaining = $b.EstimatedChargeRemaining; BatteryStatus = $b.BatteryStatus
      DesignCapacity = $designCap; FullChargeCapacity = $fullCharge; CycleCount = $cycleCount
    }
  }
} catch {}

$cpuTemp = $null
try {
  $t = Get-CimInstance -Namespace 'root\wmi' -ClassName MSAcpi_ThermalZoneTemperature | Select-Object -First 1
  if ($t) { $cpuTemp = [math]::Round(($t.CurrentTemperature / 10.0) - 273.15, 1) }
} catch {}

$hags = $null
try { $hags = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name HwSchMode -ErrorAction Stop).HwSchMode } catch {}
$dx = $null
try { $dx = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\DirectX' -ErrorAction Stop).Version } catch {}

$activation = $null
try {
  $lic = Get-CimInstance SoftwareLicensingProduct -Filter "PartialProductKey IS NOT NULL AND ApplicationID = '55c92734-d682-4d71-983e-d6ec3f16059f'" | Select-Object -First 1
  if ($lic) {
    $status = switch ($lic.LicenseStatus) { 0 {'Unlicensed'} 1 {'Licensed'} 2 {'OOB Grace'} 3 {'OOT Grace'} 4 {'Non-Genuine Grace'} 5 {'Notification'} 6 {'Extended Grace'} default {'Unknown'} }
    $activation = [PSCustomObject]@{ Status = $status; Description = $lic.Description; Channel = $lic.ProductKeyChannel }
  }
} catch {}

$edition = $null; $displayVersion = $null; $ubr = $null
try { $edition = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -ErrorAction Stop).EditionID } catch {}
try { $displayVersion = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -ErrorAction Stop).DisplayVersion } catch {}
try { $ubr = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -ErrorAction Stop).UBR } catch {}

[PSCustomObject]@{
  cpu=$cpu; computer=$cs; bios=$bios; board=$board; os=$osi; osEdition=$edition; osDisplayVersion=$displayVersion; osUBR=$ubr
  firmware=$firmware; secureBoot=$secureBoot; tpm=$tpm
  memoryArray=$memArray; memoryModules=$memModules
  gpus=$gpus; hags=$hags; directx=$dx
  physicalDisks=$physicalDisks; diskDrives=$diskDrives; smart=$smart; logicalDisks=$logicalDisks
  adapters=$adapters; ips=$ips; monitors=$monitors; battery=$battery; cpuTemp=$cpuTemp; activation=$activation
  hostname=$env:COMPUTERNAME; user=$env:USERNAME
  generatedAt=[int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
} | ConvertTo-Json -Depth 6 -Compress
`;

let hwCache = null;
let hwCacheAt = 0;

function parseWmiDateHw(s) {
  if (!s) return null;
  const m = /\/Date\((\d+)\)/.exec(String(s));
  return m ? Number(m[1]) : null;
}
function firstArr(x) { if (x == null) return []; return Array.isArray(x) ? x : [x]; }

function normaliseHardware(d) {
  const cpus = firstArr(d.cpu);
  const cpu0 = cpus[0] || null;
  const gpus = firstArr(d.gpus).map((g) => ({
    name: g.Name || null,
    vendor: g.AdapterCompatibility || null,
    vram: typeof g.AdapterRAM === "number" ? g.AdapterRAM : null,
    driverVersion: g.DriverVersion || null,
    driverDate: parseWmiDateHw(g.DriverDate),
    videoProcessor: g.VideoProcessor || null,
    currentResolution: g.CurrentHorizontalResolution && g.CurrentVerticalResolution
      ? `${g.CurrentHorizontalResolution} x ${g.CurrentVerticalResolution}` : null,
    currentRefreshRate: typeof g.CurrentRefreshRate === "number" ? g.CurrentRefreshRate : null,
    status: g.Status || null,
    pnpId: g.PNPDeviceID || null,
  }));

  const memTypeMap = { 20:"DDR",21:"DDR2",22:"DDR2 FB-DIMM",24:"DDR3",26:"DDR4",34:"DDR5" };
  const smbiosMemTypeMap = { 24:"DDR3",26:"DDR4",30:"LPDDR4",34:"DDR5",35:"LPDDR5" };
  const formFactorMap = { 8:"DIMM",12:"SODIMM",13:"SRIMM" };

  const memModules = firstArr(d.memoryModules).map((m) => ({
    bank: m.BankLabel || m.DeviceLocator || null,
    slot: m.DeviceLocator || null,
    capacity: typeof m.Capacity === "string" ? Number(m.Capacity) : (m.Capacity ?? null),
    configuredSpeed: m.ConfiguredClockSpeed ?? null,
    ratedSpeed: m.Speed ?? null,
    manufacturer: (m.Manufacturer || "").toString().trim() || null,
    partNumber: (m.PartNumber || "").toString().trim() || null,
    serial: (m.SerialNumber || "").toString().trim() || null,
    formFactor: formFactorMap[m.FormFactor] || (m.FormFactor != null ? String(m.FormFactor) : null),
    typeLabel: memTypeMap[m.MemoryType] || smbiosMemTypeMap[m.SMBIOSMemoryType] || null,
  }));

  const memInstalled = memModules.reduce((s, m) => s + (Number(m.capacity) || 0), 0);
  const totalMem = d.computer && typeof d.computer.TotalPhysicalMemory === "string"
    ? Number(d.computer.TotalPhysicalMemory)
    : (d.computer?.TotalPhysicalMemory ?? memInstalled);
  const freeKb = d.os?.FreePhysicalMemory ? Number(d.os.FreePhysicalMemory) : null;
  const totalKb = d.os?.TotalVisibleMemorySize ? Number(d.os.TotalVisibleMemorySize) : null;

  const smart = firstArr(d.smart);

  const busMap = { 1:"SCSI",2:"ATAPI",3:"ATA",4:"1394",5:"SSA",6:"FC",7:"USB",8:"RAID",9:"iSCSI",10:"SAS",11:"SATA",12:"SD",13:"MMC",14:"MAX",15:"Virtual",16:"StorageSpaces",17:"NVMe" };
  const mediaMap = { 0:null, 3:"HDD", 4:"SSD", 5:"SCM" };

  const physical = firstArr(d.physicalDisks).map((p) => ({
    name: p.FriendlyName || p.Model || null,
    mediaType: mediaMap[p.MediaType] ?? (p.MediaType ? String(p.MediaType) : null),
    busType: busMap[p.BusType] || (p.BusType ? String(p.BusType) : null),
    size: typeof p.Size === "string" ? Number(p.Size) : (p.Size ?? null),
    serial: (p.SerialNumber || "").toString().trim() || null,
    health: p.HealthStatus || null,
    manufacturer: p.Manufacturer || null,
    model: p.Model || null,
    firmware: p.FirmwareVersion || null,
    spindleSpeed: p.SpindleSpeed ?? null,
  }));

  const drives = firstArr(d.diskDrives).map((x) => ({
    model: x.Model || null,
    interface: x.InterfaceType || null,
    size: typeof x.Size === "string" ? Number(x.Size) : (x.Size ?? null),
    serial: (x.SerialNumber || "").toString().trim() || null,
    mediaType: x.MediaType || null,
    firmware: x.FirmwareRevision || null,
    status: x.Status || null,
    partitions: x.Partitions ?? null,
  }));

  const volumes = firstArr(d.logicalDisks).map((v) => ({
    letter: v.DeviceID || null,
    label: v.VolumeName || null,
    fileSystem: v.FileSystem || null,
    size: typeof v.Size === "string" ? Number(v.Size) : (v.Size ?? null),
    free: typeof v.FreeSpace === "string" ? Number(v.FreeSpace) : (v.FreeSpace ?? null),
  }));

  const adapters = firstArr(d.adapters).map((a) => ({
    name: a.Name || null,
    description: a.InterfaceDescription || a.Description || null,
    mac: a.MacAddress || a.MACAddress || null,
    linkSpeed: a.LinkSpeed || (a.Speed ? String(a.Speed) : null),
    mediaType: a.MediaType || null,
    status: a.Status || (a.NetConnectionStatus != null ? String(a.NetConnectionStatus) : null),
    ifIndex: a.ifIndex ?? null,
    driverVersion: a.DriverVersion || null,
    driverProvider: a.DriverProvider || null,
    addresses: [],
  }));

  const ips = firstArr(d.ips).map((i) => ({
    ifIndex: i.InterfaceIndex ?? null,
    ip: i.IPAddress || null,
    family: (i.AddressFamily === 2 || i.AddressFamily === "IPv4") ? "IPv4"
      : (i.AddressFamily === 23 || i.AddressFamily === "IPv6") ? "IPv6"
      : (i.AddressFamily != null ? String(i.AddressFamily) : null),
    prefix: i.PrefixLength ?? null,
  }));
  for (const ad of adapters) {
    ad.addresses = ips
      .filter((i) => i.ifIndex === ad.ifIndex && i.ip)
      .map((i) => `${i.ip}${i.prefix != null ? "/" + i.prefix : ""} (${i.family})`);
  }

  const monitors = firstArr(d.monitors).map((m) => ({
    name: (m.Name || "").trim() || null,
    manufacturer: (m.Manufacturer || "").trim() || null,
    serial: (m.Serial || "").trim() || null,
    year: m.YearOfManufacture ?? null,
    instance: m.InstanceName || null,
  }));

  const battery = d.battery ? (() => {
    const design = d.battery.DesignCapacity ?? null;
    const full = d.battery.FullChargeCapacity ?? null;
    const wear = (design && full) ? Math.max(0, Math.round((1 - full / design) * 1000) / 10) : null;
    const statusMap = { 1:"Discharging",2:"AC",3:"Fully charged",4:"Low",5:"Critical",6:"Charging",7:"Charging & High",8:"Charging & Low",9:"Charging & Critical",10:"Undefined",11:"Partially charged" };
    return {
      present: true,
      name: d.battery.Name || null,
      chemistry: d.battery.Chemistry ?? null,
      percent: d.battery.EstimatedChargeRemaining ?? null,
      status: statusMap[d.battery.BatteryStatus] || null,
      designCapacity: design,
      fullChargeCapacity: full,
      wearPercent: wear,
      cycleCount: d.battery.CycleCount ?? null,
    };
  })() : { present: false };

  return {
    generatedAt: d.generatedAt || Date.now(),
    hostname: d.hostname || null,
    user: d.user || null,
    cpu: cpu0 ? {
      name: cpu0.Name ? cpu0.Name.replace(/\s+/g, " ").trim() : null,
      manufacturer: cpu0.Manufacturer || null,
      cores: cpu0.NumberOfCores ?? null,
      threads: cpu0.NumberOfLogicalProcessors ?? null,
      baseClockMHz: cpu0.MaxClockSpeed ?? null,
      currentClockMHz: cpu0.CurrentClockSpeed ?? null,
      l2CacheKB: cpu0.L2CacheSize ?? null,
      l3CacheKB: cpu0.L3CacheSize ?? null,
      socket: cpu0.SocketDesignation || null,
      loadPercent: cpu0.LoadPercentage ?? null,
      virtualization: cpu0.VirtualizationFirmwareEnabled == null ? null : !!cpu0.VirtualizationFirmwareEnabled,
      slat: cpu0.SecondLevelAddressTranslationExtensions == null ? null : !!cpu0.SecondLevelAddressTranslationExtensions,
      tempC: d.cpuTemp ?? null,
      count: cpus.length,
    } : null,
    computer: d.computer ? {
      manufacturer: d.computer.Manufacturer || null,
      model: d.computer.Model || null,
      family: d.computer.SystemFamily || null,
      hypervisorPresent: d.computer.HypervisorPresent == null ? null : !!d.computer.HypervisorPresent,
    } : null,
    bios: d.bios ? {
      version: d.bios.SMBIOSBIOSVersion || null,
      vendor: d.bios.Manufacturer || null,
      releaseDate: parseWmiDateHw(d.bios.ReleaseDate),
      serial: d.bios.SerialNumber || null,
      smbios: d.bios.SMBIOSMajorVersion != null ? `${d.bios.SMBIOSMajorVersion}.${d.bios.SMBIOSMinorVersion}` : null,
    } : null,
    board: d.board ? {
      manufacturer: d.board.Manufacturer || null,
      product: d.board.Product || null,
      version: d.board.Version || null,
      serial: d.board.SerialNumber || null,
    } : null,
    os: d.os ? {
      caption: d.os.Caption || null,
      version: d.os.Version || null,
      build: d.os.BuildNumber ? String(d.os.BuildNumber) : null,
      ubr: d.osUBR ?? null,
      arch: d.os.OSArchitecture || null,
      edition: d.osEdition || null,
      displayVersion: d.osDisplayVersion || null,
      installDate: parseWmiDateHw(d.os.InstallDate),
      lastBoot: parseWmiDateHw(d.os.LastBootUpTime),
      registeredUser: d.os.RegisteredUser || null,
      systemDrive: d.os.SystemDrive || null,
    } : null,
    firmware: d.firmware || "unknown",
    secureBoot: d.secureBoot === true ? "on" : d.secureBoot === false ? "off" : "unknown",
    tpm: d.tpm ? {
      present: !!d.tpm.Present,
      ready: !!d.tpm.Ready,
      enabled: !!d.tpm.Enabled,
      activated: d.tpm.Activated == null ? null : !!d.tpm.Activated,
      manufacturer: d.tpm.Manufacturer || null,
      manufacturerVersion: d.tpm.ManufacturerVersion || null,
      specVersion: d.tpm.SpecVersion || null,
    } : null,
    directx: d.directx || null,
    gpuScheduling: d.hags === 2 ? "hardware" : d.hags === 1 ? "software" : d.hags == null ? "unknown" : String(d.hags),
    activation: d.activation ? {
      status: d.activation.Status || null,
      description: d.activation.Description || null,
      channel: d.activation.Channel || null,
    } : null,
    memory: {
      installedBytes: memInstalled || null,
      totalBytes: totalMem || null,
      totalKb, freeKb,
      usedKb: (totalKb != null && freeKb != null) ? totalKb - freeKb : null,
      slotsUsed: memModules.length,
      slotsTotal: d.memoryArray?.MemoryDevices ?? null,
      maxCapacityKb: d.memoryArray?.MaxCapacity ?? null,
      modules: memModules,
    },
    gpus,
    storage: { physical, drives, volumes },
    network: { adapters, ips },
    monitors,
    battery,
    smart: smart.map((s) => ({
      instance: s.InstanceName || null,
      predictFailure: !!s.PredictFailure,
      reason: s.Reason ?? null,
    })),
  };
}

ipcMain.handle("hardware2:scan", async (_e, opts) => {
  const force = !!(opts && opts.force);
  if (!force && hwCache && Date.now() - hwCacheAt < 15_000) {
    return { ok: true, data: hwCache, cached: true };
  }
  const r = await runPowerShell(HARDWARE_PS, 30_000);
  if (!r.ok) return r;
  try {
    const normalised = normaliseHardware(r.data || {});
    hwCache = normalised; hwCacheAt = Date.now();
    return { ok: true, data: normalised, cached: false };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
});

ipcMain.handle("hardware2:export", async (_e, payload) => {
  try {
    const format = payload?.format === "txt" ? "txt" : "json";
    const content = payload?.content;
    if (!content || typeof content !== "string") return { ok: false, error: "Manglende indhold" };
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const defaultPath = path.join(app.getPath("desktop"), `novyx-hardware-${stamp}.${format}`);
    const win = BrowserWindow.getFocusedWindow() || mainWindow;
    const result = await dialog.showSaveDialog(win, {
      title: "Eksportér hardware-rapport",
      defaultPath,
      filters: [format === "json" ? { name: "JSON", extensions: ["json"] } : { name: "Tekst", extensions: ["txt"] }],
    });
    if (result.canceled || !result.filePath) return { ok: true, cancelled: true };
    await fsp.writeFile(result.filePath, content, "utf8");
    return { ok: true, path: result.filePath };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });




