const STORYTELLER_DASHBOARD_PREFIX = 'botc:storyteller:'
const DASHBOARD_TEXT_INPUT_ID = 'body'

/** @type {import('../../types').StorytellerDashboardActions} */
const STORYTELLER_DASHBOARD_ACTIONS = {
  action: `${STORYTELLER_DASHBOARD_PREFIX}action`,
  advance: `${STORYTELLER_DASHBOARD_PREFIX}advance`,
  advanceVoteCursor: `${STORYTELLER_DASHBOARD_PREFIX}advance-vote-cursor`,
  cancelNomination: `${STORYTELLER_DASHBOARD_PREFIX}cancel-nomination`,
  cancelVote: `${STORYTELLER_DASHBOARD_PREFIX}cancel-vote`,
  clearExecutionCandidate: `${STORYTELLER_DASHBOARD_PREFIX}clear-execution-candidate`,
  clearRoleButton: `${STORYTELLER_DASHBOARD_PREFIX}clear-role-button`,
  drunkShownRole: `${STORYTELLER_DASHBOARD_PREFIX}drunk-shown-role`,
  end: `${STORYTELLER_DASHBOARD_PREFIX}end`,
  endReveal: `${STORYTELLER_DASHBOARD_PREFIX}end-reveal`,
  forcedNomination: `${STORYTELLER_DASHBOARD_PREFIX}forced-nomination`,
  gong: `${STORYTELLER_DASHBOARD_PREFIX}gong`,
  goToDen: `${STORYTELLER_DASHBOARD_PREFIX}go-to-den`,
  grimoire: `${STORYTELLER_DASHBOARD_PREFIX}grimoire`,
  grimReveal: `${STORYTELLER_DASHBOARD_PREFIX}grim-reveal`,
  move: `${STORYTELLER_DASHBOARD_PREFIX}move`,
  moveBack: `${STORYTELLER_DASHBOARD_PREFIX}move-back`,
  moveDen: `${STORYTELLER_DASHBOARD_PREFIX}move-den`,
  movePlayer: `${STORYTELLER_DASHBOARD_PREFIX}move-player`,
  nightOrder: `${STORYTELLER_DASHBOARD_PREFIX}night-order`,
  nominationNominator: `${STORYTELLER_DASHBOARD_PREFIX}nomination-nominator`,
  nominationBuilderConfirm: `${STORYTELLER_DASHBOARD_PREFIX}nomination-builder-confirm`,
  nominationBuilderNominator: `${STORYTELLER_DASHBOARD_PREFIX}nomination-builder-nominator`,
  nominationBuilderNominee: `${STORYTELLER_DASHBOARD_PREFIX}nomination-builder-nominee`,
  nominationRequest: `${STORYTELLER_DASHBOARD_PREFIX}nomination-request`,
  openVote: `${STORYTELLER_DASHBOARD_PREFIX}open-vote`,
  player: `${STORYTELLER_DASHBOARD_PREFIX}player`,
  playerControlBack: `${STORYTELLER_DASHBOARD_PREFIX}player-control-back`,
  playerControlDisconnect: `${STORYTELLER_DASHBOARD_PREFIX}player-control-disconnect`,
  playerControlKick: `${STORYTELLER_DASHBOARD_PREFIX}player-control-kick`,
  playerControlKill: `${STORYTELLER_DASHBOARD_PREFIX}player-control-kill`,
  playerControlPanel: `${STORYTELLER_DASHBOARD_PREFIX}player-control-panel`,
  playerControlPlayer: `${STORYTELLER_DASHBOARD_PREFIX}player-control-player`,
  playerControlPlayers: `${STORYTELLER_DASHBOARD_PREFIX}player-control-players`,
  playerControlRevive: `${STORYTELLER_DASHBOARD_PREFIX}player-control-revive`,
  quickCharacter: `${STORYTELLER_DASHBOARD_PREFIX}quick-character`,
  quickCustom: `${STORYTELLER_DASHBOARD_PREFIX}quick-custom`,
  quickNumber: `${STORYTELLER_DASHBOARD_PREFIX}quick-number`,
  quickPlayer: `${STORYTELLER_DASHBOARD_PREFIX}quick-player`,
  quickText: `${STORYTELLER_DASHBOARD_PREFIX}quick-text`,
  randomRoles: `${STORYTELLER_DASHBOARD_PREFIX}random-roles`,
  randomRolesBack: `${STORYTELLER_DASHBOARD_PREFIX}random-roles-back`,
  randomRolesConfirm: `${STORYTELLER_DASHBOARD_PREFIX}random-roles-confirm`,
  randomRolesDrunkShown: `${STORYTELLER_DASHBOARD_PREFIX}random-roles-drunk-shown`,
  randomRolesDrunkShownSelect: `${STORYTELLER_DASHBOARD_PREFIX}random-roles-drunk-shown-select`,
  randomRolesSelect: `${STORYTELLER_DASHBOARD_PREFIX}random-roles-select`,
  refresh: `${STORYTELLER_DASHBOARD_PREFIX}refresh`,
  reminderModal: `${STORYTELLER_DASHBOARD_PREFIX}reminder-modal`,
  requests: `${STORYTELLER_DASHBOARD_PREFIX}requests`,
  resetVoteCursor: `${STORYTELLER_DASHBOARD_PREFIX}reset-vote-cursor`,
  role: `${STORYTELLER_DASHBOARD_PREFIX}role`,
  rolePanel: `${STORYTELLER_DASHBOARD_PREFIX}role-panel`,
  roleSelect: `${STORYTELLER_DASHBOARD_PREFIX}role-select`,
  script: `${STORYTELLER_DASHBOARD_PREFIX}script`,
  secretModal: `${STORYTELLER_DASHBOARD_PREFIX}secret-modal`,
  setVoteClockhandSpeed: `${STORYTELLER_DASHBOARD_PREFIX}set-vote-speed`,
  setVoteThreshold: `${STORYTELLER_DASHBOARD_PREFIX}set-vote-threshold`,
  statusDismiss: `${STORYTELLER_DASHBOARD_PREFIX}status-dismiss`,
  timer: `${STORYTELLER_DASHBOARD_PREFIX}timer`,
  timerModal: `${STORYTELLER_DASHBOARD_PREFIX}timer-modal`,
  voteClockhandSpeedModal: `${STORYTELLER_DASHBOARD_PREFIX}vote-speed-modal`,
  voteThresholdModal: `${STORYTELLER_DASHBOARD_PREFIX}vote-threshold-modal`,
  votingLogs: `${STORYTELLER_DASHBOARD_PREFIX}voting-logs`
}

