const {
  createSystemEmbed,
  respondAutocomplete
} = require('./feedback')
const {
  queuedChannelSend
} = require('../../../utils/discord/messageActions')
const {
  createPrivateVoiceRequestRow,
  createPrivateVoiceTargetRows
} = require('../../../utils/privateVoiceRequests')
const {
  findPrivateConversationOwnerByChannel,
  getPrivateConversationAccess
} = require('./voiceChannels/dayPrivateAccess')
const {
  isPrivateConversationCreationPhase
} = require('./voiceChannels/dayPrivateConversations')
const {
  fetchGuildMemberWithRecoverableFallback
} = require('../../../utils/discord/recoverableFetch')
const {
  createBotLogger
} = require('../../../utils/logger')

const MAX_AUTOCOMPLETE_CHOICES = 25
const log = createBotLogger({ subsystem: 'PrivateVoiceRequestActions' })

async function sendPrivateVoiceCreatorPrompt({
  channel,
  game,
  guild,
  ownerId
}) {
  const owner = guild
    ? await fetchPrivateVoiceMember(guild, ownerId, 'fetch-private-voice-owner')
    : null
  const dm = await owner?.createDM?.().catch(err => {
    log.recoverable('create-private-voice-owner-dm', err, {
      guildId: guild?.id,
      ownerId
    })
    return null
  })
  if (!dm) return null

  const players = Object.entries(game?.users || {})
    .filter(([playerId, user]) => playerId !== ownerId && user.role === 'player')
    .map(([playerId, user]) => ({
      id: playerId,
      label: user.displayName || `Player ${String(playerId).slice(-4)}`
    }))

  if (!players.length) return null

  return queuedChannelSend(dm, {
    embeds: [
      createSystemEmbed(
        'Choose a private voice target',
        `Your private voice room is ready: <#${channel.id}>.\nChoose a player to invite.`,
        0x3498db
      )
    ],
    components: createPrivateVoiceTargetRows({
      guildId: guild.id,
      ownerId,
      includePublicButton: true,
      players
    })
  }).catch(err => {
    log.recoverable('send-private-voice-owner-prompt', err, {
      guildId: guild?.id,
      ownerId
    })
    return null
  })
}

async function sendPrivateVoiceRequest({
  interaction,
  gameLifecycle,
  targetId,
  roomOwnerId = null
}) {
  const context = validatePrivateVoiceRequest({ interaction, gameLifecycle, targetId, roomOwnerId })
  if (!context.ok) return context

  const targetMember = await fetchPrivateVoiceMember(
    interaction.guild,
    targetId,
    'fetch-private-voice-target'
  )
  if (!targetMember) {
    return gameLifecycle.createError(gameLifecycle.errorTypes.NOT_FOUND, 'Choose a current server member.')
  }

  const dm = await targetMember.createDM().catch(err => {
    log.recoverable('create-private-voice-target-dm', err, {
      guildId: interaction.guild.id,
      ownerId: context.ownerId,
      requesterId: interaction.member.id,
      targetId
    })
    return null
  })
  if (!dm) return createPrivateMessageFailure(gameLifecycle)

  const sent = await queuedChannelSend(dm, createPrivateVoiceRequestPayload({
    guildId: interaction.guild.id,
    ownerId: context.ownerId,
    requesterId: interaction.member.id,
    targetId,
    requesterLabel: interaction.member.displayName || interaction.user?.username || 'A player',
    isInvite: context.ownerId !== interaction.member.id
  })).catch(err => {
    log.recoverable('send-private-voice-target-request', err, {
      guildId: interaction.guild.id,
      ownerId: context.ownerId,
      requesterId: interaction.member.id,
      targetId
    })
    return null
  })

  if (!sent) return createPrivateMessageFailure(gameLifecycle)

  return gameLifecycle.createSuccess({
    title: 'Private voice request sent',
    message: `Sent a private voice request to <@${targetId}>.`
  })
}

