const {
  getRole
} = require('../scripts')
const {
  getTeamEmoji
} = require('./storytellerDashboard/roleEmojis')
const {
  formatRoleWithEmoji
} = require('./roleFormatting')
const { messages } = require('./text/messageRegistry')
const {
  shouldSuppressAutomaticEvilInfoForView
} = require('../systems/game/roles/FirstNightInfoRules')
const {
  createLunaticFirstNightInfoText
} = require('./lunaticInfo')

function createFirstNightInfoFields(action, view, playerLabels = {}) {
  if (!shouldShowFirstNightInfo(action, view)) return []
  if (createFirstNightEvilInfoText(action, view, playerLabels)) return []
  if (createFirstNightRoleInfoText(action, view, playerLabels)) return []
  return []
}

function createFirstNightRoleInfoText(action, view, playerLabels = {}) {
  if (!shouldShowFirstNightInfo(action, view)) return null

  const playerId = action.actorId || action.playerId
  const roleId = view.engine?.roles?.[playerId] || action.roleId
  const lunaticInfo = createLunaticFirstNightInfoText(view, playerId, playerLabels)
  if (lunaticInfo) return lunaticInfo

  const team = getRoleTeam(view, roleId)
  if (team === 'demon' || team === 'minion') return null

  const shownRoleId = view.engine?.shownRoles?.[playerId] || roleId
  const role = getRole(view.scriptId, shownRoleId)
  return [
    `You are ${formatRoleWithEmoji(view, shownRoleId)}.`,
    '',
    role?.ability || messages.get('character.fallbackAbility')
  ].join('\n')
}

function createFirstNightEvilInfoText(action, view, playerLabels = {}) {
  if (!shouldShowFirstNightInfo(action, view)) return null
  if (shouldSuppressAutomaticEvilInfoForView(view)) return null

  const playerId = action.actorId || action.playerId
  const roleId = view.engine?.roles?.[playerId] || action.roleId
  const shownRoleId = view.engine?.shownRoles?.[playerId] || roleId
  const team = getRoleTeam(view, roleId)

  if (team === 'demon') return createDemonFirstNightInfoText(view, playerId, shownRoleId, playerLabels)
  if (team === 'minion') return createMinionFirstNightInfoText(view, playerId, shownRoleId, playerLabels)
  return null
}

function createDemonFirstNightInfoText(view, playerId, roleId, playerLabels = {}) {
  const demons = getTeamPlayers(view, 'demon').filter(id => id !== playerId)
  const minions = getTeamPlayers(view, 'minion')
  const lines = [
    `You are the Demon: ${formatRoleWithEmoji(view, roleId)}.`
  ]

  if (demons.length) lines.push(
    '',
    'These are your fellow demons:',
    formatTeamList(demons, view, playerLabels, 'demon')
  )

  lines.push(
    '',
    'These are your Minion(s):',
    minions.length ? formatTeamList(minions, view, playerLabels, 'minion') : 'No Minions are in play.'
  )

  return lines.join('\n')
}

function createMinionFirstNightInfoText(view, playerId, roleId, playerLabels = {}) {
  const demons = getTeamPlayers(view, 'demon')
  const minions = getTeamPlayers(view, 'minion').filter(id => id !== playerId)
  const lines = [
    `You are a Minion: ${formatRoleWithEmoji(view, roleId)}.`,
    '',
    demons.length === 1 ? 'This is your Demon:' : 'These are your demons:',
    demons.length ? formatTeamList(demons, view, playerLabels, 'demon') : 'No Demon is in play.'
  ]

  if (minions.length) lines.push(
    '',
    'These are your fellow Minion(s):',
    formatTeamList(minions, view, playerLabels, 'minion')
  )

  return lines.join('\n')
}

function shouldShowFirstNightInfo(action, view) {
  if (!view) return false
  if (action?.firstNightRoleInfo === true) return true
  return Number(view.day || action?.day || 1) === 1
}

function getNotInPlayRoleIds(view, options = {}) {
  const inPlay = new Set(Object.values(view?.engine?.roles || {}).filter(Boolean))
  const allowedTeams = options.teams?.length ? new Set(options.teams) : null
  return Object.entries(view?.engine?.roleCategories || {})
    .flatMap(([team, roleIds]) => {
      if (allowedTeams && !allowedTeams.has(team)) return []
      return roleIds || []
    })
    .filter(roleId => !inPlay.has(roleId))
}

function getTeamPlayers(view, team) {
  return (view.users?.players || [])
    .filter(playerId => getRoleTeam(view, view.engine?.roles?.[playerId]) === team)
}

function formatTeamList(playerIds, view, playerLabels = {}, team) {
  const emoji = getTeamEmoji(team)
  return playerIds.map(playerId => `- ${emoji} ${playerLabels[playerId] || `<@${playerId}>`}`).join('\n')
}

function getRoleTeam(view, roleId) {
  for (const [team, roleIds] of Object.entries(view?.engine?.roleCategories || {})) {
    if ((roleIds || []).includes(roleId)) return team
  }
  return null
}

module.exports = {
  createFirstNightEvilInfoText,
  createFirstNightInfoFields,
  createFirstNightRoleInfoText,
  getNotInPlayRoleIds
}
