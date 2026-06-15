const {
  STORYTELLER_DASHBOARD_ACTIONS
} = require('../../embeds')
const {
  editDashboardFailure,
  editDashboardSuccess
} = require('../feedback')
const {
  cancelGongTimer,
  pauseGongTimerAndUpdate
} = require('../gongTimer')
const {
  setChannelNameIfChanged
} = require('../../../../utils/discord/channelState')
const {
  createBotLogger
} = require('../../../../utils/logger')

const GONG_NAME = 'Return to Townsquare'
const GONG_RESTORE_MS = 30 * 1000
const gongStates = new Map()
const log = createBotLogger({ subsystem: 'StorytellerDashboardGong' })

function createGongButtonHandler({ restoreMs = GONG_RESTORE_MS } = {}) {
  return async function handleGongButton(interaction, context) {
    if (interaction.customId !== STORYTELLER_DASHBOARD_ACTIONS.gong) return null
    if (context.view.phase !== 'day') {
      return editDashboardFailure(interaction, {
        title: 'Day only',
        message: 'Gong is only available during day discussion.',
        suggestion: 'Use it during day discussion before nominations begin.'
      })
    }

    const result = await gongPublicVoiceChannels(interaction.client, interaction.guild.id, context.game, { restoreMs })
    if (!result.ok) return editDashboardFailure(interaction, result)
    return editDashboardSuccess(interaction, createGongSuccessMessage(result))
  }
}

function createGongSuccessMessage(result) {
  if (result.refreshed) return 'Gong timer refreshed. Voice channels stay marked for Townsquare.'
  return `Gong sounded. ${result.changed} voice channel(s) now say "${GONG_NAME}".`
}

async function gongPublicVoiceChannels(client, guildId, game, options = {}) {
  const active = gongStates.get(getGuildKey(guildId))
  if (active) return refreshGongTimer(client, guildId, active, options.restoreMs)

  const channels = await fetchGongChannels(client, game)
  const originals = []

  for (const channel of channels) {
    if (!channel || channel.name === GONG_NAME) continue
    const originalName = channel.name
    const changed = await setGongChannelName(channel, GONG_NAME, 'BOTC Gong', {
      action: 'mark-gong-channel',
      guildId,
      channelId: channel.id
    })
    if (changed) originals.push({ channelId: channel.id, name: originalName })
  }

  if (!originals.length) return { ok: true, changed: 0 }

  const timeout = createGongRestoreTimer(client, guildId, options.restoreMs)
  gongStates.set(getGuildKey(guildId), { client, originals, timeout })
  return { ok: true, changed: originals.length }
}

function refreshGongTimer(client, guildId, state, restoreMs) {
  clearTimeout(state.timeout)
  state.client = client || state.client
  state.timeout = createGongRestoreTimer(state.client, guildId, restoreMs)
  return { ok: true, changed: 0, refreshed: true }
}

function createGongRestoreTimer(client, guildId, restoreMs = GONG_RESTORE_MS) {
  const timeout = setTimeout(() => {
    restoreGongChannels(client, guildId).catch(err => {
      log.recoverable('restore-gong-channels-timer', err, { guildId })
    })
  }, restoreMs ?? GONG_RESTORE_MS)
  if (typeof timeout.unref === 'function') timeout.unref()
  return timeout
}

async function restoreGongChannels(client, guildId) {
  const key = getGuildKey(guildId)
  const state = gongStates.get(key)
  if (!state) return { ok: true, restored: 0 }

  clearTimeout(state.timeout)
  gongStates.delete(key)

  let restored = 0
  for (const item of state.originals) {
    const channel = await fetchChannel(client || state.client, item.channelId, {
      action: 'fetch-gong-restore-channel',
      guildId,
      channelId: item.channelId
    })
    if (!channel) continue
    const changed = await setGongChannelName(channel, item.name, 'BOTC Gong ended', {
      action: 'restore-gong-channel',
      guildId,
      channelId: item.channelId
    })
    if (changed) restored += 1
  }
  return { ok: true, restored }
}

function registerGongPhaseRestore(gameLifecycle, client) {
  gameLifecycle.events.on('PHASE_CHANGED', async ({ game, to }) => {
    if (!game?.guildId || to !== 'nominations') return
    await restoreGongChannels(client, game.guildId).catch(err => {
      log.recoverable('restore-gong-channels-phase-change', err, { guildId: game.guildId })
    })
  })
  gameLifecycle.events.on('NOMINATION_CREATED', async ({ game }) => {
    if (!game?.guildId) return
    await pauseGongTimerAndUpdate(game.guildId).catch(err => {
      log.recoverable('pause-gong-timer-for-nomination', err, { guildId: game.guildId })
    })
  })
  gameLifecycle.events.on('GAME_ENDED', async ({ game }) => {
    if (!game?.guildId) return
    cancelGongTimer(game.guildId)
    await restoreGongChannels(client, game.guildId).catch(err => {
      log.recoverable('restore-gong-channels-game-ended', err, { guildId: game.guildId })
    })
  })
}

async function fetchGongChannels(client, game) {
  const ids = getGongChannelIds(game)
  const channels = []
  for (const channelId of ids) {
    const channel = await fetchChannel(client, channelId, {
      action: 'fetch-gong-channel',
      guildId: game?.guildId,
      channelId
    })
    if (channel?.isVoiceBased?.()) channels.push(channel)
  }
  return channels
}

function getGongChannelIds(game) {
  return [...new Set([
    ...Object.values(game.publicDaySideChannelIds || {}),
    game.privateConversationCreatorChannelId,
    ...Object.values(game.playerMadeVoiceChannels || {})
  ].filter(Boolean))]
}

async function fetchChannel(client, channelId, context = {}) {
  if (!channelId) return null
  if (typeof client?.channels?.fetch !== 'function') return null
  return client.channels.fetch(channelId).catch(err => {
    log.recoverable(context.action || 'fetch-gong-channel', err, {
      channelId,
      guildId: context.guildId
    })
    return null
  })
}

async function setGongChannelName(channel, name, reason, context = {}) {
  return setChannelNameIfChanged(channel, name, reason).catch(err => {
    log.recoverable(context.action || 'set-gong-channel-name', err, {
      channelId: context.channelId || channel?.id,
      guildId: context.guildId || channel?.guildId || channel?.guild?.id
    })
    return false
  })
}

function getGuildKey(guildId) {
  return String(guildId || '')
}

function resetGongState() {
  for (const state of gongStates.values()) clearTimeout(state.timeout)
  gongStates.clear()
}

function getGongButtonRuntimeState() {
  let channelRestores = 0
  for (const state of gongStates.values()) {
    channelRestores += state.originals.length
  }
  return {
    active: gongStates.size,
    channelRestores
  }
}

module.exports = {
  GONG_NAME,
  GONG_RESTORE_MS,
  createGongButtonHandler,
  fetchGongChannels,
  getGongButtonRuntimeState,
  getGongChannelIds,
  gongPublicVoiceChannels,
  registerGongPhaseRestore,
  resetGongState,
  restoreGongChannels
}
