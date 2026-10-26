// 🧩 Mollage — statisk filserver för dist/, utan npm-beroenden.
//
//   node server/serve.mjs              PORT=80, serverar ../dist
//   PORT=8080 node server/serve.mjs
//   MDNS_NAME=  node server/serve.mjs  (tomt = publicera inget Bonjour-namn)
//
// Publicerar dessutom ett eget Bonjour-namn (mollage.local) med `dns-sd -P`
// så att telefoner når appen på http://mollage.local utan portnummer.
// dns-sd behöver IP-adressen, så den bevakas och namnet publiceras om när
// adressen ändras (ny DHCP-lease, byte mellan wifi och kabel).
//
// Appen får bara användas på hemnätverket: anrop från andra adresser än
// privata/lokala (RFC 1918, loopback, link-local, IPv6 ULA) får 403 — även om
// en port av misstag skulle öppnas i routern.
import { spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { networkInterfaces } from 'node:os'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.PORT ?? 80)
const MDNS_NAME = process.env.MDNS_NAME ?? 'mollage'
const ROOT = resolve(fileURLToPath(new URL('../dist', import.meta.url)))

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
}

const log = (...a) => console.log(new Date().toISOString(), ...a)

function isLocal(addr = '') {
  const ip = addr.startsWith('::ffff:') ? addr.slice(7) : addr
  if (ip.includes(':')) {
    const v6 = ip.toLowerCase()
    return v6 === '::1' || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6)
  }
  const [a, b] = ip.split('.').map(Number)
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  )
}

async function resolveFile(urlPath) {
  let p
  try {
    p = decodeURIComponent(urlPath.split('?')[0])
  } catch {
    return null
  }
  const file = normalize(join(ROOT, p))
  if (file !== ROOT && !file.startsWith(ROOT + sep)) return null
  try {
    const s = await stat(file)
    if (s.isFile()) return { file, size: s.size }
    if (s.isDirectory()) {
      const index = join(file, 'index.html')
      const si = await stat(index)
      return { file: index, size: si.size }
    }
  } catch {
    // Faller igenom till SPA-fallback nedan.
  }
  return null
}

const server = createServer(async (req, res) => {
  if (!isLocal(req.socket.remoteAddress)) {
    log('🚫 Nekade anrop utifrån:', req.socket.remoteAddress)
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Bara på hemnätverket')
    return
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end()
    return
  }
  const url = req.url ?? '/'
  const found = (await resolveFile(url)) ?? (extname(url) ? null : await resolveFile('/index.html'))
  if (!found) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Hittades inte')
    return
  }
  // Vite-hashade filer under /assets ändras aldrig; allt annat ska revalideras
  // så att en ny deploy syns direkt.
  const immutable = found.file.startsWith(join(ROOT, 'assets') + sep)
  res.writeHead(200, {
    'Content-Type': TYPES[extname(found.file)] ?? 'application/octet-stream',
    'Content-Length': found.size,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  })
  if (req.method === 'HEAD') res.end()
  else createReadStream(found.file).pipe(res)
})

// ── Bonjour-namn ────────────────────────────────────────────────────────────

function lanAddress() {
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    if (!/^en\d+$/.test(name)) continue
    const v4 = addrs?.find((a) => a.family === 'IPv4' && !a.internal)
    if (v4) return v4.address
  }
  return null
}

let dnssd = null
let publishedIp = null

function publish() {
  const ip = lanAddress()
  if (ip === publishedIp) return
  dnssd?.kill()
  dnssd = null
  publishedIp = ip
  if (!ip) {
    log('⚠️  Ingen nätverksadress — publicerar inte', `${MDNS_NAME}.local`)
    return
  }
  // -P registrerar både tjänsten och ett A-record för <namn>.local → ip.
  const child = spawn('dns-sd', ['-P', 'Mollage', '_http._tcp', 'local', String(PORT), `${MDNS_NAME}.local`, ip], {
    stdio: 'ignore',
  })
  // Dog den av sig själv: glöm den, så nästa publish() startar en ny.
  child.on('exit', (code, signal) => {
    if (child !== dnssd) return
    log(`⚠️  dns-sd avslutades (${code ?? signal}) — försöker igen om en stund`)
    dnssd = null
    publishedIp = null
  })
  dnssd = child
  log(`📡 Publicerar http://${MDNS_NAME}.local → ${ip}`)
}

function shutdown() {
  dnssd?.kill()
  server.close()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

server.listen(PORT, () => {
  log(`🧩 Mollage serverar ${ROOT} på port ${PORT}`)
  if (MDNS_NAME) {
    publish()
    setInterval(publish, 30_000)
  }
})
