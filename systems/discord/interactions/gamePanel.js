const { GAME_PANEL_ACTIONS, createGamePanelPayload } = require('../embeds')
const {
  formatFailureMessage,
  getFailureSuggestion
} = require('../../../utils/failureSuggestions')
const { cleanupSetupChannels } = require('../../../utils/channelCleanup')
const {
  createPayloadSignature
} = require('../../../utils/discord/payloadSignature')
const {
  editExistingPanel,
  sendRequiredMessage
} = require('../../../utils/discord/writeIntents')
const { runRecoverableDiscordAction } = require('../../../utils/discord/recoverableAction')
const {
  acknowledgeInteraction,
  createSystemEmbed,
  deleteInteractionReply,
  deferPrivateReply,
  editInteractionReply,
  replyPrivateSystem
} = require('./feedback')
const {
  createGamePanelActionRunner
} = require('./gamePanelActions')
const {
  getGamePanelCommandName
} = require('./gamePanelCommandNames')
const {
  sendGamePanelNotices
} = require('./gamePanelNotices')
const {
  clearTrackedPanelMessage,
  fetchConfiguredPanelChannel,
  fetchTrackedPanelMessage,
  pruneMessageSignatures
} = require('./panelMessageRefs')
const { hasVisibleAdminInteractionDiagnostic } = require('./adminDiagnostics')

const PANEL_FEEDBACK_DELETE_DELAY_MS = 3000

function createGamePanelSystem({
  serverConfigs,
  saveServerConfigs,
  gameLifecycle,
  gameManager,
  isSetupComplete,
  createSetupRequiredMessage,
  ensureConfiguredServerReady,
  services = {}
}) {
  const runGamePanelAction = createGamePanelActionRunner({ gameLifecycle, gameManager })
  const messageSignatures = new Map()
  const subsystem = 'GamePanel'
  const sendNotices = (interaction, serverConfig, result) =>
    sendGamePanelNotices(interaction, serverConfig, result, { gameLifecycle, subsystem })

  async function postOrUpdateGamePanel(discordClient, guildId) {
    const serverConfig = serverConfigs.get(guildId)
    if (!isSetupComplete(serverConfig)) return null

    const fetchedChannel = await fetchConfiguredPanelChannel({
      action: 'fetch-game-panel-channel',
      channelId: serverConfig.gameChannelId,
      client: discordClient,
      configKeys: ['gameChannelId', 'gamePanelMessageId'],
      context: {
        guildId
      },
      guildId,
      saveServerConfigs,
      serverConfig,
      serverConfigs,
      subsystem
    })
    const channel = fetchedChannel.channel

    if (!channel) return null

    const payload = createGamePanelPayload()
    const signature = createPayloadSignature(payload)
    let message = null

    if (serverConfig.gamePanelMessageId) {
      const fetched = await fetchTrackedPanelMessage({
        action: 'fetch-game-panel-message',
        channel,
        context: {
          guildId
        },
        messageId: serverConfig.gamePanelMessageId,
        subsystem
      })
      if (fetched.unavailable) return null
      message = fetched.message
      if (fetched.stale) clearTrackedPanelMessage({
        configKey: 'gamePanelMessageId',
        guildId,
        saveServerConfigs,
        serverConfig,
        serverConfigs
      })
      if (message) {
        if (messageSignatures.get(message.id) === signature) return message
        const updated = await editExistingPanel(message, payload, {
          failureMessage: 'Game panel could not be updated.',
          failureSuggestion: 'Use dashboard Refresh or rerun `/setup` if the panel is missing.'
        })
        await logWriteFailure('edit-game-panel', updated, { guildId, messageId: message.id, subsystem })
        if (updated.ok) {
          messageSignatures.set(updated.message.id, signature)
          return updated.message
        }
      }
    }

    const posted = await sendRequiredMessage(channel, payload, {
      failureMessage: 'Game panel could not be posted.',
      failureSuggestion: 'Check my Send Messages and Embed Links permissions in the game panel channel.'
    })
    await logWriteFailure('send-game-panel', posted, { channelId: channel.id, guildId, subsystem })
    message = posted.message
    if (!message) return null

    messageSignatures.set(message.id, signature)
    serverConfig.gamePanelMessageId = message.id
    serverConfigs.set(guildId, serverConfig)
    saveServerConfigs(serverConfigs)

    return message
  }

  async function handleGamePanelInteraction(interaction) {
    const serverConfig = serverConfigs.get(interaction.guild.id)

    if (!isSetupComplete(serverConfig)) {
      return replyPrivateSystem(
        interaction,
        'Setup required',
        createSetupRequiredMessage(),
        'Ask an admin to run `/setup`, then use the game panel it posts.'
      )
    }

    if (interaction.channelId !== serverConfig.gameChannelId) {
      return replyPrivateSystem(
        interaction,
        'Wrong channel',
        `Use the game panel in <#${serverConfig.gameChannelId}>.`,
        `Go to <#${serverConfig.gameChannelId}> and press the button there.`
      )
    }

    await acknowledgeGamePanelInteraction(interaction)

    const readiness = await ensureConfiguredServerReady(interaction, serverConfig)

    if (!readiness.ok) {
      return editInteractionReply(interaction, {
        embeds: [
          createSystemEmbed(
            readiness.title,
            formatFailureMessage(readiness.message, readiness.suggestion)
          )
        ]
      })
    }

    const result = await runGamePanelAction(interaction, serverConfig)

    if (!result.ok) return handleFailedGamePanelAction(interaction, result)

    if (!hasVisibleAdminInteractionDiagnostic(interaction)) {
      await editInteractionReply(interaction, {
        embeds: result.embeds || [
          createSystemEmbed(result.privateTitle || 'Done', result.message || 'Done', 0x2ecc71)
        ],
        components: result.components || []
      })
      if (!result.embeds) schedulePanelFeedbackCleanup(interaction)
    }

    if (result.cleanupSetupChannels) {
      await cleanupSetupChannels(interaction.client, serverConfig)
    }

    if (result.refreshStorytellerDashboard) {
      await refreshStorytellerDashboard(interaction, services)
    }

    await sendNotices(interaction, serverConfig, result)
  }

  function getRuntimeState() {
    const removedMessageSignatures = pruneMessageSignatures(messageSignatures, serverConfigs, 'gamePanelMessageId')
    return {
      messageSignatures: messageSignatures.size,
      removedMessageSignatures
    }
  }

  async function handleFailedGamePanelAction(interaction, result) {
    const suggestion = getFailureSuggestion({
      interaction,
      ctx: { gameLifecycle },
      error: result.error,
      commandName: getGamePanelCommandName(interaction.customId)
    })

    const updated = await editInteractionReply(interaction, {
      embeds: [
        createSystemEmbed(
          'Action failed',
          formatFailureMessage(result.error?.message || 'Unknown error', suggestion)
        )
      ]
    })
    return updated
  }

  return {
    getRuntimeState,
    handleGamePanelInteraction,
    postOrUpdateGamePanel,
    sendGamePanelNotices: sendNotices
  }
}

