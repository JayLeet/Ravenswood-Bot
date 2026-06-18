const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, EmbedBuilder } = require('discord.js')
const { createSetupDeleteButton } = require('./setupDelete')
const { createExistingSetupCategory: findExistingSetupCategory } = require('./setupChannelPickerLookup')
const {
  GAME_LOG_SAVE_MODES,
  normalizeGameLogSaveMode
} = require('./gameLogSaveMode')

const SETUP_CHANNEL_PICKER_PREFIX = 'botc:setup-manual'
const SETUP_CHANNEL_PICKER_ACCESS = Object.freeze({
  private: 'private',
  public: 'public'
})
const SETUP_CHANNEL_PICKER_ACTIONS = Object.freeze({
  cancel: 'cancel',
  changeCategory: 'change-category',
  confirm: 'confirm',
  createCategory: 'create-category',
  logMode: 'log-mode',
  select: 'select',
  selectCategory: 'select-category'
})
const SETUP_GAME_LOG_SAVE_MODES = GAME_LOG_SAVE_MODES
const SETUP_CHANNEL_PICKER_KEYS = Object.freeze([
  'waitingRoomVoiceChannel',
  'gameLogChannel'
])
const SETUP_CHANNEL_PICKER_DETAILS = Object.freeze({
  waitingRoomVoiceChannel: {
    channelTypes: [ChannelType.GuildVoice],
    fieldName: '\u{1F6AA} Waiting Room',
    label: 'Waiting Room',
    placeholder: '\u{1F6AA} Pick the Waiting Room voice channel'
  },
  gameLogChannel: {
    channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
    fieldName: '\u{1F4DA} Game-log archive',
    label: 'Game-log archive',
    placeholder: '\u{1F4DA} Pick the game-log archive channel'
  }
})

function createSetupChannelPickerPayload(selection = {}, options = {}) {
  const normalized = normalizeSetupChannelSelection(selection)
  const category = options.category || null
  const gameLogSaveMode = normalizeGameLogSaveMode(options.gameLogSaveMode, null)
  const privateAccess = options.privateAccess === true
  return {
    content: null,
    embeds: [createSetupChannelPickerEmbed(normalized, {
      category,
      gameLogSaveMode,
      notice: options.notice,
      privateAccess
    })],
    components: createSetupChannelPickerRows(normalized, {
      category,
      gameLogSaveMode,
      privateAccess
    })
  }
}

function createSetupChannelPickerEmbed(selection, options = {}) {
  const {
    category = null,
    gameLogSaveMode = null,
    notice = null,
    privateAccess = false
  } = options
  const embed = new EmbedBuilder()
    .setTitle('\u{1F9ED} Manual setup picker')
    .setDescription([
      `Access choice: **${privateAccess ? 'Private with BOTC role' : 'Public setup'}**.`,
      category
        ? 'Pick the required Waiting Room, game-log archive, and game-log save behavior.'
        : 'Pick the category that should contain the BOTC setup, or create the default Ravenswood Bluff category.',
      'Waiting Room and game-log archive may be outside the setup category.',
      '`Delete BOTC setup` removes only the setup channels and categories the bot created.'
    ].join('\n'))
    .addFields({
      name: '\u{1F3F0} Setup category',
      value: formatSelectedChannel(category),
      inline: false
    })
    .addFields(SETUP_CHANNEL_PICKER_KEYS.map(key => ({
      name: SETUP_CHANNEL_PICKER_DETAILS[key].fieldName,
      value: formatSelectedChannel(selection[key]),
      inline: true
    })))
    .addFields({
      name: '\u{1F4BE} Game-log saving',
      value: formatGameLogSaveMode(gameLogSaveMode),
      inline: false
    })
    .setColor(category ? 0x2ecc71 : 0x3498db)

  if (notice) {
    embed.addFields({
      name: notice.title || 'Note',
      value: String(notice.message || 'No details provided.').slice(0, 1024),
      inline: false
    })
  }

  return embed
}

function createSetupChannelPickerRows(selection = {}, options = {}) {
  if (!options.category) {
    return [
      new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(createSetupChannelCategorySelectId(options))
          .setPlaceholder('\u{1F3F0} Pick the setup category')
          .setChannelTypes(ChannelType.GuildCategory)
          .setMinValues(1)
          .setMaxValues(1)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(createSetupChannelActionId(SETUP_CHANNEL_PICKER_ACTIONS.createCategory, options))
          .setEmoji('\u{1F3F0}')
          .setLabel('Create Ravenswood Bluff')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(createSetupChannelActionId(SETUP_CHANNEL_PICKER_ACTIONS.cancel, options))
          .setEmoji('\u{2716}\u{FE0F}')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary),
        createSetupDeleteButton()
      )
    ]
  }

  const selectRows = SETUP_CHANNEL_PICKER_KEYS.map(key =>
    new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId(createSetupChannelSelectId(key, options))
        .setPlaceholder(SETUP_CHANNEL_PICKER_DETAILS[key].placeholder)
        .setChannelTypes(...SETUP_CHANNEL_PICKER_DETAILS[key].channelTypes)
        .setMinValues(1)
        .setMaxValues(1)
    )
  )

  return selectRows.concat(
    createGameLogSaveModeRow(options),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(createSetupChannelActionId(SETUP_CHANNEL_PICKER_ACTIONS.confirm, options))
        .setEmoji('\u{2705}')
        .setLabel('Continue setup')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!isSetupManualReady(selection, options.gameLogSaveMode)),
      new ButtonBuilder()
        .setCustomId(createSetupChannelActionId(SETUP_CHANNEL_PICKER_ACTIONS.changeCategory, options))
        .setEmoji('\u{1F504}')
        .setLabel('Change category')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(createSetupChannelActionId(SETUP_CHANNEL_PICKER_ACTIONS.cancel, options))
        .setEmoji('\u{2716}\u{FE0F}')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
      createSetupDeleteButton()
    )
  )
}

