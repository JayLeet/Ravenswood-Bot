const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js')
const {
  createSetupPreviewFields,
  createSetupPreviewSummaryFields
} = require('./setupAccessPreview')
const {
  createSetupDeleteButton
} = require('./setupDelete')
const {
  normalizeGameLogSaveMode
} = require('./gameLogSaveMode')
const {
  SETUP_ACCESS_LOG_MODE_ACTION,
  createSetupGameLogSaveField,
  createSetupGameLogSaveRow
} = require('./setupAccessGameLogSave')

const SETUP_ACCESS_PREFIX = 'botc:setup-access:'
const SETUP_ACCESS_MODES = Object.freeze({
  auto: 'auto',
  manual: 'manual'
})
const SETUP_ACCESS_CONFIRM_ACTIONS = Object.freeze({
  private: 'confirm-private',
  public: 'confirm-public'
})

function createSetupModeChoicePayload() {
  return {
    embeds: [new EmbedBuilder()
      .setTitle('\u{1F3AD} Set up BOTC Bot')
      .setDescription([
        'Choose how I should prepare this server.',
        'Nothing changes until you confirm the setup path.'
      ].join('\n'))
      .addFields(
        {
          name: '\u{1F6E0}\u{FE0F} Automatic setup',
          value: 'Recommended. I rebuild the BOTC-managed Ravenswood Bluff setup for you.',
          inline: false
        },
        {
          name: '\u{1F9ED} Manual setup',
          value: 'Use this when the server already has a Waiting Room or game-log archive to reuse.',
          inline: false
        }
      )
      .setColor(0x8e44ad)
      .setTimestamp()],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(createSetupAccessActionId('automatic'))
        .setEmoji('\u{2699}\u{FE0F}')
        .setLabel('Automatic setup')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(createSetupAccessActionId('manual'))
        .setEmoji('\u{1F4C2}')
        .setLabel('Manual setup')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(createSetupAccessActionId('cancel'))
        .setEmoji('\u{2716}\u{FE0F}')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
      createSetupDeleteButton()
    )]
  }
}

function createSetupAccessChoicePayload(options = {}) {
  const mode = normalizeSetupAccessMode(options.mode)
  const manual = mode === SETUP_ACCESS_MODES.manual
  return {
    embeds: [new EmbedBuilder()
      .setTitle(manual ? '\u{1F9ED} Manual setup visibility' : '\u{1F3AD} Setup visibility')
      .setDescription([
        'Choose who can see the BOTC setup after it is created.',
        'Nothing changes until the final confirmation.',
      ].join('\n'))
      .addFields(createSetupPreviewSummaryFields({ mode }))
      .setColor(0x8e44ad)
      .setTimestamp()],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(createSetupAccessActionId('public', mode))
          .setEmoji('\u{1F30D}')
          .setLabel('Public setup')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(createSetupAccessActionId('private', mode))
          .setEmoji('\u{1F512}')
          .setLabel('Private with BOTC role')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(createSetupAccessActionId('details', mode))
          .setEmoji('\u{1F4CB}')
          .setLabel('Details')
          .setStyle(ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(createSetupAccessActionId('cancel', mode))
          .setEmoji('\u{2716}\u{FE0F}')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary),
        createSetupDeleteButton()
      )
    ]
  }
}

function createSetupManagedDetailsPayload(options = {}) {
  const mode = normalizeSetupAccessMode(options.mode)
  const manual = mode === SETUP_ACCESS_MODES.manual

  return {
    embeds: [new EmbedBuilder()
      .setTitle(manual ? '\u{1F9ED} Manual setup details' : '\u{1F3AD} Automatic setup details')
      .setDescription([
        'These are the BOTC-managed pieces I create, reuse, or refresh during this setup path.',
        'Nothing changes until the final confirmation.'
      ].join('\n'))
      .addFields(createSetupPreviewFields({ mode }))
      .setColor(0x8e44ad)
      .setTimestamp()],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(createSetupAccessActionId('details-back', mode))
          .setEmoji('\u{2B05}\u{FE0F}')
          .setLabel('Back')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(createSetupAccessActionId('public', mode))
          .setEmoji('\u{1F30D}')
          .setLabel('Public setup')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(createSetupAccessActionId('private', mode))
          .setEmoji('\u{1F512}')
          .setLabel('Private with BOTC role')
          .setStyle(ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(createSetupAccessActionId('cancel', mode))
          .setEmoji('\u{2716}\u{FE0F}')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary),
        createSetupDeleteButton()
      )
    ]
  }
}

