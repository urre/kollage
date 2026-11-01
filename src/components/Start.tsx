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
        <p>Gör ett kollage av dina bilder. Välj layout, flytta och zooma, spara.</p>
      </div>
      <div className="start-actions">
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-large" onClick={onPick} disabled={busy}>
          {busy ? <span className="spinner" /> : <PhotosIcon />}
          {busy ? 'Läser in bilder…' : 'Välj bilder'}
        </button>
        <p className="muted">Bilderna stannar i din telefon. Inget laddas upp.</p>
      </div>
    </main>
  )
}
