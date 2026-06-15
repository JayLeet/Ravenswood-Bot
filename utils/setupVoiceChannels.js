const {
  ChannelType,
  OverwriteType,
  PermissionFlagsBits
} = require('discord.js')
const {
  STORYTELLER_DEN_LOOKUP_NAMES,
  STORYTELLER_DEN_VOICE_CHANNEL_NAME
} = require('../systems/discord/interactions/voiceChannels/dayPublicChannels')
const {
  createPrivateConversationCreatorChannelName,
  getPrivateConversationCreatorChannelLookupNames,
  createTownsquareVoiceChannelName,
  getPublicDaySideRoomNames,
  getTownsquareVoiceChannelLookupNames
} = require('../systems/discord/interactions/voiceChannels/names')
const {
  queuedGuildChannelCreate
} = require('./discord/channelActions')
const {
  setChannelNameIfChanged,
  setChannelParentIfChanged
} = require('./discord/channelState')
const {
  setPermissionOverwritesIfChanged
} = require('./discord/permissionOverwriteSignature')
const {
  createBotLogger
} = require('./logger')
const {
  createSharedVoiceChannelPermissions,
  createWhisperDoorVoiceChannelPermissions
} = require('../systems/discord/interactions/voiceChannels/permissions')
const {
  validateSetupPermissionOverwriteTargets
} = require('./setupPermissionOverwritePreflight')

const WAITING_ROOM_VOICE_CHANNEL_NAME = '🕰️ Waiting Room'
const log = createBotLogger({ subsystem: 'SetupVoiceChannels' })
const WAITING_ROOM_HIDDEN_ROLE_DENIES = Object.freeze([
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.Connect
])
const SETUP_SHARED_VOICE_CHANNELS = Object.freeze([
  {
    key: 'waitingRoomVoiceChannel',
    name: WAITING_ROOM_VOICE_CHANNEL_NAME,
    lookupNames: [WAITING_ROOM_VOICE_CHANNEL_NAME, 'Waiting Room'],
    reason: 'BOTC setup public waiting room voice channel',
    publicWaitingRoom: true
  },
  {
    key: 'storytellerDenVoiceChannel',
    name: STORYTELLER_DEN_VOICE_CHANNEL_NAME,
    lookupNames: STORYTELLER_DEN_LOOKUP_NAMES,
    reason: 'BOTC setup Storyteller Den voice channel'
  },
  {
    key: 'townsquareVoiceChannel',
    name: createTownsquareVoiceChannelName(),
    lookupNames: getTownsquareVoiceChannelLookupNames(),
    reason: 'BOTC setup Townsquare voice channel'
  },
  ...getPublicDaySideRoomNames().map(name => ({
    key: name,
    name,
    lookupNames: [name],
    reason: 'BOTC setup public side voice channel'
  })),
  {
    key: 'privateConversationCreatorVoiceChannel',
    name: createPrivateConversationCreatorChannelName(),
    lookupNames: getPrivateConversationCreatorChannelLookupNames(),
    reason: 'BOTC setup private voice creator channel',
    playerOnlyCreator: true
  }
])

async function ensureSetupSharedVoiceChannels(guild, category, gameRoles, options = {}) {
  const channels = {}
  const roleIds = createSetupVoiceRoleIds(gameRoles)
  const overwriteValidation = validateSetupPermissionOverwriteTargets(
    guild,
    createSetupVoiceChannelPermissionOverwrites(guild, gameRoles)
  )
  if (!overwriteValidation.ok) return overwriteValidation

  for (const config of SETUP_SHARED_VOICE_CHANNELS) {
    const overwrites = createSetupVoiceChannelPermissions(guild, roleIds, config)
    const channel = await findOrCreateSetupVoiceChannel(guild, category, config, overwrites, options)
    if (!channel) return { ok: false, message: `I could not create ${config.name}.` }
    channels[config.key] = channel
  }

  return { ok: true, channels }
}

function createSetupVoiceChannelPermissionOverwrites(guild, gameRoles) {
  const roleIds = createSetupVoiceRoleIds(gameRoles)
  return SETUP_SHARED_VOICE_CHANNELS.flatMap(config =>
    createSetupVoiceChannelPermissions(guild, roleIds, config)
  )
}

