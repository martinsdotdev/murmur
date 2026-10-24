# Murmur website

The marketing site at `murmur.umaru.dev`. Astro static build, deployed by GitHub Actions.

## Develop

```powershell
cd web
pnpm install
pnpm dev         # → http://localhost:4321/
```

`dev` and `build` both run `scripts/copy-assets.mjs` first, copying the app icon and the 14 bundled OGGs from `../Murmur/Assets/Source/AppIcon.svg` and `../Murmur/Sounds/*.ogg` into `public/` so the demo can play them locally. It is chained into the script rather than run from a `predev`/`prebuild` hook: those hooks are off by default in pnpm 10 and earlier, and the failure mode is a green build that ships no favicon and no audio.

## Build

```powershell
pnpm build       # → dist/
pnpm preview     # serves dist/ at localhost:4321
```

## Icons

The PWA icons are generated, not hand-edited. After changing
`Murmur/Assets/Source/AppIcon.svg` or `AppIcon.maskable.svg`, run
`scripts/build-pwa-icons.ps1` (needs ImageMagick on PATH) and commit the PNGs
it writes to `public/icons/`. `-Verify` re-renders and compares hashes instead
of overwriting.

## Testing offline

`pnpm preview` is not a faithful stand-in for GitHub Pages: it can normalise
trailing slashes the opposite way. Serve the build the way Pages does, then stop the
server and reload to test offline for real.

```powershell
python -m http.server 4402 --directory dist
```

## Deploy

Pushed to `master`, the `.github/workflows/website.yml` workflow builds and deploys to GitHub Pages. The repo's _Settings → Pages → Source_ must be set to _GitHub Actions_ (one-time manual toggle).

## Source-of-truth links

| Site asset                | Lives in app at                                                             | Sync                                  |
| ------------------------- | --------------------------------------------------------------------------- | ------------------------------------- |
| Brand SVG                 | `Murmur/Assets/Source/AppIcon.svg`                                          | copied at build                       |
| Soundscape OGGs           | `Murmur/Sounds/*.ogg`                                                       | copied at build                       |
| Sound list & lucide icons | `Murmur/Models/SoundCatalog.cs` + `Murmur/ViewModels/SoundCardViewModel.cs` | hand-mirrored to `src/data/sounds.ts` |
| License attribution       | `Murmur/Sounds/SOUNDS_LICENSING.md`                                         | hand-mirrored to `src/data/sounds.ts` |

Keep the mirrors in sync when those source files change.
