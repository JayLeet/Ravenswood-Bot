const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder
} = require('discord.js')
const {
  hasAdministratorOrGlobalCommandAccess
} = require('./commandAccess')

const UPDATE_NOTICE_TOGGLE_ID = 'botc:update-notices:toggle'
const UPDATE_NOTICE_CHANNEL_BUTTON_ID = 'botc:update-notices:channel'
const UPDATE_NOTICE_CHANNEL_SELECT_ID = 'botc:update-notices:channel-select'
const IMPORTANT_UPDATE_LABEL = 'Get notified on important future updates'
const UPDATE_TYPE_FIELD = '📦 Update type'
const SETUP_FIELD = '⚙️ Rerun /setup?'
const SUBSCRIPTION_FIELD = '🔔 Important update pings'

function createBotUpdatePayload({ subscriberIds = [], updateLog }) {
  const normalizedSubscriberIds = normalizeUpdateNoticeUserIds(subscriberIds)
  const pingSubscribers = shouldPingUpdateSubscribers(updateLog)
  const pingUserIds = pingSubscribers ? normalizedSubscriberIds : []
  const entry = updateLog.latestEntry || {}
  const changes = Array.isArray(entry.changes) && entry.changes.length
    ? entry.changes.map(change => `- ${change}`).join('\n')
    : '- No detailed changes were listed.'
  const setupNote = updateLog.requiresSetup || entry.requiresSetup
    ? 'Yes. Please rerun `/setup` so existing setup-managed channels, roles, or permissions can refresh.'
    : 'No.'

  return {
    content: pingUserIds.map(id => `<@${id}>`).join(' '),
    allowedMentions: { users: pingUserIds },
    embeds: [
      new EmbedBuilder()
        .setTitle(`📣 BOTC Bot updated to ${updateLog.currentVersion}`)
        .setDescription(changes)
        .addFields(
          { name: UPDATE_TYPE_FIELD, value: updateLog.latestUpdateType || entry.type || 'unknown', inline: true },
          { name: SETUP_FIELD, value: setupNote, inline: false },
          { name: SUBSCRIPTION_FIELD, value: formatUpdateNoticeSubscriptionField(normalizedSubscriberIds, pingSubscribers), inline: false }
        )
    ],
    components: createUpdateNoticeActionRows()
  }
}

function createUpdateNoticeActionRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(UPDATE_NOTICE_TOGGLE_ID)
        .setLabel(IMPORTANT_UPDATE_LABEL)
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(UPDATE_NOTICE_CHANNEL_BUTTON_ID)
        .setLabel('Change update channel')
        .setStyle(ButtonStyle.Secondary)
    )
  ]
}

function createUpdateChannelPickerPayload() {
  return {
    embeds: [
      new EmbedBuilder()
        .setTitle('Choose update channel')
        .setDescription('Choose where future BOTC Bot update embeds should be posted.')
        .setColor(0x3498db)
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(UPDATE_NOTICE_CHANNEL_SELECT_ID)
          .setPlaceholder('Choose update channel')
          .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setMinValues(1)
          .setMaxValues(1)
      )
    ]
  }
}

function formatUpdateNoticeSubscriptionField(subscriberIds = [], pingSubscribers = null) {
  const count = normalizeUpdateNoticeUserIds(subscriberIds).length
  const base = count === 1
    ? '1 person is subscribed.'
    : `${count} people are subscribed.`
  const rule = 'Subscribers are pinged for medium updates and updates that need `/setup`.'
  if (pingSubscribers === true) return `${base} This update pings subscribers. ${rule}`
  if (pingSubscribers === false) return `${base} This update does not ping subscribers. ${rule}`
  return `${base} ${rule}`
}

function isBotUpdateNotificationInteraction(customId) {
  return [
    UPDATE_NOTICE_TOGGLE_ID,
    UPDATE_NOTICE_CHANNEL_BUTTON_ID,
    UPDATE_NOTICE_CHANNEL_SELECT_ID
  ].includes(String(customId || ''))
}

function canChangeBotUpdateChannel(interaction) {
  return hasAdministratorOrGlobalCommandAccess(interaction)
}

function getUpdateNoticeUserId(interaction) {
  return interaction?.user?.id || interaction?.member?.id || interaction?.member?.user?.id || null
}

function normalizeUpdateNoticeUserIds(ids = []) {
  return [...new Set((Array.isArray(ids) ? ids : [])
    .map(id => String(id || '').trim())
    .filter(Boolean))]
}

function toggleUpdateNoticeUser(config = {}, userId) {
  const current = normalizeUpdateNoticeUserIds(config.botUpdateNoticeUserIds)
  const id = String(userId || '').trim()
  if (!id) return { enabled: false, userIds: current }
  const enabled = !current.includes(id)
  const userIds = enabled
    ? [...current, id].sort((a, b) => a.localeCompare(b))
    : current.filter(existingId => existingId !== id)
  return { enabled, userIds }
}

function shouldPingUpdateSubscribers(updateLog) {
  const entry = updateLog?.latestEntry || {}
  const type = String(updateLog?.latestUpdateType || entry.type || '').trim().toLowerCase()
  return Boolean(
    updateLog?.requiresSetup ||
    entry.requiresSetup ||
    ['medium', 'major', 'big', 'huge'].includes(type)
  )
}

module.exports = {
  IMPORTANT_UPDATE_LABEL,
  SETUP_FIELD,
  SUBSCRIPTION_FIELD,
  UPDATE_TYPE_FIELD,
  UPDATE_NOTICE_CHANNEL_BUTTON_ID,
  UPDATE_NOTICE_CHANNEL_SELECT_ID,
  UPDATE_NOTICE_TOGGLE_ID,
  canChangeBotUpdateChannel,
  createBotUpdatePayload,
  createUpdateChannelPickerPayload,
  createUpdateNoticeActionRows,
  formatUpdateNoticeSubscriptionField,
  getUpdateNoticeUserId,
  isBotUpdateNotificationInteraction,
  normalizeUpdateNoticeUserIds,
  shouldPingUpdateSubscribers,
  toggleUpdateNoticeUser
}
