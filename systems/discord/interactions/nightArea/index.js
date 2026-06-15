const {
  ChannelType
} = require('discord.js')
const {
  queuedGuildChannelCreate
} = require('../../../../utils/discord/channelActions')
const {
  setChannelNameIfChanged
} = require('../../../../utils/discord/channelState')
const {
  setPermissionOverwritesIfChanged
} = require('../../../../utils/discord/permissionOverwriteActions')
const {
  createBotLogger
} = require('../../../../utils/logger')
const {
  createNightVoiceChannelName
} = require('../voiceChannels/names')
const {
  createPrivateNightVoiceChannelPermissions
} = require('../voiceChannels/permissions')
const {
  findManagedVoiceChannel,
  isVoiceChannelLookupUnavailable
} = require('../voiceChannels/channelLookup')
const {
  acquireReservedNightVoice,
  getOrAssignNightAreaSlot
} = require('./reservedChannels')
const {
  positionNightChannelPairs,
  positionTextBelowVoice
} = require('./positioning')

const log = createBotLogger({ subsystem: 'NightAreaChannels' })

async function ensurePlayerNightArea({
  discordClient,
  guild,
  parent,
  game,
  gameLifecycle,
  member,
  view,
  roleIds = {}
}) {
  const slot = getOrAssignNightAreaSlot(game, member.id)
  const voiceChannel = await ensureCottageVoiceChannel({
    discordClient,
    guild,
    parent,
    game,
    gameLifecycle,
    member,
    view,
    roleIds,
    slot
  })

  if (voiceChannel) {
    gameLifecycle.registerNightChannel(guild.id, member.id, voiceChannel.id)
  }

  return { textChannel: voiceChannel, voiceChannel }
}

async function ensureCottageVoiceChannel(options) {
  const { discordClient, guild, parent, game, gameLifecycle, member, view, roleIds, slot } = options
  const name = createNightVoiceChannelName(member)
  const existing = await findManagedVoiceChannel(guild, game.nightVoiceChannels?.[member.id], name)
  if (isVoiceChannelLookupUnavailable(existing)) return null

  const channel = existing || await acquireReservedNightVoice(guild, parent, slot) ||
    await createCottageVoiceChannel(options, name)
  if (!channel) return null

  const overwrites = createPrivateNightVoiceChannelPermissions(
    guild,
    discordClient.user.id,
    roleIds,
    member.id,
    view.storytellerId,
    member
  )
  await refreshAssignedChannel(channel, name, overwrites, 'BOTC assign reserved cottage channel')
  gameLifecycle.registerNightVoiceChannel(guild.id, member.id, channel.id)
  return channel
}

async function createCottageVoiceChannel(options, name) {
  const { guild, member, parent } = options
  return queuedGuildChannelCreate(guild, {
    name,
    type: ChannelType.GuildVoice,
    parent: parent?.id || null,
    reason: 'BOTC private night cottage channel'
  }).catch(err => {
    log.recoverable('create-night-cottage-voice-channel', err, {
      guildId: guild.id,
      parentId: parent?.id,
      userId: member?.id
    })
    return null
  })
}

async function refreshAssignedChannel(channel, name, overwrites, reason) {
  await setPermissionOverwritesIfChanged(channel, overwrites, reason).catch(err => {
    log.recoverable('refresh-night-cottage-permissions', err, {
      channelId: channel.id,
      guildId: channel.guildId || channel.guild?.id
    })
  })
  await setChannelNameIfChanged(channel, name, reason).catch(err => {
    log.recoverable('refresh-night-cottage-name', err, {
      channelId: channel.id,
      guildId: channel.guildId || channel.guild?.id
    })
  })
}

module.exports = {
  ensurePlayerNightArea,
  positionNightChannelPairs,
  positionTextBelowVoice
}
