const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js')
const {
  applyButtonEmoji
} = require('../buttonEmoji')
const {
  formatPlayerNameWithEmoji
} = require('../playerGrimoireDisplay')
const {
  SPACER_BUTTON_LABEL,
  createCompactButtonLayout,
  createSpacerButtonLabel,
  createSeatingButtonLayout,
  getButtonLabelWidth,
  padButtonLabel
} = require('../seatingButtonLayout')
const {
  createGrimoireCustomId
} = require('./constants')
const {
  truncate
} = require('./formatters')
const {
  getRoleEmoji
} = require('./roleEmojis')

const BLANK_CUSTOM_ID_PREFIX = 'botc:storyteller-grim:blank'
const MAX_COMPONENT_ROWS = 5
const MAX_PLAYER_BUTTONS = 20

function createFullGrimoireComponents(view, playerLabels = {}, toggleLabel, toggleCustomId) {
  return [
    createFullGrimoireControlRow(toggleLabel, toggleCustomId),
    ...createPlayerButtonRows(view, playerLabels, { maxRows: MAX_COMPONENT_ROWS - 1 })
  ]
}

function createFullGrimoireControlRow(toggleLabel, toggleCustomId) {
  return new ActionRowBuilder().addComponents(
    createButton('Back', createGrimoireCustomId('dashboard'), ButtonStyle.Secondary),
    createButton(toggleLabel, toggleCustomId, ButtonStyle.Primary)
  )
}

function createPlayerButtonRows(view, playerLabels = {}, options = {}) {
  const players = (view?.users?.players || []).filter(Boolean).slice(0, MAX_PLAYER_BUTTONS)
  const maxRows = options.maxRows || MAX_COMPONENT_ROWS
  const seatingRows = createSeatingButtonLayout(players)
  const useSeatingRows = seatingRows.length && seatingRows.length <= maxRows
  const labelWidth = useSeatingRows
    ? getButtonLabelWidth(players.map(playerId => createPlayerButtonLabel(view, playerLabels, playerId)))
    : undefined
  const rows = useSeatingRows
    ? seatingRows
    : createCompactButtonLayout(players, { maxRows })

  return rows.map((row, rowIndex) => new ActionRowBuilder().addComponents(
    ...row.map((playerId, columnIndex) => playerId
      ? createPlayerButton(view, playerLabels, playerId, labelWidth)
      : createBlankButton(rowIndex, columnIndex, labelWidth))
  ))
}

function createPlayerButton(view, playerLabels, playerId, labelWidth) {
  return createButton(
    labelWidth
      ? padButtonLabel(createPlayerButtonLabel(view, playerLabels, playerId), labelWidth)
      : createPlayerButtonLabel(view, playerLabels, playerId),
    createGrimoireCustomId('player', playerId),
    ButtonStyle.Secondary
  )
}

function createBlankButton(rowIndex, columnIndex, labelWidth) {
  return new ButtonBuilder()
    .setCustomId(`${BLANK_CUSTOM_ID_PREFIX}:${rowIndex}:${columnIndex}`)
    .setLabel(createSpacerButtonLabel(labelWidth))
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true)
}

function createPlayerButtonLabel(view, playerLabels, playerId) {
  const roleId = view?.engine?.roles?.[playerId]
  return truncate(formatPlayerNameWithEmoji(getPlayerLabel(playerId, playerLabels), roleId ? getRoleEmoji(view, roleId) : null), 80)
}

function getPlayerLabel(playerId, playerLabels = {}) {
  return playerLabels[playerId] || `Player ${String(playerId).slice(-4)}`
}

function createButton(label, customId, style) {
  return applyButtonEmoji(
    new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style),
    label
  )
}

module.exports = {
  SPACER_BUTTON_LABEL,
  createFullGrimoireComponents,
  createFullGrimoireControlRow,
  createPlayerButtonRows,
  createPlayerButtonLabel
}
