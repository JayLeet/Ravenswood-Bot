const { ChannelType } = require('discord.js')
const {
  queuedChannelDelete,
  queuedGuildChannelCreate
} = require('./discord/channelActions')
const {
  BOT_UPDATE_CHANNEL_NAME
} = require('./botcChannelNames')
const {
  createBotChannelSeedOverwrites
} = require('./botChannelAccess')
const { createBotLogger } = require('./logger')

const log = createBotLogger({ subsystem: 'BotUpdateChannel' })

async function createBotUpdateChannel(guild, category = null) {
  const seededOptions = {
    name: BOT_UPDATE_CHANNEL_NAME,
    type: ChannelType.GuildText,
    parent: category?.id || null,
    reason: 'BOTC Bot channel',
    permissionOverwrites: createBotChannelSeedOverwrites(guild)
  }
  const seeded = await queuedGuildChannelCreate(guild, seededOptions)
    .then(channel => ({ channel, error: null, seedApplied: true }))
    .catch(err => {
      log.recoverable('create-update-channel', err, {
        guildId: guild?.id,
        mode: 'with-seed-overwrites'
      })
      return { channel: null, error: err, seedApplied: false }
    })
  if (seeded.channel) return seeded

  return queuedGuildChannelCreate(guild, {
    name: BOT_UPDATE_CHANNEL_NAME,
    type: ChannelType.GuildText,
    parent: category?.id || null,
    reason: 'BOTC Bot channel'
  })
    .then(channel => ({ channel, error: seeded.error, seedApplied: false }))
    .catch(err => {
      log.recoverable('create-update-channel-without-seed-overwrites', err, {
        guildId: guild?.id
      })
      return { channel: null, error: err, seedApplied: false }
    })
}

async function deleteUnsafeCreatedBotChannel(channel) {
  if (!channel?.delete) return false
  return queuedChannelDelete(channel, 'BOTC Bot channel permission lockdown failed')
    .then(() => true)
    .catch(err => {
      log.recoverable('delete-unlocked-update-channel', err, {
        channelId: channel?.id,
        guildId: channel?.guildId || channel?.guild?.id
      })
      return false
    })
}

module.exports = {
  createBotUpdateChannel,
  deleteUnsafeCreatedBotChannel
}
