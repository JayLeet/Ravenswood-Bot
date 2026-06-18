const {
  PermissionFlagsBits
} = require('discord.js')
const { wrapCommand } = require('../utils/commandWrapper')
const {
  hasGlobalCommandAccess
} = require('../utils/commandAccess')
const {
  DEV_ROLE_NAME,
  toggleDevAccess
} = require('../utils/devAccessRole')

module.exports = {
  name: 'dev',
  description: 'Toggle BOTC Bot developer channel access.',
  options: [],
  data: {
    name: 'dev',
    description: 'Toggle BOTC Bot developer channel access.',
    options: [],
    default_member_permissions: PermissionFlagsBits.Administrator.toString()
  },
  default_member_permissions: PermissionFlagsBits.Administrator.toString(),
  setupExempt: true,

  execute: wrapCommand(executeDevCommand)
}

async function executeDevCommand(interaction, ctx = {}) {
  if (!hasGlobalCommandAccess(interaction)) {
    return {
      ok: false,
      error: { message: 'Only the configured BOTC Bot owner can use `/dev`.' }
    }
  }

  const member = await getInteractionMember(interaction)
  const result = await toggleDevAccess(interaction.guild, member, {
    serverConfig: ctx.serverConfigs?.get?.(interaction.guild.id) || ctx.serverConfig || {}
  })
  if (!result.ok) return { ok: false, error: { message: result.message } }

  return result.enabled
    ? createEnabledResponse(result)
    : createDisabledResponse()
}

async function getInteractionMember(interaction) {
  if (interaction.member?.roles?.cache) return interaction.member
  return interaction.guild?.members?.fetch?.(interaction.user.id) || null
}

function createEnabledResponse(result) {
  const skipped = result.channelsSkipped
    ? ` ${result.channelsSkipped} channel(s) were skipped because I cannot manage their permissions.${formatChannelList('Skipped', result.skippedChannels)}`
    : ''
  return {
    ok: true,
    title: '🤖 Dev access enabled',
    message: `Added ${DEV_ROLE_NAME} and refreshed view/send access for ${result.channelsUpdated} channel(s).${formatChannelList('Updated', result.updatedChannels)}${skipped}`
  }
}

function createDisabledResponse() {
  return {
    ok: true,
    title: '🤖 Dev access disabled',
    message: `Removed ${DEV_ROLE_NAME}. Run \`/dev\` again whenever you need developer channel access.`
  }
}

function formatChannelList(label, channels = []) {
  if (!channels.length) return ''
  const visible = channels.slice(0, 6).join(', ')
  const remaining = channels.length > 6 ? `, and ${channels.length - 6} more` : ''
  return `\n${label}: ${visible}${remaining}.`
}

module.exports.executeDevCommand = executeDevCommand
