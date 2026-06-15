const {
  formatCategory
} = require('./formatters')
const {
  getRandomRoleTeamCount,
  getRandomRoleTeamLimit,
  RANDOM_ROLE_TEAMS
} = require('./randomRoleCounts')

function createRandomRoleDistributionLines(playerCount, draft) {
  return RANDOM_ROLE_TEAMS.map(team => {
    const selected = getRandomRoleTeamCount(draft, team)
    const required = getRandomRoleTeamLimit(playerCount, draft, team)
    const status = formatTeamCountStatus(selected, required)
    return `- ${formatCategory(team)}: ${selected}/${required ?? '?'}${status}`
  })
}

function formatTeamCountStatus(selected, required) {
  if (!Number.isInteger(required)) return ''
  if (selected > required) return ` — remove ${selected - required}`
  if (selected < required) return ` — choose ${required - selected}`
  return ' — done'
}

module.exports = {
  createRandomRoleDistributionLines,
  formatTeamCountStatus
}
