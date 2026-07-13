# FPS Booster — Desktop (Electron Renderer)

Kildekode til desktop-appens UI. Ligger isoleret i `desktop/` og indgår IKKE i website-buildet (`tsconfig.json` inkluderer kun `src/**`).

## Struktur

```
desktop/
  src/renderer/
    App.tsx                # Shell (sidebar + topbar + route outlet)
    main.tsx               # React entry (mount i Electron BrowserWindow)
    index.html
    styles.css             # Design tokens + globale klasser
    lib/
      cn.ts
      games.ts             # Mock game-library (erstattes af IPC til main)
    components/
      Sidebar.tsx
      TopBar.tsx
      GameCard.tsx
      OptimizationPanel.tsx
      StatPill.tsx
    pages/
      Games.tsx            # ← REDESIGNET (denne opgave)
```

## Designsystem (desktop)

- **Base**: obsidian `#0A0B10`, panel `#12141C`, hairline `#1F2230`
- **Accent**: cyan→violet gradient (`#38E1FF → #7C5CFF`), amber highlight `#FFB547`
- **Typografi**: Inter Tight (display) + Inter (body), tabular nums til metrics
- **Radius**: 14/18/24, aldrig pill undtagen på chips
- **Motion**: 180ms ease-out standard, 320ms spring til panel-transitions

Semantiske tokens er defineret i `styles.css`. Brug aldrig hex direkte i komponenter.

## Games-siden

Redesignet fra bunden. Se `pages/Games.tsx`. Layout:

1. **Spotlight-hero** — aktivt/senest spillet spil med baggrundsart, ready-state, one-click "Enter Focus Mode".
2. **Library-grid** — auto-detekterede spil med cover, boost-profil, sidste session-FPS.
3. **Optimization-panel** — pr. spil: CPU affinity, GPU scheduler, input latency, network priority.
4. **Session-telemetri** — footer med live FPS/frametime når spillet kører.
