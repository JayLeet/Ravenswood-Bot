function getCacheValues(cache) {
  if (!cache) return []
  if (Array.isArray(cache)) return cache
  if (typeof cache.values === 'function') return [...cache.values()]
  if (typeof cache[Symbol.iterator] === 'function' && typeof cache !== 'string') return [...cache]
  if (typeof cache === 'object') return Object.values(cache)
  return []
}

function findCacheValue(cache, predicate) {
  if (!cache || typeof predicate !== 'function') return null
  if (typeof cache.find === 'function') return cache.find(predicate) || null
  return getCacheValues(cache).find(predicate) || null
}

function getCachedGuildChannels(guild) {
  return getCacheValues(guild?.channels?.cache)
}

function getCachedGuildRoles(guild) {
  return getCacheValues(guild?.roles?.cache)
}

module.exports = {
  findCacheValue,
  getCachedGuildChannels,
  getCachedGuildRoles,
  getCacheValues
}
