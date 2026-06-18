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
  createCompactButtonLayout,
  createSpacerButtonLabel,
  createSeatingButtonLayout,
  getButtonLabelWidth,
  padButtonLabel
} = require('./seatingButtonLayout')

const BLANK_CUSTOM_ID_PREFIX = 'botc:player-grim:blank'
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
    const labelWidth = getButtonLabelWidth(playerIds.map(playerId =>
      createPlayerButtonLabel(view, ownerId, notes, playerLabels, playerId)
    ))
    return createSeatingButtonLayout(playerIds, { maxRows: 5 }).map((row, rowIndex) => createButtonRow(
      row,
      rowIndex,
      view,
      ownerId,
      notes,
      selectedTargetId,
      playerLabels,
      labelWidth
    ))
  }

  return createCompactButtonLayout(playerIds, { maxRows: 5 }).map(row => new ActionRowBuilder().addComponents(
    ...row.map(playerId => createPlayerButton(view, ownerId, notes, selectedTargetId, playerLabels, playerId))
  ))
}

function createButtonRow(row, rowIndex, view, ownerId, notes, selectedTargetId, playerLabels, labelWidth) {
  return new ActionRowBuilder().addComponents(
    ...row.map((playerId, columnIndex) => playerId
      ? createPlayerButton(view, ownerId, notes, selectedTargetId, playerLabels, playerId, labelWidth)
      : createBlankButton(rowIndex, columnIndex, labelWidth))
  )
}

function createPlayerButton(view, ownerId, notes, selectedTargetId, playerLabels, playerId, labelWidth) {
  return new ButtonBuilder()
    .setCustomId(createOwnerTargetCustomId(ownerId, playerId))
    .setLabel(padButtonLabel(createPlayerButtonLabel(view, ownerId, notes, playerLabels, playerId), labelWidth))
    .setStyle(playerId === selectedTargetId ? ButtonStyle.Primary : ButtonStyle.Secondary)
}

function createBlankButton(rowIndex, columnIndex, labelWidth) {
  return new ButtonBuilder()
    .setCustomId(`${BLANK_CUSTOM_ID_PREFIX}:${rowIndex}:${columnIndex}`)
    .setLabel(createSpacerButtonLabel(labelWidth))
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true)
}

function createPlayerButtonLabel(view, ownerId, notes, playerLabels, playerId) {
  const roleId = getBelievedRoleId(view, ownerId, playerId, notes[playerId])
  const label = getPlayerLabel(view, playerLabels, playerId)
  return formatPlayerNameWithEmoji(label, getBelievedRoleEmoji(view, roleId))
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
