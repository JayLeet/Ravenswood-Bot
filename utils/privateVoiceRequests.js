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
const PRIVATE_VOICE_PUBLIC_PREFIX = 'bpvpub'

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

function createPrivateVoiceTargetRows({ guildId, ownerId, players = [], includePublicButton = false }) {
  const buttons = players.slice(0, 20).map(player =>
    applyButtonEmoji(
      new ButtonBuilder()
        .setCustomId(createPrivateVoicePromptCustomId({
          guildId,
          ownerId,
          targetId: player.id
        }))
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

function parsePrivateVoicePromptCustomId(customId) {
  const value = String(customId || '')
  if (!value.startsWith(`${PRIVATE_VOICE_PROMPT_PREFIX}:`)) return null
  const [guildId, ownerId, targetId] = value.slice(PRIVATE_VOICE_PROMPT_PREFIX.length + 1).split(':')
  if (!guildId || !ownerId || !targetId) return null
  return { guildId, ownerId, targetId }
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

function isPrivateVoiceRequestInteraction(customId) {
  return Boolean(
    parsePrivateVoiceRequestCustomId(customId) ||
    parsePrivateVoicePromptCustomId(customId) ||
    parsePrivateVoicePublicCustomId(customId)
  )
}

module.exports = {
  createPrivateVoiceTargetRows,
  createPrivateVoiceRequestRow,
  isPrivateVoiceRequestInteraction,
  parsePrivateVoicePublicCustomId,
  parsePrivateVoicePromptCustomId,
  parsePrivateVoiceRequestCustomId
}