/** @type {Readonly<Record<string, import('../../types').StorytellerPlayerAction>>} */
const STORYTELLER_PLAYER_ACTIONS = {
  addReminder: 'add_reminder',
  clearRole: 'clear_role',
  clearStatus: 'clear_status',
  drunk: 'drunk',
  evilTwin: 'evil_twin',
  kill: 'kill',
  markExecutionCandidate: 'mark_execution_candidate',
  nominate: 'nominate',
  nominateByPlayer: 'nominate_by_player',
  openVote: 'open_vote',
  poisoned: 'poisoned',
  protected: 'protected',
  quickInfo: 'quick_info',
  redHerring: 'red_herring',
  revive: 'revive',
  resolveNightAction: 'resolve_night_action',
  resolveVote: 'resolve_vote',
  secretInfo: 'secret_info',
  storytellerTarget: 'storyteller_target',
  triggerReminder: 'trigger_reminder',
  visitCottage: 'visit_cottage',
  wake: 'wake'
}

const CLEAR_ROLE_VALUE = '__clear_role__'

function isStorytellerDashboardAction(customId) {
  return typeof customId === 'string' && customId.startsWith(STORYTELLER_DASHBOARD_PREFIX)
}

function createStorytellerAdvanceCustomId(view) {
  return [
    STORYTELLER_DASHBOARD_ACTIONS.advance,
    view.state || 'unknown',
    view.phase || 'none',
    view.day || 0
  ].join(':')
}

function createForcedNominationCustomId(nominatorId) {
  return `${STORYTELLER_DASHBOARD_ACTIONS.forcedNomination}:${nominatorId}`
}

function createGrimoireCustomId(action, playerId = null, value = null) {
  return [STORYTELLER_DASHBOARD_ACTIONS.grimoire, action, playerId, value]
    .filter(part => part !== null && part !== undefined && part !== '')
    .join(':')
}

function createGrimRevealCustomId(playerId, revealId = 'pending') {
  return `${STORYTELLER_DASHBOARD_ACTIONS.grimReveal}:${playerId}:${revealId}`
}

function createMovePlayerCustomId(playerId) {
  return `${STORYTELLER_DASHBOARD_ACTIONS.movePlayer}:${playerId}`
}

function createNightOrderCustomId(action, index = null, value = null) {
  return [STORYTELLER_DASHBOARD_ACTIONS.nightOrder, action, index, value]
    .filter(part => part !== null && part !== undefined && part !== '')
    .join(':')
}

function createPlayerControlPlayerCustomId(playerId) {
  return `${STORYTELLER_DASHBOARD_ACTIONS.playerControlPlayer}:${playerId}`
}

function createNominationNominatorCustomId(nomineeId) {
  return `${STORYTELLER_DASHBOARD_ACTIONS.nominationNominator}:${nomineeId}`
}

