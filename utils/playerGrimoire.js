const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js')
const {
  getRoleEmoji
} = require('./storytellerDashboard/roleEmojis')
const {
  applyButtonEmoji
} = require('./buttonEmoji')
const {
  formatRoleWithArticle
} = require('./roleFormatting')
const {
  createPlayerSeatingMapFields
} = require('./playerGrimoireSeatingMap')
const {
  createSelectPlayerButtonRow
} = require('./playerGrimoirePlayerSelect')
const {
  createPlayerReminderTokenOptions,
  normalizePlayerReminderTokens
} = require('./playerGrimoireTokens')
const {
  createSelectedPlayerNoteField
} = require('./playerGrimoireNoteField')
const {
  PLAYER_GRIMOIRE_ACTIONS,
  createOwnerScopedPlayerGrimoireCustomId,
  isPlayerGrimoireInteraction,
  parsePlayerGrimoireCustomId
} = require('./playerGrimoireCustomIds')

const PLAYER_GRIMOIRE_NOTE_INPUT_ID = 'player-grimoire-note'

function createPlayerGrimoirePayload({ view, ownerId, notes = {}, selectedTargetId = null, playerLabels = {} }) {
  const targetId = getSelectedTargetId(view, ownerId, selectedTargetId)
  const embed = new EmbedBuilder()
    .setTitle('Your Grimoire')
    .setDescription('Private notes only. These do not change the real Grimoire or anyone else\'s notes.')
    .setColor(0x8e44ad)
    .addFields(...createPlayerGrimoireFields(view, ownerId, notes, playerLabels, targetId))
    .setTimestamp()

  const components = [
    createSelectPlayerButtonRow(view, ownerId, targetId, notes, playerLabels),
    createRoleSelectRow(view, ownerId, targetId, notes[targetId]),
    createTokenSelectRow(ownerId, targetId, notes[targetId]),
    createActionsRow(ownerId, targetId, notes[targetId])
  ].filter(Boolean)

  return { embeds: [embed], components }
}

function createPlayerGrimoireOpenButton(ownerId) {
  return new ButtonBuilder()
    .setCustomId(createPlayerGrimoireOpenCustomId(ownerId))
    .setEmoji('\u{1F52E}')
    .setLabel('Your Grimoire')
    .setStyle(ButtonStyle.Secondary)
}

function createPlayerGrimoireOpenRow(ownerId) {
  return new ActionRowBuilder().addComponents(createPlayerGrimoireOpenButton(ownerId))
}

function createPlayerGrimoireFields(view, ownerId, notes, playerLabels, selectedTargetId = null) {
  const fields = createPlayerSeatingMapFields(view, ownerId, notes, playerLabels)
  const noteField = createSelectedPlayerNoteField(view, selectedTargetId, notes, playerLabels)
  if (noteField) fields.push(noteField)
  return fields
}

function createPlayerGrimoireOpenCustomId(ownerId) {
  return createOwnerScopedPlayerGrimoireCustomId('open', ownerId)
}

function createPlayerGrimoireRoleCustomId(targetId, ownerId = null) {
  return createOwnerScopedPlayerGrimoireCustomId('role', ownerId, targetId)
}

function createPlayerGrimoireTokenCustomId(targetId, ownerId = null) {
  return createOwnerScopedPlayerGrimoireCustomId('tokens', ownerId, targetId)
}

function createPlayerGrimoireClearCustomId(targetId, ownerId = null) {
  return createOwnerScopedPlayerGrimoireCustomId('clear', ownerId, targetId)
}

function createPlayerGrimoireNoteCustomId(targetId, ownerId = null) {
  return createOwnerScopedPlayerGrimoireCustomId('note', ownerId, targetId)
}

function createPlayerGrimoireClearNoteCustomId(targetId, ownerId = null) {
  return createOwnerScopedPlayerGrimoireCustomId('clearNote', ownerId, targetId)
}

function createPlayerGrimoireNoteModal(targetId, note = '', ownerId = null) {
  return new ModalBuilder()
    .setCustomId(createPlayerGrimoireNoteCustomId(targetId, ownerId))
    .setTitle('Player Notes')
    .addComponents(new ActionRowBuilder().addComponents(createNoteInput(note)))
}

