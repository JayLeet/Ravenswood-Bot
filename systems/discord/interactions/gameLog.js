const {
  GAME_LOG_ACTIONS,
  createResolvedGameLogRows,
  isGameLogDecisionInteraction,
  parseGameLogCustomId
} = require('../../../utils/gameLogDecisions')
const {
  queuedMessageEdit
} = require('../../../utils/discord/messageActions')
const {
  saveGameLogSummary
} = require('../../../utils/gameLogArchive')
const {
  createBotLogger
} = require('../../../utils/logger')
const {
  acknowledgeInteraction,
  createSystemEmbed,
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

    let saved = null
    if (parsed.action === GAME_LOG_ACTIONS.save) {
      saved = await saveSummary(interaction, summary)
      if (!saved) return false
    }

    deletePendingGameSummary?.(interaction.guild.id)
    await acknowledgeInteraction(interaction)
    await queuedMessageEdit(interaction.message, {
      embeds: [createResolvedGameLogEmbed(parsed.action, saved)],
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
    const saved = await saveGameLogSummary({
      client: interaction.client,
      guildId: interaction.guild.id,
      savedByDisplayName: getInteractionDisplayName(interaction),
      savedById: interaction.user?.id || interaction.member?.id,
      serverConfigs,
      summary
    })

    if (saved.reason === 'missing-channel') {
      await replyPrivateSystem(
        interaction,
        'Game log missing',
        saved.message,
        'Ask an admin to rerun `/setup`, then save from the newest end-game summary.'
      )
      return false
    }

    if (saved.ok) return saved

    await replyPrivateSystem(
      interaction,
      'Could not save log',
      saved.message,
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

function createResolvedGameLogEmbed(action, saved = null) {
  if (action === GAME_LOG_ACTIONS.save) {
    const channelText = saved?.channel?.id
      ? `Posted the game log in <#${saved.channel.id}>.`
      : 'Posted the game log in the configured game-log channel.'
    return createSystemEmbed(
      'Game log saved',
      `${channelText}\n\nThis pending save prompt is now closed.`,
      0x2ecc71
    )
  }

  return createSystemEmbed(
    'Game history discarded',
    'The pending game history was discarded. No game-log message was posted.\n\nThis prompt is now closed.',
    0x95a5a6
  )
}

function getInteractionDisplayName(interaction) {
  return interaction.member?.displayName ||
    interaction.user?.globalName ||
    interaction.user?.username ||
    null
}

module.exports = {
  createResolvedGameLogEmbed,
  createGameLogInteractionSystem,
  isGameLogDecisionInteraction
}
