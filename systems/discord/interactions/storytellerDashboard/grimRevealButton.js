const {
  createGrimRevealPayload,
  parseGrimRevealCustomId
} = require('../../embeds')
const {
  acknowledgeInteraction,
  createSystemEmbed,
  editDashboardFailure
} = require('../feedback')
const {
  cleanupSetupChannels
} = require('../../../../utils/channelCleanup')
const {
  queuedChannelSend,
  queuedMessageEdit
} = require('../../../../utils/discord/messageActions')
const {
  createEndGameLogComponents
} = require('../../../../utils/gameLogEndResult')
const {
  getPostGameRevealChannel
} = require('./revealChannel')
const {
  createBotLogger
} = require('../../../../utils/logger')

const log = createBotLogger({ subsystem: 'GrimRevealButton' })

function createGrimRevealButtonHandler({
  deletePendingGameSummary = null,
  gameLifecycle,
  getDashboardPlayerLabels,
  serverConfigs = null
}) {
  return async function handleGrimRevealButton(interaction, context) {
    const reveal = parseGrimRevealCustomId(interaction.customId)
    if (!reveal) return null

    const result = await gameLifecycle.revealGrimPlayer(
      interaction.guild.id,
      interaction.member,
      reveal.playerId,
      reveal.revealId
    )

    if (!result.ok) return editDashboardFailure(interaction, result)
    await acknowledgeInteraction(interaction)

    const labels = await getDashboardPlayerLabels(interaction.client, interaction.guild.id, result.view)
    await queuedMessageEdit(interaction.message, createGrimRevealPayload(result.view, reveal.revealId, labels))
      .catch(err => {
        log.recoverable('update-grim-reveal-board', err, {
          guildId: interaction.guild?.id,
          messageId: interaction.message?.id,
          playerId: reveal.playerId,
          revealId: reveal.revealId
        })
      })

    if (result.cleanupSetupChannels) {
      await cleanupSetupChannels(interaction.client, context.serverConfig)
      await sendFinalGameLogNotice({
        deletePendingGameSummary,
        interaction,
        result,
        serverConfig: context.serverConfig,
        serverConfigs
      })
    }

    return true
  }
}

async function sendFinalGameLogNotice({
  deletePendingGameSummary,
  interaction,
  result,
  serverConfig,
  serverConfigs
}) {
  const components = await createEndGameLogComponents({
    client: interaction.client,
    deletePendingGameSummary,
    guildId: interaction.guild.id,
    result,
    serverConfigs
  })
  if (!components.length) return null

  const channel = await getPostGameRevealChannel(interaction.client, serverConfig)
  if (!isConfiguredPostGameChannel(channel, serverConfig)) return null
  if (!channel?.isTextBased?.()) return null

  return queuedChannelSend(channel, {
    embeds: [
      createSystemEmbed(
        'Game history ready',
        'The game is fully revealed. Save or discard this game history here.',
        0x3498db
      )
    ],
    components
  }).catch(err => {
    log.recoverable('send-final-game-log-notice', err, {
      channelId: channel.id,
      guildId: interaction.guild?.id,
      summaryId: result.pendingSummary?.id
    })
    return null
  })
}

function isConfiguredPostGameChannel(channel, serverConfig) {
  return Boolean(channel?.id && serverConfig?.postGameChannelId && channel.id === serverConfig.postGameChannelId)
}

module.exports = {
  isConfiguredPostGameChannel,
  createGrimRevealButtonHandler,
  sendFinalGameLogNotice
}
