const { ChannelType, PermissionFlagsBits } = require('discord.js')
const {
  queuedGuildChannelCreate
} = require('./discord/channelActions')
const {
  setChannelNameIfChanged,
  setChannelParentIfChanged
} = require('./discord/channelState')
const { createBotLogger } = require('./logger')
const {
  AUTO_SETUP_CATEGORY_NAME,
  BOT_UPDATE_CHANNEL_NAME,
  BOT_UPDATE_CHANNEL_SOURCE
} = require('./botcChannelNames')
const {
  applyBotChannelAccess
} = require('./botChannelAccess')
const {
  createBotUpdateChannel,
  deleteUnsafeCreatedBotChannel
} = require('./botUpdateChannelCreation')
const {
  createBotUpdateChannelFailureMessage,
  createBotUpdateChannelMoveFailureMessage
} = require('./botUpdateChannelFailureMessages')

const NOTICE_CHANNEL_TYPES = new Set([ChannelType.GuildText, ChannelType.GuildAnnouncement])
const log = createBotLogger({ subsystem: 'BotUpdateChannel' })

async function getOrCreateBotUpdateChannel(guild, config = {}, options = {}) {
  await refreshGuildChannels(guild)

  const configured = await fetchConfiguredBotUpdateChannel(guild, config)
  if (configured) {
    const configuredIsBotChannel = isBotcBotChannel(configured)
    const categoryBotChannel = findBotcBotChannelInCategory(guild, options.category)
    if (configuredIsBotChannel &&
        categoryBotChannel &&
        categoryBotChannel.id !== configured.id) {
      await renameBotUpdateChannel(categoryBotChannel)
      return applyDedicatedBotChannelAccess(categoryBotChannel, guild, BOT_UPDATE_CHANNEL_SOURCE, options)
    }
    if (configuredIsBotChannel || options.moveConfiguredChannelToCategory) {
      await moveBotUpdateChannelToCategory(configured, options.category)
    }
    if (configuredIsBotChannel) {
      if (options.category && !isChannelInCategory(configured, options.category)) {
        return {
          ok: false,
          channel: configured,
          message: createBotUpdateChannelMoveFailureMessage(configured, options.category, guild),
          source: 'configured-move-failed'
        }
      }
      await renameBotUpdateChannel(configured)
      return applyDedicatedBotChannelAccess(configured, guild, 'configured', options)
    }
    return { ok: true, channel: configured, source: 'configured' }
  }

  const category = options.category || await findOrCreateBotUpdateCategory(guild)
  const exactBotChannel = findBotcBotChannel(guild, category)
  if (exactBotChannel) {
    await renameBotUpdateChannel(exactBotChannel)
    await moveBotUpdateChannelToCategory(exactBotChannel, category)
    if (category && !isChannelInCategory(exactBotChannel, category) && options.requireBotChannelAccess) {
      return {
        ok: false,
        channel: exactBotChannel,
        message: createBotUpdateChannelMoveFailureMessage(exactBotChannel, category, guild),
        source: 'botc-bot-channel-move-failed'
      }
    }
    return applyDedicatedBotChannelAccess(exactBotChannel, guild, BOT_UPDATE_CHANNEL_SOURCE, options)
  }

  const createResult = category ? await createBotUpdateChannel(guild, category) : { channel: null }
  const created = createResult.channel
  if (created && canUseBotUpdateChannel(created, guild)) {
    return applyDedicatedBotChannelAccess(created, guild, 'created', {
      ...options,
      deleteOnAccessFailure: createResult.seedApplied === false
    })
  }
  if (options.requireBotChannelAccess) {
    return {
      ok: false,
      channel: created,
      message: createBotUpdateChannelFailureMessage(created, category, guild),
      source: created ? 'created-unusable' : 'create-failed'
    }
  }

  const botChannel = findBestBotNamedChannel(guild)
  if (botChannel) return { ok: true, channel: botChannel, source: 'existing-bot-channel' }

  const general = findBestGeneralChannel(guild)
  if (general) return { ok: true, channel: general, source: 'general' }

  return { ok: true, channel: null, source: 'none' }
}

async function applyDedicatedBotChannelAccess(channel, guild, source, options = {}) {
  const access = await applyBotChannelAccess(channel, guild)
  if (access?.ok === false && options.requireBotChannelAccess) {
    if (options.deleteOnAccessFailure) await deleteUnsafeCreatedBotChannel(channel)
    return { ok: false, channel, message: access.message, source }
  }
  return { ok: true, access, channel, source }
}

async function fetchConfiguredBotUpdateChannel(guild, config = {}) {
  if (!config.botUpdateChannelId) return null
  const channel = await fetchChannel(guild, config.botUpdateChannelId)
  return canUseBotUpdateChannel(channel, guild) ? channel : null
}

