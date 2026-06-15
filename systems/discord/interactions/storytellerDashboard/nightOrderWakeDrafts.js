const {
  createNightWakeMenuPayload,
  formatNotInPlayInfo,
  parseNotInPlaySelection,
  parseWakeSendText
} = require('../../embeds')
const {
  addNightActionDraftItem,
  clearNightActionDraft,
  consumeNightActionDraft,
  getNightActionDraft
} = require('../nightActionDrafts')
const {
  recordDemonNotInPlayRoles
} = require('./demonBluffs')
const { formatRoleWithEmoji } = require('../../../../utils/roleFormatting')

async function handleNightOrderWakeDraftAction(input) {
  const { interaction, parsed } = input
  if (parsed.action === 'wake-clear') return clearDraft(input)
  if (parsed.action === 'wake-submit') return submitDraft(input)
  return queueDraft(input)
}

async function queueDraft(input) {
  const { context, entry, interaction, labels, parsed, state, updateNightOrderPayload } = input
  if (parsed.action === 'wake-not-in-play') return queueNotInPlay(input)

  const item = getDraftItem(parsed, entry, context.view, labels)
  if (!item) return null

  const draft = addNightActionDraftItem(interaction.guild.id, entry.action.id, interaction.member.id, item)
  return updateNightOrderPayload(interaction, createNightWakeMenuPayload(context.view, entry, state.index, labels, 'main', [], draft))
}

function queueNotInPlay(input) {
  const { context, entry, interaction, labels, parsed, state, updateNightOrderPayload } = input
  const selected = parseNotInPlaySelection(parsed.value)
  const currentDraft = getDraft(input)
  if (selected.length < 3) {
    return updateNightOrderPayload(
      interaction,
      createNightWakeMenuPayload(context.view, entry, state.index, labels, 'not-in-play', selected, currentDraft)
    )
  }

  const text = formatNotInPlayInfo(context.view, selected)
  const draft = addNightActionDraftItem(interaction.guild.id, entry.action.id, interaction.member.id, {
    kind: 'not-in-play',
    label: text.replace(/\n/g, ' / '),
    roleIds: selected,
    text
  })
  return updateNightOrderPayload(interaction, createNightWakeMenuPayload(context.view, entry, state.index, labels, 'main', [], draft))
}

async function clearDraft(input) {
  const { context, entry, interaction, labels, state, updateNightOrderPayload } = input
  clearNightActionDraft(interaction.guild.id, entry.action.id, interaction.member.id)
  return updateNightOrderPayload(interaction, createNightWakeMenuPayload(context.view, entry, state.index, labels))
}

async function submitDraft(input) {
  const { context, entry, interaction, labels, sendWakeText, state } = input
  const draft = getDraft(input)
  if (!draft.length) return null

  for (const item of draft) {
    if (item.kind === 'not-in-play') {
      recordDemonNotInPlayRoles({ context, entry, gameLifecycle: input.deps.gameLifecycle, roleIds: item.roleIds })
    }
  }

  consumeNightActionDraft(interaction.guild.id, entry.action.id, interaction.member.id)
  const hasOneOffInfo = draft.some(item => item.kind === 'not-in-play')
  return sendWakeText(
    interaction,
    context,
    state,
    entry,
    labels,
    input.deps,
    draft.map(item => item.text).join('\n'),
    hasOneOffInfo ? { action: null, useQuickInfoPayload: true } : {}
  )
}

function getDraft(input) {
  return getNightActionDraft(input.interaction.guild.id, input.entry.action.id, input.interaction.member.id)
}

function getDraftItem(parsed, entry, view, labels) {
  const text = inputText(parsed, entry, view, labels)
  return text ? { kind: 'text', label: text, text } : null
}

function inputText(parsed, entry, view, labels) {
  if (parsed.action === 'wake-player') return labels[parsed.value] || `<@${parsed.value}>`
  if (parsed.action === 'wake-role') return formatRoleWithEmoji(view, parsed.value)
  if (parsed.action === 'wake-send') return parseWakeSendText(parsed.value)
  if (parsed.action === 'wake-prompt') return entry.prompt
  return null
}

module.exports = {
  handleNightOrderWakeDraftAction
}
