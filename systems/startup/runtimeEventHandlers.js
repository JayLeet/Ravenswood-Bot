const {
  sendFirstJoinSetupNotice
} = require('../discord/firstJoinSetupNotice')
const {
  BOT_UPDATE_CHANNEL_SOURCE
} = require('../../utils/botUpdateChannel')
const {
  logError,
  logStartupStep
} = require('../../utils/startupDiagnostics')
const {
  createBotLogger
} = require('../../utils/logger')
const {
  getCacheValues
} = require('../../utils/discord/cacheValues')

const log = createBotLogger({ subsystem: 'RuntimeEvents' })

function createClientReadyHandler({
  client,
  deletePendingGameSummariesNotInGuilds,
  recoverActiveGames,
  registerGameVoiceChannels,
  registerIdleLobbyWatch,
  registerMemberNicknameSync,
  registerNightActionPromptDispatch,
  registerNightAreaDayRelease,
  registerPhaseChannelPermissions,
  registerRoleInfoRefreshDispatch,
  registerStartingRoleInfoDispatch,
  registerStorytellerDashboardRefresh,
  registerVotingPanelRefresh,
  sendMissingFirstJoinSetupNotices,
  sendStartupUpdateNotices
}) {
  return async () => {
    logStartupStep(`Logged in as ${client.user.tag}`)
    logStartupStep('Registering runtime event handlers...')

    registerMemberNicknameSync()
    registerPhaseChannelPermissions()
    registerNightAreaDayRelease()
    registerGameVoiceChannels()
    registerIdleLobbyWatch()
    registerStorytellerDashboardRefresh()
    registerVotingPanelRefresh()
    registerNightActionPromptDispatch()
    registerRoleInfoRefreshDispatch()
    registerStartingRoleInfoDispatch()

    logStartupStep('Recovering active games...')
    deletePendingGameSummariesNotInGuilds?.([...getCacheValues(client.guilds?.cache)].map(guild => guild.id))

    await recoverActiveGames(client).catch(err => {
      logError(console, '[BOTC][Startup] Active game recovery failed', err)
    })

    await sendMissingFirstJoinSetupNotices?.().catch(err => {
      logError(console, '[BOTC][Startup] First-join setup notice delivery failed', err)
    })

    await sendStartupUpdateNotices?.().catch(err => {
      logError(console, '[BOTC][Startup] Update notice delivery failed', err)
    })

    logStartupStep('Startup recovery complete.')
  }
}

function createGuildDeleteHandler({
  deletePendingGameSummary
}) {
  return async guild => {
    const deleted = deletePendingGameSummary?.(guild.id)
    if (deleted) {
      log.info('guild-delete-pending-summary-cleaned', 'Removed pending game-log summary for departed guild.', {
        guildId: guild.id,
        guildName: guild.name
      })
    }
  }
}

function createGuildCreateHandler({
  client,
  ensureConfiguredGuildReady,
  isSetupComplete,
  saveServerConfigs,
  serverConfigs
}) {
  return async guild => {
    logStartupStep(`Joined new guild: ${guild.name} (${guild.id})`)
    const serverConfig = serverConfigs.get(guild.id)
    if (isSetupComplete(serverConfig)) {
      await ensureConfiguredGuildReady(client, guild, serverConfig).catch(err => {
        logError(console, `[BOTC][GuildCreate] Setup readiness failed for ${guild.id}`, err)
      })
    }

    const notice = await sendFirstJoinSetupNoticeOnce(guild, {
      allowSetupComplete: true,
      force: true,
      isSetupComplete,
      saveServerConfigs,
      serverConfigs
    })
    if (!notice.ok) {
      log.warn('first-join-setup-notice-skipped', notice.reason, {
        guildId: guild.id,
        guildName: guild.name
      })
    }
  }
}

async function sendMissingFirstJoinSetupNotices({ client, isSetupComplete, saveServerConfigs, serverConfigs }) {
  let sent = 0
  let skipped = 0

  for (const guild of getCacheValues(client.guilds?.cache)) {
    const notice = await sendFirstJoinSetupNoticeOnce(guild, {
      isSetupComplete,
      saveServerConfigs,
      serverConfigs
    })
    if (notice.ok) {
      sent += 1
      continue
    }
    skipped += 1
    if (!['already-sent', 'setup-complete'].includes(notice.reason)) {
      log.warn('startup-first-join-setup-notice-skipped', notice.reason, {
        guildId: guild.id,
        guildName: guild.name
      })
    }
  }

  return { sent, skipped }
}

async function sendFirstJoinSetupNoticeOnce(guild, { allowSetupComplete = false, force = false, isSetupComplete, saveServerConfigs, serverConfigs }) {
  const serverConfig = serverConfigs.get(guild.id)
  if (!allowSetupComplete && isSetupComplete(serverConfig)) return { ok: false, reason: 'setup-complete' }
  if (!force && serverConfig?.firstJoinSetupNoticeSentAt) return { ok: false, reason: 'already-sent' }

  const notice = await sendFirstJoinSetupNotice(guild)
  if (!notice.ok) return notice

  serverConfigs.set(guild.id, {
    ...serverConfig,
    botUpdateChannelId: shouldPersistNoticeChannel(notice)
      ? notice.channel.id
      : serverConfig?.botUpdateChannelId || null,
    firstJoinSetupNoticeSentAt: new Date().toISOString()
  })
  saveServerConfigs(serverConfigs)
  return notice
}

function shouldPersistNoticeChannel(notice) {
  return [BOT_UPDATE_CHANNEL_SOURCE, 'created', 'configured'].includes(notice?.channelSource)
}

module.exports = {
  createClientReadyHandler,
  createGuildCreateHandler,
  createGuildDeleteHandler,
  sendFirstJoinSetupNoticeOnce,
  sendMissingFirstJoinSetupNotices
}
