const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js')
const {
  createMovePlayerCustomId,
  STORYTELLER_DASHBOARD_ACTIONS
} = require('./constants')
const {
  truncate
} = require('./formatters')

function createMoveTargetsPayload(view, playerLabels = {}) {
  const assignedPlayers = getAssignedCottagePlayerIds(view)
  const embed = new EmbedBuilder()
    .setTitle('Move Storyteller')
    .setDescription(createMoveDescription(assignedPlayers.length))
    .setColor(0x9b59b6)

  return {
    embeds: [embed],
    components: createMoveTargetRows(view, playerLabels)
  }
}

function createMoveTargetRows(view, playerLabels = {}) {
  const rows = []
  const denRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.moveDen)
      .setEmoji('\u{1F3DA}\u{FE0F}')
      .setLabel('Storyteller Den')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.moveBack)
      .setEmoji('\u{2B05}\u{FE0F}')
      .setLabel('Back')
      .setStyle(ButtonStyle.Secondary)
  )
  rows.push(denRow)

  for (const chunk of chunkPlayers(getAssignedCottagePlayerIds(view), 5)) {
    rows.push(new ActionRowBuilder().addComponents(
      chunk.map(playerId => new ButtonBuilder()
        .setCustomId(createMovePlayerCustomId(playerId))
        .setEmoji('\u{1F500}')
        .setLabel(truncate(playerLabels[playerId] || `Player ${playerId.slice(-4)}`, 80))
        .setStyle(ButtonStyle.Secondary))
    ))
  }

  return rows.slice(0, 5)
}

function getAssignedCottagePlayerIds(view) {
  const fakePlayers = new Set(view.users.fakePlayers || [])
  const assigned = view.engine.nightVoiceChannels || {}

  return (view.users.players || []).filter(playerId =>
    !fakePlayers.has(playerId) &&
    Boolean(assigned[playerId])
  )
}

function createMoveDescription(assignedCount) {
  const base = 'Choose where to move yourself. Join any voice channel first if Discord will not move you.'
  if (assignedCount) return `${base}\nOnly cottages currently assigned to players are shown.`
  return `${base}\nNo player cottages are currently assigned, so only the Storyteller Den is available.`
}

function chunkPlayers(players, size) {
  const chunks = []
  for (let index = 0; index < players.length; index += size) {
    chunks.push(players.slice(index, index + size))
  }
  return chunks
}

module.exports = {
  createMoveTargetRows,
  createMoveTargetsPayload,
  getAssignedCottagePlayerIds
}
