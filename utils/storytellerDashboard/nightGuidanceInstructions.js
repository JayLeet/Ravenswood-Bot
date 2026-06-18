const {
  truncate
} = require('./formatters')
const {
  isResolvedFirstNightInfoAction
} = require('./nightGuidanceEntries')
const {
  ROLE_INSTRUCTIONS,
  createDemonBluffInstruction
} = require('./nightGuidanceRoleInstructions')

function createCurrentInstructionText(current) {
  const roleId = getRoleId(current)
  const firstNight = Number(current.action?.day || 1) <= 1

  if (current.roleTeam === 'demon' && firstNight && current.action?.infoOnly) {
    return createDemonBluffInstruction().join('\n')
  }

  if (current.roleTeam === 'minion' && firstNight && current.action?.infoOnly) {
    return compactLines([
      '🐍 Night-one Minion info:',
      `Send ${current.playerLabel} their Minion role card and evil-team info.`,
      'Show teammate player names only; do not reveal teammate role names.'
    ]).join('\n')
  }

  const specific = createMappedInstruction(roleId, current, firstNight)
  if (specific) return specific

  if (isResolvedFirstNightInfoAction(current.action)) {
    return createResolvedRoleInfoInstruction(current)
  }

  return createTargetInstruction(current)
}

function createMappedInstruction(roleId, current, firstNight) {
  const create = ROLE_INSTRUCTIONS[roleId]
  if (typeof create !== 'function') return null
  return compactLines(create({ current, firstNight, player: current.playerLabel }))
    .join('\n')
}

function createResolvedRoleInfoInstruction(current) {
  const detail = getDetailText(current)
  if (detail) {
    return [
      '📖 First-night role info:',
      detail
    ].join('\n')
  }

  return [
    '📋 First-night role info:',
    'Review this character in the script before moving on.'
  ].join('\n')
}

function createTargetInstruction(current) {
  const detail = getDetailText(current) || 'Use this role\'s ability text from the script.'
  const targetType = current.action?.targetType || current.action?.target || null
  const targetCount = Math.max(1, Number(current.action?.targetCount) || 1)

  if (current.action?.infoOnly || targetType === 'self') {
    return `📖 Give ${current.playerLabel} this information: ${detail}`
  }

  if (targetType === 'text') {
    return `📝 Send ${current.playerLabel} this information: ${detail}`
  }

  if (targetType === 'role' || targetType === 'character') {
    return `🎭 Have ${current.playerLabel} choose ${formatCount(targetCount, 'character')}. Resolve ${current.roleName}: ${detail}`
  }

  if (isPlayerTarget(targetType)) {
    return `👤 Have ${current.playerLabel} choose ${formatCount(targetCount, 'player')}. Resolve ${current.roleName}: ${detail}`
  }

  return `📋 Resolve ${current.roleName} for ${current.playerLabel}: ${detail}`
}

function getRoleId(current) {
  return String(current.action?.roleId || '')
    .trim()
    .toLowerCase()
}

function getDetailText(current) {
  return truncate(current.details || current.prompt || '', 650)
}

function isPlayerTarget(targetType) {
  return String(targetType || '').includes('player')
}

function formatCount(count, noun) {
  return count === 1 ? `1 ${noun}` : `${count} ${noun}s`
}

function compactLines(lines) {
  return lines.filter(Boolean)
}

module.exports = {
  createCurrentInstructionText
}
