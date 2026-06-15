const {
  getSetupCountOptions
} = require('../../systems/game/roles/setupCounts')

const RANDOM_ROLE_TEAMS = ['townsfolk', 'outsider', 'minion', 'demon']

function getDraftRoleIds(draft = {}) {
  return RANDOM_ROLE_TEAMS.flatMap(team => draft[team] || [])
}

function countDraftRoles(draft = {}) {
  return getDraftRoleIds(draft).length
}

function getRandomRoleTeamCount(draft = {}, team) {
  return (draft[team] || []).length
}

function getRandomRoleTeamLimit(playerCount, draft = {}, team) {
  const options = getSetupCountOptions(playerCount, getDraftRoleIds(draft))
    .map(option => option.counts?.[team])
    .filter(value => Number.isInteger(value))
  if (!options.length) return null
  return Math.max(...options)
}

function isRandomRoleTeamFull(playerCount, draft = {}, team) {
  const limit = getRandomRoleTeamLimit(playerCount, draft, team)
  if (limit === null) return false
  return getRandomRoleTeamCount(draft, team) >= limit
}

function isRandomRoleSelectionComplete(playerCount, draft = {}) {
  if (playerCount <= 0 || countDraftRoles(draft) !== playerCount) return false
  return RANDOM_ROLE_TEAMS.every(team => {
    const limit = getRandomRoleTeamLimit(playerCount, draft, team)
    return limit !== null && getRandomRoleTeamCount(draft, team) === limit
  })
}

module.exports = {
  RANDOM_ROLE_TEAMS,
  countDraftRoles,
  getDraftRoleIds,
  getRandomRoleTeamCount,
  getRandomRoleTeamLimit,
  isRandomRoleSelectionComplete,
  isRandomRoleTeamFull
}
