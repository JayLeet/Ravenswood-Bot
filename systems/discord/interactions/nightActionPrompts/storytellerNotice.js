const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js')
const {
  createSystemEmbed,
  extractMentions,
  respondPrivateSystem
} = require('../feedback')
const {
  updateNightCottageStatus
} = require('../nightCottageStatus')
const {
  queuedChannelSend,
  queuedMessageEdit
} = require('../../../../utils/discord/messageActions')
const {
  runRecoverableDiscordAction
} = require('../../../../utils/discord/recoverableAction')
const {
  deleteTrackedNoticeMessage,
  fetchTrackedNoticeMessage
} = require('./trackedNoticeMessages')
const {
  createNightInfoAckCustomId
} = require('../../../../utils/nightActions')
const {
  formatSubmittedResponse
} = require('../../../../utils/storytellerDashboard/nightGuidanceEntries')

async function sendOrUpdateStorytellerNightInfoNotice({
  discordClient,
  gameLifecycle,
  getDashboardPlayerLabels,
  guildId,
  isSetupComplete,
  serverConfigs,
  action
}) {
  const game = gameLifecycle.get(guildId)
  const serverConfig = serverConfigs.get(guildId)
  if (!game || !isSetupComplete(serverConfig) || !action) return null

  const channel = await recover('fetch-storyteller-channel', () => discordClient.channels.fetch(serverConfig.storytellerChannelId), {
    channelId: serverConfig.storytellerChannelId,
    guildId,
    subsystem: 'NightInfoStorytellerNotice'
  })
  if (!channel?.isTextBased?.()) return null

  const playerId = action.actorId || action.playerId
  const view = gameLifecycle.getGameView(guildId)
  const labels = view ? await getDashboardPlayerLabels(discordClient, guildId, view) : {}
  const payload = createStorytellerNightInfoPayload({ game, playerId, view, labels })
  const fetched = await fetchTrackedNoticeMessage({
    defaultChannel: channel,
    ref: game.nightInfoNoticeMessages?.[playerId],
    context: { guildId, playerId }
  })
  if (fetched.unavailable) return null
  if (fetched.stale) clearNightInfoNoticeMessage(game, gameLifecycle, playerId)
  const existing = fetched.message
  const message = existing
    ? await recover('edit-night-info-notice', () => queuedMessageEdit(existing, payload), {
      guildId,
      messageId: existing.id,
      playerId,
      subsystem: 'NightInfoStorytellerNotice'
    })
    : await recover('send-night-info-notice', () => queuedChannelSend(channel, payload), {
      channelId: channel.id,
      guildId,
      playerId,
      subsystem: 'NightInfoStorytellerNotice'
    })
  if (!message) return null

  game.nightInfoNoticeMessages ??= {}
  game.nightInfoNoticeMessages[playerId] = {
    channelId: message.channelId,
    messageId: message.id
  }
  gameLifecycle.save?.()
  return message
}

function createStorytellerNightInfoNoticeHandlers({
  gameLifecycle,
  getDashboardPlayerLabels,
  isSetupComplete,
  serverConfigs
}) {
  async function sendStorytellerChannelNotice(discordClient, guildId, message, action = null) {
    if (action) {
      return sendOrUpdateStorytellerNightInfoNotice({
        action,
        discordClient,
        gameLifecycle,
        getDashboardPlayerLabels,
        guildId,
        isSetupComplete,
        serverConfigs
      })
    }

    const serverConfig = serverConfigs.get(guildId)
    if (!isSetupComplete(serverConfig)) return null

    const channel = await recover('fetch-storyteller-channel', () => discordClient.channels.fetch(serverConfig.storytellerChannelId), {
      channelId: serverConfig.storytellerChannelId,
      guildId,
      subsystem: 'NightInfoStorytellerNotice'
    })
    if (!channel?.isTextBased()) return null

    return recover('send-night-action-notice', () => queuedChannelSend(channel, {
      content: extractMentions(message),
      embeds: [createSystemEmbed('Night Action', message, 0x9b59b6)]
    }), {
      channelId: channel.id,
      guildId,
      subsystem: 'NightInfoStorytellerNotice'
    })
  }

  function handleNightInfoAcknowledgement(interaction, parsed) {
    return acknowledgeStorytellerNightInfoNotice({
      gameLifecycle,
      interaction,
      parsed
    })
  }

  return {
    handleNightInfoAcknowledgement,
    sendStorytellerChannelNotice
  }
}

