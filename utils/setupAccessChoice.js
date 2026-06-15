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
const SETUP_ACCESS_ACTIONS = Object.freeze({
  cancel: `${SETUP_ACCESS_PREFIX}cancel`,
  private: `${SETUP_ACCESS_PREFIX}private`,
  public: `${SETUP_ACCESS_PREFIX}public`
})

function createSetupAccessChoicePayload() {
  return {
    embeds: [new EmbedBuilder()
      .setTitle('🎭 Setup Blood on the Clocktower')
      .setDescription([
        'Choose how visible the Ravenswood Bluff setup should be.',
        '',
        '🌍 **Public setup:** everyone can see the public setup channels.',
        '🩸 **Private setup:** I create or reuse the Blood on the Clocktower role and hide the setup categories from @everyone.'
      ].join('\n'))
      .addFields(createSetupPreviewFields())
      .setColor(0x8e44ad)
      .setTimestamp()],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(SETUP_ACCESS_ACTIONS.public)
        .setEmoji('🌍')
        .setLabel('Public setup')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(SETUP_ACCESS_ACTIONS.private)
        .setEmoji('🩸')
        .setLabel('Private with BOTC role')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(SETUP_ACCESS_ACTIONS.cancel)
        .setEmoji('✖️')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
      createSetupDeleteButton()
    )]
  }
}

function createSetupPreviewFields() {
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
      value: [
        '• 🛠️ Setup creates or reuses the BOTC roles and channels listed above.',
        '• ♻️ Automatic setup resets existing bot-managed Ravenswood Bluff and Reserved Night Area categories before rebuilding them.',
        '• 🔒 Private setup hides the setup categories from @everyone; the bot channel is visible only to administrators and the configured bot owner access user, while the BOTC role can see the game lobby/help channel, post-game chat, game-log archive, and Waiting Room.'
      ].join('\n'),
      inline: false
    }
  ]
}

function parseSetupAccessChoiceCustomId(customId) {
  if (!String(customId || '').startsWith(SETUP_ACCESS_PREFIX)) return null
  const action = String(customId).slice(SETUP_ACCESS_PREFIX.length)
  if (!['cancel', 'private', 'public'].includes(action)) return null
  return { action, privateAccess: action === 'private' }
}

function isSetupAccessChoiceInteraction(customId) {
  return !!parseSetupAccessChoiceCustomId(customId)
}

module.exports = {
  SETUP_ACCESS_ACTIONS,
  createSetupAccessChoicePayload,
  createSetupPreviewFields,
  isSetupAccessChoiceInteraction,
  parseSetupAccessChoiceCustomId
}
