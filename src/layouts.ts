// Three kinds of collage:
//
// - grid: guillotine trees. Every node splits its rectangle into a row (side
//   by side) or a column (stacked); a `null` leaf is one photo cell. Cells are
//   numbered depth-first, which gives natural reading order.
// - polaroid / scrapbook: freeform "prints" (a photo inside a white frame)
//   placed by an arrangement function, rotated, overlapping, optionally taped.
//   Later cells are drawn on top.
//
// Everything comes out as `Cell`s, so drawing, hit-testing and pan/zoom don't
// care which kind produced them.

export type Rect = { x: number; y: number; w: number; h: number }
export type Split = { dir: 'row' | 'col'; parts: Part[]; weights: number[] }
export type Part = Split | null

export type Kind = 'grid' | 'polaroid' | 'scrapbook'
export type Arrange = 'single' | 'tidy' | 'scatter' | 'cascade' | 'pile' | 'zigzag'

export type Layout =
  | { id: string; kind: 'grid'; count: number; root: Part }
  | { id: string; kind: 'polaroid' | 'scrapbook'; count: number; arrange: Arrange; seed: number }

export type Tape = { x: number; y: number; w: number; h: number; rot: number }

// x/y/w/h is the photo area in the cell's own unrotated space; the cell is
// rotated by `rot` around (px, py). `frame` is the white print around the
// photo (also the hit area); `tape` strips sit on top of it.
export type Cell = Rect & { rot: number; px: number; py: number; frame?: Rect; tape?: Tape[] }

export type CellOptions = { gap: number; scale: number; tilt: number; tape: boolean }

export const KINDS: { id: Kind; label: string; hint: string }[] = [
  { id: 'grid', label: 'Rutnät', hint: 'Kant i kant' },
  { id: 'polaroid', label: 'Polaroid', hint: 'Vita ramar' },
  { id: 'scrapbook', label: 'Klippbok', hint: 'Tejp & papper' },
]

export const MAX_CELLS = 9

// ── Grid ────────────────────────────────────────────────────────────────────

type Arg = Part | [Part, number]

const L = null

function split(dir: Split['dir'], args: Arg[]): Split {
  const parts: Part[] = []
  const weights: number[] = []
  for (const a of args) {
    if (Array.isArray(a)) {
      parts.push(a[0])
      weights.push(a[1])
    } else {
      parts.push(a)
      weights.push(1)
    }
  }
  return { dir, parts, weights }
}

const row = (...a: Arg[]) => split('row', a)
const col = (...a: Arg[]) => split('col', a)
const strip = (dir: Split['dir'], n: number) => split(dir, Array<Arg>(n).fill(L))
const grid = (cols: number, rows: number) => col(...Array<Arg>(rows).fill(strip('row', cols)))

function countCells(p: Part): number {
  return p === null ? 1 : p.parts.reduce((n, c) => n + countCells(c), 0)
}

