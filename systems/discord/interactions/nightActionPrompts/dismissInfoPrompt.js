const {
  queuedMessageDelete
} = require('../../../../utils/discord/messageActions')
const {
  clearNightInfoPromptRef
} = require('../nightPromptMessages')
const {
  NIGHT_COTTAGE_STATUS_PROMPT_KEY,
  clearNightCottageStatusRef
} = require('../nightCottageStatus')
const {
  PLAYER_ONLY_NIGHT_BUTTON_MESSAGE
} = require('../nightActionPromptSubmissions')
const {
  resolveTestPlayerInteractionMember
} = require('../testPlayerSimulation')

async function handleNightInfoPromptDismiss({ gameLifecycle, interaction, logger, parsed, sendFailure }) {
  const game = gameLifecycle.get(interaction.guild.id)
  const playerId = parsed.actionId
  const promptKey = parsed.value
  if (!game || !promptKey) {
    return sendFailure(interaction, interaction.member.id, 'That night info prompt is no longer available.')
  }
  const view = gameLifecycle.getGameView?.(interaction.guild.id)
  const member = resolveTestPlayerInteractionMember({
    game,
    gameLifecycle,
    interaction,
    playerId,
    view
  })
  const userId = member?.id || interaction.member.id

  if (gameLifecycle.getRole?.(game, userId) !== 'player') {
    return sendFailure(interaction, userId, PLAYER_ONLY_NIGHT_BUTTON_MESSAGE)
  }
  if (userId !== playerId) {
    return sendFailure(interaction, userId, 'Only the woken player can use this prompt.')
  }

  const ref = interaction.message
    ? { channelId: interaction.message.channelId, messageId: interaction.message.id }
    : null
  if (interaction.message) {
    const deleted = await queuedMessageDelete(interaction.message, 'BOTC player acknowledged night info').catch(err => {
      logger?.recoverable?.('dismiss-night-info-prompt-message', err, {
        channelId: interaction.message?.channelId,
        guildId: interaction.guild?.id,
        messageId: interaction.message?.id,
        playerId,
        promptKey
      })
      return false
    })
    if (deleted === false) {
      return sendFailure(interaction, userId, 'I could not clear that night info prompt yet.', 'Try Got it again in a moment.')
    }
  }

  const cleared = promptKey === NIGHT_COTTAGE_STATUS_PROMPT_KEY
    ? clearNightCottageStatusRef(game, playerId, ref)
    : clearNightInfoPromptRef(game, playerId, promptKey, ref)
  if (cleared) gameLifecycle.save?.()
  return true
}

module.exports = {
  handleNightInfoPromptDismiss
}
