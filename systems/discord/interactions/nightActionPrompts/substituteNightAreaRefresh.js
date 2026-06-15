const { queuedVoiceMove } = require('../../../../utils/discord/voiceActions')
const {
  sendSubstituteBriefing
} = require('./substituteBriefing')
const {
  createBotLogger
} = require('../../../../utils/logger')

const log = createBotLogger({ subsystem: 'SubstituteNightAreaRefresh' })

async function refreshSubstituteNightArea({
  discordClient,
  ensurePlayerNightAreaForGuild,
  gameLifecycle,
  guildId,
  isSetupComplete,
  member,
  serverConfigs
}) {
  const serverConfig = serverConfigs.get(guildId)
  if (!isSetupComplete(serverConfig)) return null

  const game = gameLifecycle.get(guildId)
  const view = gameLifecycle.getGameView(guildId)
  if (!game || !view) return null

  const guild = await getGuild(discordClient, guildId)
  if (!guild) return null

  const area = await ensurePlayerNightAreaForGuild(discordClient, guild, serverConfig, game, view, member)
  await sendSubstituteBriefing({ channel: area?.textChannel, game, gameLifecycle, member })
  await moveConnectedSubstituteToCottage(member, area?.voiceChannel)
  return area
}

async function getGuild(discordClient, guildId) {
  return discordClient.guilds.cache.get(guildId) ||
    await discordClient.guilds.fetch(guildId).catch(err => {
      log.recoverable('fetch-substitute-night-area-guild', err, { guildId })
      return null
    })
}

async function moveConnectedSubstituteToCottage(member, voiceChannel) {
  if (!member?.voice?.channelId || !voiceChannel) return null
  return queuedVoiceMove(member, voiceChannel).catch(err => {
    log.recoverable('move-substitute-to-night-cottage', err, {
      guildId: member.guild?.id,
      userId: member.id,
      channelId: voiceChannel.id
    })
    return null
  })
}

module.exports = {
  moveConnectedSubstituteToCottage,
  refreshSubstituteNightArea
}
