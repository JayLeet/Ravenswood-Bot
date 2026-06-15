const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js')
const {
  queuedChannelSend,
  queuedMessageEdit
} = require('../../../utils/discord/messageActions')
const {
  createBotLogger
} = require('../../../utils/logger')

const MAX_GONG_TIMER_MS = 10 * 60 * 1000
const TIMER_UPDATE_MS = 5 * 1000
const TIMER_BUTTON_PREFIX = 'botc:storyteller:timer-control:'
const activeTimers = new Map()
const log = createBotLogger({ subsystem: 'GongTimer' })

async function startGongTimer(options) {
  const config = normalizeOptions(options)
  cancelGongTimer(config.guildId)

  const startedAt = config.now()
  const message = await config.sendMessage(
    config.liveChannel,
    createGongTimerPayload(config.durationMs, config)
  )
  if (!message) return { ok: false, error: { message: 'Could not post the timer.' } }

  await config.trackMessage?.(message)

  const state = {
    ...config,
    message,
    paused: false,
    pausedRemainingMs: null,
    startedAt,
    timeout: null
  }
  activeTimers.set(config.guildId, state)
  scheduleTimerUpdate(state)

  return { ok: true, message }
}

function cancelGongTimer(guildId) {
  const key = createTimerKey(guildId)
  const state = activeTimers.get(key)
  if (!state) return false
  if (state.timeout) state.clearTimeoutFn(state.timeout)
  activeTimers.delete(key)
  return true
}

function pauseGongTimer(guildId) {
  const state = activeTimers.get(createTimerKey(guildId))
  if (!state) return { ok: false, error: { message: 'That timer is no longer active.' } }
  if (!state.paused) {
    state.pausedRemainingMs = getRemainingMs(state)
    state.paused = true
    if (state.timeout) state.clearTimeoutFn(state.timeout)
    state.timeout = null
  }
  return { ok: true, payload: createGongTimerPayload(getRemainingMs(state), state) }
}

async function pauseGongTimerAndUpdate(guildId) {
  const result = pauseGongTimer(guildId)
  if (!result.ok) return result
  const state = activeTimers.get(createTimerKey(guildId))
  await editTimerMessage(state, result.payload, 'pause-timer-message')
  return result
}

function resumeGongTimer(guildId) {
  const state = activeTimers.get(createTimerKey(guildId))
  if (!state) return { ok: false, error: { message: 'That timer is no longer active.' } }
  if (state.paused) {
    const remainingMs = getRemainingMs(state)
    state.startedAt = state.now() - (state.durationMs - remainingMs)
    state.paused = false
    state.pausedRemainingMs = null
    scheduleTimerUpdate(state)
  }
  return { ok: true, payload: createGongTimerPayload(getRemainingMs(state), state) }
}

function scheduleTimerUpdate(state) {
  const remainingMs = getRemainingMs(state)
  const delay = Math.min(TIMER_UPDATE_MS, Math.max(1, remainingMs))
  state.timeout = state.setTimeoutFn(() => runTimerUpdate(state), delay)
  if (typeof state.timeout?.unref === 'function') state.timeout.unref()
}

async function runTimerUpdate(state) {
  const key = createTimerKey(state.guildId)
  if (activeTimers.get(key) !== state || state.paused) return

  const remainingMs = getRemainingMs(state)
  if (remainingMs > 0) {
    await editTimerMessage(state, createGongTimerPayload(remainingMs, state), 'update-timer-message')
    scheduleTimerUpdate(state)
    return
  }

  activeTimers.delete(key)
  await editTimerMessage(state, createGongTimerPayload(0, { ...state, done: true }), 'complete-timer-message')
  const game = state.getGame()
  if (game) {
    await state.completeFn(state, game).catch(err => {
      log.recoverable('complete-timer-action', err, { guildId: state.guildId })
    })
  }
}

function createGongTimerPayload(remainingMs, options = {}) {
  const done = options.done === true
  const paused = options.paused === true
  const title = done
    ? options.completeTitle || 'Gong Timer Complete'
    : options.timerTitle || 'Gong Timer'
  const description = done
    ? options.completeDescription || 'Time is up. The Gong is being sounded now.'
    : createTimerDescription(remainingMs, paused)
  return {
    embeds: [
      new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(done ? 0xe67e22 : 0x3498db)
        .setTimestamp()
    ],
    components: done ? [] : [createTimerButtonRow(paused)]
  }
}

