const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js')
const {
  createGrimRevealCustomId,
  STORYTELLER_DASHBOARD_ACTIONS
} = require('./constants')
const {
  formatRoleWithArticle
} = require('../roleFormatting')
const {
  ROLE_EMOJIS,
  TEAM_EMOJIS,
  getRoleEmoji
} = require('./roleEmojis')

const ALIVE_REVEAL_EMOJI = '👤'
const DEAD_REVEAL_EMOJI = '💀'

const SUPERSCRIPT_PREFIX_PATTERN = /^[\u2070\u00B9\u00B2\u00B3\u2074-\u2079]+/u
const STATE_NAME_PREFIXES = [
  `${ALIVE_REVEAL_EMOJI} `,
  `${DEAD_REVEAL_EMOJI} `,
  '\u{1F464} ',
  '\u{1F480}\u274C ',
  '\u{1F480} ',
  '\u2705 ',
  '\u274C ',
  '\u270B ',
  '\u{1FAAC} ',
  '\u2754 ',
  '\u{1F47B}\u2754 '
]

function createGrimRevealPayload(view, revealId, playerLabels = {}) {
  const reveal = view.pendingEndReveal || {}
  if (reveal.skipPlayerReveal) return createClocktowerLiveEndPayload(revealId, reveal.winner)

  const revealed = new Set(reveal.revealedPlayers || [])
  const players = view.users.players || []

  return {
    embeds: [
      new EmbedBuilder()
        .setTitle('The Grimoire Opens')
        .setDescription([
          'The Storyteller may reveal players one by one.',
          reveal.winner
            ? `The ${formatWinner(reveal.winner)} team has won. Finish revealing roles to close Storyteller access.`
            : createWinnerHelpText(),
          '',
          formatRevealList(view, players, revealed, playerLabels)
        ].join('\n'))
        .setColor(0x8e44ad)
    ],
    components: [
      ...createRevealRows(view, players, revealed, revealId, playerLabels),
      createWinnerRow(revealId, revealed.size > 0, reveal.winner)
    ]
  }
}

function createClocktowerLiveEndPayload(revealId, revealedWinner = null) {
  return {
    embeds: [
      new EmbedBuilder()
        .setTitle('End Clocktower.live Game')
        .setDescription([
          'Choose which team won, or cancel to resume the game.',
          '',
          'No player roles are revealed in Clocktower.live mode.'
        ].join('\n'))
        .setColor(0x8e44ad)
    ],
    components: [createWinnerRow(revealId, true, revealedWinner, { allowCancelAfterReveal: true })]
  }
}

function formatRevealList(view, players, revealed, playerLabels) {
  if (!players.length) return 'No players were in this game.'

  return players.map(playerId => {
    const name = getRevealPlayerName(view, playerId, playerLabels)
    if (!revealed.has(playerId)) return `${getUnrevealedStateEmoji(view, playerId)} ${name}: Hidden`
    return `${getRevealEmoji(view, playerId)} ${name}: ${formatRevealRole(view, playerId)}`
  }).join('\n')
}

function formatRevealRole(view, playerId) {
  const role = view.engine.roles?.[playerId]
  const shownRole = view.engine.shownRoles?.[playerId]
  const history = view.engine.roleHistory?.[playerId] || []
  const parts = [role ? formatRoleWithArticle(view, role) : 'Unassigned']

  if (shownRole && shownRole !== role) {
    parts.push(`shown as ${formatRoleWithArticle(view, shownRole)}`)
  }

  if (history.length) {
    parts.push(`previously ${history.map(item => formatRoleWithArticle(view, item.roleId || item)).join(', ')}`)
  }

  return parts.join(' | ')
}

function getRevealEmoji(view, playerId) {
  return getRoleEmoji(view, view.engine.roles?.[playerId])
}

function getUnrevealedStateEmoji(view, playerId) {
  return (view.users.deadPlayers || []).includes(playerId)
    ? DEAD_REVEAL_EMOJI
    : ALIVE_REVEAL_EMOJI
}

function createRevealRows(view, players, revealed, revealId, playerLabels) {
  const rows = []
  const limitedPlayers = players.slice(0, 20)

  for (let index = 0; index < limitedPlayers.length; index += 5) {
    rows.push(new ActionRowBuilder().addComponents(
      ...limitedPlayers.slice(index, index + 5).map(playerId =>
        new ButtonBuilder()
          .setCustomId(createGrimRevealCustomId(playerId, revealId))
          .setLabel(createButtonLabel(view, playerId, revealed, playerLabels))
          .setStyle(revealed.has(playerId) ? ButtonStyle.Secondary : ButtonStyle.Primary)
          .setDisabled(revealed.has(playerId))
      )
    ))
  }

  return rows
}

function createWinnerRow(revealId, hasRevealedPlayer, revealedWinner = null, options = {}) {
  const cancelDisabled = options.allowCancelAfterReveal
    ? !!revealedWinner
    : hasRevealedPlayer || !!revealedWinner

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(createEndRevealCustomId('good', revealId))
      .setEmoji('💙')
      .setLabel('Good Won')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!hasRevealedPlayer || !!revealedWinner),
    new ButtonBuilder()
      .setCustomId(createEndRevealCustomId('evil', revealId))
      .setEmoji('🔥')
      .setLabel('Evil Won')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!hasRevealedPlayer || !!revealedWinner),
    new ButtonBuilder()
      .setCustomId(createEndRevealCustomId('cancel', revealId))
      .setEmoji('❌')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(cancelDisabled)
  )
}

function createWinnerHelpText() {
  return 'Once at least one role is revealed, the winning team can be chosen.'
}

function createEndRevealCustomId(value, revealId = 'pending') {
  return `${STORYTELLER_DASHBOARD_ACTIONS.endReveal}:${value}:${revealId}`
}

function createButtonLabel(view, playerId, revealed, playerLabels) {
  const label = getRevealPlayerName(view, playerId, playerLabels, `Player ${String(playerId).slice(-4)}`)
  const emoji = revealed.has(playerId)
    ? getRevealEmoji(view, playerId)
    : getUnrevealedStateEmoji(view, playerId)
  return `${emoji} ${label}`.slice(0, 80)
}

function getRevealPlayerName(view, playerId, playerLabels = {}, fallback = null) {
  return view?.users?.displayNames?.[playerId] ||
    stripKnownRevealNamePrefix(playerLabels[playerId]) ||
    fallback ||
    `<@${playerId}>`
}

function stripKnownRevealNamePrefix(label) {
  let text = String(label || '').trim()
  if (!text) return ''

  text = text.replace(SUPERSCRIPT_PREFIX_PATTERN, '').trimStart()
  for (const prefix of getKnownRevealNamePrefixes()) {
    if (text.startsWith(prefix)) return text.slice(prefix.length).trimStart()
  }
  return text
}

function getKnownRevealNamePrefixes() {
  return [
    ...STATE_NAME_PREFIXES,
    ...Object.values(ROLE_EMOJIS).flatMap(emoji => [`${emoji}\u274C `, `${emoji} `]),
    ...Object.values(TEAM_EMOJIS).map(emoji => `${emoji} `)
  ].sort((left, right) => right.length - left.length)
}

function formatWinner(winner) {
  if (winner === 'good') return 'Good'
  if (winner === 'evil') return 'Evil'
  return String(winner || 'chosen')
}

module.exports = {
  ALIVE_REVEAL_EMOJI,
  createClocktowerLiveEndPayload,
  createGrimRevealPayload,
  formatRevealRole,
  getRevealPlayerName,
  getRevealEmoji,
}
