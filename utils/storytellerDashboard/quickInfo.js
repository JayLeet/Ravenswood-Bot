const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder
} = require('discord.js')
const {
  STORYTELLER_DASHBOARD_ACTIONS
} = require('./constants')
const {
  getRoleDisplayName,
  truncate
} = require('./formatters')
const {
  applyButtonEmoji
} = require('../buttonEmoji')

const QUICK_TEXT_RESPONSES = ['Got it', 'Good', 'Evil', 'Yes', 'No']
const QUICK_NUMBER_RESPONSES = ['0', '1', '2', '3', '4', '5', '6']

function createQuickInfoPayload(view, playerId, playerLabels = {}) {
  return {
    embeds: [new EmbedBuilder()
      .setTitle('Quick Info')
      .setDescription(`Send a quick private response to <@${playerId}>.`)
      .setColor(0x9b59b6)
      .setTimestamp()],
    components: [
      createQuickTextRow(),
      createQuickNumberRow(),
      createQuickPlayerRow(view, playerLabels),
      createQuickCharacterRow(view),
      createQuickCustomRow()
    ]
  }
}

function createQuickInfoResponsePayload(text) {
  return {
    embeds: [new EmbedBuilder()
      .setTitle('Storyteller Info')
      .setDescription(String(text || '').slice(0, 4096))
      .setColor(0x9b59b6)
      .setTimestamp()]
  }
}

function createQuickTextRow() {
  return new ActionRowBuilder().addComponents(
    QUICK_TEXT_RESPONSES.map(text => createQuickButton(text))
  )
}

function createQuickNumberRow() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.quickNumber)
      .setPlaceholder('Send a number')
      .addOptions(QUICK_NUMBER_RESPONSES.map(value => ({
        label: value,
        value,
        description: `Send ${value}.`
      })))
  )
}

function createQuickPlayerRow(view, playerLabels) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.quickPlayer)
      .setPlaceholder('Choose Player')
      .addOptions((view.users.players || []).slice(0, 25).map((userId, index) => ({
        label: truncate(playerLabels[userId] || `Player ${index + 1}`, 100),
        value: userId,
        description: 'Send this player as the response.'
      })))
  )
}

function createQuickCharacterRow(view) {
  const options = []

  for (const roles of Object.values(view.engine.roleCategories || {})) {
    for (const roleId of roles || []) {
      options.push({
        label: truncate(getRoleDisplayName(view, roleId), 100),
        value: roleId,
        description: 'Send this character as the response.'
      })
    }
  }

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.quickCharacter)
      .setPlaceholder('Choose Character')
      .addOptions(options.slice(0, 25))
  )
}

function createQuickCustomRow() {
  return new ActionRowBuilder().addComponents(createQuickButton('Custom', STORYTELLER_DASHBOARD_ACTIONS.quickCustom, ButtonStyle.Primary))
}

function createQuickButton(label, customId = createQuickTextCustomId(label), style = ButtonStyle.Secondary) {
  return applyButtonEmoji(
    new ButtonBuilder()
      .setCustomId(customId)
      .setLabel(label)
      .setStyle(style),
    label
  )
}

function createQuickTextCustomId(text) {
  return `${STORYTELLER_DASHBOARD_ACTIONS.quickText}:${encodeURIComponent(text)}`
}

function parseQuickTextCustomId(customId) {
  const prefix = `${STORYTELLER_DASHBOARD_ACTIONS.quickText}:`
  if (!String(customId || '').startsWith(prefix)) return null
  return decodeURIComponent(String(customId).slice(prefix.length))
}

module.exports = {
  QUICK_NUMBER_RESPONSES,
  QUICK_TEXT_RESPONSES,
  createQuickInfoPayload,
  createQuickInfoResponsePayload,
  createQuickTextCustomId,
  parseQuickTextCustomId
}
