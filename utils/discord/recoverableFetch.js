async function fetchWithRecoverableFallback({
  action,
  context = {},
  fetch,
  logger
}) {
  try {
    return await fetch() || null
  } catch (err) {
    logger?.recoverable?.(action, err, context)
    return null
  }
}

const pendingGuildMemberFetches = new Map()

function fetchGuildMemberWithRecoverableFallback({ action, context = {}, guild, logger, userId }) {
  const cached = getCachedGuildMember(guild, userId)
  if (cached) return Promise.resolve(cached)

  const key = createGuildMemberFetchKey(guild, userId)
  const pending = key ? pendingGuildMemberFetches.get(key) : null
  if (pending) return pending

  const fetchPromise = fetchWithRecoverableFallback({
    action,
    context: {
      ...context,
      guildId: guild?.id,
      userId
    },
    fetch: () => guild.members.fetch(userId),
    logger
  }).finally(() => {
    if (key && pendingGuildMemberFetches.get(key) === fetchPromise) {
      pendingGuildMemberFetches.delete(key)
    }
  })
  if (key) pendingGuildMemberFetches.set(key, fetchPromise)
  return fetchPromise
}

function getCachedGuildMember(guild, userId) {
  const cache = guild?.members?.cache
  if (!cache || !userId) return null
  if (typeof cache.get === 'function') return cache.get(userId) || null
  return cache[userId] || null
}

function createGuildMemberFetchKey(guild, userId) {
  if (!guild?.id || !userId) return null
  return `${guild.id}:${userId}`
}

function getRecoverableFetchRuntimeState() {
  return {
    pendingGuildMemberFetches: pendingGuildMemberFetches.size
  }
}

module.exports = {
  fetchGuildMemberWithRecoverableFallback,
  fetchWithRecoverableFallback,
  getRecoverableFetchRuntimeState,
  getCachedGuildMember
}
