import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { FORMATS, ratioOf, type Scene } from './collage'
import { CollageCanvas } from './components/CollageCanvas'
import { Confirm } from './components/Confirm'
import { ExportSheet } from './components/ExportSheet'
import {
  CheckIcon,
  ContrastIcon,
  FormatIcon,
  LayoutIcon,
  PhotosIcon,
  ReplaceIcon,
  StyleIcon,
  SwapIcon,
  TrashIcon,
  TypeIcon,
} from './components/icons'
import { FormatPanel, LayoutPanel, PhotosPanel, StylePanel, TypePanel } from './components/Panels'
import { Start } from './components/Start'
import { layoutById } from './layouts'
import { loadPhotos } from './photos'
import { initialState, layoutIdFor, reducer } from './state'

type Tab = 'type' | 'layout' | 'format' | 'style' | 'photos'

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'type', label: 'Type', icon: <TypeIcon /> },
  { id: 'layout', label: 'Layout', icon: <LayoutIcon /> },
  { id: 'format', label: 'Format', icon: <FormatIcon /> },
  { id: 'style', label: 'Style', icon: <StyleIcon /> },
  { id: 'photos', label: 'Photos', icon: <PhotosIcon /> },
]

function failedMessage(n: number) {
  return n === 1 ? 'One photo could not be read.' : `${n} photos could not be read.`
}

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('layout')
  const [selected, setSelected] = useState<number | null>(null)
  const [swapping, setSwapping] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [resetting, setResetting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const pickTarget = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 3500)
    return () => clearTimeout(t)
  }, [notice])

  const format = FORMATS.find((f) => f.id === state.formatId) ?? FORMATS[0]
  const layoutId = layoutIdFor(state)
  const layout = layoutId ? layoutById(layoutId) : undefined

  const photosById = useMemo(() => new Map(state.photos.map((p) => [p.id, p])), [state.photos])
  const scene: Scene | null = useMemo(
    () => (layout ? { layout, slots: state.slots, photos: photosById, style: state.style } : null),
    [layout, state.slots, photosById, state.style],
  )

  const usedAt = useMemo(() => {
    const m = new Map<string, number>()
    state.slots.slice(0, state.count).forEach((s, i) => s.photoId && !m.has(s.photoId) && m.set(s.photoId, i))
    return m
  }, [state.slots, state.count])

  const openPicker = (target?: number) => {
    pickTarget.current = target
    inputRef.current?.click()
  }

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    const { photos, failed } = await loadPhotos(Array.from(files))
    setBusy(false)
    if (failed) setNotice(failedMessage(failed))
    dispatch({ type: 'addPhotos', photos, target: pickTarget.current })
    if (inputRef.current) inputRef.current.value = ''
  }

  const deselect = () => {
    setSelected(null)
    setSwapping(false)
  }

  const onTap = (index: number | null) => {
    if (index === null) return deselect()
    if (swapping && selected !== null) {
      if (index !== selected) dispatch({ type: 'swap', a: selected, b: index })
      setSelected(index)
      setSwapping(false)
      return
    }
    if (!state.slots[index].photoId) {
      setSelected(index)
      return openPicker(index)
    }
    setSelected(selected === index ? null : index)
  }

  const onCount = (count: number) => {
    if (selected !== null && selected >= count) deselect()
    dispatch({ type: 'setCount', count })
  }

  const onPick = (photoId: string) => {
    if (selected === null) return setNotice('Tap the cell you want to change first.')
    dispatch({ type: 'assign', index: selected, photoId })
  }

  const reset = () => {
    deselect()
    setTab('layout')
    dispatch({ type: 'reset' })
  }

  const fileInput = (
    <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
  )

  if (!state.photos.length || !scene || !layout) {
    return (
      <>
        <Start busy={busy} error={notice} onPick={() => openPicker()} />
        {fileInput}
      </>
    )
  }

  const selectedHasPhoto = selected !== null && !!state.slots[selected]?.photoId

  return (
    <div className="editor">
      <header className="topbar">
        <button className="btn-text" onClick={() => setResetting(true)}>
          Start over
        </button>
        <span className="wordmark">Kollage</span>
        <button className="btn btn-primary btn-small" onClick={() => setExporting(true)}>
          Save
        </button>
      </header>

      <CollageCanvas
        scene={scene}
        ratio={ratioOf(format)}
        selected={selected}
        swapping={swapping}
        onTap={onTap}
        onSlot={(index, slot) => dispatch({ type: 'setSlot', index, slot })}
      />

      <div className="context" aria-live="polite">
        {busy ? (
          <p className="context-hint">
            <span className="spinner" /> Loading photos…
          </p>
        ) : notice ? (
          <p className="context-hint">{notice}</p>
        ) : swapping ? (
          <div className="context-bar">
            <p className="context-hint">Tap the cell to swap with</p>
            <button className="chip" onClick={() => setSwapping(false)}>
              Cancel
            </button>
          </div>
        ) : selectedHasPhoto ? (
          <div className="context-bar">
            <button className="chip" onClick={() => setTab('photos')}>
              <ReplaceIcon /> Replace
            </button>
            <button className="chip" onClick={() => setSwapping(true)}>
              <SwapIcon /> Swap
            </button>
            <button
              className="chip chip-toggle"
              data-active={state.slots[selected!].bw}
              aria-pressed={state.slots[selected!].bw}
              aria-label="Black and white"
              onClick={() => dispatch({ type: 'setSlot', index: selected!, slot: { bw: !state.slots[selected!].bw } })}
            >
              <ContrastIcon />
            </button>
            <button className="chip" onClick={() => dispatch({ type: 'assign', index: selected!, photoId: null })}>
              <TrashIcon /> Clear
            </button>
            <button className="chip chip-icon" onClick={deselect} aria-label="Done">
              <CheckIcon />
            </button>
          </div>
        ) : (
          <p className="context-hint">Tap a photo to change it · drag and pinch to adjust</p>
        )}
      </div>

      <section className="panel">
        {tab === 'type' && (
          <TypePanel
            kind={state.kind}
            count={state.count}
            ratio={ratioOf(format)}
            style={state.style}
            onKind={(kind) => dispatch({ type: 'setKind', kind })}
          />
        )}
        {tab === 'layout' && (
          <LayoutPanel
            kind={state.kind}
            style={state.style}
            count={state.count}
            layoutId={layout.id}
            ratio={ratioOf(format)}
            onCount={onCount}
            onLayout={(id) => dispatch({ type: 'setLayout', id })}
          />
        )}
        {tab === 'format' && <FormatPanel formatId={format.id} onFormat={(id) => dispatch({ type: 'setFormat', id })} />}
        {tab === 'style' && <StylePanel kind={state.kind} style={state.style} onStyle={(style) => dispatch({ type: 'setStyle', style })} />}
        {tab === 'photos' && (
          <PhotosPanel
            photos={state.photos}
            usedAt={usedAt}
            picking={selected !== null}
            onAdd={() => openPicker(selected ?? undefined)}
            onShuffle={() => dispatch({ type: 'shuffle' })}
            onPick={onPick}
            onRemove={(id) => dispatch({ type: 'removePhoto', id })}
          />
        )}
      </section>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className="tab" data-active={t.id === tab} aria-pressed={t.id === tab} onClick={() => setTab(t.id)}>
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {resetting && (
        <Confirm
          title="Start over?"
          body="The collage is emptied and every photo you picked is removed."
          confirmLabel="Start over"
          onConfirm={reset}
          onClose={() => setResetting(false)}
        />
      )}
      {exporting && (
        <ExportSheet
          scene={scene}
          format={format}
          empty={state.slots.slice(0, state.count).filter((s) => !s.photoId).length}
          onClose={() => setExporting(false)}
        />
      )}
      {fileInput}
    </div>
  )
}
