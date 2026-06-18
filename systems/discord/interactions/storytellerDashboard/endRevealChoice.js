const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js')
const {
  createGrimRevealPayload
} = require('../../embeds')
const {
  editDashboardFailure,
  editDashboardLifecycleFailure,
  acknowledgeInteraction,
  replyPrivatePayload
} = require('../feedback')
const {
  cleanupSetupChannels
} = require('../../../../utils/channelCleanup')
const {
  queuedMessageEdit
} = require('../../../../utils/discord/messageActions')
const {
  createEndGameLogComponents
} = require('../../../../utils/gameLogEndResult')
const {
  WINNER_OPTIONS,
  createEndRevealCancelledPayload,
  createEndRevealCustomId,
  revealWinningTeam
} = require('./endGameReveal')
const {
  getPostGameRevealChannel
} = require('./revealChannel')
const {
  createBotLogger
} = require('../../../../utils/logger')

const log = createBotLogger({ subsystem: 'EndRevealChoice' })

async function handleEndRevealChoice(interaction, context, reveal, deps) {
  const { choice, revealId } = reveal
  const {
    gameLifecycle,
    gameManager,
    getDashboardPlayerLabels,
    revealWinningTeamFn = revealWinningTeam,
    setPostGameStorytellerView
  } = deps

  if (choice === 'cancel') {
    return cancelReveal(interaction, context, revealId, {
      gameLifecycle,
      gameManager,
      setPostGameStorytellerView
    })
  }

  if (choice === 'override_cancel') {
    return replyPrivatePayload(interaction, createOverrideCancelledPayload())
  }

  const override = parseOverrideChoice(choice)
  const winnerChoice = override?.winner || choice
  const option = WINNER_OPTIONS[winnerChoice]
  if (!option) {
    return editDashboardFailure(interaction, {
      title: 'Unknown winner',
      message: 'That winner choice is not recognized.',
      suggestion: 'Open End Game again and choose one of the listed buttons.'
    })
  }

  const revealState = gameLifecycle.get?.(interaction.guild.id)?.pendingEndReveal || context.view?.pendingEndReveal || null
  if (!override && shouldPrivatelyWarnWrongWinner(revealState, winnerChoice)) {
    return replyPrivatePayload(interaction, createWrongWinnerWarningPayload(winnerChoice, revealId, revealState))
  }

  return chooseWinner(interaction, context, revealId, winnerChoice, {
    allowForcedOverride: Boolean(override),
    deletePendingGameSummary: deps.deletePendingGameSummary,
    gameLifecycle,
    getDashboardPlayerLabels,
    revealWinningTeamFn,
    serverConfigs: deps.serverConfigs
  })
}

async function cancelReveal(interaction, context, revealId, deps) {
  const result = deps.gameLifecycle.cancelEndReveal(interaction.guild.id, interaction.member, revealId)
  if (!result.ok) return editDashboardLifecycleFailure(interaction, result)
  await acknowledgeInteraction(interaction)
  await deps.setPostGameStorytellerView?.(
    interaction.client,
    interaction.guild.id,
    context.serverConfig,
    deps.gameManager,
    false
  )
  await queuedMessageEditIfPresent(interaction.message, createEndRevealCancelledPayload())
  return true
}

async function chooseWinner(interaction, context, revealId, winnerChoice, deps) {
  if (deps.allowForcedOverride) clearForcedWinnerLock(deps.gameLifecycle, interaction.guild.id)

  const result = await deps.gameLifecycle.endGameWithWinner(interaction.guild.id, interaction.member, winnerChoice, revealId)
  if (!result.ok) return editDashboardLifecycleFailure(interaction, result)
  await acknowledgeInteraction(interaction)

  const labels = result.view
    ? await deps.getDashboardPlayerLabels(interaction.client, interaction.guild.id, result.view)
    : {}
  if (result.view) {
    await queuedMessageEditIfPresent(interaction.message, createGrimRevealPayload(result.view, revealId, labels))
  }

  if (result.cleanupSetupChannels) await cleanupSetupChannels(interaction.client, context.serverConfig)

  const revealChannel = await getPostGameRevealChannel(interaction.client, context.serverConfig)
  const gameLogComponents = result.cleanupSetupChannels && isConfiguredPostGameChannel(revealChannel, context.serverConfig)
    ? await createEndGameLogComponents({
      client: interaction.client,
      deletePendingGameSummary: deps.deletePendingGameSummary,
      guildId: interaction.guild.id,
      result,
      serverConfig: context.serverConfig,
      serverConfigs: deps.serverConfigs
    })
    : []

  await deps.revealWinningTeamFn(revealChannel, winnerChoice, undefined, {
    components: gameLogComponents,
    playerLabels: labels,
    revealId,
    view: result.view
  })

  return true
}

function clearForcedWinnerLock(gameLifecycle, guildId) {
  const game = gameLifecycle.get?.(guildId)
  if (!game?.pendingEndReveal) return
  game.pendingEndReveal.forcedWinner = null
  game.pendingEndReveal.forcedReason = null
  game.pendingEndReveal.overriddenWinnerLock = true
  gameLifecycle.save?.()
}

function shouldPrivatelyWarnWrongWinner(revealState, winnerChoice) {
  return Boolean(revealState?.forcedWinner && revealState.forcedWinner !== winnerChoice)
}

function parseOverrideChoice(choice) {
  const prefix = 'override_'
  if (!String(choice || '').startsWith(prefix)) return null
  return { winner: String(choice).slice(prefix.length) }
}

function createWrongWinnerWarningPayload(winnerChoice, revealId, revealState) {
  const forcedWinner = revealState.forcedWinner
  return {
    embeds: [new EmbedBuilder()
      .setTitle('This does not match the automatic winner')
      .setDescription([
        `The game state says **${formatWinner(forcedWinner)}** won.`,
        `You pressed **${formatWinner(winnerChoice)} Won**.`,
        '',
        'Continue only if the Storyteller is intentionally overriding the automatic result.'
      ].join('\n'))
      .setColor(0xe67e22)
      .setTimestamp()],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(createEndRevealCustomId(`override_${winnerChoice}`, revealId))
        .setLabel('Continue anyways?')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(createEndRevealCustomId('override_cancel', revealId))
        .setLabel('Cancel!')
        .setStyle(ButtonStyle.Secondary)
    )]
  }
}

function createOverrideCancelledPayload() {
  return {
    embeds: [new EmbedBuilder()
      .setTitle('Cancelled')
      .setDescription('The public reveal was not changed.')
      .setColor(0x95a5a6)
      .setTimestamp()],
    components: []
  }
}

function formatWinner(winner) {
  if (winner === 'good') return 'Good'
  if (winner === 'evil') return 'Evil'
  return String(winner || 'chosen')
}

async function queuedMessageEditIfPresent(message, payload) {
  if (!message?.edit) return null
  return queuedMessageEdit(message, payload).catch(err => {
    log.recoverable('edit-end-reveal-choice-message', err, {
      channelId: message.channelId || message.channel?.id,
      guildId: message.guildId || message.guild?.id,
      messageId: message.id
    })
    return null
  })
}

function isConfiguredPostGameChannel(channel, serverConfig) {
  return Boolean(channel?.id && serverConfig?.postGameChannelId && channel.id === serverConfig.postGameChannelId)
}

module.exports = {
  clearForcedWinnerLock,
  createOverrideCancelledPayload,
  createWrongWinnerWarningPayload,
  handleEndRevealChoice,
  isConfiguredPostGameChannel,
  queuedMessageEditIfPresent,
  shouldPrivatelyWarnWrongWinner
}
