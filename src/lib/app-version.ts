// Simpel download-konfiguration for NOVYX.
//
// To sandheder holdes adskilt:
//   SOURCE_VERSION      = versionen af den kode der ligger i repoet lige nu.
//   APP_VERSION.latest  = versionen af den SENESTE reelt downloadbare ZIP.
//
// Når SOURCE_VERSION > APP_VERSION.latest betyder det, at der findes nyere
// kildekode end den ZIP brugeren kan hente. Download-siden viser det tydeligt
// i stedet for at foregive at en ny build er publiceret.

// GitHub Release som kilde til download (stabil versionsstyring).
export const GITHUB_RELEASE_BASE =
  "https://github.com/g8643521-cmd/windows-performance-suite-a1314b46/releases/download/v0.15.0-a";

export const DOWNLOAD_PATH = `${GITHUB_RELEASE_BASE}/NOVYX-Setup-0.15.0-a.exe`;

// Nuværende kildekode-version (bumpes ved HVER kodeændring i desktop/).
export const SOURCE_VERSION = "0.15.0-a";
export const SOURCE_UPDATED = "2026-07-14";


export const APP_VERSION = {
  // "latest" = seneste downloadbare build (primær = Setup.exe).
  latest: "0.15.0-a",
  released: "2026-07-14",
  fileSize: "79,4 MB",
  fileSizeBytes: 83257515,
  extractedSize: "285 MB",
  filename: "NOVYX-Setup-0.15.0-a.exe",
  fileCount: 4211,
  sha256: "958d3e6567c2e774a8c01bc4db54a5cc36f61930f10f8d03c31ce28a676b4b20",
  electronVersion: "33.4.11",
  buildDate: "14. juli 2026",
  supportedOs: [
    "Windows 10 (64-bit)",
    "Windows 11 (64-bit)",
  ],
};

export const SOURCE_AHEAD_OF_BUILD = SOURCE_VERSION !== APP_VERSION.latest;


// -----------------------------------------------------------------------------
// Dual-download: Installer (NSIS .exe, primær) + Portable (ZIP, sekundær)
// -----------------------------------------------------------------------------
// Begge artefakter kommer fra SAMME kildekode og SAMME version, bygget via
// GitHub Actions (.github/workflows/build-windows.yml) og udgivet som GitHub
// Release for stabil versionsstyring.

export type DownloadKind = "installer" | "portable";

export type DownloadArtifact = {
  kind: DownloadKind;
  label: string;
  description: string;
  available: boolean;
  filename: string;
  path: string | null;
  sha256: string | null;
  fileSize: string | null;
  fileSizeBytes: number | null;
};

export const DOWNLOADS: Record<DownloadKind, DownloadArtifact> = {
  installer: {
    kind: "installer",
    label: "Windows Installer (anbefalet)",
    description:
      "Installationsguide med valgfri mappe, Start-menu og skrivebordsgenvej. Kan afinstalleres via Windows.",
    available: true,
    filename: "NOVYX-Setup-0.15.0-a.exe",
    path: `${GITHUB_RELEASE_BASE}/NOVYX-Setup-0.15.0-a.exe`,
    sha256: "958d3e6567c2e774a8c01bc4db54a5cc36f61930f10f8d03c31ce28a676b4b20",
    fileSize: "79,4 MB",
    fileSizeBytes: 83257515,
  },
  portable: {
    kind: "portable",
    label: "Portable ZIP",
    description:
      "Ingen installation. Udpak og kør NOVYX.exe direkte — efterlader ingen spor på systemet.",
    available: true,
    filename: "NOVYX-0.15.0-a-win-x64.zip",
    path: `${GITHUB_RELEASE_BASE}/NOVYX-0.15.0-a-win-x64.zip`,
    sha256: "d4cdc9036e2b52c2fe80acbc1ba5fbd30dcb6ff2b2ed9701933e233165ac6dee",
    fileSize: "108 MB",
    fileSizeBytes: 113461192,
  },
};



