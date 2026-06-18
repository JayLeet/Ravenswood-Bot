const {
  canChangeBotUpdateChannel,
  createUpdateChannelPickerPayload,
  createUpdateNoticeActionRows,
  formatUpdateNoticeSubscriptionField,
  getUpdateNoticeUserId,
  isBotUpdateNotificationInteraction,
  SUBSCRIPTION_FIELD,
  UPDATE_NOTICE_CHANNEL_BUTTON_ID,
  UPDATE_NOTICE_CHANNEL_SELECT_ID,
  UPDATE_NOTICE_TOGGLE_ID,
  toggleUpdateNoticeUser
} = require('../../../utils/botUpdateNotifications')
const {
  createSystemEmbed,
  replyPrivatePayload,
  replyPrivateSystem
} = require('./feedback')
const { queuedMessageEdit } = require('../../../utils/discord/messageActions')
const {
  canUseBotUpdateChannel
} = require('../../../utils/botUpdateChannel')
const {
  createBotLogger
} = require('../../../utils/logger')

const log = createBotLogger({ subsystem: 'BotUpdateNotifications' })

function createBotUpdateNotificationInteractionSystem({ serverConfigs, saveServerConfigs }) {
  async function handleBotUpdateNotificationInteraction(interaction) {
    if (!isBotUpdateNotificationInteraction(interaction.customId)) return false

    if (interaction.customId === UPDATE_NOTICE_TOGGLE_ID) {
      return togglePersonalUpdateNotice(interaction, { serverConfigs, saveServerConfigs })
    }

    if (!canChangeBotUpdateChannel(interaction)) {
      return replyPrivateSystem(
        interaction,
        'Admin only',
        'Only server administrators or bot owner access users can change the BOTC Bot update channel.',
        'Ask a server administrator or the bot owner access user to change this setting.'
      )
    }

    if (interaction.customId === UPDATE_NOTICE_CHANNEL_BUTTON_ID) {
      return replyPrivatePayload(interaction, createUpdateChannelPickerPayload())
    }

    if (interaction.customId === UPDATE_NOTICE_CHANNEL_SELECT_ID) {
      return saveUpdateChannel(interaction, { serverConfigs, saveServerConfigs })
    }

    return false
  }

  return { handleBotUpdateNotificationInteraction }
}

async function togglePersonalUpdateNotice(interaction, { serverConfigs, saveServerConfigs }) {
  const userId = getUpdateNoticeUserId(interaction)
  if (!userId) {
    return replyPrivateSystem(
      interaction,
      'Could not save preference',
      'I could not identify which Discord user pressed the button.',
      'Try again from Discord directly.'
    )
  }

  const config = serverConfigs.get(interaction.guild.id) || {}
  const result = toggleUpdateNoticeUser(config, userId)
  serverConfigs.set(interaction.guild.id, {
    ...config,
    botUpdateNoticeUserIds: result.userIds
  })
  saveServerConfigs(serverConfigs)

  await replyPrivatePayload(interaction, {
    embeds: [createSystemEmbed(
      result.enabled ? 'Notifications enabled' : 'Notifications disabled',
      result.enabled
        ? 'You will be pinged for medium BOTC Bot updates and updates that need `/setup`.'
        : 'You will no longer be pinged for future BOTC Bot update notices.',
      result.enabled ? 0x2ecc71 : 0x95a5a6
    )]
  })

  await queuedMessageEdit(interaction.message, {
    embeds: updateNoticeEmbed(interaction.message?.embeds, result.userIds),
    components: createUpdateNoticeActionRows()
  }).catch(err => {
    log.recoverable('update-bot-update-notice-subscription', err, {
      guildId: interaction.guild?.id,
      messageId: interaction.message?.id,
      subscriberCount: result.userIds.length,
      userId
    })
    return null
  })
  return true
}

async function saveUpdateChannel(interaction, { serverConfigs, saveServerConfigs }) {
  const channel = getSelectedChannel(interaction)
  if (!canUseBotUpdateChannel(channel, interaction.guild)) {
    return replyPrivateSystem(
      interaction,
      'Channel unavailable',
      `${channel ? `<#${channel.id}>` : 'That channel'} must be a text channel I can view and send messages in.`,
      'Choose a text channel where BOTC Bot can post update embeds.'
    )
  }

  const config = serverConfigs.get(interaction.guild.id) || {}
  serverConfigs.set(interaction.guild.id, {
    ...config,
    botUpdateChannelId: channel.id
  })
  saveServerConfigs(serverConfigs)

  return replyPrivatePayload(interaction, {
    embeds: [createSystemEmbed(
      'Update channel saved',
      `Future BOTC Bot update embeds will post in <#${channel.id}>.`,
      0x2ecc71
    )]
  })
}

function getSelectedChannel(interaction) {
  const channelId = interaction.values?.[0]
  if (!channelId) return null
  return interaction.channels?.get?.(channelId) ||
    interaction.channels?.first?.() ||
    interaction.guild?.channels?.cache?.get?.(channelId) ||
    null
}

function updateNoticeEmbed(embeds, subscriberIds) {
  const embed = embeds?.[0]?.toJSON?.() || embeds?.[0] || null
  if (!embed) return []
  const fields = Array.isArray(embed.fields) ? embed.fields.slice() : []
  const index = fields.findIndex(field =>
    field.name === SUBSCRIPTION_FIELD ||
    field.name === 'Important update pings'
  )
  const field = {
    name: SUBSCRIPTION_FIELD,
    value: formatUpdateNoticeSubscriptionField(subscriberIds),
    inline: false
  }
  if (index >= 0) fields[index] = field
  else fields.push(field)
  return [{ ...embed, fields }]
}

module.exports = {
  createBotUpdateNotificationInteractionSystem,
  isBotUpdateNotificationInteraction
}
