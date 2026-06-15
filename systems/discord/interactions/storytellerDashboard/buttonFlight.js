const {
  STORYTELLER_DASHBOARD_ACTIONS
} = require('../../embeds')
const {
  acknowledgeInteraction
} = require('../feedback')

const RESUME_BUTTON_ID = 'botc:storyteller:resume'

async function runDashboardButtonFlight(interaction, singleFlight, fn) {
  if (!isStateChangingDashboardButton(interaction.customId)) return fn()
  const key = createDashboardButtonFlightKey(interaction)
  const result = await singleFlight.run(key, fn)
  if (!result.skipped) return result.value
  return acknowledgeInteraction(interaction)
}

function createDashboardButtonFlightKey(interaction) {
  return [
    interaction.guild?.id,
    interaction.member?.id,
    getStateChangingButtonFlightScope(interaction.customId)
  ].join(':')
}

function getStateChangingButtonFlightScope(customId) {
  const value = String(customId || '')
  if (value.startsWith(STORYTELLER_DASHBOARD_ACTIONS.advance)) {
    return STORYTELLER_DASHBOARD_ACTIONS.advance
  }
  return value
}

function isStateChangingDashboardButton(customId) {
  const value = String(customId || '')
  return getStateChangingButtonPrefixes().some(prefix => value.startsWith(prefix))
}

function getStateChangingButtonPrefixes() {
  return [
    RESUME_BUTTON_ID,
    STORYTELLER_DASHBOARD_ACTIONS.advance,
    STORYTELLER_DASHBOARD_ACTIONS.cancelNomination,
    STORYTELLER_DASHBOARD_ACTIONS.cancelVote,
    STORYTELLER_DASHBOARD_ACTIONS.clearExecutionCandidate,
    STORYTELLER_DASHBOARD_ACTIONS.clearRoleButton,
    STORYTELLER_DASHBOARD_ACTIONS.drunkShownRole,
    STORYTELLER_DASHBOARD_ACTIONS.end,
    STORYTELLER_DASHBOARD_ACTIONS.endReveal,
    STORYTELLER_DASHBOARD_ACTIONS.forcedNomination,
    STORYTELLER_DASHBOARD_ACTIONS.gong,
    STORYTELLER_DASHBOARD_ACTIONS.grimReveal,
    STORYTELLER_DASHBOARD_ACTIONS.move,
    STORYTELLER_DASHBOARD_ACTIONS.nightOrder,
    STORYTELLER_DASHBOARD_ACTIONS.nominationBuilderConfirm,
    STORYTELLER_DASHBOARD_ACTIONS.nominationNominator,
    STORYTELLER_DASHBOARD_ACTIONS.nominationRequest,
    STORYTELLER_DASHBOARD_ACTIONS.openVote,
    STORYTELLER_DASHBOARD_ACTIONS.playerControlPlayer,
    STORYTELLER_DASHBOARD_ACTIONS.quickCustom,
    STORYTELLER_DASHBOARD_ACTIONS.quickText,
    STORYTELLER_DASHBOARD_ACTIONS.randomRolesConfirm,
    STORYTELLER_DASHBOARD_ACTIONS.randomRolesDrunkShownSelect,
    STORYTELLER_DASHBOARD_ACTIONS.randomRolesSelect,
    STORYTELLER_DASHBOARD_ACTIONS.refresh,
    STORYTELLER_DASHBOARD_ACTIONS.resetVoteCursor,
    STORYTELLER_DASHBOARD_ACTIONS.rolePanel,
    STORYTELLER_DASHBOARD_ACTIONS.roleSelect,
    STORYTELLER_DASHBOARD_ACTIONS.setVoteClockhandSpeed,
    STORYTELLER_DASHBOARD_ACTIONS.setVoteThreshold,
    `${STORYTELLER_DASHBOARD_ACTIONS.grimoire}:kill`,
    `${STORYTELLER_DASHBOARD_ACTIONS.grimoire}:revive`,
    `${STORYTELLER_DASHBOARD_ACTIONS.grimoire}:move`,
    `${STORYTELLER_DASHBOARD_ACTIONS.grimoire}:token`,
    `${STORYTELLER_DASHBOARD_ACTIONS.grimoire}:untoken`,
    `${STORYTELLER_DASHBOARD_ACTIONS.grimoire}:lunatic-auto`,
    `${STORYTELLER_DASHBOARD_ACTIONS.grimoire}:lunatic-demon:`,
    `${STORYTELLER_DASHBOARD_ACTIONS.grimoire}:lunatic-minion:`
  ]
}

module.exports = {
  createDashboardButtonFlightKey,
  getStateChangingButtonPrefixes,
  getStateChangingButtonFlightScope,
  isStateChangingDashboardButton,
  runDashboardButtonFlight
}
