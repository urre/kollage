import { useEffect, useState } from 'react'
import { renderToBlob, type Format, type Scene } from '../collage'
import { DownloadIcon, ShareIcon } from './icons'
import { Sheet } from './Sheet'

type Kind = 'jpg' | 'png'
// url (blob:) backs the download link; preview (data:) backs the <img>.
// iOS Safari's long-press "Lägg till i Bilder" is unreliable on blob: images
// but works on data: images, which is the whole point of the preview.
type Result = { url: string; preview: string; file: File }

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

const KINDS: { id: Kind; label: string; hint: string; mime: 'image/jpeg' | 'image/png' }[] = [
  { id: 'jpg', label: 'JPG', hint: 'Mindre fil', mime: 'image/jpeg' },
  { id: 'png', label: 'PNG', hint: 'Bäst kvalitet', mime: 'image/png' },
]

function fileName(kind: Kind) {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `kollage-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.${kind}`
}

export function ExportSheet({ scene, format, empty, onClose }: { scene: Scene; format: Format; empty: number; onClose: () => void }) {
  const [kind, setKind] = useState<Kind>('jpg')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => () => void (result && URL.revokeObjectURL(result.url)), [result])

  const pickKind = (k: Kind) => {
    if (k === kind) return
    setKind(k)
    setResult(null)
  }

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      const k = KINDS.find((x) => x.id === kind)!
      const blob = await renderToBlob(scene, format, k.mime)
      const file = new File([blob], fileName(kind), { type: k.mime })
      // No automatic download: on iOS it pops a "Hämta?" dialog that sends the
      // file to Filer, which is not where people expect their photos.
      setResult({ url: URL.createObjectURL(file), preview: await toDataUrl(blob), file })
    } catch {
      setError('Det gick inte att skapa bilden. Prova JPG eller färre bilder.')
    } finally {
      setBusy(false)
    }
  }

  // Web Share needs a secure context, so on plain http this stays hidden.
  const canShare = !!result && typeof navigator.canShare === 'function' && navigator.canShare({ files: [result.file] })

  const share = async () => {
    if (!result) return
    try {
      await navigator.share({ files: [result.file] })
    } catch {
      // Dismissing the share sheet rejects; nothing to do.
    }
  }

  const [W, H] = format.size

  return (
    <Sheet title="Spara kollage" onClose={onClose}>
      {() => (
        <>
          <div className="segmented" role="radiogroup" aria-label="Filformat">
            {KINDS.map((k) => (
              <button key={k.id} role="radio" aria-checked={k.id === kind} data-active={k.id === kind} onClick={() => pickKind(k.id)}>
                <strong>{k.label}</strong>
                <span>{k.hint}</span>
              </button>
            ))}
          </div>

          {result ? (
            <div className="result">
              <img src={result.preview} alt="Ditt kollage" className="result-img" />
              <p className="result-how">
                Håll fingret på bilden och välj <strong>Lägg till i Bilder</strong>
                <span className="muted"> (Android: Ladda ned bild)</span>
              </p>
              <p className="muted">
                {W} × {H} px · {(result.file.size / 1e6).toFixed(1)} MB
              </p>
            </div>
          ) : (
            <p className="muted sheet-note">
              {W} × {H} px. Bilden skapas i telefonen och laddas aldrig upp.
            </p>
          )}

          {empty > 0 && (
            <p className="muted sheet-note">
              {empty === 1 ? 'En ruta är tom' : `${empty} rutor är tomma`} och blir bakgrund i bilden.
            </p>
          )}

          {error && <p className="error">{error}</p>}

          <div className="sheet-actions">
            {result ? (
              <>
                <a className="btn btn-secondary" href={result.url} download={result.file.name}>
                  <DownloadIcon />
                  Spara som fil
                </a>
                {canShare && (
                  <button className="btn btn-secondary" onClick={share}>
                    <ShareIcon />
                    Dela
                  </button>
                )}
              </>
            ) : (
              <button className="btn btn-primary" onClick={create} disabled={busy}>
                {busy ? <span className="spinner" /> : <DownloadIcon />}
                {busy ? 'Skapar bild…' : `Skapa ${kind.toUpperCase()}`}
              </button>
            )}
          </div>
        </>
      )}
    </Sheet>
  )
}
