function createDiscordActionThrottle({ intervalMs = getDefaultThrottleIntervalMs(), now = () => Date.now(), wait = sleep } = {}) {
  const nextAllowedAt = new Map()

  async function waitTurn(key) {
    const throttleKey = String(key || 'global')
    const current = now()
    prune(current)
    const allowedAt = nextAllowedAt.get(throttleKey) || current
    const delay = Math.max(0, allowedAt - current)
    nextAllowedAt.set(throttleKey, Math.max(current, allowedAt) + intervalMs)
    if (delay > 0) await wait(delay)
  }

  function clear(key = null) {
    if (key === null || key === undefined) {
      nextAllowedAt.clear()
      return
    }
    nextAllowedAt.delete(String(key || 'global'))
  }

  function size() {
    return nextAllowedAt.size
  }

  function prune(current = now()) {
    let removed = 0
    for (const [key, allowedAt] of nextAllowedAt.entries()) {
      if (allowedAt > current) continue
      nextAllowedAt.delete(key)
      removed += 1
    }
    return removed
  }

  return {
    clear,
    prune,
    size,
    waitTurn
  }
}

function getDefaultThrottleIntervalMs() {
  const configured = Number(process.env.DISCORD_ACTION_THROTTLE_MS)
  if (Number.isFinite(configured) && configured >= 0) return configured
  if (isNodeTestRunner()) return 0
  return 250
}

function isNodeTestRunner() {
  return process.env.NODE_ENV === 'test' ||
    Boolean(process.env.NODE_TEST_CONTEXT) ||
    process.env.npm_lifecycle_event === 'test' ||
    process.execArgv.includes('--test') ||
    process.argv.includes('--test') ||
    process.argv.some(value => /\.test\.[cm]?js$/i.test(String(value || '')))
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const sharedDiscordActionThrottle = createDiscordActionThrottle()

module.exports = {
  createDiscordActionThrottle,
  getDefaultThrottleIntervalMs,
  isNodeTestRunner,
  sharedDiscordActionThrottle
}
