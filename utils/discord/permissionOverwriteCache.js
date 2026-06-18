const {
  findCacheValue
} = require('./cacheValues')

function getCachedPermissionOverwrite(channel, overwriteId) {
  const cache = channel?.permissionOverwrites?.cache
  if (typeof cache?.get === 'function') return cache.get(overwriteId) || null
  return findCacheValue(cache, overwrite => overwrite?.id === overwriteId)
}

module.exports = {
  getCachedPermissionOverwrite
}