function createSetupConfirmPayload(options = {}) {
  const mode = normalizeSetupAccessMode(options.mode)
  const manual = mode === SETUP_ACCESS_MODES.manual
  const privateAccess = options.privateAccess === true
  const gameLogSaveMode = manual ? null : normalizeGameLogSaveMode(options.gameLogSaveMode, null)
  const confirmAction = privateAccess
    ? SETUP_ACCESS_CONFIRM_ACTIONS.private
    : SETUP_ACCESS_CONFIRM_ACTIONS.public
  const fields = [
    {
      name: '\u{1F6E0}\u{FE0F} Setup type',
      value: manual ? 'Manual setup' : 'Automatic setup',
      inline: true
    },
    {
      name: '\u{1F441}\u{FE0F} Visibility',
      value: privateAccess ? 'Private with BOTC role' : 'Public setup',
      inline: true
    },
    manual ? null : createSetupGameLogSaveField(gameLogSaveMode),
    {
      name: '\u{27A1}\u{FE0F} Next step',
      value: manual
        ? 'I will open the category, Waiting Room, game-log archive, and save-behavior picker.'
        : 'Choose game-log saving, then I will create or refresh the bot-managed setup.',
      inline: false
    }
  ].filter(Boolean)
  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(createSetupAccessActionId(confirmAction, mode, gameLogSaveMode))
        .setEmoji(manual ? '\u{1F4C2}' : '\u{2699}\u{FE0F}')
        .setLabel(manual ? 'Continue to manual setup' : 'Start setup')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!manual && !gameLogSaveMode),
      new ButtonBuilder()
        .setCustomId(createSetupAccessActionId(manual ? 'manual' : 'automatic'))
        .setEmoji('\u{2B05}\u{FE0F}')
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(createSetupAccessActionId('cancel', mode))
        .setEmoji('\u{2716}\u{FE0F}')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
      createSetupDeleteButton()
    )
  ]
  if (!manual) rows.unshift(createSetupGameLogSaveRow(privateAccess, gameLogSaveMode))

  return {
    embeds: [new EmbedBuilder()
      .setTitle('\u{2705} Confirm setup path')
      .setDescription(manual
        ? 'Confirm this setup path before choosing the category, channels, and game-log behavior.'
        : 'Confirm this setup path before I create or refresh the setup.')
      .addFields(fields)
      .setColor(privateAccess ? 0x8e44ad : 0x2ecc71)
      .setTimestamp()],
    components: rows
  }
}

function createSetupAccessActionId(action, mode = SETUP_ACCESS_MODES.auto, gameLogSaveMode = null) {
  const normalized = normalizeSetupAccessMode(mode)
  if (![
    'automatic',
    'cancel',
    'confirm-private',
    'confirm-public',
    'details',
    'details-back',
    'manual',
    'private',
    'public'
  ].includes(action)) return `${SETUP_ACCESS_PREFIX}cancel`
  if (normalized === SETUP_ACCESS_MODES.auto) {
    const suffix = action.startsWith('confirm-') && normalizeGameLogSaveMode(gameLogSaveMode, null)
      ? `:${gameLogSaveMode}`
      : ''
    return `${SETUP_ACCESS_PREFIX}${action}${suffix}`
  }
  return `${SETUP_ACCESS_PREFIX}${normalized}:${action}`
}

function parseSetupAccessChoiceCustomId(customId) {
  if (!String(customId || '').startsWith(SETUP_ACCESS_PREFIX)) return null
  let parts = String(customId).slice(SETUP_ACCESS_PREFIX.length).split(':')
  const mode = parts.length > 1 && parts[0] === SETUP_ACCESS_MODES.manual
    ? parts.shift()
    : SETUP_ACCESS_MODES.auto
  const action = parts[0]
  if (!['automatic', 'cancel', 'confirm-private', 'confirm-public', 'details', 'details-back', 'manual', 'private', 'public', SETUP_ACCESS_LOG_MODE_ACTION].includes(action)) return null
  if (mode === SETUP_ACCESS_MODES.manual && action === 'automatic') return null
  if (mode === SETUP_ACCESS_MODES.manual && action === 'manual') return null
  if (mode === SETUP_ACCESS_MODES.manual && action === SETUP_ACCESS_LOG_MODE_ACTION) return null
  const gameLogSaveMode = action === SETUP_ACCESS_LOG_MODE_ACTION || action.startsWith('confirm-')
    ? normalizeGameLogSaveMode(parts[1], null)
    : null
  const accessChoice = action === SETUP_ACCESS_LOG_MODE_ACTION ? parts[2] : null
  if (action === SETUP_ACCESS_LOG_MODE_ACTION && (!gameLogSaveMode || !['public', 'private'].includes(accessChoice))) return null
  return {
    action,
    gameLogSaveMode,
    mode,
    privateAccess: action === 'private' || action === SETUP_ACCESS_CONFIRM_ACTIONS.private || accessChoice === 'private'
  }
}

function isSetupAccessChoiceInteraction(customId) {
  return !!parseSetupAccessChoiceCustomId(customId)
}

function normalizeSetupAccessMode(mode) {
  return mode === SETUP_ACCESS_MODES.manual ? SETUP_ACCESS_MODES.manual : SETUP_ACCESS_MODES.auto
}

module.exports = {
  SETUP_ACCESS_CONFIRM_ACTIONS,
  SETUP_ACCESS_MODES,
  createSetupAccessActionId,
  createSetupAccessChoicePayload,
  createSetupConfirmPayload,
  createSetupManagedDetailsPayload,
  createSetupModeChoicePayload,
  createSetupPreviewFields,
  createSetupPreviewSummaryFields,
  isSetupAccessChoiceInteraction,
  parseSetupAccessChoiceCustomId
}
