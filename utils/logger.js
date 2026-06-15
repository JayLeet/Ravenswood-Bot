const DEFAULT_SUBSYSTEM = 'Runtime'
const {
  routeStartupLog,
  writeLog: writeRawLog
} = require('./startupOutput')
const SILENT_LOGGER = Object.freeze({
  error: () => {},
  info: () => {},
  log: () => {},
  warn: () => {}
})

function createBotLogger({ logger = getDefaultLogger(), subsystem = DEFAULT_SUBSYSTEM, defaults = {} } = {}) {
  return {
    info: (action, message, context = {}) => logBotEvent(logger, 'info', subsystem, action, message, { ...defaults, ...context }),
    warn: (action, message, context = {}) => logBotEvent(logger, 'warn', subsystem, action, message, { ...defaults, ...context }),
    error: (action, error, context = {}) => logBotError(logger, subsystem, action, error, { ...defaults, ...context }),
    recoverable: (action, error, context = {}) => logBotError(logger, subsystem, action, error, { ...defaults, ...context }, 'warn')
  }
}

function logBotEvent(logger = getDefaultLogger(), level = 'info', subsystem = DEFAULT_SUBSYSTEM, action = 'event', message = '', context = {}) {
  const line = formatBotLogLine({ subsystem, action, message, context })
  writeLog(logger, level, line)
  return line
}

function logBotError(logger = getDefaultLogger(), subsystem = DEFAULT_SUBSYSTEM, action = 'error', error = null, context = {}, level = 'error') {
  const message = formatError(error)
  const line = formatBotLogLine({ subsystem, action, message, context })
  writeLog(logger, level, line)
  return line
}

function formatBotLogLine({ subsystem = DEFAULT_SUBSYSTEM, action = 'event', message = '', context = {} } = {}) {
  const parts = [`[BOTC][${sanitizeLabel(subsystem)}]`, sanitizeLabel(action)]
  const details = formatContext(context)
  const text = String(message || '').trim()
  return `${parts.join(' ')}${text ? `: ${text}` : ''}${details ? ` ${details}` : ''}`
}

function formatContext(context = {}) {
  const entries = Object.entries(context)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${sanitizeLabel(key)}=${formatContextValue(value)}`)
  return entries.length ? `[${entries.join(' ')}]` : ''
}

function formatContextValue(value) {
  if (typeof value === 'string') return sanitizeContextValue(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return sanitizeContextValue(value.join(','))
  try {
    return sanitizeContextValue(JSON.stringify(value))
  } catch (err) {
    return sanitizeContextValue(String(value))
  }
}

function formatError(error) {
  if (!error) return 'unknown error'
  const code = error.code ?? error.status ?? error.statusCode ?? error.rawError?.code
  const message = error.message || error.rawError?.message || String(error)
  return code ? `${message} (code=${code})` : message
}

function sanitizeLabel(value) {
  return String(value || 'unknown')
    .replace(/[^a-zA-Z0-9_.:-]/g, '-')
    .replace(/-+/g, '-')
}

function sanitizeContextValue(value) {
  return String(value || '')
    .replace(/\s+/g, '_')
    .slice(0, 180)
}

function writeLog(logger, level, line) {
  if (routeStartupLog(logger, level, line)) return
  writeRawLog(logger, level, line)
}

function getDefaultLogger() {
  return shouldSilenceDefaultLogs() ? SILENT_LOGGER : console
}

function shouldSilenceDefaultLogs() {
  return Boolean(process.env.NODE_TEST_CONTEXT)
}

module.exports = {
  createBotLogger,
  formatBotLogLine,
  getDefaultLogger,
  logBotError,
  logBotEvent,
  shouldSilenceDefaultLogs
}
