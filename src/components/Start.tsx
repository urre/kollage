import { PhotosIcon } from './icons'

export function Start({ busy, error, onPick }: { busy: boolean; error: string | null; onPick: () => void }) {
  return (
    <main className="start">
      <div className="start-hero">
        <div className="start-mark" aria-hidden>
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <h1>Kollage</h1>
        <p>Make a collage from your photos. Pick a layout, move and zoom, save.</p>
      </div>
      <div className="start-actions">
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-large" onClick={onPick} disabled={busy}>
          {busy ? <span className="spinner" /> : <PhotosIcon />}
          {busy ? 'Loading photos…' : 'Choose photos'}
        </button>
        <p className="muted">Your photos stay on your phone. Nothing is uploaded.</p>
      </div>
    </main>
  )
}
