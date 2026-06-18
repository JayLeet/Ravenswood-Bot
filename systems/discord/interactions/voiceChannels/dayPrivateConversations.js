const {
  ChannelType
} = require('discord.js')
const {
  queuedGuildChannelCreate
} = require('../../../../utils/discord/channelActions')
const {
  findManagedVoiceChannelByNames,
  isVoiceChannelLookupUnavailable
} = require('./channelLookup')
const {
  fetchVoiceChannel,
  refreshVoiceChannel: refreshVoiceChannelAction
} = require('./recoverableVoiceChannelActions')
const {
  createPrivateConversationCreatorChannelName,
  createPrivateConversationVoiceChannelLookupNames,
  createPrivateConversationVoiceChannelName,
  getPrivateConversationCreatorChannelLookupNames,
  getPrivateConversationThemeIndexFromName,
  pickUnusedPrivateConversationThemeIndex
} = require('./names')
const {
  createPlayerPrivateVoiceChannelPermissions,
  createWhisperDoorVoiceChannelPermissions
} = require('./permissions')
const {
  deletePrivateConversationAccess,
  getPrivateConversationAccess,
  setPrivateConversationAccess
} = require('./dayPrivateAccess')
const {
  cleanupPlayerMadeVoiceChannelRef,
  clearPlayerMadeVoiceState
} = require('./dayPrivateConversationCleanup')
const {
  createDiscordPermissionAccess,
  createPlayerLabel
} = require('./dayPrivateLabels')
const {
  createBotLogger
} = require('../../../../utils/logger')
const {
  getDiscordErrorReason
} = require('../../../../utils/discord/errorReason')

const log = createBotLogger({ subsystem: 'DayPrivateConversations' })

function isPrivateConversationCreationPhase(phase) {
  return phase === 'day' || phase === 'nominations'
}

function canCreatePlayerMadeVoiceChannel(game, userId) {
  return Boolean(
    game?.state === 'in-game' &&
    isPrivateConversationCreationPhase(game.phase) &&
    game.users?.[userId]?.role === 'player'
  )
}

async function ensurePrivateConversationCreatorChannel({
  guild,
  parent,
  game,
  gameLifecycle,
  roleIds
}) {
  if (!guild || !game) return null

  const name = createPrivateConversationCreatorChannelName()
  const existing = await findManagedVoiceChannelByNames(
    guild,
    game.privateConversationCreatorChannelId,
    getPrivateConversationCreatorChannelLookupNames()
  )
  if (isVoiceChannelLookupUnavailable(existing)) return null

  const overwrites = createWhisperDoorVoiceChannelPermissions(guild, guild.client.user.id, roleIds)

  if (existing) {
    await refreshVoiceChannel(existing, name, parent, overwrites, 'BOTC private conversation creator update')
    gameLifecycle.registerPrivateConversationCreator(guild.id, existing.id)
    return existing
  }

  const channel = await queuedGuildChannelCreate(guild, {
    name,
    type: ChannelType.GuildVoice,
    parent: parent?.id || null,
    reason: 'BOTC private conversation creator voice channel',
    permissionOverwrites: overwrites
  }).catch(err => {
    log.warn('create-private-conversation-creator-channel', createCreatorChannelWarning(guild, parent, err), {
      guildId: guild.id,
      parentId: parent?.id
    })
    return null
  })

  if (channel) gameLifecycle.registerPrivateConversationCreator(guild.id, channel.id)
  return channel
}

async function ensurePlayerPrivateConversationVoiceChannel({
  guild,
  parent,
  game,
  gameLifecycle,
  view,
  roleIds,
  playerId,
  discordMember = null,
  invitedPlayerIds = [playerId],
  publicRoom = false
}) {
  if (!guild || !game || !playerId) return null

  const memberLabel = createPlayerLabel(game, view, playerId, discordMember)
  const member = { id: playerId, displayName: memberLabel, user: discordMember?.user }
  const channelId = game.playerMadeVoiceChannels?.[playerId] || null
  const existing = await findManagedVoiceChannelByNames(
    guild,
    channelId,
    createPrivateConversationVoiceChannelLookupNames(member)
  )
  if (isVoiceChannelLookupUnavailable(existing)) return null

  const themeIndex = getPrivateConversationThemeIndexFromName(existing?.name)
  const name = createPrivateConversationVoiceChannelName(
    member,
    themeIndex >= 0
      ? themeIndex
      : pickUnusedPrivateConversationThemeIndex(await getUsedPrivateConversationThemeIndexes(guild, game, playerId))
  )
  const access = setPrivateConversationAccess(game, playerId, {
    invitedPlayerIds,
    publicRoom
  })
  const overwrites = createPlayerPrivateVoiceChannelPermissions(
    guild,
    guild.client.user.id,
    roleIds,
    createDiscordPermissionAccess(game, gameLifecycle, access)
  )

  if (existing) {
    await refreshVoiceChannel(existing, name, parent, overwrites, 'BOTC player-made private conversation voice channel update')
    gameLifecycle.registerPlayerMadeVoiceChannel(guild.id, playerId, existing.id)
    return existing
  }

  const channel = await queuedGuildChannelCreate(guild, {
    name,
    type: ChannelType.GuildVoice,
    parent: parent?.id || null,
    reason: 'BOTC player-made private conversation voice channel',
    permissionOverwrites: overwrites
  }).catch(err => {
    log.warn('create-player-private-conversation-channel', createPlayerRoomWarning(guild, playerId, err), {
      guildId: guild.id,
      playerId
    })
    return null
  })

  if (channel) gameLifecycle.registerPlayerMadeVoiceChannel(guild.id, playerId, channel.id)
  else deletePrivateConversationAccess(game, playerId)
  return channel
}

