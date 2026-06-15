const {
  createNightOrderGuidancePayload,
  createNightResponseMenuPayload,
  createNightTargetPromptPayload,
  createNightWakeEntries,
  createNightWakeMenuPayload,
  parseNightOrderCustomId,
  parseWakeSendText,
  STORYTELLER_DASHBOARD_ACTIONS
} = require('../../embeds')
const { formatRoleWithEmoji } = require('../../../../utils/roleFormatting')
const {
  acknowledgeInteraction,
  editDashboardFailure,
  editDashboardLifecycleFailure,
  updateInteraction
} = require('../feedback')
const {
  deleteNightOrderGuidanceMessage
} = require('./nightOrderGuidanceMessageRefs')
const {
  getNightActionDraft
} = require('../nightActionDrafts')
const {
  sendQuickInfoResponse
} = require('./quickInfo')
const {
  updateControlPayload
} = require('./randomRoleButton')
const {
  clearNightOrderState,
  getNightOrderState
} = require('./nightOrderState')
const {
  isNightOrderOpenButton
} = require('./nightOrderOpenButton')
const {
  updateNightOrderState
} = require('./nightOrderNavigation')
const {
  formatNightOrderMoveMessage,
  runNightOrderMove
} = require('./nightOrderAdvance')
const {
  handleNightOrderWakeDraftAction
} = require('./nightOrderWakeDrafts')
const {
  handleNightOrderRuleButton
} = require('./nightOrderRules')
const {
  findReplacementWakeEntry,
  isPermanentFirstNightInfo,
  isResolvedPermanentFirstNightInfo,
  shouldSendTargetPrompt,
  shouldSkipAlreadySentFirstNightInfo
} = require('./nightOrderWakeGuards')

function createNightOrderButtonHandler(deps) {
  return (interaction, context) => handleNightOrderButton(interaction, context, deps)
}

async function handleNightOrderButton(interaction, context, deps) {
  const parsed = parseNightOrderCustomId(interaction.customId)
  const isOpenButton = isNightOrderOpenButton(interaction)
  if (!parsed && !isOpenButton) return null

  if (context.view.state !== 'in-game' || context.view.phase !== 'night') {
    clearNightOrderState(interaction.guild.id)
    return editDashboardFailure(interaction, {
      title: 'Night only',
      message: 'Night Order Guidance is only available during the night phase.',
      suggestion: 'Advance to night before opening this guide.'
    })
  }

  await acknowledgeInteraction(interaction)
  if (isOpenButton) return openDedicatedNightOrderGuidance(interaction, deps)
  if (parsed?.action === 'stop') return closeNightOrderGuidance(interaction, context, deps)

  const state = updateNightOrderState(interaction.guild.id, context.view, parsed)
  const ruleResult = await handleNightOrderRuleButton(interaction, context, parsed, state, { ...deps, updateNightOrderPayload })
  if (ruleResult) return ruleResult
  if (parsed?.action === 'start' || parsed?.action === 'next') return sendCurrentNightOrderPrompt(interaction, context, state, deps)
  if (parsed?.action === 'back') return updateNightOrderForState(interaction, context, state, deps)
  if (parsed?.action === 'move') {
    const result = await runNightOrderMove({
      interaction,
      context,
      getDashboardPlayerLabels: deps.getDashboardPlayerLabels,
      services: deps.services,
      state
    })
    await interaction.botcUpdateDashboardStatus?.('Done', formatNightOrderMoveMessage(context, result), 0x2ecc71)
    return updateNightOrderForState(interaction, context, state, deps)
  }

  if (isWakeMenuAction(parsed)) return handleNightOrderWakeButton(interaction, context, parsed, state, deps)

  return updateNightOrderForState(interaction, context, state, deps)
}

async function openDedicatedNightOrderGuidance(interaction, deps) {
  await deps.postOrUpdateStorytellerDashboard?.(interaction.client, interaction.guild.id)
  await acknowledgeInteraction(interaction)
  return { opened: true }
}

