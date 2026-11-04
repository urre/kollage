async () => {
  Element.prototype.setPointerCapture = () => {}
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))

  // Stand-in "photographs": a sky wash, a soft sun, and two silhouette ridges.
  // Abstract enough to be honest, structured enough to read as a landscape —
  // and nobody's actual pictures end up in a public repo.
  const SPECS = [
    { w: 1200, h: 1600, sky: ['#ffd9a0', '#f4915c', '#b4453c', '#2e1a24'], sun: [0.36, 0.3, 0.1, '#fff6d8'], ridges: [['#7a2f3a', 0.62, 0.1], ['#2a1620', 0.78, 0.14]] },
    { w: 1600, h: 1200, sky: ['#cde8f6', '#6fb3d9', '#2c6e9b', '#0b2a45'], sun: [0.74, 0.22, 0.07, '#ffffff'], ridges: [['#194f73', 0.66, 0.08], ['#06192b', 0.82, 0.12]] },
    { w: 1200, h: 1200, sky: ['#ffe3d3', '#ffb3a7', '#c97b8e', '#4e3b52'], sun: [0.3, 0.26, 0.11, '#fff1e6'], ridges: [['#8f5f77', 0.68, 0.09], ['#3a2b3f', 0.84, 0.12]] },
    { w: 1200, h: 1600, sky: ['#e8efd6', '#b4c98c', '#6d8f54', '#1f2e1c'], sun: [0.66, 0.24, 0.08, '#fbffe8'], ridges: [['#466135', 0.6, 0.11], ['#1b2718', 0.79, 0.15]] },
  ]

  const draw = ({ w, h, sky, sun, ridges }) => {
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    const x = cv.getContext('2d')
    const S = Math.min(w, h)

    const g = x.createLinearGradient(0, 0, 0, h)
    sky.forEach((c, i) => g.addColorStop(i / (sky.length - 1), c))
    x.fillStyle = g
    x.fillRect(0, 0, w, h)

    // Sun: a crisp core inside a wide glow, the way a low sun blooms.
    const [sx, sy, sr, sc] = sun
    const glow = x.createRadialGradient(sx * w, sy * h, 0, sx * w, sy * h, sr * S * 3.4)
    glow.addColorStop(0, sc)
    glow.addColorStop(0.18, sc)
    glow.addColorStop(1, 'rgba(255,255,255,0)')
    x.globalAlpha = 0.9
    x.fillStyle = glow
    x.fillRect(0, 0, w, h)
    x.globalAlpha = 1

    // Ridges: a soft bezier per layer, darker and lower as they come forward.
    for (const [color, top, amp] of ridges) {
      x.filter = `blur(${Math.round(S * 0.008)}px)`
      x.fillStyle = color
      x.beginPath()
      x.moveTo(0, h)
      x.lineTo(0, top * h)
      x.bezierCurveTo(w * 0.3, (top - amp) * h, w * 0.55, (top + amp * 0.8) * h, w, (top - amp * 0.4) * h)
      x.lineTo(w, h)
      x.closePath()
      x.fill()
      x.filter = 'none'
    }

    // A little grain so the gradients do not band.
    const grain = x.createImageData(w, h)
    for (let i = 0; i < grain.data.length; i += 4) {
      const v = (Math.random() - 0.5) * 30
      grain.data[i] = grain.data[i + 1] = grain.data[i + 2] = 128 + v
      grain.data[i + 3] = 20
    }
    const tmp = document.createElement('canvas')
    tmp.width = w
    tmp.height = h
    tmp.getContext('2d').putImageData(grain, 0, 0)
    x.globalCompositeOperation = 'overlay'
    x.drawImage(tmp, 0, 0)
    x.globalCompositeOperation = 'source-over'
    return cv
  }

  while (!document.querySelector('input[type=file]')) await wait(50)
  const dt = new DataTransfer()
  for (const [i, spec] of SPECS.entries()) {
    const blob = await new Promise((r) => draw(spec).toBlob(r, 'image/jpeg', 0.92))
    dt.items.add(new File([blob], `demo${i + 1}.jpg`, { type: 'image/jpeg' }))
  }
  const input = document.querySelector('input[type=file]')
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))

  while (!document.querySelector('.surface')) await wait(50)
  await wait(400)
  const kind = Number(window.__kind ?? 0)
  document.querySelectorAll('.tab')[0].click()
  await wait(120)
  document.querySelectorAll('.kind')[kind].click()
  await wait(150)
  document.querySelectorAll('.tab')[1].click()
  await wait(400)
  return { kind, kinds: [...document.querySelectorAll('.kind')].map((e) => e.textContent) }
}
