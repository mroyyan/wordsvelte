// Minimal typing for the Workers TCP API used by the SMTP client (the full types live in @cloudflare/workers-types).
declare module 'cloudflare:sockets' {
  interface SocketOptions { secureTransport?: 'on' | 'off' | 'starttls'; allowHalfOpen?: boolean }
  interface Socket {
    readonly readable: ReadableStream<Uint8Array>
    readonly writable: WritableStream<Uint8Array>
    readonly opened: Promise<unknown>
    close(): Promise<void>
    startTls(options?: { expectedServerHostname?: string }): Socket
  }
  export function connect(address: { hostname: string; port: number }, options?: SocketOptions): Socket
}
