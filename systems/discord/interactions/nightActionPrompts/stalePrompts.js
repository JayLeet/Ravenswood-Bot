const {
  isStaleMessageError,
  queuedMessageEdit
} = require('../../../../utils/discord/messageActions')
const {
  isMissingChannelError
} = require('../../../../utils/discord/interactionErrors')
const {
  isProtectedRoleInfoAction
} = require('../nightPromptMessages')

async function disableStaleNightActionPrompts(discordClient, game, logger = null, gameLifecycle = null) {
  let disabled = 0
  let refsCleared = 0
  const currentNight = game.state === 'in-game' && game.phase === 'night'

  for (const action of game.nightActions || []) {
    const ref = getActionPromptRef(action)
    if (!ref) continue
    if (isProtectedRoleInfoAction(action)) continue

    const stillAwaiting =
      currentNight &&
      action.status === 'awaiting_target' &&
      action.day === game.day &&
      action.phase === game.phase

    if (stillAwaiting) continue
    if (isPromptRefUsedByCurrentAction(game, action, ref)) {
      refsCleared += clearStalePromptRefs(game, action, ref)
      continue
    }

    if (!discordClient?.channels?.fetch) {
      logger?.recoverable?.('fetch-stale-night-prompt-channel-unavailable', new Error('Discord client channel API unavailable'), {
        actionId: action.id,
        channelId: ref.channelId,
        guildId: game.guildId,
        messageId: ref.messageId
      })
      continue
    }

    const channel = await discordClient.channels
      .fetch(ref.channelId)
      .catch(err => {
        if (isMissingChannelError(err)) return null
        logger?.recoverable?.('fetch-stale-night-prompt-channel', err, {
          actionId: action.id,
          channelId: ref.channelId,
          guildId: game.guildId
        })
        return false
      })

    if (channel === false) continue
    if (!channel) {
      refsCleared += clearStalePromptRefs(game, action, ref)
      continue
    }

    if (!channel?.messages?.fetch) {
      logger?.recoverable?.('fetch-stale-night-prompt-message-unavailable', new Error('Channel message API unavailable'), {
        actionId: action.id,
        channelId: ref.channelId,
        guildId: game.guildId,
        messageId: ref.messageId
      })
      continue
    }

    const message = await channel.messages
      .fetch(ref.messageId)
      .catch(err => {
        if (isStaleMessageError(err)) return null
        logger?.recoverable?.('fetch-stale-night-prompt-message', err, {
          actionId: action.id,
          channelId: ref.channelId,
          guildId: game.guildId,
          messageId: ref.messageId
        })
        return false
      })

    if (message === false) continue
    if (!message) {
      refsCleared += clearStalePromptRefs(game, action, ref)
      continue
    }

    const updated = await queuedMessageEdit(message, { components: [] }).catch(err => {
      logger?.recoverable?.('disable-stale-night-prompt-message', err, {
        actionId: action.id,
        channelId: ref.channelId,
        guildId: game.guildId,
        messageId: ref.messageId
      })
      return null
    })
    if (updated) {
      disabled += 1
      refsCleared += clearStalePromptRefs(game, action, ref)
    }
  }

  if (refsCleared > 0) gameLifecycle?.save?.()
  return disabled
}

function getActionPromptRef(action) {
  if (!action?.promptChannelId || !action?.promptMessageId) return null
  return { channelId: action.promptChannelId, messageId: action.promptMessageId }
}

function isPromptRefUsedByCurrentAction(game, staleAction, ref) {
  return (game.nightActions || []).some(action => {
    if (action === staleAction) return false
    if (action.status !== 'awaiting_target') return false
    if (action.day !== game.day || action.phase !== game.phase) return false
    return action.promptChannelId === ref.channelId && action.promptMessageId === ref.messageId
  })
}

function clearStalePromptRefs(game, action, ref) {
  let cleared = 0

  if (action.promptChannelId || action.promptMessageId) {
    delete action.promptChannelId
    delete action.promptMessageId
    cleared += 1
  }

  const playerId = action.actorId || action.playerId
  const storedRef = game?.nightPromptMessages?.[playerId]
  if (storedRef?.channelId === ref.channelId &&
    storedRef?.messageId === ref.messageId &&
    !isPromptRefUsedByCurrentAction(game, action, ref)) {
    delete game.nightPromptMessages[playerId]
    cleared += 1
  }

  return cleared
}

module.exports = {
  disableStaleNightActionPrompts
}
