const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js')
const {
  applyButtonEmoji
} = require('./buttonEmoji')

const PRIVATE_VOICE_REQUEST_PREFIX = 'bpv'
const PRIVATE_VOICE_PROMPT_PREFIX = 'bpvp'
const PRIVATE_VOICE_INVITE_PROMPT_PREFIX = 'bpvpi'
const PRIVATE_VOICE_PUBLIC_PREFIX = 'bpvpub'
const PRIVATE_VOICE_NOTICE_PREFIX = 'bpvn'
const PRIVATE_VOICE_NOTICE_SIMULATION_ACTOR_PREFIX = 'bpvnsa'
const PRIVATE_VOICE_NOTICE_SIMULATION_TARGET_PREFIX = 'bpvnst'

function createPrivateVoiceRequestRow({ guildId, ownerId, requesterId, targetId }) {
  return new ActionRowBuilder().addComponents(
    applyButtonEmoji(
      new ButtonBuilder()
        .setCustomId(createPrivateVoiceRequestCustomId('accept', {
          guildId,
          ownerId,
          requesterId,
          targetId
        }))
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success),
      'Accept'
    ),
    applyButtonEmoji(
      new ButtonBuilder()
        .setCustomId(createPrivateVoiceRequestCustomId('reject', {
          guildId,
          ownerId,
          requesterId,
          targetId
        }))
        .setLabel('Reject')
        .setStyle(ButtonStyle.Danger),
      'Reject'
    )
  )
}

function createPrivateVoiceTargetRows({ guildId, ownerId, requesterId = null, players = [], includePublicButton = false }) {
  const buttons = players.slice(0, 20).map(player =>
    applyButtonEmoji(
      new ButtonBuilder()
        .setCustomId(createPrivateVoiceTargetCustomId({ guildId, ownerId, requesterId, targetId: player.id }))
        .setLabel(String(player.label || `Player ${String(player.id).slice(-4)}`).slice(0, 80))
        .setStyle(ButtonStyle.Secondary),
      'Player'
    )
  )

  const rows = []
  for (let index = 0; index < buttons.length; index += 5) {
    rows.push(new ActionRowBuilder().addComponents(...buttons.slice(index, index + 5)))
  }
  if (includePublicButton) {
    rows.push(new ActionRowBuilder().addComponents(
      applyButtonEmoji(
        new ButtonBuilder()
          .setCustomId(createPrivateVoicePublicCustomId({ guildId, ownerId }))
          .setLabel('Open to All Players')
          .setStyle(ButtonStyle.Success),
        'Open to All Players'
      )
    ))
  }
  return rows
}

function createPrivateVoiceTargetCustomId({ guildId, ownerId, requesterId = null, targetId }) {
  if (requesterId && String(requesterId) !== String(ownerId)) {
    return createPrivateVoiceInvitePromptCustomId({ guildId, ownerId, requesterId, targetId })
  }
  return createPrivateVoicePromptCustomId({ guildId, ownerId, targetId })
}

function createPrivateVoiceNoticeRow() {
  return new ActionRowBuilder().addComponents(
    applyButtonEmoji(
      new ButtonBuilder()
        .setCustomId(createPrivateVoiceNoticeCustomId('start'))
        .setEmoji('🔒')
        .setLabel('Start Private Voice')
        .setStyle(ButtonStyle.Primary),
      'Voice'
    ),
    applyButtonEmoji(
      new ButtonBuilder()
        .setCustomId(createPrivateVoiceNoticeCustomId('invite'))
        .setEmoji('📨')
        .setLabel('Invite to Room')
        .setStyle(ButtonStyle.Secondary),
      'Invite'
    )
  )
}

function createPrivateVoiceRequestCustomId(action, {
  guildId,
  ownerId,
  requesterId,
  targetId
}) {
  const actionKey = action === 'accept' ? 'a' : 'r'
  return [
    PRIVATE_VOICE_REQUEST_PREFIX,
    actionKey,
    guildId,
    ownerId,
    requesterId,
    targetId
  ].join(':')
}

function parsePrivateVoiceRequestCustomId(customId) {
  const value = String(customId || '')
  if (!value.startsWith(`${PRIVATE_VOICE_REQUEST_PREFIX}:`)) return null

  const [actionKey, guildId, ownerId, requesterId, targetId] =
    value.slice(PRIVATE_VOICE_REQUEST_PREFIX.length + 1).split(':')

  if (!guildId || !ownerId || !requesterId || !targetId) return null

  return {
    action: actionKey === 'a' ? 'accept' : 'reject',
    guildId,
    ownerId,
    requesterId,
    targetId
  }
}

function createPrivateVoicePromptCustomId({ guildId, ownerId, targetId }) {
  return [
    PRIVATE_VOICE_PROMPT_PREFIX,
    guildId,
    ownerId,
    targetId
  ].join(':')
}

function createPrivateVoiceInvitePromptCustomId({ guildId, ownerId, requesterId, targetId }) {
  return [
    PRIVATE_VOICE_INVITE_PROMPT_PREFIX,
    guildId,
    ownerId,
    requesterId,
    targetId
  ].join(':')
}