async function fetchChannel(guild, channelId) {
  const cached = getCacheValues(guild.channels?.cache).find(channel => channel.id === channelId)
  if (cached) return cached
  try {
    return await guild.channels.fetch?.(channelId) || null
  } catch (err) {
    log.recoverable('fetch-configured-update-channel', err, { guildId: guild?.id, channelId })
    return null
  }
}

function findBestBotNamedChannel(guild) {
  return rankChannels(guild, channel => {
    const words = getChannelWords(channel)
    if (words[0] === 'bot' || words[0] === 'bots') return 0
    if (words.includes('bot') || words.includes('bots')) return 1
    return null
  })
}

function findBotcBotChannel(guild, category = null) {
  return rankChannels(guild, channel => {
    if (!isBotcBotChannel(channel)) return null
    return isChannelInCategory(channel, category) ? 0 : 1
  })
}

function findBotcBotChannelInCategory(guild, category = null) {
  if (!category) return null
  return getCacheValues(guild.channels?.cache)
    .find(channel => isBotcBotChannel(channel) && isChannelInCategory(channel, category)) || null
}

function isBotcBotChannel(channel) {
  return normalizeChannelName(channel?.name) === normalizeChannelName(BOT_UPDATE_CHANNEL_NAME)
}

function findBestGeneralChannel(guild) {
  return rankChannels(guild, channel => {
    const words = getChannelWords(channel)
    if (words.join('-') === 'general') return 0
    if (words.includes('general')) return 1
    return null
  })
}

function rankChannels(guild, ranker) {
  return getCacheValues(guild.channels?.cache)
    .map((channel, index) => ({ channel, index, rank: canUseBotUpdateChannel(channel, guild) ? ranker(channel) : null }))
    .filter(candidate => candidate.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)[0]?.channel || null
}

async function findOrCreateBotUpdateCategory(guild) {
  const existing = getCacheValues(guild.channels?.cache).find(channel =>
    channel.type === ChannelType.GuildCategory &&
    channel.name === AUTO_SETUP_CATEGORY_NAME
  )
  if (existing) return existing

  return queuedGuildChannelCreate(guild, {
    name: AUTO_SETUP_CATEGORY_NAME,
    type: ChannelType.GuildCategory,
    reason: 'BOTC Bot category'
  }).catch(err => {
    log.recoverable('create-update-category', err, { guildId: guild?.id, name: AUTO_SETUP_CATEGORY_NAME })
    return null
  })
}

function moveBotUpdateChannelToCategory(channel, category) {
  if (!category) return Promise.resolve(false)
  return setChannelParentIfChanged(channel, category.id, { lockPermissions: false }).catch(err => {
    log.recoverable('move-update-channel-to-category', err, {
      categoryId: category.id,
      channelId: channel?.id,
      guildId: channel?.guildId || channel?.guild?.id
    })
    return false
  })
}

function renameBotUpdateChannel(channel) {
  return setChannelNameIfChanged(channel, BOT_UPDATE_CHANNEL_NAME, 'BOTC Bot channel name').catch(err => {
    log.recoverable('rename-update-channel', err, {
      channelId: channel?.id,
      guildId: channel?.guildId || channel?.guild?.id,
      name: BOT_UPDATE_CHANNEL_NAME
    })
    return false
  })
}

async function refreshGuildChannels(guild) {
  try {
    await guild.channels.fetch?.()
  } catch (err) {
    log.recoverable('refresh-guild-channels', err, { guildId: guild?.id })
  }
}

function canUseBotUpdateChannel(channel, guild) {
  if (!NOTICE_CHANNEL_TYPES.has(channel?.type)) return false
  if (!channel?.isTextBased?.()) return false
  const botMember = guild.members?.me
  if (!botMember) return false
  if (botMember.permissions?.has?.(PermissionFlagsBits.Administrator)) return true
  const permissions = channel.permissionsFor?.(botMember)
  return Boolean(permissions?.has?.(PermissionFlagsBits.ViewChannel) && permissions?.has?.(PermissionFlagsBits.SendMessages))
}

function isChannelInCategory(channel, category = null) {
  return Boolean(category?.id && String(channel?.parentId || '') === String(category.id))
}

function getChannelWords(channel) {
  return normalizeChannelName(channel?.name).split('-').filter(Boolean)
}

function normalizeChannelName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function getCacheValues(cache) {
  if (Array.isArray(cache)) return cache
  if (typeof cache?.values === 'function') return [...cache.values()]
  return []
}

module.exports = {
  AUTO_SETUP_CATEGORY_NAME,
  BOT_UPDATE_CHANNEL_NAME,
  BOT_UPDATE_CHANNEL_SOURCE,
  canUseBotUpdateChannel,
  findOrCreateBotUpdateCategory,
  getOrCreateBotUpdateChannel,
  normalizeChannelName
}
