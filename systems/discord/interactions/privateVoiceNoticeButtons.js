const {
  createSystemEmbed,
  respondPrivatePayload,
  respondPrivateSystem,
  updateInteraction
} = require('./feedback')
const {
  createPrivateVoiceTargetRows,
  parsePrivateVoiceInvitePromptCustomId,
  parsePrivateVoiceNoticeCustomId,
  parsePrivateVoiceNoticeSimulationActorCustomId,
  parsePrivateVoiceNoticeSimulationTargetCustomId
} = require('../../../utils/privateVoiceRequests')
const {
  getPrivateVoicePlayerChoices,
  sendPrivateVoiceRequest
} = require('./privateVoiceRequestActions')
const {
  findPrivateConversationOwnerByChannel
} = require('./voiceChannels/dayPrivateAccess')
const {
  createTestPrivateVoiceSimulationPayload,
  handleTestPrivateVoiceSimulationActorSelect,
  handleTestPrivateVoiceSimulationTargetSelect
} = require('./privateVoiceTestSimulation')
const {
  fetchGuildMemberWithRecoverableFallback
} = require('../../../utils/discord/recoverableFetch')
const {
  createBotLogger
} = require('../../../utils/logger')

const log = createBotLogger({ subsystem: 'PrivateVoiceNoticeButtons' })

function createPrivateVoiceNoticeButtonHandler({ gameLifecycle, gameVoiceChannels = null }) {
  return async function handlePrivateVoiceNoticeButton(interaction) {
    const notice = parsePrivateVoiceNoticeCustomId(interaction.customId)
    if (notice) return handlePrivateVoiceNoticeInteraction(interaction, notice, { gameLifecycle, gameVoiceChannels })

    const invitePrompt = parsePrivateVoiceInvitePromptCustomId(interaction.customId)
    if (invitePrompt) return handlePrivateVoiceInvitePromptInteraction(interaction, invitePrompt, gameLifecycle)

    const simulationActor = parsePrivateVoiceNoticeSimulationActorCustomId(interaction.customId)
    if (simulationActor) return handleTestPrivateVoiceSimulationActorSelect(interaction, simulationActor, gameLifecycle)

    const simulationTarget = parsePrivateVoiceNoticeSimulationTargetCustomId(interaction.customId)
    if (simulationTarget) {
      return handleTestPrivateVoiceSimulationTargetSelect(interaction, simulationTarget, {
        gameLifecycle,
        gameVoiceChannels
      })
    }

    return null
  }
}

async function handlePrivateVoiceNoticeInteraction(interaction, parsed, { gameLifecycle, gameVoiceChannels }) {
  const game = gameLifecycle.get(interaction.guild.id)
  const simulationPayload = createTestPrivateVoiceSimulationPayload({
    action: parsed.action,
    game,
    gameLifecycle,
    interaction
  })
  if (simulationPayload) return respondPrivatePayload(interaction, simulationPayload)

  const requesterId = interaction.member?.id || interaction.user?.id
  if (gameLifecycle.getRole?.(game, requesterId) !== 'player') {
    return respondPrivateSystem(
      interaction,
      'Only players can use this button',
      'Start Private Voice and Invite to Room are player controls during real games.'
    )
  }

  const ownerId = parsed.action === 'invite'
    ? findPrivateConversationOwnerByChannel(game, interaction.member?.voice?.channelId)
    : requesterId

  if (!ownerId) {
    return respondPrivateSystem(
      interaction,
      'Join a private room first',
      'Use this button while connected to a bot-made private voice room, or use Start Private Voice to begin a new request.'
    )
  }

  const payload = createPrivateVoicePickerPayload({
    description: parsed.action === 'invite'
      ? 'Choose a player to invite into your current private voice room.'
      : 'Choose a player to request a private day voice chat with.',
    gameLifecycle,
    interaction,
    ownerId,
    requesterId,
    title: parsed.action === 'invite' ? 'Invite to private voice' : 'Start private voice'
  })
  if (!payload) {
    return respondPrivateSystem(
      interaction,
      'No available players',
      'There are no current players available for this private voice request.'
    )
  }
  return respondPrivatePayload(interaction, payload)
}

async function handlePrivateVoiceInvitePromptInteraction(interaction, parsed, gameLifecycle) {
  if (interaction.user?.id !== parsed.requesterId) {
    return respondPrivateSystem(
      interaction,
      'Not your private voice picker',
      'Only the player who opened this picker can use it.',
      'Open your own private voice picker from the day notice or your private room.'
    )
  }

  const guild = await interaction.client.guilds.fetch(parsed.guildId).catch(err => {
    log.recoverable('fetch-private-voice-invite-prompt-guild', err, {
      guildId: parsed.guildId,
      ownerId: parsed.ownerId,
      requesterId: parsed.requesterId,
      targetId: parsed.targetId
    })
    return null
  })
  const requesterMember = guild
    ? await fetchPrivateVoiceMember(guild, parsed.requesterId, 'fetch-private-voice-invite-prompt-requester')
    : null
  if (!guild || !requesterMember) {
    return updateInteraction(interaction, {
      embeds: [createSystemEmbed(
        'Private room no longer available',
        'I could not find the private room owner anymore. The room may have closed or the game state changed.'
      )],
      components: []
    })
  }

  const result = await sendPrivateVoiceRequest({
    interaction: {
      ...interaction,
      guild,
      member: requesterMember,
      user: interaction.user
    },
    gameLifecycle,
    targetId: parsed.targetId,
    roomOwnerId: parsed.ownerId
  })

  if (!result.ok) {
    return updateInteraction(interaction, {
      embeds: [createSystemEmbed(
        'Private voice invite not sent',
        result.error?.message || 'I could not send that private voice request. Try again from inside the private room.'
      )],
      components: []
    })
  }

  return updateInteraction(interaction, {
    embeds: [createSystemEmbed(
      'Private voice invite sent',
      `I sent <@${parsed.targetId}> an invite to this private voice room. They need to accept before their access changes.`,
      0x2ecc71
    )],
    components: []
  })
}

function createPrivateVoicePickerPayload({
  description,
  gameLifecycle,
  interaction,
  ownerId,
  requesterId,
  title
}) {
  const players = getPrivateVoicePlayerChoices(
    {
      guild: interaction.guild,
      member: { id: requesterId },
      options: { getFocused: () => '' }
    },
    gameLifecycle,
    { roomOwnerId: ownerId }
  ).map(choice => ({
    id: choice.value,
    label: choice.name
  }))
  if (!players.length) return null

  return {
    embeds: [createSystemEmbed(title, description, 0x3498db)],
    components: createPrivateVoiceTargetRows({
      guildId: interaction.guild.id,
      includePublicButton: ownerId === requesterId,
      ownerId,
      players,
      requesterId
    })
  }
}

function fetchPrivateVoiceMember(guild, userId, action) {
  return fetchGuildMemberWithRecoverableFallback({
    action,
    guild,
    logger: log,
    userId
  })
}

module.exports = {
  createPrivateVoiceNoticeButtonHandler
}
