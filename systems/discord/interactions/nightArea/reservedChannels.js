const {
  ChannelType
} = require('discord.js')
const {
  queuedGuildChannelCreate
} = require('../../../../utils/discord/channelActions')
const {
  setChannelNameIfChanged,
  setChannelParentIfChanged,
  setChannelPositionIfChanged,
  setGuildChannelPositionsIfChanged
} = require('../../../../utils/discord/channelState')
const {
  setPermissionOverwritesIfChanged
} = require('../../../../utils/discord/permissionOverwriteSignature')
const {
  fetchGuildChannelsOnce,
  isGuildChannelListUnavailable
} = require('../voiceChannels/channelLookup')
const {
  createHiddenNightVoicePermissions
} = require('./visibility')
const {
  createBotLogger
} = require('../../../../utils/logger')
const {
  getChannelCacheValues,
  getChannelPosition,
  getFirstChannelPosition
} = require('./reservedChannelCache')
const {
  RESERVED_NIGHT_VOICE_NAME,
  createReservedNightVoiceName
} = require('./reservedChannelNames')
const {
  releaseReservedNightArea
} = require('./reservedChannelRelease')

const RESERVED_NIGHT_AREA_CATEGORY_NAME = 'Ravenswood Bluff Cottages'
const RESERVED_NIGHT_AREA_COUNT = 15
const log = createBotLogger({ subsystem: 'ReservedNightAreas' })


async function ensureReservedNightAreaPool(guild) {
  const category = await findOrCreateReservedNightCategory(guild)
  if (!category) return { ok: false, message: 'I could not create the cottage category.' }

  const fetched = await fetchGuildChannelsOnce(guild)
  if (isGuildChannelListUnavailable(fetched)) {
    return { ok: false, message: 'I could not confirm the existing reserved cottage channels.' }
  }

  const voices = []

  for (let slot = 1; slot <= RESERVED_NIGHT_AREA_COUNT; slot += 1) {
    const voice = await ensureReservedVoiceChannel(guild, category, slot)

    if (!voice) {
      return {
        ok: false,
        message: `I could not create reserved cottage voice channel ${slot}.`
      }
    }

    voices.push(voice)
  }

  await orderReservedNightAreaPool(guild, voices)
  return { ok: true, category }
}

async function findOrCreateReservedNightCategory(guild) {
  const fetched = await fetchGuildChannelsOnce(guild)
  if (isGuildChannelListUnavailable(fetched)) return null

  const existing = findReservedNightCategory(guild)
  if (existing) return existing

  return queuedGuildChannelCreate(guild, {
    name: RESERVED_NIGHT_AREA_CATEGORY_NAME,
    type: ChannelType.GuildCategory,
    reason: 'BOTC reserved cottage category'
  }).catch(err => {
    log.recoverable('create-reserved-night-category', err, { guildId: guild.id })
    return null
  })
}

function findReservedNightCategory(guild) {
  return getChannelCacheValues(guild).find(channel =>
    channel.type === ChannelType.GuildCategory &&
    channel.name === RESERVED_NIGHT_AREA_CATEGORY_NAME
  ) || null
}

function getOrAssignNightAreaSlot(game, playerId) {
  game.nightAreaSlots ??= {}
  if (game.nightAreaSlots[playerId]) return game.nightAreaSlots[playerId]

  const used = new Set(Object.values(game.nightAreaSlots || {}).map(Number))
  for (let slot = 1; slot <= RESERVED_NIGHT_AREA_COUNT; slot += 1) {
    if (used.has(slot)) continue
    game.nightAreaSlots[playerId] = slot
    return slot
  }

  return null
}

async function acquireReservedNightVoice(guild, parent, slot) {
  return acquireReservedChannel(guild, parent, slot)
}

