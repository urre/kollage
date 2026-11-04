import { cellsFor, type Cell, type Layout, type Rect, type Tape } from './layouts'

export type Photo = {
  id: string
  source: HTMLCanvasElement
  w: number
  h: number
  thumb: string
}

// zoom ≥ 1 on top of "cover". ox/oy run from -1 to 1 across the overflow
// (0 = centered); values outside that range only exist mid-gesture. `bw`
// belongs to the placement, like zoom: it follows the photo when two cells
// are swapped and resets when a different photo is dropped in.
export type Slot = { photoId: string | null; zoom: number; ox: number; oy: number; bw: boolean }

// gap and radius (grid) are fractions of the short side, so the preview and
// the full-size export look identical at any resolution. scale, tilt and tape
// only apply to the print kinds (polaroid, scrapbook).
export type Style = { gap: number; radius: number; bg: string; scale: number; tilt: number; tape: boolean }

export type Format = { id: string; label: string; hint: string; size: [number, number] }

// The first format is the default.
export const FORMATS: Format[] = [
  { id: 'story', label: 'Story', hint: '9:16', size: [2160, 3840] },
  { id: 'portrait', label: 'Porträtt', hint: '4:5', size: [2160, 2700] },
  { id: 'square', label: 'Kvadrat', hint: '1:1', size: [2160, 2160] },
  { id: 'landscape', label: 'Liggande', hint: '3:2', size: [3240, 2160] },
  { id: 'wide', label: 'Bred', hint: '16:9', size: [3840, 2160] },
]

export const BACKGROUNDS = ['#ffffff', '#f1ebe1', '#e5e5ea', '#1c1c1e', '#000000', '#f4d9d4', '#d6e4ee']
// Paper tones for polaroid and scrapbook, where white frames sit on the background.
export const PAPERS = ['#ecebe8', '#f6f2ea', '#d9cdb8', '#c4a77d', '#2a2a2c', '#dfe6e1']

export const GAP_MAX = 0.05
export const RADIUS_MAX = 0.08
export const ZOOM_MAX = 5
export const SCALE_RANGE = [0.75, 1.2] as const
export const TILT_MAX = 2

export const emptySlot = (): Slot => ({ photoId: null, zoom: 1, ox: 0, oy: 0, bw: false })

export const ratioOf = (f: Format) => f.size[0] / f.size[1]

export type Scene = {
  layout: Layout
  slots: Slot[]
  photos: Map<string, Photo>
  style: Style
}

export function sceneCells(scene: Scene, W: number, H: number): Cell[] {
  const { gap, scale, tilt, tape } = scene.style
  return cellsFor(scene.layout, W, H, { gap: gap * Math.min(W, H), scale, tilt, tape })
}

// Where the photo lands inside its cell, in the same units as the rect.
export function placement(photo: Photo, r: Rect, slot: Slot) {
  const scale = Math.max(r.w / photo.w, r.h / photo.h) * slot.zoom
  const w = photo.w * scale
  const h = photo.h * scale
  return {
    x: r.x + (r.w - w) / 2 + (slot.ox * (w - r.w)) / 2,
    y: r.y + (r.h - h) / 2 + (slot.oy * (h - r.h)) / 2,
    w,
    h,
  }
}

// Inverse of placement along one axis: the offset that puts the image's
// leading edge at `edge` (cell-local).
export function offsetFor(edge: number, cell: number, img: number) {
  const over = img - cell
  return Math.abs(over) < 0.5 ? 0 : (edge - (cell - img) / 2) / (over / 2)
}

function roundedRect(ctx: CanvasRenderingContext2D, r: Rect, radius: number) {
  const rad = Math.max(0, Math.min(radius, r.w / 2, r.h / 2))
  ctx.beginPath()
  ctx.moveTo(r.x + rad, r.y)
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rad)
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rad)
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, rad)
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, rad)
  ctx.closePath()
}

// A strip of matte tape with torn, zigzag short ends, centered on (x, y).
function drawTape(ctx: CanvasRenderingContext2D, t: Tape) {
  const teeth = 4
  const amp = t.h * 0.14
  const hw = t.w / 2
  const hh = t.h / 2
  ctx.save()
  ctx.translate(t.x, t.y)
  ctx.rotate(t.rot)
  ctx.beginPath()
  ctx.moveTo(-hw, -hh)
  ctx.lineTo(hw, -hh)
  for (let i = 1; i <= teeth * 2; i++) ctx.lineTo(hw + (i % 2 ? amp : 0), -hh + (t.h * i) / (teeth * 2))
  ctx.lineTo(-hw, hh)
  for (let i = 1; i <= teeth * 2; i++) ctx.lineTo(-hw - (i % 2 ? amp : 0), hh - (t.h * i) / (teeth * 2))
  ctx.closePath()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.18)'
  ctx.shadowBlur = t.h * 0.35
  ctx.shadowOffsetY = t.h * 0.08
  ctx.fillStyle = 'rgba(240, 236, 222, 0.8)'
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)'
  ctx.lineWidth = Math.max(1, t.h * 0.03)
  ctx.stroke()
  ctx.restore()
}

