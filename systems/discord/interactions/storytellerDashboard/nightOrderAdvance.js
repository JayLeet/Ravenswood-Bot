const {
  queuedVoiceMove
} = require('../../../../utils/discord/voiceActions')
const {
  createNightWakeEntries
} = require('../../../../utils/storytellerDashboard/nightGuidance')
const {
  formatDashboardPlayer,
  isFakeDashboardPlayer
} = require('./fakePlayers')
const {
  fetchDashboardMember
} = require('./memberFetch')
const { createBotLogger } = require('../../../../utils/logger')

const log = createBotLogger({ subsystem: 'NightOrderAdvance' })

async function runNightOrderMove({ interaction, context, getDashboardPlayerLabels, services, state }) {
  const { entry, labels } = await getNightOrderEntry({
    context,
    getDashboardPlayerLabels,
    interaction,
    state
  })
  if (!entry) return { entry: null, labels }

  const voiceResult = await moveStorytellerToNightOrderCottage({
    interaction,
    context,
    entry,
    services
  })

  return {
    entry,
    labels,
    voiceResult
  }
}

async function getNightOrderEntry({ context, getDashboardPlayerLabels, interaction, state }) {
  const labels = await getDashboardPlayerLabels(interaction.client, interaction.guild.id, context.view)
  return {
    entry: createNightWakeEntries(context.view, labels)[state.index] || null,
    labels
  }
}

async function moveStorytellerToNightOrderCottage({ interaction, context, entry, services }) {
  if (isFakeDashboardPlayer(context, entry.playerId)) return { skipped: true, reason: 'fake-player' }
  const targetMember = await fetchDashboardMember(interaction, entry.playerId, 'fetch-night-order-move-member')
  if (!targetMember) return { skipped: true, reason: 'missing-member' }

  const channel = await services.ensurePlayerNightVoiceChannel?.(interaction, context, targetMember)
  if (!channel) return { skipped: true, reason: 'missing-channel' }

  const storytellerMember = await fetchDashboardMember(
    interaction,
    interaction.member.id,
    'fetch-night-order-storyteller-member',
    interaction.member
  )
  if (!storytellerMember?.voice?.channelId) return { skipped: true, reason: 'storyteller-not-in-voice' }

  const moved = await queuedVoiceMove(storytellerMember, channel)
    .then(() => true)
    .catch(err => { log.recoverable('move-storyteller-to-night-order-cottage', err, { channelId: channel.id, guildId: interaction.guild.id, playerId: entry.playerId, storytellerId: interaction.member.id }); return false })
  return moved
    ? { channelId: channel.id, skipped: false }
    : { skipped: true, reason: 'move-failed' }
}

function formatNightOrderMoveMessage(context, result) {
  if (!result?.entry) return 'No current Night Order player to move to.'
  const player = formatDashboardPlayer(context, result.entry.playerId)
  const voice = result.voiceResult?.skipped
    ? `Move skipped: ${result.voiceResult.reason}.`
    : `Moved to <#${result.voiceResult.channelId}>.`
  return `${player} is current. ${voice}`
}

module.exports = {
  formatNightOrderMoveMessage,
  getNightOrderEntry,
  moveStorytellerToNightOrderCottage,
  runNightOrderMove
}
