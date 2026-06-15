const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js')
const {
  BOT_UPDATE_CHANNEL_NAME
} = require('./botcChannelNames')
const {
  createSetupDeleteButton
} = require('./setupDelete')

const SETUP_ACCESS_PREFIX = 'botc:setup-access:'
const SETUP_ACCESS_MODES = Object.freeze({
  auto: 'auto',
  manual: 'manual'
})
const SETUP_ACCESS_ACTIONS = Object.freeze({
  cancel: `${SETUP_ACCESS_PREFIX}cancel`,
  private: `${SETUP_ACCESS_PREFIX}private`,
  public: `${SETUP_ACCESS_PREFIX}public`
})

function createSetupAccessChoicePayload(options = {}) {
  const mode = normalizeSetupAccessMode(options.mode)
  const manual = mode === SETUP_ACCESS_MODES.manual
  return {
    embeds: [new EmbedBuilder()
      .setTitle(manual ? '🎭 Choose manual setup access' : '🎭 Setup Blood on the Clocktower')
      .setDescription([
        manual
          ? 'Choose how visible the Ravenswood Bluff setup should be before picking channels.'
          : 'Choose how visible the Ravenswood Bluff setup should be.',
        '',
        '🌍 **Public setup:** everyone can see the public setup channels.',
        '🩸 **Private setup:** I create or reuse the Blood on the Clocktower role and hide the setup categories from @everyone.'
      ].join('\n'))
      .addFields(createSetupPreviewFields({ mode }))
      .setColor(0x8e44ad)
      .setTimestamp()],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(createSetupAccessActionId('public', mode))
        .setEmoji('🌍')
        .setLabel('Public setup')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(createSetupAccessActionId('private', mode))
        .setEmoji('🩸')
        .setLabel('Private with BOTC role')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(createSetupAccessActionId('cancel', mode))
        .setEmoji('✖️')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
      createSetupDeleteButton()
    )]
  }
}

function createSetupPreviewFields(options = {}) {
  const mode = normalizeSetupAccessMode(options.mode)
  const importantLines = mode === SETUP_ACCESS_MODES.manual
    ? [
        '• 🛠️ Manual setup uses the channels you pick, creates missing setup channels if you choose that option, then creates or reuses the BOTC roles and shared setup channels.',
        '• 🔒 Private setup hides the setup categories from @everyone; the bot channel is visible only to administrators and the configured bot owner access user, while the BOTC role can see the game lobby/help channel, post-game chat, game-log archive, and Waiting Room.'
      ]
    : [
        '• 🛠️ Setup creates or reuses the BOTC roles and channels listed above.',
        '• ♻️ Automatic setup resets existing bot-managed Ravenswood Bluff and Reserved Night Area categories before rebuilding them.',
        '• 🔒 Private setup hides the setup categories from @everyone; the bot channel is visible only to administrators and the configured bot owner access user, while the BOTC role can see the game lobby/help channel, post-game chat, game-log archive, and Waiting Room.'
      ]

  return [
    {
      name: '🧩 Roles',
      value: [
        '• 🎭 Player',
        '• 👁️ Spectator',
        '• 📖 Storyteller',
        '• 👁️🔎 Spectator',
        '• 🩸 Blood on the Clocktower *(private setup only)*'
      ].join('\n'),
      inline: false
    },
    {
      name: '🏰 Categories',
      value: [
        '• 🏘️ Ravenswood Bluff',
        '• 🌙 Reserved Night Area / cottage channels'
      ].join('\n'),
      inline: false
    },
    {
      name: '💬 Text channels',
      value: [
        `• ${BOT_UPDATE_CHANNEL_NAME}`,
        '• 🎭-game-lobby-help',
        '• 📖-storyteller-dashboard',
        '• 📣-live-game-chat',
        '• 🔎-post-game-chat',
        '• 👁️-spectator-gallery',
        '• 🗂️-game-log'
      ].join('\n'),
      inline: false
    },
    {
      name: '🔊 Voice channels',
      value: [
        '• 🕰️ Waiting Room',
        '• 🏚️ Storyteller Den',
        '• 🏛️ Town Square and public side rooms',
        '• 🗣️ Private conversation creator',
        '• 🌙 Reserved cottage voice channels'
      ].join('\n'),
      inline: false
    },
    {
      name: '⚠️ Important',
      value: importantLines.join('\n'),
      inline: false
    }
  ]
}

function createSetupAccessActionId(action, mode = SETUP_ACCESS_MODES.auto) {
  const normalized = normalizeSetupAccessMode(mode)
  if (!['cancel', 'private', 'public'].includes(action)) return SETUP_ACCESS_ACTIONS.cancel
  if (normalized === SETUP_ACCESS_MODES.auto) return `${SETUP_ACCESS_PREFIX}${action}`
  return `${SETUP_ACCESS_PREFIX}${normalized}:${action}`
}

function parseSetupAccessChoiceCustomId(customId) {
  if (!String(customId || '').startsWith(SETUP_ACCESS_PREFIX)) return null
  const parts = String(customId).slice(SETUP_ACCESS_PREFIX.length).split(':')
  const mode = parts.length === 2 ? normalizeSetupAccessMode(parts[0]) : SETUP_ACCESS_MODES.auto
  const action = parts.length === 2 ? parts[1] : parts[0]
  if (!['cancel', 'private', 'public'].includes(action)) return null
  return { action, mode, privateAccess: action === 'private' }
}

function isSetupAccessChoiceInteraction(customId) {
  return !!parseSetupAccessChoiceCustomId(customId)
}

function normalizeSetupAccessMode(mode) {
  return mode === SETUP_ACCESS_MODES.manual ? SETUP_ACCESS_MODES.manual : SETUP_ACCESS_MODES.auto
}

module.exports = {
  SETUP_ACCESS_ACTIONS,
  SETUP_ACCESS_MODES,
  createSetupAccessActionId,
  createSetupAccessChoicePayload,
  createSetupPreviewFields,
  isSetupAccessChoiceInteraction,
  parseSetupAccessChoiceCustomId
}