function validatePrivateVoiceRequest({ interaction, gameLifecycle, targetId, roomOwnerId }) {
  const game = gameLifecycle.get(interaction.guild.id)
  if (!game) return gameLifecycle.createError(gameLifecycle.errorTypes.NOT_FOUND, 'No game')
  if (game.state !== 'in-game') {
    return gameLifecycle.createError(gameLifecycle.errorTypes.INVALID_STATE, 'Game is not in progress')
  }
  if (!isPrivateConversationCreationPhase(game.phase)) {
    return gameLifecycle.createError(
      gameLifecycle.errorTypes.INVALID_STATE,
      'Private voice chat is only available during the day.'
    )
  }
  if (gameLifecycle.getRole(game, interaction.member.id) !== 'player') {
    return gameLifecycle.createError(gameLifecycle.errorTypes.PERMISSION_DENIED, 'Only players can use private voice chat.')
  }
  if (gameLifecycle.getRole(game, targetId) !== 'player') {
    return gameLifecycle.createError(gameLifecycle.errorTypes.INVALID_STATE, 'Choose a current player.')
  }
  if (targetId === interaction.member.id) {
    return gameLifecycle.createError(gameLifecycle.errorTypes.INVALID_STATE, 'Choose another player.')
  }

  const ownerId = roomOwnerId || interaction.member.id
  if (gameLifecycle.getRole(game, ownerId) !== 'player') {
    return gameLifecycle.createError(gameLifecycle.errorTypes.INVALID_STATE, 'That private voice room is no longer valid.')
  }

  const access = getPrivateConversationAccess(game, ownerId)
  if (ownerId !== interaction.member.id && !access.publicRoom && !access.invitedPlayerIds.includes(interaction.member.id)) {
    return gameLifecycle.createError(gameLifecycle.errorTypes.PERMISSION_DENIED, 'Only players in that private voice room can invite others.')
  }
  if (access.invitedPlayerIds.includes(targetId)) {
    return gameLifecycle.createError(gameLifecycle.errorTypes.INVALID_STATE, 'That player already has access to this private voice room.')
  }
  if (access.publicRoom) {
    return gameLifecycle.createError(gameLifecycle.errorTypes.INVALID_STATE, 'That private voice room is already open to all players.')
  }

  return gameLifecycle.createSuccess({ game, ownerId })
}

function createPrivateVoiceRequestPayload({
  guildId,
  ownerId,
  requesterId,
  targetId,
  requesterLabel,
  isInvite = false
}) {
  return {
    content: `<@${targetId}>`,
    embeds: [
      createSystemEmbed(
        'Private voice request',
        isInvite
          ? `${requesterLabel} invited you into a private voice room.`
          : `${requesterLabel} wants to start a private voice chat with you.`,
        0x3498db
      )
    ],
    components: [
      createPrivateVoiceRequestRow({
        guildId,
        ownerId,
        requesterId,
        targetId
      })
    ]
  }
}

function getPrivateVoicePlayerChoices(interaction, gameLifecycle, { roomOwnerId = null } = {}) {
  const game = interaction.guild?.id ? gameLifecycle.get(interaction.guild.id) : null
  if (!game) return []

  const focused = normalizeChoiceSearch(interaction.options.getFocused() || '')
  const access = roomOwnerId ? getPrivateConversationAccess(game, roomOwnerId) : null
  if (access?.publicRoom) return []

  return gameLifecycle.getPlayerIds(game)
    .filter(playerId => playerId !== interaction.member?.id)
    .filter(playerId => !access?.invitedPlayerIds.includes(playerId))
    .map(playerId => ({
      name: (game.users[playerId]?.displayName || `Player ${String(playerId).slice(-4)}`).slice(0, 100),
      value: playerId
    }))
    .filter(choice => !focused || normalizeChoiceSearch(choice.name).includes(focused))
    .slice(0, MAX_AUTOCOMPLETE_CHOICES)
}

function getRoomOwnerForInteraction(game, interaction) {
  return findPrivateConversationOwnerByChannel(game, interaction.channelId)
}

function respondPrivateVoiceAutocomplete(interaction, gameLifecycle, options = {}) {
  return respondAutocomplete(interaction, getPrivateVoicePlayerChoices(interaction, gameLifecycle, options))
}

function createPrivateMessageFailure(gameLifecycle) {
  return gameLifecycle.createError(
    gameLifecycle.errorTypes.TRANSACTION_FAILED,
    'I could not privately message that player.'
  )
}

function fetchPrivateVoiceMember(guild, userId, action) {
  return fetchGuildMemberWithRecoverableFallback({
    action,
    guild,
    logger: log,
    userId
  })
}

function normalizeChoiceSearch(value) {
  return String(value || '').trim().toLowerCase()
}

module.exports = {
  getPrivateVoicePlayerChoices,
  getRoomOwnerForInteraction,
  respondPrivateVoiceAutocomplete,
  sendPrivateVoiceCreatorPrompt,
  sendPrivateVoiceRequest
}
