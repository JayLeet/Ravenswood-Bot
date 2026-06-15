const { PermissionFlagsBits } = require('discord.js')
const { createBotChannelAccessOverwrites } = require('./botChannelAccess')
const {
  createSetupPermissionDiagnostics,
  formatSetupPermissionDiagnostics
} = require('./setupPermissionDiagnostics')

function createBotUpdateChannelFailureMessage(channel, category, guild) {
  const channelText = channel?.id ? `The created channel <#${channel.id}> was not usable.` : 'I could not create the dedicated BOTC Bot channel.'
  const categoryText = category?.name ? ` in ${category.name}` : ''
  const diagnostics = channel
    ? createCreatedBotChannelDiagnostics(guild, channel)
    : createMissingBotChannelDiagnostics(guild, category)
  return [
    `${channelText}${categoryText}`,
    'Discord blocked channel creation, channel visibility, sending messages, or the permission overwrites needed for setup.',
    'What to fix:',
    formatSetupPermissionDiagnostics(diagnostics)
  ].join('\n')
}

function createBotUpdateChannelMoveFailureMessage(channel, category, guild) {
  const diagnostics = createSetupPermissionDiagnostics({
    guild,
    target: channel,
    overwrites: createBotChannelAccessOverwrites(guild),
    requiredChannelPermissions: [
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageRoles
    ]
  })
  return [
    `I found the BOTC Bot channel <#${channel?.id || 'unknown'}>, but could not move it into ${category?.name || 'the Ravenswood Bluff category'}.`,
    'Discord blocked the channel move or permission refresh for the saved BOTC Bot channel.',
    'What to fix:',
    formatSetupPermissionDiagnostics(diagnostics)
  ].join('\n')
}

function createMissingBotChannelDiagnostics(guild, category) {
  return createSetupPermissionDiagnostics({
    guild,
    target: category,
    overwrites: createBotChannelAccessOverwrites(guild),
    requiredChannelPermissions: [
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageRoles
    ]
  })
}

function createCreatedBotChannelDiagnostics(guild, channel) {
  return createSetupPermissionDiagnostics({
    guild,
    target: channel,
    overwrites: createBotChannelAccessOverwrites(guild),
    requiredChannelPermissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ManageRoles
    ]
  })
}

module.exports = {
  createBotUpdateChannelFailureMessage,
  createBotUpdateChannelMoveFailureMessage
}
