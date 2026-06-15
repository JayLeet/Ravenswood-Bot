const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js')
const {
  queuedChannelSend,
  queuedMessageEdit
} = require('../../../../utils/discord/messageActions')
const {
  STORYTELLER_DASHBOARD_ACTIONS
} = require('../../embeds')
const { messages } = require('../../../../utils/text/messageRegistry')
const {
  applyButtonEmoji
} = require('../../../../utils/buttonEmoji')
const {
  createBotLogger
} = require('../../../../utils/logger')

const REVEAL_COLORS = Object.freeze({
  suspense: 0xf1c40f,
  neutral: 0x95a5a6,
  good: 0x3498db,
  evil: 0xe74c3c,
  cancelled: 0x95a5a6
})
const FINAL_REVEAL_EMBED_DELAY_MS = 5000
const log = createBotLogger({ subsystem: 'EndGameReveal' })

const GOOD_TEAMS = new Set(['townsfolk', 'outsider'])
const EVIL_TEAMS = new Set(['minion', 'demon'])

const WINNER_OPTIONS = {
  good: { labelKey: 'endReveal.goodButton', winner: 'good', revealKey: 'winReveal.good' },
  evil: { labelKey: 'endReveal.evilButton', winner: 'evil', revealKey: 'winReveal.evil' }
}

function createEndGameRevealPayload(revealId) {
  return {
    embeds: [
      new EmbedBuilder()
        .setTitle(`🎭 ${messages.get('endReveal.title')}`)
        .setDescription(messages.get('endReveal.description'))
        .setColor(REVEAL_COLORS.suspense)
        .setTimestamp()
    ],
    components: [
      new ActionRowBuilder().addComponents(
        ...Object.entries(WINNER_OPTIONS).map(([key, option]) =>
          applyButtonEmoji(new ButtonBuilder()
            .setCustomId(createEndRevealCustomId(key, revealId))
            .setLabel(messages.get(option.labelKey))
            .setStyle(key === 'evil' ? ButtonStyle.Danger : ButtonStyle.Primary), messages.get(option.labelKey))
        ),
        applyButtonEmoji(new ButtonBuilder()
          .setCustomId(createEndRevealCustomId('cancel', revealId))
          .setLabel(messages.get('endReveal.cancelButton'))
          .setStyle(ButtonStyle.Secondary), messages.get('endReveal.cancelButton'))
      )
    ]
  }
}

function createEndRevealCancelledPayload() {
  return {
    content: '',
    embeds: [
      new EmbedBuilder()
        .setTitle('🕯️ Grimoire Reveal Cancelled')
        .setDescription([
          'The Storyteller has closed the Grimoire reveal.',
          '',
          '**The game continues.**'
        ].join('\n'))
        .setColor(REVEAL_COLORS.cancelled)
        .setTimestamp()
    ],
    components: []
  }
}

function createEndRevealCustomId(value, revealId = 'pending') {
  return `${STORYTELLER_DASHBOARD_ACTIONS.endReveal}:${value}:${revealId}`
}

function parseEndRevealCustomId(customId) {
  const prefix = `${STORYTELLER_DASHBOARD_ACTIONS.endReveal}:`
  if (!String(customId || '').startsWith(prefix)) return null
  const [choice, ...idParts] = String(customId).slice(prefix.length).split(':')
  return {
    choice,
    revealId: idParts.join(':') || null
  }
}