// HEAD-check for om en given artefakt findes. Vite dev serverer index.html som
// fallback, så vi filtrerer text/html fra så knappen ikke fejlagtigt vises som
// "aktiv".
export async function checkArtifactAvailable(artifact: DownloadArtifact): Promise<boolean> {
  if (!artifact.available || !artifact.path) return false;
  // Eksterne URLs (GitHub Releases) tillader ikke CORS HEAD-check fra browser.
  // Vi stoler på konfigurationen for absolute URLs.
  if (/^https?:\/\//i.test(artifact.path)) return true;
  try {
    const res = await fetch(artifact.path, { method: "HEAD" });
    if (!res.ok) return false;
    const type = res.headers.get("content-type") ?? "";
    if (type.includes("text/html")) return false;
    return true;
  } catch {
    return false;
  }
}


// Bagudkompatibel wrapper — bruges stadig af eksisterende komponenter.
export async function checkDownloadAvailable(): Promise<boolean> {
  return checkArtifactAvailable(DOWNLOADS.portable);
}

export type ReleaseType = "feature" | "fix" | "optimization" | "initial" | "security" | "performance";

export type ChangelogEntry = {
  version: string;
  date: string;         // YYYY-MM-DD
  time: string;         // HH:mm (24t, Europe/Copenhagen)
  type: ReleaseType;
  filename?: string;
  fileSize?: string;
  highlight?: string;
  notes: string[];
  /** True hvis der endnu ikke findes en downloadbar ZIP for denne version. */
  sourceOnly?: boolean;
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.15.0-a",
    date: "2026-07-14", time: "12:45", type: "feature",
    filename: "NOVYX-Setup-0.15.0-a.exe", fileSize: "79,4 MB",
    highlight: "Første officielle Windows-release via GitHub — NSIS installer som primær build",
    notes: [
      "Ny primær download: NOVYX-Setup-0.15.0-a.exe (NSIS installer, 79,4 MB) — installationsguide, Start-menu-genvej, skrivebordsgenvej, kan afinstalleres via Apps & Features",
      "Portable alternativ: NOVYX-0.15.0-a-win-x64.zip (108 MB) — ingen installation, udpak og kør",
      "Begge artefakter bygges via GitHub Actions og udgives som GitHub Release (v0.15.0-a) — stabil versionsstyring og direkte download-links",
      "SHA-256 (Setup.exe): 958d3e6567c2e774a8c01bc4db54a5cc36f61930f10f8d03c31ce28a676b4b20",
      "SHA-256 (Portable.zip): d4cdc9036e2b52c2fe80acbc1ba5fbd30dcb6ff2b2ed9701933e233165ac6dee",
      "M1 · Ægte Windows-data på Dashboardet: live CPU/RAM/GPU/disk, netværk (download/upload, ping mod 1.1.1.1 med jitter/tab), oppetid",
      "M1 · Systemstatus: Windows-version + build, BIOS/UEFI, Secure Boot, TPM, Windows Defender",
      "M1 · 'Seneste scanning' og 'Seneste optimering' huskes via userData/state.json",
      "M1 · 'Kør som administrator'-knap — genstarter NOVYX elevated via én UAC-prompt",
      "M2 · System Scan: PowerShell-baseret scanning af systemets sundhed",
      "M3 · Repair Center: 13 system-værktøjer (SFC, DISM, DNS flush m.fl.)",
      "M4 · Game Boost: launcher-detektion, registry-optimeringer og dashboard",
      "M5 · Hardware Center: fuld CIM-indsamling af hardware-data",
    ],
  },



  {
    version: "0.14.3-a",

    date: "2026-07-13", time: "18:05", type: "feature",
    filename: "NOVYX_v0.14.3-a.zip", fileSize: "117 MB",
    highlight: "Specs udvidet — flere GPU'er, skærme og drev vises hver for sig med fulde detaljer",
    notes: [
      "Specs: understøtter nu flere grafikkort, skærme og lagerenheder som separate rækker med egne primærværdier og detaljer — ingen skjulte komponenter længere",
      "Specs: alle sektioner har fået ekstra data — CPU viser producent + aktuel temperatur, RAM viser hvert modul separat med producent, drev viser SMART + interface, batteri viser sundhed, sensorer viser hver kerne, ny Operativsystem-sektion (distro, version, arkitektur, hostname)",
      "Fix: division-by-zero i procentberegning håndteres nu (returnerer '—' i stedet for at kunne crashe siden)",
      "Fix: rounded pill-form gælder nu også standalone .btn-primary/.btn-secondary/.btn-ghost — 'Scan igen' og 'Genindlæs'-knapperne var stadig firkantede uden det ydre .btn-class",
      "Version-badge opdateret til v0.14.3-a",
    ],
  },


  {
    version: "0.14.2-a",
    date: "2026-07-13", time: "17:55", type: "feature",
    filename: "NOVYX_v0.14.2-a.zip", fileSize: "117 MB",
    highlight: "Fejlbeskeder kan nu kopieres — én knap sender hele stack-tracen til udklipsholderen",
    notes: [
      "Ny ErrorBanner-komponent: fejlbesked vises i monospace, kan markeres frit, og en 'Kopiér'-knap sender hele teksten (inkl. Require stack og filsti) til udklipsholderen med visuel bekræftelse",
      "Anvendt på Boost, Scan (Systemtjek), Specs (Hardware) og Install — samme visuelle sprog og samme copy-flow overalt",
      "Version-badge i sidebar opdateret til v0.14.2-a",
    ],
  },


  {
    version: "0.14.1-a",
    date: "2026-07-13", time: "17:45", type: "fix",
    filename: "NOVYX_v0.14.1-a.zip", fileSize: "117 MB",
    highlight: "Kritisk fix — systeminformation blev ikke pakket med i v0.14.0-a. Alle systemtjek virker nu igen.",
    notes: [
      "Fix: node_modules blev ekskluderet af packageren, så 'systeminformation' manglede i ZIP'en — Boost, Scan og Specs viste 'Cannot find module' i stedet for rigtige data. Packager-ignore er rettet og prune=true tilføjet, så kun production-deps kommer med",
      "Design: alle knapper er nu fuldt afrundede (pill/circle) — primære, sekundære og ikon-knapper. Firkantede kanter er væk",
      "Build valideret: node_modules/systeminformation ligger nu i resources/app/node_modules som forventet",
    ],
  },


  {
    version: "0.14.0-a",
    date: "2026-07-13", time: "17:30", type: "feature",
    filename: "NOVYX_v0.14.0-a.zip", fileSize: "110 MB",
    highlight: "Ny navigation — Optimize / Your PC / Games / Maintenance / System med rigtige system-værktøjer",
    notes: [
      "Sidebar omstruktureret til fem grupper: Optimize (Boost, Scan), Your PC (Specs, Tweaks), Games (Arcade, Benchmark), Maintenance (Repairs, Install, Lab) og System (Settings)",
      "Boost: live CPU-belastning og RAM-forbrug (opdateres hvert 2. sek via systeminformation), top 20 processer efter hukommelse, og 'Ryd temp nu' der reelt sletter filer i din personlige %TEMP% og viser præcis frigivet plads, antal fjernede filer og skippede låste filer",
      "Scan: rigtige systemtjek — hukommelse, CPU-belastning, diskplads pr. drev, CPU-temperatur, temp-filer og oppetid — hvert med OK / anbefaling / advarsel og målt værdi. Kører automatisk ved åbning, kan køres igen manuelt",
      "Specs: den fulde hardware-oversigt (CPU, GPU, RAM, lagring, netværk, batteri, sensorer) fra systeminformation — som før, nu i sin egen sektion",
      "Tweaks: 10 direkte genveje til rigtige Windows-indstillinger via ms-settings: (Game Mode, grafik-præference, strømplan, opstartsprogrammer, Storage Sense, notifikationer, baggrundsapps, netværk, skærm, lyd) — NOVYX ændrer intet i registret uden bekræftelse",
      "Arcade: dit rigtige Steam- og Epic-bibliotek (uændret fra v0.13)",
      "Install: læser installerede programmer fra Windows Uninstall-registret via PowerShell (HKLM + HKCU, med og uden WOW6432Node), viser navn, udgiver, version og størrelse med søgefelt og genindlæs-knap",
      "Repairs: uændret — SFC + DISM, diskoprydning, netværksreset, driveropdatering, Defender, CHKDSK (alle via rigtige Windows-kommandoer med UAC-elevation)",
      "Benchmark og Lab: rene 'kommer snart'-tilstande. Der vises ikke tal, resultater eller falske funktioner før de kører rigtige målinger",
      "Streng ingen-fake-data-regel opretholdt overalt: manglende værdier vises som '—', ikke som opdigtede tal",
      "Nye IPC-kanaler: optimize:processes, optimize:tempInfo, optimize:cleanTemp, optimize:healthScan, tweaks:list, apps:list — alle læser fra lokal Windows-tilstand, ingen netværkskald",
      "Windows ZIP bygget fra samme kode og uploadet. SHA-256 996bb20f…905ea5",
    ],
  },

  {
    version: "0.13.0-a",
    date: "2026-07-13", time: "16:20", type: "feature",
    filename: "NOVYX_v0.13.0-a.zip", fileSize: "110 MB",
    highlight: "Fase 3 — Art Direction: identitet, scener, materialer og fysisk motion",
    notes: [
      "Art direction-lag lagt ovenpå designsystemet: per-side scener via data-page på app-shell, som styrer ambient lys, farvetemperatur og layout-rytme uden at ændre komponent-DNA",
      "Materialebibliotek: mat-frosted (kort, dialoger), mat-satin (sidebar), mat-acrylic (topbar), mat-matte (rails, indre flader) og mat-tinted (spotlight-elementer) — hver med egne skygger, refleks-linjer og indre highlight",
      "Skygge-tiers indført: sh-ambient, sh-contact, sh-directional og sh-soft — kort bruger nu forskellige skyggetyper afhængigt af rolle i stedet for én shadow overalt",
      "Typografi-identitet: display-xl (72px), display-lg (56px), display-md (40px), kicker (uppercase eyebrow), big-num og grad-text — teksten er en del af designet, ikke bare information",
      "Reactive-panel: sheen der følger musen via CSS radial-gradient + hover-lift med accent-ring — panels reagerer fysisk ved hover uden JS layout thrash",
      "Dashboard: cinematisk scene med stor 'god morgen'-hilsen, artefakt-orb til højre (radial gradient sphere med indre lys og halo-blur), asymmetrisk bento (1.4fr/1fr) med SVG-ghost graf-linje",
      "Games: hero med stor featured cover-tile (16:9 SVG-artwork med multi-radial gradient, scrim og top-sheen), grid af 3:4 cover-tiles med spring-lift ved hover — føles hurtigt og fysisk",
      "Hardware (tidligere Scan): stor 'chip'-illustration i heroen med pins, magasin-layout af 8 spec-rækker i stedet for uniform grid — hver række med glyph, titel, forklaring og pending-værdi",
      "Repair: rolige calm-rows (grid 68px/1fr/auto) med store forklaringer og detail-underlinjer, blødt skjold-symbol i heroen, tryghedschips (emerald 'fortrydelige ændringer') — ingen stress, ingen røde alarmer",
      "Settings: macOS-lignende to-panel med rail til venstre (grupperet i Program / System / Hjælp) og detail til højre — 7 sektioner med items der viser enten Switch eller ChevronRight afhængig af type",
      "Sidebar: nu mat-satin materiale med top-lyslinje og logo som objekt (indre radial-highlight på brand-monogrammet). Nav-items 'Scan' omdøbt til 'Hardware' og 'Repairs' til 'Repair' for kortere, klarere navigation",
      "Topbar: mat-acrylic materiale, større title-typografi (26px), samme søge- og handlingszone — differentieret materiale fra sidebar og indhold",
      "Skjulte lyskilder (.spot) og faint-grid drysses per side som subtile stemningslag; alt lys kommer fra bestemte retninger (hero, sidebar, topbar, primære knapper) i stedet for tilfældigt fordelt",
      "Fysisk motion: settle-keyframe (spring-ease, opacity + translateY + scale-overshoot) erstatter fade-up på pages og lister — kort 'falder på plads' med små staggered delays",
      "Nav aktiv-glød: radial-gradient bag ikonet der følger nav-item-formen, ikke bare en flad baggrundsfarve",
      "Farvebrug strammet: accenten (blå #3B82F6 → cyan #22D3EE) bruges nu kun på hero-gradient-tekst, primære knapper, mat-tinted-elementer og aktive nav — 80% neutrale mørke toner, 15% lyse toner, 5% accent",
      "Rettet legacy magenta-rgba(192,38,255) rest i Pending/GlassCard-ikonet — nu blå, matcher resten af systemet",
      "Streng ingen-backend-regel opretholdt: alle værdier stadig '—' + 'Afventer scanning', ingen fake CPU/RAM/GPU/FPS/temperatur",
      "Kildekode-only bump: v0.13.0-a låser art direction-fundamentet. Downloadsiden peger fortsat på v0.10.1-a ZIP indtil næste pakkede build",
    ],
  },

  {
    version: "0.10.1-a",

    date: "2026-07-13", time: "15:10", type: "optimization",
    filename: "NOVYX_v0.10.1-a.zip", fileSize: "110 MB",
    highlight: "Fase 2 — Design QA & Premium Finish: samlet designsystem, komplet komponentbibliotek",
    notes: [
      "Ét canonical design-token-system i styles.css: farver, glass, blur, radii (--r-card 24px, --r-hero 32px, --r-pill), shadows, spacing (4→48), knap-højder (--h-btn 40px), ikonstørrelser og motion-kurver — alle komponenter henter fra tokens, ingen individuelle værdier tilbage",
      "Rettet et alvorligt Lightning CSS-problem: dobbelte '-webkit-backdrop-filter' + 'backdrop-filter' blev dedupet ved build og efterlod kun webkit-varianten — som Chrome/Chromium ignorerer, så glassmorphism forsvandt i produktion. Alle håndskrevne -webkit-prefixes fjernet; build-pipelinen håndterer prefixing korrekt",
      "Nyt komponentbibliotek: .hero-panel (én utility for alle sider), .page-container (ens padding/max-width), .empty-state, .switch (glidende thumb med spring-ease), .tabs (segmenteret pill-kontrol), .toast, .modal (zoom-ind), .progress + .progress--indeterminate, .skeleton (shimmer), .badge, .status-dot (ok/warn/danger), .chip (accent/emerald/amber/rose/info/pending) og [data-tooltip] CSS-tooltip",
      "Knapper harmoniseret: alle .btn er nu 40px høje, samme pill-radius, samme transitions og hover-mikroanimation (translateY -1px + øget skygge). Sekundær-, danger- og ghost-varianter deler præcis samme mål",
      "Kort standardiseret: alle glass-cards bruger --r-card (24px) radius og --card-pad (28px) padding. Kort løftes ensartet 3px ved hover med lilla glow og border-highlight",
      "Hero-paneler samlet i én .hero-panel-klasse (og .hero-panel--alt til Games): samme radius, blur, border og shadow — Dashboard, Games, Scan, Repairs og Settings deler nu præcis samme hero-anatomi",
      "Ikoner ens: 18/20px stroke 1.75, samme grad-primary-soft baggrund med rgba(192,38,255,0.22) border overalt",
      "Scrollbars: 10px tynde, transparent track, afrundet thumb, lilla accent på hover; Firefox scrollbar-width thin + scrollbar-color sat — ingen native Windows-scrollbars",
      "Fokus-tilstand: :focus-visible viser 2px lilla outline med 2px offset — konsistent på alle interaktive elementer",
      "Sideovergange: page-fade cross-fader mellem sider (260ms ease-out) og fade-up staggerer kortene ind ved indlæsning",
      "GPU-accelererede animationer: alle transitions bruger kun transform/opacity/box-shadow — ingen layout thrash, respekterer prefers-reduced-motion",
      "Streng ingen-backend-regel opretholdt: alle dynamiske felter viser fortsat '—' eller 'Ikke tilgængelig endnu' — ingen fake CPU/RAM/GPU/FPS/temperatur",
      "Kildekode-only (ingen ny ZIP): designfasen er nu låst og klar til fase 3 (systemdata + funktionalitet). Downloadsiden viser fortsat v0.10.0-a indtil næste ZIP-build",
    ],
  },

  {
    version: "0.10.0-a",
    date: "2026-07-13", time: "14:20", type: "feature",
    filename: "NOVYX_v0.10.0-a.zip", fileSize: "110 MB",
    highlight: "Premium glassmorphism redesign — fase 1: kun visuelt design, ingen fake data",
    notes: [
      "Total UI-omskrivning til premium glassmorphism/translucent design med neon lilla/pink accent (#C026FF) og dyb violet (#7C3AED)",
      "Ambient app-baggrund: mørk (#0B0B12) med bløde radial-gradienter i lilla, violet og cyan for dybde",
      "Sidebar: 280px translucent glass-panel med blur, gradient-brand-monogram og aktiv menu med lilla glow",
      "TopBar: transparent glass med afrundet pill-søgebar og glass-icon-knapper — ingen tunge borders",
      "Hovedpaneler bruger backdrop-filter blur 24–40px, rgba(18,18,28,0.45) baggrund, 24–32px radius og subtile borders (rgba(255,255,255,0.08))",
      "Store afrundede kort med card-lift hover (transform + neon-glow) og 24–32px spacing mellem sektioner",
      "Pill-knapper: primær med lilla gradient + blød neon-glød, sekundær transparent glass, danger mørk rød glass",
      "Dashboard: stor hero med system-score-ring, KPI-grid (CPU/RAM/GPU/Lager), aktivitet + anbefalinger — alle værdier tomme med 'Ikke tilgængelig endnu'",
      "Scan: 8 spec-kort med ens højde, ikon øverst til venstre, uppercase-titel — ingen tal før backend",
      "Games: hero med Auto Game Mode toggle, filter-chips, søgebar og empty-state — ingen fake spil",
      "Repairs: 6 store værktøjs-kort (Systemreparation · Diskoprydning · Netværksreset · Driveropdatering · Sikkerhed · Lager) — alle disabled indtil admin-broen er på",
      "Settings: 4 sektioner (Rollback · Sikkerhed · Support · Beta-adgang) med store glass-paneler og pill-handlinger",
      "Streng ingen-fake-data-regel: alle CPU%, RAM%, temperatur, FPS, lager og netværksmålinger vises som '—' + 'Afventer backend'",
      "Electron: GPU-compositing genaktiveret via ANGLE d3d11, gpu-rasterization og zero-copy — nødvendigt for backdrop-filter at rendere korrekt",
      "Motion-budget: 200ms ease-out på hover, 250ms fade-up ved indlæsning, respekterer prefers-reduced-motion",
      "Fase 2 (systemdata, scanninger, tweaks, rollback) starter først når dette design er godkendt",
    ],
  },

  {
    version: "0.9.9-a",
    date: "2026-07-13", time: "13:56", type: "fix",
    filename: "NOVYX_v0.9.9-a.zip", fileSize: "110 MB",
    highlight: "Mousemove/compositor-fix — skarphed bevares efter første repaint",
    notes: [
      "Root-cause-sporet er flyttet fra font/CSS-kosmetik til rendering/compositor: fejlen opstod først ved første pointer-repaint, ikke ved app-start",
      "Electron er sat på en stabil software-compositing path for NOVYX' 2D desktop-UI: hardware acceleration, GPU compositing/rasterization, accelerated 2D canvas og DirectComposition er deaktiveret",
      "Chromium-features der kan oprette driver-afhængige overlay-/occlusion-lag ved mousemove er slået fra: DirectComposition, native window occlusion og overlay scrollbar",
      "CSS app-region drag/no-drag er neutraliseret, fordi appen allerede bruger native frame:true, og CSS hit-test regions kan aktivere nye lag ved første cursorbevægelse",
      "Alle app-shell transitions/animations/will-change er tvangsstoppet globalt, så hover ikke kan starte en overgang eller GPU layer-promotion",
      "Målrettede contain:layout/paint/style-isolationer er fjernet fra App shell, panels, Games, Settings og live-metric cards, så første hover ikke opretter nye paint-containment lag",
      "Tilføjet udviklings-audit ved første pointermove, som kontrollerer filter, backdrop-filter, transform, contain, will-change, transition og animation efter første repaint",
      "Verificeret i kørende Electron-runtime med ren v0.9.9-a session: screenshot før mousemove og efter gentagne mousemoves er visuelt ens og skarpe",
      "Audit-resultat før og efter mousemove: riskyCount 0, root filter none, root transform none, ingen risky compositor-styles",
      "Ny Windows ZIP er bygget fra samme verificerede kode og uploadet som download-asset. SHA-256 f2081d52…c4dec8a",
    ],
  },

  {
    version: "0.9.8-a",
    date: "2026-07-13", time: "13:45", type: "fix",
    filename: "NOVYX_v0.9.8-a.zip", fileSize: "110 MB",
    highlight: "Visuel kvalitets-release — verificeret i kørende Electron-desktop før udgivelse",
    notes: [
      "Root-cause fundet og rettet: UI'et brugte mange 9–12.5px og halve fontstørrelser, som giver subpixel-blød/pixeleret tekst i Chromium/Electron",
      "Global renderer-guard normaliserer ældre arbitrary Tailwind-tekstklasser til integer-størrelser og minimum 11–14px, så tekst ikke længere renderes som webfont-slør",
      "Skiftet til statisk Segoe UI font-stack i desktop-rendereren og subpixel-antialiasing, så Windows/ClearType får en mere native og skarp tekstprofil",
      "Kontrast hævet i hele designsystemet: mørkere opake flader, lysere teksttokens og stærkere 1px hairlines, uden glow, blur eller store skygger",
      "Alle synlige unicode-glyffer i Dashboard, Scan, Repairs, Settings og søgefelter er erstattet af et samlet SVG-ikonbibliotek med ens stroke og skarpere rasterisering",
      "Verificeret i en rigtig Electron-runtime via file:// build på Dashboard, Games, Scan, Repairs og Settings. Testresultat: 0 halve/små fontstørrelser, 0 filter/backdrop/box-shadow-effekter, 0 gamle glyph-symboler",
      "Før/efter-sammenligning udført med screenshots: ny build fremstår mørkere, skarpere, mere kontrastfuld og mere konsistent som Windows-desktopsoftware",
      "Ny Windows ZIP bygget fra samme verificerede kode, uploadet og koblet på download-siden. SHA-256 a49aeaf3…a61960e",
    ],
  },

  {
    version: "0.9.7-a",
    date: "2026-07-13", time: "13:10", type: "fix",
    filename: "NOVYX_v0.9.7-a.zip", fileSize: "110 MB",
    highlight: "Native Windows-rendering sweep — blur, overlays, glow og gammel build fjernet",
    notes: [
      "Stop for nye funktioner: denne release ændrer kun visuel kvalitet, renderer-adfærd og release-synkronisering",
      "Electron-vinduet er gjort konservativt og opakt: hidden titlebar fjernet, baggrund matcher appens flade #1c1c1c-surface, zoom låses til 1.0, og forced DPI/zero-copy/ignore-gpu paths bruges ikke",
      "Renderer-CSS fjerner alle blur/backdrop/filter/shadow-lag globalt i app-shell; visuel test rapporterede 0 elementer med filter, backdrop-filter eller box-shadow",
      "Typografi bruger fortsat Segoe UI Variable/System UI uden ekstra antialias-smoothing; letter-spacing nulstilles globalt, så teksten ikke får webfont-/subpixel-look",
      "Kontrast hævet: ink-tokens er gjort lysere (#f1f1f1 / #c8c8c8 / #969696), paneler er fuldt opake, og gennemsigtige hvide/sorte alpha-overlays er fjernet fra rendererens kritiske flader",
      "Accent-systemet er gjort fladt Windows Blue (#60cdff). Tidligere lilla/cyan gradients og soft-glow-accenter returnerer nu solide farver",
      "Games-hero rettet efter visuel kontrol: lange 'Ikke tilgængelig'-værdier i KPI-rækken er erstattet af dash + pending-chip, så tekst ikke overlapper",
      "Preview verificeret med Playwright på Dashboard, Games, Scan, Repairs og Settings: ingen console warnings/errors, v0.9.7-a synlig i Sidebar og Settings, og effektscan = 0 blur/filter/backdrop/shadow",
      "Ny Windows ZIP er bygget fra præcis samme kode og uploadet. SHA-256 cc0beb99…be32c79. Download-side, versionshistorik og latest-version API peger nu på v0.9.7-a",
    ],
  },

  {
    version: "0.9.6-a",
    date: "2026-07-13", time: "12:50", type: "performance",
    filename: "NOVYX_v0.9.6-a.zip", fileSize: "109 MB",
    highlight: "DOM-diæt + memoization — Settings −47% DOM, Repairs −39% DOM, alle sideskift under ét frame",
    notes: [
      "Settings splittet: kun den aktive sektion (General/Startup/Updates/Performance/Notifications/Logs/Backup/About) findes i DOM'en. scrollIntoView fjernet — sektionerne mountes/unmountes ved klik i stedet",
      "Repairs default-kategori ændret fra 'Alle' (24 værktøjer) til 'System' (6 værktøjer). 'Alle' er nu et bevidst opt-in valg og bruger contentVisibility:auto per kort så off-screen kort ikke rendes",
      "Alle side-komponenter (Dashboard, Games, Scan, Repairs, Settings) wrapped i React.memo — inaktive keep-alive sider re-renderer ikke længere ved setRoute i shell",
      "Målt effekt (samme headless-audit før/efter): Settings DOM 1707→909 (−47%), Repairs DOM 1315→805 (−39%), Settings first-nav 133ms→50ms (−63%), Repairs first-nav 109ms→80ms (−27%), return-nav long tasks 122ms→0ms",
      "Ingen visuelle glitches ved 3× rapid nav-loop hen over alle 5 sider. Tekst-skarphed uændret (Segoe UI Variable, native ClearType)",
      "Ingen falske data: alle Windows-afhængige felter viser eksplicit 'Ikke tilgængelig' eller 'Afventer Windows-data'",
      "Windows-binær bygget via cross-compile (electron-packager win32-x64, Electron 33.4.11). SHA-256 d5d5506a…b640c. 109 MB ZIP publiceret via Lovable CDN",
    ],
  },


  {
    version: "0.9.5-b",
    date: "2026-07-10", time: "10:30", type: "fix",
    sourceOnly: true,
    highlight: "Rendering root-cause fix — overlays fjernet, ingen Settings/Repairs heartbeat, konservativ compositor-path",
    notes: [
      "Problemet skyldtes ikke FPS alene: faste scrim-/toast-overlays plus page-level live-hooks efterlod mørke/stale compositor-lag, mens Settings og Repairs stadig re-renderede hele siden hvert sekund",
      "Fjernet de mørke full-window scrims fra Repair/Game drawers — åbne paneler lægger ikke længere et gennemsigtigt sort lag over hele UI'et",
      "Settings-flash ændret fra fixed overlay til almindelig inline-status, og Live diagnostik-overlay-indstillingen er fjernet fra UI'et så programmet ikke længere introducerer overlay-lag",
      "Settings og Repairs læser uptime/heap point-in-time i stedet for via useUptimeMs/useHeapMb i page-root — ingen 1Hz full-page reconciliation på de sider længere",
      "App-root abonnerer nu på settings uden at re-rendere hele shell'en ved hver indstillingsændring; CSS-variabler opdateres direkte på documentElement",
      "Electron main er rullet tilbage fra aggressive compositor-overrides: zero-copy og ignore-gpu-blocklist er fjernet, fordi de kan give mørke/stale alpha-lag på visse Windows/GPU-driver-kombinationer",
      "Root/main CSS bruger opake flader uden isolation/strict containment og uden global blur/filter-selector overrides, så Chromium ikke tvinges til unødige compositor-lag",
      "Ingen ny downloadfil er publiceret i denne changelog-entry endnu — download-siden peger fortsat på seneste pakkede build",
    ],
  },

  {
    version: "0.9.5-a",
    date: "2026-07-10", time: "09:00", type: "performance",
    filename: "NOVYX_v0.9.5-a.zip", fileSize: "110 MB",
    highlight: "Renderer-perf sweep — silkeblød scroll, skarpere tekst, native Windows font-stak",
    notes: [
      "Root-cause for stutter/blur/rerender-følelse: useUptimeMs (1s) og useHeapMb (2s) tikkede i toppen af Dashboard og Scan → hele siden re-renderede hvert sekund, hvilket forklarede 'hele vinduet virker til at blive rerenderet', tung scroll og faldende FPS",
      "Isoleret live-værdier i egne mikro-komponenter (LiveUptimeMetric, LiveHeapMetric): kun de enkelte celler opdaterer nu — resten af siden rører sig ikke. Dashboard og Scan er reelt statiske under normal brug",
      "Scan: uptime og heap læses point-in-time når scanningen starter, ikke løbende — Scan-siden re-renderer ikke længere hvert sekund",
      "Fjernet key={route} i App.tsx: React unmounted/remountede tidligere HELE indholdssubtreet ved hver navigation — dét gav 'ikke flydende sideskift'. Nu skifter reconciler mellem sider uden teardown",
      "Sidebar og TopBar wrapped i React.memo: parent re-renders forplanter sig ikke længere ned i navigationens DOM-træ",
      "Remote font @import fjernet (rsms.me/inter + Google JetBrains Mono) — de blokerede CSS-parse ved opstart og forårsagede FOUT-flash. Vi bruger nu Windows' native font-stak: Segoe UI Variable Display/Text + Cascadia Mono → skarpere ClearType, nul netværks-fetch, nul startup-flimmer",
      "Fjernet -webkit-font-smoothing: antialiased — dét tynder Segoe UI ud på LCD-panels og gav den 'grå/uskarpe' fornemmelse. Chromium bruger nu native ClearType-rendering",
      "Fjernet text-rendering: optimizeLegibility — den forcerer subpixel-positionering per glyph og bremser store tekstblokke uden synlig gevinst",
      "Electron main: enable-gpu-rasterization, enable-zero-copy, enable-accelerated-2d-canvas, ignore-gpu-blocklist, use-angle=d3d11, enable-smooth-scrolling — Chromium falder ikke længere tilbage til software-compositor på ældre GPU-drivere. D3D11-backend er den mest stabile compositor-path på moderne Windows",
      "Electron main: disable-renderer-backgrounding, disable-background-timer-throttling, disable-backgrounding-occluded-windows + backgroundThrottling:false — baggrundstimers stopper ikke længere når vinduet mister fokus, så første frame efter re-fokus er øjeblikkelig i stedet for 'vinduet vågner op'-ryk",
      "Electron main: paintWhenInitiallyHidden så første frame er tegnet før show() — fjerner det hvide flash ved app-start",
      "Scan-log: scrollTo behavior ændret fra 'smooth' til 'auto' — hurtige log-updates startede tidligere en ny smooth-animation ovenpå den forrige og gav præcis den hakkende auto-scroll man kunne se",
      "MetricShell wrapped i contain:layout paint style — hver metric-celle repainter isoleret uden at trigge relayout på nabo-cellerne",
      "Ingen designændringer, ingen nye funktioner, ingen ændret data — kun renderer-adfærd. Programmet skal nu føles som en native Windows-app frem for en hjemmeside pakket ind i Electron",
    ],
  },

  {
    version: "0.9.4-b",
    date: "2026-07-09", time: "13:05", type: "fix",
    filename: "NOVYX_v0.9.4-b.zip", fileSize: "110 MB",
    highlight: "Kvalitets-sweep: død navigation fjernet, mount-animation neutraliseret, nested-button-bug rettet",
    notes: [
      "Root-cause for oplevet 'dårlig kvalitet': sidebar viste 8 menupunkter (Boost, Tweaks, Browser Cleaner, Disk Cleaner, DNS Manager, Startup, Hardware, Diagnostics) uden tilhørende routes — klik gjorde ingenting, hvilket fik hele appen til at føles ustabil",
      "Sidebar trimmet til de 5 reelle routes: Dashboard · Games · Scan · Repairs · Settings — ingen døde links længere",
      "Dashboard-hero viste hardcoded v0.9.0-b i stedet for den aktuelle version — bumpet til den aktive APP_VERSION (v0.9.4-b)",
      "Repair Center ToolCard havde <button> inde i <button> (favorit-toggle indlejret i klikbart kort) → invalid DOM-nesting, kilde til Chromium-hydration-warnings og lejlighedsvis 'glitch' i hover/klik-state. Ydre kort konverteret til role=button div med onKeyDown, favorit-knap forbliver egen <button> med stopPropagation",
      "Compositor-hærdning: .fade-up mount-animation (translateY + opacity) neutraliseret globalt — samme klasse fejl som v0.9.2-a/v0.9.3-a hvor transform-baserede mount-animationer efterlod stale layer-bitmaps ved kategoriskift på tværs af Dashboard, Scan, Repairs og Games",
      "Testet ved headless-Chromium med hurtige gentagne kategoriskift (Dashboard→Games→Settings→Repairs→Scan i loop): ingen visuelle artefakter, ingen console errors, ingen warnings",
      "Ingen ændringer i layout, spacing, typografi eller funktionalitet — kun død navigation, forkert version og nested-button er rørt",
    ],
  },

  {
    version: "0.9.4-a",
    date: "2026-07-09", time: "12:45", type: "feature",
    filename: "NOVYX_v0.9.4-a.zip", fileSize: "110 MB",
    highlight: "Games v1.0 — total redesign som programmets flagskib",
    notes: [
      "Games-siden bygget helt om som premium launcher + optimizer, inspireret af Steam, NVIDIA App, AMD Adrenalin, Discord, Arc, Linear og Riot Client — uden at kopiere deres design",
      "Streng ingen-opdigtede-data-regel indført: FPS, temperatur, GPU-load, driver, sti, spilletid — alt der kræver Windows-/sensor-tjeneste vises som 'Afventer live data', 'Ikke tilgængelig' eller 'Ikke fundet endnu'",
      "Hero: brand-eyebrow, stor titel, beskrivelse og 5-KPI-linje (Fundne spil · Seneste scanning · Aktiv profil · GPU · Driver) — alle værdier er reelle eller tydeligt markeret pending",
      "Illustrativt hero-panel til højre: statisk SVG-grid, koncentrisk radar og diskret cyan-glow — ingen kraftige effekter, ingen animation, ingen blur",
      "Filterbar med 10 platforme: Alle · Steam · Epic · Battle.net · EA · Ubisoft · Xbox · Andre · Favoritter · Installerede",
      "Stor søgelinje med / genvej — filtrerer biblioteket øjeblikkeligt",
      "Bibliotek klar til automatisk detektion: card-grid (cover · titel · platform · status-pill) — indtil tjenesten kobles på vises en dedikeret 'Ikke fundet endnu'-empty-state",
      "Status-pills: Klar · Kræver scanning · Ikke optimeret · Optimeret (med semantiske farve-tokens)",
      "Inspector som ægte sidepanel — ingen popup, ingen modal — med alle sektioner: header, Performance, Profil, Tweaks, Analyse, Spilinformation, Historik",
      "13 tweak-kort katalogiseret: Game Mode · HAGS · Fullscreen Optimizations · Power Plan · Timer Resolution · NVIDIA Reflex · AMD Anti-Lag · MMCSS · CPU Priority · Background Services · Memory Cleanup · Shader Cache · Network Optimizations",
      "Hvert tweak viser titel, beskrivelse, påvirkning, admin-krav, anbefalings-markering og pending-status indtil bro er klar",
      "Profil-vælger: Balanced · Performance · Competitive · Quality · Custom — lokal state, faktisk anvendelse afventer Windows-broen",
      "Analyse-panel viser hvad der potentielt begrænser spillet (CPU/GPU/RAM/VRAM/Disk/Baggrundsprocesser/Driver/Windows) — alle markeret pending, ingen gæt",
      "Design: mat sort, mørk grå, kold blå og diskret cyan — meget få accentfarver, store radius, professionel spacing, ingen store gradients, ingen neon, ingen kraftige glows",
      "Motion-budget: alle transitions ≤ 150 ms, kun opacity/farve, ingen blur, ingen tunge effekter — programmet føles øjeblikkeligt",
      "Compositor-disciplin: contain:layout paint på alle paneler og cards for at forhindre samme klasse fejl som v0.9.2-a / v0.9.3-a",
      "Genbrug af eksisterende designsystem: panel-elevated, hairlines, ink-tokens, samme typografi som Dashboard/Scan/Repairs/Settings — Games føles som en naturlig del af programmet",
      "Alt tidligere fake indhold (MOCK_GAMES, opdigtede FPS-tal, fake temperaturer, fiktive hardware-readouts) fjernet fra Games-fladen",
    ],
  },

  {
    version: "0.9.3-b",
    date: "2026-07-09", time: "12:22", type: "fix",
    filename: "NOVYX_v0.9.3-b.zip", fileSize: "110 MB",
    highlight: "Fikser glitch/gennemsigtighed ved kategoriskift til/fra Settings",
    notes: [
      "Root-cause: v0.9.3-a Settings-siden genindførte samme klasse fejl som v0.9.2-a — alpha-baggrunde (/80 chips), sticky flash-toast og fade-up på 8 tunge paneler + smooth scrollIntoView efterlod stale compositor-bitmaps ved kategoriskift",
      "Fjernet fade-up-animation fra alle Settings-paneler (Panel-primitive) og fra hero — ingen mount-animation der skaber layer-composites når siden vises",
      "Fjernet alpha på hero-chips: bg-[color:var(--bg-panel)]/80 → bg-[color:var(--bg-panel)] (fuldt opak, ingen gennemsigtighed compositoren kan misforstå)",
      "Flash-toast konverteret fra sticky til fixed positioning — sticky-elementer inde i overflow-y-auto tvinger nye compositor-lag som ikke ryddes ved unmount",
      "Fjernet fade-up på flash-toast — vises/skjules nu instant uden transform-animation",
      "scrollIntoView ændret fra behavior:'smooth' til behavior:'auto' — ingen lang smooth-scroll animation der konstant repainter under kategori-jump",
      "Tilføjet contain:layout paint på Panel-primitive, hero-header og indholds-scroll-container — isolerer repaint til hvert panel, forhindrer læk mellem lag",
      "Ingen visuelle ændringer i layout, spacing, typografi eller funktionalitet — kun compositor-adfærd er ændret",
      "Programmet reagerer nu jævnt ved navigation mellem alle 5 kategorier (Dashboard · Games · Scan · Repairs · Settings)",
    ],
  },

  {
    version: "0.9.3-a",
    date: "2026-07-09", time: "12:05", type: "feature",
    filename: "NOVYX_v0.9.3-a.zip", fileSize: "110 MB",
    highlight: "Settings — komplet programfundament med sprog, opstart, opdateringer, ydelse, backup og Om",
    notes: [
      "Ny Settings-side bygget på Dashboard/Repairs-designsystemet — panel-elevated, hairlines, motion, samme spacing og typografi",
      "Dedikeret venstre kategori-nav med grupper (Program · System · Data), aktiv indikator og glat scroll til hver sektion",
      "Hero med brand-eyebrow, live online-status, versionschip og radial top-hairline",
      "8 sektioner: Generelt · Opstart · Opdateringer · Ydelse · Notifikationer · Logning & diagnostik · Backup & nulstilling · Om NOVYX",
      "Fungerende lokale indstillinger: sprog (dansk/engelsk), accentfarve (cyan-violet, emerald, amber, rose), reduceret bevægelse, kompakt spacing, tabular tal, live diagnostik-overlay",
      "Persistens: localStorage under nøglen 'novyx.settings.v1' — reactive useSettings-hook opdaterer hele UI'et øjeblikkeligt",
      "Fungerende backup: eksportér indstillinger som .json, importér .json med validering og fejlmeddelelse, nulstil med to-trins bekræftelse (annullér/bekræft)",
      "Kun-rigtige-data-regel: alt der kræver Windows-tjeneste (Start med Windows, systray, auto-opdatering, notifikationer, log-niveau, cache-rydning) er markeret 'Afventer Windows-tjeneste' med dashed pill + deaktiveret toggle",
      "Om-panel: version, build-dato, Electron, licens, distribution — plus live systeminfo (platform, kerner, enhedshukommelse, JS heap, netværk, session uptime)",
      "Kopiér systemrapport-knap: samler alle værdier som ren tekst til clipboard for supportsager",
      "Direkte link til changelog fra Om-sektionen",
      "Flash-toast for handlinger: 'Eksporteret', 'Importeret', 'Nulstillet', 'Kopieret' — auto-forsvinder efter 2.4 s",
      "Navigation: sidebar → Settings nu klikbar, top-bar viser Programfundament-crumb",
      "Ingen telemetri, ingen cloud, ingen simulerede resultater — Settings er ren lokal kontrol",
    ],
  },

  {
    version: "0.9.2-b",
    date: "2026-07-09", time: "11:44", type: "fix",
    filename: "NOVYX_v0.9.2-b.zip", fileSize: "110 MB",
    highlight: "Fikser glitch/flimmer og gennemsigtighed ved kategoriskift i Repair Center",
    notes: [
      "Root-cause: backdrop-blur + animeret aurora-blur efterlod stale layer-bitmaps i Chromiums compositor når kategori-state ændrede sig — samme klasse fejl som v0.2.x/v0.3.x rettelserne",
      "Fjernet ALLE backdrop-blur-klasser fra rendereren (Sidebar, Repairs, Dashboard, Games, ContextMenu, GameDetailDrawer, GameCard) — ingen frame-by-frame re-sampling af underliggende lag",
      "Aurora-lag (::before / ::after med filter: blur(120px) og animation) fjernet — erstattet af statiske radial-gradients bagt ind i app-shell background",
      "Main-flade tvunget uigennemsigtig: bg-base + isolation: isolate + contain: layout paint på <main>, så repaint ved kategoriskift ikke lækker gennem til sidebar-laget",
      "Sidebar er nu helt opak (bg-panel uden alpha) med relative z-10 — ingen transparens der kan afsløre stale bitmaps",
      "Ingen visuelle ændringer i layout, spacing, typografi eller motion — kun compositor-adfærd er ændret",
      "Programmet føles hurtigere: mindre GPU-arbejde pr. frame, ingen ekstra layer-composites ved state-ændringer",
    ],
  },

  {
    version: "0.9.2-a",
    date: "2026-07-09", time: "11:34", type: "feature",
    filename: "NOVYX_v0.9.2-a.zip", fileSize: "110 MB",
    highlight: "Repair Center — premium redesign af hele Repairs-siden",
    notes: [
      "Nyt Repair Center bygget fra bunden på Dashboard/Scan/Games-designsystemet — samme paneler, spacing, typografi og motion",
      "Hero med brand-eyebrow, radial gradient-glow, subtil top-hairline og dedikeret System Status-pod (Healthy · Session · Administrator)",
      "Fire hovedkategorier: System · Storage · Network · Recovery — hver med værktøjstal og kort beskrivelse, klikbar filtrering",
      "26 værktøjer katalogiseret: Windows Repair, DISM, SFC, Registry Check, Services, System Restore, Disk/Browser/Temp/Prefetch/Recycle/Update/Shader Cache/Crash/Memory Dumps/Windows Logs, Flush DNS, Winsock, TCP/IP, Internet Repair, Network Cache, Restore Points, Rollback, Backup, Export Settings",
      "Kortlayout: ikon-chip, titel, kort beskrivelse, status-pill, admin, sidst kørt, estimeret tid, risikoniveau — pixel-perfect grid med ens meta-celler",
      "Højre inspector-panel (ikke modal): hvad værktøjet gør, hvad der ændres, risici, anbefaling, varighed, live output-terminal, Run Repair med confirm-step",
      "Streng ‘kun rigtige data’-regel: alle værktøjer markeret ‘Afventer Windows-tjeneste’ indtil PowerShell-broen kobles på — ingen simulerede resultater, ingen fake sidst-kørt-datoer",
      "Søgelinje med / genvej og øjeblikkelig filtrering på titel + beskrivelse",
      "Filter-pills: Alle · Favoritter · Anbefalede · Administrator · Sikre — favoritter sorteres først automatisk",
      "Stjerne-toggle pr. værktøj med lokal favorit-state",
      "Repair history-panel med empty-state — klar til Windows-tjeneste",
      "Motion-budget overholdt: kun opacity/scale, alt under 180 ms, respekterer prefers-reduced-motion",
      "Navigation: sidebar → Repairs nu klikbar, top-bar viser Repair Center-crumb",
    ],
  },
  {
    version: "0.9.1-a",
    date: "2026-07-09", time: "11:22", type: "feature",
    filename: "NOVYX_v0.9.1-a.zip", fileSize: "110 MB",
    highlight: "Scan 3.0 — nyt intelligence center bygget på Dashboard/Games-designsystemet",
    notes: [
      "Ny Scan-side som programmets intelligence center: hero, live progress, kategori-grid, fund-detalje og sidepanel",
      "Fase-baseret analyse-engine: 10 sekventielle probes med real-time log, progress-bar og aktuel modul-etiket",
      "Hver probe rapporterer ægte observation eller markeres ‘Systemtjeneste ikke tilgængelig’ — aldrig fiktive fund",
      "8 kategorier (Performance, Storage, Startup, Network, Security, Gaming, Windows, Browser) med status-badges: Ikke scannet · Analyserer · Ingen fund · Kræver handling · Ikke tilgængelig",
      "Fund-kort med severity-dot, kategori-eyebrow, forklaring, anbefalet handling og modul-CTA",
      "Sidepanel: scanoversigt (fund, moduler, utilgængelige tjenester, varighed), næste handling, historik med tidligere kørsler",
      "Realtidslog i monospace-terminal med farvekodede status-tegn (✓ / ! / —) og auto-scroll",
      "Afbryd-knap under scanning — abort-flag stopper pipelinen mellem faser uden at hænge",
      "Navigation: sidebar → Scan nu klikbar, top-bar viser Intelligence Center-crumb",
      "Genbrug af designsystem: samme panel-elevated, hairlines, aurora-lag, typografi, empty-states og motion",
    ],
  },
  {
    version: "0.9.0-b",
    date: "2026-07-09", time: "11:17", type: "optimization",
    filename: "NOVYX_v0.9.0-b.zip", fileSize: "110 MB",
    highlight: "Dashboard polish — pixel-for-pixel gennemgang, ingen nye features",
    notes: [
      "Hero: strammere spacing, ny brand-eyebrow, radial gradient-glow, subtil top-hairline, ny primær-CTA med shortcut-chip og fokus-ring",
      "Metric-strip: nye Metric-kort med accent-hairline, tighter tracking, dedikeret ‘Ikke tilgængelig’-typografi, tabular-nums og roligere hover",
      "Rows: konsistent 2.5-vertikal rytme, muted labels, valgfrie hint-linjer, tighter divider-opacity — samme visuelle rytme på tværs af sektioner",
      "‘Ikke tilgængelig’ er nu en distinkt pill (dashed border + micro dot) i stedet for grå tekst — læses tydeligt som ‘venter på tjeneste’",
      "Statuschips: pulserende ring på online-status, backdrop-blur, cyan info-tone, bedre kontrast på muted-tone",
      "Quick actions: kompakt liste med ikon-chip, shortcut-key, chevron der glider på hover, tydelig focus-visible state",
      "Empty states: nyt design med rundt ikon-badge, display-typograferet titel og hint — samme mønster i aktivitet, advarsler, scan og optimering",
      "Section-headers: mindre skrift, tightere tracking (0.18em), valgfri right-aside meta i mono uppercase",
      "Bedre spacing hele vejen igennem: gap-5 mellem sektioner, 5-padding i paneler, max-w 1360 for balancerede linje-længder",
      "Nyt reduced-motion-lag i stylesheet: dræber aurora, fade-up og pulse for brugere med reduceret bevægelse",
      "Ingen nye komponenter i public API — al forbedring holdt i Dashboard + shared styles.css",
    ],
  },
  {
    version: "0.9.0-a",
    date: "2026-07-09", time: "11:12", type: "feature",
    filename: "NOVYX_v0.9.0-a.zip", fileSize: "110 MB",
    highlight: "Dashboard 2.0 — nyt kontrolcenter bygget på Games-designsystemet, kun rigtige data",
    notes: [
      "Nyt Dashboard er nu programmets landingsflade — hero med systemstatus, live metric-strip, systemstatus-grid, hurtige handlinger, aktivitet, advarsler, scan- og optimeringsstatus",
      "Streng ‘no fake data’-regel indført: hvert felt viser enten en rigtig værdi, ‘Ikke tilgængelig’ eller ‘Ingen aktivitet endnu’ — ingen opdigtede FPS/CPU/RAM/temperaturer",
      "Live systemdata hentet fra renderer-APIs: online-status, session-uptime, logiske kerner, enhedshukommelse, JS heap, batteri, netværkstype og RTT",
      "Systemservice-felter (CPU/RAM-belastning, GPU, disk, Windows build, admin, Secure Boot, TPM, UEFI, DirectX) markeret ‘Ikke tilgængelig’ indtil IPC-broen kobles på",
      "Ny navigation: sidebar-menupunkter er nu klikbare og skifter mellem Dashboard og Games",
      "Fuld NOVYX-branding: gammelt ‘FPS Booster’-navn og fiktivt bruger-podium fjernet fra sidebar; versionsnummer opdateret",
      "Genbrug af Games-designsystem: samme paneler, typografi, spacing, animationer, StatPill, Button og status-chips",
      "Ny primitiv-modul: renderer/lib/system.ts (useOnline, useUptimeMs, useBattery, useConnection, useHeapMb) — enkelt kilde til alle rigtige signaler",
      "Empty-states designet som førsteklasses UI, ikke fallbacks: ‘System ser sundt ud’, ‘Ingen aktivitet endnu’, ‘Kør en scanning for at etablere baseline’",
      "Fejlrettelser: sidebar accepterer onNavigate, badges fjernet indtil rigtige tal er tilgængelige, TS-narrowing på tomme scan/optimeringsobjekter",
    ],
  },
  {
    version: "0.8.0-b",
    date: "2026-07-09", time: "10:05", type: "fix",
    filename: "NOVYX_v0.8.0-b.zip", fileSize: "110 MB",
    highlight: "Fikser manglende styling i desktop-appen — Tailwind nu bundlet i renderen",
    notes: [
      "Fejl i 0.8.0-a: renderen refererede Tailwind-utilities (flex/grid/spacing) uden at Tailwind var installeret, så hele appen faldt sammen til én lodret uigennemført kolonne",
      "Tailwind v4 (@tailwindcss/vite) tilføjet til desktop-build-pipelinen",
      "Renderer CSS kompileres nu med alle utility-klasser + design-token-lag",
      "Ingen ændringer i features — kun visuel fix så Games-siden og hele design-systemet renderer korrekt",
    ],
  },
  {
    version: "0.8.0-a",
    date: "2026-07-09", time: "09:59", type: "feature",
    filename: "NOVYX_v0.8.0-a.zip", fileSize: "110 MB",
    highlight: "Games-modul redesignet fra bunden — nyt reference-designsystem",
    notes: [
      "Games: nyt spotlight-hero med live FPS-sparkline, score-ring, hardware readiness og shortcut-hints",
      "GameCards: hover quick-actions (Launch/Optimize/More), ambient accent-glow, skeleton loading, platform-tooltip",
      "Nyt detail-drawer: banner, live performance, recommended vs current profile, hardware-compat, historik med rollback, backup-status, PDF-rapport",
      "Nye primitiver til hele appen: Button, Tooltip, ContextMenu, ScoreRing, Sparkline, Skeleton",
      "Right-click context-menu og keyboard shortcuts (↵ open, ⌘O optimize, / search, Esc close)",
      "Animeret aurora-baggrund i app-shell, fade-up entrance på sektioner, ring-draw og sparkline draw-in",
      "Filter-pills med tællere + gradient-active, sort-dropdown, grid/compact-toggle",
      "Electron 33.4.11 · Chromium 130 · Vite 5 build",
    ],
  },
  {
    version: "0.7.0-a",
    date: "2026-07-09", time: "07:29", type: "feature",
    filename: "NOVYX_v0.7.0-a.zip", fileSize: "105 MB",
    highlight: "NOVYX v1 — komplet rebrand og nyt Design System v3",
    notes: [
      "Nyt brand: NOVYX afløser tidligere navn på tværs af app, installer og opdateringssystem",
      "Design System v3: nyt dark-first tema, elektrisk blå + cyan accent, ingen lilla",
      "Games-modul: hero, cover-grid, detaljeside og live tweak-preview",
      "Ny AppTopbar og sidebar-arkitektur på tværs af desktop-appen",
      "Automatiseret release-pipeline: bump + build + ZIP + SHA-256 + upload i ét trin",
    ],
  },
  {
    version: "0.6.0-b",
    date: "2026-07-08", time: "22:14", type: "performance",
    filename: "PCOptimizer_v0.6.0-b.zip", fileSize: "100 MB",
    highlight: "Diagnostics Engine — 100% lokal måling af programmets ressourceforbrug",
    notes: [
      "Ny Diagnostics Engine — programmet måler sit eget ressourceforbrug lokalt",
      "Main-process: CPU (EMA), RAM (RSS/heap/external), uptime — samplet hvert 2. sekund",
      "Renderer: FPS (instant/avg/low), long frames (>32 ms), long tasks, DOM-noder, JS heap",
      "Startup-målinger: boot → vindue klar, first contentful paint, DOM interactive, bundle load",
      "IPC-instrumentering: hver ipcMain.handle wrappes og logger count/errors/avg/min/max/last",
      "PowerShell-instrumentering: latens pr. cmdlet + advarer ved >5 s",
      "Cleaner-historik: op til 40 seneste operationer med varighed, filer, frigjorte bytes",
      "Lokale log-filer under app.getPath('logs') — ingen cloud, ingen telemetri",
      "Performance Alerts: FPS<30, renderer RAM>500 MB, main CPU>25%, PS-kald>5 s",
      "Performance Score (0-100): teknisk score baseret på boot, RAM, FPS, CPU og IPC-latens",
      "Ny Settings-side: toggle for live diagnostics-overlay",
      "Diagnostics-siden: fuld udskrift, live-poll hvert 2. sekund + Eksportér rapport (.txt)",
    ],
  },
  {
    version: "0.6.0-a", subVersion: "optimeret",
    date: "2026-07-08", time: "18:42", type: "optimization",
    filename: "PCOptimizer_v0.6.0-a.zip", fileSize: "100 MB",
    highlight: "Bundle-optimering: ZIP 114 → 100 MB, app.asar 31 → 1,3 MB",
    notes: [
      "ZIP 114 MB → 100 MB, udpakket 298 MB → 230 MB, filer i ZIP 76 → 23",
      "app.asar trimmet fra 31 MB → 1,3 MB — lucide-react/react/react-dom flyttet til devDependencies",
      "Kun runtime-nødvendige deps i asar: systeminformation (bruges i main-processen)",
      "Locales trimmet fra 55 filer (42 MB) til 2 filer (1 MB): en-US.pak + da.pak",
      "Ny postpackage-trim: fjerner ubrugte locales og source maps automatisk ved hver build",
    ],
  } as ChangelogEntry & { subVersion?: string },
  {
    version: "0.6.0-a",
    date: "2026-07-08", time: "14:03", type: "feature",
    filename: "PCOptimizer_v0.6.0-a.zip", fileSize: "114 MB",
    highlight: "Cleaner Core: 14 sikre oprydningsmål, Browser Cleaner og professionel rapport",
    notes: [
      "Disk Cleaner udvidet fra 8 til 14 mål: DirectX Shader Cache, Windows Error Reports, Crash Dumps, Minidumps, Windows Logs, CBS Logs, Recent Files, DNS Cache",
      "Sikkerhedsniveau: Basic (helt sikre mål) og Advanced (kræver eksplicit bekræftelse)",
      "Browser Cleaner: Chrome, Edge, Brave, Opera, Vivaldi og Firefox",
      "One Click Optimize genskrevet som fuld pipeline: admin-tjek → restore → gendannelsespunkt → scan → oprydning → cache → DNS → verifikation",
      "Pipelinen stopper aldrig på én fejl — hvert trin markeres OK, advarsel eller sprunget over",
      "Detaljeret rapport pr. handling: mapper scannet, ryddet, filer slettet, plads frigivet, tid brugt",
      "Rapporter kan eksporteres som .txt for support",
      "Cookies, historik og downloads bliver aldrig ryddet automatisk — end ikke i Advanced tilstand",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-07-08", time: "10:27", type: "feature",
    filename: "PCOptimizer_v0.5.0.zip", fileSize: "118 MB",
    highlight: "Fundament for rigtige Windows-operationer — ingen simuleringer",
    notes: [
      "Ægte UAC-detektion via WindowsPrincipal + 'Genstart som administrator'-knap",
      "Ny service-arkitektur: admin, hardware, restore, startup, dns, diskcleaner, diagnostics",
      "Startup Manager: læser HKCU/HKLM Run + StartupApproved",
      "Disk Cleaner: enumererer 8 sikre mål med rigtige størrelser",
      "DNS Manager: pr. adapter med presets (Cloudflare, Google, Quad9, OpenDNS) + ipconfig /flushdns",
      "Restore Points: opret via Checkpoint-Computer, list via Get-ComputerRestorePoint",
      "Hardware udvidet: TPM, Secure Boot, UEFI/Legacy, DirectX, Windows-aktivering, batteri, skærme, SMART",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-07-08", time: "08:11", type: "feature",
    filename: "PCOptimizer_v0.4.0.zip", fileSize: "120 MB",
    highlight: "Dashboard & Hardware: nyt kontrolcenter og komplet systemoversigt",
    notes: [
      "Live Performance: CPU, RAM, GPU, Disk, Netværk, Temperatur med sparklines",
      "8 Quick Actions med loading/success-states",
      "Systemstatus-strip: PC-navn, Windows, admin-status, version, licens, sidste scan, oppetid",
      "Hardware-side: CPU, GPU, RAM, multi-disk lagring, bundkort, BIOS, OS og netværks-interfaces",
      "Ny cache-arkitektur: statisk hardware hentes 1 gang, live-værdier throttles til 900 ms",
      "useLive-hook pauser polling når vinduet er skjult",
    ],
  },
  {
    version: "0.3.1",
    date: "2026-07-08", time: "02:38", type: "fix",
    filename: "PCOptimizer_v0.3.1.zip", fileSize: "122 MB",
    highlight: "Fikser flimmer og gennemsigtige lag efter kategoriskift",
    notes: [
      "Slår Chromium GPU-compositing fra — ingen stale layer-bitmaps",
      "Main-området er nu fuldt uigennemsigtigt med isoleret paint-kontekst",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-07-08", time: "01:12", type: "feature",
    filename: "PCOptimizer_v0.3.0.zip", fileSize: "122 MB",
    highlight: "Fundament: design-token-lag og layout-primitiver",
    notes: [
      "Nyt design-token-lag (motion, easing) og layout-primitiver",
      "Nye genbrugelige komponenter: Container, Section, PageShell, StatusDot, EmptyState",
      "Grundlag for skalerbar arkitektur",
    ],
  },
  {
    version: "0.2.2",
    date: "2026-07-07", time: "23:45", type: "fix",
    filename: "Optimizer_Setup_v0.2.2.zip", fileSize: "124 MB",
    highlight: "Fjerner GPU-lag, blur og gennemsigtighed efter kategoriskift",
    notes: [
      "Slår Electron hardware-acceleration fra",
      "Tvinger ren side-remount ved hvert kategoriskift",
      "Fjerner vendor-backdrop-regel — root/main-flader fuldt uigennemsigtige",
    ],
  },
  {
    version: "0.2.1",
    date: "2026-07-07", time: "22:16", type: "fix",
    filename: "Optimizer_Setup_v0.2.1.zip", fileSize: "124 MB",
    highlight: "Stabil, uigennemsigtig rendering ved kategoriskift",
    notes: [
      "Fjernet category lazy-loading, page transitions, shimmer og transform-lag",
      "Download og update-manifest peger på ny build",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-07-07", time: "20:04", type: "feature",
    filename: "Optimizer_Setup.zip", fileSize: "125 MB",
    highlight: "Komplet UI-redesign — professionelt desktop-look",
    notes: [
      "Nyt farvesprog (#0D1117 / #151B26 / #5B8CFF) uden neon-lilla",
      "Nyt Dashboard med hero, stat-kort, quick actions og aktivitets-panel",
      "Ny sidebar med 4 sektioner og diskret accent-highlight",
      "Fjernet backdrop-filter, radial gradients og transform-animationer",
      "Skarp tekst: ClearType + GPU-rasterization + låst 1.0 zoom",
      "System-poll cachet i main-process",
    ],
  },
  {
    version: "0.1.1",
    date: "2026-07-07", time: "16:33", type: "optimization",
    highlight: "Lazy-loading, cachet system-info og trimmede Chromium-locales",
    notes: [
      "Historik + logs som egne sider (persisteres i userData)",
      "PowerShell one-liner installer (irm … | iex)",
      "Lazy-loading af alle undersider",
      "Cachet system-info + memo'iseret sparkline",
      "Terser-minify uden source maps, trimmede locales — ZIP ~12 MB mindre",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-07-07", time: "12:00", type: "initial",
    highlight: "Første offentlige udgivelse (MVP)",
    notes: [
      "PC Scan og systeminformation",
      "One Click Optimize",
      "Rydning af Temp, Prefetch, Papirkurv og Update-cache",
      "DNS Flush og RAM-frigørelse",
    ],
  },
];

const RELEASE_TYPE_META: Record<ReleaseType, { label: string; tone: "accent" | "success" | "warning" | "danger" | "neutral" }> = {
  feature:      { label: "Feature",     tone: "accent" },
  performance:  { label: "Performance", tone: "success" },
  optimization: { label: "Optimering",  tone: "warning" },
  fix:          { label: "Fix",         tone: "danger" },
  security:     { label: "Security",    tone: "warning" },
  initial:      { label: "Initial",     tone: "neutral" },
};

export function getReleaseTypeMeta(t: ReleaseType) { return RELEASE_TYPE_META[t]; }

const DA_MONTHS = ["jan.", "feb.", "mar.", "apr.", "maj", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "dec."];
const DA_WEEKDAYS = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];

/**
 * Format a release timestamp. Weekday and full date are computed from the
 * calendar date parts directly (no local timezone), so SSR and client agree.
 * `relative` depends on wall clock — return "" when `now` is omitted.
 */
export function formatReleaseDate(date: string, time: string, now?: number) {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return { full: `${date} · ${time}`, weekday: "", relative: "" };
  // Fixed weekday derived from UTC midnight of the calendar date.
  const weekdayIdx = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const weekday = DA_WEEKDAYS[weekdayIdx];
  const full = `${d}. ${DA_MONTHS[m - 1]} ${y} · kl. ${time}`;
  if (now === undefined) return { full, weekday, relative: "" };
  // Interpret time as Europe/Copenhagen (+02:00 in July) for the relative diff.
  const iso = `${date}T${time}:00+02:00`;
  const t = new Date(iso).getTime();
  const diffMs = now - t;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  let relative = "";
  if (diffMs < 0) relative = "planlagt";
  else if (diffMin < 1) relative = "lige nu";
  else if (diffMin < 60) relative = `${diffMin} min. siden`;
  else if (diffH < 24) relative = `${diffH} t. siden`;
  else if (diffD < 30) relative = `${diffD} dage siden`;
  else if (diffD < 365) relative = `${Math.floor(diffD / 30)} mdr. siden`;
  else relative = `${Math.floor(diffD / 365)} år siden`;
  return { full, weekday, relative };
}
