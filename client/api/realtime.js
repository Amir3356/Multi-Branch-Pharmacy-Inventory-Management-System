import { io } from 'socket.io-client'
import { API_URL, getAuthToken } from '../utils/http'

// One Socket.IO connection to the API gateway (/socket.io → notification-service), opened the first time a page
// needs live updates. The signed-in user's token goes with the handshake; each private channel is then authorized by
// the server when subscribed.
//
// The object realtime() returns keeps the small part of the Laravel Echo API the app uses, so pages are unchanged:
//   realtime().private('branch.BR-01.sales').listen('.sale.recorded', handler)
//   realtime().private(name).stopListening('.sale.recorded', handler)
//   realtime().leave(name)

// The gateway's origin: VITE_REALTIME_URL, or the API URL without its /api path
const REALTIME_URL = (import.meta.env.VITE_REALTIME_URL || API_URL.replace(/\/api$/, '')).replace(/\/$/, '')

let socket = null
let socketToken = null
let client = null
// channel name → Map(event name → Set of handlers); subscriptions survive reconnects
const channels = new Map()

// Echo's leading dot meant "no namespace": '.sale.recorded' and 'sale.recorded' are the same event here
const eventName = (event) => (event.startsWith('.') ? event.slice(1) : event)

function subscribe(name) {
  if (socket?.connected) socket.emit('subscribe', name, () => {})
}

function connect(token) {
  socketToken = token
  socket = io(REALTIME_URL, {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionDelayMax: 10_000,
  })
  // Rooms are per connection: join every channel again after each (re)connect
  socket.on('connect', () => channels.forEach((_, name) => subscribe(name)))
  socket.on('broadcast', ({ channel, event, data }) => {
    channels
      .get(channel)
      ?.get(event)
      ?.forEach((handler) => handler(data ?? {}))
  })
}

// The channel's listeners, subscribing on first use (again after a leave)
function joined(name) {
  if (!channels.has(name)) {
    channels.set(name, new Map())
    subscribe(name)
  }
  return channels.get(name)
}

function channel(name) {
  joined(name)
  const api = {
    listen(event, handler) {
      const events = joined(name)
      const key = eventName(event)
      if (!events.has(key)) events.set(key, new Set())
      events.get(key).add(handler)
      return api
    },
    stopListening(event, handler) {
      const handlers = channels.get(name)?.get(eventName(event))
      if (handler) handlers?.delete(handler)
      else handlers?.clear()
      return api
    },
  }
  return api
}

function leave(name) {
  if (!channels.delete(name)) return
  if (socket?.connected) socket.emit('unsubscribe', name)
}

export function realtime() {
  const token = getAuthToken()
  if (!token) {
    // Signed out: close the connection that belonged to the old session
    socket?.disconnect()
    socket = null
    return null
  }

  // Signed in as someone else (or again) since the socket opened: reconnect with the new token
  if (socket && socketToken !== token) {
    socket.disconnect()
    socket = null
  }
  if (!socket) connect(token)

  client ??= { private: channel, leave, socket: () => socket }
  return client
}

// Calls onChange(connected) whenever the connection opens or drops; returns an unsubscribe function
export function watchConnection(onChange) {
  const current = realtime() && socket
  if (!current) {
    onChange(false)
    return () => {}
  }
  const up = () => onChange(true)
  const down = () => onChange(false)
  current.on('connect', up)
  current.on('disconnect', down)
  current.on('connect_error', down)
  onChange(current.connected)
  return () => {
    current.off('connect', up)
    current.off('disconnect', down)
    current.off('connect_error', down)
  }
}