function createTimerDescription(remainingMs, paused) {
  const remaining = formatTimerRemaining(remainingMs)
  return paused ? `Paused at: **${remaining}**` : `Time remaining: **${remaining}**`
}

function createTimerButtonRow(paused) {
  const action = paused ? 'resume' : 'pause'
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(createTimerButtonCustomId(action))
      .setLabel(paused ? 'Resume' : 'Pause')
      .setStyle(paused ? ButtonStyle.Success : ButtonStyle.Secondary)
  )
}

function createTimerButtonCustomId(action) {
  return `${TIMER_BUTTON_PREFIX}${action}`
}

function isTimerButton(customId) {
  return String(customId || '').startsWith(TIMER_BUTTON_PREFIX)
}

function parseTimerButton(customId) {
  if (!isTimerButton(customId)) return null
  return { action: String(customId).slice(TIMER_BUTTON_PREFIX.length) }
}

function formatTimerRemaining(remainingMs) {
  const totalSeconds = Math.max(0, Math.ceil(Number(remainingMs || 0) / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function getRemainingMs(state) {
  if (state.paused) return Math.max(0, state.pausedRemainingMs || 0)
  return Math.max(0, state.durationMs - (state.now() - state.startedAt))
}

async function editTimerMessage(state, payload, action) {
  if (!state?.editMessage || !state?.message) return null
  return state.editMessage(state.message, payload).catch(err => {
    log.recoverable(action, err, {
      channelId: state.message?.channelId || state.liveChannel?.id,
      guildId: state.guildId,
      messageId: state.message?.id
    })
    return null
  })
}

function normalizeOptions(options = {}) {
  const durationMs = clampDuration(options.durationMs)
  const gongFn = options.gongFn || getDefaultGongFn()
  return {
    clearTimeoutFn: options.clearTimeoutFn || clearTimeout,
    client: options.client,
    completeDescription: options.completeDescription,
    completeFn: options.completeFn || ((state, game) => gongFn(state.client, state.guildId, game)),
    completeTitle: options.completeTitle,
    durationMs,
    editMessage: options.editMessage || queuedMessageEdit,
    getGame: options.getGame || (() => null),
    gongFn,
    guildId: createTimerKey(options.guildId),
    liveChannel: options.liveChannel,
    now: options.now || Date.now,
    sendMessage: options.sendMessage || queuedChannelSend,
    setTimeoutFn: options.setTimeoutFn || setTimeout,
    timerTitle: options.timerTitle,
    trackMessage: options.trackMessage
  }
}

function getDefaultGongFn() {
  return require('./storytellerDashboard/gongButton').gongPublicVoiceChannels
}

function clampDuration(durationMs) {
  const value = Number(durationMs)
  if (!Number.isFinite(value) || value <= 0) return TIMER_UPDATE_MS
  return Math.min(value, MAX_GONG_TIMER_MS)
}

function createTimerKey(guildId) {
  return String(guildId || '')
}

function resetGongTimers() {
  for (const state of activeTimers.values()) {
    if (state.timeout) state.clearTimeoutFn(state.timeout)
  }
  activeTimers.clear()
}

function getGongTimerRuntimeState({ now = Date.now() } = {}) {
  const snapshotNow = typeof now === 'function' ? now() : now
  let paused = 0
  let running = 0
  let overdue = 0

  for (const state of activeTimers.values()) {
    if (state.paused) {
      paused++
      continue
    }

    running++
    if (getRemainingMs({ ...state, now: () => snapshotNow }) <= 0) overdue++
  }

  return {
    active: activeTimers.size,
    overdue,
    paused,
    running
  }
}

module.exports = {
  MAX_GONG_TIMER_MS,
  cancelGongTimer,
  createTimerButtonCustomId,
  formatTimerRemaining,
  getGongTimerRuntimeState,
  isTimerButton,
  parseTimerButton,
  pauseGongTimer,
  pauseGongTimerAndUpdate,
  resetGongTimers,
  resumeGongTimer,
  startGongTimer
}