async function revealWinningTeam(channel, winner, delay = wait, revealContext = {}) {
  const option = WINNER_OPTIONS[winner]
  if (!channel?.isTextBased?.() || !option) return null

  const finalText = messages.get(option.revealKey)
  const verdictText = messages.get('winReveal.step2')
  const winners = getWinningPlayerLabels(winner, revealContext.view, revealContext.playerLabels)
  const message = await queuedChannelSend(channel, {
    embeds: [createRevealEmbed('suspense', messages.get('winReveal.step1'))]
  }).catch(err => {
    log.recoverable('send-final-reveal-message', err, createRevealLogContext(channel, winner, revealContext))
    return null
  })
  if (!message) return null

  await delay(FINAL_REVEAL_EMBED_DELAY_MS)
  await queuedMessageEdit(message, {
    embeds: [createRevealEmbed('neutral', verdictText)]
  }).catch(err => {
    log.recoverable('edit-final-reveal-verdict-message', err, createRevealLogContext(channel, winner, revealContext, message))
  })

  await delay(FINAL_REVEAL_EMBED_DELAY_MS)
  const finalComponents = Array.isArray(revealContext.components)
    ? revealContext.components
    : []
  const finalPayload = { embeds: [createRevealEmbed(winner, finalText, winners)] }
  if (finalComponents.length) finalPayload.components = finalComponents
  await queuedMessageEdit(message, finalPayload).catch(err => {
    log.recoverable('edit-final-reveal-winner-message', err, createRevealLogContext(channel, winner, revealContext, message))
  })

  return message
}

function createRevealLogContext(channel, winner, revealContext = {}, message = null) {
  return {
    channelId: channel?.id,
    guildId: channel?.guildId || channel?.guild?.id || revealContext.view?.guildId,
    messageId: message?.id,
    revealId: revealContext.revealId,
    winner
  }
}

function createRevealEmbed(stage, text, winners = []) {
  const isFinal = stage === 'good' || stage === 'evil'
  const emoji = stage === 'good' ? '💙' : stage === 'evil' ? '🔥' : '✨'
  const title = isFinal ? `${emoji} ${text} ${emoji}` : createRevealTitle(stage)

  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(createDramaticDescription(stage, text, winners))
    .setColor(REVEAL_COLORS[stage] || REVEAL_COLORS.suspense)
    .setTimestamp()
}

function createRevealTitle(stage) {
  if (stage === 'neutral') return '🕯️ The Final Verdict 🕯️'
  return `🎭 ${messages.get('winReveal.title')} 🎭`
}

function createDramaticDescription(stage, text, winners = []) {
  if (stage === 'good') {
    return [
      '✨ The town survives another night. ✨',
      '',
      'The forces of good have prevailed.',
      createWinningPlayersLine(winners)
    ].filter(Boolean).join('\n')
  }

  if (stage === 'evil') {
    return [
      '🩸 Darkness claims the town. 🩸',
      '',
      'Evil has seized the final dawn.',
      createWinningPlayersLine(winners)
    ].filter(Boolean).join('\n')
  }

  if (stage === 'neutral') {
    return [
      '# ✨ The final verdict is forming... ✨',
      '',
      `**${text || ' '}**`,
      '',
      '🕯️ The Grimoire waits in silence. 🕯️'
    ].join('\n')
  }

  return [
    '# ✨ The final truth is revealed... ✨',
    '',
    `**${text}**`,
    '',
    '🎭 The Grimoire has spoken. 🎭'
  ].join('\n')
}

function createWinningPlayersLine(winners = []) {
  if (!winners.length) return null
  return `Winning players: ${winners.join(', ')}`
}

function getWinningPlayerLabels(winner, view, playerLabels = {}) {
  if (!view?.users?.players?.length) return []
  const winningTeams = winner === 'good' ? GOOD_TEAMS : EVIL_TEAMS
  const teamByRole = createTeamByRole(view)

  return view.users.players
    .filter(playerId => winningTeams.has(teamByRole[view.engine.roles?.[playerId]]))
    .map(playerId => playerLabels[playerId] || view.users.displayNames?.[playerId] || `<@${playerId}>`)
}

function createTeamByRole(view) {
  return Object.fromEntries(
    Object.entries(view.engine.roleCategories || {})
      .flatMap(([team, roleIds]) => (roleIds || []).map(roleId => [roleId, team]))
  )
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = {
  FINAL_REVEAL_EMBED_DELAY_MS,
  REVEAL_COLORS,
  WINNER_OPTIONS,
  createDramaticDescription,
  createEndGameRevealPayload,
  createEndRevealCancelledPayload,
  createEndRevealCustomId,
  createWinningPlayersLine,
  getWinningPlayerLabels,
  parseEndRevealCustomId,
  revealWinningTeam
}
