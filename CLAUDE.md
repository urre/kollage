# CLAUDE.md — Kollage

A mobile-only web app for making photo collages: pick photos, choose how many
cells and which layout, pan/zoom each photo, export a PNG or JPG. React 19 +
TypeScript + Vite, no backend, nothing is stored — photos never leave the phone.
Default format is **9:16 (Story)**. All UI text is **Swedish**.

```bash
npm run dev         # vite --host on port 5180 — open on the phone via this Mac's LAN IP
npm run typecheck
npm run build       # typecheck + vite build → dist/
git push            # deploys (see below)
```

## How it fits together

| File | Role |
| --- | --- |
| [src/layouts.ts](src/layouts.ts) | All layouts (grid trees + print arrangements) → `Cell[]` via `cellsFor` |
| [src/collage.ts](src/collage.ts) | Types, formats, `drawScene` (the one renderer), export to Blob |
| [src/state.ts](src/state.ts) | Reducer: photos, 9 slots, count, kind, layout per kind+count, format, style |
| [src/photos.ts](src/photos.ts) | File → downscaled canvas + thumbnail |
| [src/components/CollageCanvas.tsx](src/components/CollageCanvas.tsx) | Preview canvas + tap / pan / pinch gestures |
| [src/components/Sheet.tsx](src/components/Sheet.tsx) | Bottom sheet shell: scrim, enter/exit, drag-to-dismiss — used by export and Confirm |

**WYSIWYG is the core invariant.** The preview and the export both go through
`drawScene`, and gap/radius are stored as fractions of the short side, so the
2160 px export is pixel-for-pixel the preview scaled up. Never draw anything
into the canvas that shouldn't be in the export — selection ring and empty-cell
placeholders are DOM overlays on purpose.

**Three kinds of collage** (the "Typ" tab), all producing the same `Cell`
(photo rect in its own unrotated space + `rot` around a pivot + optional
`frame` and `tape`). Drawing, hit-testing and pan/zoom only see cells; the
canvas converts pointer positions into the touched cell's local space, so
gestures work the same on a tilted polaroid as on a grid cell.

- **Rutnät (grid):** add a layout by appending a tree to `TREES`. Cell count is
  derived; order within a count is picker order and the first is the default
  (tall-friendly first, since 9:16 is the default). `computeRects` splits
  `size + gap` by weight so seams line up across siblings — a `[L, 2], L`
  split aligns with two thirds of `L, L, L`. Keep that formula.
- **Polaroid / Klippbok (prints):** arrangement functions (`single`, `tidy`,
  `scatter`, `zigzag`, `cascade`, `pile`) place white-framed prints relative to
  the canvas size, so they adapt to every format. `single` is the one-photo
  default: one print as large as the margins allow, with the photo aspect
  picked from the canvas ratio, because a square print on 9:16 leaves half the
  page empty. Variants are listed in
  `PRINT_VARIANTS` with a seed; randomness comes from a seeded PRNG and must be
  consumed the same way regardless of W/H, or a variant would look different
  in the preview and the export. `toCell` keeps rotated prints on the canvas.
  Klippbok defaults to tape (strips at the top edge or two opposite corners)
  and mixed portrait/landscape photos; inspiration was a scrapbook page and a
  polaroid wall the user shared.

**Black and white** is `slot.bw`, so it belongs to the placement like zoom and
follows the photo through a swap or a shuffle but not through a replace.
`drawPhoto` uses `ctx.filter` where it exists and a `saturation` blend
otherwise (Safari only got the filter in 17), rather than keeping a second
grey copy of each 2048 px photo in memory.

**Slots** are always 9 long; only the first `count` are visible. Lowering the
count keeps the hidden slots' photos so raising it again is lossless.
`slot.ox/oy` run −1…1 across the overflow; values outside only exist
mid-gesture (rubber band) and `settle()` eases them back.

## Mobile constraints that shaped the code

- Served over **https**, so `navigator.share` exists and the **Dela** button
  sends the collage straight to Bilder. Keep the feature detection anyway — it
  is missing in desktop Firefox and some in-app browsers — and keep both other
  routes: `<a download>` and long-pressing the result image ("Lägg till i
  Bilder"), which is still what iOS users reach for.
- **iOS canvas memory**: photos are downscaled to 2048 px on import and loaded
  one at a time; export canvases are shrunk to 0×0 after `toBlob`. Max export
  is 3840×2160 (8.3 MP, under iOS's 16.7 MP canvas cap).
- Emulation in desktop Chrome does not reproduce touch feel, safe areas, tap
  delay or the iOS download flow. Say what still needs a real phone.

## Design

Project skills from Emil Kowalski live in `.claude/skills/` (installed with
`npx skills add emilkowalski/skill`). Use them for UI work:
`mobile-native` (viewport, touch, safe areas — its baseline is already
applied), `emil-design-eng` and `animate` (motion decisions), `apple-design`
(gestures, springs, rubber-banding). House rules already in the CSS: custom
`--ease-out`/`--ease-drawer` curves, `:active` scale on every pressable, hover
only behind `(hover: hover) and (pointer: fine)`, no animation on things used
constantly (tab switches, layout changes), `prefers-reduced-motion` respected.

## Deploy

**URL: [urre.github.io/kollage](https://urre.github.io/kollage/)** — GitHub
Pages, built by [.github/workflows/pages.yml](.github/workflows/pages.yml) on
every push to `main`. Nothing to keep alive: no server process, no launchd, no
LAN, no Vercel account.

Pages serves the repo under `/kollage/`, not at the domain root, so
`vite.config.ts` sets `base: '/kollage/'` — in dev too, so a path that works
locally works in production. The dev server redirects `/` there, so the bare
LAN IP still opens the app on the phone. Rename the repo and that base has to
change with it, or every asset 404s.

The build is `npm run build`, which typechecks first, so a type error fails the
deploy the same way it fails locally. There is no preview environment: a branch
is just a branch until it is merged into `main`.

The repo is public ([github.com/urre/kollage](https://github.com/urre/kollage))
because free Pages requires it. That is only the source — there are no keys to
leak, since the app is **entirely client-side**: Pages serves static files and
there is no backend, no API route, no storage. Photos are read, drawn and
exported in the browser and never leave the phone. Keep it that way: an API
route would turn a private app into one that handles other people's pictures.

## Share image and README shot

`public/og.jpg` (1200×630, linked from the Open Graph and Twitter tags in
`index.html`) and `docs/hero.jpg` (the README image) are rendered, not drawn by
hand. The sources are in [docs/card/](docs/card/): `og.html` and `hero.html`
share `card.css`, and both expect two phone screenshots named `shot-grid.png`
and `shot-klippbok.png` beside them.

To redo them: run the dev server, open the app in headless Chrome at
`375x812` with `--force-device-scale-factor=3`, run
[docs/card/demo-photos.js](docs/card/demo-photos.js) in the page (it generates
four stand-in landscapes and drops them into the file input, so no real
photos end up in a public repo), screenshot one grid and one scrapbook
collage into `docs/card/`, then screenshot the two cards at 2× and downscale:

```bash
chrome --headless=new --screenshot=og.png --window-size=1200,630 \
  --force-device-scale-factor=2 docs/card/og.html
magick og.png -resize 1200x630 -quality 88 public/og.jpg
```

JPG, not PNG: the same card is a quarter of the size and the artefacts do not
show on a dark background.

## Conventions

- Swedish for all user-facing text. In `src/`, identifiers and comments are
  English.
- No new runtime dependencies without a good reason.
- Phone-only: design for 360–430 px wide, portrait. Desktop just shows the
  same column centered.