async function acquireReservedChannel(guild, parent, slot) {
  if (!guild || !slot) return null

  const fetched = await fetchGuildChannelsOnce(guild)
  if (isGuildChannelListUnavailable(fetched)) return null

  const channel = getReservedVoiceChannelForSlot(guild, parent, slot)
  if (!channel) return null

  await setChannelParentIfChanged(channel, parent?.id || null, { lockPermissions: false }).catch(err => {
    log.recoverable('set-reserved-night-channel-parent', err, {
      channelId: channel.id,
      guildId: guild.id,
      parentId: parent?.id
    })
  })

  return channel
}

async function ensureReservedVoiceChannel(guild, category, slot) {
  const existing = getReservedVoiceChannelForSlot(guild, category, slot)
  const overwrites = createHiddenNightVoicePermissions(guild, getBotUserId(guild))
  if (existing) return refreshReservedChannel(existing, category, overwrites)

  return queuedGuildChannelCreate(guild, {
    name: createReservedNightVoiceName(),
    type: ChannelType.GuildVoice,
    parent: category.id,
    reason: 'BOTC reserved cottage voice channel',
    permissionOverwrites: overwrites
  }).catch(err => {
    log.recoverable('create-reserved-night-voice', err, {
      guildId: guild.id,
      slot
    })
    return null
  })
}

async function refreshReservedChannel(channel, category, overwrites) {
  await setChannelParentIfChanged(channel, category?.id || null, { lockPermissions: false }).catch(err => {
    log.recoverable('refresh-reserved-channel-parent', err, { channelId: channel.id })
  })
  await setPermissionOverwritesIfChanged(channel, overwrites).catch(err => {
    log.recoverable('refresh-reserved-channel-permissions', err, { channelId: channel.id })
  })
  await setChannelNameIfChanged(channel, createReservedNightVoiceName(), 'BOTC refresh reserved cottage channel').catch(err => {
    log.recoverable('refresh-reserved-channel-name', err, { channelId: channel.id })
  })
  return channel
}

async function orderReservedNightAreaPool(guild, voices) {
  const start = getFirstChannelPosition(voices)
  const positions = voices.map((channel, index) => ({ channel: channel.id, position: start + index }))

  const bulkMoved = await setGuildChannelPositionsIfChanged(guild, positions, {
    reason: 'BOTC order reserved cottage voice channels'
  }).catch(err => {
    log.recoverable('bulk-order-reserved-night-area-pool', err, { guildId: guild.id })
    return false
  })

  if (!bulkMoved) {
    for (let index = voices.length - 1; index >= 0; index -= 1) {
      await setChannelPositionIfChanged(voices[index], start + index, {
        reason: 'BOTC order reserved cottage voice channels'
      }).catch(err => {
        log.recoverable('order-reserved-night-area-channel', err, {
          channelId: voices[index].id,
          guildId: guild.id
        })
      })
    }
  }

  return true
}

function getReservedVoiceChannelForSlot(guild, category, slot) {
  return getReservedVoiceChannels(guild, category)[Number(slot) - 1] || null
}

function getReservedVoiceChannels(guild, category) {
  const categoryId = category?.id
  return getChannelCacheValues(guild)
    .filter(channel => channel.type === ChannelType.GuildVoice)
    .filter(channel => !categoryId || channel.parentId === categoryId)
    .sort((left, right) => getChannelPosition(left) - getChannelPosition(right))
}

function getBotUserId(guild) {
  return guild?.client?.user?.id || guild?.members?.me?.id || 'bot'
}

module.exports = {
  RESERVED_NIGHT_AREA_CATEGORY_NAME,
  RESERVED_NIGHT_AREA_COUNT,
  RESERVED_NIGHT_VOICE_NAME,
  acquireReservedNightVoice,
  createReservedNightVoiceName,
  ensureReservedNightAreaPool,
  findOrCreateReservedNightCategory,
  findReservedNightCategory,
  getOrAssignNightAreaSlot,
  orderReservedNightAreaPool,
  releaseReservedNightArea
}
