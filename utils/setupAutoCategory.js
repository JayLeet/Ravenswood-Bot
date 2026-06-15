const { ChannelType } = require('discord.js')
const { AUTO_SETUP_CATEGORY_NAME } = require('./botcChannelNames')
const { queuedGuildChannelCreate } = require('./discord/channelActions')
const { logSetupRecoverable } = require('./setupLogging')

async function findOrCreateAutoSetupCategory(guild) {
  const refreshed = await refreshGuildChannels(guild, 'fetch-auto-setup-channels-before-category')
  if (!refreshed.ok) return refreshed

  const existing = findCachedAutoSetupCategory(guild)

  if (existing) return { ok: true, category: existing }

  return queuedGuildChannelCreate(guild, {
    name: AUTO_SETUP_CATEGORY_NAME,
    type: ChannelType.GuildCategory,
    reason: 'BOTC setup category'
  })
    .then(category => ({ ok: true, category }))
    .catch(err => {
      logSetupRecoverable('create-auto-setup-category', err, { guildId: guild.id, name: AUTO_SETUP_CATEGORY_NAME })
      return { ok: false, error: err }
    })
}

async function findExistingAutoSetupCategory(guild) {
  const refreshed = await refreshGuildChannels(guild, 'fetch-auto-setup-channels-before-category-preflight')
  if (!refreshed.ok) return null
  return findCachedAutoSetupCategory(guild)
}

function findCachedAutoSetupCategory(guild) {
  return getCachedChannels(guild).find(channel =>
    channel.type === ChannelType.GuildCategory &&
    channel.name === AUTO_SETUP_CATEGORY_NAME
  ) || null
}

async function refreshGuildChannels(guild, action) {
  if (!guild?.channels?.fetch) {
    const error = new Error('Guild channel API unavailable')
    logSetupRecoverable(action, error, { guildId: guild?.id }, false)
    return { ok: false, error }
  }
  return guild.channels.fetch()
    .then(() => ({ ok: true }))
    .catch(err => {
      logSetupRecoverable(action, err, { guildId: guild.id }, false)
      return { ok: false, error: err }
    })
}

function getCachedChannels(guild) {
  if (typeof guild.channels?.cache?.values === 'function') {
    return [...guild.channels.cache.values()]
  }

  if (Array.isArray(guild.channels?.cache)) return guild.channels.cache

  return []
}

module.exports = {
  findExistingAutoSetupCategory,
  findOrCreateAutoSetupCategory
}
