const {
  createBotLogger
} = require('../logger')
const {
  fetchGuildMemberWithRecoverableFallback
} = require('./recoverableFetch')

const DEFAULT_TTL_MS = 10 * 1000

function createMemberDisplayNameCache({
  logger = console,
  subsystem = 'MemberDisplayNameCache',
  ttlMs = DEFAULT_TTL_MS
} = {}) {
  const cache = new Map()
  const pendingFetches = new Map()
  const log = createBotLogger({ logger, subsystem })

  async function getDisplayName(guild, userId, fallback = null, { now = Date.now() } = {}) {
    if (!guild || !userId) return fallback
    const key = createCacheKey(guild.id, userId)
    const cached = cache.get(key)
    if (cached && cached.expiresAt > now) return cached.value

    const pending = pendingFetches.get(key)
    if (pending) return (await pending) || fallback

    let fetchPromise = null
    fetchPromise = fetchDisplayName(guild, userId, fallback)
      .then(value => {
        if (pendingFetches.get(key) === fetchPromise && value) remember(key, value, now)
        return value
      })
      .finally(() => {
        if (pendingFetches.get(key) === fetchPromise) pendingFetches.delete(key)
      })
    pendingFetches.set(key, fetchPromise)
    return (await fetchPromise) || fallback
  }

  async function fetchDisplayName(guild, userId, fallback) {
    const member = await fetchGuildMemberWithRecoverableFallback({
      action: 'fetch-member-display-name',
      guild,
      logger: log,
      userId
    })
    return member?.displayName || member?.user?.username || fallback
  }

  function remember(key, value, now = Date.now()) {
    cache.set(key, {
      expiresAt: now + Math.max(0, Number(ttlMs) || 0),
      value
    })
  }

  function prune(now = Date.now()) {
    let removed = 0
    for (const [key, entry] of cache.entries()) {
      if (entry.expiresAt > now) continue
      cache.delete(key)
      removed += 1
    }
    return removed
  }

  function clearGuild(guildId) {
    let removed = 0
    const prefix = `${guildId}:`
    for (const key of cache.keys()) {
      if (!key.startsWith(prefix)) continue
      cache.delete(key)
      removed += 1
    }
    for (const key of pendingFetches.keys()) {
      if (!key.startsWith(prefix)) continue
      pendingFetches.delete(key)
      removed += 1
    }
    return removed
  }

  return {
    clearGuild,
    getDisplayName,
    pendingSize: () => pendingFetches.size,
    prune,
    size: () => cache.size
  }
}

function createCacheKey(guildId, userId) {
  return `${guildId}:${userId}`
}

module.exports = {
  DEFAULT_TTL_MS,
  createCacheKey,
  createMemberDisplayNameCache
}
