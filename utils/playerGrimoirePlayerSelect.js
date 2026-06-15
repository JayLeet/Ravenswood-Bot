const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js')
const {
  formatPlayerNameWithEmoji
} = require('./playerGrimoireDisplay')
const {
  createPlayerSeatingMapField,
  getBelievedRoleEmoji,
  getPrivateTokenEmoji
} = require('./playerGrimoireSeatingMap')
const {
  createOwnerScopedPlayerGrimoireCustomId
} = require('./playerGrimoireCustomIds')
const {
  createSeatLayout
} = require('./votingSeatingMap')

const BLANK_CUSTOM_ID_PREFIX = 'botc:player-grim:blank'
const BLANK_BUTTON_LABEL = '\u00B7'
const BUTTON_LABEL_WIDTH = 13
const DISCORD_BUTTON_LABEL_MAX_LENGTH = 80

function createSelectPlayerButtonRow(view, ownerId, selectedTargetId, notes = {}, playerLabels = {}) {
  const buttons = [
    new ButtonBuilder()
      .setCustomId(createOwnerTargetCustomId(ownerId))
      .setLabel('Select Player')
      .setStyle(ButtonStyle.Primary)
  ]

  const selectedLabel = getSelectedPlayerLabel(view, notes, playerLabels, selectedTargetId)
  if (selectedLabel) {
    buttons.push(new ButtonBuilder()
      .setCustomId(createSelectedPlayerDisplayCustomId(ownerId, selectedTargetId))
      .setLabel(selectedLabel)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true))
  }

  return new ActionRowBuilder().addComponents(...buttons)
}

function createPlayerSelectPayload({ view, ownerId, notes = {}, selectedTargetId = null, playerLabels = {} }) {
  const embed = new EmbedBuilder()
    .setTitle('Select Player')
    .setDescription('Choose who you want to edit in your private grimoire.')
    .setColor(0x8e44ad)
    .setTimestamp()
  const seatingMap = createPlayerSeatingMapField(view, ownerId, notes, playerLabels)
  if (seatingMap) embed.addFields(seatingMap)

  return {
    embeds: [embed],
    components: createPlayerButtonRows(view, ownerId, notes, selectedTargetId, playerLabels)
  }
}

function createPlayerButtonRows(view, ownerId, notes = {}, selectedTargetId = null, playerLabels = {}) {
  const playerIds = getPlayerIds(view)
  if (playerIds.length <= 8) {
    return createSeatingButtonRows(playerIds).map((row, rowIndex) => createButtonRow(
      row,
      rowIndex,
      view,
      ownerId,
      notes,
      selectedTargetId,
      playerLabels
    ))
  }

  return createCompactButtonRows(playerIds).map(row => new ActionRowBuilder().addComponents(
    ...row.map(playerId => createPlayerButton(view, ownerId, notes, selectedTargetId, playerLabels, playerId))
  ))
}

function createButtonRow(row, rowIndex, view, ownerId, notes, selectedTargetId, playerLabels) {
  return new ActionRowBuilder().addComponents(
    ...row.map((playerId, columnIndex) => playerId
      ? createPlayerButton(view, ownerId, notes, selectedTargetId, playerLabels, playerId)
      : createBlankButton(rowIndex, columnIndex))
  )
}

function createSeatingButtonRows(playerIds) {
  if (!playerIds.length) return []
  if (playerIds.length === 1) return [[null, playerIds[0], null]]
  const rows = [[null, playerIds[0], null]]
  const layout = createSeatLayout(playerIds.length)

  for (let index = 0; index < layout.leftIndexes.length; index += 1) {
    rows.push([
      playerIds[layout.leftIndexes[index]] || null,
      null,
      playerIds[layout.rightIndexes[index]] || null
    ])
  }

  if (layout.southIndex !== null) rows.push([null, playerIds[layout.southIndex], null])
  return rows.slice(0, 5)
}

function createCompactButtonRows(playerIds) {
  const rows = []
  for (let index = 0; index < playerIds.length && rows.length < 5; index += 5) {
    rows.push(playerIds.slice(index, index + 5))
  }
  return rows
}

function createPlayerButton(view, ownerId, notes, selectedTargetId, playerLabels, playerId) {
  return new ButtonBuilder()
    .setCustomId(createOwnerTargetCustomId(ownerId, playerId))
    .setLabel(padButtonLabel(createPlayerButtonLabel(view, ownerId, notes, playerLabels, playerId)))
    .setStyle(playerId === selectedTargetId ? ButtonStyle.Primary : ButtonStyle.Secondary)
}

function createBlankButton(rowIndex, columnIndex) {
  return new ButtonBuilder()
    .setCustomId(`${BLANK_CUSTOM_ID_PREFIX}:${rowIndex}:${columnIndex}`)
    .setLabel(BLANK_BUTTON_LABEL)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true)
}

function createPlayerButtonLabel(view, ownerId, notes, playerLabels, playerId) {
  const roleId = getBelievedRoleId(view, ownerId, playerId, notes[playerId])
  const label = getPlayerLabel(view, playerLabels, playerId)
  return formatPlayerNameWithEmoji(label, getBelievedRoleEmoji(view, roleId))
}

function padButtonLabel(label) {
  const text = String(label || '')
  if (text.length >= BUTTON_LABEL_WIDTH) return text
  const missing = BUTTON_LABEL_WIDTH - text.length
  const left = Math.floor(missing / 2)
  const right = missing - left
  return `${'\u2007'.repeat(left)}${text}${'\u2007'.repeat(right)}`
}

function createOwnerTargetCustomId(ownerId, playerId = null) {
  return createOwnerScopedPlayerGrimoireCustomId('target', ownerId, playerId)
}

function createSelectedPlayerDisplayCustomId(ownerId, selectedTargetId) {
  return `${createOwnerTargetCustomId(ownerId, selectedTargetId)}:selected`
}

function getSelectedPlayerLabel(view, notes, playerLabels, selectedTargetId) {
  if (!selectedTargetId) return null
  const name = getPlayerLabel(view, playerLabels, selectedTargetId)
  const tokens = getPrivateTokenEmoji(notes[selectedTargetId])
  if (!tokens) return name.slice(0, DISCORD_BUTTON_LABEL_MAX_LENGTH)
  const suffix = ` ${tokens}`
  if ((name + suffix).length <= DISCORD_BUTTON_LABEL_MAX_LENGTH) return `${name}${suffix}`
  const maxNameLength = Math.max(1, DISCORD_BUTTON_LABEL_MAX_LENGTH - suffix.length - 3)
  return `${name.slice(0, maxNameLength)}...${suffix}`
}

function getPlayerIds(view) {
  return (view?.users?.players || []).filter(Boolean).slice(0, 25)
}

function getBelievedRoleId(view, ownerId, playerId, note = {}) {
  if (note?.roleId) return note.roleId
  if (playerId !== ownerId) return null
  return view?.engine?.shownRoles?.[ownerId] || view?.engine?.roles?.[ownerId] || null
}

function getPlayerLabel(view, playerLabels, playerId) {
  return playerLabels[playerId] || view?.users?.displayNames?.[playerId] || `Player ${String(playerId).slice(-4)}`
}

module.exports = {
  createPlayerButtonRows,
  createPlayerSelectPayload,
  createSelectPlayerButtonRow,
  createOwnerTargetCustomId,
  padButtonLabel
}
