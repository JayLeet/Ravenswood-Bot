const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder
} = require('discord.js')
const {
  COMMON_WAKE_OPTIONS,
  NUMBER_WAKE_OPTIONS,
  SECOND_PAGE_WAKE_OPTIONS,
  getWakeOptionText
} = require('./nightWakeOptions')
const {
  createFirstNightEvilInfoText,
  createFirstNightInfoFields,
  createFirstNightRoleInfoText
} = require('./nightWakeInfo')
const { createFullGrimoirePayload } = require('./storytellerDashboard/grimoireView')
const { createRequestStorytellerRow } = require('./storytellerRequestButtons')
const { formatRoleWithEmoji } = require('./roleFormatting')
const { createPlayerGrimoireOpenButton } = require('./playerGrimoire')
const {
  addDraftField,
  createButtonRows,
  truncate
} = require('./nightActionRows')
const {
  NIGHT_ACTION_ACTIONS,
  createNightClearCustomId,
  createNightCopyGrimoireCustomId,
  createNightInfoAckCustomId,
  createNightInfoDismissCustomId,
  createNightResponseCustomId,
  createNightResponsePageCustomId,
  createNightResponsePlayerCustomId,
  createNightResponseRoleCustomId,
  createNightSubmitCustomId,
  createNightTargetCustomId,
  isNightActionInteraction,
  parseNightActionCustomId
} = require('./nightActionCustomIds')

function createNightTargetPromptPayload({ action, actorId, players, playerLabels, view = null, draft = [] }) {
  const options = createPlayerTargetOptions(resolveTargetPlayers(action, actorId, players, view), playerLabels, actorId)
  const targetCount = Math.max(1, Math.min(Number(action.targetCount) || 1, options.length))
  const embed = createWakeEmbed(action, action.prompt || 'Choose your target, then wait for the Storyteller.', view, playerLabels)
  addDraftField(embed, draft)
  return {
    content: createActorContent(actorId, view),
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(createNightTargetCustomId(action.id))
          .setPlaceholder(targetCount > 1 ? `Choose ${targetCount} targets` : 'Choose a target')
          .setMinValues(targetCount)
          .setMaxValues(targetCount)
          .addOptions(options)
      ),
      createSubmitRow(action, draft)
    ]
  }
}

function createNightResponseMenuPayload({ action, text, page = 'main', view = null, playerLabels = {}, draft = [] }) {
  const actorId = action.actorId || action.playerId
  const firstNightRoleInfo = isFirstNightRoleInfoAction(action, view, playerLabels)
  if (shouldShowSpyGrimoire(action, view)) {
    const grimoire = createFullGrimoirePayload(view, playerLabels, {
      readOnly: true,
      title: 'Spy Copy Grimoire'
    })
    return { content: createActorContent(actorId, view), embeds: grimoire.embeds, components: [createSpyGrimoireRow(action)] }
  }

  const components = createNightResponseComponents(action, page, view, playerLabels, firstNightRoleInfo)
  const embed = createWakeEmbed(action, text || action.prompt || 'Choose a response.', view, playerLabels, firstNightRoleInfo)
  addDraftField(embed, draft)
  return {
    content: createActorContent(actorId, view),
    embeds: [embed],
    components: firstNightRoleInfo ? components : [...components, createSubmitRow(action, draft)]
  }
}

function isFirstNightInfoOnly(action, view, playerLabels = {}) {
  if (action.infoOnly !== true) return false
  return isFirstNightRoleInfoAction(action, view, playerLabels)
}

function createNightResponseComponents(action, page, view, playerLabels, firstNightRoleInfo) {
  const actorId = action.actorId || action.playerId
  if (firstNightRoleInfo) {
    if (action.purpose === 'role_change_info') return []
    if (isFakeActor(actorId, view) && view?.testMode !== true) return []
    return [createRequestStorytellerRow(action.guildId, actorId), createPlayerGrimoireOpenRow(actorId)]
  }

  if (isFirstNightInfoOnly(action, view, playerLabels)) return []
  return createNightResponseRows(action, page, view, playerLabels)
}

