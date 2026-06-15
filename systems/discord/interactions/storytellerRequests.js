const {
  queuedChannelSend,
  queuedMessageDelete,
  queuedMessageEdit
} = require('../../../utils/discord/messageActions')
const {
  queuedVoiceMove
} = require('../../../utils/discord/voiceActions')
const {
  fetchGuildMemberWithRecoverableFallback
} = require('../../../utils/discord/recoverableFetch')
const {
  createBotLogger
} = require('../../../utils/logger')
const {
  createStorytellerMoveRequestPayload,
  parseStorytellerRequestCustomId
} = require('../../../utils/storytellerRequestButtons')
const {
  acknowledgeInteraction,
  createSystemEmbed,
  replyPrivateSystem,
  respondPrivateSystem
} = require('./feedback')
const {
  resolveTestPlayerInteractionMember
} = require('./testPlayerSimulation')
const {
  updateNightCottageStatus
} = require('./nightCottageStatus')
const {
  TRACKED_REQUEST_UNAVAILABLE,
  fetchTrackedStorytellerRequestMessage,
  recoverStorytellerRequestAction: recover
} = require('./storytellerRequests/recovery')

function createStorytellerRequestInteractionSystem({
  gameLifecycle,
  serverConfigs
}) {
  const subsystem = 'StorytellerRequests'
  const log = createBotLogger({ subsystem })

  async function handleStorytellerRequestInteraction(interaction) {
    const parsed = parseStorytellerRequestCustomId(interaction.customId)
    if (!parsed) return null

    if (parsed.action === 'ask') return handleAsk(interaction, parsed)
    if (parsed.action === 'move') return handleMove(interaction, parsed)

    return replyPrivateSystem(
      interaction,
      'Unknown control',
      'That Storyteller request button is not recognized.',
      'Ask the Storyteller to refresh the dashboard if this keeps happening.'
    )
  }

  async function handleAsk(interaction, parsed) {
    const game = gameLifecycle.get(interaction.guild.id)
    if (!game || parsed.guildId !== interaction.guild.id) {
      return replyPrivateSystem(interaction, 'Request failed', 'This game is no longer active.')
    }

    const view = gameLifecycle.getGameView?.(interaction.guild.id) || null
    const actorMember = resolveTestPlayerInteractionMember({
      game,
      gameLifecycle,
      interaction,
      playerId: parsed.playerId,
      view
    })
    const fakeSimulation = actorMember?.id !== interaction.member.id

    if (game.users?.[actorMember.id]?.role !== 'player') {
      return replyPrivateSystem(interaction, 'Request failed', 'Only active players can call the Storyteller from role-info.')
    }

    const serverConfig = serverConfigs.get(interaction.guild.id)
    const channel = await recover('fetch-storyteller-channel', () => interaction.client.channels.fetch(serverConfig?.storytellerChannelId), {
      channelId: serverConfig?.storytellerChannelId,
      guildId: interaction.guild.id,
      subsystem
    })

    if (!channel?.isTextBased?.()) {
      return replyPrivateSystem(interaction, 'Request failed', 'I could not find the Storyteller channel.')
    }

    await acknowledgeInteraction(interaction)
    const requestMessage = await upsertStorytellerMoveRequest({
      channel,
      game,
      gameLifecycle,
      interaction,
      member: actorMember,
      payload: createStorytellerMoveRequestPayload({
        pingPlayer: !fakeSimulation,
        playerId: actorMember.id,
        playerLabel: actorMember.displayName || `<@${actorMember.id}>`,
        storytellerId: game.storytellerId
      })
    })
    if (!requestMessage) {
      return respondPrivateSystem(interaction, 'Request failed', 'I could not post your Storyteller request yet.', 'Try Request Storyteller again in a moment.')
    }
    await sendPlayerRequestStatus(interaction, game, gameLifecycle, actorMember)
    return true
  }

  async function handleMove(interaction, parsed) {
    const game = gameLifecycle.get(interaction.guild.id)
    if (!game || !gameLifecycle.isStoryteller(game, interaction.member.id)) {
      return replyPrivateSystem(interaction, 'Move failed', 'Only the active Storyteller can use this Move button.')
    }

    const playerId = resolveCurrentSeatPlayerId(game, parsed.playerId)
    const channelId = game.nightVoiceChannels?.[playerId]
    const channel = channelId
      ? await recover('fetch-player-night-voice-channel', () => interaction.guild.channels.fetch(channelId), {
        channelId,
        guildId: interaction.guild.id,
        playerId,
        subsystem
      })
      : null
    if (!channel) return replyPrivateSystem(interaction, 'Move failed', 'That player no longer has a night channel.')

    const member = await fetchGuildMemberWithRecoverableFallback({
      action: 'fetch-storyteller-member',
      guild: interaction.guild,
      logger: log,
      userId: interaction.member.id
    }) || interaction.member
    if (!member?.voice?.channelId) {
      return replyPrivateSystem(interaction, 'Move failed', 'Join any voice channel first, then press Move again.')
    }

    const moved = await recover('move-storyteller-to-player-channel', () => queuedVoiceMove(member, channel).then(() => true), {
      channelId: channel.id,
      guildId: interaction.guild.id,
      playerId,
      subsystem,
      userId: interaction.member.id
    }) || false
    if (!moved) return replyPrivateSystem(interaction, 'Move failed', `I could not move you to <#${channel.id}>.`)

    if (interaction.message) {
      await recover('edit-moved-storyteller-request', () => queuedMessageEdit(interaction.message, {
        embeds: [createSystemEmbed('Storyteller moved', `Moved to <#${channel.id}>.`, 0x2ecc71)],
        components: []
      }), {
        guildId: interaction.guild.id,
        messageId: interaction.message.id,
        playerId,
        subsystem
      })
      setTimeout(() => recover(
        'delete-handled-storyteller-request',
        () => queuedMessageDelete(interaction.message, 'Storyteller request handled'),
        { guildId: interaction.guild.id, messageId: interaction.message.id, playerId, subsystem }
      ), 3000)
    }
    clearStorytellerMoveRequest(game, parsed.playerId)
    if (playerId !== parsed.playerId) clearStorytellerMoveRequest(game, playerId)
    gameLifecycle.save?.()

    return acknowledgeInteraction(interaction)
  }

  return {
    handleStorytellerRequestInteraction
  }
}

