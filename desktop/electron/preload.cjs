const { contextBridge, ipcRenderer } = require("electron");

const invoke = (ch, ...args) => ipcRenderer.invoke(ch, ...args);

contextBridge.exposeInMainWorld("novyx", {
  hardware: {
    scan: () => invoke("hardware:scan"),
  },
  system: {
    live: () => invoke("system:live"),
  },
  optimize: {
    processes: () => invoke("optimize:processes"),
    tempInfo:  () => invoke("optimize:tempInfo"),
    cleanTemp: () => invoke("optimize:cleanTemp"),
    healthScan:() => invoke("optimize:healthScan"),
  },
  tweaks: {
    list: () => invoke("tweaks:list"),
  },
  apps: {
    list: () => invoke("apps:list"),
  },
  games: {
    scan: () => invoke("games:scan"),
    launch: (id) => invoke("games:launch", id),
  },
  repair: {
    list: () => invoke("repair:list"),
    run: (toolId) => invoke("repair:run", toolId),
  },
  app: {
    version: () => invoke("app:version"),
    openExternal: (url) => invoke("app:openExternal", url),
    openLogsFolder: () => invoke("app:openLogsFolder"),
    getAutoStart: () => invoke("app:getAutoStart"),
    setAutoStart: (enabled) => invoke("app:setAutoStart", enabled),
    isElevated: () => invoke("app:isElevated"),
    relaunchAsAdmin: () => invoke("app:relaunchAsAdmin"),
  },
  sys: {
    info: (opts) => invoke("sys:info", opts),
    ping: (opts) => invoke("sys:ping", opts),
  },
  state: {
    read: () => invoke("state:read"),
    setLastScan: (payload) => invoke("state:setLastScan", payload),
    setLastOptimize: (payload) => invoke("state:setLastOptimize", payload),
  },

  diagnostics: {
    export: () => invoke("diagnostics:export"),
  },

  scan: {
    full: () => invoke("scan:full"),
    fix: (fixId) => invoke("scan:fix", fixId),
  },

  repair2: {
    list: () => invoke("repair2:list"),
    elevated: () => invoke("repair2:elevated"),
    run: (payload) => invoke("repair2:run", payload),
    cancel: (jobId) => invoke("repair2:cancel", jobId),
    onEvent: (cb) => {
      const handler = (_e, evt) => { try { cb(evt); } catch {} };
      ipcRenderer.on("repair2:event", handler);
      return () => ipcRenderer.removeListener("repair2:event", handler);
    },
  },
});

