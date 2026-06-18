const {
  ChannelType
} = require('discord.js')
const {
  isMissingChannelError
} = require('../../../../utils/discord/interactionErrors')
const {
  findCacheValue
} = require('../../../../utils/discord/cacheValues')
const {
  createBotLogger
} = require('../../../../utils/logger')

const fullyFetchedGuildChannels = new WeakSet()
const GUILD_CHANNEL_LIST_UNAVAILABLE = Symbol('guild-channel-list-unavailable')
const VOICE_CHANNEL_LOOKUP_UNAVAILABLE = Symbol('voice-channel-lookup-unavailable')
const log = createBotLogger({ subsystem: 'VoiceChannelLookup' })

async function findManagedVoiceChannel(guild, channelId, name) {
  return findManagedVoiceChannelByNames(guild, channelId, [name])
}

async function findManagedVoiceChannelByNames(guild, channelId, names) {
  let unconfirmedChannelId = false
  if (channelId) {
    const cachedById = findCachedVoiceChannel(guild, channel => channel.id === channelId)
    if (cachedById) return cachedById

    const byId = await fetchManagedVoiceChannelById(guild, channelId)
    if (byId === VOICE_CHANNEL_LOOKUP_UNAVAILABLE) unconfirmedChannelId = true
    if (byId?.type === ChannelType.GuildVoice) return byId
  }

  const lookupNames = Array.isArray(names) ? names.filter(Boolean) : [names].filter(Boolean)
  if (!lookupNames.length) return unconfirmedChannelId ? VOICE_CHANNEL_LOOKUP_UNAVAILABLE : null

  const cachedByName = findCachedVoiceChannel(guild, channel => lookupNames.includes(channel.name))
  if (cachedByName) return cachedByName

  const fetched = await fetchGuildChannelsOnce(guild)
  if (fetched === GUILD_CHANNEL_LIST_UNAVAILABLE) return VOICE_CHANNEL_LOOKUP_UNAVAILABLE

  const byName = findCachedVoiceChannel(guild, channel => lookupNames.includes(channel.name))
  if (byName) return byName
  return unconfirmedChannelId ? VOICE_CHANNEL_LOOKUP_UNAVAILABLE : null
}

async function fetchManagedVoiceChannelById(guild, channelId) {
  if (!guild?.channels?.fetch) {
    log.recoverable('fetch-managed-voice-channel-by-id-unavailable', new Error('Guild channel API unavailable'), {
      channelId,
      guildId: guild?.id
    })
    return VOICE_CHANNEL_LOOKUP_UNAVAILABLE
  }

  return guild.channels.fetch(channelId).catch(err => {
    if (isMissingChannelError(err)) return null
    log.recoverable('fetch-managed-voice-channel-by-id', err, {
      channelId,
      guildId: guild.id
    })
    return VOICE_CHANNEL_LOOKUP_UNAVAILABLE
  })
}

async function fetchGuildChannelsOnce(guild) {
  if (!guild) return false
  if (fullyFetchedGuildChannels.has(guild)) return true
  if (!guild?.channels?.fetch) {
    log.recoverable('fetch-managed-voice-channel-list-unavailable', new Error('Guild channel API unavailable'), {
      guildId: guild?.id
    })
    return GUILD_CHANNEL_LIST_UNAVAILABLE
  }

  const channels = await guild.channels.fetch().catch(err => {
    log.recoverable('fetch-managed-voice-channel-list', err, { guildId: guild.id })
    return GUILD_CHANNEL_LIST_UNAVAILABLE
  })
  if (channels === GUILD_CHANNEL_LIST_UNAVAILABLE) return GUILD_CHANNEL_LIST_UNAVAILABLE
  if (!channels) return false

  fullyFetchedGuildChannels.add(guild)
  return true
}

function findCachedVoiceChannel(guild, predicate) {
  return findCachedChannel(guild, channel =>
    channel?.type === ChannelType.GuildVoice &&
    predicate(channel)
  )
}

function findCachedChannel(guild, predicate) {
  return findCacheValue(guild?.channels?.cache, predicate)
}

function isVoiceChannelLookupUnavailable(value) {
  return value === VOICE_CHANNEL_LOOKUP_UNAVAILABLE
}

function isGuildChannelListUnavailable(value) {
  return value === GUILD_CHANNEL_LIST_UNAVAILABLE
}

module.exports = {
  fetchGuildChannelsOnce,
  findManagedVoiceChannel,
  findManagedVoiceChannelByNames,
  isGuildChannelListUnavailable,
  isVoiceChannelLookupUnavailable
}
