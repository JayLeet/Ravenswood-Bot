const {
  ActionRowBuilder,
  AuditLogEvent,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js')
const {
  queuedChannelSend
} = require('../../utils/discord/messageActions')
const {
  getOrCreateBotUpdateChannel
} = require('../../utils/botUpdateChannel')
const {
  SETUP_DELETE_CUSTOM_ID,
  createSetupDeleteButton
} = require('../../utils/setupDelete')
const {
  fetchWithRecoverableFallback
} = require('../../utils/discord/recoverableFetch')
const {
  createBotLogger
} = require('../../utils/logger')

const DISCLAIMER = 'Community-made unofficial tool. Not affiliated with, endorsed by, sponsored by, or licensed by The Pandemonium Institute.'
const NOTICE_CHUNK_LIMIT = 1200
const FIRST_JOIN_SETUP_CHECK_ID = 'botc:first-join:setup-check'
const FIRST_JOIN_SETUP_ID = 'botc:first-join:setup'
const FIRST_JOIN_SETUP_CHANNELS_ID = 'botc:first-join:setup-channels'
const log = createBotLogger({ subsystem: 'FirstJoinSetupNotice' })

async function sendFirstJoinSetupNotice(guild) {
  const resolved = await findSetupNoticeChannel(guild)
  if (resolved?.ok === false) {
    return { ok: false, reason: 'setup notice channel blocked', message: resolved.message }
  }
  const channel = resolved?.channel || null
  if (!channel) return { ok: false, reason: 'no setup notice channel found' }

  const inviterId = await getBotInviteUserId(guild)

  const messages = []
  for (const payload of createFirstJoinSetupNoticePayloads(inviterId ? [inviterId] : [])) {
    const message = await queuedChannelSend(channel, payload).catch(err => {
      log.recoverable('send-first-join-setup-notice', err, {
        channelId: channel.id,
        guildId: guild.id,
        inviterId
      })
      return null
    })
    if (message) messages.push(message)
  }

  if (!messages.length) return { ok: false, reason: 'setup notice send failed' }
  return { ok: true, channel, channelSource: resolved.source, messages, inviterId }
}

async function findSetupNoticeChannel(guild) {
  return getOrCreateBotUpdateChannel(guild, {}, { requireBotChannelAccess: true })
}

async function getBotInviteUserId(guild, logger = log) {
  const botId = guild.client?.user?.id || guild.members?.me?.id
  const logs = await fetchWithRecoverableFallback({
    action: 'fetch-first-join-bot-add-audit-log',
    context: { botId, guildId: guild.id },
    fetch: () => guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.BotAdd }),
    logger
  })
  const entries = getCacheValues(logs?.entries)
  const entry = entries.find(item => !botId || getAuditLogTargetId(item) === botId) || null
  const inviterId = entry?.executor?.id || entry?.executorId || null
  return inviterId && inviterId !== botId ? inviterId : null
}

function getAuditLogTargetId(entry) {
  return entry?.target?.id || entry?.targetId || null
}

function createFirstJoinSetupNoticePayloads(userIds = []) {
  const mentionIds = normalizeMentionIds(userIds)
  const chunks = mentionIds.length ? chunkMentions(mentionIds) : [[]]

  return chunks.map((ids, index) => index === 0
    ? createMainSetupNoticePayload(ids)
    : createExtraSetupNoticePayload(ids))
}

function createMainSetupNoticePayload(userIds) {
  return {
    content: userIds.length ? userIds.map(id => `<@${id}>`).join(' ') : null,
    allowedMentions: { users: userIds },
    embeds: [createFirstJoinSetupEmbed()],
    components: createFirstJoinSetupNoticeActionRows()
  }
}

function createFirstJoinSetupEmbed() {
  return new EmbedBuilder()
    .setTitle('BOTC Bot setup')
    .setDescription([
      'Thanks for adding BOTC Bot. Use these setup actions to check permissions, create the full default setup, or manually choose channels.',
      DISCLAIMER
    ].join('\n\n'))
    .addFields(
      {
        name: '/setup-check',
        value: 'Checks whether the bot has the permissions and role access needed before setup runs.',
        inline: false
      },
      {
        name: '/setup',
        value: 'Creates or refreshes the Ravenswood Bluff setup automatically. This is the recommended first setup path.',
        inline: false
      },
      {
        name: '/setup-channels',
        value: 'Opens a channel picker when you want to use existing channels or create only the missing manual channels.',
        inline: false
      },
      {
        name: '/delete',
        value: 'Admin-only cleanup for deleting the BOTC Bot setup channels and categories the bot created. User-created channels are left alone.',
        inline: false
      }
    )
    .setColor(0x3498db)
}

function createFirstJoinSetupNoticeActionRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(FIRST_JOIN_SETUP_CHECK_ID)
        .setLabel('/setup-check')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(FIRST_JOIN_SETUP_ID)
        .setLabel('/setup')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(FIRST_JOIN_SETUP_CHANNELS_ID)
        .setLabel('/setup-channels')
        .setStyle(ButtonStyle.Secondary),
      createSetupDeleteButton()
    )
  ]
}

function createExtraSetupNoticePayload(userIds) {
  return {
    content: [
      'Additional setup notice recipient:',
      userIds.map(id => `<@${id}>`).join(' ')
    ].join('\n\n'),
    allowedMentions: { users: userIds }
  }
}

function isFirstJoinSetupNoticeInteraction(customId) {
  return [
    FIRST_JOIN_SETUP_CHECK_ID,
    FIRST_JOIN_SETUP_ID,
    FIRST_JOIN_SETUP_CHANNELS_ID
  ].includes(String(customId || ''))
}

function normalizeMentionIds(ids) {
  return [...new Set((ids || []).map(id => {
    if (typeof id === 'string') return id
    return id?.id || null
  }).filter(Boolean))]
}

function chunkMentions(ids) {
  const chunks = []
  let current = []
  let length = 0

  for (const id of ids) {
    const mentionLength = `<@${id}> `.length
    if (current.length && length + mentionLength > NOTICE_CHUNK_LIMIT) {
      chunks.push(current)
      current = []
      length = 0
    }

    current.push(id)
    length += mentionLength
  }

  if (current.length) chunks.push(current)
  return chunks
}

function getCacheValues(cache) {
  if (Array.isArray(cache)) return cache
  if (typeof cache?.values === 'function') return [...cache.values()]
  return []
}

module.exports = {
  DISCLAIMER,
  SETUP_DELETE_CUSTOM_ID,
  FIRST_JOIN_SETUP_CHANNELS_ID,
  FIRST_JOIN_SETUP_CHECK_ID,
  FIRST_JOIN_SETUP_ID,
  createFirstJoinSetupNoticeActionRows,
  createFirstJoinSetupNoticePayloads,
  findSetupNoticeChannel,
  getBotInviteUserId,
  isFirstJoinSetupNoticeInteraction,
  sendFirstJoinSetupNotice
}
