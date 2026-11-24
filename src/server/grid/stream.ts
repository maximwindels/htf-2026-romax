/**
 * Server-Sent Events: one long-lived HTTP connection per browser tab.
 * Every event the ingest pipeline publishes on the bus is forwarded to the browser as-is.
 */
import { bus } from './bus'

/** The bus events that are forwarded to browsers. */
const FORWARDED_EVENTS = ['tick', 'anomaly', 'ack', 'warning', 'warning-confirmed', 'glitch', 'mode', 'cleared'] as const
const PING_EVERY_MS = 15_000

export function liveStream(request: Request): Response {
  const encoder = new TextEncoder()
  let cleanup = () => {}

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: string) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`))
        } catch {
          cleanup() // the stream is already closed
        }
      }

      // One listener per event type; removed again when the browser disconnects.
      const removers = FORWARDED_EVENTS.map((event) => {
        const listener = (data: unknown) => send(event, JSON.stringify(data))
        bus.on(event, listener)
        return () => bus.off(event, listener)
      })
      // A ping now and then stops proxies from closing an idle connection.
      const ping = setInterval(() => send('ping', String(Date.now())), PING_EVERY_MS)

      cleanup = () => {
        clearInterval(ping)
        removers.forEach((remove) => remove())
      }
      request.signal.addEventListener('abort', () => {
        cleanup()
        try {
          controller.close()
        } catch {
          // already closed
        }
      })
      send('ping', String(Date.now())) // flush the headers right away
    },
    cancel() {
      cleanup()
    },
  })

  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