// A faint paper grain under the prints. The tile is seeded so it is the same
// every time, and scaled with the canvas so preview and export match.
let grain: HTMLCanvasElement | null = null
function grainTile() {
  if (grain) return grain
  grain = document.createElement('canvas')
  grain.width = grain.height = 160
  const g = grain.getContext('2d')!
  const img = g.createImageData(160, 160)
  let s = 7
  for (let i = 0; i < img.data.length; i += 4) {
    s = (s * 16807) % 2147483647
    const v = (s % 255) | 0
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  g.putImageData(img, 0, 0)
  return grain
}

function drawGrain(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const pattern = ctx.createPattern(grainTile(), 'repeat')
  if (!pattern) return
  const k = Math.min(W, H) / 1080
  pattern.setTransform(new DOMMatrix().scale(k, k))
  ctx.save()
  ctx.globalAlpha = 0.05
  ctx.globalCompositeOperation = 'overlay'
  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, W, H)
  ctx.restore()
}

// Grayscale without a second copy of the photo in memory, which matters with
// nine 2048 px canvases on a phone. `ctx.filter` is the cheap path; Safari
// only got it in 17, so the saturation blend — which takes hue and lightness
// from what is already drawn and saturation (none) from the fill — is the
// fallback. Both are inside the cell clip, so only the photo is touched.
function drawPhoto(ctx: CanvasRenderingContext2D, photo: Photo, p: Rect, cell: Rect, bw: boolean) {
  if (!bw) {
    ctx.drawImage(photo.source, p.x, p.y, p.w, p.h)
    return
  }
  if (typeof ctx.filter === 'string') {
    ctx.filter = 'grayscale(1)'
    ctx.drawImage(photo.source, p.x, p.y, p.w, p.h)
    ctx.filter = 'none'
    return
  }
  ctx.drawImage(photo.source, p.x, p.y, p.w, p.h)
  ctx.globalCompositeOperation = 'saturation'
  ctx.fillStyle = '#808080'
  ctx.fillRect(cell.x, cell.y, cell.w, cell.h)
  ctx.globalCompositeOperation = 'source-over'
}

export function drawScene(ctx: CanvasRenderingContext2D, W: number, H: number, scene: Scene) {
  const prints = scene.layout.kind !== 'grid'
  const radius = prints ? 0 : scene.style.radius * Math.min(W, H)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = scene.style.bg
  ctx.fillRect(0, 0, W, H)
  if (prints) drawGrain(ctx, W, H)

  sceneCells(scene, W, H).forEach((c, i) => {
    const slot = scene.slots[i]
    const photo = slot?.photoId ? scene.photos.get(slot.photoId) : undefined
    if (!photo) return
    ctx.save()
    if (c.rot) {
      ctx.translate(c.px, c.py)
      ctx.rotate(c.rot)
      ctx.translate(-c.px, -c.py)
    }
    if (c.frame) {
      const f = c.frame
      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.22)'
      ctx.shadowBlur = f.w * 0.04
      ctx.shadowOffsetY = f.w * 0.012
      ctx.fillStyle = '#fbfaf6'
      ctx.fillRect(f.x, f.y, f.w, f.h)
      ctx.restore()
    }
    ctx.save()
    if (c.round) {
      // A circle, not a rounded rect: the cell is already the centred square
      // of its slot, so this matches the DOM overlay's border-radius: 50%.
      ctx.beginPath()
      ctx.ellipse(c.x + c.w / 2, c.y + c.h / 2, c.w / 2, c.h / 2, 0, 0, Math.PI * 2)
    } else {
      roundedRect(ctx, c, radius)
    }
    ctx.clip()
    const p = placement(photo, c, slot)
    drawPhoto(ctx, photo, p, c, slot.bw)
    ctx.restore()
    if (c.frame) {
      // A hairline where photo meets frame, like the edge of a real print.
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)'
      ctx.lineWidth = Math.max(1, c.frame.w * 0.003)
      ctx.strokeRect(c.x, c.y, c.w, c.h)
    }
    c.tape?.forEach((t) => drawTape(ctx, t))
    ctx.restore()
  })
}

export function renderToBlob(scene: Scene, format: Format, type: 'image/png' | 'image/jpeg'): Promise<Blob> {
  const [W, H] = format.size
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Ingen canvas'))
  drawScene(ctx, W, H, scene)
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => {
        // iOS keeps canvas memory around until the backing store is shrunk.
        canvas.width = canvas.height = 0
        if (blob) resolve(blob)
        else reject(new Error('Kunde inte skapa bilden'))
      },
      type,
      0.92,
    ),
  )
}
