const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js')
const {
  COMMON_WAKE_OPTIONS,
  NUMBER_WAKE_OPTIONS,
  SECOND_PAGE_WAKE_OPTIONS,
  getWakeOptionText
} = require('../nightWakeOptions')
const {
  getNotInPlayRoleIds
} = require('../nightWakeInfo')
const {
  createNightOrderCustomId
} = require('./constants')
const {
  applyButtonEmoji
} = require('../buttonEmoji')
const {
  getRoleDisplayName,
  truncate
} = require('./formatters')

const NOT_IN_PLAY_TEAMS = ['townsfolk', 'outsider']

function createNightWakeMenuPayload(view, entry, index, playerLabels = {}, page = 'main', selected = [], draft = []) {
  if (page === 'more') return createSecondPagePayload(entry, index, draft)
  if (page === 'players') return createPlayerMenuPayload(view, entry, index, playerLabels, draft)
  if (page === 'characters') return createCharacterMenuPayload(view, entry, index, draft)
  if (page === 'not-in-play') return createNotInPlayMenuPayload(view, entry, index, selected, draft)
  if (page === 'numbers') return createNumberMenuPayload(view, entry, index, draft)

  return {
    embeds: [createMenuEmbed(entry, 'Choose what night info to queue, then submit it.', draft)],
    components: [
      createOptionRow(index, COMMON_WAKE_OPTIONS),
      createNavigationRow(index),
      createSubmitRow(index, draft)
    ]
  }
}

function createMenuEmbed(entry, description, draft = []) {
  const embed = new EmbedBuilder()
    .setTitle(`Wake: ${entry.playerLabel}`)
    .setDescription(description)
    .setColor(0x2c3e50)
    .addFields(
      { name: 'Character', value: entry.roleName, inline: true },
      { name: 'Prompt', value: truncate(entry.prompt, 900), inline: false }
    )
    .setTimestamp()
  addDraftField(embed, draft)
  return embed
}

function createOptionRow(index, options) {
  return new ActionRowBuilder().addComponents(
    options.map(option => createButton(
      option.text,
      createOptionCustomId(index, option.key),
      ButtonStyle.Secondary,
      String(option.label).split(' ')[0]
    ))
  )
}

function createOptionCustomId(index, key) {
  return key === 'not_in_play'
    ? createNightOrderCustomId('wake-page', index, 'not-in-play')
    : createNightOrderCustomId('wake-send', index, key)
}

function createNavigationRow(index) {
  return new ActionRowBuilder().addComponents(
    createButton('Number', createNightOrderCustomId('wake-page', index, 'numbers'), ButtonStyle.Secondary, '🔢'),
    createButton('Players', createNightOrderCustomId('wake-page', index, 'players'), ButtonStyle.Secondary, '👤'),
    createButton('Characters', createNightOrderCustomId('wake-page', index, 'characters'), ButtonStyle.Secondary, '🎭'),
    createButton('More Info', createNightOrderCustomId('wake-page', index, 'more'), ButtonStyle.Primary, '➡️'),
    createButton('Back', createNightOrderCustomId('wake-back', index), ButtonStyle.Secondary, '⬅️')
  )
}

function createSecondPagePayload(entry, index, draft = []) {
  return {
    embeds: [createMenuEmbed(entry, 'Choose extra night info to queue.', draft)],
    components: [
      ...createButtonRows(SECOND_PAGE_WAKE_OPTIONS.map(option => ({
        emoji: String(option.label).split(' ')[0],
        label: option.text,
        customId: createOptionCustomId(index, option.key),
        style: ButtonStyle.Secondary
      }))),
      createBackRow(index),
      createSubmitRow(index, draft)
    ]
  }
}

function createPlayerMenuPayload(view, entry, index, playerLabels = {}, draft = []) {
  const players = (view.users.players || []).slice(0, 20)
  return {
    embeds: [createMenuEmbed(entry, 'Choose a player to queue as night info.', draft)],
    components: [
      ...createButtonRows(players.map((playerId, playerIndex) => ({
        label: truncate(playerLabels[playerId] || `Player ${playerIndex + 1}`, 80),
        customId: createNightOrderCustomId('wake-player', index, playerId),
        style: ButtonStyle.Secondary
      }))),
      createBackRow(index),
      createSubmitRow(index, draft)
    ]
  }
}

function createCharacterMenuPayload(view, entry, index, draft = []) {
  const roles = Object.values(view.engine.roleCategories || {})
    .flatMap(roleIds => roleIds || [])
    .slice(0, 20)
  return createRoleMenuPayload(view, entry, index, roles, 'Choose a character to queue as night info.', draft)
}

