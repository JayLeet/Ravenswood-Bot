const {
  createNightResponseMenuPayload,
  createNightTargetPromptPayload,
  getNightResponseText,
  shouldShowSpyGrimoire
} = require('../embeds')
const {
  queuedMessageDelete,
  queuedMessageEdit
} = require('../../../utils/discord/messageActions')
const {
  isProtectedRoleInfoAction
} = require('./nightPromptMessages')
const {
  copySpyGrimoireToPrivateNotes
} = require('./nightActionPrompts/spyGrimoireCopy')
const {
  respondPrivateSystem
} = require('./feedback')
const {
  addNightActionDraftItem,
  clearNightActionDraft,
  consumeNightActionDraft,
  formatNightActionDraft,
  getNightActionDraft
} = require('./nightActionDrafts')
const {
  createNightActionResponseNotice
} = require('./nightActionResponseNotice')
const {
  createBotLogger
} = require('../../../utils/logger')
const {
  resolveTestPlayerInteractionMember
} = require('./testPlayerSimulation')

const PLAYER_ONLY_NIGHT_BUTTON_MESSAGE = 'Only players can use this button.'
const log = createBotLogger({ subsystem: 'NightActionPromptSubmissions' })

async function handleNightActionSubmission(interaction, parsed, deps) {
  if (parsed.type === 'clear') return clearDraft(interaction, parsed, deps)
  if (parsed.type === 'copy-grimoire') return copySpyGrimoire(interaction, parsed, deps)
  if (parsed.type === 'submit') return submitDraft(interaction, parsed, deps)
  return queueDraftItem(interaction, parsed, deps)
}

async function copySpyGrimoire(interaction, parsed, deps) {
  const context = await getContext(interaction, parsed, deps)
  const validation = validateNightActionContext(context, deps.gameLifecycle)
  if (!validation.ok) return deps.sendFailure(interaction, context.userId, validation.message)
  if (!shouldShowSpyGrimoire(context.action, context.view)) {
    return deps.sendFailure(interaction, context.userId, 'The Spy grimoire is not available from this prompt.')
  }

  const copiedCount = copySpyGrimoireToPrivateNotes(context.game, context.view, context.userId)
  deps.gameLifecycle.save?.()
  return respondPrivateSystem(
    interaction,
    '\u{1F4CB} Grimoire copied',
    `Copied ${copiedCount} player seat${copiedCount === 1 ? '' : 's'} into your private grimoire.`,
    'Open Your Grimoire to review the copied roles, reminder tokens, and Demon bluff notes.'
  )
}

async function queueDraftItem(interaction, parsed, deps) {
  const context = await getContext(interaction, parsed, deps)
  const validation = validateNightActionContext(context, deps.gameLifecycle)
  if (!validation.ok) return deps.sendFailure(interaction, context.userId, validation.message)
  if (isSpyGotIt(interaction, parsed, context)) return submitSpyGotIt(interaction, parsed, context, deps)

  const item = await createDraftItem(interaction, parsed, context, deps)
  if (!item) return deps.sendFailure(interaction, context.userId, 'That response option is not valid.')

  const draft = addNightActionDraftItem(interaction.guild.id, parsed.actionId, context.userId, item)
  await editPromptWithDraft(interaction, context, draft)
  return null
}

async function clearDraft(interaction, parsed, deps) {
  const context = await getContext(interaction, parsed, deps)
  const validation = validateNightActionContext(context, deps.gameLifecycle)
  if (!validation.ok) return deps.sendFailure(interaction, context.userId, validation.message)

  clearNightActionDraft(interaction.guild.id, parsed.actionId, context.userId)
  await editPromptWithDraft(interaction, context, [])
  return null
}

async function submitDraft(interaction, parsed, deps) {
  const context = await getContext(interaction, parsed, deps)
  const validation = validateNightActionContext(context, deps.gameLifecycle)
  if (!validation.ok) return deps.sendFailure(interaction, context.userId, validation.message)

  const draft = getNightActionDraft(interaction.guild.id, parsed.actionId, context.userId)
  if (!draft.length) return deps.sendFailure(interaction, context.userId, 'Queue at least one response before submitting.')

  const result = await submitDraftToLifecycle(interaction, parsed, context, draft, deps)
  return finishSubmittedNightAction(interaction, result, deps, context)
}