// Order within a count is the order shown in the picker; the first is the
// default. The default format is 9:16, so tall-friendly layouts come first.
const TREES: Part[] = [
  // 1
  L,
  // 2
  col(L, L),
  col([L, 2], L),
  col(L, [L, 2]),
  row(L, L),
  row([L, 2], L),
  // 3
  col(L, row(L, L)),
  col(L, L, L),
  col([L, 1.8], row(L, L)),
  col(L, [L, 2], L),
  col(row(L, L), L),
  row(L, col(L, L)),
  row(col(L, L), L),
  row(L, L, L),
  // 4
  grid(2, 2),
  col([L, 2], row(L, L, L)),
  row(col(L, [L, 1.5]), col([L, 1.5], L)),
  col(row(L, L), L, L),
  col(L, L, row(L, L)),
  row(col(L, L, L), [L, 1.4]),
  col(L, L, L, L),
  col(L, row(L, L), L),
  row([L, 2], col(L, L, L)),
  // 5
  col(row(L, L), [L, 1.4], row(L, L)),
  col(row(L, L), row(L, L, L)),
  col([L, 1.6], grid(2, 2)),
  col([L, 2], row(L, L), row(L, L)),
  row(col(L, L, L), col(L, L)),
  col(L, row(L, L, L), L),
  row(col([L, 1.3], L), col(L, L, L)),
  col(row(L, L, L), row(L, L)),
  row(col(L, L), [L, 1.4], col(L, L)),
  // 6
  grid(2, 3),
  row(col([L, 3], [L, 2], [L, 3]), col([L, 2], [L, 3], [L, 2])),
  col([L, 1.6], row(L, L), row(L, L, L)),
  col(row(L, L, L), [L, 2], row(L, L)),
  row(col(L, L), col(L, L, L, L)),
  col([row([L, 2], col(L, L)), 2], row(L, L, L)),
  grid(3, 2),
  // 7
  col(row(L, L), row(L, L, L), row(L, L)),
  col([L, 1.6], row(L, L, L), row(L, L, L)),
  col(row(L, L, L), [L, 1.5], row(L, L, L)),
  col(row(L, L), [L, 1.6], row(L, L, L, L)),
  row(col(L, L, L, L), col(L, L, L)),
  col([L, 1.4], grid(2, 3)),
  // 8
  grid(2, 4),
  row(col([L, 3], [L, 2], [L, 3], [L, 2]), col([L, 2], [L, 3], [L, 2], [L, 3])),
  col([L, 1.6], row(L, L, L), row(L, L, L, L)),
  row(col(L, L, L, L, L), col(L, L, L)),
  col([row([L, 3], col(L, L, L)), 3], row(L, L, L, L)),
  col(row(L, L, L), row(L, L), row(L, L, L)),
  grid(4, 2),
  // 9
  grid(3, 3),
  col([L, 1.6], grid(2, 4)),
  row(col([L, 4], [L, 3], [L, 5]), col([L, 3], [L, 5], [L, 4]), col([L, 5], [L, 4], [L, 3])),
  row(col(L, L, L, L, L), col(L, L, L, L)),
  col(row(L, L), row(L, L, L), row(L, L), row(L, L)),
  col(row(L, L, L), [L, 2], row(L, L, L), row(L, L)),
]

// Splits `size + gap` by weight and takes the gap back off each part. That keeps
// seams aligned across siblings: a 2:1 split lines up with two thirds of a
// 1:1:1 split, whatever the gap.
export function computeRects(root: Part, W: number, H: number, gap: number): Rect[] {
  const out: Rect[] = []
  const walk = (p: Part, r: Rect) => {
    if (p === null) {
      out.push(r)
      return
    }
    const total = p.weights.reduce((a, b) => a + b, 0)
    const extent = p.dir === 'row' ? r.w : r.h
    let pos = p.dir === 'row' ? r.x : r.y
    p.parts.forEach((child, i) => {
      const size = ((extent + gap) * p.weights[i]) / total - gap
      walk(child, p.dir === 'row' ? { x: pos, y: r.y, w: size, h: r.h } : { x: r.x, y: pos, w: r.w, h: size })
      pos += size + gap
    })
  }
  walk(root, { x: gap, y: gap, w: W - 2 * gap, h: H - 2 * gap })
  return out
}

// ── Prints (polaroid / scrapbook) ───────────────────────────────────────────

// Borders as fractions of the frame width. A real Polaroid is 88×107 mm with a
// 79 mm square photo and a deep bottom edge; a scrapbook print has a thin even edge.
type Spec = { side: number; top: number; bottom: number }
const POLAROID: Spec = { side: 0.06, top: 0.06, bottom: 0.275 }
const PRINT: Spec = { side: 0.028, top: 0.028, bottom: 0.028 }

const DEG = Math.PI / 180

// What an arrangement produces: a print centered at (cx, cy), fw wide, with a
// photo of the given aspect (w/h), and which tape pattern it gets.
type Print = { cx: number; cy: number; fw: number; aspect: number; rot: number; spec: Spec; tape: number }

type Ctx = { n: number; W: number; H: number; S: number; scale: number; tilt: number; r: () => number }

// mulberry32: tiny seeded PRNG so a variant looks the same every time.
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = (r: () => number, a: number, b: number) => a + (b - a) * r()
const sign = (r: () => number) => (r() < 0.5 ? -1 : 1)

// Height of a frame per unit of width.
function frameHW(spec: Spec, aspect: number) {
  return spec.top + spec.bottom + (1 - 2 * spec.side) / aspect
}

