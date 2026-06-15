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
  truncate
} = require('./formatters')
const {
  formatRoleWithEmoji
} = require('../roleFormatting')
const {
  createStorytellerSeatingMapFields
} = require('./grimoireSeatingMap')
const {
  REMINDER_TOKENS,
  getAvailableReminderTokenEntries
} = require('./reminderTokens')
const {
  createLunaticControlRows,
  formatLunaticInfoLine
} = require('./lunaticControls')
const {
  formatNeighborPair,
  getImmediateNeighbors,
  getLivingNeighbors
} = require('../tableOrder')

function createGrimoireMenuPayload(view, playerLabels = {}) {
  return createFullGrimoirePayload(view, playerLabels)
}

function createFullGrimoirePayload(view, playerLabels = {}, options = {}) {
  const embed = new EmbedBuilder()
    .setTitle(options.title || 'Grimoire')
    .setColor(0x8e44ad)
    .setTimestamp()

  const players = view.users.players || []
  const seatingFields = createStorytellerSeatingMapFields(view, playerLabels)
  if (seatingFields.length) embed.addFields(...seatingFields)

  const demonBluffs = formatDemonBluffs(view, playerLabels)
  if (demonBluffs) embed.addFields({ name: 'Demon not-in-play characters', value: truncate(demonBluffs, 1024), inline: false })
  if (!players.length) embed.setDescription('No players are in the game yet.')

  return {
    embeds: [embed],
    components: options.readOnly ? [] : [createBackOnlyRow(createGrimoireCustomId('dashboard')), ...createPlayerButtonRows(view, playerLabels)].slice(0, 5)
  }
}

function createPlayerGrimoirePayload(view, playerId, playerLabels = {}) {
  const label = getPlayerLabel(playerId, playerLabels)
  const controlRows = [
    new ActionRowBuilder().addComponents(
      createButton('Revive', createGrimoireCustomId('revive', playerId), ButtonStyle.Success),
      createButton('Kill', createGrimoireCustomId('kill', playerId), ButtonStyle.Danger),
      createButton('Move', createGrimoireCustomId('move', playerId), ButtonStyle.Secondary),
      createButton('Reminder Tokens', createGrimoireCustomId('tokens', playerId), ButtonStyle.Primary),
      createButton('Back', createGrimoireCustomId('full'), ButtonStyle.Secondary)
    ),
    ...createLunaticControlRows(view, playerId)
  ]
  return {
    embeds: [new EmbedBuilder()
      .setTitle(`${label}:`)
      .setDescription(createPlayerSummary(view, playerId, playerLabels))
      .setColor(0x8e44ad)
      .setTimestamp()],
    components: controlRows
  }
}

function createReminderTokenPayload(view, playerId, playerLabels = {}) {
  const label = getPlayerLabel(playerId, playerLabels)
  const addTokens = getAvailableReminderTokenEntries(view)
  const activeTokens = getActiveReminderTokenEntries(view, playerId)
  return {
    embeds: [new EmbedBuilder()
      .setTitle(`Reminder Tokens: ${label}`)
      .setDescription(createReminderTokenDescription(addTokens, activeTokens))
      .setColor(0x8e44ad)
      .setTimestamp()],
    components: [
      ...createReminderTokenRows(playerId, 'token', ButtonStyle.Secondary, addTokens),
      ...createReminderTokenRows(playerId, 'untoken', ButtonStyle.Danger, activeTokens),
      createBackOnlyRow(createGrimoireCustomId('player', playerId), ButtonStyle.Primary)
    ]
  }
}

function createReminderTokenDescription(addTokens, activeTokens) {
  if (addTokens.length || activeTokens.length) return 'Add or remove a reminder token for this player.'
  return 'No reminder tokens are available because no matching source characters are currently in play.'
}

function createReminderTokenRows(playerId, action, style, tokens = REMINDER_TOKENS) {
  const prefix = action === 'untoken' ? 'Remove ' : ''
  const rows = []

  for (let index = 0; index < tokens.length; index += 4) {
    const slice = tokens.slice(index, index + 4)
    if (!slice.length) continue

    rows.push(new ActionRowBuilder().addComponents(
      ...slice.map(([type, label]) =>
        createButton(`${prefix}${label}`, createGrimoireCustomId(action, playerId, type), style)
      )
    ))
  }

  return rows
}

function getActiveReminderTokenEntries(view, playerId) {
  const activeTypes = getActiveReminderTokenTypes(view, playerId)
  return REMINDER_TOKENS.filter(([type]) => activeTypes.has(type))
}

