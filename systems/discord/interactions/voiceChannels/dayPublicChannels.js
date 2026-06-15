const {
  ChannelType
} = require('discord.js')
const {
  queuedGuildChannelCreate
} = require('../../../../utils/discord/channelActions')
const {
  setChannelNameIfChanged,
  setChannelParentIfChanged,
  setVoiceChannelStatusIfChanged
} = require('../../../../utils/discord/channelState')
const {
  setPermissionOverwritesIfChanged
} = require('../../../../utils/discord/permissionOverwriteActions')
const {
  createBotLogger
} = require('../../../../utils/logger')
const {
  findManagedVoiceChannelByNames,
  isVoiceChannelLookupUnavailable
} = require('./channelLookup')
const {
  createTownsquareVoiceChannelName,
  createTownsquareVoiceChannelStatus,
  getPublicDaySideRoomNames,
  getTownsquareVoiceChannelLookupNames
} = require('./names')
const {
  createSharedVoiceChannelPermissions
} = require('./permissions')

const STORYTELLER_DEN_VOICE_CHANNEL_NAME = "📖 The Storyteller's Den"
const STORYTELLER_DEN_LOOKUP_NAMES = Object.freeze([
  STORYTELLER_DEN_VOICE_CHANNEL_NAME,
  "The Storyteller's Den"
])
const log = createBotLogger({ subsystem: 'DayPublicVoiceChannels' })

async function ensureStorytellerDenVoiceChannel({ guild, parent, gameLifecycle, roleIds }) {
  const game = gameLifecycle.get(guild.id)
  if (!game) return null

  const existing = await findManagedVoiceChannelByNames(
    guild,
    game.storytellerDenChannelId,
    STORYTELLER_DEN_LOOKUP_NAMES
  )
  if (isVoiceChannelLookupUnavailable(existing)) return null

  const overwrites = createSharedVoiceChannelPermissions(guild, guild.client.user.id, roleIds)

  if (existing) {
    await refreshSharedDayVoiceChannel(existing, STORYTELLER_DEN_VOICE_CHANNEL_NAME, parent, overwrites, 'BOTC storyteller den voice channel update')
    gameLifecycle.registerStorytellerDen(guild.id, existing.id)
    return existing
  }

  const channel = await queuedGuildChannelCreate(guild, {
    name: STORYTELLER_DEN_VOICE_CHANNEL_NAME,
    type: ChannelType.GuildVoice,
    parent: parent?.id || null,
    reason: 'BOTC storyteller den voice channel',
    permissionOverwrites: overwrites
  }).catch(err => {
    log.recoverable('create-storyteller-den-voice-channel', err, {
      guildId: guild.id,
      parentId: parent?.id
    })
    return null
  })

  if (channel) gameLifecycle.registerStorytellerDen(guild.id, channel.id)
  return channel
}

async function ensureTownsquareVoiceChannel({ guild, parent, gameLifecycle, roleIds }) {
  const game = gameLifecycle.get(guild.id)
  if (!game) return null

  const view = gameLifecycle.getGameView?.(guild.id) || null
  const name = createTownsquareVoiceChannelName()
  const status = createTownsquareVoiceChannelStatus(view)
  const channel = await ensureSharedDayVoiceChannel({
    guild,
    parent,
    roleIds,
    channelId: game.townsquareChannelId,
    name,
    lookupNames: getTownsquareVoiceChannelLookupNames(),
    reason: 'BOTC public day discussion voice channel',
    status
  })

  if (channel) gameLifecycle.registerTownsquare(guild.id, channel.id)
  return channel
}

async function ensurePublicDaySideVoiceChannels({ guild, parent, gameLifecycle, roleIds }) {
  const game = gameLifecycle.get(guild.id)
  if (!game) return []

  const channels = []

  for (const name of getPublicDaySideRoomNames()) {
    const channel = await ensureSharedDayVoiceChannel({
      guild,
      parent,
      roleIds,
      channelId: game.publicDaySideChannelIds?.[name],
      name,
      lookupNames: [name],
      reason: 'BOTC public side discussion voice channel'
    })

    if (channel) {
      gameLifecycle.registerPublicDaySideChannel(guild.id, name, channel.id)
      channels.push(channel)
    }
  }

  return channels
}

async function ensureSharedDayVoiceChannel({ guild, parent, roleIds, channelId, name, lookupNames, reason, status = undefined }) {
  const existing = await findManagedVoiceChannelByNames(guild, channelId, lookupNames)
  if (isVoiceChannelLookupUnavailable(existing)) return null

  const overwrites = createSharedVoiceChannelPermissions(guild, guild.client.user.id, roleIds)

  if (existing) {
    await refreshSharedDayVoiceChannel(existing, name, parent, overwrites, 'BOTC public day voice channel update', status)
    return existing
  }

  const channel = await queuedGuildChannelCreate(guild, {
    name,
    type: ChannelType.GuildVoice,
    parent: parent?.id || null,
    reason,
    permissionOverwrites: overwrites
  }).catch(err => {
    log.recoverable('create-shared-day-voice-channel', err, {
      guildId: guild.id,
      name,
      parentId: parent?.id
    })
    return null
  })
  if (channel && status !== undefined) {
    await setVoiceChannelStatusIfChanged(channel, status, 'BOTC public day voice channel status update').catch(err => {
      log.recoverable('refresh-shared-day-voice-status', err, createSharedVoiceContext(channel, parent))
    })
  }
  return channel
}

async function refreshSharedDayVoiceChannel(channel, name, parent, overwrites, reason, status = undefined) {
  await setPermissionOverwritesIfChanged(channel, overwrites, reason).catch(err => {
    log.recoverable('refresh-shared-day-voice-permissions', err, createSharedVoiceContext(channel, parent))
  })
  await setChannelNameIfChanged(channel, name, reason).catch(err => {
    log.recoverable('refresh-shared-day-voice-name', err, createSharedVoiceContext(channel, parent))
  })
  if (status !== undefined) {
    await setVoiceChannelStatusIfChanged(channel, status, reason).catch(err => {
      log.recoverable('refresh-shared-day-voice-status', err, createSharedVoiceContext(channel, parent))
    })
  }
  await setChannelParentIfChanged(channel, parent?.id || null, { lockPermissions: false }).catch(err => {
    log.recoverable('refresh-shared-day-voice-parent', err, createSharedVoiceContext(channel, parent))
  })
}

function createSharedVoiceContext(channel, parent) {
  return {
    channelId: channel.id,
    guildId: channel.guildId || channel.guild?.id,
    parentId: parent?.id
  }
}

module.exports = {
  STORYTELLER_DEN_LOOKUP_NAMES,
  STORYTELLER_DEN_VOICE_CHANNEL_NAME,
  ensurePublicDaySideVoiceChannels,
  ensureStorytellerDenVoiceChannel,
  ensureTownsquareVoiceChannel
}
