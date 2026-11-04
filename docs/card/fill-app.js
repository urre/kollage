// Fills a running Kollage with solid blocks in the icon's own colours, so the
// share cards show the app's shapes rather than pretend holiday pictures.
// `target` is an iframe element, or a window to drive that document directly.
window.fillApp = async function fillApp(target, { kind = 0, layout = 0 } = {}) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  // An iframe starts on about:blank, so read the document fresh each time
  // instead of capturing one that is about to be replaced.
  const win = () => ('contentWindow' in target ? target.contentWindow : target)
  const doc = () => win() && win().document
  const q = (sel) => doc().querySelectorAll(sel)

  while (!doc() || doc().readyState !== 'complete' || !doc().querySelector('input[type=file]')) await wait(50)
  win().Element.prototype.setPointerCapture = () => {}

  // Yellow, paper white, grey, near-black — the four fills in icon.svg.
  const BLOCKS = [
    { w: 1200, h: 1600, fill: '#ffd60a' },
    { w: 1600, h: 1200, fill: '#f0f0f2' },
    { w: 1200, h: 1200, fill: '#8e8e93' },
    { w: 1200, h: 1600, fill: '#1c1c1f' },
  ]

  const dt = new (win().DataTransfer)()
  for (const [i, { w, h, fill }] of BLOCKS.entries()) {
    const cv = doc().createElement('canvas')
    cv.width = w
    cv.height = h
    const x = cv.getContext('2d')
    x.fillStyle = fill
    x.fillRect(0, 0, w, h)
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png'))
    dt.items.add(new (win().File)([blob], `block${i + 1}.png`, { type: 'image/png' }))
  }
  const input = doc().querySelector('input[type=file]')
  input.files = dt.files
  input.dispatchEvent(new (win().Event)('change', { bubbles: true }))

  while (!doc().querySelector('.surface')) await wait(50)
  await wait(300)
  q('.tab')[0].click()
  await wait(150)
  q('.kind')[kind].click()
  await wait(200)
  q('.tab')[1].click()
  await wait(250)
  if (layout) {
    q('.thumb')[layout].click()
    await wait(300)
  }
  await wait(400)
  return true
}
