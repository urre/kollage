import { useEffect, useState } from 'react'
import { renderToBlob, type Format, type Scene } from '../collage'
import { DownloadIcon, ShareIcon } from './icons'
import { Sheet } from './Sheet'

type Kind = 'jpg' | 'png'
// url (blob:) backs the download link; preview (data:) backs the <img>.
// iOS Safari's long-press "Add to Photos" is unreliable on blob: images
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
  { id: 'jpg', label: 'JPG', hint: 'Smaller file', mime: 'image/jpeg' },
  { id: 'png', label: 'PNG', hint: 'Best quality', mime: 'image/png' },
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
      // No automatic download: on iOS it pops a "Download?" dialog that sends
      // the file to Files, which is not where people expect their photos.
      setResult({ url: URL.createObjectURL(file), preview: await toDataUrl(blob), file })
    } catch {
      setError('The image could not be created. Try JPG, or fewer photos.')
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
    <Sheet title="Save collage" onClose={onClose}>
      {() => (
        <>
          <div className="segmented" role="radiogroup" aria-label="File format">
            {KINDS.map((k) => (
              <button key={k.id} role="radio" aria-checked={k.id === kind} data-active={k.id === kind} onClick={() => pickKind(k.id)}>
                <strong>{k.label}</strong>
                <span>{k.hint}</span>
              </button>
            ))}
          </div>

          {result ? (
            <div className="result">
              <img src={result.preview} alt="Your collage" className="result-img" />
              <p className="result-how">
                Press and hold the image, then choose <strong>Add to Photos</strong>
                <span className="muted"> (Android: Download image)</span>
              </p>
              <p className="muted">
                {W} × {H} px · {(result.file.size / 1e6).toFixed(1)} MB
              </p>
            </div>
          ) : (
            <p className="muted sheet-note">
              {W} × {H} px. The image is made on your phone and never uploaded.
            </p>
          )}

          {empty > 0 && (
            <p className="muted sheet-note">
              {empty === 1 ? 'One cell is empty' : `${empty} cells are empty`} and will show the background.
            </p>
          )}

          {error && <p className="error">{error}</p>}

          <div className="sheet-actions">
            {result ? (
              <>
                <a className="btn btn-secondary" href={result.url} download={result.file.name}>
                  <DownloadIcon />
                  Save as file
                </a>
                {canShare && (
                  <button className="btn btn-secondary" onClick={share}>
                    <ShareIcon />
                    Share
                  </button>
                )}
              </>
            ) : (
              <button className="btn btn-primary" onClick={create} disabled={busy}>
                {busy ? <span className="spinner" /> : <DownloadIcon />}
                {busy ? 'Creating image…' : `Create ${kind.toUpperCase()}`}
              </button>
            )}
          </div>
        </>
      )}
    </Sheet>
  )
}
