const {
  ApplicationCommandOptionType,
  ChannelType,
  PermissionFlagsBits
} = require('discord.js')
const { wrapCommand } = require('../systems/discord/interactions/commandWrapper')
const {
  canUseBotUpdateChannel
} = require('../utils/botUpdateChannel')
const {
  hasAdministratorOrGlobalCommandAccess
} = require('../utils/commandAccess')

const SUBCOMMANDS = Object.freeze({
  set: 'set',
  show: 'show',
  clear: 'clear'
})
const options = [
  {
    name: SUBCOMMANDS.set,
    description: 'Set the channel for BOTC Bot update embeds.',
    type: ApplicationCommandOptionType.Subcommand,
    options: [{
      name: 'channel',
      description: 'Channel where update embeds should be posted.',
      type: ApplicationCommandOptionType.Channel,
      required: true,
      channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement]
    }]
  },
  {
    name: SUBCOMMANDS.show,
    description: 'Show the configured BOTC Bot update channel.',
    type: ApplicationCommandOptionType.Subcommand
  },
  {
    name: SUBCOMMANDS.clear,
    description: 'Clear the configured BOTC Bot update channel.',
    type: ApplicationCommandOptionType.Subcommand
  }
]
const command = {
  name: 'bot-update-channel',
  description: 'Configure where BOTC Bot update embeds are posted.',
  options,
  data: {
    name: 'bot-update-channel',
    description: 'Configure where BOTC Bot update embeds are posted.',
    options,
    default_member_permissions: PermissionFlagsBits.Administrator.toString()
  },
  default_member_permissions: PermissionFlagsBits.Administrator.toString(),
  setupExempt: true,

  execute: wrapCommand(executeBotUpdateChannelCommand)
}

async function executeBotUpdateChannelCommand(interaction, { serverConfigs, saveServerConfigs }) {
  if (!hasAdministrator(interaction)) {
    return { ok: false, error: { message: 'You need Administrator permission or bot owner access to configure the BOTC Bot update channel.' } }
  }

  const subcommand = interaction.options.getSubcommand()
  if (subcommand === SUBCOMMANDS.show) return showUpdateChannel(interaction, serverConfigs)
  if (subcommand === SUBCOMMANDS.clear) return clearUpdateChannel(interaction, serverConfigs, saveServerConfigs)
  return setUpdateChannel(interaction, serverConfigs, saveServerConfigs)
}

async function setUpdateChannel(interaction, serverConfigs, saveServerConfigs) {
  const channel = interaction.options.getChannel('channel')
  if (!canUseBotUpdateChannel(channel, interaction.guild)) {
    return {
      ok: false,
      error: { message: `${channel ? `<#${channel.id}>` : 'That channel'} must be a text channel I can view and send messages in.` }
    }
  }

  const config = serverConfigs.get(interaction.guild.id) || {}
  serverConfigs.set(interaction.guild.id, {
    ...config,
    botUpdateChannelId: channel.id
  })
  saveServerConfigs(serverConfigs)

  return {
    ok: true,
    title: 'Update channel saved',
    message: `BOTC Bot update embeds will post in <#${channel.id}>.`
  }
}

function showUpdateChannel(interaction, serverConfigs) {
  const config = serverConfigs.get(interaction.guild.id) || {}
  return {
    ok: true,
    title: 'BOTC Bot update channel',
    message: config.botUpdateChannelId
      ? `Configured update channel: <#${config.botUpdateChannelId}>.`
      : 'No update channel is configured. I will use an existing bot channel, create `bot-updates`, or fall back to general chat.'
  }
}

function clearUpdateChannel(interaction, serverConfigs, saveServerConfigs) {
  const config = serverConfigs.get(interaction.guild.id) || {}
  const next = { ...config }
  delete next.botUpdateChannelId
  serverConfigs.set(interaction.guild.id, next)
  saveServerConfigs(serverConfigs)

  return {
    ok: true,
    title: 'Update channel cleared',
    message: 'BOTC Bot update embeds will use an existing bot channel, create `bot-updates`, or fall back to general chat.'
  }
}

function hasAdministrator(interaction) {
  return hasAdministratorOrGlobalCommandAccess(interaction)
}

module.exports = Object.assign(command, {
  executeBotUpdateChannelCommand,
  hasAdministrator
})
