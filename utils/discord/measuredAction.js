const {
  sharedDiscordApiMetrics
} = require('./apiMetrics')
const {
  createDiscordActionSuppressedError,
  sharedInvalidRequestGuard
} = require('./invalidRequestGuard')

async function runMeasuredDiscordAction(action, target, fn, options = {}) {
  const metrics = options.metrics || sharedDiscordApiMetrics
  const guard = options.guard || sharedInvalidRequestGuard
  const skip = guard.shouldSkip(action, target)

  if (skip.skip) {
    metrics.skipped(action, { reason: skip.reason, target })
    throw createDiscordActionSuppressedError(action, target, skip.reason, skip.remainingMs)
  }

  try {
    const result = await fn()
    metrics.success(action, { target })
    guard.recordSuccess(action, target)
    return result
  } catch (err) {
    if (shouldIgnoreError(err, options)) {
      metrics.skipped(action, { reason: options.ignoredReason || 'ignored-error', target })
      return options.ignoredResult ?? null
    }

    metrics.failure(action, err, { target })
    guard.recordFailure(action, target, err)
    throw err
  }
}

function shouldIgnoreError(err, options) {
  return typeof options.ignoreError === 'function' && options.ignoreError(err)
}

module.exports = {
  runMeasuredDiscordAction
}
