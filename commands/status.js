const { wrapCommand } = require('../utils/commandWrapper')

module.exports = {
  name: 'status',
  description: 'Show the active game status.',
  options: [],
  data: {
    name: 'status',
    description: 'Show the active game status.',
    options: []
  },

  execute: wrapCommand(async (interaction, { gameLifecycle }) => {
    const view = gameLifecycle.getGameView(interaction.guild.id)

    if (!view) {
      return {
        ok: false,
        error: { message: 'No active game' }
      }
    }

    return {
      ok: true,
      message:
        `State: ${view.state}\n` +
        `Script: ${view.script}\n` +
        `Day: ${view.day}\n` +
        `Phase: ${view.phaseLabel}\n` +
        `Players: ${view.counts.players}\n` +
        `Alive: ${view.counts.alive}\n` +
        `Dead: ${view.counts.dead}\n` +
        `Dead votes: ${formatDeadVotes(view)}\n` +
        `Spectators: ${view.counts.spectators}\n` +
        `Nominations: ${view.counts.nominations}\n` +
        `Active vote: ${formatActiveVote(view)}\n` +
        `Open night actions: ${view.engine.nightActionCounts?.unresolved || 0}\n` +
        `Executed: ${view.engine.executedPlayer ? `<@${view.engine.executedPlayer}>` : 'None'}`
    }
  })
}

function formatDeadVotes(view) {
  const entries = Object.entries(view.engine.deadVotes || {})
  if (!entries.length) return 'None'

  const available = entries.filter(([, available]) => available).length
  return `${available}/${entries.length} available`
}

function formatActiveVote(view) {
  const nomination = view.engine.activeNomination
  if (!nomination) return 'None'

  if (nomination.status === 'voting') {
    return `<@${nomination.nomineeId}> (${nomination.yesVotes}/${nomination.threshold})`
  }

  if (nomination.status === 'pending_second') return `<@${nomination.nomineeId}> waiting for second`
  if (nomination.status === 'seconded') return `<@${nomination.nomineeId}> seconded`

  return `<@${nomination.nomineeId}>`
}
