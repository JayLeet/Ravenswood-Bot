const {
  createLunaticDemonPayload,
  createLunaticMinionsPayload,
  createPlayerGrimoirePayload
} = require('../../embeds')
const {
  editDashboardLifecycleFailure
} = require('../feedback')
const {
  updateControlPayload
} = require('./randomRoleButton')

const LUNATIC_ACTIONS = new Set([
  'lunatic-auto',
  'lunatic-demon',
  'lunatic-demon-menu',
  'lunatic-minion',
  'lunatic-minion-menu'
])

function isLunaticGrimoireAction(action) {
  return LUNATIC_ACTIONS.has(action)
}

async function handleLunaticGrimoireButton(interaction, parsed, labels, gameLifecycle, contextView = null) {
  if (parsed.action === 'lunatic-demon-menu') {
    return updateControlPayload(interaction, createLunaticDemonPayload(
      getCurrentView(gameLifecycle, interaction, contextView),
      parsed.playerId,
      labels
    ))
  }

  if (parsed.action === 'lunatic-minion-menu') {
    return updateControlPayload(interaction, createLunaticMinionsPayload(
      getCurrentView(gameLifecycle, interaction, contextView),
      parsed.playerId,
      labels
    ))
  }

  const result = await runLunaticMutation(interaction, parsed, gameLifecycle)
  if (!result.ok) return editDashboardLifecycleFailure(interaction, result)

  const view = getCurrentView(gameLifecycle, interaction, result.view || contextView)
  if (parsed.action === 'lunatic-demon') {
    return updateControlPayload(interaction, createLunaticDemonPayload(view, parsed.playerId, labels))
  }
  if (parsed.action === 'lunatic-minion') {
    return updateControlPayload(interaction, createLunaticMinionsPayload(view, parsed.playerId, labels))
  }
  return updateControlPayload(interaction, createPlayerGrimoirePayload(view, parsed.playerId, labels))
}

function runLunaticMutation(interaction, parsed, gameLifecycle) {
  if (parsed.action === 'lunatic-auto') {
    return gameLifecycle.resetLunaticInfo(interaction.guild.id, interaction.member, parsed.playerId)
  }
  if (parsed.action === 'lunatic-demon') {
    return gameLifecycle.setLunaticDemonRole(interaction.guild.id, interaction.member, parsed.playerId, parsed.value)
  }
  if (parsed.action === 'lunatic-minion') {
    return gameLifecycle.toggleLunaticMinion(interaction.guild.id, interaction.member, parsed.playerId, parsed.value)
  }
  return { ok: false, error: { message: 'Unknown Lunatic control.' } }
}

function getCurrentView(gameLifecycle, interaction, fallbackView) {
  return gameLifecycle.getGameView?.(interaction.guild.id) || fallbackView || {}
}

module.exports = {
  handleLunaticGrimoireButton,
  isLunaticGrimoireAction
}
