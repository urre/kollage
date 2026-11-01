import { Sheet } from './Sheet'

// A question in a sheet. window.confirm puts the host name on iOS's dialog
// ("… säger"), which is the loudest "this is a website" tell in the app.
export function Confirm({
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Sheet title={title} onClose={onClose} closable={false}>
      {(close) => (
        <>
          <p className="muted sheet-note">{body}</p>
          <div className="sheet-actions">
            <button className="btn btn-secondary" onClick={() => close()}>
              Avbryt
            </button>
            {/* After the exit, or the sheet would vanish mid-animation with the editor. */}
            <button className="btn btn-danger" onClick={() => close(onConfirm)}>
              {confirmLabel}
            </button>
          </div>
        </>
      )}
    </Sheet>
  )
}