async function submitSpyGotIt(interaction, parsed, context, deps) {
  const result = await deps.gameLifecycle.submitNightActionText(
    interaction.guild.id,
    context.member,
    parsed.actionId,
    'Got it'
  )
  return finishSubmittedNightAction(interaction, result, deps, context)
}

async function finishSubmittedNightAction(interaction, result, deps, context) {
  const userId = context?.userId || interaction.member.id
  if (!result.ok) return deps.sendFailure(interaction, userId, result.error?.message || 'Unknown error')

  consumeNightActionDraft(interaction.guild.id, result.action.id, userId)
  if (interaction.message) {
    const cleared = await clearSubmittedPromptMessage(interaction, result.action, context)
    if (cleared) clearSubmittedPromptRefs(interaction, result.action, deps)
  }
  await deps.postOrUpdateStorytellerDashboard(interaction.client, interaction.guild.id).catch(err => {
    log.recoverable('refresh-dashboard-after-night-action-submission', err, createSubmissionLogContext(interaction, result.action))
    return null
  })
  const notice = await createNightActionResponseNotice({
    action: result.action,
    getPlayerLabel: deps.getPlayerLabel,
    getRoleLabel: deps.getRoleLabel,
    interaction
  })
  await deps.sendStorytellerNotice(interaction.client, interaction.guild.id, notice, result.action).catch(err => {
    log.recoverable('send-storyteller-night-action-response-notice', err, createSubmissionLogContext(interaction, result.action))
    return null
  })
  return deps.sendStatus(interaction, result.action?.actorId || result.action?.playerId || interaction.member.id, 'Done', 'Response submitted. The Storyteller can resolve it now.', 0x2ecc71)
}

async function clearSubmittedPromptMessage(interaction, action, context) {
  if (shouldShowSpyGrimoire(action, context?.view)) {
    const deleted = await queuedMessageDelete(interaction.message, 'BOTC Spy grimoire acknowledged').catch(err => {
      log.recoverable('delete-submitted-spy-grimoire-prompt', err, createSubmissionLogContext(interaction, action))
      return null
    })
    if (deleted) return deleted
  }

  return queuedMessageEdit(interaction.message, { components: [] }).catch(err => {
    log.recoverable('clear-submitted-night-action-components', err, createSubmissionLogContext(interaction, action))
    return null
  })
}

function clearSubmittedPromptRefs(interaction, action, deps) {
  if (!action?.promptChannelId || !action?.promptMessageId) return
  if (isProtectedRoleInfoAction(action)) return

  const ref = { channelId: action.promptChannelId, messageId: action.promptMessageId }
  delete action.promptChannelId
  delete action.promptMessageId

  const game = deps.gameLifecycle?.get?.(interaction.guild.id)
  const playerId = action.actorId || action.playerId
  const storedRef = game?.nightPromptMessages?.[playerId]
  if (storedRef?.channelId === ref.channelId && storedRef?.messageId === ref.messageId) {
    delete game.nightPromptMessages[playerId]
  }

  deps.gameLifecycle?.save?.()
}

async function submitDraftToLifecycle(interaction, parsed, context, draft, deps) {
  const targetItem = [...draft].reverse().find(item => item.kind === 'target')
  if (targetItem && !['self', 'text'].includes(context.action.targetType)) {
    return deps.gameLifecycle.submitNightActionTarget(interaction.guild.id, context.member, parsed.actionId, targetItem.targetIds)
  }

  return deps.gameLifecycle.submitNightActionText(
    interaction.guild.id,
    context.member,
    parsed.actionId,
    formatNightActionDraft(draft)
  )
}