function createNominationRequestCustomId(action, requestId) {
  return `${STORYTELLER_DASHBOARD_ACTIONS.nominationRequest}:${action}:${requestId}`
}

function createRoleSelectCustomId(team) {
  return `${STORYTELLER_DASHBOARD_ACTIONS.roleSelect}:${team}`
}

function parseForcedNominationCustomId(customId) {
  const prefix = `${STORYTELLER_DASHBOARD_ACTIONS.forcedNomination}:`
  if (!String(customId || '').startsWith(prefix)) return null
  return { nominatorId: String(customId).slice(prefix.length) }
}

function parseGrimoireCustomId(customId) {
  const prefix = `${STORYTELLER_DASHBOARD_ACTIONS.grimoire}:`
  if (!String(customId || '').startsWith(prefix)) return null
  const [action, playerId = null, value = null] = String(customId).slice(prefix.length).split(':')
  return { action, playerId, value }
}

function parseGrimRevealCustomId(customId) {
  const prefix = `${STORYTELLER_DASHBOARD_ACTIONS.grimReveal}:`
  if (!String(customId || '').startsWith(prefix)) return null
  const [playerId, ...idParts] = String(customId).slice(prefix.length).split(':')
  return {
    playerId,
    revealId: idParts.join(':') || null
  }
}

function parseMovePlayerCustomId(customId) {
  const prefix = `${STORYTELLER_DASHBOARD_ACTIONS.movePlayer}:`
  if (!String(customId || '').startsWith(prefix)) return null
  return { playerId: String(customId).slice(prefix.length) }
}

function parseNightOrderCustomId(customId) {
  const prefix = `${STORYTELLER_DASHBOARD_ACTIONS.nightOrder}:`
  if (!String(customId || '').startsWith(prefix)) return null
  const [action, index, ...valueParts] = String(customId).slice(prefix.length).split(':')
  const parsed = {
    action,
    index: Number.isFinite(Number(index)) ? Number(index) : null
  }
  const value = valueParts.join(':')
  if (value) parsed.value = value
  return parsed
}

function parseNominationNominatorCustomId(customId) {
  const prefix = `${STORYTELLER_DASHBOARD_ACTIONS.nominationNominator}:`
  if (!String(customId || '').startsWith(prefix)) return null
  return { nomineeId: String(customId).slice(prefix.length) }
}

function parseNominationRequestCustomId(customId) {
  const prefix = `${STORYTELLER_DASHBOARD_ACTIONS.nominationRequest}:`
  if (!String(customId || '').startsWith(prefix)) return null
  const [action, ...requestParts] = String(customId).slice(prefix.length).split(':')
  return {
    action,
    requestId: requestParts.join(':') || null
  }
}

function parsePlayerControlPlayerCustomId(customId) {
  const prefix = `${STORYTELLER_DASHBOARD_ACTIONS.playerControlPlayer}:`
  if (!String(customId || '').startsWith(prefix)) return null
  return { playerId: String(customId).slice(prefix.length) }
}

function parseRoleSelectCustomId(customId) {
  const prefix = `${STORYTELLER_DASHBOARD_ACTIONS.roleSelect}:`
  if (!String(customId || '').startsWith(prefix)) return null
  return { team: String(customId).slice(prefix.length) }
}

function parseStorytellerAdvanceCustomId(customId) {
  const prefix = `${STORYTELLER_DASHBOARD_ACTIONS.advance}:`
  if (!String(customId || '').startsWith(prefix)) return null

  const [, , , state, phase, day] = String(customId).split(':')
  return {
    state,
    phase: phase === 'none' ? null : phase,
    day: Number(day) || 0
  }
}

module.exports = {
  CLEAR_ROLE_VALUE,
  DASHBOARD_TEXT_INPUT_ID,
  STORYTELLER_DASHBOARD_ACTIONS,
  STORYTELLER_PLAYER_ACTIONS,
  createForcedNominationCustomId,
  createGrimoireCustomId,
  createGrimRevealCustomId,
  createMovePlayerCustomId,
  createNightOrderCustomId,
  createNominationNominatorCustomId,
  createNominationRequestCustomId,
  createPlayerControlPlayerCustomId,
  createRoleSelectCustomId,
  createStorytellerAdvanceCustomId,
  parseForcedNominationCustomId,
  parseGrimoireCustomId,
  parseGrimRevealCustomId,
  parseMovePlayerCustomId,
  parseNightOrderCustomId,
  parseNominationNominatorCustomId,
  parseNominationRequestCustomId,
  parsePlayerControlPlayerCustomId,
  parseRoleSelectCustomId,
  parseStorytellerAdvanceCustomId,
  isStorytellerDashboardAction
}