// The cols × rows grid of cells that fits the most frame width on the canvas.
function fitGrid(c: Ctx, hw: number, margin: number) {
  let best = { cols: 1, rows: c.n, cw: 0, ch: 0, fw: 0 }
  for (let cols = 1; cols <= c.n; cols++) {
    const rows = Math.ceil(c.n / cols)
    const cw = (c.W - margin * (cols + 1)) / cols
    const ch = (c.H - margin * (rows + 1)) / rows
    const fw = Math.min(cw, ch / hw)
    if (fw > best.fw) best = { cols, rows, cw, ch, fw }
  }
  const centers = Array.from({ length: c.n }, (_, i) => {
    const r = Math.floor(i / best.cols)
    const inRow = r === best.rows - 1 ? c.n - best.cols * (best.rows - 1) : best.cols
    const offset = ((best.cols - inRow) * (best.cw + margin)) / 2
    const k = i - r * best.cols
    return {
      col: k,
      row: r,
      x: margin + best.cw / 2 + k * (best.cw + margin) + offset,
      y: margin + best.ch / 2 + r * (best.ch + margin),
    }
  })
  return { ...best, centers }
}

// One print, as large as the canvas allows. The photo aspect follows the
// format, so a story gets a tall photo and a wide format a landscape one —
// a single square print on 9:16 would leave half the page empty.
function single(c: Ctx, spec: Spec): Print[] {
  const canvas = c.W / c.H
  const aspect = canvas > 1.25 ? 3 / 2 : canvas < 0.85 ? 4 / 5 : 1
  const hw = frameHW(spec, aspect)
  const m = c.S * 0.09
  const fw = Math.min(c.W - 2 * m, (c.H - 2 * m) / hw) * c.scale
  return [
    { cx: c.W / 2, cy: c.H / 2, fw, aspect, rot: rand(c.r, -2.5, 2.5) * DEG * c.tilt, spec, tape: Math.floor(c.r() * 3) },
  ]
}

function tidy(c: Ctx, spec: Spec): Print[] {
  const g = fitGrid(c, frameHW(spec, 1), c.S * 0.08)
  return g.centers.map((p) => ({ cx: p.x, cy: p.y, fw: g.fw * c.scale, aspect: 1, rot: 0, spec, tape: Math.floor(c.r() * 3) }))
}

// Like tidy, but a little bigger so neighbours overlap, nudged and tossed.
function scatter(c: Ctx, spec: Spec, mixed: boolean): Print[] {
  const g = fitGrid(c, frameHW(spec, 1), c.S * 0.07)
  return g.centers.map((p) => {
    const aspect = mixed ? (c.r() < 0.5 ? 4 / 3 : 3 / 4) : 1
    const hw = frameHW(spec, aspect)
    // Wider than its cell so neighbours overlap side by side, like prints
    // dropped on a table; height stays within the row.
    const fw = Math.min(g.cw * 1.22, (g.ch * 1.04) / hw) * c.scale
    return {
      cx: p.x + rand(c.r, -0.08, 0.08) * fw,
      cy: p.y + rand(c.r, -0.08, 0.08) * fw * hw,
      fw,
      aspect,
      rot: sign(c.r) * rand(c.r, 2, 8) * DEG * c.tilt,
      spec,
      tape: Math.floor(c.r() * 3),
    }
  })
}

// Down the long side of the canvas, alternating left and right.
function cascade(c: Ctx, spec: Spec, aspect: number): Print[] {
  const tall = c.H >= c.W
  const hw = frameHW(spec, aspect)
  const fw = (tall ? c.W * (aspect > 1 ? 0.7 : 0.6) : (c.H * 0.62) / hw) * c.scale
  const ext = tall ? fw * hw : fw
  const len = tall ? c.H : c.W
  const m = c.S * 0.06
  return Array.from({ length: c.n }, (_, i) => {
    const along = c.n > 1 ? m + ext / 2 + ((len - 2 * m - ext) * i) / (c.n - 1) : len / 2
    const cross = c.S / 2 + (i % 2 ? 1 : -1) * c.S * 0.13
    const rot = (i % 2 ? 1 : -1) * rand(c.r, 3, 6) * DEG * c.tilt
    return { cx: tall ? cross : along, cy: tall ? along : cross, fw, aspect, rot, spec, tape: Math.floor(c.r() * 3) }
  })
}

