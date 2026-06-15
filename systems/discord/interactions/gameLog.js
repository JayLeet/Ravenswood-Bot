const {
  createGameLogPayload
} = require('../../../utils/gameLogSummary')
const {
  GAME_LOG_ACTIONS,
  createResolvedGameLogRows,
  isGameLogDecisionInteraction,
  parseGameLogCustomId
} = require('../../../utils/gameLogDecisions')
const {
  queuedChannelSend,
  queuedMessageEdit
} = require('../../../utils/discord/messageActions')
const {
  createBotLogger
} = require('../../../utils/logger')
const {
  acknowledgeInteraction,
  replyPrivateSystem
} = require('./feedback')
const {
  hasAdministratorOrGlobalCommandAccess
} = require('../../../utils/commandAccess')

function createGameLogInteractionSystem({
  deletePendingGameSummary,
  loadPendingGameSummary,
  serverConfigs
}) {
  const log = createBotLogger({ subsystem: 'GameLog' })

  async function handleGameLogInteraction(interaction) {
    const parsed = parseGameLogCustomId(interaction.customId)
    if (!parsed) return false

    const summary = loadPendingGameSummary?.(interaction.guild.id)
    if (!summary || summary.id !== parsed.summaryId) {
      return replyPrivateSystem(
        interaction,
        'Game history expired',
        'That ended-game summary is no longer available.',
        'Save the game log from the newest end-game summary, or start a new game.'
      )
    }

    if (parsed.action === GAME_LOG_ACTIONS.discard && !canDiscard(interaction, summary)) {
      return replyPrivateSystem(
        interaction,
        'Storyteller only',
        'Only the Storyteller, a server admin, or bot owner access user can discard the pending game history.',
        'Use Save to Game Log if you want to preserve this game.'
      )
    }

    if (parsed.action === GAME_LOG_ACTIONS.save) {
      const saved = await saveSummary(interaction, summary)
      if (!saved) return false
    }

    deletePendingGameSummary?.(interaction.guild.id)
    await acknowledgeInteraction(interaction)
    await queuedMessageEdit(interaction.message, {
      components: createResolvedGameLogRows(parsed.action)
    }).catch(err => {
      log.recoverable('mark-game-log-decision-resolved', err, {
        action: parsed.action,
        guildId: interaction.guild?.id,
        messageId: interaction.message?.id,
        summaryId: parsed.summaryId
      })
    })
    return true
  }

  async function saveSummary(interaction, summary) {
    const config = serverConfigs.get(interaction.guild.id) || {}
    const channelId = config.gameLogChannelId || config.postGameChannelId || config.liveChannelId
    const channel = channelId
      ? await interaction.client.channels.fetch(channelId).catch(err => {
          log.recoverable('fetch-game-log-channel', err, {
            channelId,
            guildId: interaction.guild?.id,
            summaryId: summary.id
          })
          return null
        })
      : null

    if (!channel?.isTextBased?.()) {
      await replyPrivateSystem(
        interaction,
        'Game log missing',
        'I could not find a channel for saved game logs.',
        'Ask an admin to rerun `/setup`, then save from the newest end-game summary.'
      )
      return false
    }

    const payload = createGameLogPayload(summary, interaction.user?.id || interaction.member?.id)
    const sent = await queuedChannelSend(channel, payload).catch(err => {
      log.recoverable('send-game-log-summary', err, {
        channelId: channel.id,
        guildId: interaction.guild?.id,
        summaryId: summary.id
      })
      return null
    })
    if (sent) return true

    await replyPrivateSystem(
      interaction,
      'Could not save log',
      `I could not post the game log in <#${channel.id}>.`,
      'Check my Send Messages and Embed Links permissions, then try Save to Game Log again.'
    )
    return false
  }

  return { handleGameLogInteraction }
}

function canDiscard(interaction, summary) {
  if (interaction.member?.id === summary.storytellerId) return true
  return hasAdministratorOrGlobalCommandAccess(interaction)
}

module.exports = {
  createGameLogInteractionSystem,
  isGameLogDecisionInteraction
}
