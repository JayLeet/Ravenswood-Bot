const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js')
const {
  isClocktowerLiveMode
} = require('../gameModes')
const {
  STORYTELLER_DASHBOARD_ACTIONS,
  createPlayerControlPlayerCustomId
} = require('./constants')
const {
  applyButtonEmoji
} = require('../buttonEmoji')
const {
  truncate
} = require('./formatters')

function createPlayerControlPanelPayload(view, selectedPlayerId = null, playerLabels = {}) {
  return {
    content: null,
    embeds: [
      new EmbedBuilder()
        .setTitle('Player Controls')
        .setDescription(createPlayerControlDescription(selectedPlayerId, playerLabels))
        .setColor(0x9b59b6)
    ],
    components: createPlayerControlButtonRows(!!selectedPlayerId, isClocktowerLiveMode(view))
  }
}

function createPlayerButtonPanelPayload(view, selectedPlayerId = null, playerLabels = {}) {
  return {
    content: null,
    embeds: [
      new EmbedBuilder()
        .setTitle('Choose Player')
        .setDescription(createPlayerControlDescription(selectedPlayerId, playerLabels))
        .setColor(0x9b59b6)
    ],
    components: [
      ...createPlayerButtonRows(view, selectedPlayerId, playerLabels),
      createPlayerControlBackRow()
    ].slice(0, 5)
  }
}

function createPlayerControlDescription(selectedPlayerId, playerLabels = {}) {
  return selectedPlayerId
    ? `Selected: ${playerLabels[selectedPlayerId] || `<@${selectedPlayerId}>`}`
    : 'No player selected yet.'
}

function createPlayerControlButtonRow(hasSelectedPlayer, clocktowerLiveMode = false) {
  return createPlayerControlButtonRows(hasSelectedPlayer, clocktowerLiveMode)[0]
}

function createPlayerControlButtonRows(hasSelectedPlayer, clocktowerLiveMode = false) {
  const buttons = [
    createButton('Select', STORYTELLER_DASHBOARD_ACTIONS.playerControlPlayers, ButtonStyle.Primary)
  ]

  if (!clocktowerLiveMode) {
    buttons.push(
      createButton('Assign Role', STORYTELLER_DASHBOARD_ACTIONS.rolePanel, ButtonStyle.Secondary, !hasSelectedPlayer),
      createButton('Clear Role', STORYTELLER_DASHBOARD_ACTIONS.clearRoleButton, ButtonStyle.Secondary, !hasSelectedPlayer)
    )
  }

  buttons.push(
    createButton('Disconnect', STORYTELLER_DASHBOARD_ACTIONS.playerControlDisconnect, ButtonStyle.Secondary, !hasSelectedPlayer),
    createButton('Kick', STORYTELLER_DASHBOARD_ACTIONS.playerControlKick, ButtonStyle.Danger, !hasSelectedPlayer)
  )

  const rows = [new ActionRowBuilder().addComponents(buttons)]

  if (!clocktowerLiveMode) {
    rows.push(new ActionRowBuilder().addComponents(
      createButton('Kill', STORYTELLER_DASHBOARD_ACTIONS.playerControlKill, ButtonStyle.Danger, !hasSelectedPlayer),
      createButton('Revive', STORYTELLER_DASHBOARD_ACTIONS.playerControlRevive, ButtonStyle.Success, !hasSelectedPlayer)
    ))
  }

  return rows
}

function createPlayerButtonRows(view, selectedPlayerId, playerLabels = {}) {
  const players = view.users.players || []
  const rows = []

  for (const playerChunk of chunkItems(players.slice(0, 20), 5)) {
    rows.push(new ActionRowBuilder().addComponents(
      playerChunk.map(playerId => createButton(
        truncate(playerLabels[playerId] || `Player ${String(playerId).slice(-4)}`, 80),
        createPlayerControlPlayerCustomId(playerId),
        playerId === selectedPlayerId ? ButtonStyle.Primary : ButtonStyle.Secondary
      ))
    ))
  }

  return rows
}

function createPlayerControlBackRow() {
  return new ActionRowBuilder().addComponents(
    createButton('Back', STORYTELLER_DASHBOARD_ACTIONS.playerControlPanel, ButtonStyle.Secondary)
  )
}

function createButton(label, customId, style, disabled = false) {
  return applyButtonEmoji(
    new ButtonBuilder()
      .setCustomId(customId)
      .setLabel(label)
      .setDisabled(disabled)
      .setStyle(style),
    label
  )
}

function chunkItems(items, size) {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

module.exports = {
  createPlayerButtonPanelPayload,
  createPlayerButtonRows,
  createPlayerControlButtonRow,
  createPlayerControlButtonRows,
  createPlayerControlPanelPayload
}
