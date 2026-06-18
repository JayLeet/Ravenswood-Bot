const {
  createSystemEmbed,
  respondPrivateSystem,
  updateInteraction
} = require('./feedback')
const {
  queuedChannelSend
} = require('../../../utils/discord/messageActions')
const {
  parsePrivateVoicePublicCustomId,
  parsePrivateVoicePromptCustomId,
  parsePrivateVoiceRequestCustomId
} = require('../../../utils/privateVoiceRequests')
const {
  sendPrivateVoiceRequest
} = require('./privateVoiceRequestActions')
const {
  createPrivateVoiceNoticeButtonHandler
} = require('./privateVoiceNoticeButtons')
const {
  fetchGuildMemberWithRecoverableFallback
} = require('../../../utils/discord/recoverableFetch')
const {
  createBotLogger
} = require('../../../utils/logger')

const log = createBotLogger({ subsystem: 'PrivateVoiceRequestInteractions' })

function createPrivateVoiceRequestInteractionSystem({
  gameLifecycle,
  gameVoiceChannels
}) {
  const handlePrivateVoiceNoticeButton = createPrivateVoiceNoticeButtonHandler({ gameLifecycle })

  async function handlePrivateVoiceRequestInteraction(interaction) {
    const parsed = parsePrivateVoiceRequestCustomId(interaction.customId)
    if (!parsed) return handlePrivateVoiceNonRequestInteraction(interaction)

    if (interaction.user?.id !== parsed.targetId) {
      return respondPrivateSystem(
        interaction,
        'Not your private voice request',
        'Only the invited player can answer this private voice request.'
      )
    }

    if (parsed.action === 'reject') {
      return updateInteraction(interaction, {
        embeds: [createSystemEmbed(
          'Private voice request rejected',
          'You rejected the private voice request. No private room access changed.',
          0xe74c3c
        )],
        components: []
      })
    }

    const result = await gameVoiceChannels.ensureRequestedPrivateConversation({
      discordClient: interaction.client,
      guildId: parsed.guildId,
      ownerId: parsed.ownerId,
      invitedPlayerIds: [parsed.ownerId, parsed.targetId],
      movePlayerIds: [parsed.ownerId, parsed.targetId]
    })

    if (!result.ok) {
      return updateInteraction(interaction, {
        embeds: [createSystemEmbed(
          'Private room not opened',
          result.error?.message || 'I could not open that private voice room. Try the request again from the day notice.'
        )],
        components: []
      })
    }

    await updateInteraction(interaction, {
      embeds: [
        createSystemEmbed(
          'Private room ready',
          `You accepted the request. The private voice room is ready: <#${result.channel.id}>.`,
          0x2ecc71
        )
      ],
      components: []
    })

    await notifyRequester(interaction, parsed.requesterId, result.channel)
    return true
  }

  async function handlePrivateVoiceNonRequestInteraction(interaction) {
    const noticeResult = await handlePrivateVoiceNoticeButton(interaction)
    if (noticeResult) return noticeResult
    const publicRoom = parsePrivateVoicePublicCustomId(interaction.customId)
    if (publicRoom) return handlePrivateVoicePublicInteraction(interaction, publicRoom)
    return handlePrivateVoicePromptInteraction(interaction)
  }

  async function handlePrivateVoicePublicInteraction(interaction, parsed) {
    if (interaction.user?.id !== parsed.ownerId) {
      return respondPrivateSystem(
        interaction,
        'Only the room creator can do that',
        'Only the private room creator can open this room to all players.'
      )
    }

    const result = await gameVoiceChannels.ensureRequestedPrivateConversation({
      discordClient: interaction.client,
      guildId: parsed.guildId,
      ownerId: parsed.ownerId,
      invitedPlayerIds: [parsed.ownerId],
      movePlayerIds: [parsed.ownerId],
      publicRoom: true
    })

    if (!result.ok) {
      return updateInteraction(interaction, {
        embeds: [createSystemEmbed(
          'Private room not opened',
          result.error?.message || 'I could not open that private voice room to all players. Try again from the private voice picker.'
        )],
        components: []
      })
    }

    return updateInteraction(interaction, {
      embeds: [
        createSystemEmbed(
          'Private room opened to all players',
          `All current players can now join <#${result.channel.id}>.`,
          0x2ecc71
        )
      ],
      components: []
    })
  }

  async function handlePrivateVoicePromptInteraction(interaction) {
    const parsed = parsePrivateVoicePromptCustomId(interaction.customId)
    if (!parsed) return null

    if (interaction.user?.id !== parsed.ownerId) {
      return respondPrivateSystem(
        interaction,
        'Not your private voice picker',
        'Only the private room creator can use this player picker.'
      )
    }

    const guild = await interaction.client.guilds.fetch(parsed.guildId).catch(err => {
      log.recoverable('fetch-private-voice-prompt-guild', err, {
        guildId: parsed.guildId,
        ownerId: parsed.ownerId,
        targetId: parsed.targetId
      })
      return null
    })
    const ownerMember = guild
      ? await fetchPrivateVoiceMember(guild, parsed.ownerId, 'fetch-private-voice-prompt-owner')
      : null
    if (!guild || !ownerMember) {
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
        member: ownerMember,
        user: interaction.user
      },
      gameLifecycle,
      targetId: parsed.targetId,
      roomOwnerId: parsed.ownerId
    })

    if (!result.ok) {
      return updateInteraction(interaction, {
        embeds: [createSystemEmbed(
          'Private voice request not sent',
          result.error?.message || 'I could not send that private voice request. Try again from the private voice picker.'
        )],
        components: []
      })
    }

    return updateInteraction(interaction, {
      embeds: [createSystemEmbed(
        'Private voice request sent',
        `I sent <@${parsed.targetId}> a private voice request. They need to accept before the room opens.`,
        0x2ecc71
      )],
      components: []
    })
  }

  return {
    handlePrivateVoiceRequestInteraction
  }
}

async function notifyRequester(interaction, requesterId, channel) {
  const guildId = channel.guildId || interaction.guildId
  const guild = await interaction.client.guilds.fetch(guildId).catch(err => {
    log.recoverable('fetch-private-voice-requester-guild', err, {
      guildId,
      requesterId
    })
    return null
  })
  const requester = guild
    ? await fetchPrivateVoiceMember(guild, requesterId, 'fetch-private-voice-requester')
    : null
  const dm = await requester?.createDM?.().catch(err => {
    log.recoverable('create-private-voice-requester-dm', err, {
      guildId,
      requesterId
    })
    return null
  })
  if (!dm) return null

  return queuedChannelSend(dm, {
    embeds: [
      createSystemEmbed(
        'Private voice request accepted',
        `They accepted. Your private voice room is ready: <#${channel.id}>.`,
        0x2ecc71
      )
    ]
  }).catch(err => {
    log.recoverable('send-private-voice-requester-dm', err, {
      guildId,
      requesterId
    })
    return null
  })
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
  createPrivateVoiceRequestInteractionSystem
}
