const {
  ChannelType
} = require('discord.js')
const {
  shouldFallbackDeleteCategory,
  shouldFallbackDeleteChannel
} = require('./setupCleanupFallback')
const {
  getCacheValues
} = require('./discord/cacheValues')

function createSetupDeletePlan(guild, serverConfig = {}, options = {}) {
  const channelsSource = getGuildChannels(guild, options.channels)
  const trackedChannelIds = uniqueIds(toStringArray(serverConfig.setupBotCreatedChannelIds))
  const trackedCategoryIds = uniqueIds(toStringArray(serverConfig.setupBotCreatedCategoryIds))
  const channels = trackedChannelIds
    .map(channelId => getGuildChannelById(channelsSource, channelId))
    .filter(shouldDeleteSetupChannel)
  const categories = trackedCategoryIds
    .map(channelId => getGuildChannelById(channelsSource, channelId))
    .filter(shouldDeleteSetupCategory)
  addFallbackSetupItems(channels, categories, channelsSource, serverConfig, options)

  return {
    categories,
    channels
  }
}

function addFallbackSetupItems(channels, categories, channelsSource, serverConfig, options = {}) {
  const fallbackBotCreatedIds = normalizeIdSet(options.fallbackBotCreatedIds)
  const categoryIds = new Set(categories.map(category => String(category.id)))
  const channelIds = new Set(channels.map(channel => String(channel.id)))

  for (const category of channelsSource.filter(channel => channel?.type === ChannelType.GuildCategory)) {
    if (!shouldFallbackDeleteCategory(category, serverConfig)) continue
    if (!fallbackBotCreatedIds.has(String(category.id))) continue
    if (!categoryIds.has(String(category.id))) {
      categories.push(category)
      categoryIds.add(String(category.id))
    }
  }

  for (const channel of channelsSource.filter(shouldDeleteSetupChannel)) {
    const parent = getGuildChannelById(channelsSource, channel.parentId || channel.parent?.id)
    if (!shouldFallbackDeleteChannel(channel, parent, serverConfig)) continue
    if (!fallbackBotCreatedIds.has(String(channel.id))) continue
    if (!channelIds.has(String(channel.id))) {
      channels.push(channel)
      channelIds.add(String(channel.id))
    }
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

function normalizeIdSet(ids) {
  if (!ids) return new Set()
  if (ids instanceof Set) return new Set([...ids].filter(Boolean).map(String))
  if (Array.isArray(ids)) return new Set(ids.filter(Boolean).map(String))
  return new Set()
}

function getGuildChannelById(channels, channelId) {
  const id = String(channelId || '')
  if (!id) return null
  if (typeof channels?.get === 'function') return channels.get(id) || null
  return getGuildChannels(null, channels).find(channel => String(channel?.id) === id) || null
}

function getGuildChannels(guild, channels = null) {
  return getCacheValues(channels || guild?.channels?.cache)
}

module.exports = {
  createSetupDeletePlan,
  hasRemainingChildren
}
