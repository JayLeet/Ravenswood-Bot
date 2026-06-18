const { createSystemEmbed } = require('./feedback')
const { formatProgress } = require('./adminDiagnosticHandles')
const {
  hasAdministratorOrGlobalCommandAccess
} = require('../../../utils/commandAccess')

const MAX_FIELD_LENGTH = 256
const MODAL_OPEN_BUTTON_PREFIXES = [
  'botc:player-grim:note',
  'botc:storyteller:quick-custom',
  'botc:storyteller:set-vote-speed',
  'botc:storyteller:set-vote-threshold',
  'botc:storyteller:timer'
]

function createDiagnosticContext(interaction, serverConfigs) {
  if (!interaction?.guild?.id || interaction.isAutocomplete?.()) return null
  if (isModalOpenButton(interaction)) return null
  if (!hasAdministratorOrGlobalCommandAccess(interaction)) return null

  const serverConfig = serverConfigs?.get?.(interaction.guild.id)
  const diagnosticChannelIds = [
    serverConfig?.gameChannelId,
    serverConfig?.storytellerChannelId,
    serverConfig?.liveChannelId,
    serverConfig?.postGameChannelId
  ].filter(Boolean)
  if (!diagnosticChannelIds.includes(interaction.channelId)) return null

  return {
    action: describeInteraction(interaction),
    channel: `<#${interaction.channelId}>`
  }
}

function createDiagnosticPayload({
  color,
  context,
  description,
  elapsedMs,
  error = null,
  progressStep = null,
  reason = null,
  title
}) {
  const embed = createSystemEmbed(title, description, color)
    .addFields(
      { name: 'Action', value: limitField(context.action), inline: false },
      { name: 'Channel', value: context.channel, inline: true },
      { name: 'Elapsed', value: `${formatElapsedSeconds(elapsedMs)}s`, inline: true }
    )

  if (reason) {
    embed.addFields({
      name: 'Waiting on',
      value: limitField(reason),
      inline: false
    })
  }

  if (progressStep !== null) {
    embed.addFields({
      name: 'Loading...',
      value: formatProgress(progressStep),
      inline: false
    })
  }

  if (error) {
    embed.addFields({
      name: 'Error',
      value: limitField(error.message || String(error)),
      inline: false
    })
  }

  return { embeds: [embed] }
}

function isModalOpenButton(interaction) {
  if (!interaction.isButton?.()) return false
  const customId = String(interaction.customId || '')
  return MODAL_OPEN_BUTTON_PREFIXES.some(prefix => customId === prefix || customId.startsWith(`${prefix}:`))
}

function describeInteraction(interaction) {
  if (interaction.isChatInputCommand?.()) return describeChatInputCommand(interaction)
  if (interaction.isButton?.()) return `Button: ${interaction.customId || 'unknown'}`
  if (interaction.isStringSelectMenu?.()) return `Menu: ${interaction.customId || 'unknown'}`
  if (interaction.isModalSubmit?.()) return `Modal: ${interaction.customId || 'unknown'}`
  return interaction.customId || interaction.commandName || 'Unknown interaction'
}

function describeChatInputCommand(interaction) {
  const command = interaction.commandName || 'unknown'
  const subcommand = interaction.options?.getSubcommand?.(false)
  return subcommand ? `/${command} ${subcommand}` : `/${command}`
}

function limitField(value) {
  const text = String(value || 'Unknown')
  if (text.length <= MAX_FIELD_LENGTH) return text
  return `${text.slice(0, MAX_FIELD_LENGTH - 3)}...`
}

function formatElapsedSeconds(elapsedMs) {
  return Math.max(0, Math.ceil(Number(elapsedMs) / 1000) || 0)
}

module.exports = {
  createDiagnosticContext,
  createDiagnosticPayload
}
