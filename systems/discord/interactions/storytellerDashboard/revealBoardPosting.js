const {
  revealPostGameChannelToStoryteller
} = require('../../phaseChannelPermissions')
const {
  cleanupPostGameChannelMessages
} = require('../../../../utils/channelCleanup')
const {
  editDashboardFailure
} = require('../feedback')
const {
  sendRequiredMessage
} = require('../../../../utils/discord/writeIntents')
const {
  queuedMessageEdit
} = require('../../../../utils/discord/messageActions')
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
  cleanupExisting = true,
  existingMessageRef = null,
  serverConfig,
  view
}) {
  const revealChannel = await getPostGameRevealChannel(interaction.client, serverConfig)

  if (!view || !revealId || !revealChannel?.isTextBased?.()) {
    return createRevealBoardFailure(failureMessage, failureSuggestion)
  }

  await revealPostGameChannelToStoryteller(interaction.client, interaction.guild.id, serverConfig, gameManager)
  const payload = createGrimRevealNoticePayload(view, revealId, labels)
  const edited = await editExistingRevealBoard(revealChannel, existingMessageRef, payload)
  if (edited) return { ok: true, message: edited, reused: true }

  if (cleanupExisting && revealChannel.id === serverConfig?.postGameChannelId) {
    await cleanupPostGameChannelMessages(interaction.client, serverConfig)
  }
  const sent = await sendRequiredMessage(
    revealChannel,
    payload,
    {
      failureMessage,
      failureSuggestion
    }
  )

  if (!sent.ok) return createRevealBoardFailure(failureMessage, failureSuggestion, sent.error?.cause)
  return { ok: true, message: sent.message }
}

async function editExistingRevealBoard(channel, existingMessageRef, payload) {
  if (!existingMessageRef?.boardMessageId) return null
  const refChannelId = existingMessageRef.boardChannelId || existingMessageRef.channelId
  if (refChannelId && refChannelId !== channel.id) return null
  if (typeof channel?.messages?.fetch !== 'function') return null

  const message = await channel.messages.fetch(existingMessageRef.boardMessageId).catch(err => {
    log.recoverable('fetch-existing-grim-reveal-board', err, {
      channelId: channel.id,
      guildId: channel.guildId || channel.guild?.id,
      messageId: existingMessageRef.boardMessageId,
      revealId: existingMessageRef.id
    })
    return null
  })
  if (!message) return null

  return queuedMessageEdit(message, payload).catch(err => {
    log.recoverable('edit-existing-grim-reveal-board', err, {
      channelId: channel.id,
      guildId: channel.guildId || channel.guild?.id,
      messageId: message.id,
      revealId: existingMessageRef.id
    })
    return null
  })
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
  editExistingRevealBoard,
  editRevealBoardFailure,
  postGrimRevealBoard,
  rollbackUnpostedReveal
}
