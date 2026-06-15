function createSingleFlight({ ttlMs = 4000 } = {}) {
  const active = new Map()

  async function run(key, fn) {
    const flightKey = String(key || 'global')
    const now = Date.now()
    pruneExpired(now)
    if (active.has(flightKey)) return { skipped: true }

    const entry = { expiresAt: now + ttlMs }
    active.set(flightKey, entry)
    try {
      return { skipped: false, value: await fn() }
    } finally {
      if (active.get(flightKey) === entry) active.delete(flightKey)
    }
  }

  function has(key) {
    pruneExpired(Date.now())
    return active.has(String(key || 'global'))
  }

  function pruneExpired(now) {
    let removed = 0
    for (const [key, entry] of active.entries()) {
      if (entry.expiresAt > now) continue
      active.delete(key)
      removed += 1
    }
    return removed
  }

  function size() {
    return active.size
  }

  function getRuntimeState({ now = Date.now() } = {}) {
    return {
      removed: pruneExpired(now),
      size: active.size
    }
  }

  return {
    getRuntimeState,
    has,
    pruneExpired,
    size,
    run
  }
}

module.exports = {
  createSingleFlight
}
