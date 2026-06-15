const { PermissionFlagsBits } = require('discord.js')

const SET_VOICE_CHANNEL_STATUS_PERMISSION =
  PermissionFlagsBits.SetVoiceChannelStatus || 0x0001000000000000n

const REQUIRED_GUILD_PERMISSIONS = [
  ['Manage Channels', PermissionFlagsBits.ManageChannels],
  ['Move Members', PermissionFlagsBits.MoveMembers],
  ['Manage Roles', PermissionFlagsBits.ManageRoles],
  ['Manage Nicknames', PermissionFlagsBits.ManageNicknames],
  ['View Audit Log', PermissionFlagsBits.ViewAuditLog]
]

const REQUIRED_SETUP_CREATE_PERMISSIONS = [
  ['View Channel', PermissionFlagsBits.ViewChannel],
  ['Send Messages', PermissionFlagsBits.SendMessages],
  ['Send Messages in Threads', PermissionFlagsBits.SendMessagesInThreads],
  ['Create Public Threads', PermissionFlagsBits.CreatePublicThreads],
  ['Create Private Threads', PermissionFlagsBits.CreatePrivateThreads],
  ['Embed Links', PermissionFlagsBits.EmbedLinks],
  ['Read Message History', PermissionFlagsBits.ReadMessageHistory],
  ['Use Application Commands', PermissionFlagsBits.UseApplicationCommands],
  ['Manage Messages', PermissionFlagsBits.ManageMessages],
  ['Attach Files', PermissionFlagsBits.AttachFiles],
  ['Add Reactions', PermissionFlagsBits.AddReactions],
  ['Connect', PermissionFlagsBits.Connect],
  ['Speak', PermissionFlagsBits.Speak],
  ['Stream', PermissionFlagsBits.Stream],
  ['Mute Members', PermissionFlagsBits.MuteMembers],
  ['Set Voice Channel Status', SET_VOICE_CHANNEL_STATUS_PERMISSION]
]

const REQUIRED_CHANNEL_PERMISSIONS = [
  ['View Channel', PermissionFlagsBits.ViewChannel],
  ['Send Messages', PermissionFlagsBits.SendMessages],
  ['Embed Links', PermissionFlagsBits.EmbedLinks],
  ['Read Message History', PermissionFlagsBits.ReadMessageHistory],
  ['Use Application Commands', PermissionFlagsBits.UseApplicationCommands]
]

const REQUIRED_CLEANUP_CHANNEL_PERMISSIONS = [
  ['Manage Messages', PermissionFlagsBits.ManageMessages]
]

const REQUIRED_EXISTING_SETUP_CATEGORY_PERMISSIONS = [
  ['View Channel', PermissionFlagsBits.ViewChannel],
  ['Manage Channels', PermissionFlagsBits.ManageChannels],
  ['Manage Roles', PermissionFlagsBits.ManageRoles]
]

function getMissingBotPermissions(guild, channels = [], cleanupChannels = []) {
  const botMember = guild.members.me
  if (!botMember) return ['I could not inspect my server permissions.']
  if (botMember.permissions.has(PermissionFlagsBits.Administrator)) return []

  const missing = []

  for (const [label, permission] of REQUIRED_GUILD_PERMISSIONS) {
    if (!botMember.permissions.has(permission)) missing.push(label)
  }

  for (const channel of channels) {
    const permissions = channel?.permissionsFor?.(botMember)

    for (const [label, permission] of REQUIRED_CHANNEL_PERMISSIONS) {
      if (!permissions?.has(permission)) {
        missing.push(`${label} in <#${channel.id}>`)
      }
    }
  }

  for (const channel of cleanupChannels) {
    const permissions = channel?.permissionsFor?.(botMember)

    for (const [label, permission] of REQUIRED_CLEANUP_CHANNEL_PERMISSIONS) {
      if (!permissions?.has(permission)) {
        missing.push(`${label} in <#${channel.id}>`)
      }
    }
  }

  return [...new Set(missing)]
}

function getMissingBotSetupPermissions(guild, options = {}) {
  const botMember = guild?.members?.me
  if (!botMember) return ['I could not inspect my server permissions.']
  if (botMember.permissions.has(PermissionFlagsBits.Administrator)) return []

  const missing = []

  for (const [label, permission] of [
    ...REQUIRED_GUILD_PERMISSIONS,
    ...REQUIRED_SETUP_CREATE_PERMISSIONS
  ]) {
    if (!botMember.permissions.has(permission)) missing.push(label)
  }

  const target = options.existingSetupCategory
  if (target) {
    const permissions = target.permissionsFor?.(botMember)
    for (const [label, permission] of REQUIRED_EXISTING_SETUP_CATEGORY_PERMISSIONS) {
      if (!permissions?.has?.(permission)) {
        missing.push(`${label} in ${target.name || 'Ravenswood Bluff'} category`)
      }
    }
  }

  return [...new Set(missing)]
}

function formatMissingBotPermissions(missing) {
  return [
    'I need a little more room to work before I can run BOTC games safely.',
    '',
    ...missing.map(permission => `- ${permission}`),
    '',
    'Either grant those permissions to my bot role, or keep Administrator enabled.'
  ].join('\n')
}

module.exports = {
  formatMissingBotPermissions,
  getMissingBotPermissions,
  getMissingBotSetupPermissions
}
