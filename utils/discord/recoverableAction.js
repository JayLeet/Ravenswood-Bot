const {
  logBotError
} = require('../logger')

async function runRecoverableDiscordAction(action, fn, {
  context = {},
  fallback = null,
  ignoreError = null,
  ignoredFallback = fallback,
  logger = console,
  subsystem = 'Discord'
} = {}) {
  try {
    return await fn()
  } catch (err) {
    if (typeof ignoreError === 'function' && ignoreError(err)) return ignoredFallback
    logBotError(logger, subsystem, action, err, context, 'warn')
    return fallback
  }
}

module.exports = {
  runRecoverableDiscordAction
}