async function closeNightOrderGuidance(interaction, context, deps = {}) {
  clearNightOrderState(interaction.guild.id)
  await acknowledgeInteraction(interaction)
  await deleteNightOrderGuidanceMessage(interaction, context, deps)
  return { closed: true }
}

function isWakeMenuAction(parsed) {
  return [
    'wake',
    'wake-back',
    'wake-clear',
    'wake-not-in-play',
    'wake-page',
    'wake-player',
    'wake-prompt',
    'wake-role',
    'wake-send',
    'wake-submit'
  ].includes(parsed?.action)
}

async function handleNightOrderWakeButton(interaction, context, parsed, state, deps) {
  const labels = await deps.getDashboardPlayerLabels(interaction.client, interaction.guild.id, context.view)
  const entries = createNightWakeEntries(context.view, labels)
  const entry = entries[state.index]
  if (!entry) return editDashboardFailure(interaction, {
    title: 'No current player',
    message: 'There is no current night-order player to wake.',
    suggestion: 'Use Next Player or reopen Night Order Guidance.'
  })

  if (isWakeDraftAction(parsed)) {
    return handleNightOrderWakeDraftAction({
      context,
      deps,
      entry,
      interaction,
      labels,
      parsed,
      sendWakeText,
      state,
      updateNightOrderPayload
    })
  }
  if (isWakeSendAction(parsed)) return sendWakePrompt(interaction, context, parsed, state, entry, labels, deps)
  if (parsed.action === 'wake-back') return updateNightOrderPayload(interaction, createNightOrderGuidancePayload(context.view, labels, state))

  const page = parsed.action === 'wake-page' ? parsed.value : 'main'
  const draft = getNightActionDraft(interaction.guild.id, entry.action.id, interaction.member.id)
  return updateNightOrderPayload(interaction, createNightWakeMenuPayload(context.view, entry, state.index, labels, page, [], draft))
}

async function updateNightOrderForState(interaction, context, state, deps) {
  const labels = await deps.getDashboardPlayerLabels(interaction.client, interaction.guild.id, context.view)
  return updateNightOrderPayload(interaction, createNightOrderGuidancePayload(context.view, labels, state))
}

async function sendCurrentNightOrderPrompt(interaction, context, state, deps) {
  const labels = await deps.getDashboardPlayerLabels(interaction.client, interaction.guild.id, context.view)
  const entry = createNightWakeEntries(context.view, labels)[state.index]
  if (!entry) return updateNightOrderPayload(interaction, createNightOrderGuidancePayload(context.view, labels, state))
  return sendWakePrompt(interaction, context, { action: 'wake-prompt' }, state, entry, labels, deps)
}

async function sendWakePrompt(interaction, context, parsed, state, entry, labels, deps) {
  if (isResolvedPermanentFirstNightInfo(entry.action)) {
    await interaction.botcUpdateDashboardStatus?.('Done', 'First-night information was already sent.', 0x2ecc71)
    return updateNightOrderPayload(interaction, createNightOrderGuidancePayload(context.view, labels, state))
  }
  if (shouldSkipAlreadySentFirstNightInfo(context.game, entry)) {
    const view = maybeResolveInfoOnly(interaction, context, entry, deps) || context.view
    const replacement = findReplacementWakeEntry(view, labels, state, entry)
    if (replacement) {
      return sendWakePrompt(
        interaction,
        { ...context, view },
        parsed,
        state,
        replacement,
        labels,
        deps
      )
    }
    await interaction.botcUpdateDashboardStatus?.('Done', 'First-night information is already on that player role card.', 0x2ecc71)
    return updateNightOrderPayload(interaction, createNightOrderGuidancePayload(view, labels, state))
  }

  if (parsed.action === 'wake-prompt' && shouldSendTargetPrompt(entry.action)) {
    return sendWakeTargetPrompt(interaction, context, state, entry, labels, deps)
  }

  return sendWakeText(interaction, context, state, entry, labels, deps, getWakeSendText(parsed, entry, context.view, labels))
}

