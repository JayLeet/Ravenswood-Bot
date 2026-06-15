const {
  revealPostGameChannelToStoryteller
} = require('../../phaseChannelPermissions')
const {
  editDashboardFailure
} = require('../feedback')
const {
  sendRequiredMessage
} = require('../../../../utils/discord/writeIntents')
const {
  createGrimRevealNoticePayload
} = require('./grimRevealNotice')
const {
  getPostGameRevealChannel
} = require('./revealChannel')
const {
  createBotLogger
} = require('../../../../utils/logger')

const log = createBotLogger({ subsystem: 'RevealBoardPosting' })

async function postGrimRevealBoard({
  failureMessage = 'The game-ending reveal was prepared, but I could not post the Grimoire reveal board.',
  failureSuggestion = 'Check my post-game channel permissions, then refresh the dashboard.',
  gameManager,
  interaction,
  labels,
  revealId,
  serverConfig,
  view
}) {
  const revealChannel = await getPostGameRevealChannel(interaction.client, serverConfig)

  if (!view || !revealId || !revealChannel?.isTextBased?.()) {
    return createRevealBoardFailure(failureMessage, failureSuggestion)
  }

  await revealPostGameChannelToStoryteller(interaction.client, interaction.guild.id, serverConfig, gameManager)
  const sent = await sendRequiredMessage(
    revealChannel,
    createGrimRevealNoticePayload(view, revealId, labels),
    {
      failureMessage,
      failureSuggestion
    }
  )

  if (!sent.ok) return createRevealBoardFailure(failureMessage, failureSuggestion, sent.error?.cause)
  return { ok: true, message: sent.message }
}

function createRevealBoardFailure(message, suggestion, cause = null) {
  return {
    ok: false,
    error: {
      cause,
      message,
      suggestion,
      title: 'Reveal board not posted'
    }
  }
}

async function rollbackUnpostedReveal(gameLifecycle, interaction, revealId) {
  if (!revealId || typeof gameLifecycle?.cancelEndReveal !== 'function') return null
  return Promise.resolve(gameLifecycle.cancelEndReveal(interaction.guild.id, interaction.member, revealId))
    .catch(err => {
      log.recoverable('rollback-unposted-reveal', err, {
        guildId: interaction.guild?.id,
        revealId,
        userId: interaction.member?.id
      })
      return null
    })
}

function editRevealBoardFailure(interaction, result) {
  return editDashboardFailure(interaction, {
    title: result.error?.title || 'Reveal board not posted',
    message: result.error?.message || 'The reveal board could not be posted.',
    suggestion: result.error?.suggestion || 'Check my post-game channel permissions, then try again.'
  })
}

module.exports = {
  createRevealBoardFailure,
  editRevealBoardFailure,
  postGrimRevealBoard,
  rollbackUnpostedReveal
}
