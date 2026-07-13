# NOVYX Build Resources

Denne mappe bruges af `electron-builder` under Windows-build.

## Krævede filer

- `icon.ico` — hovedikon (bruges til .exe, installer-vindue og genveje).
  - Format: Windows ICO
  - Anbefalede størrelser inde i ICO'en: 16, 32, 48, 64, 128, 256 px
  - Mindst 256×256 skal være med, ellers klager electron-builder

## Valgfrit (kan tilføjes senere)

- `installerSidebar.bmp` — 164×314 BMP vist til venstre i NSIS-guiden
- `uninstallerSidebar.bmp` — samme, men til afinstallation
- `LICENSE.txt` — vises som "Accept license"-trin i installeren

## Bemærk

Filerne i denne mappe skal committes til repoet, så CI-builden (GitHub Actions
`build-windows.yml`) kan finde dem. Uden `icon.ico` fejler NSIS-target'et.
