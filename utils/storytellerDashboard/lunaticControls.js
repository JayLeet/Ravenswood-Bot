const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js')
const {
  createGrimoireCustomId
} = require('./constants')
const {
  applyButtonEmoji
} = require('../buttonEmoji')
const {
  formatRoleWithEmoji
} = require('../roleFormatting')
const {
  truncate
} = require('./formatters')

function createLunaticControlRows(view, playerId) {
  if (!isLunatic(view, playerId)) return []
  return [new ActionRowBuilder().addComponents(
    createButton('Auto Lunatic Info', createGrimoireCustomId('lunatic-auto', playerId), ButtonStyle.Secondary),
    createButton('Demon', createGrimoireCustomId('lunatic-demon-menu', playerId), ButtonStyle.Danger),
    createButton('Minions', createGrimoireCustomId('lunatic-minion-menu', playerId), ButtonStyle.Secondary)
  )]
}

function createLunaticDemonPayload(view, playerId, playerLabels = {}) {
  const label = getPlayerLabel(playerId, playerLabels)
  const demonRoleIds = getRoleIdsByTeam(view, 'demon').slice(0, 20)
  const currentRoleId = view.engine?.lunaticInfo?.[playerId]?.demonRoleId || null
  return {
    embeds: [new EmbedBuilder()
      .setTitle(`Lunatic Demon: ${label}`)
      .setDescription([
        `Current: ${currentRoleId ? formatRoleWithEmoji(view, currentRoleId) : 'None'}`,
        'Choose the Demon this Lunatic believes they are.'
      ].join('\n'))
      .setColor(0xe74c3c)
      .setTimestamp()],
    components: [
      ...createRoleRows(view, playerId, demonRoleIds, currentRoleId),
      createBackRow(playerId)
    ].slice(0, 5)
  }
}

function createLunaticMinionsPayload(view, playerId, playerLabels = {}) {
  const label = getPlayerLabel(playerId, playerLabels)
  const current = new Set(view.engine?.lunaticInfo?.[playerId]?.minionIds || [])
  const players = (view.users?.players || []).filter(id => id !== playerId).slice(0, 20)
  return {
    embeds: [new EmbedBuilder()
      .setTitle(`Lunatic Minions: ${label}`)
      .setDescription([
        `Current: ${formatSelectedPlayers([...current], playerLabels)}`,
        'Toggle the players this Lunatic believes are their Minions.'
      ].join('\n'))
      .setColor(0x8e44ad)
      .setTimestamp()],
    components: [
      ...createPlayerRows(playerId, players, current, playerLabels),
      createBackRow(playerId)
    ].slice(0, 5)
  }
}

function formatLunaticInfoLine(view, playerId, playerLabels = {}) {
  if (!isLunatic(view, playerId)) return null
  const info = view.engine?.lunaticInfo?.[playerId]
  if (!info?.demonRoleId) return 'Lunatic info: not prepared yet'

  const demon = formatRoleWithEmoji(view, info.demonRoleId)
  const minions = formatSelectedPlayers(info.minionIds || [], playerLabels)
  const mode = info.mode === 'manual' ? 'Manual' : 'Auto'
  return `Lunatic info: ${mode}\nBelieves Demon: ${demon}\nBelieves Minions: ${minions}`
}

function createRoleRows(view, playerId, roleIds, selectedRoleId) {
  const rows = []
  for (let index = 0; index < roleIds.length; index += 4) {
    rows.push(new ActionRowBuilder().addComponents(
      roleIds.slice(index, index + 4).map(roleId =>
        createButton(
          truncate(formatRoleWithEmoji(view, roleId), 80),
          createGrimoireCustomId('lunatic-demon', playerId, roleId),
          roleId === selectedRoleId ? ButtonStyle.Danger : ButtonStyle.Secondary
        )
      )
    ))
  }
  return rows
}

function createPlayerRows(playerId, players, selected, playerLabels) {
  const rows = []
  for (let index = 0; index < players.length; index += 5) {
    rows.push(new ActionRowBuilder().addComponents(
      players.slice(index, index + 5).map(targetId =>
        createButton(
          truncate(getPlayerLabel(targetId, playerLabels), 80),
          createGrimoireCustomId('lunatic-minion', playerId, targetId),
          selected.has(targetId) ? ButtonStyle.Success : ButtonStyle.Secondary
        )
      )
    ))
  }
  return rows
}

function createBackRow(playerId) {
  return new ActionRowBuilder().addComponents(
    createButton('Back', createGrimoireCustomId('player', playerId), ButtonStyle.Primary)
  )
}

function getRoleIdsByTeam(view, team) {
  return view.engine?.roleCategories?.[team] || []
}

function isLunatic(view, playerId) {
  return view.engine?.roles?.[playerId] === 'lunatic'
}

function formatSelectedPlayers(playerIds, playerLabels = {}) {
  if (!playerIds.length) return 'None'
  return playerIds.map(id => playerLabels[id] || `Player ${String(id).slice(-4)}`).join(', ')
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
  createLunaticControlRows,
  createLunaticDemonPayload,
  createLunaticMinionsPayload,
  formatLunaticInfoLine
}
