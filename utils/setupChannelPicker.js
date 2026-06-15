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
const {
  AUTO_SETUP_CATEGORY_NAME
} = require('./botcChannelNames')
const {
  createSetupDeleteButton
} = require('./setupDelete')

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
      'Use `Create missing channels` if you want me to make any channels that are not selected yet.',
      '`Delete BOTC setup` removes only the setup channels and categories the bot created.'
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
        .setStyle(ButtonStyle.Secondary),
      createSetupDeleteButton()
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

function createExistingSetupChannelSelection(guild, parentId = null) {
  return Object.fromEntries(SETUP_CHANNEL_PICKER_KEYS.map(key => [
    key,
    findExistingSetupChannel(guild, key, parentId)
  ]))
}

function fillMissingSetupChannelSelection(selection = {}, guild, parentId = null) {
  const normalized = normalizeSetupChannelSelection(selection)
  const existing = createExistingSetupChannelSelection(guild, parentId)
  for (const key of SETUP_CHANNEL_PICKER_KEYS) {
    if (!normalized[key] && existing[key]) normalized[key] = existing[key]
  }
  return normalized
}

function getMissingSetupChannelKeys(selection = {}) {
  const normalized = normalizeSetupChannelSelection(selection)
  return SETUP_CHANNEL_PICKER_KEYS.filter(key => !normalized[key])
}

function formatSelectedChannel(channel) {
  return channel?.id ? `<#${channel.id}>` : 'Not selected'
}

function findExistingSetupChannel(guild, key, parentId = null) {
  const config = SETUP_CHANNEL_PICKER_DETAILS[key]?.createConfig
  if (!config) return null

  const channels = getCachedGuildChannels(guild)
  const setupParentId = parentId || findAutoSetupCategory(channels)?.id || null
  return channels.find(channel =>
    channel?.name === config.name &&
    isTextSetupChannel(channel) &&
    (!setupParentId || String(channel.parentId || channel.parent?.id || '') === String(setupParentId))
  ) || null
}

function findAutoSetupCategory(channels) {
  return channels.find(channel =>
    channel?.type === ChannelType.GuildCategory &&
    channel?.name === AUTO_SETUP_CATEGORY_NAME
  ) || null
}

function isTextSetupChannel(channel) {
  return channel?.type === ChannelType.GuildText || channel?.type === ChannelType.GuildAnnouncement
}

function getCachedGuildChannels(guild) {
  const cache = guild?.channels?.cache
  if (!cache) return []
  if (Array.isArray(cache)) return cache
  if (typeof cache.values === 'function') return [...cache.values()]
  if (typeof cache[Symbol.iterator] === 'function') return [...cache]
  return Object.values(cache)
}

module.exports = {
  SETUP_CHANNEL_PICKER_ACTIONS,
  SETUP_CHANNEL_PICKER_DETAILS,
  SETUP_CHANNEL_PICKER_KEYS,
  SETUP_CHANNEL_PICKER_PREFIX,
  createExistingSetupChannelSelection,
  createSetupChannelActionId,
  createSetupChannelPickerPayload,
  createSetupChannelSelectId,
  fillMissingSetupChannelSelection,
  getMissingSetupChannelKeys,
  isSetupChannelsInteraction,
  normalizeSetupChannelSelection,
  parseSetupChannelsCustomId
}
