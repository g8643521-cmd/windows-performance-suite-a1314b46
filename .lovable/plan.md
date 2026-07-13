# NOVYX — Plan for M2–M12

Omfanget her er stort (11 fulde moduler med rigtige Windows-kommandoer, PowerShell-scripts og UI). Jeg leverer dem **ét modul ad gangen** — hvert modul komplet med IPC-handler, preload-binding, renderer-side og admin-håndtering, så du kan teste det inden vi går videre.

## Rækkefølge (som du prioriterede)

1. **M2 — Intelligent System Scan** (næste turn)
2. M3 — Repair Center med live log
3. M4 — Game Boost med backup/rollback
4. M5 — Hardware Center
5. M6 — Startup & Process Manager
6. M7 — Driver Center
7. M8 — Browser Cleaner
8. M9 — Privacy Center
9. M10 — Restore Center
10. M11 — Diagnostics
11. M12 — Settings

## Fælles fundament (bygges ind i M2, genbruges resten)

- `runPowerShell(script, timeoutMs)` findes allerede — udvides med JSON-parsing helper.
- Ny `runElevatedPS(script)` for scripts der kræver admin (Repair, Registry-tweaks, WU-cache, services, SMART på nogle SKU'er).
- Nyt IPC-namespace pr. modul (`scan:*`, `repair:*`, `boost:*`, `hw:*`, `procs:*`, `drivers:*`, `browser:*`, `privacy:*`, `restore:*`, `diag:*`, `settings:*`) — eksponeres via `preload.cjs` under `window.novyx.<modul>`.
- Backup-lag i `%APPDATA%/NOVYX/backups/*.json` for alle ændringer der kan rulles tilbage (M4, M9, tweaks). M10 læser samme mappe.

## M2 — Intelligent System Scan (leveres først)

**Formål:** én scan-knap der returnerer strukturerede resultater med *størrelse*, *sværhedsgrad* og en *Fix*-knap pr. række.

**Kategorier & implementation:**
| Kategori | Kilde | Fix-handling |
|---|---|---|
| Temp-filer | Genbrug eksisterende `tempFolders()` + `dirSize()` | `optimize:cleanTemp` |
| Papirkurv | PowerShell: `(New-Object -ComObject Shell.Application).NameSpace(10).Items()` → sum af `Size` | `Clear-RecycleBin -Force` (admin) |
| Windows Update-cache | `dirSize("C:\\Windows\\SoftwareDistribution\\Download")` | Stop wuauserv → slet → start wuauserv (admin) |
| Browser-cache | Kendte stier pr. browser (Chrome/Edge/Brave/Opera under `Local\\...\\User Data\\Default\\Cache`, Firefox under `Roaming\\Mozilla\\Firefox\\Profiles\\*\\cache2`) | `cleanDir()` — advarsel hvis browseren kører |
| Startup-programmer | `Get-CimInstance Win32_StartupCommand` + `HKCU/HKLM Run` keys | Åbner Task Manager Startup-tab (M6 giver ægte toggle) |
| Tjenester | `Get-Service` filtreret på `StartType=Automatic` og `Status=Stopped`, samt "kendte bloat"-liste | Åbner `services.msc` (M3 giver start/stop) |
| Planlagte opgaver | `Get-ScheduledTask` filtreret på State=Ready og ikke-Microsoft | Åbner `taskschd.msc` |
| Store filer | `Get-ChildItem -Recurse` på `Users\\<me>` med `-File` og `Length > 500MB` (top 20) | Åbner Explorer på filen |
| SMART-disk | `Get-PhysicalDisk \| Select FriendlyName, HealthStatus, MediaType, Size` + `Get-StorageReliabilityCounter` | Info-only |

**Renderer:** ny fane "System Scan" (erstatter/omdøber ikke eksisterende Hardware-scan). Kort pr. kategori med spinner mens den scannes, total-bar øverst med "GB kan frigøres", Fix-knap pr. række + "Fix alt sikkert"-knap.

**Fejlhåndtering:** hver subscan er isoleret — hvis SMART fejler viser vi den række som "Ikke tilgængelig", resten fortsætter.

## Bekræftelse

Sig **"kør M2"** så bygger jeg det færdigt i næste turn. Hvis noget skal ændres (fx spring browser-cache over indtil M8, eller inkludér også hibernation-fil), sig til så tilpasser jeg planen inden.
