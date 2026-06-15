const { ChannelType } = require('discord.js')
const {
  RESERVED_NIGHT_AREA_CATEGORY_NAME
} = require('../systems/discord/interactions/nightArea/reservedChannels')
const {
  AUTO_SETUP_CATEGORY_NAME,
  BOT_UPDATE_CHANNEL_NAME
} = require('./botcChannelNames')
const {
  queuedChannelDelete
} = require('./discord/channelActions')
const {
  setChannelParentIfChanged
} = require('./discord/channelState')
const {
  logSetupRecoverable
} = require('./setupLogging')

async function resetAutoSetupCategories(guild, options = {}) {
  const preserveChannelIds = new Set((options.preserveChannelIds || []).filter(Boolean).map(String))
  const preservedChannelIds = new Set()
  const refreshedBeforeReset = await refreshGuildChannels(guild, 'fetch-auto-setup-channels-before-reset')
  if (!refreshedBeforeReset) {
    return { ok: false, message: 'I could not refresh Discord channel state before setup reset. Try `/setup` again in a moment.' }
  }

  for (const categoryName of [AUTO_SETUP_CATEGORY_NAME, RESERVED_NIGHT_AREA_CATEGORY_NAME]) {
    for (const category of findCategoriesByName(guild, categoryName)) {
      const deleted = await deleteCategoryAndChildren(guild, category, { preserveChannelIds, preservedChannelIds })
      if (!deleted) {
        return { ok: false, message: `I could not reset the ${categoryName} category. Check my Manage Channels permission and role position.` }
      }
    }
  }

  const refreshedAfterReset = await refreshGuildChannels(guild, 'fetch-auto-setup-channels-after-reset')
  if (!refreshedAfterReset) {
    return { ok: false, message: 'I could not refresh Discord channel state after setup reset. Try `/setup` again in a moment.' }
  }
  return { ok: true, preservedChannelIds: [...preservedChannelIds] }
}

async function deleteCategoryAndChildren(guild, category, options = {}) {
  const children = getCachedChannels(guild).filter(channel => channel.parentId === category.id)

  for (const child of children) {
    if (shouldPreserveDuringSetupReset(child, options.preserveChannelIds)) {
      options.preservedChannelIds?.add?.(String(child.id))
      if (!await moveBotUpdateChannelOutOfResetCategory(child)) return false
      continue
    }
    if (!await deleteChannel(child, 'BOTC reset auto setup category')) return false
  }

  return deleteChannel(category, 'BOTC reset auto setup category')
}

function shouldPreserveDuringSetupReset(channel, preserveChannelIds = new Set()) {
  return preserveChannelIds.has(String(channel?.id)) || isBotUpdateChannel(channel)
}

function isBotUpdateChannel(channel) {
  return channel?.type === ChannelType.GuildText &&
    normalizeChannelName(channel.name) === normalizeChannelName(BOT_UPDATE_CHANNEL_NAME)
}

function normalizeChannelName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function moveBotUpdateChannelOutOfResetCategory(channel) {
  return setChannelParentIfChanged(channel, null, { lockPermissions: false })
    .then(() => true)
    .catch(err => logSetupRecoverable('preserve-bot-update-channel-before-setup-reset', err, createAutoChannelContext(channel), false))
}

function deleteChannel(channel, reason) {
  if (typeof channel.delete !== 'function') return false
  return queuedChannelDelete(channel, reason).then(() => true).catch(err => logSetupRecoverable('delete-auto-setup-channel', err, createAutoChannelContext(channel), false))
}

function findCategoriesByName(guild, name) {
  return getCachedChannels(guild).filter(channel =>
    channel.type === ChannelType.GuildCategory &&
    channel.name === name
  )
}

function getCachedChannels(guild) {
  if (typeof guild.channels.cache.values === 'function') {
    return [...guild.channels.cache.values()]
  }

  return [...guild.channels.cache]
}

function refreshGuildChannels(guild, action) {
  if (!guild?.channels?.fetch) {
    return logSetupRecoverable(action, new Error('Guild channel API unavailable'), { guildId: guild?.id }, false)
  }
  return guild.channels.fetch()
    .then(() => true)
    .catch(err => logSetupRecoverable(action, err, { guildId: guild.id }, false))
}

function createAutoChannelContext(channel) {
  return { channelId: channel?.id, guildId: channel?.guildId || channel?.guild?.id }
}

module.exports = {
  resetAutoSetupCategories
}
