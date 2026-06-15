const TEAM_KEYS = Object.freeze(['townsfolk', 'outsider', 'minion', 'demon'])
const {
  TEAM_EMOJIS
} = require('./storytellerDashboard/roleEmojis')

const TEAM_LABELS = Object.freeze({
  demon: 'Demon',
  minion: 'Minion(s)',
  outsider: 'Outsider(s)',
  townsfolk: 'Townsfolk'
})

function countAssignedRoleTeams(view) {
  const counts = Object.fromEntries(TEAM_KEYS.map(team => [team, 0]))
  const roleTeams = createRoleTeamLookup(view)
  const roles = view?.engine?.roles || {}

  for (const roleId of Object.values(roles)) {
    const team = roleTeams[roleId]
    if (counts[team] !== undefined) counts[team] += 1
  }

  return counts
}

function createRoleTeamLookup(view) {
  const lookup = {}
  const categories = view?.engine?.roleCategories || {}

  for (const team of TEAM_KEYS) {
    for (const roleId of categories[team] || []) lookup[roleId] = team
  }

  return lookup
}

function formatAssignedTeamCounts(view) {
  const counts = countAssignedRoleTeams(view)
  if (!TEAM_KEYS.some(team => counts[team] > 0)) return null
  return TEAM_KEYS
    .map(team => `${counts[team]} ${TEAM_LABELS[team]}`)
    .join(', ')
}

function formatCompactTeamCounts(view) {
  const counts = countAssignedRoleTeams(view)
  if (!TEAM_KEYS.some(team => counts[team] > 0)) return null
  return TEAM_KEYS
    .map(team => `${TEAM_EMOJIS[team]}${counts[team]}`)
    .join(' ')
}

module.exports = {
  TEAM_KEYS,
  countAssignedRoleTeams,
  createRoleTeamLookup,
  formatAssignedTeamCounts,
  formatCompactTeamCounts
}