// A loose stack in the middle; the top print sits almost straight.
function pile(c: Ctx, spec: Spec): Print[] {
  const fw = c.S * 0.62 * c.scale
  return Array.from({ length: c.n }, (_, i) => {
    const t = c.n > 1 ? i / (c.n - 1) - 0.5 : 0
    const top = i === c.n - 1
    return {
      cx: c.W / 2 + rand(c.r, -0.1, 0.1) * c.S,
      cy: c.H / 2 + t * c.S * 0.35 + rand(c.r, -0.05, 0.05) * c.S,
      fw,
      aspect: 1,
      rot: rand(c.r, -14, 14) * DEG * c.tilt * (top ? 0.35 : 1),
      spec,
      tape: Math.floor(c.r() * 3),
    }
  })
}

// Brick-like grid: alternate columns shifted up/down, rows shifted left/right,
// prints slightly larger than their cell so they overlap at the edges.
function zigzag(c: Ctx, spec: Spec, flip: number, mixed: boolean): Print[] {
  const g = fitGrid(c, frameHW(spec, 4 / 3), c.S * 0.045)
  return g.centers.map((p) => {
    const base = g.cw / g.ch >= 0.9 ? 4 / 3 : 3 / 4
    const flipAspect = c.r() < 0.3
    const aspect = mixed ? (flipAspect ? 1 / base : base) : 1
    const hw = frameHW(spec, aspect)
    const fw = Math.min(g.cw * 1.12, (g.ch * 1.12) / hw) * c.scale
    const dy = (p.col % 2 ? 1 : -1) * flip * g.ch * 0.12
    const dx = (p.row % 2 ? 1 : -1) * flip * g.cw * 0.05
    return { cx: p.x + dx, cy: p.y + dy, fw, aspect, rot: rand(c.r, -1.5, 1.5) * DEG * c.tilt, spec, tape: Math.floor(c.r() * 3) }
  })
}

function arrange(layout: Extract<Layout, { arrange: Arrange }>, c: Ctx): Print[] {
  const spec = layout.kind === 'polaroid' ? POLAROID : PRINT
  const mixed = layout.kind === 'scrapbook'
  switch (layout.arrange) {
    case 'single':
      return single(c, spec)
    case 'tidy':
      return tidy(c, spec)
    case 'scatter':
      return scatter(c, spec, mixed)
    case 'cascade':
      return cascade(c, spec, mixed ? 4 / 3 : 1)
    case 'pile':
      return pile(c, spec)
    case 'zigzag':
      return zigzag(c, spec, layout.seed % 2 ? 1 : -1, mixed)
  }
}

// Tape patterns: 0 = one strip across the top edge, 1 = top-left + bottom-right
// corners, 2 = top-right + bottom-left corners. Sizes follow the frame width.
function tapeFor(pattern: number, f: Rect, r: () => number): Tape[] {
  const w = f.w * 0.26
  const h = f.w * 0.075
  const tilt = () => rand(r, -6, 6) * DEG
  if (pattern === 0) return [{ x: f.x + f.w / 2, y: f.y, w: w * 1.1, h, rot: tilt() }]
  const corner = (x: number, y: number, base: number) => ({ x, y, w, h, rot: base + tilt() })
  return pattern === 1
    ? [corner(f.x, f.y, -45 * DEG), corner(f.x + f.w, f.y + f.h, -45 * DEG)]
    : [corner(f.x + f.w, f.y, 45 * DEG), corner(f.x, f.y + f.h, 45 * DEG)]
}

