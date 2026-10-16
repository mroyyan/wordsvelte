// Node-only (local development and the test suite). Never part of the Cloudflare bundle: see ./index.ts.
import net from 'node:net'
import tls from 'node:tls'
import type { Connector, Transport } from './client'

class LineReader {
  private buffer = ''
  private waiters: ((line: string | null) => void)[] = []
  private ended = false

  push(chunk: string) {
    this.buffer += chunk
    this.flush()
  }
  end() { this.ended = true; this.flush() }

  private flush() {
    for (;;) {
      const w = this.waiters[0]
      if (!w) return
      const idx = this.buffer.indexOf('\r\n')
      if (idx >= 0) { this.waiters.shift(); const line = this.buffer.slice(0, idx); this.buffer = this.buffer.slice(idx + 2); w(line); continue }
      if (this.ended) { this.waiters.shift(); w(null); continue }
      return
    }
  }
  readLine() { return new Promise<string | null>(resolve => { this.waiters.push(resolve); this.flush() }) }
}

export function nodeConnector(opts: { rejectUnauthorized?: boolean } = {}): Connector {
  const rejectUnauthorized = opts.rejectUnauthorized ?? true

  return ({ host, port, encryption, timeoutMs }) => new Promise<Transport>((resolve, reject) => {
    let socket: net.Socket | tls.TLSSocket
    let reader = new LineReader()

    const attach = (s: net.Socket) => {
      reader = new LineReader()
      s.setEncoding('utf8')
      s.on('data', (d: string) => reader.push(d))
      s.on('end', () => reader.end())
      s.on('close', () => reader.end())
      s.on('error', () => reader.end())
    }

    const transport: Transport = {
      readLine: () => reader.readLine(),
      write: data => new Promise((res, rej) => socket.write(data, 'utf8', err => (err ? rej(err) : res()))),
      startTls: () => new Promise((res, rej) => {
        const upgraded = tls.connect({ socket, servername: host, rejectUnauthorized }, () => res())
        upgraded.once('error', rej)
        socket = upgraded
        attach(upgraded)
      }),
      close: () => new Promise(res => { socket.once('close', () => res()); socket.destroy(); setTimeout(res, 50) }),
    }

    // The connect timeout is only for establishing the connection; the client enforces per-step timeouts itself.
    const ready = () => { socket.setTimeout(0); attach(socket); resolve(transport) }
    const fail = (err: Error) => reject(err)

    if (encryption === 'tls') {
      socket = tls.connect({ host, port, servername: host, rejectUnauthorized }, ready)
    } else {
      socket = net.connect({ host, port }, ready)
    }
    socket.setTimeout(timeoutMs, () => socket.destroy(new Error('connection timed out')))
    socket.once('error', fail)
  })
}
