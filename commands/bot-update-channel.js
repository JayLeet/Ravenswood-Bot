const {
  ApplicationCommandOptionType,
  ChannelType,
  PermissionFlagsBits
} = require('discord.js')
const { wrapCommand } = require('../utils/commandWrapper')
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
const UPDATE_CHANNEL_FALLBACK_TEXT = 'If no saved channel is usable, update notices use the dedicated BOTC Bot channel when available, then another usable server channel.'
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
  if (!hasAdministratorOrGlobalCommandAccess(interaction)) {
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
    message: `Future BOTC Bot update embeds will post in <#${channel.id}>.\n\nNo restart is needed.`
  }
}

async function showUpdateChannel(interaction, serverConfigs) {
  const config = serverConfigs.get(interaction.guild.id) || {}
  if (config.botUpdateChannelId) {
    const channel = await fetchUpdateChannel(interaction.guild, config.botUpdateChannelId)
    if (canUseBotUpdateChannel(channel, interaction.guild)) {
      return {
        ok: true,
        title: 'BOTC Bot update channel',
        message: `Saved update channel: <#${config.botUpdateChannelId}>.\n\nFuture BOTC Bot update embeds will post there.`
      }
    }

    return {
      ok: true,
      title: 'Update channel needs attention',
      message: [
        `Saved update channel: <#${config.botUpdateChannelId}>.`,
        '',
        'I cannot use that channel right now. It may have been deleted, hidden from the bot, or missing Send Messages.',
        '',
        UPDATE_CHANNEL_FALLBACK_TEXT,
        '',
        'Use `/bot-update-channel set` to choose a channel I can view and send messages in.'
      ].join('\n')
    }
  }

  return {
    ok: true,
    title: 'BOTC Bot update channel',
    message: `No update channel is saved.\n\n${UPDATE_CHANNEL_FALLBACK_TEXT}`
  }
}

function clearUpdateChannel(interaction, serverConfigs, saveServerConfigs) {
  const config = serverConfigs.get(interaction.guild.id) || {}
  if (!config.botUpdateChannelId) {
    return {
      ok: true,
      title: 'No update channel saved',
      message: `There was no saved update channel to clear.\n\n${UPDATE_CHANNEL_FALLBACK_TEXT}`
    }
  }

  const next = { ...config }
  delete next.botUpdateChannelId
  serverConfigs.set(interaction.guild.id, next)
  saveServerConfigs(serverConfigs)

  return {
    ok: true,
    title: 'Update channel cleared',
    message: `BOTC Bot update embeds will no longer use <#${config.botUpdateChannelId}>.\n\n${UPDATE_CHANNEL_FALLBACK_TEXT}`
  }
}

async function fetchUpdateChannel(guild, channelId) {
  if (!channelId) return null
  const cached = guild?.channels?.cache?.get?.(channelId)
  if (cached) return cached
  if (typeof guild?.channels?.fetch !== 'function') return null
  return guild.channels.fetch(channelId).catch(() => null)
}

module.exports = Object.assign(command, {
  executeBotUpdateChannelCommand,
  fetchUpdateChannel,
  showUpdateChannel
})
