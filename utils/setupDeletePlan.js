const {
  ChannelType
} = require('discord.js')
function createSetupDeletePlan(guild, serverConfig = {}) {
  const channels = getCachedGuildChannels(guild)
  const trackedChannelIds = new Set(toStringArray(serverConfig.setupManagedChannelIds))
  const trackedCategoryIds = new Set(toStringArray(serverConfig.setupManagedCategoryIds))
  const categories = channels.filter(channel => shouldDeleteSetupCategory(channel, trackedCategoryIds))
  const channelTargets = channels.filter(channel =>
    shouldDeleteSetupChannel(channel, trackedChannelIds)
  )

  return {
    categories,
    channels: uniqueChannels(channelTargets)
  }
}

function shouldDeleteSetupCategory(channel, trackedCategoryIds) {
  if (channel?.type !== ChannelType.GuildCategory) return false
  return trackedCategoryIds.has(String(channel.id))
}

function shouldDeleteSetupChannel(channel, trackedChannelIds) {
  if (!channel || channel.type === ChannelType.GuildCategory) return false
  return trackedChannelIds.has(String(channel.id))
}

function hasRemainingChildren(guild, category, deletedChannelIds) {
  return getCachedGuildChannels(guild).some(channel =>
    String(channel.parentId || channel.parent?.id || '') === String(category.id) &&
    !deletedChannelIds.has(String(channel.id))
  )
}

function uniqueChannels(channels) {
  const seen = new Set()
  return channels.filter(channel => {
    if (!channel?.id || seen.has(String(channel.id))) return false
    seen.add(String(channel.id))
    return true
  })
}

function toStringArray(value) {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : []
}

function getCachedGuildChannels(guild) {
  const cache = guild?.channels?.cache
  if (!cache) return []
  if (Array.isArray(cache)) return cache
  if (typeof cache.values === 'function') return [...cache.values()]
  if (typeof cache[Symbol.iterator] === 'function') return [...cache]
  return Object.values(cache)
}

module.exports = {
  createSetupDeletePlan,
  hasRemainingChildren
}
