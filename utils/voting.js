const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js')
const {
  applyButtonEmoji
} = require('./buttonEmoji')
const {
  createResolvedVoteFields
} = require('./votingOutcome')
const {
  createVoteMarkerLegendField,
  formatVoterName
} = require('./votingSeatingMap')

const VOTE_PREFIX = 'botc:vote:'
const VOTE_SIMULATION_ACTION = `${VOTE_PREFIX}simulate`
const MAX_EMBED_FIELDS = 25

/** @type {import('../types').VoteActions} */
const VOTE_ACTIONS = {
  clear: `${VOTE_PREFIX}clear`,
  pertinence: `${VOTE_PREFIX}pertinence`,
  yes: `${VOTE_PREFIX}yes`
}

/**
 * @param {string} customId
 * @returns {boolean}
 */
function isVotingInteraction(customId) {
  return typeof customId === 'string' && customId.startsWith(VOTE_PREFIX)
}

/**
 * @param {import('../types').VoteActionId} action
 * @param {import('../types').GuildId} guildId
 * @param {import('../types').NominationId} nominationId
 * @returns {import('../types').VoteCustomId}
 */
function createVoteCustomId(action, guildId, nominationId) {
  return `${action}:${guildId}:${nominationId}`
}

function createVoteSimulationCustomId(action, guildId, nominationId) {
  const actionName = getVoteActionName(action)
  if (!actionName || actionName === 'pertinence') return null
  return `${VOTE_SIMULATION_ACTION}:${actionName}:${guildId}:${nominationId}`
}

/**
 * @param {string} customId
 * @returns {import('../types').ParsedVoteCustomId | null}
 */
function parseVoteCustomId(customId) {
  const [prefix, scope, action, guildId, ...nominationIdParts] = String(customId || '').split(':')
  const fullAction = `${prefix}:${scope}:${action}`

  if (!Object.values(VOTE_ACTIONS).includes(fullAction)) return null

  return {
    action: fullAction,
    guildId,
    nominationId: nominationIdParts.join(':')
  }
}

function parseVoteSimulationCustomId(customId) {
  const [prefix, scope, action, voteActionName, guildId, ...nominationIdParts] = String(customId || '').split(':')
  if (`${prefix}:${scope}:${action}` !== VOTE_SIMULATION_ACTION) return null

  const voteAction = voteActionName === 'yes'
    ? VOTE_ACTIONS.yes
    : voteActionName === 'clear'
      ? VOTE_ACTIONS.clear
      : null

  if (!voteAction) return null

  return {
    action: voteAction,
    guildId,
    nominationId: nominationIdParts.join(':')
  }
}

function getVoteActionName(action) {
  if (action === VOTE_ACTIONS.yes) return 'yes'
  if (action === VOTE_ACTIONS.clear) return 'clear'
  if (action === VOTE_ACTIONS.pertinence) return 'pertinence'
  return null
}

/**
 * @param {import('../types').VotingPanelPayloadInput} input
 * @returns {import('../types').DiscordMessagePayload}
 */