async function cleanupPlayerMadeVoiceChannels({
  guild,
  game,
  gameLifecycle,
  includeCreator = false,
  logger = log
}) {
  if (!guild || !game) return 0

  let touched = 0

  for (const [playerId, channelId] of Object.entries(game.playerMadeVoiceChannels || {})) {
    const cleaned = await cleanupPlayerMadeVoiceChannelRef({
      actionPrefix: 'player-made-voice-channel',
      channelId,
      deleteReason: 'BOTC player-made day voice cleanup',
      guild,
      logger,
      playerId
    })
    if (!cleaned) continue

    clearPlayerMadeVoiceState({ game, gameLifecycle, guildId: guild.id, playerId })
    touched += 1
  }

  if (includeCreator && game.privateConversationCreatorChannelId) {
    const cleaned = await cleanupPlayerMadeVoiceChannelRef({
      actionPrefix: 'private-conversation-creator-channel',
      channelId: game.privateConversationCreatorChannelId,
      deleteReason: 'BOTC private conversation creator cleanup',
      guild,
      logger
    })
    if (!cleaned) return touched

    gameLifecycle.unregisterPrivateConversationCreator(guild.id)
    touched += 1
  }

  return touched
}

async function prunePlayerMadeVoiceChannels({
  guild,
  game,
  gameLifecycle,
  playerIds,
  logger = log
}) {
  if (!guild || !game) return 0

  const currentPlayers = new Set(playerIds || [])
  let touched = 0

  for (const [playerId, channelId] of Object.entries(game.playerMadeVoiceChannels || {})) {
    if (currentPlayers.has(playerId)) continue

    const cleaned = await cleanupPlayerMadeVoiceChannelRef({
      actionPrefix: 'pruned-player-made-voice-channel',
      channelId,
      deleteReason: 'BOTC player left private conversation cleanup',
      guild,
      logger,
      playerId
    })
    if (!cleaned) continue

    clearPlayerMadeVoiceState({ game, gameLifecycle, guildId: guild.id, playerId })
    touched += 1
  }

  return touched
}

async function getUsedPrivateConversationThemeIndexes(guild, game, exceptPlayerId = null, logger = log) {
  const used = []

  for (const [playerId, channelId] of Object.entries(game.playerMadeVoiceChannels || {})) {
    if (playerId === exceptPlayerId) continue

    const channel = await fetchVoiceChannel(guild, channelId, logger, 'fetch-player-made-voice-theme-channel', { playerId })
    const index = getPrivateConversationThemeIndexFromName(channel?.name)
    if (index >= 0) used.push(index)
  }

  return used
}

async function refreshVoiceChannel(channel, name, parent, overwrites, reason, logger = log) {
  return refreshVoiceChannelAction(channel, name, parent, overwrites, reason, logger)
}

function createCreatorChannelWarning(guild, parent, err) {
  return [
    `[BOTC] Could not create private voice creator channel in ${guild?.id}: ${getDiscordErrorReason(err)}.`,
    `Target category: ${parent?.name || parent?.id || 'none'}.`,
    'Likely fix: give the bot Manage Channels, View Channel, Connect, and Speak in the Ravenswood Bluff category.'
  ].join(' ')
}

function createPlayerRoomWarning(guild, playerId, err) {
  return [
    `[BOTC] Could not create private conversation voice channel for ${playerId} in ${guild?.id}:`,
    `${getDiscordErrorReason(err)}.`
  ].join(' ')
}

module.exports = {
  canCreatePlayerMadeVoiceChannel,
  cleanupPlayerMadeVoiceChannels,
  createDiscordPermissionAccess,
  createCreatorChannelWarning,
  createPlayerLabel,
  createPlayerRoomWarning,
  ensurePlayerPrivateConversationVoiceChannel,
  ensurePrivateConversationCreatorChannel,
  getUsedPrivateConversationThemeIndexes,
  isPrivateConversationCreationPhase,
  prunePlayerMadeVoiceChannels,
  getPrivateConversationAccess,
  refreshVoiceChannel
}
