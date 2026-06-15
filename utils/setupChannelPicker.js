const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder
} = require('discord.js')
const {
  AUTO_SETUP_CHANNELS
} = require('./setupAutoChannels')

const SETUP_CHANNEL_PICKER_PREFIX = 'botc:setup-channels'
const SETUP_CHANNEL_PICKER_ACTIONS = Object.freeze({
  cancel: 'cancel',
  confirm: 'confirm',
  createMissing: 'create-missing',
  select: 'select'
})
const SETUP_CHANNEL_PICKER_KEYS = Object.freeze([
  'gameChannel',
  'liveChannel',
  'spectatorChannel',
  'storytellerChannel'
])
const SETUP_CHANNEL_PICKER_DETAILS = Object.freeze({
  gameChannel: {
    label: 'Game lobby help',
    createConfig: AUTO_SETUP_CHANNELS.game,
    placeholder: 'Pick the game lobby help channel'
  },
  liveChannel: {
    label: 'Live game chat',
    createConfig: AUTO_SETUP_CHANNELS.live,
    placeholder: 'Pick the live game chat channel'
  },
  spectatorChannel: {
    label: 'Spectator gallery',
    createConfig: AUTO_SETUP_CHANNELS.spectator,
    placeholder: 'Pick the spectator gallery channel'
  },
  storytellerChannel: {
    label: 'Storyteller dashboard',
    createConfig: AUTO_SETUP_CHANNELS.storyteller,
    placeholder: 'Pick the Storyteller dashboard channel'
  }
})

function createSetupChannelPickerPayload(selection = {}, options = {}) {
  const normalized = normalizeSetupChannelSelection(selection)
  const missing = getMissingSetupChannelKeys(normalized)
  return {
    content: null,
    embeds: [createSetupChannelPickerEmbed(normalized, missing, options.notice)],
    components: createSetupChannelPickerRows(normalized, missing)
  }
}

function createSetupChannelPickerEmbed(selection, missing, notice = null) {
  const embed = new EmbedBuilder()
    .setTitle('Choose setup channels')
    .setDescription([
      'Pick existing text channels for the main BOTC setup areas.',
      'Use `Create missing channels` if you want me to make any channels that are not selected yet.'
    ].join('\n'))
    .addFields(SETUP_CHANNEL_PICKER_KEYS.map(key => ({
      name: SETUP_CHANNEL_PICKER_DETAILS[key].label,
      value: formatSelectedChannel(selection[key]),
      inline: true
    })))
    .setColor(missing.length ? 0x3498db : 0x2ecc71)

  if (notice) {
    embed.addFields({
      name: notice.title || 'Note',
      value: String(notice.message || 'No details provided.').slice(0, 1024),
      inline: false
    })
  }

  return embed
}

function createSetupChannelPickerRows(selection, missing) {
  const selectRows = SETUP_CHANNEL_PICKER_KEYS.map(key =>
    new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId(createSetupChannelSelectId(key))
        .setPlaceholder(SETUP_CHANNEL_PICKER_DETAILS[key].placeholder)
        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setMinValues(1)
        .setMaxValues(1)
    )
  )

  return selectRows.concat(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(createSetupChannelActionId(SETUP_CHANNEL_PICKER_ACTIONS.createMissing))
        .setLabel('Create missing channels')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(missing.length === 0),
      new ButtonBuilder()
        .setCustomId(createSetupChannelActionId(SETUP_CHANNEL_PICKER_ACTIONS.confirm))
        .setLabel('Continue setup')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(missing.length > 0),
      new ButtonBuilder()
        .setCustomId(createSetupChannelActionId(SETUP_CHANNEL_PICKER_ACTIONS.cancel))
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    )
  )
}

function createSetupChannelSelectId(key) {
  return `${SETUP_CHANNEL_PICKER_PREFIX}:${SETUP_CHANNEL_PICKER_ACTIONS.select}:${key}`
}

function createSetupChannelActionId(action) {
  return `${SETUP_CHANNEL_PICKER_PREFIX}:${action}`
}

function parseSetupChannelsCustomId(customId) {
  const parts = String(customId || '').split(':')
  if (parts[0] !== 'botc' || parts[1] !== 'setup-channels') return null
  const action = parts[2] || null
  const key = action === SETUP_CHANNEL_PICKER_ACTIONS.select ? parts[3] : null
  if (!Object.values(SETUP_CHANNEL_PICKER_ACTIONS).includes(action)) return null
  if (key && !SETUP_CHANNEL_PICKER_KEYS.includes(key)) return null
  return { action, key }
}

function isSetupChannelsInteraction(customId) {
  return Boolean(parseSetupChannelsCustomId(customId))
}

function normalizeSetupChannelSelection(selection = {}) {
  return Object.fromEntries(SETUP_CHANNEL_PICKER_KEYS.map(key => [key, selection[key] || null]))
}

function getMissingSetupChannelKeys(selection = {}) {
  const normalized = normalizeSetupChannelSelection(selection)
  return SETUP_CHANNEL_PICKER_KEYS.filter(key => !normalized[key])
}

function formatSelectedChannel(channel) {
  return channel?.id ? `<#${channel.id}>` : 'Not selected'
}

module.exports = {
  SETUP_CHANNEL_PICKER_ACTIONS,
  SETUP_CHANNEL_PICKER_DETAILS,
  SETUP_CHANNEL_PICKER_KEYS,
  SETUP_CHANNEL_PICKER_PREFIX,
  createSetupChannelActionId,
  createSetupChannelPickerPayload,
  createSetupChannelSelectId,
  getMissingSetupChannelKeys,
  isSetupChannelsInteraction,
  normalizeSetupChannelSelection,
  parseSetupChannelsCustomId
}