function createVotingPanelPayload({
  nomination,
  view,
  playerLabels = {},
  countdownText = null,
  disableVoteButtons = false
}) {
  const nomineeName = playerLabels[nomination.nomineeId] || `Player ${nomination.nomineeId.slice(-4)}`
  const status = formatNominationStatus(nomination.status)
  const resolved = nomination.status === 'resolved'

  const fields = resolved
    ? createResolvedVoteFields(nomination, view)
    : createActiveVoteFields({ nomination, view, playerLabels })

  const embed = new EmbedBuilder()
    .setTitle(resolved ? 'Nomination Resolved' : 'Nomination')
    .setDescription(formatNominationDescription({ countdownText, status, resolved }))
    .addFields(fields)
    .setFooter({ text: nomineeName })
    .setColor(resolveNominationColor(nomination))
    .setTimestamp()

  const components = []

  if (nomination.status === 'seconded' || nomination.status === 'voting') {
    const buttons = [
        applyButtonEmoji(new ButtonBuilder()
          .setCustomId(createVoteCustomId(VOTE_ACTIONS.yes, view.guildId, nomination.id))
          .setLabel('Raise your hand')
          .setDisabled(disableVoteButtons)
          .setStyle(ButtonStyle.Success), 'Raise your hand'),
        applyButtonEmoji(new ButtonBuilder()
          .setCustomId(createVoteCustomId(VOTE_ACTIONS.clear, view.guildId, nomination.id))
          .setLabel('Lower your hand')
          .setDisabled(disableVoteButtons)
          .setStyle(ButtonStyle.Secondary), 'Lower your hand')
    ]

    if (nomination.status === 'seconded') {
      buttons.push(
        applyButtonEmoji(new ButtonBuilder()
          .setCustomId(createVoteCustomId(VOTE_ACTIONS.pertinence, view.guildId, nomination.id))
          .setLabel('Pertinence')
          .setDisabled(disableVoteButtons)
          .setStyle(ButtonStyle.Primary), 'Pertinence')
      )
    }

    components.push(new ActionRowBuilder().addComponents(...buttons))
  }

  if (!components.length && resolved) {
    components.push(
      new ActionRowBuilder().addComponents(
        applyButtonEmoji(new ButtonBuilder()
          .setCustomId(createVoteCustomId(VOTE_ACTIONS.yes, view.guildId, nomination.id))
          .setLabel('Vote closed')
          .setDisabled(true)
          .setStyle(ButtonStyle.Secondary), 'Vote closed')
      )
    )
  }

  return {
    embeds: [embed],
    components
  }
}

function formatNominationDescription({ countdownText, status, resolved = false }) {
  return [
    countdownText,
    `Status: ${status}`,
    resolved ? null : 'Raise your hand for the current nomination.'
  ].filter(Boolean).join('\n')
}

function formatNominationPlayerLabel(playerId, playerLabels = {}) {
  if (!playerId) return 'Storyteller'
  return playerLabels[playerId] || `<@${playerId}>`
}

function createActiveVoteFields({ nomination, view, playerLabels }) {
  return [
    {
      name: 'Current nomination',
      value: [
        `Nominator: **${formatNominationPlayerLabel(nomination.nominatorId, playerLabels)}**`,
        `Nominee: **${formatNominationPlayerLabel(nomination.nomineeId, playerLabels)}**`
      ].join('\n'),
      inline: false
    },
    {
      name: 'Hands raised',
      value: String(countRaisedHands(nomination, view)),
      inline: true
    },
    createVoteMarkerLegendField()
  ]
}

function countRaisedHands(nomination, view) {
  return (view.engine?.votes || [])
    .filter(vote => vote.nominationId === nomination.id && vote.value === true)
    .length
}

function formatNominationStatus(status) {
  if (status === 'pending_second' || status === 'seconded') return 'Nominated'
  if (status === 'voting') return 'Vote count running'
  if (status === 'resolved') return 'Resolved'
  return status || 'Unknown'
}

function resolveNominationColor(nomination) {
  if (nomination.status === 'resolved' && nomination.executed) return 0xe74c3c
  if (nomination.status === 'resolved' && nomination.result === 'marked_for_execution') return 0xe67e22
  if (nomination.status === 'resolved') return 0x95a5a6
  if (nomination.status === 'voting') return 0xf1c40f
  return 0x3498db
}

module.exports = {
  MAX_EMBED_FIELDS,
  VOTE_ACTIONS,
  createVoteCustomId,
  createVoteSimulationCustomId,
  createVotingPanelPayload,
  formatNominationDescription,
  formatNominationPlayerLabel,
  formatVoterName,
  getVoteActionName,
  isVotingInteraction,
  parseVoteCustomId,
  parseVoteSimulationCustomId
}