async function createDraftItem(interaction, parsed, context, deps) {
  if (parsed.type === 'respond') {
    const text = getNightResponseText(parsed.value)
    return text ? { kind: 'text', label: text, text } : null
  }

  if (parsed.type === 'player') {
    const label = await deps.getPlayerLabel(interaction, parsed.value)
    return { kind: 'text', label: `Player: ${label}`, text: label }
  }

  if (parsed.type === 'role') {
    const label = await deps.getRoleLabel(interaction, parsed.value)
    return { kind: 'text', label: `Character: ${label}`, text: label }
  }

  if (parsed.type === 'target') return createTargetDraftItem(interaction, context, deps)
  return null
}

async function createTargetDraftItem(interaction, context, deps) {
  const ids = Array.isArray(interaction.values) ? interaction.values.filter(Boolean) : []
  const result = deps.gameLifecycle.nightActions?.validateTarget?.(deps.gameLifecycle, context.game, context.action, ids)
  if (result && !result.ok) return null
  const labels = await Promise.all(ids.map(id => deps.getPlayerLabel(interaction, id)))
  return {
    kind: 'target',
    label: `Target: ${labels.join(', ')}`,
    targetIds: ids,
    text: labels.join(', ')
  }
}

async function editPromptWithDraft(interaction, context, draft) {
  if (!interaction.message) return null
  const payload = ['self', 'text'].includes(context.action.targetType)
    ? createNightResponseMenuPayload({ action: context.action, draft, playerLabels: context.playerLabels, text: context.action.prompt, view: context.view })
    : createNightTargetPromptPayload({ action: context.action, actorId: context.actorId, draft, players: context.view.users.players, playerLabels: context.playerLabels, view: context.view })
  return queuedMessageEdit(interaction.message, payload).catch(err => {
    log.recoverable('update-night-action-draft-prompt', err, {
      actionId: context.action?.id,
      guildId: interaction.guild?.id,
      messageId: interaction.message?.id,
      userId: interaction.member?.id
    })
    return null
  })
}

function createSubmissionLogContext(interaction, action) {
  return {
    actionId: action?.id,
    actorId: action?.actorId || action?.playerId,
    guildId: interaction.guild?.id,
    messageId: interaction.message?.id,
    userId: interaction.member?.id
  }
}

async function getContext(interaction, parsed, deps) {
  const game = deps.gameLifecycle.get(interaction.guild.id)
  const view = deps.gameLifecycle.getGameView(interaction.guild.id)
  const action = game?.nightActions?.find(item => item.id === parsed.actionId) || null
  const actorId = action?.actorId || action?.playerId || interaction.member.id
  const member = resolveTestPlayerInteractionMember({
    game,
    gameLifecycle: deps.gameLifecycle,
    interaction,
    playerId: actorId,
    view
  })
  const playerLabels = view ? await deps.getPlayerLabels(interaction.client, interaction.guild.id, view) : {}
  return { action, actorId, game, member, playerLabels, userId: member?.id || interaction.member.id, view }
}

function isSpyGotIt(interaction, parsed, context) {
  return parsed.type === 'respond' && parsed.value === 'got_it' && shouldShowSpyGrimoire(context.action, context.view)
}

function validateNightActionContext(context, gameLifecycle) {
  if (!context.action) return { ok: false, message: 'Night action not found.' }
  if (gameLifecycle?.getRole?.(context.game, context.userId) !== 'player') {
    return { ok: false, message: PLAYER_ONLY_NIGHT_BUTTON_MESSAGE }
  }
  if (context.action.status !== 'awaiting_target') return { ok: false, message: 'That night action is no longer waiting for a response.' }
  if (context.action.actorId !== context.userId && context.action.playerId !== context.userId) return { ok: false, message: 'Only the woken player can use this prompt.' }
  if (context.game?.state !== 'in-game' || context.action.day !== context.game.day || context.action.phase !== context.game.phase) {
    return { ok: false, message: 'That night action is no longer active.' }
  }
  return { ok: true }
}

module.exports = {
  PLAYER_ONLY_NIGHT_BUTTON_MESSAGE,
  handleNightActionSubmission,
  validateNightActionContext
}