function createGameLogSaveModeRow(options = {}) {
  const selected = normalizeGameLogSaveMode(options.gameLogSaveMode, null)
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(createSetupGameLogSaveModeActionId(SETUP_GAME_LOG_SAVE_MODES.auto, options))
      .setEmoji('\u{1F4E4}')
      .setLabel('Auto-save game logs')
      .setStyle(selected === SETUP_GAME_LOG_SAVE_MODES.auto ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(createSetupGameLogSaveModeActionId(SETUP_GAME_LOG_SAVE_MODES.manual, options))
      .setEmoji('\u{1F4BE}')
      .setLabel('Ask before saving')
      .setStyle(selected === SETUP_GAME_LOG_SAVE_MODES.manual ? ButtonStyle.Success : ButtonStyle.Secondary)
  )
}

function createSetupChannelSelectId(key, options = {}) {
  return createSetupChannelCustomId(SETUP_CHANNEL_PICKER_ACTIONS.select, key, options)
}

function createSetupChannelCategorySelectId(options = {}) {
  return createSetupChannelCustomId(SETUP_CHANNEL_PICKER_ACTIONS.selectCategory, null, options)
}

function createSetupChannelActionId(action, options = {}) {
  return createSetupChannelCustomId(action, null, options)
}

function createSetupGameLogSaveModeActionId(mode, options = {}) {
  return createSetupChannelCustomId(SETUP_CHANNEL_PICKER_ACTIONS.logMode, mode, options)
}

function createSetupChannelCustomId(action, key = null, options = {}) {
  const access = getSetupChannelAccessSegment(options)
  return [
    SETUP_CHANNEL_PICKER_PREFIX,
    access,
    action,
    key
  ].filter(Boolean).join(':')
}

function parseSetupChannelsCustomId(customId) {
  const parts = String(customId || '').split(':')
  if (parts[0] !== 'botc' || parts[1] !== 'setup-manual') return null
  let index = 2
  let privateAccess = false
  let accessSpecified = false
  if (Object.values(SETUP_CHANNEL_PICKER_ACCESS).includes(parts[index])) {
    accessSpecified = true
    privateAccess = parts[index] === SETUP_CHANNEL_PICKER_ACCESS.private
    index += 1
  }

  const action = parts[index] || null
  const key = [
    SETUP_CHANNEL_PICKER_ACTIONS.logMode,
    SETUP_CHANNEL_PICKER_ACTIONS.select
  ].includes(action) ? parts[index + 1] : null
  if (!Object.values(SETUP_CHANNEL_PICKER_ACTIONS).includes(action)) return null
  if (action === SETUP_CHANNEL_PICKER_ACTIONS.select && !SETUP_CHANNEL_PICKER_KEYS.includes(key)) return null
  if (action === SETUP_CHANNEL_PICKER_ACTIONS.logMode && !Object.values(SETUP_GAME_LOG_SAVE_MODES).includes(key)) return null
  return { action, key, accessSpecified, privateAccess }
}

function isSetupChannelsInteraction(customId) {
  return Boolean(parseSetupChannelsCustomId(customId))
}

function normalizeSetupChannelSelection(selection = {}) {
  return Object.fromEntries(SETUP_CHANNEL_PICKER_KEYS.map(key => [key, selection[key] || null]))
}

function createExistingSetupChannelSelection() {
  return normalizeSetupChannelSelection()
}

function createExistingSetupCategory(guild) {
  return findExistingSetupCategory(guild)
}

function getMissingSetupChannelKeys(selection = {}) {
  const normalized = normalizeSetupChannelSelection(selection)
  return SETUP_CHANNEL_PICKER_KEYS.filter(key => !normalized[key])
}

function isSetupManualReady(selection = {}, gameLogSaveMode = null) {
  return getMissingSetupChannelKeys(selection).length === 0 &&
    Boolean(normalizeGameLogSaveMode(gameLogSaveMode, null))
}

function formatSelectedChannel(channel) {
  return channel?.id ? `<#${channel.id}>` : 'Not selected'
}

function formatGameLogSaveMode(mode) {
  if (mode === SETUP_GAME_LOG_SAVE_MODES.auto) return 'Auto-save when the game ends.\nThe log posts to the selected archive.'
  if (mode === SETUP_GAME_LOG_SAVE_MODES.manual) return 'Ask before saving.\nThe Storyteller chooses Save to Game Log or Discard Game History.'
  return 'Not selected'
}

function getSetupChannelAccessSegment(options = {}) {
  if (options.privateAccess === true) return SETUP_CHANNEL_PICKER_ACCESS.private
  if (options.privateAccess === false) return SETUP_CHANNEL_PICKER_ACCESS.public
  return null
}

module.exports = {
  SETUP_CHANNEL_PICKER_ACTIONS,
  SETUP_CHANNEL_PICKER_ACCESS,
  SETUP_CHANNEL_PICKER_DETAILS,
  SETUP_CHANNEL_PICKER_KEYS,
  SETUP_CHANNEL_PICKER_PREFIX,
  SETUP_GAME_LOG_SAVE_MODES,
  createExistingSetupChannelSelection,
  createExistingSetupCategory,
  createSetupChannelActionId,
  createSetupChannelCategorySelectId,
  createSetupChannelPickerPayload,
  createSetupChannelSelectId,
  createSetupGameLogSaveModeActionId,
  getMissingSetupChannelKeys,
  isSetupChannelsInteraction,
  isSetupManualReady,
  normalizeGameLogSaveMode,
  normalizeSetupChannelSelection,
  parseSetupChannelsCustomId
}
