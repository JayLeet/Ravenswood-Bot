const {
  ChannelType
} = require('discord.js')
function createSetupDeletePlan(guild, serverConfig = {}) {
  const trackedChannelIds = uniqueIds(toStringArray(serverConfig.setupManagedChannelIds))
  const trackedCategoryIds = uniqueIds(toStringArray(serverConfig.setupManagedCategoryIds))
  const channels = trackedChannelIds
    .map(channelId => getCachedGuildChannel(guild, channelId))
    .filter(shouldDeleteSetupChannel)
  const categories = trackedCategoryIds
    .map(channelId => getCachedGuildChannel(guild, channelId))
    .filter(shouldDeleteSetupCategory)

  return {
    categories,
    channels
  }
}

function shouldDeleteSetupCategory(channel) {
  if (channel?.type !== ChannelType.GuildCategory) return false
  return true
}

function shouldDeleteSetupChannel(channel) {
  if (!channel || channel.type === ChannelType.GuildCategory) return false
  return true
}

function hasRemainingChildren(guild, category, deletedChannelIds) {
  return getCachedGuildChannels(guild).some(channel =>
    String(channel.parentId || channel.parent?.id || '') === String(category.id) &&
    !deletedChannelIds.has(String(channel.id))
  )
}

function toStringArray(value) {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : []
}

function uniqueIds(ids) {
  return [...new Set(ids.filter(Boolean).map(String))]
}

function getCachedGuildChannel(guild, channelId) {
  const cache = guild?.channels?.cache
  const id = String(channelId || '')
  if (!cache || !id) return null
  if (typeof cache.get === 'function') return cache.get(id) || null
  return getCachedGuildChannels(guild).find(channel => String(channel?.id) === id) || null
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
