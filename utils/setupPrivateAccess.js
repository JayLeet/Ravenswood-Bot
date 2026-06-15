const {
  OverwriteType,
  PermissionFlagsBits
} = require('discord.js')
const {
  ensureBotcAccessRole
} = require('./botcAccessRole')
const {
  setPermissionOverwritesIfChanged
} = require('./discord/permissionOverwriteSignature')
const {
  applyBotChannelAccess
} = require('./botChannelAccess')
const {
  createBotLogger
} = require('./logger')

const PRIVATE_CATEGORY_OVERWRITES = Object.freeze([
  PermissionFlagsBits.ViewChannel
])
const log = createBotLogger({ subsystem: 'SetupPrivateAccess' })
const PUBLIC_TEXT_ALLOW = Object.freeze([
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.UseApplicationCommands
])
const PUBLIC_TEXT_DENY = Object.freeze([
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.SendMessagesInThreads,
  PermissionFlagsBits.CreatePublicThreads,
  PermissionFlagsBits.CreatePrivateThreads
])
const GAME_LOG_ACCESS_ALLOW = Object.freeze([
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.UseApplicationCommands
])
const GAME_LOG_ACCESS_DENY = Object.freeze([
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.SendMessagesInThreads,
  PermissionFlagsBits.CreatePublicThreads,
  PermissionFlagsBits.CreatePrivateThreads,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.AddReactions,
  PermissionFlagsBits.SendVoiceMessages,
  PermissionFlagsBits.UseExternalEmojis,
  PermissionFlagsBits.UseExternalStickers,
  PermissionFlagsBits.UseExternalApps
])
const PUBLIC_VOICE_ALLOW = Object.freeze([
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.Connect,
  PermissionFlagsBits.Speak,
  PermissionFlagsBits.Stream
])

async function applyPrivateSetupAccess(guild, setupResult) {
  if (!setupResult.privateAccess) return { ok: true }

  const accessRole = await ensureBotcAccessRole(guild)
  if (!accessRole) return { ok: false, message: 'I could not create or find the 🩸 Blood on the Clocktower role.' }
  setupResult.botcAccessRole = accessRole

  await applyPrivateCategory(setupResult.category, guild)
  await applyPrivateCategory(setupResult.cottageCategory, guild)
  await applyPrivateBotChannelAccess(setupResult.channels?.botUpdateChannel, guild, accessRole)
  await applyPublicTextAccess(setupResult.channels?.gameChannel, guild, accessRole, { lockedPanel: true })
  await applyPublicTextAccess(setupResult.channels?.postGameChannel, guild, accessRole)
  await applyPrivateGameLogAccess(setupResult.channels?.gameLogChannel, guild, accessRole)
  await applyPublicVoiceAccess(setupResult.sharedVoiceChannels?.waitingRoomVoiceChannel, guild, accessRole)

  return { ok: true, accessRole }
}

async function applyPrivateCategory(category, guild) {
  if (!category) return null
  return setPermissionOverwritesIfChanged(category, [
    { id: guild.id, deny: [...PRIVATE_CATEGORY_OVERWRITES], type: OverwriteType.Role },
    createBotOverwrite(guild)
  ].filter(Boolean), 'BOTC private setup category permissions').catch(err => {
    log.recoverable('apply-private-setup-category-permissions', err, createSetupAccessContext(guild, category))
    return null
  })
}

async function applyPublicTextAccess(channel, guild, accessRole, options = {}) {
  if (!channel || !accessRole) return null
  return setPermissionOverwritesIfChanged(channel, [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel], type: OverwriteType.Role },
    createBotOverwrite(guild),
    {
      id: accessRole.id,
      allow: [...PUBLIC_TEXT_ALLOW],
      deny: options.lockedPanel ? [
        ...PUBLIC_TEXT_DENY,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.AddReactions
      ] : [...PUBLIC_TEXT_DENY],
      type: OverwriteType.Role
    }
  ].filter(Boolean), 'BOTC private public text channel permissions').catch(err => {
    log.recoverable('apply-private-setup-public-text-permissions', err, createSetupAccessContext(guild, channel, accessRole))
    return null
  })
}

async function applyPrivateGameLogAccess(channel, guild, accessRole) {
  if (!channel || !accessRole) return null
  return setPermissionOverwritesIfChanged(channel, [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel], type: OverwriteType.Role },
    createBotOverwrite(guild),
    {
      id: accessRole.id,
      allow: [...GAME_LOG_ACCESS_ALLOW],
      deny: [...GAME_LOG_ACCESS_DENY],
      type: OverwriteType.Role
    }
  ].filter(Boolean), 'BOTC private game log permissions').catch(err => {
    log.recoverable('apply-private-setup-game-log-permissions', err, createSetupAccessContext(guild, channel, accessRole))
    return null
  })
}

async function applyPrivateBotChannelAccess(channel, guild, accessRole = null) {
  return applyBotChannelAccess(channel, guild, {
    denyRoleIds: accessRole?.id ? [accessRole.id] : []
  })
}

async function applyPublicVoiceAccess(channel, guild, accessRole) {
  if (!channel || !accessRole) return null
  return setPermissionOverwritesIfChanged(channel, [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect], type: OverwriteType.Role },
    createBotOverwrite(guild, true),
    { id: accessRole.id, allow: [...PUBLIC_VOICE_ALLOW], type: OverwriteType.Role }
  ].filter(Boolean), 'BOTC private waiting room permissions').catch(err => {
    log.recoverable('apply-private-setup-waiting-room-permissions', err, createSetupAccessContext(guild, channel, accessRole))
    return null
  })
}

function createBotOverwrite(guild, voice = false) {
  const botId = guild.members?.me?.id || guild.client?.user?.id
  if (!botId) return null
  return {
    id: botId,
    allow: voice ? [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
      PermissionFlagsBits.Stream,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.MoveMembers,
      PermissionFlagsBits.MuteMembers
    ] : [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.UseApplicationCommands,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ManageChannels
    ],
    type: OverwriteType.Member
  }
}

function createSetupAccessContext(guild, channel = null, accessRole = null) {
  return {
    accessRoleId: accessRole?.id,
    channelId: channel?.id,
    guildId: guild?.id
  }
}

module.exports = {
  applyPrivateBotChannelAccess,
  applyPrivateSetupAccess
}
