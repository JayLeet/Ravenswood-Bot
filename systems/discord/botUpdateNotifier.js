const { isInitialVersion } = require('../../utils/updateLog')
const {
  createBotUpdatePayload,
  normalizeUpdateNoticeUserIds
} = require('../../utils/botUpdateNotifications')
const {
  getOrCreateBotUpdateChannel
} = require('../../utils/botUpdateChannel')
const {
  getCacheValues
} = require('../../utils/discord/cacheValues')
const { queuedChannelSend } = require('../../utils/discord/messageActions')
const { createBotLogger } = require('../../utils/logger')
const { logError } = require('../../utils/startupDiagnostics')

const inProcessUpdateNotices = new Set()
const log = createBotLogger({ subsystem: 'BotUpdateNotice' })

async function sendBotUpdateNotices({ client, serverConfigs, saveServerConfigs, updateLog }) {
  if (!shouldAnnounceUpdate(updateLog)) return { sent: 0, skipped: 0 }

  let sent = 0
  let skipped = 0
  for (const guild of getCacheValues(client.guilds?.cache)) {
    const result = await sendBotUpdateNotice(guild, { serverConfigs, saveServerConfigs, updateLog })
      .catch(err => {
        logError(console, `[BOTC][UpdateNotice] Failed for ${guild.id}`, err)
        return { ok: false }
      })
    if (result.ok) sent += 1
    else skipped += 1
  }

  return { sent, skipped }
}

async function sendBotUpdateNotice(guild, { serverConfigs, saveServerConfigs, updateLog }) {
  const config = serverConfigs.get(guild.id) || {}
  const noticeKey = createNoticeKey(guild.id, updateLog.currentVersion)
  if (config.lastBotUpdateNoticeVersion === updateLog.currentVersion || inProcessUpdateNotices.has(noticeKey)) {
    return { ok: false, reason: 'already-announced' }
  }

  const resolved = await getOrCreateBotUpdateChannel(guild, config, { requireBotChannelAccess: true })
  if (resolved.ok === false) {
    return { ok: false, reason: 'channel-access-blocked', message: resolved.message }
  }
  const channel = resolved.channel
  if (!channel) return { ok: false, reason: 'no-channel' }

  markUpdateNoticeAnnounced(guild.id, config, serverConfigs, saveServerConfigs, updateLog.currentVersion)
  inProcessUpdateNotices.add(noticeKey)

  try {
    const sent = await queuedChannelSend(channel, createBotUpdatePayload({
      subscriberIds: normalizeUpdateNoticeUserIds(config.botUpdateNoticeUserIds),
      updateLog
    })).catch(err => {
      log.recoverable('send-update-notice', err, {
        channelId: channel.id,
        guildId: guild.id,
        version: updateLog.currentVersion
      })
      return null
    })
    if (!sent) return { ok: false, reason: 'send-failed-marked' }

    return { ok: true, channel, channelSource: resolved.source }
  } finally {
    inProcessUpdateNotices.delete(noticeKey)
  }
}

function markUpdateNoticeAnnounced(guildId, config, serverConfigs, saveServerConfigs, version) {
  serverConfigs.set(guildId, {
    ...config,
    lastBotUpdateNoticeVersion: version
  })
  saveServerConfigs(serverConfigs)
}

function createNoticeKey(guildId, version) {
  return `${guildId}:${version}`
}

function shouldAnnounceUpdate(updateLog) {
  if (!updateLog?.validVersion) return false
  if (isInitialVersion(updateLog.currentVersion)) return false
  if (!updateLog.latestEntry) return false
  return true
}

function getBotUpdateNoticeRuntimeState() {
  return {
    inProcessUpdateNotices: inProcessUpdateNotices.size
  }
}

module.exports = {
  getBotUpdateNoticeRuntimeState,
  markUpdateNoticeAnnounced,
  sendBotUpdateNotice,
  sendBotUpdateNotices
}
