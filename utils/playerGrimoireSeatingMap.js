const {
  createSeatLayout
} = require('./votingSeatingMap')
const {
  HIDDEN_ROLE_EMOJI,
  getRoleEmoji,
  getRoleTeam
} = require('./storytellerDashboard/roleEmojis')
const {
  formatPlayerNameWithEmoji
} = require('./playerGrimoireDisplay')
const {
  getPlayerReminderTokenEmojiStack,
  normalizePlayerReminderTokens
} = require('./playerGrimoireTokens')
const {
  EMPTY_CELL
} = require('./seatingConstants')

const MAX_SEATING_PLAYERS = 15

function createPlayerSeatingMapFields(view, ownerId, notes = {}, playerLabels = {}) {
  const order = getPlayerOrder(view)
  if (!order.length) return []

  const layout = createSeatLayout(order.length)
  const fields = [
    createSpacerCell(),
    createSeatCell(view, ownerId, notes, playerLabels, order[0], 'Seating order'),
    createSpacerCell()
  ]

  for (let index = 0; index < layout.leftIndexes.length; index += 1) {
    fields.push(
      createSeatCell(view, ownerId, notes, playerLabels, order[layout.leftIndexes[index]]),
      createSpacerCell(),
      createSeatCell(view, ownerId, notes, playerLabels, order[layout.rightIndexes[index]])
    )
  }

  if (layout.southIndex !== null) {
    fields.push(
      createSpacerCell(),
      createSeatCell(view, ownerId, notes, playerLabels, order[layout.southIndex]),
      createSpacerCell()
    )
  }

  return fields
}

function createPlayerSeatingMapField(view, ownerId, notes = {}, playerLabels = {}) {
  const fields = createPlayerSeatingMapFields(view, ownerId, notes, playerLabels)
  return fields.length ? fields[1] : null
}

function getSouthSeatIndex(playerCount) {
  return createSeatLayout(playerCount).southIndex
}

function createSeatCell(view, ownerId, notes, playerLabels, playerId, heading = null) {
  const seat = createSeatBlock(view, ownerId, notes, playerLabels, playerId)
  return {
    name: heading || seat.label,
    value: heading ? `${seat.label}\n${seat.metadata || EMPTY_CELL}` : seat.metadata || EMPTY_CELL,
    inline: true
  }
}

function createSpacerCell() {
  return {
    name: EMPTY_CELL,
    value: EMPTY_CELL,
    inline: true
  }
}

function createSeatBlock(view, ownerId, notes, playerLabels, playerId) {
  const note = normalizeTargetNote(notes[playerId])
  const roleId = getBelievedRoleId(view, ownerId, playerId, note)
  const playerName = getPlayerLabel(view, playerLabels, playerId)
  return {
    label: formatPlayerNameWithEmoji(playerName, getBelievedRoleEmoji(view, roleId, playerId)),
    metadata: createMetadataLine(view, note)
  }
}

function createMetadataLine(view, note) {
  const parts = []
  const tokenStack = getPrivateTokenEmoji(note)
  if (tokenStack) parts.push(tokenStack)
  if (note.roleId) parts.push(getBeliefTeamLabel(view, note.roleId))
  if (note.note) parts.push('Custom')
  return parts.join('/')
}

function getBelievedRoleEmoji(view, roleId, playerId = null) {
  if (!roleId) return HIDDEN_ROLE_EMOJI
  if (roleId === 'drunk' && playerId) {
    const shownRoleId = view?.engine?.shownRoles?.[playerId]
    const shownEmoji = shownRoleId ? getRoleEmoji(view, shownRoleId) : null
    return shownEmoji ? `${getRoleEmoji(view, roleId)} (${shownEmoji})` : getRoleEmoji(view, roleId)
  }
  return getRoleEmoji(view, roleId)
}

function getPrivateTokenEmoji(note) {
  const stack = getPlayerReminderTokenEmojiStack(note)
  return stack === '—' ? '' : stack
}

function getPlayerOrder(view) {
  return (view?.users?.players || []).filter(Boolean).slice(0, MAX_SEATING_PLAYERS)
}

function getBeliefTeamLabel(view, roleId) {
  const team = getRoleTeam(view, roleId)
  if (team === 'townsfolk' || team === 'outsider') return 'Good'
  if (team === 'minion' || team === 'demon') return 'Evil'
  return 'Unknown'
}

function getBelievedRoleId(view, ownerId, playerId, note) {
  if (note?.roleId) return note.roleId
  if (playerId !== ownerId) return null
  return view?.engine?.shownRoles?.[ownerId] || view?.engine?.roles?.[ownerId] || null
}

function getPlayerLabel(view, playerLabels, playerId) {
  return playerLabels[playerId] || view?.users?.displayNames?.[playerId] || `Player ${String(playerId).slice(-4)}`
}

function normalizeTargetNote(note) {
  if (typeof note === 'string') return { roleId: note || null, note: '', tokens: [] }
  return {
    roleId: note?.roleId || null,
    note: String(note?.note || ''),
    tokens: normalizePlayerReminderTokens(note?.tokens || [])
  }
}

module.exports = {
  EMPTY_CELL,
  MAX_SEATING_PLAYERS,
  createMetadataLine,
  createPlayerSeatingMapField,
  createPlayerSeatingMapFields,
  getBeliefTeamLabel,
  getBelievedRoleEmoji,
  getPrivateTokenEmoji,
  getSouthSeatIndex
}
