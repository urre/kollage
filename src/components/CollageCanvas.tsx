import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { drawScene, offsetFor, placement, sceneCells, ZOOM_MAX, type Photo, type Scene, type Slot } from '../collage'
import { hitArea, toLocal, type Cell, type Rect } from '../layouts'
import { PlusIcon } from './icons'

type Props = {
  scene: Scene
  ratio: number
  selected: number | null
  swapping: boolean
  onTap: (index: number | null) => void
  onSlot: (index: number, slot: Partial<Slot>) => void
}

type Point = { x: number; y: number }

// Pointer positions are converted into the touched cell's own unrotated space
// as they come in, so all the pan/zoom math below is the same for a straight
// grid cell and a tilted polaroid.
type Gesture = {
  cell: number
  rect: Cell
  photo: Photo | undefined
  pointers: Map<number, Point>
  moved: boolean
  // Reference values for the current phase. Re-taken whenever a finger lands
  // or lifts, so switching between one and two fingers never makes the image jump.
  start: { slot: Slot; at: Point; dist: number }
}

const TAP_SLOP = 8

// Apple's rubber-band curve: the further past the edge, the less it follows.
const rubber = (over: number, dim: number, c = 0.55) => (over * dim * c) / (dim + c * over)

function band(v: number, a: number, b: number, dim: number) {
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  if (v > hi) return hi + rubber(v - hi, dim)
  if (v < lo) return lo - rubber(lo - v, dim)
  return v
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function centroid(points: Point[]): Point {
  const n = points.length
  return { x: points.reduce((s, p) => s + p.x, 0) / n, y: points.reduce((s, p) => s + p.y, 0) / n }
}

function spread(points: Point[]) {
  return points.length < 2 ? 0 : Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
}

// Absolutely positioned overlay for `r`, rotated with its cell.
function boxStyle(r: Rect, cell: Cell, radius: number) {
  return {
    width: r.w,
    height: r.h,
    transform: `translate(${r.x}px, ${r.y}px)${cell.rot ? ` rotate(${cell.rot}rad)` : ''}`,
    transformOrigin: `${cell.px - r.x}px ${cell.py - r.y}px`,
    borderRadius: Math.min(radius, r.w / 2, r.h / 2),
  }
}

export function CollageCanvas({ scene, ratio, selected, swapping, onTap, onSlot }: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stage, setStage] = useState({ w: 0, h: 0 })
  const gesture = useRef<Gesture | null>(null)
  const settleFrame = useRef(0)
  const sceneRef = useRef(scene)
  sceneRef.current = scene

  useLayoutEffect(() => {
    const el = stageRef.current!
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setStage({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Largest box of the format's ratio that fits the stage.
  const size =
    stage.w / Math.max(stage.h, 1) > ratio
      ? { w: Math.floor(stage.h * ratio), h: Math.floor(stage.h) }
      : { w: Math.floor(stage.w), h: Math.floor(stage.w / ratio) }

  const cells = size.w > 0 ? sceneCells(scene, size.w, size.h) : []
  const radius = scene.layout.kind === 'grid' ? scene.style.radius * Math.min(size.w, size.h) : 0

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.w <= 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    const W = Math.round(size.w * dpr)
    const H = Math.round(size.h * dpr)
    if (canvas.width !== W) canvas.width = W
    if (canvas.height !== H) canvas.height = H
    const ctx = canvas.getContext('2d')
    if (ctx) drawScene(ctx, W, H, scene)
  }, [scene, size.w, size.h])

  useEffect(() => () => cancelAnimationFrame(settleFrame.current), [])

  const localPoint = (e: PointerEvent): Point => {
    const b = surfaceRef.current!.getBoundingClientRect()
    return { x: e.clientX - b.left, y: e.clientY - b.top }
  }

  // Topmost first: later cells are drawn over earlier ones.
  const hit = (p: Point) => {
    for (let i = cells.length - 1; i >= 0; i--) {
      const q = toLocal(cells[i], p.x, p.y)
      const r = hitArea(cells[i])
      if (q.x >= r.x && q.x <= r.x + r.w && q.y >= r.y && q.y <= r.y + r.h) return i
    }
    return -1
  }

  const restartPhase = (g: Gesture) => {
    const pts = [...g.pointers.values()]
    g.start = { slot: { ...sceneRef.current.slots[g.cell] }, at: centroid(pts), dist: spread(pts) }
  }

  // Ease back inside the bounds, starting from wherever the image is now. A
  // new touch cancels it and picks up from the on-screen value.
  const settle = (cell: number) => {
    cancelAnimationFrame(settleFrame.current)
    let last = performance.now()
    const step = (now: number) => {
      const s = sceneRef.current.slots[cell]
      const target = { zoom: clamp(s.zoom, 1, ZOOM_MAX), ox: clamp(s.ox, -1, 1), oy: clamp(s.oy, -1, 1) }
      // rAF timestamps can trail performance.now() by a frame.
      const k = 1 - Math.exp(-Math.max(0, now - last) / 70)
      last = now
      const next = {
        zoom: s.zoom + (target.zoom - s.zoom) * k,
        ox: s.ox + (target.ox - s.ox) * k,
        oy: s.oy + (target.oy - s.oy) * k,
      }
      const done =
        Math.abs(next.zoom - target.zoom) < 0.001 && Math.abs(next.ox - target.ox) < 0.002 && Math.abs(next.oy - target.oy) < 0.002
      onSlot(cell, done ? target : next)
      if (!done) settleFrame.current = requestAnimationFrame(step)
    }
    settleFrame.current = requestAnimationFrame(step)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const p = localPoint(e)
    let g = gesture.current
    if (!g) {
      const cell = hit(p)
      if (cell < 0) {
        onTap(null)
        return
      }
      cancelAnimationFrame(settleFrame.current)
      const slot = sceneRef.current.slots[cell]
      g = {
        cell,
        rect: cells[cell],
        photo: slot.photoId ? sceneRef.current.photos.get(slot.photoId) : undefined,
        pointers: new Map(),
        moved: false,
        start: { slot: { ...slot }, at: toLocal(cells[cell], p.x, p.y), dist: 0 },
      }
      gesture.current = g
    }
    // A third finger would make the pinch jump; ignore it.
    if (g.pointers.size >= 2) return
    e.currentTarget.setPointerCapture(e.pointerId)
    g.pointers.set(e.pointerId, toLocal(g.rect, p.x, p.y))
    if (g.pointers.size === 2) g.moved = true
    restartPhase(g)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g || !g.pointers.has(e.pointerId)) return
    const p = localPoint(e)
    g.pointers.set(e.pointerId, toLocal(g.rect, p.x, p.y))
    const pts = [...g.pointers.values()]
    const at = centroid(pts)

    if (!g.moved) {
      if (Math.hypot(at.x - g.start.at.x, at.y - g.start.at.y) < TAP_SLOP) return
      g.moved = true
      restartPhase(g)
      return
    }
    if (!g.photo || swapping) return

    const { rect, photo, start } = g
    const cell = { x: 0, y: 0, w: rect.w, h: rect.h }
    const from = placement(photo, cell, start.slot)

    if (pts.length === 1) {
      const x = band(from.x + at.x - start.at.x, cell.w - from.w, 0, cell.w)
      const y = band(from.y + at.y - start.at.y, cell.h - from.h, 0, cell.h)
      onSlot(g.cell, { ox: offsetFor(x, cell.w, from.w), oy: offsetFor(y, cell.h, from.h) })
      return
    }

    // Pinch: zoom around the point between the fingers and let it follow them.
    const raw = (start.slot.zoom * spread(pts)) / Math.max(start.dist, 1)
    const zoom = raw < 1 ? 1 - (1 - raw) * 0.4 : raw > ZOOM_MAX ? ZOOM_MAX + (raw - ZOOM_MAX) * 0.2 : raw
    const ux = (start.at.x - rect.x - from.x) / from.w
    const uy = (start.at.y - rect.y - from.y) / from.h
    const to = placement(photo, cell, { ...start.slot, zoom, ox: 0, oy: 0 })
    const x = at.x - rect.x - ux * to.w
    const y = at.y - rect.y - uy * to.h
    onSlot(g.cell, { zoom, ox: offsetFor(x, cell.w, to.w), oy: offsetFor(y, cell.h, to.h) })
  }

  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g || !g.pointers.delete(e.pointerId)) return
    if (g.pointers.size > 0) {
      restartPhase(g)
      return
    }
    gesture.current = null
    if (!g.moved) onTap(g.cell)
    else if (g.photo) settle(g.cell)
  }

  const ringCell = selected !== null ? cells[selected] : undefined

  return (
    <div className="stage" ref={stageRef} onPointerDown={(e) => e.target === e.currentTarget && onTap(null)}>
      <div
        ref={surfaceRef}
        className="surface"
        style={{ width: size.w, height: size.h }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <canvas ref={canvasRef} style={{ width: size.w, height: size.h }} />
        {cells.map((c, i) =>
          scene.slots[i]?.photoId ? null : (
            <div key={i} className="cell-empty" style={boxStyle(hitArea(c), c, radius)}>
              <PlusIcon />
            </div>
          ),
        )}
        {ringCell && (
          <div className={`ring${swapping ? ' ring-swap' : ''}`} style={boxStyle(hitArea(ringCell), ringCell, radius)} />
        )}
      </div>
    </div>
  )
}
