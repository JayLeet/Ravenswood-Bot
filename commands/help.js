const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js')
const {
  getInGameHelpPage,
  getHelpPage,
  HELP_PAGE_INDEX,
  HELP_PAGES
} = require('../utils/helpPages')
const {
  acknowledgeInteraction,
  deleteInteractionReply,
  replyPrivatePayload,
  respondPrivatePayload,
  updateInteraction
} = require('../systems/discord/interactions/feedback')
const {
  applyButtonEmoji
} = require('../utils/buttonEmoji')

const HELP_CUSTOM_ID_PREFIX = 'botc_help'
const HELP_MODE_FULL = 'full'
const HELP_MODE_GAME = 'game'

module.exports = {
  name: 'help',
  description: 'Show bot commands and what they do.',
  options: [],
  data: {
    name: 'help',
    description: 'Show bot commands and what they do.',
    options: []
  },
  setupExempt: true,

  async execute(interaction, ctx = {}) {
    return replyPrivatePayload(interaction, createHelpPayload(getInitialHelpPageIndex(interaction, ctx)))
  },

  createHelpButton,
  createInGameHelpButton,
  createHelpPayload,
  createInGameHelpPayload,
  getInitialHelpPageIndex,
  handleHelpInteraction,
  isHelpInteraction
}

function createHelpButton(options = {}) {
  const mode = options.mode === HELP_MODE_GAME ? HELP_MODE_GAME : HELP_MODE_FULL
  return applyButtonEmoji(new ButtonBuilder()
    .setCustomId(createHelpCustomId(mode === HELP_MODE_GAME ? 'open-game' : 'open', 0))
    .setLabel('Help')
    .setStyle(ButtonStyle.Secondary), 'Help')
}

function createInGameHelpButton() {
  return createHelpButton({ mode: HELP_MODE_GAME })
}

function createHelpPayload(index) {
  const page = getHelpPage(index)
  return createHelpPagePayload(page, HELP_MODE_FULL)
}

function createInGameHelpPayload() {
  return createHelpPagePayload(getInGameHelpPage(), HELP_MODE_GAME)
}

function createHelpPagePayload(page, mode) {
  const embed = new EmbedBuilder()
    .setTitle(page.title)
    .setDescription(page.description.join('\n'))
    .setFooter({ text: `Page ${page.index + 1}/${page.total}` })
    .setColor(0x3498db)

  if (page.fields?.length) embed.addFields(page.fields)

  return {
    embeds: [embed],
    components: [createHelpControls(page.index, mode, page.total)]
  }
}

function createHelpControls(index, mode = HELP_MODE_FULL, total = HELP_PAGES.length) {
  if (mode === HELP_MODE_GAME) {
    return new ActionRowBuilder().addComponents(
      applyButtonEmoji(new ButtonBuilder()
        .setCustomId(createHelpCustomId('close-game', index))
        .setLabel('Close')
        .setStyle(ButtonStyle.Secondary), 'Close')
    )
  }

  return new ActionRowBuilder().addComponents(
    applyButtonEmoji(new ButtonBuilder()
      .setCustomId(createHelpCustomId('prev', index - 1))
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(index <= 0), 'Previous'),
    applyButtonEmoji(new ButtonBuilder()
      .setCustomId(createHelpCustomId('next', index + 1))
      .setLabel('Next')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(index >= total - 1), 'Next'),
    applyButtonEmoji(new ButtonBuilder()
      .setCustomId(createHelpCustomId('close', index))
      .setLabel('Close')
      .setStyle(ButtonStyle.Secondary), 'Close')
  )
}

function createHelpCustomId(action, index) {
  return `${HELP_CUSTOM_ID_PREFIX}:${action}:${index}`
}

function isHelpInteraction(customId) {
  return String(customId || '').startsWith(`${HELP_CUSTOM_ID_PREFIX}:`)
}

async function handleHelpInteraction(interaction) {
  const [, action, rawIndex] = String(interaction.customId).split(':')

  if (action === 'open') return openPrivateHelp(interaction, rawIndex)
  if (action === 'open-game') return openPrivateHelp(interaction, rawIndex, HELP_MODE_GAME)

  if (action === 'close' || action === 'close-game') {
    return closeHelp(interaction)
  }

  return updateInteraction(interaction, createHelpPayload(rawIndex))
}

async function openPrivateHelp(interaction, rawIndex, mode = HELP_MODE_FULL) {
  const payload = mode === HELP_MODE_GAME ? createInGameHelpPayload() : createHelpPayload(rawIndex)
  const sent = await respondPrivatePayload(interaction, payload)
  return sent || updateInteraction(interaction, payload)
}

async function closeHelp(interaction) {
  await acknowledgeInteraction(interaction)
  const deleted = await deleteInteractionReply(interaction)
  if (deleted) return deleted

  return updateInteraction(interaction, {
    content: '\u200B',
    embeds: [],
    components: []
  })
}

function getInitialHelpPageIndex(interaction, ctx = {}) {
  const role = getInteractionHelpRole(interaction, ctx)
  if (role === 'storyteller') return HELP_PAGE_INDEX.storyteller
  if (role === 'player') return HELP_PAGE_INDEX.player
  if (role === 'spectator') return HELP_PAGE_INDEX.spectator
  return HELP_PAGE_INDEX.overview
}

function getInteractionHelpRole(interaction, ctx = {}) {
  const userId = interaction.member?.id || interaction.user?.id
  const guildId = interaction.guild?.id
  const view = guildId && typeof ctx.gameLifecycle?.getGameView === 'function'
    ? ctx.gameLifecycle.getGameView(guildId)
    : null

  const viewRole = getHelpRoleFromView(view, userId)
  if (viewRole || view) return viewRole

  return getHelpRoleFromMember(interaction.member, ctx.gameManager)
}

function getHelpRoleFromView(view, userId) {
  if (!view || !userId) return null
  const users = view.users || {}

  if (view.storytellerId === userId || users.storyteller === userId) return 'storyteller'
  if ((users.players || []).includes(userId)) return 'player'
  if ((users.spectators || []).includes(userId)) return 'spectator'
  return null
}

function getHelpRoleFromMember(member, gameManager) {
  if (!member || !gameManager) return null
  if (gameManager.hasGameRole?.(member, 'storyteller')) return 'storyteller'
  if (gameManager.hasGameRole?.(member, 'player')) return 'player'
  if (gameManager.hasGameRole?.(member, 'spectator') || gameManager.hasGrimoireSpectatorRole?.(member)) return 'spectator'
  return null
}
