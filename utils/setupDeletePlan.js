const {
  ChannelType
} = require('discord.js')
function createSetupDeletePlan(guild, serverConfig = {}, options = {}) {
  const channelsSource = getGuildChannels(guild, options.channels)
  const trackedChannelIds = uniqueIds(toStringArray(serverConfig.setupManagedChannelIds))
  const trackedCategoryIds = uniqueIds(toStringArray(serverConfig.setupManagedCategoryIds))
  const channels = trackedChannelIds
    .map(channelId => getGuildChannelById(channelsSource, channelId))
    .filter(shouldDeleteSetupChannel)
  const categories = trackedCategoryIds
    .map(channelId => getGuildChannelById(channelsSource, channelId))
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

function hasRemainingChildren(guild, category, deletedChannelIds, channels = null) {
  return getGuildChannels(guild, channels).some(channel =>
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

function getGuildChannelById(channels, channelId) {
  const id = String(channelId || '')
  if (!id) return null
  if (typeof channels?.get === 'function') return channels.get(id) || null
  return getGuildChannels(null, channels).find(channel => String(channel?.id) === id) || null
}

function getGuildChannels(guild, channels = null) {
  const source = channels || guild?.channels?.cache
  if (!source) return []
  if (Array.isArray(source)) return source
  if (typeof source.values === 'function') return [...source.values()]
  if (typeof source[Symbol.iterator] === 'function') return [...source]
  return Object.values(source)
}

module.exports = {
  createSetupDeletePlan,
  hasRemainingChildren
}
