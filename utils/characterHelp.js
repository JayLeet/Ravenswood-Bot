const { messages } = require('./text/messageRegistry')
const {
  getRoleEmoji
} = require('./storytellerDashboard/roleEmojis')
const {
  formatRoleName
} = require('./roleFormatting')

const FALLBACK_ABILITY = messages.get('character.fallbackAbility')

function formatCharacterHelp(role) {
  const lines = [
    `**${formatCharacterTitle(role)}**`,
    `Team: ${formatTeam(role.team)}`,
    `Ability: ${role.ability || messages.get('character.fallbackAbility')}`
  ]

  if (role.wakes) lines.push(`Wakes: ${formatList(role.wakes)}`)
  if (role.howItWorks) lines.push(`How it works: ${role.howItWorks}`)
  if (role.limitations) lines.push(`Limitations: ${formatList(role.limitations)}`)
  if (role.notes) lines.push(`Notes: ${formatList(role.notes)}`)

  return lines.join('\n')
}

function formatCharacterTitle(role) {
  const roleName = role.name || formatRoleName(role.id)
  return `${getRoleEmoji(null, role.id)} The ${roleName}`
}

function formatTeam(team) {
  return String(team || 'unknown')
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatList(value) {
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

module.exports = {
  FALLBACK_ABILITY,
  formatCharacterHelp,
  formatCharacterTitle
}