function parsePrivateVoicePromptCustomId(customId) {
  const value = String(customId || '')
  if (!value.startsWith(`${PRIVATE_VOICE_PROMPT_PREFIX}:`)) return null
  const [guildId, ownerId, targetId] = value.slice(PRIVATE_VOICE_PROMPT_PREFIX.length + 1).split(':')
  if (!guildId || !ownerId || !targetId) return null
  return { guildId, ownerId, targetId }
}

function parsePrivateVoiceInvitePromptCustomId(customId) {
  const value = String(customId || '')
  if (!value.startsWith(`${PRIVATE_VOICE_INVITE_PROMPT_PREFIX}:`)) return null
  const [guildId, ownerId, requesterId, targetId] = value.slice(PRIVATE_VOICE_INVITE_PROMPT_PREFIX.length + 1).split(':')
  if (!guildId || !ownerId || !requesterId || !targetId) return null
  return { guildId, ownerId, requesterId, targetId }
}

function createPrivateVoicePublicCustomId({ guildId, ownerId }) {
  return [
    PRIVATE_VOICE_PUBLIC_PREFIX,
    guildId,
    ownerId
  ].join(':')
}

function parsePrivateVoicePublicCustomId(customId) {
  const value = String(customId || '')
  if (!value.startsWith(`${PRIVATE_VOICE_PUBLIC_PREFIX}:`)) return null
  const [guildId, ownerId] = value.slice(PRIVATE_VOICE_PUBLIC_PREFIX.length + 1).split(':')
  if (!guildId || !ownerId) return null
  return { guildId, ownerId }
}

function createPrivateVoiceNoticeCustomId(action) {
  return [PRIVATE_VOICE_NOTICE_PREFIX, action].join(':')
}

function createPrivateVoiceNoticeSimulationActorCustomId({ guildId, action }) {
  return [PRIVATE_VOICE_NOTICE_SIMULATION_ACTOR_PREFIX, guildId, action].join(':')
}

function createPrivateVoiceNoticeSimulationTargetCustomId({ guildId, action, ownerId }) {
  return [PRIVATE_VOICE_NOTICE_SIMULATION_TARGET_PREFIX, guildId, action, ownerId].join(':')
}

function parsePrivateVoiceNoticeCustomId(customId) {
  const value = String(customId || '')
  if (!value.startsWith(`${PRIVATE_VOICE_NOTICE_PREFIX}:`)) return null
  const action = value.slice(PRIVATE_VOICE_NOTICE_PREFIX.length + 1)
  if (action !== 'start' && action !== 'invite') return null
  return { action }
}

function parsePrivateVoiceNoticeSimulationActorCustomId(customId) {
  const value = String(customId || '')
  if (!value.startsWith(`${PRIVATE_VOICE_NOTICE_SIMULATION_ACTOR_PREFIX}:`)) return null
  const [guildId, action] = value.slice(PRIVATE_VOICE_NOTICE_SIMULATION_ACTOR_PREFIX.length + 1).split(':')
  if (!guildId || !isPrivateVoiceNoticeAction(action)) return null
  return { action, guildId }
}

function parsePrivateVoiceNoticeSimulationTargetCustomId(customId) {
  const value = String(customId || '')
  if (!value.startsWith(`${PRIVATE_VOICE_NOTICE_SIMULATION_TARGET_PREFIX}:`)) return null
  const [guildId, action, ownerId] = value.slice(PRIVATE_VOICE_NOTICE_SIMULATION_TARGET_PREFIX.length + 1).split(':')
  if (!guildId || !ownerId || !isPrivateVoiceNoticeAction(action)) return null
  return { action, guildId, ownerId }
}

function isPrivateVoiceNoticeAction(action) {
  return action === 'start' || action === 'invite'
}

function isPrivateVoiceRequestInteraction(customId) {
  return Boolean(
    parsePrivateVoiceRequestCustomId(customId) ||
    parsePrivateVoicePromptCustomId(customId) ||
    parsePrivateVoiceInvitePromptCustomId(customId) ||
    parsePrivateVoicePublicCustomId(customId) ||
    parsePrivateVoiceNoticeCustomId(customId) ||
    parsePrivateVoiceNoticeSimulationActorCustomId(customId) ||
    parsePrivateVoiceNoticeSimulationTargetCustomId(customId)
  )
}

module.exports = {
  createPrivateVoiceInvitePromptCustomId,
  createPrivateVoiceNoticeRow,
  createPrivateVoiceNoticeSimulationActorCustomId,
  createPrivateVoiceNoticeSimulationTargetCustomId,
  createPrivateVoiceTargetRows,
  createPrivateVoiceRequestRow,
  isPrivateVoiceRequestInteraction,
  parsePrivateVoiceInvitePromptCustomId,
  parsePrivateVoiceNoticeCustomId,
  parsePrivateVoiceNoticeSimulationActorCustomId,
  parsePrivateVoiceNoticeSimulationTargetCustomId,
  parsePrivateVoicePublicCustomId,
  parsePrivateVoicePromptCustomId,
  parsePrivateVoiceRequestCustomId
}
