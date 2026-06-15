const { EmbedBuilder } = require('discord.js')

function createLiveGamesEmbed(gameLifecycle, guildId) {
  const views = getActiveGameViews(gameLifecycle, guildId)

  return new EmbedBuilder()
    .setTitle(`Current Games (${views.length})`)
    .setDescription(createLiveGamesDescription(views))
    .setColor(0x3498db)
    .setTimestamp()
}

function getActiveGameViews(gameLifecycle, guildId) {
  const view = gameLifecycle.getGameView(guildId)
  if (!view || view.state === 'ended') return []
  return [view]
}

function createLiveGamesDescription(views) {
  if (!views.length) {
    return [
      'No game is currently open in this server.',
      '',
      'Use **Create** to open a lobby, then use **Join**, **Spectate**, or **Help** from the game panel.'
    ].join('\n')
  }

  return views.map(formatGameSummary).join('\n\n')
}

function formatGameSummary(view, index = 0) {
  return [
    `**Game ${index + 1}: ${view.script || 'Unknown Script'}**`,
    `State: ${formatState(view.state)} • Phase: ${view.phaseLabel || 'Not started'}`,
    `Players: ${view.counts?.players || 0}/${view.maxPlayers || '?'}`,
    `Alive: ${view.counts?.alive || 0} • Dead: ${view.counts?.dead || 0} • Spectators: ${view.counts?.spectators || 0}`,
    `Storyteller: ${view.storytellerId ? `<@${view.storytellerId}>` : 'None yet'}`
  ].join('\n')
}

function formatState(state) {
  return String(state || 'unknown')
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

module.exports = {
  createLiveGamesDescription,
  createLiveGamesEmbed,
  formatGameSummary,
  getActiveGameViews
}
