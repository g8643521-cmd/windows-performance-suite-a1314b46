// PowerShell-installationsscripts til NOVYX.
//
// Filerne serveres 1:1 fra `/api/public/install.ps1` osv. — brugerne
// kan altid inspicere kildekoden ved at åbne URL'en direkte i browseren.

const HEADER = `# ==============================================================
# NOVYX – PowerShell installer
#
# Denne fil kan læses direkte i browseren. Den:
#   1) Downloader nyeste version fra det officielle domæne.
#   2) Pakker ud til %LOCALAPPDATA%\\Programs\\NOVYX
#   3) Opretter Start-menu + desktop-genveje.
#   4) Starter programmet.
# Ingen data sendes tilbage. Ingen ændringer i systemmapper.
# ==============================================================
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Write-Step($msg) { Write-Host "[NOVYX] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "[NOVYX] $msg" -ForegroundColor Green }
function Write-Err($msg)  { Write-Host "[NOVYX] $msg" -ForegroundColor Red }
`;

const INSTALL_BODY = `
$InstallDir  = Join-Path $env:LOCALAPPDATA 'Programs\\NOVYX'
$ManifestUrl = '{{MANIFEST_URL}}'
$AppExeName  = 'NOVYX.exe'

Write-Step "Henter versionsinformation..."
try {
  $manifest = Invoke-RestMethod -Uri $ManifestUrl -UseBasicParsing
} catch {
  Write-Err "Kunne ikke kontakte $ManifestUrl"
  throw
}

$Version     = $manifest.version
$DownloadUrl = $manifest.url
$Filename    = $manifest.filename
Write-Ok "Nyeste version: v$Version"

$Tmp = Join-Path $env:TEMP ("NOVYX_" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $Tmp -Force | Out-Null
$ZipPath = Join-Path $Tmp $Filename

Write-Step "Downloader $Filename..."
Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipPath -UseBasicParsing

# Luk kørende instans hvis der er én.
Get-Process -Name 'NOVYX' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Step "Installerer til $InstallDir..."
if (Test-Path $InstallDir) {
  Remove-Item $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
Expand-Archive -Path $ZipPath -DestinationPath $Tmp -Force

# Find eksekverbaren og flyt indhold til InstallDir.
$AppRoot = Get-ChildItem $Tmp -Directory | Where-Object { Test-Path (Join-Path $_.FullName $AppExeName) } | Select-Object -First 1
if (-not $AppRoot) { $AppRoot = Get-ChildItem $Tmp -Directory | Select-Object -First 1 }
if (-not $AppRoot) { throw "Kunne ikke finde app-mappen i download." }

Get-ChildItem $AppRoot.FullName -Force | Move-Item -Destination $InstallDir -Force
Remove-Item $Tmp -Recurse -Force -ErrorAction SilentlyContinue

$ExePath = Join-Path $InstallDir $AppExeName
if (-not (Test-Path $ExePath)) { throw "Installation fejlede — $ExePath findes ikke." }

Write-Step "Opretter genveje..."
$WshShell = New-Object -ComObject WScript.Shell

$StartMenuDir = Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs\\NOVYX'
New-Item -ItemType Directory -Path $StartMenuDir -Force | Out-Null
$StartLnk = Join-Path $StartMenuDir 'NOVYX.lnk'
$sc = $WshShell.CreateShortcut($StartLnk)
$sc.TargetPath = $ExePath
$sc.WorkingDirectory = $InstallDir
$sc.IconLocation = $ExePath
$sc.Description = 'NOVYX — Premium Windows Performance'
$sc.Save()

$DesktopLnk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'NOVYX.lnk'
$dc = $WshShell.CreateShortcut($DesktopLnk)
$dc.TargetPath = $ExePath
$dc.WorkingDirectory = $InstallDir
$dc.IconLocation = $ExePath
$dc.Save()

# Skriv en Add/Remove-Programs post så brugeren kan afinstallere normalt.
$UninstallKey = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\NOVYX'
New-Item -Path $UninstallKey -Force | Out-Null
Set-ItemProperty -Path $UninstallKey -Name 'DisplayName'     -Value 'NOVYX'
Set-ItemProperty -Path $UninstallKey -Name 'DisplayVersion'  -Value $Version
Set-ItemProperty -Path $UninstallKey -Name 'Publisher'       -Value 'NOVYX'
Set-ItemProperty -Path $UninstallKey -Name 'InstallLocation' -Value $InstallDir
Set-ItemProperty -Path $UninstallKey -Name 'DisplayIcon'     -Value $ExePath
Set-ItemProperty -Path $UninstallKey -Name 'UninstallString' -Value 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "irm {{UNINSTALL_URL}} | iex"'
Set-ItemProperty -Path $UninstallKey -Name 'NoModify'        -Value 1 -Type DWord
Set-ItemProperty -Path $UninstallKey -Name 'NoRepair'        -Value 1 -Type DWord

Write-Ok "NOVYX v$Version installeret."
Write-Step "Starter NOVYX..."
Start-Process -FilePath $ExePath
Write-Ok "Færdig."
`;

const UPDATE_BODY = `
# Update = kør install igen. Install-scriptet stopper kørende instans
# og overskriver installationsmappen.
Write-Step "Kører opdatering (samme flow som install)..."
irm '{{INSTALL_URL}}' | iex
`;

const UNINSTALL_BODY = `
$InstallDir   = Join-Path $env:LOCALAPPDATA 'Programs\\NOVYX'
$StartMenuDir = Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs\\NOVYX'
$DesktopLnk   = Join-Path ([Environment]::GetFolderPath('Desktop')) 'NOVYX.lnk'
$UninstallKey = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\NOVYX'

Get-Process -Name 'NOVYX' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

if (Test-Path $InstallDir)   { Remove-Item $InstallDir -Recurse -Force -ErrorAction SilentlyContinue; Write-Ok "Fjernede $InstallDir" }
if (Test-Path $StartMenuDir) { Remove-Item $StartMenuDir -Recurse -Force -ErrorAction SilentlyContinue; Write-Ok "Fjernede Start-menu-genveje" }
if (Test-Path $DesktopLnk)   { Remove-Item $DesktopLnk -Force -ErrorAction SilentlyContinue; Write-Ok "Fjernede desktop-genvej" }
if (Test-Path $UninstallKey) { Remove-Item $UninstallKey -Recurse -Force -ErrorAction SilentlyContinue }

Write-Ok "NOVYX er afinstalleret."
`;

export function buildInstallScript(origin: string): string {
  return (HEADER + INSTALL_BODY)
    .replace("{{MANIFEST_URL}}", `${origin}/api/public/latest-version`)
    .replace("{{UNINSTALL_URL}}", `${origin}/api/public/uninstall.ps1`);
}

export function buildUpdateScript(origin: string): string {
  return (HEADER + UPDATE_BODY).replace("{{INSTALL_URL}}", `${origin}/api/public/install.ps1`);
}

export function buildUninstallScript(): string {
  return HEADER + UNINSTALL_BODY;
}
