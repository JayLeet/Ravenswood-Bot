const {
  setChannelNameIfChanged
} = require('../../../../utils/discord/channelState')
const {
  setPermissionOverwritesIfChanged
} = require('../../../../utils/discord/permissionOverwriteSignature')
const {
  createBotLogger
} = require('../../../../utils/logger')
const {
  createHiddenNightVoicePermissions
} = require('./visibility')
const {
  createReservedNightVoiceName
} = require('./reservedChannelNames')

const log = createBotLogger({ subsystem: 'ReservedNightAreas' })
const RELEASE_FAILED = Symbol('release-failed')

async function releaseReservedNightArea({ guild, game, playerId, botUserId }) {
  const slot = game?.nightAreaSlots?.[playerId]
  const voiceId = game.nightVoiceChannels?.[playerId]
  const textId = game.nightChannels?.[playerId]
  if (!slot && !voiceId && !textId) return 0

  let touched = 0

  const voice = await releaseReservedNightChannel({ guild, channelId: voiceId, botUserId, playerId })
  if (voice.touched) touched += 1

  if (voice.clearRef) {
    delete game.nightVoiceChannels?.[playerId]
    if (textId) delete game.nightChannels?.[playerId]
    delete game.nightAreaSlots?.[playerId]
  }

  return touched
}

async function releaseReservedNightChannel({ guild, channelId, botUserId, playerId = null }) {
  if (!guild || !channelId) return { clearRef: true, touched: 0 }

  const channel = await fetchReleaseChannel(guild, channelId, 'fetch-reserved-night-channel', { playerId })
  if (channel.stale) return { clearRef: true, touched: 0 }
  if (!channel.value) return { clearRef: false, touched: 0 }

  const context = { channelId, guildId: guild.id, playerId }
  const overwrites = createHiddenNightVoicePermissions(guild, botUserId || getBotUserId(guild))
  const hidden = await setPermissionOverwritesIfChanged(channel.value, overwrites).catch(err => {
    log.recoverable('hide-reserved-night-channel', err, context)
    return RELEASE_FAILED
  })
  const renamed = await setChannelNameIfChanged(channel.value, createReservedNightVoiceName(), 'BOTC release reserved cottage channel').catch(err => {
    log.recoverable('rename-released-reserved-night-channel', err, context)
    return RELEASE_FAILED
  })

  return hidden === RELEASE_FAILED || renamed === RELEASE_FAILED
    ? { clearRef: false, touched: 0 }
    : { clearRef: true, touched: 1 }
}

async function fetchReleaseChannel(guild, channelId, action, context = {}) {
  if (!guild?.channels?.fetch) {
    log.recoverable(`${action}-unavailable`, new Error('Guild channel API unavailable'), {
      channelId,
      guildId: guild?.id,
      ...context
    })
    return { stale: false, value: null }
  }

  return guild.channels.fetch(channelId).then(channel => ({
    stale: !channel,
    value: channel || null
  })).catch(err => {
    if (isMissingChannelError(err)) return { stale: true, value: null }
    log.recoverable(action, err, { channelId, guildId: guild.id, ...context })
    return { stale: false, value: null }
  })
}

function isMissingChannelError(err) {
  const code = err?.code ?? err?.rawError?.code
  const message = String(err?.rawError?.message || err?.message || '').toLowerCase()
  return code === 10003 || message.includes('unknown channel')
}

function getBotUserId(guild) {
  return guild?.client?.user?.id || guild?.members?.me?.id || 'bot'
}

module.exports = {
  isMissingChannelError,
  releaseReservedNightArea
}
