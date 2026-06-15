const {
  getActiveReminderTokenTypes
} = require('../../../../utils/storytellerDashboard/grimoireView')
const {
  formatRoleWithEmoji
} = require('../../../../utils/roleFormatting')

const COPY_NOTE_PREFIX = 'Demon bluffs: '

function copySpyGrimoireToPrivateNotes(game, view, ownerId) {
  const playerIds = (view?.users?.players || []).filter(Boolean)
  if (!game || !ownerId || !playerIds.length) return 0

  game.playerGrimoires ??= {}
  const existingNotes = game.playerGrimoires[ownerId] || {}
  const nextNotes = { ...existingNotes }

  for (const playerId of playerIds) {
    const existing = normalizeCopiedTargetNote(existingNotes[playerId])
    nextNotes[playerId] = {
      ...existing,
      note: mergeCopiedBluffNote(existing.note, formatCopiedDemonBluffs(view, playerId)),
      roleId: view?.engine?.roles?.[playerId] || null,
      tokens: [...getActiveReminderTokenTypes(view, playerId)]
    }
  }

  game.playerGrimoires[ownerId] = nextNotes
  return playerIds.length
}

function normalizeCopiedTargetNote(note = {}) {
  if (typeof note === 'string') return { roleId: note || null, note: '', tokens: [] }
  return {
    roleId: note?.roleId || null,
    note: String(note?.note || ''),
    tokens: Array.isArray(note?.tokens) ? note.tokens.filter(Boolean) : []
  }
}

function formatCopiedDemonBluffs(view, playerId) {
  const roleIds = view?.engine?.demonNotInPlayRoles?.[playerId] || []
  if (!roleIds.length) return ''
  return `${COPY_NOTE_PREFIX}${roleIds.map(roleId => formatRoleWithEmoji(view, roleId)).join(', ')}`
}

function mergeCopiedBluffNote(note, copiedBluffNote) {
  const lines = String(note || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith(COPY_NOTE_PREFIX))
  if (copiedBluffNote) lines.push(copiedBluffNote)
  return lines.join('\n')
}

module.exports = {
  copySpyGrimoireToPrivateNotes
}
