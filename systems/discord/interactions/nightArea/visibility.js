const {
  OverwriteType,
  PermissionFlagsBits
} = require('discord.js')
const {
  createPrivateNightTextPermissions
} = require('./permissions')
const {
  createPrivateNightVoiceChannelPermissions
} = require('../voiceChannels/permissions')
const {
  fetchGuildMemberWithRecoverableFallback,
  fetchWithRecoverableFallback
} = require('../../../../utils/discord/recoverableFetch')
const {
  setPermissionOverwritesIfChanged
} = require('../../../../utils/discord/permissionOverwriteActions')
const {
  createBotLogger
} = require('../../../../utils/logger')

const log = createBotLogger({ subsystem: 'NightAreaVisibility' })

function createHiddenNightTextPermissions(guild, botUserId) {
  return [
    {
      id: guild.id,
      deny: [PermissionFlagsBits.ViewChannel],
      type: OverwriteType.Role
    },
    {
      id: botUserId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ManageChannels
      ],
      type: OverwriteType.Member
    }
  ]
}

function createHiddenNightVoicePermissions(guild, botUserId) {
  return [
    {
      id: guild.id,
      deny: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect
      ],
      type: OverwriteType.Role
    },
    {
      id: botUserId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
        PermissionFlagsBits.Stream,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.MoveMembers
      ],
      type: OverwriteType.Member
    }
  ]
}

async function hideNightAreas({ guild, game, botUserId, logger = log }) {
  if (!guild || !game) return 0

  let touched = 0
  const voiceChannelIds = new Set(Object.values(game.nightVoiceChannels || {}))

  for (const channelId of voiceChannelIds) {
    const channel = await fetchNightAreaChannel(guild, channelId, logger, 'fetch-hidden-night-voice-channel')
    if (!channel) continue
    await refreshNightAreaPermissions(
      channel,
      createHiddenNightVoicePermissions(guild, botUserId),
      'BOTC hide night voice channel for day',
      logger,
      'hide-night-voice-channel'
    )
    touched += 1
  }

  for (const channelId of Object.values(game.nightChannels || {})) {
    if (voiceChannelIds.has(channelId)) continue

    const channel = await fetchNightAreaChannel(guild, channelId, logger, 'fetch-hidden-night-text-channel')
    if (!channel) continue
    await refreshNightAreaPermissions(
      channel,
      createHiddenNightTextPermissions(guild, botUserId),
      'BOTC hide night text channel for day',
      logger,
      'hide-night-text-channel'
    )
    touched += 1
  }

  return touched
}

async function showNightAreas({ guild, game, view, roleIds, botUserId, gameLifecycle, logger = log }) {
  if (!guild || !game) return 0

  let touched = 0
  const voiceChannelIds = new Set(Object.values(game.nightVoiceChannels || {}))

  for (const [playerId, channelId] of Object.entries(game.nightVoiceChannels || {})) {
    const channel = await fetchNightAreaChannel(guild, channelId, logger, 'fetch-shown-night-voice-channel', { playerId })
    if (!channel) continue
    const member = await fetchNightAreaMember(guild, playerId, logger, 'fetch-shown-night-voice-member')
    await refreshNightAreaPermissions(
      channel,
      createPrivateNightVoiceChannelPermissions(
        guild,
        botUserId,
        roleIds,
        playerId,
        view?.storytellerId,
        member
      ),
      'BOTC show night voice channel for night',
      logger,
      'show-night-voice-channel',
      { playerId }
    )
    gameLifecycle?.registerNightVoiceChannel?.(guild.id, playerId, channel.id)
    touched += 1
  }

  for (const [playerId, channelId] of Object.entries(game.nightChannels || {})) {
    if (voiceChannelIds.has(channelId)) {
      gameLifecycle?.registerNightChannel?.(guild.id, playerId, channelId)
      continue
    }

    const channel = await fetchNightAreaChannel(guild, channelId, logger, 'fetch-shown-night-text-channel', { playerId })
    if (!channel) continue
    const member = await fetchNightAreaMember(guild, playerId, logger, 'fetch-shown-night-text-member')
    await refreshNightAreaPermissions(
      channel,
      createPrivateNightTextPermissions(guild, botUserId, view, playerId, member),
      'BOTC show night text channel for night',
      logger,
      'show-night-text-channel',
      { playerId }
    )
    gameLifecycle?.registerNightChannel?.(guild.id, playerId, channel.id)
    touched += 1
  }

  return touched
}

async function fetchNightAreaChannel(guild, channelId, logger, action, context = {}) {
  return fetchWithRecoverableFallback({
    action,
    context: {
      guildId: guild.id,
      channelId,
      ...context
    },
    fetch: () => guild.channels.fetch(channelId),
    logger
  })
}

async function fetchNightAreaMember(guild, playerId, logger, action) {
  return fetchGuildMemberWithRecoverableFallback({
    action,
    context: { playerId },
    guild,
    logger,
    userId: playerId
  })
}

async function refreshNightAreaPermissions(channel, overwrites, reason, logger, action, context = {}) {
  await setPermissionOverwritesIfChanged(channel, overwrites, reason).catch(err => {
    logger?.recoverable?.(action, err, {
      guildId: channel?.guildId || channel?.guild?.id,
      channelId: channel?.id,
      ...context
    })
  })
}

module.exports = {
  createHiddenNightTextPermissions,
  createHiddenNightVoicePermissions,
  hideNightAreas,
  showNightAreas
}
