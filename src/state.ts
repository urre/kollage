import { BACKGROUNDS, emptySlot, FORMATS, PAPERS, type Photo, type Slot, type Style } from './collage'
import { layoutsFor, MAX_CELLS, type Kind } from './layouts'

export type State = {
  photos: Photo[]
  // Always MAX_CELLS long; only the first `count` are visible. Slots past
  // `count` keep their photo so lowering and raising the count is lossless.
  slots: Slot[]
  count: number
  kind: Kind
  // Chosen layout per `${kind}:${count}`, so switching back restores it.
  layoutByKey: Record<string, string>
  formatId: string
  style: Style
}

export type Action =
  | { type: 'addPhotos'; photos: Photo[]; target?: number }
  | { type: 'removePhoto'; id: string }
  | { type: 'setCount'; count: number }
  | { type: 'setKind'; kind: Kind }
  | { type: 'setLayout'; id: string }
  | { type: 'setFormat'; id: string }
  | { type: 'setStyle'; style: Partial<Style> }
  | { type: 'setSlot'; index: number; slot: Partial<Slot> }
  | { type: 'assign'; index: number; photoId: string | null }
  | { type: 'swap'; a: number; b: number }
  | { type: 'shuffle' }
  | { type: 'reset' }

export const initialState: State = {
  photos: [],
  slots: Array.from({ length: MAX_CELLS }, emptySlot),
  count: 0,
  kind: 'grid',
  layoutByKey: {},
  formatId: FORMATS[0].id,
  style: { gap: 0.012, radius: 0, bg: '#ffffff', scale: 1, tilt: 1, tape: true },
}

const keyOf = (state: State) => `${state.kind}:${state.count}`

export function layoutIdFor(state: State) {
  return state.layoutByKey[keyOf(state)] ?? layoutsFor(state.kind, state.count)[0]?.id
}

// Puts photos that aren't visible anywhere into the empty visible slots.
function fillEmpty(slots: Slot[], count: number, photos: Photo[]): Slot[] {
  const used = new Set(slots.slice(0, count).map((s) => s.photoId))
  const unused = photos.filter((p) => !used.has(p.id))
  return slots.map((s, i) => (i < count && s.photoId === null && unused.length ? { ...emptySlot(), photoId: unused.shift()!.id } : s))
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'addPhotos': {
      if (!action.photos.length) return state
      const photos = [...state.photos, ...action.photos]
      let slots = state.slots
      if (action.target !== undefined) {
        slots = slots.map((s, i) => (i === action.target ? { ...emptySlot(), photoId: action.photos[0].id } : s))
      }
      // Grow the collage so new photos are seen rather than parked in the tray.
      const visible = slots.slice(0, state.count)
      const placed = new Set(visible.map((s) => s.photoId))
      const waiting = photos.filter((p) => !placed.has(p.id)).length
      const empty = visible.filter((s) => s.photoId === null).length
      const count = Math.min(MAX_CELLS, state.count + Math.max(0, waiting - empty))
      return { ...state, photos, count, slots: fillEmpty(slots, count, photos) }
    }
    case 'removePhoto': {
      const photos = state.photos.filter((p) => p.id !== action.id)
      if (!photos.length) return initialState
      const slots = state.slots.map((s) => (s.photoId === action.id ? emptySlot() : s))
      return { ...state, photos, slots: fillEmpty(slots, state.count, photos) }
    }
    case 'setCount':
      return { ...state, count: action.count, slots: fillEmpty(state.slots, action.count, state.photos) }
    case 'setKind': {
      // White prints vanish on a white page; start them on paper instead.
      const toPaper = action.kind !== 'grid' && !PAPERS.includes(state.style.bg)
      const toPlain = action.kind === 'grid' && !BACKGROUNDS.includes(state.style.bg)
      const bg = toPaper ? PAPERS[0] : toPlain ? BACKGROUNDS[0] : state.style.bg
      // Tape is what makes a scrapbook; polaroids start clean.
      return { ...state, kind: action.kind, style: { ...state.style, bg, tape: action.kind === 'scrapbook' } }
    }
    case 'setLayout':
      return { ...state, layoutByKey: { ...state.layoutByKey, [keyOf(state)]: action.id } }
    case 'setFormat':
      return { ...state, formatId: action.id }
    case 'setStyle':
      return { ...state, style: { ...state.style, ...action.style } }
    case 'setSlot':
      return { ...state, slots: state.slots.map((s, i) => (i === action.index ? { ...s, ...action.slot } : s)) }
    case 'assign':
      return { ...state, slots: state.slots.map((s, i) => (i === action.index ? { ...emptySlot(), photoId: action.photoId } : s)) }
    case 'swap': {
      const slots = [...state.slots]
      ;[slots[action.a], slots[action.b]] = [slots[action.b], slots[action.a]]
      return { ...state, slots }
    }
    case 'shuffle': {
      const visible = state.slots.slice(0, state.count)
      const order = visible.map((_, i) => i)
      // Fisher–Yates, retried so the result never equals the current order.
      do {
        for (let i = order.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[order[i], order[j]] = [order[j], order[i]]
        }
      } while (order.length > 1 && order.every((v, i) => v === i))
      const shuffled = order.map((from) => ({ ...emptySlot(), photoId: visible[from].photoId }))
      return { ...state, slots: [...shuffled, ...state.slots.slice(state.count)] }
    }
    case 'reset':
      return initialState
  }
}