function isFirstNightRoleInfoAction(action, view, playerLabels = {}) {
  if (!isFirstNightRoleInfoCandidate(action)) return false
  if (action.targetType !== 'self') return false
  return Boolean(createFirstNightEvilInfoText(action, view, playerLabels) || createFirstNightRoleInfoText(action, view, playerLabels))
}

function isFirstNightRoleInfoCandidate(action) {
  if (action.firstNightRoleInfo === true) return true
  if (action.purpose === 'first_night_info') return true
  if (action.purpose === 'role_change_info') return true
  return false
}

function shouldShowSpyGrimoire(action, view) {
  const actorId = action?.actorId || action?.playerId
  if (!actorId || !view || isFirstNightRoleInfoCandidate(action)) return false
  if ((view.engine?.roles?.[actorId] || action?.roleId) !== 'spy') return false
  if (!(view.users?.alivePlayers || []).includes(actorId)) return false

  const effects = view.engine?.statusEffects?.[actorId] || {}
  return effects.drunk !== true && effects.poisoned !== true
}

function createNightResponseRows(action, page, view, playerLabels) {
  if (page === 'more') return createNightResponseMoreRows(action)
  if (page === 'numbers') return [...createNumberRows(action), createBackRow(action)]
  if (page === 'players') return [...createPlayerRows(action, view, playerLabels), createBackRow(action)]
  if (page === 'characters') return [...createCharacterRows(action, view), createBackRow(action)]
  return createNightResponseMainRows(action)
}

function createWakeEmbed(action, description, view = null, playerLabels = {}, includeFirstNightInfo = false) {
  const wakeText = createWakeDescription(action, description, view, playerLabels, includeFirstNightInfo)
  const embed = new EmbedBuilder()
    .setTitle('The Storyteller has woken you.')
    .setDescription(wakeText.slice(0, 4096))
    .setColor(0x9b59b6)
    .setTimestamp()

  const firstNightFields = createFirstNightInfoFields(action, view, playerLabels)
  if (firstNightFields.length) embed.addFields(firstNightFields)
  return embed
}

function createWakeDescription(action, description, view, playerLabels, includeFirstNightInfo = false) {
  const text = String(description || '')
  if (!includeFirstNightInfo) return text
  const firstNightInfo = createFirstNightEvilInfoText(action, view, playerLabels) ||
    createFirstNightRoleInfoText(action, view, playerLabels)
  if (!firstNightInfo) return text
  if (action.targetType === 'self') return firstNightInfo
  return `${firstNightInfo}\n\n${text}`
}

function createNightResponseMainRows(action) {
  return [
    createResponseOptionRow(action, COMMON_WAKE_OPTIONS),
    new ActionRowBuilder().addComponents(
      pageButton(action, 'numbers', 'Number', ButtonStyle.Secondary, '🔢'),
      pageButton(action, 'players', 'Players', ButtonStyle.Secondary, '👤'),
      pageButton(action, 'characters', 'Characters', ButtonStyle.Secondary, '🎭'),
      pageButton(action, 'more', 'More Info', ButtonStyle.Primary, '➡️')
    )
  ]
}

function createNightResponseMoreRows(action) {
  return [
    ...createButtonRows(SECOND_PAGE_WAKE_OPTIONS.map(option => ({
      label: option.text,
      customId: createNightResponseCustomId(action.id, option.key),
      style: ButtonStyle.Secondary
    }))),
    createBackRow(action)
  ]
}

function createNumberRows(action) {
  return createButtonRows(NUMBER_WAKE_OPTIONS.map(option => ({
    label: option.text,
    customId: createNightResponseCustomId(action.id, option.key),
    style: ButtonStyle.Secondary
  })))
}

function createPlayerRows(action, view, playerLabels = {}) {
  return createButtonRows((view?.users?.players || []).slice(0, 20).map((playerId, index) => ({
    label: truncate(playerLabels[playerId] || `Player ${index + 1}`, 80),
    customId: createNightResponsePlayerCustomId(action.id, playerId),
    style: ButtonStyle.Secondary
  })))
}