function createSetupVoiceRoleIds(gameRoles = {}) {
  return {
    player: gameRoles.player?.id || null,
    spectator: gameRoles.spectator?.id || null,
    grimoireSpectator: gameRoles.grimoireSpectator?.id || null,
    storyteller: gameRoles.storyteller?.id || null
  }
}

function createSetupVoiceChannelPermissions(guild, roleIds, config) {
  const botUserId = guild.client?.user?.id || guild.members?.me?.id

  if (config.publicWaitingRoom) {
    return createWaitingRoomVoiceChannelPermissions(guild, botUserId, roleIds)
  }

  if (config.playerOnlyCreator) {
    return createWhisperDoorVoiceChannelPermissions(guild, botUserId, roleIds)
  }

  return createSharedVoiceChannelPermissions(guild, botUserId, roleIds)
}

function createWaitingRoomVoiceChannelPermissions(guild, botUserId, roleIds = {}) {
  return [
    {
      id: guild.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
        PermissionFlagsBits.Stream
      ],
      type: OverwriteType.Role
    },
    ...createWaitingRoomHiddenRoleOverwrites(roleIds),
    {
      id: botUserId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
        PermissionFlagsBits.Stream,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.MoveMembers,
        PermissionFlagsBits.MuteMembers
      ],
      type: OverwriteType.Member
    }
  ].filter(overwrite => overwrite?.id)
}

function createWaitingRoomHiddenRoleOverwrites(roleIds = {}) {
  return [...new Set([
    roleIds.spectator,
    roleIds.grimoireSpectator,
    roleIds.storyteller
  ].filter(Boolean))].map(id => ({
    id,
    deny: [...WAITING_ROOM_HIDDEN_ROLE_DENIES],
    type: OverwriteType.Role
  }))
}

async function findOrCreateSetupVoiceChannel(guild, category, config, overwrites, options = {}) {
  const existing = findSetupVoiceChannel(guild, config.lookupNames)

  if (existing) {
    await refreshSetupVoiceChannel(existing, category, config.name, overwrites)
    return existing
  }

  return queuedGuildChannelCreate(guild, {
    name: config.name,
    type: ChannelType.GuildVoice,
    parent: category?.id || null,
    reason: config.reason,
    permissionOverwrites: overwrites
  }).then(channel => {
    if (options.managedChannels && config.key) options.managedChannels[config.key] = channel
    return channel
  }).catch(err => {
    log.recoverable('create-setup-shared-voice-channel', err, { guildId: guild.id, name: config.name, parentId: category?.id })
    return null
  })
}

function findSetupVoiceChannel(guild, names) {
  const lookupNames = new Set(names)

  return getCachedChannels(guild).find(channel =>
    channel.type === ChannelType.GuildVoice &&
    lookupNames.has(channel.name)
  ) || null
}

function getCachedChannels(guild) {
  if (typeof guild.channels.cache.values === 'function') return [...guild.channels.cache.values()]
  return [...guild.channels.cache]
}

async function refreshSetupVoiceChannel(channel, category, name, overwrites) {
  await setPermissionOverwritesIfChanged(
    channel,
    overwrites,
    'BOTC setup shared voice channel refresh'
  ).catch(err => log.recoverable('refresh-setup-shared-voice-permissions', err, createSetupVoiceContext(channel, category)))
  await setChannelNameIfChanged(channel, name, 'BOTC setup shared voice channel name update')
    .catch(err => log.recoverable('refresh-setup-shared-voice-name', err, createSetupVoiceContext(channel, category)))
  await setChannelParentIfChanged(channel, category?.id || null, { lockPermissions: false })
    .catch(err => log.recoverable('refresh-setup-shared-voice-parent', err, createSetupVoiceContext(channel, category)))
}

function createSetupVoiceContext(channel, category) {
  return {
    categoryId: category?.id,
    channelId: channel?.id,
    guildId: channel?.guildId || channel?.guild?.id
  }
}

module.exports = {
  SETUP_SHARED_VOICE_CHANNELS,
  WAITING_ROOM_VOICE_CHANNEL_NAME,
  createSetupVoiceChannelPermissionOverwrites,
  ensureSetupSharedVoiceChannels,
  refreshSetupVoiceChannel
}
