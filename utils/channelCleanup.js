const { ChannelType } = require('discord.js')
const { queuedChannelDelete } = require('./discord/channelActions')
const { queuedMessageDelete } = require('./discord/messageActions')
const { createBotLogger } = require('./logger')
const { AUTO_SETUP_CATEGORY_NAME } = require('./setupAutoChannels')
const { SETUP_SHARED_VOICE_CHANNELS } = require('./setupVoiceChannels')

const log = createBotLogger({ subsystem: 'ChannelCleanup' })

async function cleanupSetupChannels(client, serverConfig) {
  const channelIds = getCleanupChannelIds(serverConfig)
  const results = []

  for (const channelId of channelIds) {
    const channel = await client.channels
      .fetch(channelId)
      .catch(err => {
        log.recoverable('fetch-setup-cleanup-channel', err, { channelId })
        return null
      })

    if (!channel?.messages?.fetch) {
      results.push({ channelId, deleted: 0, failed: 0 })
      continue
    }

    const result = await cleanupChannelMessages(channel)
    results.push({ channelId, ...result })
  }

  return results
}

async function cleanupPostGameChannelMessages(client, serverConfig) {
  const channelId = serverConfig?.postGameChannelId
  if (!channelId) return { channelId: null, deleted: 0, failed: 0, skipped: true }

  const channel = await client.channels
    .fetch(channelId)
    .catch(err => {
      log.recoverable('fetch-post-game-cleanup-channel', err, { channelId })
      return null
    })

  if (!channel?.messages?.fetch) {
    return { channelId, deleted: 0, failed: 0, skipped: true }
  }

  return {
    channelId,
    skipped: false,
    ...await cleanupChannelMessages(channel)
  }
}

async function cleanupUnexpectedRavenswoodChannels(client, serverConfig) {
  if (!serverConfig?.gameChannelId) return { deleted: 0, failed: 0, skipped: true }

  const gameChannel = await client.channels
    .fetch(serverConfig.gameChannelId)
    .catch(err => {
      log.recoverable('fetch-game-channel-for-ravenswood-cleanup', err, {
        channelId: serverConfig.gameChannelId
      })
      return null
    })

  const category = gameChannel?.parent
  if (!category || category.name !== AUTO_SETUP_CATEGORY_NAME) {
    return { deleted: 0, failed: 0, skipped: true }
  }

  const guild = gameChannel.guild
  await guild?.channels?.fetch?.().catch(err => {
    log.recoverable('refresh-guild-channels-for-ravenswood-cleanup', err, {
      guildId: guild?.id
    })
  })

  const allowedIds = new Set(getConfiguredChannelIds(serverConfig))
  const children = [...(guild?.channels?.cache?.values?.() || [])]
    .filter(channel => channel.parentId === category.id)
    .filter(channel => !allowedIds.has(channel.id))
    .filter(channel => !isSetupSharedVoiceChannel(channel))

  let deleted = 0
  let failed = 0

  for (const channel of children) {
    const ok = await queuedChannelDelete(channel, 'BOTC cleanup before new game')
      .then(() => true)
      .catch(err => {
        log.recoverable('delete-unexpected-ravenswood-channel', err, {
          channelId: channel.id,
          guildId: channel.guildId || channel.guild?.id
        })
        return false
      })

    if (ok) deleted++
    else failed++
  }

  return { deleted, failed, skipped: false }
}

async function cleanupChannelMessages(channel) {
  let before = null
  let deleted = 0
  let failed = 0

  for (let batch = 0; batch < 100; batch++) {
    const options = before
      ? { limit: 100, before }
      : { limit: 100 }

    const messages = await channel.messages
      .fetch(options)
      .catch(err => {
        log.recoverable('fetch-channel-cleanup-messages', err, {
          channelId: channel.id,
          guildId: channel.guildId || channel.guild?.id
        })
        return null
      })

    if (!messages?.size) break

    before = messages.last()?.id

    for (const message of messages.values()) {
      const ok = await queuedMessageDelete(message)
        .then(() => true)
        .catch(err => {
          log.recoverable('delete-channel-cleanup-message', err, {
            channelId: message.channelId || channel.id,
            guildId: message.guildId || channel.guildId || channel.guild?.id,
            messageId: message.id
          })
          return false
        })

      if (ok) deleted++
      else failed++
    }

    if (messages.size < 100) break
  }

  return { deleted, failed }
}

function isSetupSharedVoiceChannel(channel) {
  if (channel?.type !== ChannelType.GuildVoice) return false
  return SETUP_SHARED_VOICE_CHANNELS.some(config => config.lookupNames.includes(channel.name))
}

function getCleanupChannelIds(serverConfig) {
  if (!serverConfig) return []

  return [
    serverConfig.liveChannelId,
    serverConfig.spectatorChannelId,
    serverConfig.storytellerChannelId
  ].filter((channelId, index, channelIds) =>
    channelId &&
    channelId !== serverConfig.gameChannelId &&
    channelId !== serverConfig.postGameChannelId &&
    channelIds.indexOf(channelId) === index
  )
}

function getConfiguredChannelIds(serverConfig) {
  if (!serverConfig) return []

  return [
    serverConfig.gameChannelId,
    serverConfig.gameLogChannelId,
    serverConfig.liveChannelId,
    serverConfig.playerGrimoireChannelId,
    serverConfig.postGameChannelId,
    serverConfig.spectatorChannelId,
    serverConfig.storytellerChannelId
  ].filter((channelId, index, channelIds) =>
    channelId &&
    channelIds.indexOf(channelId) === index
  )
}

function getCleanupChannels(channels, serverConfig) {
  const cleanupChannelIds = new Set(getCleanupChannelIds(serverConfig))
  return channels.filter(channel => cleanupChannelIds.has(channel?.id))
}

module.exports = {
  cleanupChannelMessages,
  cleanupPostGameChannelMessages,
  cleanupSetupChannels,
  cleanupUnexpectedRavenswoodChannels,
  getCleanupChannelIds,
  getCleanupChannels,
  getConfiguredChannelIds,
  isSetupSharedVoiceChannel
}
