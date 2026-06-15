const INVALID_REQUEST_WINDOW_MS = 10 * 60 * 1000
const DISCORD_INVALID_REQUEST_LIMIT = 10000
const DEFAULT_GLOBAL_WARN_AT = 8000
const DEFAULT_GLOBAL_SUPPRESS_AT = 9500
const DEFAULT_GLOBAL_COOLDOWN_MS = 60 * 1000
const DEFAULT_TARGET_FAILURE_THRESHOLD = 3
const DEFAULT_TARGET_COOLDOWN_MS = 5 * 60 * 1000

function createInvalidRequestGuard(options = {}) {
  const config = createConfig(options)
  const invalidTimestamps = []
  const failuresByKey = new Map()
  const cooldownsByKey = new Map()
  let globalCooldownUntil = 0
  let lastGlobalWarningAt = 0

  function shouldSkip(action, target, now = config.now()) {
    prune(now)

    if (globalCooldownUntil > now) {
      return createSkip('global-invalid-request-cooldown', globalCooldownUntil - now)
    }

    const cooldownUntil = cooldownsByKey.get(createKey(action, target)) || 0
    if (cooldownUntil > now) {
      return createSkip('target-invalid-request-cooldown', cooldownUntil - now)
    }

    return { skip: false }
  }

  function recordFailure(action, target, err, now = config.now()) {
    if (!isDiscordInvalidRequestError(err)) return { counted: false }
    prune(now)

    invalidTimestamps.push(now)
    const key = createKey(action, target)
    const failures = failuresByKey.get(key) || []
    failures.push(now)
    failuresByKey.set(key, failures)

    maybeWarnGlobal(now)
    maybeCooldownGlobal(now)
    maybeCooldownTarget(key, failures, now, action, target)

    return {
      counted: true,
      globalCount: invalidTimestamps.length,
      targetCount: failures.length
    }
  }

  function recordSuccess(action, target) {
    const key = createKey(action, target)
    failuresByKey.delete(key)
    cooldownsByKey.delete(key)
  }

  function snapshot(now = config.now()) {
    prune(now)
    return {
      globalCooldownMs: Math.max(0, globalCooldownUntil - now),
      invalidRequestCount: invalidTimestamps.length,
      targetCooldowns: cooldownsByKey.size,
      trackedTargets: failuresByKey.size
    }
  }

  function reset() {
    invalidTimestamps.length = 0
    failuresByKey.clear()
    cooldownsByKey.clear()
    globalCooldownUntil = 0
    lastGlobalWarningAt = 0
  }

  function prune(now) {
    pruneTimestamps(invalidTimestamps, now, config.windowMs)
    for (const [key, values] of failuresByKey.entries()) {
      pruneTimestamps(values, now, config.windowMs)
      if (!values.length) failuresByKey.delete(key)
    }
    for (const [key, until] of cooldownsByKey.entries()) {
      if (until <= now) cooldownsByKey.delete(key)
    }
    if (globalCooldownUntil <= now) globalCooldownUntil = 0
  }

  function maybeWarnGlobal(now) {
    if (invalidTimestamps.length < config.globalWarnAt) return
    if (lastGlobalWarningAt && now - lastGlobalWarningAt < config.windowMs) return
    lastGlobalWarningAt = now
    config.logger.warn?.(
      `[BOTC][DiscordAPI] invalid request count is ${invalidTimestamps.length}/${config.limit} in the current 10-minute window.`
    )
  }

  function maybeCooldownGlobal(now) {
    if (invalidTimestamps.length < config.globalSuppressAt) return
    if (globalCooldownUntil > now) return
    globalCooldownUntil = now + config.globalCooldownMs
    config.logger.warn?.('[BOTC][DiscordAPI] pausing Discord writes briefly to avoid Discord invalid-request restriction.')
  }

  function maybeCooldownTarget(key, failures, now, action, target) {
    if (failures.length < config.targetFailureThreshold) return
    const until = now + config.targetCooldownMs
    cooldownsByKey.set(key, until)
    config.logger.warn?.(
      `[BOTC][DiscordAPI] cooling down ${action} target=${target} after repeated invalid requests.`
    )
  }

  return {
    recordFailure,
    recordSuccess,
    reset,
    shouldSkip,
    snapshot
  }
}

function createConfig(options) {
  return {
    globalCooldownMs: options.globalCooldownMs ?? DEFAULT_GLOBAL_COOLDOWN_MS,
    globalSuppressAt: options.globalSuppressAt ?? DEFAULT_GLOBAL_SUPPRESS_AT,
    globalWarnAt: options.globalWarnAt ?? DEFAULT_GLOBAL_WARN_AT,
    limit: options.limit ?? DISCORD_INVALID_REQUEST_LIMIT,
    logger: options.logger || console,
    now: options.now || Date.now,
    targetCooldownMs: options.targetCooldownMs ?? DEFAULT_TARGET_COOLDOWN_MS,
    targetFailureThreshold: options.targetFailureThreshold ?? DEFAULT_TARGET_FAILURE_THRESHOLD,
    windowMs: options.windowMs ?? INVALID_REQUEST_WINDOW_MS
  }
}

function createSkip(reason, remainingMs) {
  return {
    reason,
    remainingMs: Math.max(0, remainingMs),
    skip: true
  }
}

function createDiscordActionSuppressedError(action, target, reason, remainingMs = 0) {
  const err = new Error(`Discord action suppressed: ${reason}`)
  err.action = action
  err.code = 'BOTC_DISCORD_ACTION_SUPPRESSED'
  err.remainingMs = remainingMs
  err.target = target
  return err
}

function isDiscordInvalidRequestError(err) {
  const code = err?.code ?? err?.rawError?.code
  const status = err?.status ?? err?.statusCode ?? err?.rawError?.status
  return status === 401 ||
    status === 403 ||
    status === 429 ||
    code === 401 ||
    code === 403 ||
    code === 429 ||
    code === 50013
}

function createKey(action, target) {
  return `${action || 'unknown-action'}:${target || 'unknown-target'}`
}

function pruneTimestamps(values, now, windowMs) {
  while (values.length && now - values[0] > windowMs) values.shift()
}

const sharedInvalidRequestGuard = createInvalidRequestGuard()

module.exports = {
  DEFAULT_GLOBAL_COOLDOWN_MS,
  DEFAULT_TARGET_COOLDOWN_MS,
  DISCORD_INVALID_REQUEST_LIMIT,
  INVALID_REQUEST_WINDOW_MS,
  createDiscordActionSuppressedError,
  createInvalidRequestGuard,
  isDiscordInvalidRequestError,
  sharedInvalidRequestGuard
}
