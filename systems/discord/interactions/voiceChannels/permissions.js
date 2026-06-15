const {
  OverwriteType,
  PermissionFlagsBits
} = require('discord.js')
const {
  isFakeMember
} = require('../fakeMembers')

const SHARED_VOICE_ALLOW = Object.freeze([
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.Connect,
  PermissionFlagsBits.Speak,
  PermissionFlagsBits.Stream
])
const VOICE_CHAT_ALLOW = Object.freeze([
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.UseApplicationCommands
])
const STORYTELLER_VOICE_CONTROL_ALLOW = Object.freeze([
  PermissionFlagsBits.MoveMembers,
  PermissionFlagsBits.MuteMembers
])
const SET_VOICE_CHANNEL_STATUS_PERMISSION =
  PermissionFlagsBits.SetVoiceChannelStatus || 0x0001000000000000n
const VIEW_ONLY_VOICE_ALLOW = Object.freeze([
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.ReadMessageHistory
])
const INVITED_PRIVATE_VOICE_ALLOW = Object.freeze([
  ...SHARED_VOICE_ALLOW,
  ...VOICE_CHAT_ALLOW
])
const SPECTATOR_VOICE_DENY = Object.freeze([
  PermissionFlagsBits.Connect,
  PermissionFlagsBits.Speak,
  PermissionFlagsBits.Stream,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.SendMessagesInThreads,
  PermissionFlagsBits.CreatePublicThreads,
  PermissionFlagsBits.CreatePrivateThreads
])
const HIDDEN_VOICE_DENY = Object.freeze([
  PermissionFlagsBits.ViewChannel,
  ...SPECTATOR_VOICE_DENY
])

function createSharedVoiceChannelPermissions(guild, botUserId, roleIds) {
  const overwrites = createBaseVoiceOverwrites(guild, botUserId)

  addVoiceOverwrite(overwrites, roleIds.player, SHARED_VOICE_ALLOW)
  addVoiceOverwrite(overwrites, roleIds.storyteller, [
    ...SHARED_VOICE_ALLOW,
    ...STORYTELLER_VOICE_CONTROL_ALLOW
  ])
  addVoiceOverwrite(overwrites, roleIds.spectator, SHARED_VOICE_ALLOW)
  addVoiceOverwrite(overwrites, roleIds.grimoireSpectator, SHARED_VOICE_ALLOW)

  return overwrites
}

function createPlayerPrivateVoiceChannelPermissions(guild, botUserId, roleIds, options = {}) {
  const overwrites = createBaseVoiceOverwrites(guild, botUserId)
  const invitedPlayerIds = [...new Set(options.invitedPlayerIds || [])].filter(Boolean)

  addVoiceOverwrite(
    overwrites,
    roleIds.player,
    options.publicRoom ? SHARED_VOICE_ALLOW : VIEW_ONLY_VOICE_ALLOW,
    options.publicRoom ? [] : SPECTATOR_VOICE_DENY
  )
  addVoiceOverwrite(overwrites, roleIds.storyteller, [
    ...SHARED_VOICE_ALLOW,
    ...STORYTELLER_VOICE_CONTROL_ALLOW
  ])
  addVoiceOverwrite(overwrites, roleIds.spectator, [], HIDDEN_VOICE_DENY)
  addVoiceOverwrite(overwrites, roleIds.grimoireSpectator, VIEW_ONLY_VOICE_ALLOW, SPECTATOR_VOICE_DENY)

  for (const playerId of invitedPlayerIds) {
    overwrites.push({
      id: playerId,
      allow: [...INVITED_PRIVATE_VOICE_ALLOW],
      type: OverwriteType.Member
    })
  }

  return overwrites
}

function createWhisperDoorVoiceChannelPermissions(guild, botUserId, roleIds) {
  const overwrites = createBaseVoiceOverwrites(guild, botUserId)

  addVoiceOverwrite(overwrites, roleIds.player, SHARED_VOICE_ALLOW)
  addVoiceOverwrite(overwrites, roleIds.storyteller, [
    ...VIEW_ONLY_VOICE_ALLOW,
    ...STORYTELLER_VOICE_CONTROL_ALLOW
  ], [PermissionFlagsBits.Connect])
  addVoiceOverwrite(overwrites, roleIds.spectator, VIEW_ONLY_VOICE_ALLOW, SPECTATOR_VOICE_DENY)
  addVoiceOverwrite(overwrites, roleIds.grimoireSpectator, VIEW_ONLY_VOICE_ALLOW, SPECTATOR_VOICE_DENY)

  return overwrites
}

function addVoiceOverwrite(overwrites, roleId, allow, deny = []) {
  if (!roleId) return
  overwrites.push({ id: roleId, allow: [...allow], deny: [...deny], type: OverwriteType.Role })
}

function createBaseVoiceOverwrites(guild, botUserId) {
  return [
    {
      id: guild.id,
      deny: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect
      ],
      type: OverwriteType.Role
    },
    {
      id: botUserId,
      allow: [
        ...SHARED_VOICE_ALLOW,
        ...VOICE_CHAT_ALLOW,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        SET_VOICE_CHANNEL_STATUS_PERMISSION,
        PermissionFlagsBits.MoveMembers,
        PermissionFlagsBits.MuteMembers
      ],
      type: OverwriteType.Member
    }
  ]
}

function createPrivateNightVoiceChannelPermissions(guild, botUserId, roleIds, playerId, storytellerId = null, member = null) {
  const overwrites = createBaseVoiceOverwrites(guild, botUserId)
  const participantAllow = [...SHARED_VOICE_ALLOW, ...VOICE_CHAT_ALLOW]
  const storytellerAllow = [...participantAllow, ...STORYTELLER_VOICE_CONTROL_ALLOW]

  if (!isFakeMember(member)) {
    overwrites.push({
      id: playerId,
      allow: participantAllow,
      type: OverwriteType.Member
    })
  }

  if (storytellerId && storytellerId !== playerId) {
    overwrites.push({
      id: storytellerId,
      allow: storytellerAllow,
      type: OverwriteType.Member
    })
  } else {
    addVoiceOverwrite(overwrites, roleIds.storyteller, storytellerAllow)
  }

  addVoiceOverwrite(overwrites, roleIds.spectator, VIEW_ONLY_VOICE_ALLOW, SPECTATOR_VOICE_DENY)
  addVoiceOverwrite(overwrites, roleIds.grimoireSpectator, SHARED_VOICE_ALLOW)

  return overwrites
}

module.exports = {
  SPECTATOR_VOICE_DENY,
  HIDDEN_VOICE_DENY,
  SET_VOICE_CHANNEL_STATUS_PERMISSION,
  createPlayerPrivateVoiceChannelPermissions,
  createPrivateNightVoiceChannelPermissions,
  createSharedVoiceChannelPermissions,
  createWhisperDoorVoiceChannelPermissions
}