async function acknowledgeStorytellerNightInfoNotice({
  interaction,
  parsed,
  gameLifecycle
}) {
  const game = gameLifecycle.get(interaction.guild.id)
  const playerId = parsed.actionId
  if (!game || !gameLifecycle.isStoryteller(game, interaction.member.id)) {
    return respondPrivateSystem(interaction, 'Action failed', 'Only the active Storyteller can acknowledge night info.')
  }

  const ref = game.nightInfoNoticeMessages?.[playerId]
  if (interaction.message) {
    const deleted = await deleteTrackedNoticeMessage({
      context: {
        guildId: interaction.guild.id,
        playerId
      },
      message: interaction.message
    })
    if (deleted.unavailable) {
      return respondPrivateSystem(interaction, 'Action failed', 'I could not clear that night info notice yet.', 'Try Got it again in a moment.')
    }
  }
  else if (ref) {
    const fetched = await fetchTrackedNoticeMessage({
      client: interaction.client,
      ref,
      context: {
        guildId: interaction.guild.id,
        playerId
      }
    })
    if (fetched.unavailable) {
      return respondPrivateSystem(interaction, 'Action failed', 'I could not find that night info notice yet.', 'Try Got it again in a moment.')
    }
    if (fetched.message) {
      const deleted = await deleteTrackedNoticeMessage({
        context: {
          guildId: interaction.guild.id,
          playerId
        },
        message: fetched.message
      })
      if (deleted.unavailable) {
        return respondPrivateSystem(interaction, 'Action failed', 'I could not clear that night info notice yet.', 'Try Got it again in a moment.')
      }
    }
  }

  clearNightInfoNoticeMessage(game, gameLifecycle, playerId)
  await notifyPlayerSeen(interaction, game, gameLifecycle, playerId)
  return true
}

function createStorytellerNightInfoPayload({ game, playerId, view, labels }) {
  const playerLabel = labels[playerId] || `<@${playerId}>`
  const embed = createSystemEmbed(
    `Night Info: ${playerLabel}`,
    `${playerLabel} submitted night choices.`,
    0x9b59b6
  )

  const actions = getSubmittedActionsForPlayer(game, playerId)
  for (const action of actions.slice(0, 10)) {
    embed.addFields({
      name: action.roleName || view?.engine?.roleNames?.[action.roleId] || 'Night action',
      value: formatSubmittedResponse(action, view, labels) || 'Submitted.',
      inline: false
    })
  }

  if (!actions.length) {
    embed.addFields({ name: 'Choices', value: 'No submitted choices are currently pending.', inline: false })
  }

  return {
    content: game.storytellerId ? `<@${game.storytellerId}>` : undefined,
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(createNightInfoAckCustomId(playerId))
          .setLabel('Got it')
          .setStyle(ButtonStyle.Success)
      )
    ]
  }
}

function getSubmittedActionsForPlayer(game, playerId) {
  return (game.nightActions || [])
    .filter(action => action.day === game.day && action.phase === game.phase)
    .filter(action => action.status === 'submitted')
    .filter(action => (action.actorId || action.playerId) === playerId)
    .sort((a, b) => (a.submittedAt || a.createdAt || 0) - (b.submittedAt || b.createdAt || 0))
}

async function notifyPlayerSeen(interaction, game, gameLifecycle, playerId) {
  const channelId = game.nightChannels?.[playerId]
  const channel = channelId
    ? await recover('fetch-player-night-channel', () => interaction.client.channels.fetch(channelId), {
      channelId,
      guildId: interaction.guild.id,
      playerId,
      subsystem: 'NightInfoStorytellerNotice'
    })
    : null
  return updateNightCottageStatus({
    channel,
    client: interaction.client,
    color: 0x2ecc71,
    description: 'The Storyteller has seen your choices.',
    game,
    gameLifecycle,
    playerId,
    title: 'Seen by Storyteller'
  })
}

function clearNightInfoNoticeMessage(game, gameLifecycle, playerId) {
  if (!game?.nightInfoNoticeMessages?.[playerId]) return false
  delete game.nightInfoNoticeMessages[playerId]
  gameLifecycle.save?.()
  return true
}

function recover(action, fn, context = {}) {
  const { subsystem = 'NightInfoStorytellerNotice', ...rest } = context
  return runRecoverableDiscordAction(action, fn, {
    context: rest,
    subsystem
  })
}

module.exports = {
  acknowledgeStorytellerNightInfoNotice,
  createStorytellerNightInfoNoticeHandlers,
  createStorytellerNightInfoPayload,
  getSubmittedActionsForPlayer,
  sendOrUpdateStorytellerNightInfoNotice
}
