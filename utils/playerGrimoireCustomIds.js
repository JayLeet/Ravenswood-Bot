const PLAYER_GRIMOIRE_PREFIX = 'botc:player-grim:'
const PLAYER_GRIMOIRE_ACTIONS = Object.freeze({
  clear: `${PLAYER_GRIMOIRE_PREFIX}clear`,
  clearNote: `${PLAYER_GRIMOIRE_PREFIX}clear-note`,
  note: `${PLAYER_GRIMOIRE_PREFIX}note`,
  open: `${PLAYER_GRIMOIRE_PREFIX}open`,
  role: `${PLAYER_GRIMOIRE_PREFIX}role`,
  target: `${PLAYER_GRIMOIRE_PREFIX}target`,
  tokens: `${PLAYER_GRIMOIRE_PREFIX}tokens`
})

function isPlayerGrimoireInteraction(customId) {
  return typeof customId === 'string' && customId.startsWith(PLAYER_GRIMOIRE_PREFIX)
}

function parsePlayerGrimoireCustomId(customId) {
  if (!isPlayerGrimoireInteraction(customId)) return null
  const [action, ...parts] = String(customId).slice(PLAYER_GRIMOIRE_PREFIX.length).split(':')
  if (action === 'open') {
    return {
      action,
      ownerId: parts.join(':') || null,
      targetId: null
    }
  }

  return {
    action,
    ...parseOwnerScopedParts(parts)
  }
}

function createOwnerScopedPlayerGrimoireCustomId(action, ownerId = null, targetId = null) {
  const actionId = PLAYER_GRIMOIRE_ACTIONS[action] || action
  if (actionId === PLAYER_GRIMOIRE_ACTIONS.open) {
    return ownerId ? `${actionId}:${ownerId}` : actionId
  }
  if (ownerId !== null && ownerId !== undefined) {
    return `${actionId}:${ownerId}:${targetId || ''}`
  }
  return targetId ? `${actionId}:${targetId}` : actionId
}

function parseOwnerScopedParts(parts) {
  if (parts.length >= 2) {
    return {
      ownerId: parts[0] || null,
      targetId: parts.slice(1).join(':') || null
    }
  }

  return {
    ownerId: null,
    targetId: parts.join(':') || null
  }
}

module.exports = {
  PLAYER_GRIMOIRE_ACTIONS,
  createOwnerScopedPlayerGrimoireCustomId,
  isPlayerGrimoireInteraction,
  parsePlayerGrimoireCustomId
}