function toCell(p: Print, W: number, H: number, S: number, tape: boolean, r: () => number): Cell {
  const pw = p.fw * (1 - 2 * p.spec.side)
  const ph = pw / p.aspect
  const fh = p.fw * (p.spec.top + p.spec.bottom) + ph
  // Keep the whole rotated print on the canvas when it can fit.
  const cos = Math.abs(Math.cos(p.rot))
  const sin = Math.abs(Math.sin(p.rot))
  const hx = (p.fw * cos + fh * sin) / 2
  const hy = (p.fw * sin + fh * cos) / 2
  const m = S * 0.025
  const cx = 2 * (hx + m) <= W ? Math.min(W - m - hx, Math.max(m + hx, p.cx)) : W / 2
  const cy = 2 * (hy + m) <= H ? Math.min(H - m - hy, Math.max(m + hy, p.cy)) : H / 2
  const frame = { x: cx - p.fw / 2, y: cy - fh / 2, w: p.fw, h: fh }
  // Always draw from r so the sequence (and thus every variant) is stable.
  const strips = tapeFor(p.tape, frame, r)
  return {
    x: frame.x + p.fw * p.spec.side,
    y: frame.y + p.fw * p.spec.top,
    w: pw,
    h: ph,
    rot: p.rot,
    px: cx,
    py: cy,
    frame,
    tape: tape ? strips : undefined,
  }
}

// ── Catalogue ───────────────────────────────────────────────────────────────

type Variant = { arrange: Arrange; seed: number; min: number; max: number }

const PRINT_VARIANTS: Record<'polaroid' | 'scrapbook', Variant[]> = {
  polaroid: [
    { arrange: 'single', seed: 11, min: 1, max: 1 },
    { arrange: 'scatter', seed: 1, min: 1, max: 9 },
    { arrange: 'scatter', seed: 7, min: 2, max: 9 },
    { arrange: 'zigzag', seed: 9, min: 3, max: 9 },
    { arrange: 'cascade', seed: 3, min: 2, max: 6 },
    { arrange: 'pile', seed: 5, min: 2, max: 5 },
    { arrange: 'tidy', seed: 2, min: 1, max: 9 },
  ],
  scrapbook: [
    { arrange: 'single', seed: 12, min: 1, max: 1 },
    { arrange: 'zigzag', seed: 1, min: 2, max: 9 },
    { arrange: 'zigzag', seed: 4, min: 2, max: 9 },
    { arrange: 'scatter', seed: 3, min: 1, max: 9 },
    { arrange: 'cascade', seed: 8, min: 2, max: 6 },
    { arrange: 'pile', seed: 6, min: 2, max: 4 },
  ],
}

export const LAYOUTS: Layout[] = (() => {
  const out: Layout[] = []
  const seen: Record<number, number> = {}
  for (const root of TREES) {
    const count = countCells(root)
    seen[count] = (seen[count] ?? 0) + 1
    out.push({ id: `${count}-${seen[count]}`, kind: 'grid', count, root })
  }
  for (const kind of ['polaroid', 'scrapbook'] as const) {
    for (let count = 1; count <= MAX_CELLS; count++) {
      PRINT_VARIANTS[kind]
        .filter((v) => count >= v.min && count <= v.max)
        .forEach((v, i) => out.push({ id: `${kind[0]}${count}-${i + 1}`, kind, count, arrange: v.arrange, seed: v.seed }))
    }
  }
  return out
})()

export function layoutsFor(kind: Kind, count: number): Layout[] {
  return LAYOUTS.filter((l) => l.kind === kind && l.count === count)
}

export function layoutById(id: string): Layout | undefined {
  return LAYOUTS.find((l) => l.id === id)
}

export function cellsFor(layout: Layout, W: number, H: number, o: CellOptions): Cell[] {
  if (layout.kind === 'grid') {
    return computeRects(layout.root, W, H, o.gap).map((r) => ({ ...r, rot: 0, px: r.x + r.w / 2, py: r.y + r.h / 2 }))
  }
  const S = Math.min(W, H)
  const r = rng(layout.seed * 1009 + layout.count)
  const c: Ctx = { n: layout.count, W, H, S, scale: o.scale, tilt: o.tilt, r }
  return arrange(layout, c).map((p) => toCell(p, W, H, S, o.tape, r))
}

// The point in a cell's own unrotated space that is under `(x, y)`.
export function toLocal(cell: Cell, x: number, y: number) {
  if (!cell.rot) return { x, y }
  const cos = Math.cos(-cell.rot)
  const sin = Math.sin(-cell.rot)
  const dx = x - cell.px
  const dy = y - cell.py
  return { x: cell.px + dx * cos - dy * sin, y: cell.py + dx * sin + dy * cos }
}

export function hitArea(cell: Cell): Rect {
  return cell.frame ?? cell
}
