# CLAUDE.md — Mollage

A mobile-only web app for making photo collages: pick photos, choose how many
cells and which layout, pan/zoom each photo, export a PNG or JPG. React 19 +
TypeScript + Vite, no backend, nothing is stored — photos never leave the phone.
Default format is **9:16 (Story)**. All UI text is **Swedish**.

```bash
npm run dev         # vite --host on port 5180 — open on the phone via this Mac's LAN IP
npm run typecheck
npm run build       # typecheck + vite build → dist/
```

## How it fits together

| File | Role |
| --- | --- |
| [src/layouts.ts](src/layouts.ts) | All layouts (grid trees + print arrangements) → `Cell[]` via `cellsFor` |
| [src/collage.ts](src/collage.ts) | Types, formats, `drawScene` (the one renderer), export to Blob |
| [src/state.ts](src/state.ts) | Reducer: photos, 9 slots, count, kind, layout per kind+count, format, style |
| [src/photos.ts](src/photos.ts) | File → downscaled canvas + thumbnail |
| [src/components/CollageCanvas.tsx](src/components/CollageCanvas.tsx) | Preview canvas + tap / pan / pinch gestures |
| [src/components/Sheet.tsx](src/components/Sheet.tsx) | Bottom sheet shell: scrim, in/ut, drag-att-stänga — bärs av export och Confirm |
| [server/serve.mjs](server/serve.mjs) | Zero-dependency static server + Bonjour name (production only) |

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
- **Polaroid / Klippbok (prints):** arrangement functions (`tidy`, `scatter`,
  `zigzag`, `cascade`, `pile`) place white-framed prints relative to the canvas
  size, so they adapt to every format. Variants are listed in
  `PRINT_VARIANTS` with a seed; randomness comes from a seeded PRNG and must be
  consumed the same way regardless of W/H, or a variant would look different
  in the preview and the export. `toCell` keeps rotated prints on the canvas.
  Klippbok defaults to tape (strips at the top edge or two opposite corners)
  and mixed portrait/landscape photos; inspiration was a scrapbook page and a
  polaroid wall the user shared.

**Slots** are always 9 long; only the first `count` are visible. Lowering the
count keeps the hidden slots' photos so raising it again is lossless.
`slot.ox/oy` run −1…1 across the overflow; values outside only exist
mid-gesture (rubber band) and `settle()` eases them back.

## Mobile constraints that shaped the code

- Served over **plain http** on the LAN → no secure context. `crypto.randomUUID`
  and `navigator.share` don't exist there. Ids come from a counter; Share is
  feature-detected. Saving works via `<a download>` and by long-pressing the
  result image ("Lägg till i Bilder") — keep both.
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

## Production runs on another machine

Like lidkoping-ping, the live copy is on the always-on Mac:

| Where | Path | Role |
| --- | --- | --- |
| This machine | `~/projects/labs/mollage` | Development |
| Roon-server-Mac.local | `~/agents/mollage` | **Production** — `dist/`, `server/`, scripts only |

```bash
bash deploy.sh --dry-run   # build + show what would be sent
bash deploy.sh             # build, rsync, restart the launchd service, health-check
```

The build happens **here**; the server only needs node (via nvm) — no npm, no
node_modules. `deploy.sh` mirrors `dist/` with `--delete`, syncs `server/`,
`run.sh`, `service.sh`, and restarts the service (or reloads it if the plist
changed). On the server: `bash service.sh status|restart|logs`.

**URL:** `http://mollage.local` (port 80, which macOS lets a normal user bind).
`serve.mjs` runs `dns-sd -P` to publish `mollage.local` → the server's en*
IPv4 via mDNSResponder, re-checking the IP every 30 s. Fallbacks:
`http://roon-server-mac.local` and `http://192.168.86.25` (Android's `.local`
support is spotty). If `mollage.local` stops resolving, check
`bash service.sh logs` for dns-sd lines before anything else.

**Home network only.** The app must only be usable on the home LAN. Never add
port forwarding, tunnels (ngrok, Cloudflare, Tailscale Funnel) or a public
hostname. As a second line of defence `serve.mjs` answers 403 to any client
outside private/local ranges (`isLocal`) — keep that check first in the
request handler.

### Sökvägsfällan (the path trap)

`com.user.mollage.plist` hardcodes absolute paths for *this* machine.
`deploy.sh` rewrites them with sed before copying — never scp the plist raw.
This exact mistake silently killed lidkoping-ping for ~40 days (see its
CLAUDE.md). The launchd job is `KeepAlive`, so a wrong path shows up as a
crash loop: `launchctl list | grep mollage` with a non-zero exit status.

## Conventions

- Swedish for all user-facing text, script output and log lines. In `src/`,
  identifiers and comments are English; in `server/` and the shell scripts,
  comments are Swedish (matching lidkoping-ping).
- No new runtime dependencies without a good reason; the server stays
  zero-dependency.
- Phone-only: design for 360–430 px wide, portrait. Desktop just shows the
  same column centered.
