const {
  getScript
} = require('../../scripts')
const {
  isClocktowerLiveMode
} = require('../gameModes')
const {
  createReminderSummary
} = require('./nightGuidanceReminders')
const {
  formatRoleName,
  formatRoleWithEmoji
} = require('../roleFormatting')
const {
  shouldUseAlejoOrdering
} = require('../../systems/game/roles/FirstNightInfoRules')

const OPEN_STATUSES = new Set(['awaiting_target', 'submitted'])

function createNightWakeEntries(view, playerLabels = {}) {
  if (isClocktowerLiveMode(view)) return createClocktowerLiveNightWakeEntries(view, playerLabels)

  const script = getScript(view.scriptId)
  const alive = new Set(view.users?.alivePlayers || [])
  const actions = sortNightActions(view, script, compactResolvedInfoDuplicates(getCurrentNightActions(view)
    .filter(action => action.roleId && isVisibleNightOrderAction(action))
    .filter(action => alive.has(action.actorId || action.playerId))))

  return actions.map(action => createActionEntry(view, script, action, playerLabels))
}

function createClocktowerLiveNightWakeEntries(view, playerLabels = {}) {
  const script = getScript(view.scriptId)
  const alive = new Set(view.users?.alivePlayers || [])
  const players = view.users?.players || []
  const roles = view.engine?.roles || {}
  const actionsByPlayer = new Map(getCurrentNightActions(view)
    .filter(action => action.roleId && isVisibleNightOrderAction(action))
    .map(action => [action.actorId || action.playerId, action]))

  const actions = players
    .filter(playerId => alive.has(playerId))
    .filter(playerId => roles[playerId])
    .map(playerId => actionsByPlayer.get(playerId) || createVisualNightOrderAction(view, playerId, roles[playerId]))

  return sortNightActions(view, script, actions).map(action => createActionEntry(view, script, action, playerLabels))
}

function createVisualNightOrderAction(view, playerId, roleId) {
  return {
    id: `visual:${view.day || 1}:${playerId}:${roleId}`,
    actorId: playerId,
    playerId,
    roleId,
    roleName: view.engine?.roleNames?.[roleId] || formatRoleName(roleId),
    status: 'awaiting_target',
    day: view.day,
    phase: 'night',
    prompt: null,
    targetType: 'self',
    source: 'role_visuals'
  }
}

function createActionEntry(view, script, action, playerLabels = {}) {
  const role = getRole(script, action.roleId)
  const playerId = action.actorId || action.playerId
  return {
    action,
    playerId,
    playerLabel: formatPlayerLabel(playerId, playerLabels),
    roleName: formatRoleWithEmoji(view, action.roleId),
    prompt: action.prompt || role?.howItWorks || role?.ability || 'Handle this character prompt.',
    response: formatSubmittedResponse(action, view, playerLabels),
    reminders: createReminderSummary(view, playerId),
    details: role?.howItWorks || role?.ability || ''
  }
}

function sortNightActions(view, script, actions) {
  const order = getNightOrder(view, script, actions)
  const orderIndex = new Map(order.map((roleId, index) => [roleId, index]))
  return actions.slice().sort((a, b) =>
    getActionPriority(view, script, a, orderIndex) - getActionPriority(view, script, b, orderIndex) ||
    (a.createdAt || 0) - (b.createdAt || 0)
  )
}

function getActionPriority(view, script, action, orderIndex) {
  const role = getRole(script, action.roleId)
  if (Number(view.day || 1) <= 1 && !shouldUseAlejoOrdering(view, script) && role?.team === 'demon') return -1000
  if (Number(view.day || 1) <= 1 && !shouldUseAlejoOrdering(view, script) && role?.team === 'minion') return -900
  return orderIndex.has(action.roleId) ? orderIndex.get(action.roleId) : 10000
}

function getCurrentNightActions(view) {
  return (view.engine?.nightActions || [])
    .filter(action => action.day === view.day && action.phase === 'night')
    .filter(action => OPEN_STATUSES.has(action.status) || isResolvedFirstNightInfoAction(action))
}

function compactResolvedInfoDuplicates(actions) {
  const openKeys = new Set(actions
    .filter(action => OPEN_STATUSES.has(action.status))
    .map(createActionPlayerRoleKey))
  return actions.filter(action =>
    !isResolvedFirstNightInfoAction(action) || !openKeys.has(createActionPlayerRoleKey(action))
  )
}

function createActionPlayerRoleKey(action) {
  return `${action.actorId || action.playerId || ''}:${action.roleId || ''}`
}

function isVisibleNightOrderAction(action) {
  if (OPEN_STATUSES.has(action.status)) return true
  return isResolvedFirstNightInfoAction(action)
}

function isResolvedFirstNightInfoAction(action) {
  return action?.status === 'resolved' &&
    action?.infoOnly === true &&
    (
      action.firstNightRoleInfo === true ||
      action.purpose === 'first_night_info' ||
      action.purpose === 'starting_role_info' ||
      action.purpose === 'role_change_info'
    )
}

function formatSubmittedResponse(action, view, playerLabels = {}) {
  if (action.status !== 'submitted') return null
  const direct = getDirectSubmittedResponse(action)
  if (direct) return direct

  const targetIds = action.targetIds?.length ? action.targetIds : [action.targetId].filter(Boolean)
  if (!targetIds.length) return 'Acknowledged: Got it.'

  const label = getResponseTypeLabel(action)
  return targetIds.map(id => `${label}: ${formatTargetLabel(id, action, view, playerLabels)}`).join('\n')
}

function getDirectSubmittedResponse(action) {
  const direct = action.responseText || action.response || action.value || action.acknowledgement
  if (!direct) return null
  const label = action.targetType === 'character' || action.targetType === 'role'
    ? 'Character'
    : 'Response'
  return `${label}: ${String(direct)}`
}

function getResponseTypeLabel(action) {
  if (action.targetType === 'character' || action.targetType === 'role') return 'Character'
  if (action.targetType === 'text') return 'Response'
  return 'Player'
}

function formatTargetLabel(id, action, view, playerLabels = {}) {
  if ((view.users?.players || []).includes(id)) return formatPlayerLabel(id, playerLabels)
  return formatRoleWithEmoji(view, id)
}

function getNightOrder(view, script, actions = []) {
  const key = Number(view.day || 1) <= 1 ? 'firstNight' : 'otherNights'
  const order = [...(script?.nightOrder?.[key] || [])]
  const missingRoleIds = actions
    .slice()
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .map(action => action.roleId)
    .filter(roleId => roleId && !order.includes(roleId))

  return [...order, ...new Set(missingRoleIds)]
}

function getRole(script, roleId) {
  return script?.roles?.find(item => item.id === roleId) || null
}

function formatPlayerLabel(playerId, playerLabels = {}) {
  return playerLabels[playerId] || `Player ${String(playerId || '').slice(-4)}`
}

module.exports = {
  OPEN_STATUSES,
  createClocktowerLiveNightWakeEntries,
  compactResolvedInfoDuplicates,
  createNightWakeEntries,
  formatPlayerLabel,
  formatRoleName,
  formatSubmittedResponse,
  getNightOrder,
  isResolvedFirstNightInfoAction,
  sortNightActions
}
