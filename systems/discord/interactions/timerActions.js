const {
  MAX_GONG_TIMER_MS,
  formatTimerRemaining,
  startGongTimer
} = require('./gongTimer')
const {
  queuedChannelSend
} = require('../../../utils/discord/messageActions')
const {
  fetchWithRecoverableFallback
} = require('../../../utils/discord/recoverableFetch')
const {
  createBotLogger
} = require('../../../utils/logger')

const MAX_TIMER_MINUTES = MAX_GONG_TIMER_MS / 60000
const log = createBotLogger({ subsystem: 'TimerActions' })

async function startStorytellerTimer({ interaction, gameLifecycle, minutes, serverConfig }) {
  const game = gameLifecycle.get(interaction.guild.id)
  if (!game) return failure('No game exists yet.', 'Use `/create-game` first.')

  if (!gameLifecycle.isStoryteller(game, interaction.member.id)) {
    return failure('Only the Storyteller can start the timer.', 'Ask the Storyteller to use `/timer`.')
  }

  if (game.state !== 'in-game') {
    return failure('The timer is only available during a running game.', 'Start the game first, then try again.')
  }

  const duration = parseTimerMinutes(minutes)
  if (!duration.ok) return duration

  const liveChannelId = serverConfig?.liveChannelId
  const liveChannel = liveChannelId
    ? await fetchWithRecoverableFallback({
      action: 'fetch-timer-live-channel',
      context: {
        channelId: liveChannelId,
        guildId: interaction.guild.id
      },
      fetch: () => interaction.client.channels.fetch(liveChannelId),
      logger: log
    })
    : null

  if (!liveChannel?.isTextBased?.()) {
    return failure('I could not find the live game chat.', 'Run `/setup` again or check `/setup-channels`.')
  }

  const gongMode = game.phase === 'day'
  const result = await startGongTimer({
    client: interaction.client,
    completeDescription: gongMode
      ? undefined
      : 'Time is up. The Storyteller and players are being pinged now.',
    completeFn: gongMode ? undefined : state => sendTimerFinishedPing(state, interaction, gameLifecycle),
    completeTitle: gongMode ? undefined : 'Timer Complete',
    durationMs: duration.durationMs,
    getGame: () => gameLifecycle.get(interaction.guild.id),
    guildId: interaction.guild.id,
    liveChannel,
    timerTitle: gongMode ? undefined : 'Timer',
    trackMessage: message => gameLifecycle.trackMessage?.(interaction.guild.id, message)
  })

  if (!result.ok) return result

  return {
    ok: true,
    message: `Started a ${formatTimerRemaining(duration.durationMs)} ${gongMode ? 'Gong timer' : 'timer'} in <#${liveChannel.id}>.`
  }
}

async function sendTimerFinishedPing(state, interaction, gameLifecycle) {
  const game = gameLifecycle.get(interaction.guild.id)
  if (!game) return null

  const playerRole = findPlayerRole(interaction.guild, gameLifecycle)
  const playerMention = playerRole ? `<@&${playerRole.id}>` : 'Players'
  return queuedChannelSend(state.liveChannel, {
    content: `<@${game.storytellerId}> ${playerMention} the timer has ended.`,
    allowedMentions: {
      roles: playerRole ? [playerRole.id] : [],
      users: [game.storytellerId]
    }
  }).catch(err => {
    log.recoverable('send-timer-finished-ping', err, {
      channelId: state.liveChannel?.id,
      guildId: interaction.guild.id,
      playerRoleId: playerRole?.id,
      storytellerId: game.storytellerId
    })
    return null
  })
}

function findPlayerRole(guild, gameLifecycle) {
  const name = gameLifecycle.gameManager?.roleNames?.player || '👤 Player'
  return guild?.roles?.cache?.find?.(role => role.name === name) || null
}

function parseTimerMinutes(value) {
  const minutes = Number(value)
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_TIMER_MINUTES) {
    return failure(
      `Timer length must be from 1 to ${MAX_TIMER_MINUTES} minutes.`,
      `Use a whole number from 1 to ${MAX_TIMER_MINUTES}.`
    )
  }

  return { ok: true, minutes, durationMs: minutes * 60 * 1000 }
}

function failure(message, suggestion) {
  return {
    ok: false,
    error: { message, suggestion }
  }
}

module.exports = {
  MAX_TIMER_MINUTES,
  startStorytellerTimer
}