function createNotInPlayMenuPayload(view, entry, index, selected = [], draft = []) {
  const roles = getSelectableNotInPlayRoleIds(view).slice(0, 20)
  const safeSelected = normalizeNotInPlaySelection(view, selected)
  const description = `Choose exactly 3 good characters that are not in play. Selected: ${safeSelected.length}/3.`
  return {
    embeds: [createMenuEmbed(entry, description, draft)],
    components: [
      ...createButtonRows(roles.map(roleId => createNotInPlayButton(view, index, roleId, safeSelected))),
      createBackRow(index),
      createSubmitRow(index, draft)
    ]
  }
}

function createNotInPlayButton(view, index, roleId, selected) {
  const isSelected = selected.includes(roleId)
  const nextSelected = isSelected ? selected.filter(id => id !== roleId) : [...selected, roleId]
  return {
    label: truncate(`${isSelected ? '✅ ' : ''}${formatRoleButtonLabel(view, roleId)}`, 80),
    customId: createNightOrderCustomId('wake-not-in-play', index, encodeSelection(roleId, nextSelected)),
    style: isSelected ? ButtonStyle.Success : ButtonStyle.Secondary
  }
}

function createRoleMenuPayload(view, entry, index, roles, description, draft = []) {
  return {
    embeds: [createMenuEmbed(entry, description, draft)],
    components: [
      ...createButtonRows(roles.map(roleId => ({
        label: truncate(formatRoleButtonLabel(view, roleId), 80),
        customId: createNightOrderCustomId('wake-role', index, roleId),
        style: ButtonStyle.Secondary
      }))),
      createBackRow(index),
      createSubmitRow(index, draft)
    ]
  }
}

function createNumberMenuPayload(view, entry, index, draft = []) {
  return {
    embeds: [createMenuEmbed(entry, 'Choose a number to queue as night info.', draft)],
    components: [
      ...createButtonRows(NUMBER_WAKE_OPTIONS.map(option => ({
        emoji: String(option.label).split(' ')[0],
        label: option.text,
        customId: createNightOrderCustomId('wake-send', index, option.key),
        style: ButtonStyle.Secondary
      }))),
      createBackRow(index),
      createSubmitRow(index, draft)
    ]
  }
}

function createButtonRows(buttons) {
  const rows = []
  for (let index = 0; index < buttons.length; index += 5) {
    rows.push(new ActionRowBuilder().addComponents(
      buttons.slice(index, index + 5).map(button =>
        createButton(button.label, button.customId, button.style, button.emoji)
      )
    ))
  }
  return rows.slice(0, 3)
}

function formatNotInPlayInfo(view, roleIds) {
  const safeRoleIds = normalizeNotInPlaySelection(view, roleIds)
  return `These characters are not in play:\n${safeRoleIds.map(roleId => `- ${formatRoleButtonLabel(view, roleId)}`).join('\n')}`
}

function parseNotInPlaySelection(value) {
  const [, selectedText = ''] = String(value || '').split('|')
  return selectedText.split(',').filter(Boolean)
}

function encodeSelection(roleId, selected) {
  return `${roleId}|${selected.slice(0, 3).join(',')}`
}

function getSelectableNotInPlayRoleIds(view) {
  return getNotInPlayRoleIds(view, { teams: NOT_IN_PLAY_TEAMS })
}

function normalizeNotInPlaySelection(view, selected = []) {
  const allowed = new Set(getSelectableNotInPlayRoleIds(view))
  const safeSelection = []
  for (const roleId of selected) {
    if (!allowed.has(roleId) || safeSelection.includes(roleId)) continue
    safeSelection.push(roleId)
    if (safeSelection.length >= 3) break
  }
  return safeSelection
}

function createBackRow(index) {
  return new ActionRowBuilder().addComponents(
    createButton('Back', createNightOrderCustomId('wake', index), ButtonStyle.Secondary, '⬅️')
  )
}

function createSubmitRow(index, draft = []) {
  const hasDraft = draft.length > 0
  return new ActionRowBuilder().addComponents(
    createButton('Submit', createNightOrderCustomId('wake-submit', index), hasDraft ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(!hasDraft),
    createButton('Clear', createNightOrderCustomId('wake-clear', index), ButtonStyle.Secondary)
      .setDisabled(!hasDraft)
  )
}

function parseWakeSendText(value) {
  return getWakeOptionText(value) || null
}

function formatRoleButtonLabel(view, roleId) {
  return getRoleDisplayName(view, roleId)
}

function createButton(label, customId, style, emoji = null) {
  const button = new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(style)
  if (emoji) button.setEmoji(emoji)
  return applyButtonEmoji(button, label)
}

function addDraftField(embed, draft = []) {
  if (!draft.length) return
  embed.addFields({
    name: 'Queued to send',
    value: truncate(draft.map((item, index) => `${index + 1}. ${item.label || item.text}`).join('\n'), 900),
    inline: false
  })
}

module.exports = {
  createNightWakeMenuPayload,
  createNumberMenuPayload,
  formatNotInPlayInfo,
  normalizeNotInPlaySelection,
  parseNotInPlaySelection,
  parseWakeSendText
}
