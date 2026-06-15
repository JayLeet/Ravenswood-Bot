const {
  GAME_PANEL_ACTIONS,
  STORYTELLER_DASHBOARD_ACTIONS
} = require('../embeds')
const {
  isRequestDecisionInteraction
} = require('../../../utils/requestDecisionButtons')
const {
  isStorytellerRequestInteraction
} = require('../../../utils/storytellerRequestButtons')
const {
  replyPrivateSystem
} = require('./feedback')

const PAUSED_STORYTELLER_COMMANDS = new Set(['requests', 'approve', 'reject', 'end-game', 'resume', 'leave'])
const PAUSED_PUBLIC_COMMANDS = new Set(['join', 'spectate', 'leave'])
const PAUSED_GAME_PANEL_ACTIONS = new Set([
  GAME_PANEL_ACTIONS.join,
  GAME_PANEL_ACTIONS.spectate,
  GAME_PANEL_ACTIONS.leave
])

function guardPausedReplacementInteraction(interaction, gameLifecycle) {
  if (!isComponentInteraction(interaction)) return null
  const game = gameLifecycle.get?.(interaction.guild?.id)
  if (!game?.paused) return null
  if (isPauseAllowedInteraction(interaction.customId)) return null
  return replyPrivateSystem(
    interaction,
    'Game paused',
    'A replacement player is needed before the game can continue.',
    'Join, Spectate, Leave, Requests, Approve, Reject, End Game, and Resume are the only usable controls during pause.'
  )
}

function guardPausedReplacementCommand(interaction, gameLifecycle) {
  const game = gameLifecycle.get?.(interaction.guild?.id)
  if (!game?.paused) return null
  if (isPauseAllowedCommand(game, interaction.member?.id, interaction.commandName)) return null
  return replyPrivateSystem(
    interaction,
    'Game paused',
    'A replacement player is needed before the game can continue.',
    'Use `/join`, `/spectate`, or `/leave`. Storytellers may also use `/requests`, `/approve`, `/reject`, `/end-game`, or `/resume`.'
  )
}

function isComponentInteraction(interaction) {
  return interaction.isButton?.() || interaction.isStringSelectMenu?.() || interaction.isModalSubmit?.()
}

function isPauseAllowedInteraction(customId) {
  if (isRequestDecisionInteraction(customId)) return true
  if (isStorytellerRequestInteraction(customId)) return true
  if (PAUSED_GAME_PANEL_ACTIONS.has(customId)) return true
  return [
    STORYTELLER_DASHBOARD_ACTIONS.requests,
    STORYTELLER_DASHBOARD_ACTIONS.end,
    'botc:storyteller:resume'
  ].includes(customId)
}

function isPauseAllowedCommand(game, userId, commandName) {
  if (PAUSED_PUBLIC_COMMANDS.has(commandName)) return true
  if (game?.storytellerId === userId && PAUSED_STORYTELLER_COMMANDS.has(commandName)) return true
  return false
}

module.exports = {
  guardPausedReplacementCommand,
  guardPausedReplacementInteraction,
  isPauseAllowedInteraction
}