function acknowledgeGamePanelInteraction(interaction) {
  return shouldUpdateExistingGamePanelReply(interaction.customId)
    ? acknowledgeInteraction(interaction)
    : deferPrivateReply(interaction)
}

function shouldUpdateExistingGamePanelReply(customId) {
  return customId === GAME_PANEL_ACTIONS.createClocktowerOnlineGame ||
    customId === GAME_PANEL_ACTIONS.createDiscordOnlyGame
}

function refreshStorytellerDashboard(interaction, services = {}) {
  if (typeof services.postOrUpdateStorytellerDashboard !== 'function') return null
  return recoverDiscord(
    'refresh-storyteller-dashboard',
    () => services.postOrUpdateStorytellerDashboard(interaction.client, interaction.guild.id),
    { guildId: interaction.guild.id, subsystem: 'GamePanel' }
  )
}

function schedulePanelFeedbackCleanup(interaction) {
  if (hasVisibleAdminInteractionDiagnostic(interaction)) return
  setTimeout(() => deleteInteractionReply(interaction).catch(() => null), PANEL_FEEDBACK_DELETE_DELAY_MS)
}

function logWriteFailure(action, result, context) {
  if (result?.ok || !result?.error) return null
  return recoverDiscord(action, () => {
    throw result.error.cause || new Error(result.error.message)
  }, { ...context, failureMessage: result.error.message })
}

function recoverDiscord(action, fn, context = {}) {
  const { subsystem = 'GamePanel', ...rest } = context
  return runRecoverableDiscordAction(action, fn, {
    context: rest,
    subsystem
  })
}

module.exports = {
  PANEL_FEEDBACK_DELETE_DELAY_MS, acknowledgeGamePanelInteraction, createGamePanelSystem,
  pruneMessageSignatures, refreshStorytellerDashboard, shouldUpdateExistingGamePanelReply
}
