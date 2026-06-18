const {
  GAME_LOG_SAVE_MODES,
  normalizeGameLogSaveMode
} = require('./gameLogSaveMode')
const {
  createGameLogDecisionRows
} = require('./gameLogDecisions')
const {
  saveGameLogSummary
} = require('./gameLogArchive')
const {
  queuedChannelSend
} = require('./discord/messageActions')
const {
  EmbedBuilder
} = require('discord.js')
const { createBotLogger } = require('./logger')

const MANUAL_GAME_LOG_PROMPT_DELAY_MS = 60 * 1000
const scheduledManualGameLogPrompts = new Set()
const log = createBotLogger({ subsystem: 'GameLogEndResult' })

async function createEndGameLogComponents({
  client,
  deletePendingGameSummary = null,
  guildId,
  manualPromptDelayMs = MANUAL_GAME_LOG_PROMPT_DELAY_MS,
  result,
  serverConfig = null,
  serverConfigs
}) {
  const summary = result?.pendingSummary
  if (!summary?.id) return []

  const config = {
    ...(serverConfig || {}),
    ...(serverConfigs?.get?.(guildId) || {})
  }
  const saveMode = normalizeGameLogSaveMode(config.gameLogSaveMode, GAME_LOG_SAVE_MODES.manual)
  if (saveMode !== GAME_LOG_SAVE_MODES.auto) {
    await scheduleManualGameLogPrompt({ client, config, guildId, manualPromptDelayMs, summary })
    return []
  }

  const saved = await saveGameLogSummary({
    client,
    guildId,
    savedById: null,
    serverConfigs,
    summary
  })
  if (!saved.ok) {
    await scheduleManualGameLogPrompt({ client, config, guildId, manualPromptDelayMs, summary })
    return []
  }

  deletePendingGameSummary?.(guildId)
  return []
}

async function scheduleManualGameLogPrompt({ client, config, guildId, manualPromptDelayMs, summary }) {
  if (!summary?.id || !config?.postGameChannelId) return false
  const key = `${guildId}:${summary.id}`
  if (scheduledManualGameLogPrompts.has(key)) return false

  scheduledManualGameLogPrompts.add(key)
  const send = () => sendManualGameLogPrompt({ client, config, guildId, key, summary })
  if (manualPromptDelayMs <= 0) {
    return send()
  }

  const timer = setTimeout(send, manualPromptDelayMs)
  timer.unref?.()
  return true
}

async function sendManualGameLogPrompt({ client, config, guildId, key, summary }) {
  try {
    const channel = await client?.channels?.fetch?.(config.postGameChannelId).catch(err => {
      log.recoverable('fetch-delayed-game-log-channel', err, {
        channelId: config.postGameChannelId,
        guildId,
        summaryId: summary.id
      })
      return null
    })
    if (!channel?.isTextBased?.()) return null
    return queuedChannelSend(channel, {
      embeds: [
        new EmbedBuilder()
          .setTitle('Game history ready')
          .setDescription('The game is over. Save or discard this game history here.')
          .setColor(0x3498db)
      ],
      components: createGameLogDecisionRows(summary.id)
    }).catch(err => {
      log.recoverable('send-delayed-game-log-prompt', err, {
        channelId: channel.id,
        guildId,
        summaryId: summary.id
      })
      return null
    })
  } finally {
    scheduledManualGameLogPrompts.delete(key)
  }
}

module.exports = {
  MANUAL_GAME_LOG_PROMPT_DELAY_MS,
  createEndGameLogComponents
}
