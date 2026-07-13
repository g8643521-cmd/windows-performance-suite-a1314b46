import { memo, useState, type JSX } from "react";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { BoostPage } from "./pages/Boost";
import { SystemScanPage } from "./pages/SystemScan";
import { ScanPage as SpecsPage } from "./pages/Scan";
import { TweaksPage } from "./pages/Tweaks";
import { GameBoostPage as ArcadePage } from "./pages/GameBoost";
import { BenchmarkPage } from "./pages/Benchmark";
import { RepairsPage } from "./pages/Repairs";
import { InstallPage } from "./pages/Install";
import { LabPage } from "./pages/Lab";
import { SettingsPage } from "./pages/Settings";

const MBoost     = memo(BoostPage);
const MScan      = memo(SystemScanPage);
const MSpecs     = memo(SpecsPage);
const MTweaks    = memo(TweaksPage);
const MArcade    = memo(ArcadePage);
const MBenchmark = memo(BenchmarkPage);
const MRepairs   = memo(RepairsPage);
const MInstall   = memo(InstallPage);
const MLab       = memo(LabPage);
const MSettings  = memo(SettingsPage);

type Route =
  | "boost" | "scan" | "specs" | "tweaks"
  | "arcade" | "benchmark"
  | "repairs" | "install" | "lab" | "settings";

const META: Record<Route, { title: string; subtitle: string }> = {
  boost:     { title: "Boost",     subtitle: "Live ydelse · frigør hukommelse · ryd op" },
  scan:      { title: "Scan",      subtitle: "Intelligent system scan · rens · Fix pr. kategori" },
  specs:     { title: "Specs",     subtitle: "Fuld hardware-oversigt · sensorer · lagring" },
  tweaks:    { title: "Tweaks",    subtitle: "Windows-optimering · game mode · strøm" },
  arcade:    { title: "Arcade",    subtitle: "Dit spilbibliotek · Steam og Epic" },
  benchmark: { title: "Benchmark", subtitle: "Ydelsestest · CPU · GPU · lagring" },
  repairs:   { title: "Repairs",   subtitle: "SFC · DISM · netværk · sikkerhed" },
  install:   { title: "Install",   subtitle: "Installerede programmer på denne PC" },
  lab:       { title: "Lab",       subtitle: "Eksperimentelle værktøjer" },
  settings:  { title: "Settings",  subtitle: "Konfiguration · sikkerhed · support" },
};

const ROUTES: Route[] = [
  "boost","scan","specs","tweaks","arcade","benchmark","repairs","install","lab","settings",
];

export function App() {
  const [route, setRoute] = useState<Route>("boost");
  const meta = META[route];

  const PAGES: Record<Route, () => JSX.Element> = {
    boost:     () => <MBoost />,
    scan:      () => <MScan />,
    specs:     () => <MSpecs />,
    tweaks:    () => <MTweaks />,
    arcade:    () => <MArcade />,
    benchmark: () => <MBenchmark />,
    repairs:   () => <MRepairs />,
    install:   () => <MInstall />,
    lab:       () => <MLab />,
    settings:  () => <MSettings />,
  };

  return (
    <div className="app-shell" data-page={route}>
      <Sidebar
        active={route}
        onNavigate={(id) => {
          if ((ROUTES as string[]).includes(id)) setRoute(id as Route);
        }}
      />
      <main className="flex min-w-0 flex-col overflow-hidden">
        <TopBar title={meta.title} subtitle={meta.subtitle} />
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div key={route} className="h-full page-fade">
            {PAGES[route]()}
          </div>
        </div>
      </main>
    </div>
  );
}
