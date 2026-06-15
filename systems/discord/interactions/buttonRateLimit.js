const {
  MessageFlags
} = require('discord.js')
const {
  isStorytellerDashboardAction,
  isVotingInteraction
} = require('../embeds')
const {
  isFirstJoinSetupNoticeInteraction
} = require('../firstJoinSetupNotice')
const {
  isSetupChannelsInteraction
} = require('../../../utils/setupChannelPicker')
const {
  replyPrivateSystem
} = require('./feedback')

const BASE_COOLDOWN_MS = 5000
const LOCK_MS = 5 * 60 * 1000
const STRIKE_LIMIT = 5
const STATE_TTL_MS = 30 * 60 * 1000

function createButtonRateLimiter({ gameLifecycle }) {
  const stateByUser = new Map()

  async function guard(interaction) {
    if (interaction.isChatInputCommand?.()) return guardCommandLock(interaction)
    if (!interaction.isButton?.()) return null
    if (isExemptInteraction(interaction, gameLifecycle)) return null

    const now = Date.now()
    prune(now)
    const state = getState(interaction)
    state.lastSeenAt = now

    if (state.lockedUntil > now) {
      return replyPrivateSystem(
        interaction,
        'Slow down',
        `You are locked out from bot buttons for ${formatSeconds(state.lockedUntil - now)}.`,
        'Wait for the lockout to expire before pressing another button.'
      )
    }

    if (state.nextAllowedAt > now) {
      state.strikes += 1
      state.cooldownMs = Math.min(state.cooldownMs + BASE_COOLDOWN_MS, 30000)
      state.nextAllowedAt = now + state.cooldownMs

      if (state.strikes >= STRIKE_LIMIT) {
        state.lockedUntil = now + LOCK_MS
        state.strikes = 0
        return replyPrivateSystem(
          interaction,
          'Button lockout',
          'You pressed too many buttons too quickly. Bot buttons are locked for 5 minutes.',
          'Wait for the lockout to expire. The Storyteller dashboard and private night prompts are not affected.'
        )
      }

      return replyPrivateSystem(
        interaction,
        'Slow down',
        `Please wait ${formatSeconds(state.nextAllowedAt - now)} before pressing another bot button.`,
        'Repeated rapid clicks will temporarily lock your buttons for 5 minutes.'
      )
    }

    state.cooldownMs = BASE_COOLDOWN_MS
    state.nextAllowedAt = now + BASE_COOLDOWN_MS
    state.strikes = Math.max(0, state.strikes - 1)
    return null
  }

  function guardCommandLock(interaction) {
    const state = getExistingState(interaction)
    const now = Date.now()
    prune(now)
    if (!state || state.lockedUntil <= now) return null

    return replyPrivateSystem(
      interaction,
      'Slow down',
      `You are locked out from bot controls and commands for ${formatSeconds(state.lockedUntil - now)}.`,
      'Wait for the lockout to expire before using another bot command.'
    )
  }

  function getExistingState(interaction) {
    return stateByUser.get(getStateKey(interaction)) || null
  }

  function getState(interaction) {
    const key = getStateKey(interaction)
    const state = stateByUser.get(key) || {
      cooldownMs: BASE_COOLDOWN_MS,
      lastSeenAt: 0,
      lockedUntil: 0,
      nextAllowedAt: 0,
      strikes: 0
    }
    stateByUser.set(key, state)
    return state
  }

  function prune(now = Date.now()) {
    let removed = 0
    for (const [key, state] of stateByUser.entries()) {
      if (!isExpiredState(state, now)) continue
      stateByUser.delete(key)
      removed += 1
    }
    return removed
  }

  function size() {
    return stateByUser.size
  }

  return { guard, prune, size }
}

function isExemptInteraction(interaction, gameLifecycle) {
  if (isPrivateReplyInteraction(interaction)) return true
  if (isFirstJoinSetupNoticeInteraction(interaction.customId)) return true
  if (isSetupChannelsInteraction(interaction.customId)) return true
  if (isVotingInteraction(interaction.customId)) return true
  if (isStorytellerDashboardAction(interaction.customId)) return true

  const game = gameLifecycle.get?.(interaction.guild?.id)
  if (!game) return false
  if (gameLifecycle.isStoryteller?.(game, interaction.member?.id)) return true

  return Object.values(game.nightVoiceChannels || {}).includes(interaction.channelId)
}

function isPrivateReplyInteraction(interaction) {
  const flags = interaction.message?.flags
  if (!flags) return false
  if (typeof flags.has === 'function') return flags.has(MessageFlags.Ephemeral)
  const bitfield = Number(flags.bitfield ?? flags)
  return Number.isFinite(bitfield) && (bitfield & MessageFlags.Ephemeral) !== 0
}

function getStateKey(interaction) {
  return `${interaction.guild?.id || 'dm'}:${interaction.user?.id || interaction.member?.id}`
}

function formatSeconds(ms) {
  return `${Math.max(1, Math.ceil(ms / 1000))}s`
}

function isExpiredState(state, now) {
  const lastSeenAt = Number(state?.lastSeenAt) || 0
  if (!lastSeenAt || now - lastSeenAt < STATE_TTL_MS) return false
  return (state.lockedUntil || 0) <= now && (state.nextAllowedAt || 0) <= now
}

module.exports = {
  createButtonRateLimiter
}
