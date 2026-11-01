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
  TextIcon,
  TrashIcon,
  TypeIcon,
} from './components/icons'
import { FormatPanel, LayoutPanel, PhotosPanel, StylePanel, TextPanel, TypePanel } from './components/Panels'
import { Start } from './components/Start'
import { layoutById } from './layouts'
import { loadPhotos } from './photos'
import { initialState, layoutIdFor, reducer } from './state'

type Tab = 'type' | 'layout' | 'format' | 'style' | 'text' | 'photos'

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'type', label: 'Typ', icon: <TypeIcon /> },
  { id: 'layout', label: 'Layout', icon: <LayoutIcon /> },
  { id: 'format', label: 'Format', icon: <FormatIcon /> },
  { id: 'style', label: 'Stil', icon: <StyleIcon /> },
  { id: 'text', label: 'Text', icon: <TextIcon /> },
  { id: 'photos', label: 'Bilder', icon: <PhotosIcon /> },
]

function failedMessage(n: number) {
  return n === 1 ? 'En bild gick inte att läsa.' : `${n} bilder gick inte att läsa.`
}

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('layout')
  const [selected, setSelected] = useState<number | null>(null)
  const [swapping, setSwapping] = useState(false)
  const [textSelected, setTextSelected] = useState(false)
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
    () => (layout ? { layout, slots: state.slots, photos: photosById, style: state.style, text: state.text } : null),
    [layout, state.slots, photosById, state.style, state.text],
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
    setTextSelected(false)
  }

  const onTextTap = () => {
    setSelected(null)
    setSwapping(false)
    setTextSelected(true)
    setTab('text')
  }

  const onTap = (index: number | null) => {
    setTextSelected(false)
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
    if (selected === null) return setNotice('Tryck först på rutan du vill byta bild i.')
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
  // Clearing the field leaves nothing on the canvas to select, ring or drag.
  const textActive = textSelected && state.text.value.trim().length > 0

  return (
    <div className="editor">
      <header className="topbar">
        <button className="btn-text" onClick={() => setResetting(true)}>
          Börja om
        </button>
        <span className="wordmark">Kollage</span>
        <button className="btn btn-primary btn-small" onClick={() => setExporting(true)}>
          Spara
        </button>
      </header>

      <CollageCanvas
        scene={scene}
        ratio={ratioOf(format)}
        selected={selected}
        swapping={swapping}
        textSelected={textActive}
        onTap={onTap}
        onSlot={(index, slot) => dispatch({ type: 'setSlot', index, slot })}
        onText={(text) => dispatch({ type: 'setText', text })}
        onTextTap={onTextTap}
      />

      <div className="context" aria-live="polite">
        {busy ? (
          <p className="context-hint">
            <span className="spinner" /> Läser in bilder…
          </p>
        ) : notice ? (
          <p className="context-hint">{notice}</p>
        ) : swapping ? (
          <div className="context-bar">
            <p className="context-hint">Tryck på rutan du vill byta plats med</p>
            <button className="chip" onClick={() => setSwapping(false)}>
              Avbryt
            </button>
          </div>
        ) : selectedHasPhoto ? (
          <div className="context-bar">
            <button className="chip" onClick={() => setTab('photos')}>
              <ReplaceIcon /> Byt bild
            </button>
            <button className="chip" onClick={() => setSwapping(true)}>
              <SwapIcon /> Byt plats
            </button>
            <button
              className="chip chip-toggle"
              data-active={state.slots[selected!].bw}
              aria-pressed={state.slots[selected!].bw}
              aria-label="Svartvitt"
              onClick={() => dispatch({ type: 'setSlot', index: selected!, slot: { bw: !state.slots[selected!].bw } })}
            >
              <ContrastIcon />
            </button>
            <button className="chip" onClick={() => dispatch({ type: 'assign', index: selected!, photoId: null })}>
              <TrashIcon /> Töm
            </button>
            <button className="chip chip-icon" onClick={deselect} aria-label="Klar">
              <CheckIcon />
            </button>
          </div>
        ) : textActive ? (
          <p className="context-hint">Dra för att flytta · nyp för att ändra storlek</p>
        ) : (
          <p className="context-hint">Tryck på en bild för att ändra · dra och nyp för att justera</p>
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
        {tab === 'text' && <TextPanel text={state.text} onText={(text) => dispatch({ type: 'setText', text })} />}
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
          title="Börja om?"
          body="Kollaget töms och alla valda bilder försvinner."
          confirmLabel="Börja om"
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
