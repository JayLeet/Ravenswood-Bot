const {
  isClocktowerLiveMode
} = require('../../../../utils/gameModes')
const {
  editDashboardFailure
} = require('../feedback')
const {
  STORYTELLER_DASHBOARD_ACTIONS
} = require('../../embeds')

const CLOCKTOWER_LIVE_ALLOWED_ACTIONS = Object.freeze([
  STORYTELLER_DASHBOARD_ACTIONS.advance,
  STORYTELLER_DASHBOARD_ACTIONS.drunkShownRole,
  STORYTELLER_DASHBOARD_ACTIONS.end,
  STORYTELLER_DASHBOARD_ACTIONS.endReveal,
  STORYTELLER_DASHBOARD_ACTIONS.gong,
  STORYTELLER_DASHBOARD_ACTIONS.grimoire,
  STORYTELLER_DASHBOARD_ACTIONS.grimReveal,
  STORYTELLER_DASHBOARD_ACTIONS.nightOrder,
  STORYTELLER_DASHBOARD_ACTIONS.playerControlBack,
  STORYTELLER_DASHBOARD_ACTIONS.playerControlDisconnect,
  STORYTELLER_DASHBOARD_ACTIONS.playerControlKick,
  STORYTELLER_DASHBOARD_ACTIONS.playerControlPanel,
  STORYTELLER_DASHBOARD_ACTIONS.playerControlPlayer,
  STORYTELLER_DASHBOARD_ACTIONS.playerControlPlayers,
  STORYTELLER_DASHBOARD_ACTIONS.randomRoles,
  STORYTELLER_DASHBOARD_ACTIONS.randomRolesBack,
  STORYTELLER_DASHBOARD_ACTIONS.randomRolesConfirm,
  STORYTELLER_DASHBOARD_ACTIONS.randomRolesDrunkShown,
  STORYTELLER_DASHBOARD_ACTIONS.randomRolesDrunkShownSelect,
  STORYTELLER_DASHBOARD_ACTIONS.randomRolesSelect,
  STORYTELLER_DASHBOARD_ACTIONS.role,
  STORYTELLER_DASHBOARD_ACTIONS.rolePanel,
  STORYTELLER_DASHBOARD_ACTIONS.roleSelect,
  STORYTELLER_DASHBOARD_ACTIONS.statusDismiss,
  STORYTELLER_DASHBOARD_ACTIONS.timer,
  STORYTELLER_DASHBOARD_ACTIONS.timerModal
])

function guardExternalMode(interaction, context) {
  if (!isClocktowerLiveMode(context.view)) return null
  if (isClocktowerLiveAllowedAction(interaction.customId)) return null

  return editDashboardFailure(interaction, {
    title: 'Disabled in Clocktower.live mode',
    message: 'Clocktower.live mode keeps BOTC Bot nominations, votes, win checks, and most role automation disabled.',
    suggestion: 'Use Day/Night, Gong, Timer, Player Controls, optional visual role tools, Night Order, or End Game.'
  })
}

function isClocktowerLiveAllowedAction(customId) {
  return CLOCKTOWER_LIVE_ALLOWED_ACTIONS.some(action =>
    customId === action || String(customId || '').startsWith(`${action}:`)
  )
}

module.exports = {
  guardExternalMode
}