async function upsertStorytellerMoveRequest({ channel, game, gameLifecycle, interaction, member = interaction.member, payload }) {
  const playerId = member.id
  const existing = await fetchTrackedStorytellerRequestMessage(
    channel,
    game.storytellerMoveRequests?.[playerId]?.storyteller,
    { guildId: game.guildId, playerId }
  )
  if (existing === TRACKED_REQUEST_UNAVAILABLE) return null
  const message = existing
    ? await recover('edit-storyteller-move-request', () => queuedMessageEdit(existing, payload), {
      guildId: game.guildId,
      messageId: existing.id,
      playerId,
      subsystem: 'StorytellerRequests'
    })
    : await recover('send-storyteller-move-request', () => queuedChannelSend(channel, payload), {
      channelId: channel.id,
      guildId: game.guildId,
      playerId,
      subsystem: 'StorytellerRequests'
    })
  if (!message) return null

  game.storytellerMoveRequests ??= {}
  game.storytellerMoveRequests[playerId] = {
    ...(game.storytellerMoveRequests[playerId] || {}),
    storyteller: {
      channelId: message.channelId,
      messageId: message.id
    }
  }
  gameLifecycle.save?.()
  return message
}

async function sendPlayerRequestStatus(interaction, game, gameLifecycle, member = interaction.member) {
  const description = 'The Storyteller has been pinged and will come as soon as possible. Please be patient and wait.'
  const message = await updateNightCottageStatus({
    channel: interaction.channel,
    client: interaction.client,
    color: 0x2ecc71,
    description,
    game,
    gameLifecycle,
    playerId: member.id,
    title: 'Storyteller requested'
  })
  if (!message) return null

  game.storytellerMoveRequests ??= {}
  game.storytellerMoveRequests[member.id] = {
    ...(game.storytellerMoveRequests[member.id] || {}),
    playerNotice: {
      channelId: message.channelId,
      messageId: message.id
    }
  }
  gameLifecycle.save?.()
  return message
}

function clearStorytellerMoveRequest(game, playerId) {
  if (!game.storytellerMoveRequests) return
  delete game.storytellerMoveRequests[playerId]
}

function resolveCurrentSeatPlayerId(game, playerId) {
  if (game?.users?.[playerId]?.role === 'player') return playerId

  const replacement = Object.entries(game?.users || {}).find(([, user]) => {
    if (user?.role !== 'player') return false
    const history = user.substitutionHistory
    if (!history) return false
    if (history.originalPlayerId === playerId) return true
    return Array.isArray(history.previousPlayerIds) && history.previousPlayerIds.includes(playerId)
  })

  return replacement?.[0] || playerId
}

module.exports = {
  createStorytellerRequestInteractionSystem,
  resolveCurrentSeatPlayerId
}
