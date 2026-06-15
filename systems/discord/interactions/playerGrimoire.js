const {
  PLAYER_GRIMOIRE_NOTE_INPUT_ID,
  createPlayerGrimoireNoteModal,
  createPlayerGrimoirePayload,
  parsePlayerGrimoireCustomId
} = require('../../../utils/playerGrimoire')
const {
  createPlayerSelectPayload
} = require('../../../utils/playerGrimoirePlayerSelect')
const {
  editDashboardLifecycleFailure,
  replyPrivatePayload,
  replyPrivateSystem,
  showInteractionModal,
  updateInteraction
} = require('./feedback')
const {
  resolveTestPlayerInteractionMember
} = require('./testPlayerSimulation')

function createPlayerGrimoireInteractionSystem({
  gameLifecycle,
  getPlayerLabels
}) {
  async function handlePlayerGrimoireInteraction(interaction) {
    const parsed = parsePlayerGrimoireCustomId(interaction.customId)
    if (!parsed) return null

    const guildId = interaction.guild.id
    const view = gameLifecycle.getGameView(guildId)
    const game = gameLifecycle.get(guildId)
    const ownerId = parsed.ownerId || interaction.member.id
    const actorMember = resolveTestPlayerInteractionMember({
      game,
      gameLifecycle,
      interaction,
      playerId: ownerId,
      view
    })
    const actorId = actorMember?.id || interaction.member.id
    const access = validatePlayerGrimoireAccess(view, actorId, { ...parsed, ownerId: actorId }, game)
    if (!access.ok) {
      return replyPrivateSystem(
        interaction,
        access.title,
        access.message,
        access.suggestion
      )
    }

    const selectedTargetId = getSelectedTargetId(interaction, parsed)
    const notes = gameLifecycle.getPlayerGrimoireNotes(guildId, actorId)
    const playerLabels = await getPlayerLabels(interaction.client, guildId, view)

    if (parsed.action === 'open') {
      return replyPrivatePayload(interaction, createPlayerGrimoirePayload({
        view,
        ownerId: actorId,
        notes,
        selectedTargetId,
        playerLabels
      }))
    }

    if (parsed.action === 'target' && !parsed.targetId) {
      return updateInteraction(interaction, createPlayerSelectPayload({
        view,
        ownerId: actorId,
        notes,
        selectedTargetId,
        playerLabels
      }))
    }

    if (parsed.action === 'note' && interaction.isButton?.()) {
      return showInteractionModal(
        interaction,
        createPlayerGrimoireNoteModal(selectedTargetId, notes[selectedTargetId]?.note || '', actorId)
      )
    }

    let result = { ok: true }

    if (parsed.action === 'role') {
      result = gameLifecycle.setPlayerGrimoireGuess(
        guildId,
        actorMember,
        parsed.targetId,
        interaction.values?.[0]
      )
    }

    if (parsed.action === 'tokens') {
      result = gameLifecycle.setPlayerGrimoireTokens(
        guildId,
        actorMember,
        parsed.targetId,
        interaction.values || []
      )
    }

    if (parsed.action === 'clear') {
      result = gameLifecycle.setPlayerGrimoireGuess(
        guildId,
        actorMember,
        parsed.targetId,
        null
      )
    }

    if (parsed.action === 'clear-note') {
      result = gameLifecycle.clearPlayerGrimoireNote(
        guildId,
        actorMember,
        parsed.targetId
      )
    }

    if (parsed.action === 'note' && interaction.isModalSubmit?.()) {
      result = gameLifecycle.setPlayerGrimoireNote(
        guildId,
        actorMember,
        parsed.targetId,
        interaction.fields.getTextInputValue(PLAYER_GRIMOIRE_NOTE_INPUT_ID)
      )
    }

    if (!result.ok) {
      if (interaction.isModalSubmit?.()) {
        return replyPrivateSystem(
          interaction,
          'Grimoire update failed',
          result.error?.message || 'Unknown error',
          'Open `/grimoire` again, then try updating that player note.'
        )
      }

      return editDashboardLifecycleFailure(interaction, result)
    }

    const nextView = gameLifecycle.getGameView(guildId)
    const nextNotes = mergePlayerGrimoireResult(
      gameLifecycle.getPlayerGrimoireNotes(guildId, actorId),
      result
    )
    const payload = createPlayerGrimoirePayload({
      view: nextView,
      ownerId: actorId,
      notes: nextNotes,
      selectedTargetId,
      playerLabels: await getPlayerLabels(interaction.client, guildId, nextView)
    })

    return refreshPlayerGrimoireSurface(interaction, payload)
  }

  return { handlePlayerGrimoireInteraction }
}

function refreshPlayerGrimoireSurface(interaction, payload) {
  const canEditReply = (interaction.deferred || interaction.replied) && typeof interaction.editReply === 'function'
  if (typeof interaction.update === 'function' || canEditReply) {
    return updateInteraction(interaction, payload)
  }

  return replyPrivatePayload(interaction, payload)
}

function validatePlayerGrimoireAccess(view, userId, parsed, game = null) {
  if (!view || !(view.users.players || []).includes(userId)) {
    return {
      ok: false,
      title: 'Grimoire unavailable',
      message: 'Only active players can use a personal player grimoire.'
    }
  }

  if (parsed.action === 'open' && !isCurrentSeatOpenButton(game, userId, parsed.ownerId)) {
    return {
      ok: false,
      title: 'Private grimoire',
      message: 'You can only open your own player-facing grimoire.',
      suggestion: 'Use `/grimoire` or your own cottage Grimoire button.'
    }
  }

  return { ok: true }
}

function isCurrentSeatOpenButton(game, userId, ownerId) {
  if (ownerId === userId) return true
  const history = game?.users?.[userId]?.substitutionHistory
  if (!history) return false
  if (history.originalPlayerId === ownerId) return true
  return Array.isArray(history.previousPlayerIds) && history.previousPlayerIds.includes(ownerId)
}

function getSelectedTargetId(interaction, parsed) {
  if (parsed.action === 'target') return parsed.targetId || interaction.values?.[0] || null
  return parsed.targetId
}

function mergePlayerGrimoireResult(notes, result) {
  if (!result?.targetId) return notes
  const targetId = result.targetId
  const next = { ...(notes || {}) }
  const note = normalizeNoteForMerge(next[targetId])

  if (Object.prototype.hasOwnProperty.call(result, 'roleId')) note.roleId = result.roleId || null
  if (Object.prototype.hasOwnProperty.call(result, 'note')) note.note = String(result.note || '')
  if (Object.prototype.hasOwnProperty.call(result, 'tokens')) note.tokens = Array.isArray(result.tokens) ? result.tokens : []

  if (!note.roleId && !note.note && !note.tokens.length) delete next[targetId]
  else next[targetId] = note
  return next
}

function normalizeNoteForMerge(note = {}) {
  if (typeof note === 'string') return { roleId: note || null, note: '', tokens: [] }
  return {
    roleId: note?.roleId || null,
    note: String(note?.note || ''),
    tokens: Array.isArray(note?.tokens) ? note.tokens : []
  }
}

module.exports = {
  createPlayerGrimoireInteractionSystem,
  isCurrentSeatOpenButton,
  validatePlayerGrimoireAccess
}