function createCharacterRows(action, view) {
  const roles = Object.values(view?.engine?.roleCategories || {}).flatMap(roleIds => roleIds || []).slice(0, 20)
  return createButtonRows(roles.map(roleId => ({
    label: truncate(formatRoleWithEmoji(view, roleId), 80),
    customId: createNightResponseRoleCustomId(action.id, roleId),
    style: ButtonStyle.Secondary
  })))
}

function createResponseOptionRow(action, options) {
  return new ActionRowBuilder().addComponents(options.map(option => createOptionButton(action, option)))
}

function createOptionButton(action, option) {
  const [emoji] = String(option.label || '').split(' ')
  const button = new ButtonBuilder()
    .setCustomId(createNightResponseCustomId(action.id, option.key))
    .setLabel(option.text)
    .setStyle(ButtonStyle.Secondary)
  if (emoji) button.setEmoji(emoji)
  return button
}

function createSpyGrimoireRow(action) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(createNightCopyGrimoireCustomId(action.id))
      .setLabel('Copy Grimoire')
      .setStyle(ButtonStyle.Primary),
    createOptionButton(action, COMMON_WAKE_OPTIONS[0])
  )
}

function createBackRow(action) {
  return new ActionRowBuilder().addComponents(pageButton(action, 'main', 'Back', ButtonStyle.Secondary, '⬅️'))
}

function createPlayerGrimoireOpenRow(actorId) {
  if (!actorId) return null
  return new ActionRowBuilder().addComponents(createPlayerGrimoireOpenButton(actorId))
}

function createSubmitRow(action, draft = []) {
  const hasDraft = draft.length > 0
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(createNightSubmitCustomId(action.id))
      .setLabel('Submit')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!hasDraft),
    new ButtonBuilder()
      .setCustomId(createNightClearCustomId(action.id))
      .setLabel('Clear')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasDraft)
  )
}

function pageButton(action, page, label, style, emoji = null) {
  const button = new ButtonBuilder()
    .setCustomId(createNightResponsePageCustomId(action.id, page))
    .setLabel(label)
    .setStyle(style)
  if (emoji) button.setEmoji(emoji)
  return button
}

function createActorContent(actorId, view) {
  if (!actorId || isFakeActor(actorId, view)) return undefined
  return `<@${actorId}>`
}

function isFakeActor(actorId, view) {
  return (view?.users?.fakePlayers || []).includes(actorId)
}

function getNightResponseText(optionKey) {
  return getWakeOptionText(optionKey)
}

function resolveTargetPlayers(action, actorId, players, view) {
  let resolved = players
  if (action.targetType === 'self') resolved = [actorId].filter(Boolean)
  if (action.targetType === 'living-player') resolved = view?.users?.alivePlayers || players
  if (action.targetType === 'dead-player') resolved = view?.users?.deadPlayers || []
  if (action.allowSelf === false) resolved = resolved.filter(userId => userId !== actorId)
  return resolved
}

function createPlayerTargetOptions(players, playerLabels = {}, actorId = null) {
  const safePlayers = players?.length ? players : [actorId].filter(Boolean)
  return safePlayers.slice(0, 25).map((userId, index) => ({
    label: truncate(playerLabels[userId] || `Player ${index + 1}`, 100),
    value: userId,
    description: userId === actorId ? 'Yourself' : 'Player'
  }))
}
module.exports = { NIGHT_ACTION_ACTIONS, createNightClearCustomId, createNightCopyGrimoireCustomId, createNightInfoAckCustomId, createNightInfoDismissCustomId, createNightResponseMenuPayload, createNightSubmitCustomId, createNightTargetPromptPayload, getNightResponseText, isFirstNightInfoOnly, isFirstNightRoleInfoAction, isNightActionInteraction, parseNightActionCustomId, shouldShowSpyGrimoire }
