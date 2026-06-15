const {
  setChannelParentIfChanged,
  setChannelPositionIfChanged,
  setGuildChannelPositionsIfChanged
} = require('../../../../utils/discord/channelState')
const {
  createBotLogger
} = require('../../../../utils/logger')

const log = createBotLogger({ subsystem: 'NightAreaPositioning' })

async function positionTextBelowVoice(textChannel, voiceChannel) {
  if (!textChannel || !voiceChannel) return false

  const movedParent = await alignParent(textChannel, voiceChannel)
  const movedPosition = await alignPosition(textChannel, voiceChannel)

  return movedParent || movedPosition
}

async function positionNightChannelPairs(guild, game, playerIds = []) {
  const pairs = await getNightChannelPairs(guild, game, playerIds)
  if (!pairs.length) return 0

  const parentId = getCommonParentId(pairs)
  const start = getFirstPairPosition(pairs)
  const desired = createDesiredPositions(pairs, start)

  const bulkMoved = parentId ? await bulkSetPositions(guild, parentId, desired) : false
  if (!bulkMoved) await applyIndividualPositions(desired)

  return pairs.length
}

async function getNightChannelPairs(guild, game, playerIds = []) {
  const pairs = []

  for (const playerId of playerIds) {
    const voiceId = game.nightVoiceChannels?.[playerId]
    const textId = game.nightChannels?.[playerId]
    if (!voiceId || !textId) continue

    const [voiceChannel, textChannel] = await Promise.all([
      fetchNightPairChannel(guild, voiceId, playerId, 'voice'),
      fetchNightPairChannel(guild, textId, playerId, 'text')
    ])

    if (!voiceChannel || !textChannel?.isTextBased?.()) continue
    pairs.push({ playerId, textChannel, voiceChannel })
  }

  return pairs
}

function fetchNightPairChannel(guild, channelId, playerId, type) {
  if (!guild?.channels?.fetch) {
    log.recoverable('fetch-night-channel-pair-unavailable', new Error('Guild channel API unavailable'), {
      channelId,
      guildId: guild?.id,
      playerId,
      type
    })
    return null
  }

  return guild.channels.fetch(channelId).catch(err => {
    log.recoverable('fetch-night-channel-pair', err, {
      channelId,
      guildId: guild.id,
      playerId,
      type
    })
    return null
  })
}

function createDesiredPositions(pairs, start) {
  return pairs.flatMap((pair, index) => {
    const voicePosition = start + index * 2
    return [
      { channel: pair.voiceChannel, pair, position: voicePosition, type: 'voice' },
      { channel: pair.textChannel, pair, position: voicePosition + 1, type: 'text' }
    ]
  })
}

async function bulkSetPositions(guild, parentId, desired) {
  if (typeof guild.channels.setPositions !== 'function') return false

  const positions = desired.map(item => ({ channel: item.channel.id, position: item.position }))
  return setGuildChannelPositionsIfChanged(guild, positions, {
    reason: 'BOTC order private night voice/text channel pairs'
  }).catch(err => {
    const reason = getDiscordErrorReason(err)
    log.warn('bulk-position-private-night-channels', createBulkPositionWarning(parentId, reason), { parentId })
    return false
  })
}

async function applyIndividualPositions(desired) {
  for (let index = desired.length - 1; index >= 0; index -= 1) {
    const item = desired[index]
    if (item.type === 'voice') await alignVoicePosition(item.channel, item.position)
    else await positionTextBelowVoice(item.channel, createPositionedVoice(item.pair.voiceChannel, item.position - 1))
  }
}

function getCommonParentId(pairs) {
  const parentIds = new Set(
    pairs.flatMap(pair => [pair.voiceChannel.parentId, pair.textChannel.parentId]).filter(Boolean)
  )
  return parentIds.size === 1 ? [...parentIds][0] : null
}

function getFirstPairPosition(pairs) {
  const positions = pairs
    .flatMap(pair => [pair.voiceChannel.rawPosition, pair.textChannel.rawPosition, pair.voiceChannel.position, pair.textChannel.position])
    .map(Number)
    .filter(Number.isFinite)

  return positions.length ? Math.max(0, Math.min(...positions)) : 0
}

