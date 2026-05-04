// Structured logger configuration and setup
let serviceName = process.env.SERVICE_NAME || 'server'

export function setServiceName(name) {
  serviceName = name
}

function write(level, message, context) {
  const line = `[${new Date().toISOString()}] ${serviceName}.${level.toUpperCase()}: ${message}`
  const out = context && Object.keys(context).length ? `${line} ${JSON.stringify(context)}` : line
  if (level === 'error') console.error(out)
  else if (level === 'warn') console.warn(out)
  else console.log(out)
}

export const logger = {
  info: (message, context) => write('info', message, context),
  warn: (message, context) => write('warn', message, context),
  error: (message, context) => write('error', message, context),
}

export default logger
