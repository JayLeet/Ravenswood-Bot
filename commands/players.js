const { wrapCommand } = require('../utils/commandWrapper')

function label(view, userId) {
  if (!userId) return 'None'
  return view.users.displayNames?.[userId] || `<@${userId}>`
}

function mentionList(view, userIds) {
  if (!userIds.length) return 'None'
  return userIds.map(userId => label(view, userId)).join(', ')
}

function deadVoteList(view) {
  const deadPlayers = view.users.deadPlayers || []
  if (!deadPlayers.length) return 'None'

  return deadPlayers
    .map(userId => `${label(view, userId)}: ${view.engine.deadVotes?.[userId] === false ? 'spent' : 'available'}`)
    .join(', ')
}

module.exports = {
  name: 'players',
  description: 'Show players, spectators, and the Storyteller.',
  options: [],
  data: {
    name: 'players',
    description: 'Show players, spectators, and the Storyteller.',
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
        `Players: ${mentionList(view, view.users.players)}\n` +
        `Alive: ${mentionList(view, view.users.alivePlayers)}\n` +
        `Dead: ${mentionList(view, view.users.deadPlayers)}\n` +
        `Dead votes: ${deadVoteList(view)}\n` +
        `Spectators: ${mentionList(view, view.users.spectators)}\n` +
        `Storyteller: ${label(view, view.users.storyteller)}`
    }
  })
}
