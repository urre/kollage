import {
  BACKGROUNDS,
  FORMATS,
  GAP_MAX,
  PAPERS,
  RADIUS_MAX,
  ratioOf,
  SCALE_RANGE,
  TILT_MAX,
  type Format,
  type Photo,
  type Style,
} from '../collage'
import { cellsFor, KINDS, layoutsFor, MAX_CELLS, type Kind, type Layout } from '../layouts'
import { CloseIcon, PlusIcon, ShuffleIcon } from './icons'

function LayoutThumb({ layout, ratio, style }: { layout: Layout; ratio: number; style: Style }) {
  const h = 52
  const w = Math.round(h * ratio)
  const cells = cellsFor(layout, w, h, { gap: 2.5, scale: style.scale, tilt: style.tilt, tape: style.tape })
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      {cells.map((c, i) =>
        c.frame ? (
          <g key={i} transform={`rotate(${(c.rot * 180) / Math.PI} ${c.px} ${c.py})`}>
            <rect className="t-frame" x={c.frame.x} y={c.frame.y} width={c.frame.w} height={c.frame.h} />
            <rect className="t-photo" x={c.x} y={c.y} width={c.w} height={c.h} />
            {c.tape?.map((t, j) => (
              <rect
                key={j}
                className="t-tape"
                x={t.x - t.w / 2}
                y={t.y - t.h / 2}
                width={t.w}
                height={t.h}
                transform={`rotate(${(t.rot * 180) / Math.PI} ${t.x} ${t.y})`}
              />
            ))}
          </g>
        ) : (
          <rect key={i} className="t-cell" x={c.x} y={c.y} width={c.w} height={c.h} rx={c.round ? c.w / 2 : 1.5} />
        ),
      )}
    </svg>
  )
}

export function TypePanel(props: { kind: Kind; count: number; ratio: number; style: Style; onKind: (k: Kind) => void }) {
  return (
    <div className="scroller kinds" role="radiogroup" aria-label="Typ av kollage">
      {KINDS.map((k) => {
        const preview = layoutsFor(k.id, props.count)[0]
        return (
          <button
            key={k.id}
            role="radio"
            aria-checked={k.id === props.kind}
            className="kind"
            data-active={k.id === props.kind}
            onClick={() => props.onKind(k.id)}
          >
            {preview && <LayoutThumb layout={preview} ratio={props.ratio} style={props.style} />}
            <span className="kind-text">
              <span className="format-label">{k.label}</span>
              <span className="format-hint">{k.hint}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function LayoutPanel(props: {
  kind: Kind
  style: Style
  count: number
  layoutId: string
  ratio: number
  onCount: (n: number) => void
  onLayout: (id: string) => void
}) {
  const counts = Array.from({ length: MAX_CELLS }, (_, i) => i + 1)
  return (
    <div className="panel-stack">
      <div className="counts" role="radiogroup" aria-label="Antal bilder">
        {counts.map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={n === props.count}
            className="count"
            data-active={n === props.count}
            onClick={() => props.onCount(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="scroller" role="radiogroup" aria-label="Layout">
        {layoutsFor(props.kind, props.count).map((l) => (
          <button
            key={l.id}
            role="radio"
            aria-checked={l.id === props.layoutId}
            aria-label={`Layout ${l.id}`}
            className="thumb"
            data-active={l.id === props.layoutId}
            onClick={() => props.onLayout(l.id)}
          >
            <LayoutThumb layout={l} ratio={props.ratio} style={props.style} />
          </button>
        ))}
      </div>
    </div>
  )
}

function FormatShape({ format }: { format: Format }) {
  const r = ratioOf(format)
  const box = 30
  const w = r >= 1 ? box : box * r
  const h = r >= 1 ? box / r : box
  return <span className="format-shape" style={{ width: w, height: h }} />
}

export function FormatPanel({ formatId, onFormat }: { formatId: string; onFormat: (id: string) => void }) {
  return (
    <div className="scroller formats" role="radiogroup" aria-label="Format">
      {FORMATS.map((f) => (
        <button
          key={f.id}
          role="radio"
          aria-checked={f.id === formatId}
          className="format"
          data-active={f.id === formatId}
          onClick={() => onFormat(f.id)}
        >
          <span className="format-box">
            <FormatShape format={f} />
          </span>
          <span className="format-label">{f.label}</span>
          <span className="format-hint">{f.hint}</span>
        </button>
      ))}
    </div>
  )
}

function Slider(props: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const { min, max } = props
  return (
    <label className="slider">
      <span>{props.label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(((props.value - min) / (max - min)) * 100)}
        onChange={(e) => props.onChange(min + (Number(e.target.value) / 100) * (max - min))}
      />
    </label>
  )
}

export function StylePanel({ kind, style, onStyle }: { kind: Kind; style: Style; onStyle: (s: Partial<Style>) => void }) {
  const prints = kind !== 'grid'
  return (
    <div className="panel-stack style-panel">
      {prints ? (
        <>
          <Slider label="Storlek" value={style.scale} min={SCALE_RANGE[0]} max={SCALE_RANGE[1]} onChange={(scale) => onStyle({ scale })} />
          <Slider label="Lutning" value={style.tilt} min={0} max={TILT_MAX} onChange={(tilt) => onStyle({ tilt })} />
        </>
      ) : (
        <>
          <Slider label="Mellanrum" value={style.gap} min={0} max={GAP_MAX} onChange={(gap) => onStyle({ gap })} />
          <Slider label="Hörn" value={style.radius} min={0} max={RADIUS_MAX} onChange={(radius) => onStyle({ radius })} />
        </>
      )}
      <div className="swatches" role="radiogroup" aria-label="Bakgrund">
        {prints && (
          <button className="toggle" aria-pressed={style.tape} data-active={style.tape} onClick={() => onStyle({ tape: !style.tape })}>
            Tejp
          </button>
        )}
        {(prints ? PAPERS : BACKGROUNDS).map((bg) => (
          <button
            key={bg}
            role="radio"
            aria-checked={bg === style.bg}
            aria-label={`Bakgrund ${bg}`}
            className="swatch"
            data-active={bg === style.bg}
            style={{ background: bg }}
            onClick={() => onStyle({ bg })}
          />
        ))}
      </div>
    </div>
  )
}

export function PhotosPanel(props: {
  photos: Photo[]
  usedAt: Map<string, number>
  picking: boolean
  onAdd: () => void
  onShuffle: () => void
  onPick: (id: string) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="panel-stack">
      <p className="panel-note">{props.picking ? 'Välj en bild till rutan' : 'Tryck på en ruta i kollaget för att byta bild'}</p>
      <div className="scroller photos">
        <button className="tile tile-action" onClick={props.onAdd}>
          <PlusIcon />
          <span>Lägg till</span>
        </button>
        <button className="tile tile-action" onClick={props.onShuffle}>
          <ShuffleIcon />
          <span>Blanda</span>
        </button>
        {props.photos.map((p) => {
          const at = props.usedAt.get(p.id)
          return (
            <div key={p.id} className="tile-wrap">
              <button
                className="tile tile-photo"
                data-picking={props.picking}
                data-used={at !== undefined}
                onClick={() => props.onPick(p.id)}
                aria-label={at !== undefined ? `Bild i ruta ${at + 1}` : 'Bild som inte används'}
              >
                <img src={p.thumb} alt="" draggable={false} />
                {at !== undefined && <span className="badge">{at + 1}</span>}
              </button>
              <button className="tile-remove" aria-label="Ta bort bild" onClick={() => props.onRemove(p.id)}>
                <CloseIcon />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
