import { connect } from 'cloudflare:sockets'
import type { Connector, Transport } from './client'

/** Cloudflare Workers TCP sockets (outbound port 25 is blocked by Cloudflare; 465 and 587 work). */
export const workersConnector: Connector = async ({ host, port, encryption, timeoutMs }) => {
  let socket = connect({ hostname: host, port }, { secureTransport: encryption === 'tls' ? 'on' : encryption === 'starttls' ? 'starttls' : 'off', allowHalfOpen: false })
  await Promise.race([
    socket.opened,
    new Promise((_, reject) => setTimeout(() => reject(new Error('connection timed out')), timeoutMs)),
  ])

  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let reader = socket.readable.getReader()
  let writer = socket.writable.getWriter()
  let buffer = ''
  let ended = false

  const pull = async (): Promise<boolean> => {
    if (ended) return false
    const { value, done } = await reader.read()
    if (done) { ended = true; return false }
    buffer += decoder.decode(value, { stream: true })
    return true
  }

  const transport: Transport = {
    async readLine() {
      for (;;) {
        const idx = buffer.indexOf('\r\n')
        if (idx >= 0) { const line = buffer.slice(0, idx); buffer = buffer.slice(idx + 2); return line }
        if (!(await pull())) return null
      }
    },
    write: data => writer.write(encoder.encode(data)),
    async startTls() {
      reader.releaseLock()
      writer.releaseLock()
      socket = socket.startTls({ expectedServerHostname: host })
      reader = socket.readable.getReader()
      writer = socket.writable.getWriter()
      buffer = ''
    },
    async close() {
      try { await writer.close() } catch { /* already closed */ }
      try { await socket.close() } catch { /* already closed */ }
    },
  }
  return transport
}
