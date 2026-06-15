const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js')
const {
  getHelpPage,
  HELP_PAGES
} = require('../utils/helpPages')
const {
  replyPrivatePayload,
  respondPrivatePayload,
  updateInteraction
} = require('../systems/discord/interactions/feedback')
const {
  applyButtonEmoji
} = require('../utils/buttonEmoji')

const HELP_CUSTOM_ID_PREFIX = 'botc_help'

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

  async execute(interaction) {
    return replyPrivatePayload(interaction, createHelpPayload(0))
  },

  createHelpButton,
  createHelpPayload,
  handleHelpInteraction,
  isHelpInteraction
}

function createHelpButton() {
  return applyButtonEmoji(new ButtonBuilder()
    .setCustomId(createHelpCustomId('open', 0))
    .setLabel('Help')
    .setStyle(ButtonStyle.Secondary), 'Help')
}

function createHelpPayload(index) {
  const page = getHelpPage(index)

  return {
    embeds: [
      new EmbedBuilder()
        .setTitle(page.title)
        .setDescription(page.description.join('\n'))
        .setFooter({ text: `Page ${page.index + 1}/${page.total}` })
        .setColor(0x3498db)
    ],
    components: [createHelpControls(page.index)]
  }
}

function createHelpControls(index) {
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
      .setDisabled(index >= HELP_PAGES.length - 1), 'Next'),
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

  if (action === 'close') {
    return updateInteraction(interaction, {
      content: 'Help closed.',
      embeds: [],
      components: []
    })
  }

  return updateInteraction(interaction, createHelpPayload(rawIndex))
}

async function openPrivateHelp(interaction, rawIndex) {
  const payload = createHelpPayload(rawIndex)
  const sent = await respondPrivatePayload(interaction, payload)
  return sent || updateInteraction(interaction, payload)
}