function createNoteInput(note) {
  const input = new TextInputBuilder()
    .setCustomId(PLAYER_GRIMOIRE_NOTE_INPUT_ID)
    .setLabel('Private note')
    .setPlaceholder('What do you believe about this player?')
    .setRequired(false)
    .setMaxLength(1000)
    .setStyle(TextInputStyle.Paragraph)

  if (note) input.setValue(String(note).slice(0, 1000))
  return input
}

function getSelectedTargetId(view, ownerId, selectedTargetId) {
  const targets = getTargetPlayerIds(view, ownerId)
  if (targets.includes(selectedTargetId)) return selectedTargetId
  return targets[0] || null
}

function getTargetPlayerIds(view) {
  return (view?.users?.players || []).filter(Boolean)
}

function createRoleSelectRow(view, ownerId, selectedTargetId, targetNote) {
  if (!selectedTargetId) return null
  const selectedRoleId = getBelievedRoleId(view, ownerId, selectedTargetId, normalizeTargetNote(targetNote))
  const options = getRoleOptions(view, selectedRoleId)
  if (!options.length) return null

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(createPlayerGrimoireRoleCustomId(selectedTargetId, ownerId))
      .setPlaceholder('Choose who you think they are')
      .addOptions(options)
  )
}

function createTokenSelectRow(ownerId, selectedTargetId, targetNote) {
  if (!selectedTargetId) return null
  const note = normalizeTargetNote(targetNote)
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(createPlayerGrimoireTokenCustomId(selectedTargetId, ownerId))
      .setPlaceholder('Choose reminder tokens')
      .setMinValues(0)
      .setMaxValues(8)
      .addOptions(createPlayerReminderTokenOptions(note.tokens))
  )
}

function createActionsRow(ownerId, selectedTargetId, targetNote) {
  if (!selectedTargetId) return null
  const note = normalizeTargetNote(targetNote)
  const buttons = [
    new ButtonBuilder()
      .setCustomId(createPlayerGrimoireNoteCustomId(selectedTargetId, ownerId))
      .setEmoji(note.note ? '\u{1F4DD}' : '\u{2795}')
      .setLabel(note.note ? 'Edit note' : 'Add note')
      .setStyle(ButtonStyle.Primary)
  ]

  if (note.note) {
    buttons.push(applyButtonEmoji(new ButtonBuilder()
      .setCustomId(createPlayerGrimoireClearNoteCustomId(selectedTargetId, ownerId))
      .setLabel('Delete note')
      .setStyle(ButtonStyle.Secondary), 'Delete note'))
  }

  if (note.roleId) {
    buttons.push(applyButtonEmoji(new ButtonBuilder()
      .setCustomId(createPlayerGrimoireClearCustomId(selectedTargetId, ownerId))
      .setLabel('Clear role')
      .setStyle(ButtonStyle.Secondary), 'Clear role'))
  }

  return new ActionRowBuilder().addComponents(buttons)
}

function getRoleOptions(view, selectedRoleId) {
  const categories = view?.engine?.roleCategories || {}
  const roleIds = ['townsfolk', 'outsider', 'minion', 'demon']
    .flatMap(team => categories[team] || [])

  return [...new Set(roleIds)].slice(0, 25).map(roleId => ({
    label: formatRoleWithArticle(view, roleId).slice(0, 100),
    value: roleId,
    emoji: getRoleEmoji(view, roleId),
    default: roleId === selectedRoleId
  }))
}

function getBelievedRoleId(view, ownerId, playerId, note) {
  if (note?.roleId) return note.roleId
  if (playerId !== ownerId) return null
  return view?.engine?.shownRoles?.[ownerId] || view?.engine?.roles?.[ownerId] || null
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
  PLAYER_GRIMOIRE_ACTIONS,
  PLAYER_GRIMOIRE_NOTE_INPUT_ID,
  createPlayerGrimoireFields,
  createPlayerGrimoireNoteModal,
  createPlayerGrimoireOpenButton,
  createPlayerGrimoireOpenCustomId,
  createPlayerGrimoireOpenRow,
  createPlayerGrimoirePayload,
  isPlayerGrimoireInteraction,
  parsePlayerGrimoireCustomId
}
