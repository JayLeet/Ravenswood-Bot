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
  getCacheValues
} = require('../../utils/discord/cacheValues')
const {
  createBotLogger
} = require('../../utils/logger')

const DISCLAIMER = 'Community-made unofficial tool. Not affiliated with, endorsed by, sponsored by, or licensed by The Pandemonium Institute.'
const NOTICE_CHUNK_LIMIT = 1200
const FIRST_JOIN_SETUP_CHECK_ID = 'botc:first-join:setup-check'
const FIRST_JOIN_SETUP_ID = 'botc:first-join:setup'
const FIRST_JOIN_SETUP_MANUAL_ID = 'botc:first-join:setup-manual'
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
    .setTitle('\u{1F916} Welcome to BOTC Bot')
    .setDescription([
      'Start with the setup check, then choose the setup path that fits this server.',
      'Automatic setup is recommended. Manual setup is for servers that already have channels to reuse.',
      DISCLAIMER
    ].join('\n\n'))
    .addFields(
      {
        name: '\u{1FA7A} `/setup-check`',
        value: 'Checks whether I have the Discord permissions needed before setup runs.',
        inline: false
      },
      {
        name: '\u{1F6E0}\u{FE0F} `/setup`',
        value: 'Opens guided setup. Choose Automatic setup or Manual setup from the first screen.',
        inline: false
      },
      {
        name: '\u{1F9ED} `/setup-manual`',
        value: 'Advanced shortcut for choosing a category, Waiting Room, game-log archive, and save behavior.',
        inline: false
      },
      {
        name: '\u{1F9F9} `/delete`',
        value: 'Deletes only BOTC-managed setup channels and categories. User-created channels are left alone.',
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
        .setEmoji('\u{2705}')
        .setLabel('/setup-check')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(FIRST_JOIN_SETUP_ID)
        .setEmoji('\u{2699}\u{FE0F}')
        .setLabel('/setup')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(FIRST_JOIN_SETUP_MANUAL_ID)
        .setEmoji('\u{1F4C2}')
        .setLabel('/setup-manual')
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
    FIRST_JOIN_SETUP_MANUAL_ID
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

module.exports = {
  DISCLAIMER,
  SETUP_DELETE_CUSTOM_ID,
  FIRST_JOIN_SETUP_CHECK_ID,
  FIRST_JOIN_SETUP_ID,
  FIRST_JOIN_SETUP_MANUAL_ID,
  createFirstJoinSetupNoticeActionRows,
  createFirstJoinSetupNoticePayloads,
  findSetupNoticeChannel,
  getBotInviteUserId,
  isFirstJoinSetupNoticeInteraction,
  sendFirstJoinSetupNotice
}
