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
  applyButtonEmoji
} = require('../buttonEmoji')
const {
  truncate
} = require('./formatters')
const {
  createNomineeOptions
} = require('./nominationNominator')

function createNominationBuilderPayload(view, draft = {}, playerLabels = {}) {
  const players = view.users.players || []

  return {
    content: null,
    embeds: [
      new EmbedBuilder()
        .setTitle('Make Nomination')
        .setDescription(createNominationBuilderDescription(draft, playerLabels))
        .setColor(0xf1c40f)
    ],
    components: [
      createPlayerSelectRow({
        customId: STORYTELLER_DASHBOARD_ACTIONS.nominationBuilderNominator,
        placeholder: createPlaceholder('Nominator', draft.nominatorId, playerLabels),
        options: createNominatorOptions(view, playerLabels),
        selectedId: draft.nominatorId,
        players
      }),
      createPlayerSelectRow({
        customId: STORYTELLER_DASHBOARD_ACTIONS.nominationBuilderNominee,
        placeholder: createPlaceholder('Nominee', draft.nomineeId, playerLabels),
        options: createNomineeOptions(view, draft.nominatorId, playerLabels),
        selectedId: draft.nomineeId,
        players
      }),
      createNominationButtonRow(draft)
    ].filter(Boolean)
  }
}

function createNominationBuilderDescription(draft, playerLabels) {
  return [
    `Nominator: ${formatChoice(draft.nominatorId, playerLabels)}`,
    `Nominee: ${formatChoice(draft.nomineeId, playerLabels)}`,
    '',
    'Choose both players, then confirm the nomination.'
  ].join('\n')
}

function createPlayerSelectRow({ customId, placeholder, options, selectedId, players }) {
  if (!players.length || !options.length) return null

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(options.map(option => ({
        ...option,
        default: option.value === selectedId
      })))
  )
}

function createNominationButtonRow(draft) {
  const confirm = applyButtonEmoji(
    new ButtonBuilder()
      .setCustomId(STORYTELLER_DASHBOARD_ACTIONS.nominationBuilderConfirm)
      .setLabel('Confirm Nomination')
      .setDisabled(!draft.nominatorId || !draft.nomineeId)
      .setStyle(ButtonStyle.Success),
    'Confirm Nomination'
  )

  return new ActionRowBuilder().addComponents(confirm)
}

function createNominatorOptions(view, playerLabels = {}) {
  const alive = new Set(view.users.alivePlayers || [])
  const dead = new Set(view.users.deadPlayers || [])

  return (view.users.players || [])
    .slice(0, 25)
    .map((userId, index) => ({
      label: truncate(playerLabels[userId] || `Player ${index + 1}`, 100),
      value: userId,
      description: alive.has(userId)
        ? 'Living player'
        : dead.has(userId)
          ? 'Dead player'
          : 'Player'
    }))
}

function createPlaceholder(label, playerId, playerLabels) {
  if (!playerId) return `Choose ${label.toLowerCase()}`
  return `${label}: ${truncate(playerLabels[playerId] || `<@${playerId}>`, 88)}`
}

function formatChoice(playerId, playerLabels) {
  if (!playerId) return 'Not chosen yet'
  return playerLabels[playerId] || `<@${playerId}>`
}

module.exports = {
  createNominationBuilderDescription,
  createNominatorOptions,
  createNominationBuilderPayload
}