function createPositionedVoice(voiceChannel, position) {
  return {
    parentId: voiceChannel.parentId,
    name: voiceChannel.name,
    position
  }
}

async function alignVoicePosition(voiceChannel, position) {
  return setChannelPositionIfChanged(voiceChannel, position, {
    reason: 'BOTC order private night voice/text channel pairs'
  }).catch(err => {
    const reason = getDiscordErrorReason(err)
    log.warn('position-private-night-voice-channel', createVoicePositionWarning(voiceChannel, reason), {
      channelId: voiceChannel.id
    })
    return false
  })
}

async function alignParent(textChannel, voiceChannel) {
  if (!voiceChannel.parentId || textChannel.parentId === voiceChannel.parentId) return false

  return setChannelParentIfChanged(textChannel, voiceChannel.parentId, {
    lockPermissions: false,
    reason: 'BOTC pair private night text chat with cottage'
  }).catch(err => {
    const reason = getDiscordErrorReason(err)
    log.warn('move-private-night-text-parent', createParentWarning(textChannel, reason), {
      channelId: textChannel.id,
      parentId: voiceChannel.parentId
    })
    return false
  })
}

async function alignPosition(textChannel, voiceChannel) {
  const nextPosition = Number(voiceChannel.rawPosition ?? voiceChannel.position ?? 0) + 1
  return setChannelPositionIfChanged(textChannel, nextPosition, {
    reason: 'BOTC position private night text chat below cottage'
  }).catch(err => {
    const reason = getDiscordErrorReason(err)
    log.warn('position-private-night-text-channel', createPositionWarning(textChannel, voiceChannel, reason), {
      channelId: textChannel.id,
      voiceChannelId: voiceChannel.id
    })
    return false
  })
}

function createBulkPositionWarning(parentId, reason) {
  return [
    `[BOTC] Could not bulk-order private night channels in ${parentId}: ${reason}`,
    `Likely fix: ${createChannelPlacementHint(reason)}`,
    'Falling back to individual channel moves.'
  ].join(' ')
}

function createParentWarning(textChannel, reason) {
  return [
    `[BOTC] Could not move ${textChannel.name} to cottage category: ${reason}`,
    `Likely fix: ${createChannelPlacementHint(reason)}`,
    'The game will continue; this only affects channel organization.'
  ].join(' ')
}

function createPositionWarning(textChannel, voiceChannel, reason) {
  return [
    `[BOTC] Could not position ${textChannel.name} below ${voiceChannel.name}: ${reason}`,
    `Likely fix: ${createChannelPlacementHint(reason)}`,
    'The game will continue; this only affects channel ordering.'
  ].join(' ')
}

function createVoicePositionWarning(voiceChannel, reason) {
  return [
    `[BOTC] Could not position ${voiceChannel.name}: ${reason}`,
    `Likely fix: ${createChannelPlacementHint(reason)}`,
    'The game will continue; this only affects channel ordering.'
  ].join(' ')
}

function createChannelPlacementHint(reason = '') {
  const normalized = String(reason).toLowerCase()

  if (normalized.includes('missing permissions') || normalized.includes('blocked')) {
    return [
      'give the bot Manage Channels in the night category and both private channels;',
      'make sure the bot role is high enough to manage channels in that category;',
      'check category permission overwrites are not denying the bot.'
    ].join(' ')
  }

  if (normalized.includes('unknown channel')) {
    return 'one of the channels may have been deleted before it could be moved.'
  }

  return 'check Manage Channels permission and category overwrites for the bot.'
}

function getDiscordErrorReason(err) {
  return err?.message || err?.rawError?.message || String(err || 'unknown error')
}

module.exports = {
  applyIndividualPositions,
  createChannelPlacementHint,
  createParentWarning,
  createPositionWarning,
  createVoicePositionWarning,
  getDiscordErrorReason,
  positionNightChannelPairs,
  positionTextBelowVoice
}