async function sendWakeTargetPrompt(interaction, context, state, entry, labels, deps) {
  const payload = createNightTargetPromptPayload({
    action: entry.action,
    actorId: entry.playerId,
    players: context.view.users.players,
    playerLabels: labels,
    view: context.view
  })
  const { result, message, sent } = await sendQuickInfoResponse({
    interaction,
    context,
    gameLifecycle: deps.gameLifecycle,
    services: deps.services,
    playerId: entry.playerId,
    text: entry.prompt,
    payload,
    action: entry.action,
    recordSecretInfo: false
  })

  if (!result.ok) return editDashboardLifecycleFailure(interaction, result)
  const promptMessage = sent || null
  if (promptMessage) {
    deps.gameLifecycle.setNightActionPrompt?.(
      interaction.guild.id,
      entry.action.id,
      promptMessage.channelId,
      promptMessage.id
    )
  }
  await interaction.botcUpdateDashboardStatus?.('Done', message, 0x2ecc71)
  return updateNightOrderPayload(interaction, createNightOrderGuidancePayload(context.view, labels, state))
}

async function sendWakeText(interaction, context, state, entry, labels, deps, text, options = {}) {
  const action = Object.prototype.hasOwnProperty.call(options, 'action') ? options.action : entry.action
  const payload = options.useQuickInfoPayload
    ? null
    : createNightResponseMenuPayload({ action: entry.action, playerLabels: labels, text, view: context.view })
  const { result, message } = await sendQuickInfoResponse({
    interaction,
    context,
    gameLifecycle: deps.gameLifecycle,
    services: deps.services,
    playerId: entry.playerId,
    text,
    payload,
    action,
    recordSecretInfo: false
  })

  if (!result.ok) return editDashboardLifecycleFailure(interaction, result)
  const view = maybeResolveInfoOnly(interaction, context, entry, deps) || context.view
  if (!isPermanentFirstNightInfo(entry.action)) {
    await interaction.botcUpdateDashboardStatus?.('Done', message, 0x2ecc71)
  }
  return updateNightOrderPayload(interaction, createNightOrderGuidancePayload(view, labels, state))
}

function maybeResolveInfoOnly(interaction, context, entry, deps) {
  if (!entry.action?.infoOnly) return null
  const game = deps.gameLifecycle.get?.(interaction.guild.id)
  const action = game?.nightActions?.find(item => item.id === entry.action.id)
  if (!action) return null
  deps.gameLifecycle.nightActions?.resolveInfoOnly?.(action, interaction.member.id)
  deps.gameLifecycle.save?.()
  return deps.gameLifecycle.getGameView?.(interaction.guild.id) || context.view
}

function isWakeSendAction(parsed) {
  return parsed?.action === 'wake-prompt'
}

function isWakeDraftAction(parsed) {
  return ['wake-clear', 'wake-not-in-play', 'wake-player', 'wake-role', 'wake-send', 'wake-submit'].includes(parsed?.action)
}

function getWakeSendText(parsed, entry, view, labels) {
  if (parsed.action === 'wake-prompt') return entry.prompt
  if (parsed.action === 'wake-player') return labels[parsed.value] || `<@${parsed.value}>`
  if (parsed.action === 'wake-role') return formatRoleWithEmoji(view, parsed.value)
  return parseWakeSendText(parsed.value)
}

function updateNightOrderPayload(interaction, payload) {
  if (typeof interaction.update === 'function' && !interaction.deferred && !interaction.replied) {
    return updateInteraction(interaction, payload)
  }
  return updateControlPayload(interaction, payload)
}

module.exports = { closeNightOrderGuidance, createNightOrderButtonHandler, deleteNightOrderGuidanceMessage, getWakeSendText, handleNightOrderButton, handleNightOrderWakeButton, isNightOrderOpenButton, maybeResolveInfoOnly, openDedicatedNightOrderGuidance, sendCurrentNightOrderPrompt, sendWakePrompt, shouldSendTargetPrompt, shouldSkipAlreadySentFirstNightInfo, updateNightOrderPayload, updateNightOrderState }
