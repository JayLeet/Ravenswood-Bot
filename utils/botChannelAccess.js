const {
  OverwriteType,
  PermissionFlagsBits
} = require('discord.js')
const {
  GLOBAL_COMMAND_ACCESS_USER_IDS
} = require('./commandAccess')
const {
  setPermissionOverwritesIfChanged
} = require('./discord/permissionOverwriteSignature')
const {
  createBotLogger
} = require('./logger')
const {
  createSetupPermissionDiagnostics,
  formatSetupPermissionDiagnostics
} = require('./setupPermissionDiagnostics')

const BOT_CHANNEL_USER_ALLOW = Object.freeze([
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.UseApplicationCommands,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.SendMessagesInThreads
])
const BOT_CHANNEL_USER_DENY = Object.freeze([
  PermissionFlagsBits.CreatePublicThreads,
  PermissionFlagsBits.CreatePrivateThreads
])
const BOT_CHANNEL_EVERYONE_DENY = Object.freeze([
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.SendMessagesInThreads,
  ...BOT_CHANNEL_USER_DENY
])
const BOT_CHANNEL_BOT_ALLOW = Object.freeze([
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.UseApplicationCommands,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.ManageChannels
])
const BOT_CHANNEL_BOT_SEED_ALLOW = Object.freeze([
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory
])
const log = createBotLogger({ subsystem: 'BotChannelAccess' })

function createBotChannelAccessOverwrites(guild, options = {}) {
  const denyRoleIds = new Set((options.denyRoleIds || []).filter(Boolean).map(String))
  const userIds = options.userIds || GLOBAL_COMMAND_ACCESS_USER_IDS

  return [
    { id: guild.id, deny: [...BOT_CHANNEL_EVERYONE_DENY], type: OverwriteType.Role },
    createBotOverwrite(guild),
    ...userIds.map(userId => ({
      id: userId,
      allow: [...BOT_CHANNEL_USER_ALLOW],
      deny: [...BOT_CHANNEL_USER_DENY],
      type: OverwriteType.Member
    })),
    ...[...denyRoleIds].map(roleId => ({
      id: roleId,
      deny: [PermissionFlagsBits.ViewChannel],
      type: OverwriteType.Role
    }))
  ].filter(Boolean)
}

function createBotChannelSeedOverwrites(guild) {
  return [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel], type: OverwriteType.Role },
    createBotOverwrite(guild, BOT_CHANNEL_BOT_SEED_ALLOW)
  ].filter(Boolean)
}

async function applyBotChannelAccess(channel, guild, options = {}) {
  if (!channel || !guild) return null
  const overwrites = await createResolvedBotChannelAccessOverwrites(guild, options)
  return setPermissionOverwritesIfChanged(
    channel,
    overwrites,
    'BOTC Bot channel owner/admin access'
  ).then(changed => ({ ok: true, changed: !!changed })).catch(err => {
    log.recoverable('apply-bot-channel-access', err, {
      channelId: channel?.id,
      guildId: guild?.id
    })
    return {
      ok: false,
      message: createBotChannelAccessFailureMessage(channel, guild, err, overwrites)
    }
  })
}

async function createResolvedBotChannelAccessOverwrites(guild, options = {}) {
  const userIds = []
  const sourceUserIds = Array.isArray(options.userIds) ? options.userIds : GLOBAL_COMMAND_ACCESS_USER_IDS
  for (const userId of sourceUserIds) {
    if (await isGuildMember(guild, userId)) userIds.push(userId)
  }
  return createBotChannelAccessOverwrites(guild, { ...options, userIds })
}

async function isGuildMember(guild, userId) {
  if (!userId) return false
  const cache = guild?.members?.cache
  if (typeof cache?.has === 'function' && cache.has(userId)) return true
  if (Array.isArray(cache) && cache.some(member => String(member?.id || member?.user?.id) === String(userId))) return true
  if (typeof guild?.members?.fetch !== 'function') return true

  return guild.members.fetch(userId)
    .then(member => Boolean(member))
    .catch(err => {
      const code = Number(err?.code)
      return ![10007, 10013].includes(code)
    })
}

function createBotChannelAccessFailureMessage(channel, guild, err, overwrites = []) {
  const channelLabel = channel?.id ? ` <#${channel.id}>` : ''
  const discordReason = formatDiscordErrorReason(err)
  const diagnostics = createSetupPermissionDiagnostics({
    guild,
    target: channel,
    overwrites,
    requiredChannelPermissions: [
      PermissionFlagsBits.ManageRoles
    ]
  })
  return [
    `I could not update permissions for the BOTC Bot channel${channelLabel}.`,
    `Discord blocked the permission overwrite update${discordReason}.`,
    'What to fix:',
    formatSetupPermissionDiagnostics(diagnostics)
  ].join('\n')
}

function formatDiscordErrorReason(err) {
  const message = String(err?.message || '').trim()
  const code = err?.code ? `code ${err.code}` : ''
  const details = [message, code].filter(Boolean).join(', ')
  return details ? ` (${details})` : ''
}

function createBotOverwrite(guild, allow = BOT_CHANNEL_BOT_ALLOW) {
  const botId = guild.members?.me?.id || guild.client?.user?.id
  if (!botId) return null
  return {
    id: botId,
    allow: [...allow],
    type: OverwriteType.Member
  }
}

module.exports = {
  BOT_CHANNEL_BOT_ALLOW,
  BOT_CHANNEL_BOT_SEED_ALLOW,
  BOT_CHANNEL_EVERYONE_DENY,
  BOT_CHANNEL_USER_ALLOW,
  BOT_CHANNEL_USER_DENY,
  applyBotChannelAccess,
  createBotChannelAccessFailureMessage,
  createBotChannelAccessOverwrites,
  createBotChannelSeedOverwrites,
  createResolvedBotChannelAccessOverwrites
}
