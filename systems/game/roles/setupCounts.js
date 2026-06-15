const TEAM_KEYS = ['townsfolk', 'outsider', 'minion', 'demon']
const DRUNK_ROLE_ID = 'drunk'

const BASE_SETUP_COUNTS = Object.freeze({
  5: { townsfolk: 3, outsider: 0, minion: 1, demon: 1 },
  6: { townsfolk: 3, outsider: 1, minion: 1, demon: 1 },
  7: { townsfolk: 5, outsider: 0, minion: 1, demon: 1 },
  8: { townsfolk: 5, outsider: 1, minion: 1, demon: 1 },
  9: { townsfolk: 5, outsider: 2, minion: 1, demon: 1 },
  10: { townsfolk: 7, outsider: 0, minion: 2, demon: 1 },
  11: { townsfolk: 7, outsider: 1, minion: 2, demon: 1 },
  12: { townsfolk: 7, outsider: 2, minion: 2, demon: 1 },
  13: { townsfolk: 9, outsider: 0, minion: 3, demon: 1 },
  14: { townsfolk: 9, outsider: 1, minion: 3, demon: 1 },
  15: { townsfolk: 9, outsider: 2, minion: 3, demon: 1 }
})

const SETUP_MODIFIERS = Object.freeze({
  baron: [
    { townsfolk: -2, outsider: 2, label: 'Baron: +2 Outsiders' }
  ],
  fang_gu: [
    { townsfolk: -1, outsider: 1, label: 'Fang Gu: +1 Outsider' }
  ],
  vigormortis: [
    { townsfolk: 1, outsider: -1, label: 'Vigormortis: -1 Outsider' }
  ],
  godfather: [
    { townsfolk: -1, outsider: 1, label: 'Godfather: +1 Outsider' },
    { townsfolk: 1, outsider: -1, label: 'Godfather: -1 Outsider' }
  ]
})

function getBaseSetupCounts(playerCount) {
  return BASE_SETUP_COUNTS[playerCount] || null
}

function getSetupCountOptions(playerCount, selectedRoleIds = []) {
  const base = getBaseSetupCounts(playerCount)
  if (!base) return []

  let options = [{ counts: { ...base }, labels: [] }]

  for (const roleId of selectedRoleIds) {
    const modifiers = SETUP_MODIFIERS[roleId]
    if (!modifiers) continue

    options = options.flatMap(option => modifiers
      .map(modifier => applyModifier(option, modifier))
      .filter(next => hasValidCounts(next.counts))
    )
  }

  return options.length ? options : [{ counts: { ...base }, labels: [] }]
}

function validateSetupSelection(script, selectedRoleIds, playerCount, options = {}) {
  const selected = [...new Set(selectedRoleIds || [])]
  const roleMap = Object.fromEntries((script.roles || []).map(role => [role.id, role]))
  const invalidRole = selected.find(roleId => !roleMap[roleId])
  if (invalidRole) return failure(`Unknown script role: ${invalidRole}`)

  const hasSelectedDrunk = selected.includes(DRUNK_ROLE_ID)
  if (selected.length !== playerCount) return failure(createCountMessage(playerCount))

  const shownRoleId = options.drunkShownRoleId || null
  if (hasSelectedDrunk) {
    const shownRoleError = validateDrunkShownRole(roleMap, selected, shownRoleId)
    if (shownRoleError) return failure(shownRoleError)
  }

  for (const option of getSetupCountOptions(playerCount, selected)) {
    if (countsMatch(countTeams(roleMap, selected), option.counts)) {
      return {
        ok: true,
        actualRoleIds: selected,
        shownRoleId: hasSelectedDrunk ? shownRoleId : null,
        requiredCounts: option.counts
      }
    }
  }

  return failure(createSetupMismatchMessage(playerCount, selected, hasSelectedDrunk))
}

function validateDrunkShownRole(roleMap, selected, shownRoleId) {
  if (!shownRoleId) return 'Choose which Townsfolk character the Drunk thinks they are before confirming random roles.'
  if (!roleMap[shownRoleId]) return `Unknown Drunk shown role: ${shownRoleId}`
  if (roleMap[shownRoleId]?.team !== 'townsfolk') return 'The Drunk must think they are a Townsfolk character.'
  if (selected.includes(shownRoleId)) {
    return 'The Drunk shown character must not also be selected as a real in-play role.'
  }
  return null
}

function listAvailableSetupModifiers(script) {
  const roleIds = new Set((script.roles || []).map(role => role.id))
  return Object.entries(SETUP_MODIFIERS)
    .filter(([roleId]) => roleIds.has(roleId))
    .flatMap(([, modifiers]) => modifiers.map(modifier => modifier.label))
}

function hasDrunk(script) {
  return (script.roles || []).some(role => role.id === DRUNK_ROLE_ID)
}

function applyModifier(option, modifier) {
  const counts = { ...option.counts }
  for (const key of TEAM_KEYS) counts[key] += modifier[key] || 0
  return { counts, labels: [...option.labels, modifier.label] }
}

function hasValidCounts(counts) {
  return TEAM_KEYS.every(key => Number.isInteger(counts[key]) && counts[key] >= 0)
}

function countTeams(roleMap, roleIds) {
  const counts = { townsfolk: 0, outsider: 0, minion: 0, demon: 0 }
  for (const roleId of roleIds) counts[roleMap[roleId]?.team] += 1
  return counts
}

function countsMatch(actual, expected) {
  return TEAM_KEYS.every(key => actual[key] === expected[key])
}

function createCountMessage(playerCount) {
  return `Select exactly ${playerCount} real roles for the ${playerCount} joined player(s). If the Drunk is selected, choose their shown Townsfolk separately.`
}

function createSetupMismatchMessage(playerCount, selected, hasDrunk) {
  const options = getSetupCountOptions(playerCount, selected)
    .map(option => formatCounts(option.counts))
    .join(' or ')
  const drunkNote = hasDrunk
    ? ' Drunk selected: choose their shown Townsfolk separately; do not add it as an extra selected role.'
    : ''
  return `Selected roles do not match setup. Expected ${options}.${drunkNote}`
}

function formatCounts(counts) {
  return `${counts.townsfolk} Townsfolk, ${counts.outsider} Outsider(s), ${counts.minion} Minion(s), ${counts.demon} Demon`
}

function failure(message) {
  return { ok: false, message }
}

module.exports = {
  BASE_SETUP_COUNTS,
  DRUNK_ROLE_ID,
  SETUP_MODIFIERS,
  formatCounts,
  getBaseSetupCounts,
  getSetupCountOptions,
  hasDrunk,
  listAvailableSetupModifiers,
  validateSetupSelection
}
