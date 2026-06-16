import { Server } from 'socket.io'
import { canListen } from '../models/channel.model.js'
import { logger } from '../utils/index.js'
import { introspect } from './introspection.service.js'

/**
 * Live updates over Socket.IO:
 *   handshake       io(url, { auth: { token } }): the browser's bearer token
 *   'subscribe'     (channel, ack): joins a private channel if models/channel.model.js allows it; ack({ ok, message? })
 *   'unsubscribe'   (channel): leaves it
 *   server → browser: 'broadcast' { channel, event, data }
 */
let io = null

/** Starts Socket.IO on the service's HTTP server */
export function attachRealtime(server) {
  io = new Server(server, { path: '/socket.io', cors: { origin: true } })

  // Only signed-in browsers connect: check token from cookie or auth object
  io.use(async (socket, next) => {
    let token = socket.handshake.auth?.token
    if (!token && socket.handshake.headers?.cookie) {
      const match = socket.handshake.headers.cookie.match(/(?:^|;\s*)token=([^;]+)/)
      if (match) token = decodeURIComponent(match[1])
    }
    if (!token) return next(new Error('unauthenticated'))
    try {
      const result = await introspect({ token, touch: false })
      if (!result?.user) return next(new Error('unauthenticated'))
      socket.data.who = { user: result.user, tokenId: result.tokenId }
      next()
    } catch (error) {
      logger.warn('Socket sign-in check failed', { error: error.message })
      next(new Error('unavailable'))
    }
  })

  io.on('connection', (socket) => {
    socket.on('subscribe', (channel, ack) => {
      const respond = typeof ack === 'function' ? ack : () => {}
      if (!canListen(socket.data.who, channel)) return respond({ ok: false, message: 'Not allowed to listen on this channel.' })
      socket.join(channel)
      respond({ ok: true })
    })
    socket.on('unsubscribe', (channel) => socket.leave(channel))
  })
  return io
}

/** Sends an event to every browser on a channel; returns how many were listening */
export function broadcast(channel, event, data) {
  io?.to(channel).emit('broadcast', { channel, event, data })
  return io?.sockets.adapter.rooms.get(channel)?.size ?? 0
}