function getActiveReminderTokenTypes(view, playerId) {
  const allowedTypes = new Set(REMINDER_TOKENS.map(([type]) => type))
  const activeTypes = new Set()
  const effects = view.engine.statusEffects?.[playerId] || {}

  for (const [type, active] of Object.entries(effects)) {
    if (active && allowedTypes.has(type)) activeTypes.add(type)
  }

  for (const reminder of getReminderRecords(view)) {
    if (reminder.playerId !== playerId) continue
    if (reminder.status === 'triggered') continue
    if (allowedTypes.has(reminder.type)) activeTypes.add(reminder.type)
  }

  return activeTypes
}

function getReminderRecords(view) {
  const reminders = view.engine?.reminders || []
  if (Array.isArray(reminders)) return reminders
  return Object.values(reminders).flatMap(value => Array.isArray(value) ? value : [value])
}

function createBackOnlyRow(customId = createGrimoireCustomId('back'), style = ButtonStyle.Secondary) {
  return new ActionRowBuilder().addComponents(createButton('Back', customId, style))
}

function createPlayerButtonRows(view, playerLabels = {}) {
  const players = (view.users.players || []).slice(0, 20)
  const rows = []
  for (let index = 0; index < players.length; index += 5) {
    rows.push(new ActionRowBuilder().addComponents(
      ...players.slice(index, index + 5).map(playerId =>
        createButton(truncate(getPlayerLabel(playerId, playerLabels), 80), createGrimoireCustomId('player', playerId), ButtonStyle.Secondary)
      )
    ))
  }
  return rows
}

function createPlayerSummary(view, playerId, playerLabels = {}) {
  return [
    formatRoleLine(view, playerId),
    getLifeState(view, playerId),
    getAlignment(view, playerId),
    getNeighborLine(view, playerId, playerLabels),
    formatLunaticInfoLine(view, playerId, playerLabels),
    getReminderTokenEmojiLine(view, playerId)
  ].filter(Boolean).join('\n')
}

function getNeighborLine(view, playerId, playerLabels = {}) {
  const formatter = id => getPlayerLabel(id, playerLabels)
  const seated = formatNeighborPair(getImmediateNeighbors(view, playerId), formatter)
  const living = formatNeighborPair(getLivingNeighbors(view, playerId), formatter)
  return `Neighbors: ${seated}\nLiving neighbors: ${living}`
}

function getReminderTokenEmojiLine(view, playerId) {
  const emojis = getActiveReminderTokenEntries(view, playerId)
    .map(([, label]) => String(label).split(' ')[0])
    .filter(Boolean)
  return emojis.length ? `Tokens: ${emojis.join(' ')}` : null
}

function formatDemonBluffs(view, playerLabels = {}) {
  return Object.entries(view.engine.demonNotInPlayRoles || {})
    .filter(([, roleIds]) => roleIds?.length)
    .map(([playerId, roleIds]) => `${getPlayerLabel(playerId, playerLabels)}: ${roleIds.map(roleId => formatRole(view, roleId)).join(', ')}`)
    .join('\n')
}

function formatRoleLine(view, playerId) {
  const roleId = view.engine.roles?.[playerId]
  if (!roleId) return '❔ Unassigned'
  const shownRoleId = view.engine.shownRoles?.[playerId]
  if (roleId === 'drunk' && shownRoleId) return formatDrunkShownRole(view, shownRoleId)
  return formatRole(view, roleId)
}

function formatDrunkShownRole(view, shownRoleId) {
  return `${formatRole(view, shownRoleId)} (is ${formatRoleWithEmoji(view, 'drunk')})`
}

function formatRole(view, roleId) {
  return formatRoleWithEmoji(view, roleId)
}

function getLifeState(view, playerId) {
  return (view.users.deadPlayers || []).includes(playerId) ? 'Dead' : 'Alive'
}

function getAlignment(view, playerId) {
  const roleId = view.engine.roles?.[playerId]
  const team = getRoleTeam(view, roleId)
  if (!team) return 'Unknown'
  return ['minion', 'demon'].includes(team) ? 'Evil' : 'Good'
}

function getRoleTeam(view, roleId) {
  for (const [team, roles] of Object.entries(view.engine.roleCategories || {})) {
    if ((roles || []).includes(roleId)) return team
  }
  return null
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
  REMINDER_TOKENS,
  createFullGrimoirePayload,
  createGrimoireMenuPayload,
  createPlayerGrimoirePayload,
  createReminderTokenPayload,
  createPlayerSummary,
  formatDemonBluffs,
  formatRoleLine,
  getActiveReminderTokenTypes,
  getReminderTokenEmojiLine
}
