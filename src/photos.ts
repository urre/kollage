import type { Photo } from './collage'

// Phone photos are 12–48 MP. Keeping nine of those decoded would blow Safari's
// canvas memory budget, and 2048 px is plenty for a cell in a 2160 px export.
const MAX_EDGE = 2048
const THUMB_EDGE = 240

// A counter, not crypto.randomUUID: ids only need to be unique within the
// session, and this works wherever the app is opened from.
let nextId = 1

function scaledCanvas(src: CanvasImageSource, w: number, h: number, maxEdge: number) {
  const s = Math.min(1, maxEdge / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * s))
  canvas.height = Math.max(1, Math.round(h * s))
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height)
  return canvas
}

async function loadPhoto(file: File): Promise<Photo> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    // Browsers apply EXIF orientation when decoding into an <img>.
    await img.decode()
    const source = scaledCanvas(img, img.naturalWidth, img.naturalHeight, MAX_EDGE)
    const thumb = scaledCanvas(source, source.width, source.height, THUMB_EDGE).toDataURL('image/jpeg', 0.8)
    return { id: `p${nextId++}`, source, w: source.width, h: source.height, thumb }
  } finally {
    URL.revokeObjectURL(url)
  }
}

// One at a time on purpose: decoding several 48 MP images in parallel is what
// gets a Safari tab killed.
export async function loadPhotos(files: Iterable<File>): Promise<{ photos: Photo[]; failed: number }> {
  const photos: Photo[] = []
  let failed = 0
  for (const file of files) {
    try {
      photos.push(await loadPhoto(file))
    } catch {
      failed++
    }
  }
  return { photos, failed }
}
