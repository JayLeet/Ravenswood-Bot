const {
  getDefaultLogger
} = require('../logger')

function createDiscordApiMetrics({ logger = getDefaultLogger() } = {}) {
  const counts = new Map()

  function record(action, status, details = {}) {
    const key = createMetricKey(action, status, classifyDiscordError(details.error))
    counts.set(key, (counts.get(key) || 0) + 1)

    if (status === 'failure') logFailure(logger, action, details)
    return key
  }

  function success(action, details = {}) {
    return record(action, 'success', details)
  }

  function failure(action, error, details = {}) {
    return record(action, 'failure', { ...details, error })
  }

  function skipped(action, details = {}) {
    return record(action, 'skipped', details)
  }

  function snapshot() {
    return Object.fromEntries([...counts.entries()].sort())
  }

  function reset() {
    counts.clear()
  }

  return {
    failure,
    record,
    reset,
    skipped,
    snapshot,
    success
  }
}

function createMetricKey(action, status, errorType = null) {
  return [action || 'unknown-action', status || 'unknown-status', errorType].filter(Boolean).join(':')
}

function classifyDiscordError(error) {
  const code = error?.code ?? error?.rawError?.code ?? error?.status ?? error?.statusCode
  if (code === 401) return 'unauthorized-401'
  if (code === 429) return 'rate-limit-429'
  if (code === 403 || code === 50013) return 'forbidden-403'
  if (code === 10008 || code === 404) return 'stale-message-404'
  if (code === 10015) return 'stale-webhook-404'
  if (code === 50027) return 'invalid-webhook-token'
  if (code === 'BOTC_DISCORD_ACTION_SUPPRESSED') return 'botc-action-suppressed'
  if (code === 50035) return 'invalid-form-body-50035'
  return code ? `discord-${code}` : null
}

function startDiscordApiMetricsReporter({
  intervalMs,
  logger = console,
  metrics = sharedDiscordApiMetrics,
  setIntervalFn = setInterval
} = {}) {
  const delay = Number(intervalMs)
  if (!Number.isFinite(delay) || delay <= 0) return null

  const timer = setIntervalFn(() => {
    logSnapshot(logger, metrics.snapshot())
  }, delay)
  timer?.unref?.()
  return timer
}

function logSnapshot(logger, snapshot) {
  if (!snapshot || !Object.keys(snapshot).length) return false
  if (typeof logger?.info !== 'function') return false
  logger.info(`[BOTC][DiscordAPI] metrics ${JSON.stringify(snapshot)}`)
  return true
}

function logFailure(logger, action, details = {}) {
  if (typeof logger?.warn !== 'function') return
  const errorType = classifyDiscordError(details.error) || 'unknown-error'
  const target = details.target ? ` target=${details.target}` : ''
  const errorDetails = formatDiscordFailureDetails(details.error)
  const diagnostic = errorDetails ? ` details=${errorDetails}` : ''
  logger.warn(`[BOTC][DiscordAPI] ${action} failed (${errorType}).${target}${diagnostic}`)
}

function formatDiscordFailureDetails(error) {
  const validation = formatDiscordValidationErrors(error?.rawError?.errors || error?.errors)
  const message = cleanDiscordErrorMessage(error?.rawError?.message || error?.message)
  const details = [validation, message]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(' | ')

  return truncateLogDetail(details)
}

function formatDiscordValidationErrors(errors) {
  const results = []
  collectDiscordValidationErrors(errors, [], results)
  return results.join('; ')
}

function collectDiscordValidationErrors(node, path, results) {
  if (!node || typeof node !== 'object') return

  if (Array.isArray(node._errors)) {
    for (const error of node._errors) {
      const message = cleanDiscordErrorMessage(error?.message || error?.code)
      if (!message) continue
      results.push(`${formatDiscordErrorPath(path)}: ${message}`)
    }
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === '_errors') continue
    collectDiscordValidationErrors(value, [...path, key], results)
  }
}

function formatDiscordErrorPath(path) {
  if (!path.length) return 'payload'
  return path.reduce((label, part) => {
    if (/^\d+$/.test(part)) return `${label}[${part}]`
    return label ? `${label}.${part}` : part
  }, '')
}

function cleanDiscordErrorMessage(message) {
  return String(message || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncateLogDetail(value, limit = 500) {
  if (!value) return ''
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value
}

const sharedDiscordApiMetrics = createDiscordApiMetrics()

module.exports = {
  classifyDiscordError,
  createDiscordApiMetrics,
  formatDiscordFailureDetails,
  formatDiscordValidationErrors,
  logSnapshot,
  sharedDiscordApiMetrics,
  startDiscordApiMetricsReporter
}
