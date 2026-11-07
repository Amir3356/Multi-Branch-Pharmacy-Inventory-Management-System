import { Server } from 'socket.io'
import { canListen } from '../models/channel.model.js'
import { logger, serviceClient } from '../utils/index.js'

/**
 * Live updates over Socket.IO (reached through the gateway at /socket.io):
 *   handshake       io(url, { auth: { token } }): the browser's bearer token, checked with auth-service
 *   'subscribe'     (channel, ack): joins a private channel if models/channel.model.js allows it; ack({ ok, message? })
 *   'unsubscribe'   (channel): leaves it
 *   server → browser: 'broadcast' { channel, event, data }
 */
const auth = serviceClient('auth')
let io = null

/** Starts Socket.IO on the service's HTTP server */
export function attachRealtime(server) {
  io = new Server(server, { path: '/socket.io', cors: { origin: true } })

  // Only signed-in browsers connect: the token is checked like any API request (without counting as activity)
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) return next(new Error('unauthenticated'))
    try {
      const result = await auth.post('/internal/auth/introspect', { token, touch: false }, { timeoutMs: 5_000 })
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
}

/** Sends an event to every browser on a channel; returns how many were listening */
export function broadcast(channel, event, data) {
  io?.to(channel).emit('broadcast', { channel, event, data })
  return io?.sockets.adapter.rooms.get(channel)?.size ?? 0
}
