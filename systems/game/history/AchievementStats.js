const GOOD_TEAMS = new Set(['townsfolk', 'outsider'])
const EVIL_TEAMS = new Set(['minion', 'demon'])

function createAchievementDeltas(summary) {
  const deltas = {}

  for (const playerId of summary.players || []) {
    const roleId = summary.roles?.[playerId] || null
    const team = getRoleTeam(summary, roleId)
    const won = didTeamWin(summary.winner, team)

    deltas[playerId] = {
      gamesPlayed: 1,
      wins: won ? 1 : 0,
      winsAsGood: won && GOOD_TEAMS.has(team) ? 1 : 0,
      winsAsEvil: won && EVIL_TEAMS.has(team) ? 1 : 0,
      gamesAsDemon: team === 'demon' ? 1 : 0,
      gamesAsMinion: team === 'minion' ? 1 : 0,
      executionsSurvived: 0,
      nominationsMade: 0,
      nominationsReceived: 0,
      deaths: (summary.deadPlayers || []).includes(playerId) ? 1 : 0,
      roleCounts: roleId ? { [roleId]: 1 } : {}
    }
  }

  addNominationDeltas(deltas, summary.nominations || [])
  addExecutionDeltas(deltas, summary.executionHistory || [])
  return deltas
}

function mergeAchievementStats(existing = {}, delta = {}) {
  const roleCounts = mergeRoleCounts(existing.roleCounts, delta.roleCounts)
  return {
    userId: existing.userId || delta.userId || null,
    gamesPlayed: add(existing.gamesPlayed, delta.gamesPlayed),
    wins: add(existing.wins, delta.wins),
    winsAsGood: add(existing.winsAsGood, delta.winsAsGood),
    winsAsEvil: add(existing.winsAsEvil, delta.winsAsEvil),
    gamesAsDemon: add(existing.gamesAsDemon, delta.gamesAsDemon),
    gamesAsMinion: add(existing.gamesAsMinion, delta.gamesAsMinion),
    executionsSurvived: add(existing.executionsSurvived, delta.executionsSurvived),
    nominationsMade: add(existing.nominationsMade, delta.nominationsMade),
    nominationsReceived: add(existing.nominationsReceived, delta.nominationsReceived),
    deaths: add(existing.deaths, delta.deaths),
    roleCounts,
    favoriteRole: getFavoriteRole(roleCounts),
    updatedAt: Date.now()
  }
}

function addNominationDeltas(deltas, nominations) {
  for (const nomination of nominations) {
    if (deltas[nomination.nominatorId]) deltas[nomination.nominatorId].nominationsMade += 1
    if (deltas[nomination.nomineeId]) deltas[nomination.nomineeId].nominationsReceived += 1
  }
}

function addExecutionDeltas(deltas, executionHistory) {
  for (const execution of executionHistory) {
    const playerId = execution.playerId || execution.nomineeId
    if (!deltas[playerId]) continue
    if (execution.executed === false || execution.preventedBy) {
      deltas[playerId].executionsSurvived += 1
    }
  }
}

function getRoleTeam(summary, roleId) {
  if (!roleId) return null
  for (const [team, roleIds] of Object.entries(summary.roleCategories || {})) {
    if ((roleIds || []).includes(roleId)) return team
  }
  return null
}

function didTeamWin(winner, team) {
  if (winner === 'good') return GOOD_TEAMS.has(team)
  if (winner === 'evil') return EVIL_TEAMS.has(team)
  return false
}

function mergeRoleCounts(existing = {}, delta = {}) {
  const merged = { ...(existing || {}) }
  for (const [roleId, count] of Object.entries(delta || {})) {
    merged[roleId] = add(merged[roleId], count)
  }
  return merged
}

function getFavoriteRole(roleCounts = {}) {
  const [roleId] = Object.entries(roleCounts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0] || []
  return roleId || null
}

function add(left, right) {
  return (Number(left) || 0) + (Number(right) || 0)
}

module.exports = {
  createAchievementDeltas,
  didTeamWin,
  getFavoriteRole,
  getRoleTeam,
  mergeAchievementStats
}
