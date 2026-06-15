function getChannelCacheValues(guild) {
  const channels = guild?.channels
  const cacheValues = channels?.cache?.values?.()
  if (isIterable(cacheValues)) return [...cacheValues]
  if (isIterable(channels?.cache)) return [...channels.cache]

  const byIdValues = channels?.byId?.values?.()
  if (isIterable(byIdValues)) return [...byIdValues]

  return []
}

function isIterable(value) {
  return !!value && typeof value[Symbol.iterator] === 'function'
}

function getFirstChannelPosition(channels) {
  const positions = channels
    .map(getChannelPosition)
    .filter(Number.isFinite)

  return positions.length ? Math.max(0, Math.min(...positions)) : 0
}

function getChannelPosition(channel) {
  return Number(channel?.rawPosition ?? channel?.position)
}

module.exports = {
  getChannelCacheValues,
  getChannelPosition,
  getFirstChannelPosition
}
