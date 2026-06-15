function getFailureSuggestion({ interaction, ctx = {}, error = {}, commandName = null }) {
  const message = String(error.message || '')
  const command = commandName || interaction.commandName
  const role = getCurrentRole(interaction, ctx)
  const hasGame = !!getCurrentGame(interaction, ctx)

  if (error.warning) return createFailureDetail(error.warning, 'warning')
  if (error.meta?.warning) return createFailureDetail(error.meta.warning, 'warning')
  if (error.suggestion) return normalizeFailureDetail(error.suggestion)
  if (error.meta?.suggestion) return normalizeFailureDetail(error.meta.suggestion)

  if (message.includes('No game') || message.includes('No active game')) {
    return 'Try `/create-game`, or use the Create button in the game panel.'
  }

  if (message.includes('Game exists')) {
    return 'Try `/join` to play, `/spectate` to watch, or `/status` to see what is already running.'
  }

  if (message.includes('Already in game') || message.includes('User is already in game')) {
    return getAlreadyInGameSuggestion(role, command)
  }

  if (message.includes('Not in game')) {
    return 'Try `/join` to play, `/spectate` to watch, or `/status` to inspect the current game.'
  }

  if (message.includes('Game full')) {
    return 'Try `/spectate`; non-participants can spectate even when the player list is full.'
  }

  if (message.includes('pending request')) {
    return command === 'requests'
      ? 'Use `/approve request-id:<id>` or `/reject request-id:<id>` once a request appears.'
      : 'Use `/requests` in the Storyteller channel to see the current request IDs.'
  }

  if (message.includes('Pending request not found')) {
    return 'Run `/requests` again and copy the current request ID.'
  }

  if (message.includes('Not storyteller') || message.includes('Only Storyteller')) {
    return getStorytellerSuggestion(command, hasGame)
  }

  if (message.includes('A Storyteller is already assigned')) {
    return 'Use `/players` to see who the current Storyteller is.'
  }

  if (message.includes('Already storyteller')) {
    return 'Try `/start` if the game is still in the lobby, or `/next-phase` if it is already live.'
  }

  if (message.includes('Active players cannot become Storyteller')) {
    return 'Ask a spectator or non-participant to run `/become-storyteller`, or ask an admin to use `/admin kick` if needed.'
  }

  if (message.includes('Game is already in progress')) {
    return 'Try `/next-phase` to advance the live game, or `/status` to check the current phase.'
  }

  if (message.includes('Add at least one player before starting')) {
    return 'Have players use `/join`, or press Join in the game panel before the Storyteller starts.'
  }

  if (message.includes('Game is not in progress')) {
    return 'Try `/start` first once the lobby is ready.'
  }

  if (message.includes('Private voice chat is only available during the day')) {
    return 'Wait until the day phase, then use `/voicechat player:<player>` again.'
  }

  if (message.includes('Only players can use private voice chat')) {
    return 'Use `/join` to play in the current game, or `/spectate` if you only want to watch.'
  }

  if (message.includes('Use this command inside a private voice room')) {
    return 'Use `/voicechat player:<player>` first, then run `/invite` from the private room it opens.'
  }

  if (message.includes('I could not privately message that player')) {
    return 'Ask that player to allow direct messages from this server, then send the request again.'
  }

  if (message.includes('No next phase')) {
    return 'Try `/status` to check the current phase, then use `/start` if the game has not begun.'
  }

  if (message.includes('Requested user is no longer in this server')) {
    return 'Run `/requests` to refresh the queue, then reject any stale request IDs.'
  }

  if (message.includes('Requested member does not match request')) {
    return 'Run `/requests` again and approve the exact request ID shown there.'
  }

  if (message.includes('User not found in this server')) {
    return 'Choose a current server member, or use `/players` to confirm who is in the game.'
  }

  if (message.includes('That user is not in the active game')) {
    return 'Use `/players` first, then choose someone listed as a player, spectator, or Storyteller.'
  }

  if (message.includes('Administrator permission')) {
    return 'Ask a server admin or the bot owner access user to run this, or use a regular player command like `/status` or `/help`.'
  }

  if (message.includes('Manage Server permission')) {
    return 'Ask someone with Manage Server permission to run `/setup`.'
  }

  if (message.includes('I need a little more room')) {
    return 'Ask an admin to grant the listed permissions, then rerun `/setup` if needed.'
  }

  if (message.includes('Move my bot role')) {
    return 'Move the bot role above the game roles in Discord, then rerun `/setup`.'
  }

  if (message.includes('four different channels')) {
    return 'Pick separate channels for the game panel, live info, spectator info, and Storyteller info.'
  }

  if (message.includes('must be a text channel')) {
    return 'Choose regular text or announcement channels when running `/setup`.'
  }

  if (message.includes('Could not') || message.includes('I could not')) {
    return 'Ask an admin to check bot permissions and role order, then rerun `/setup` if needed.'
  }

  if (!hasGame && command !== 'setup') {
    return 'Try `/create-game`, or press Create in the game panel.'
  }

  return getCommandFallbackSuggestion(command)
}

function formatFailureMessage(message, detail) {
  if (!detail) return message
  const { label, text } = normalizeFailureDetail(detail)
  return `${message}\n\n${label}: ${text}`
}

function normalizeFailureDetail(detail) {
  if (!detail || typeof detail !== 'object') {
    const text = String(detail || '')
    return createFailureDetail(text, getFailureDetailKind(text))
  }

  const text = String(detail.text || detail.message || detail.value || '')
  if (detail.label) return { label: String(detail.label), text }

  const kind = detail.kind || detail.type || getFailureDetailKind(text)
  return createFailureDetail(text, kind)
}

function createFailureDetail(text, kind = 'suggestion') {
  return {
    label: getFailureDetailLabel(kind, text),
    text: String(text || '')
  }
}

function getFailureDetailLabel(kind, text = '') {
  if (kind === 'warning') return 'Warning'
  if (kind === 'note') return 'Note'
  if (kind === 'hint') return 'Suggested next step'
  if (kind === 'suggestion') return isInstructionLike(text) ? 'Suggested next step' : 'Note'
  return isInstructionLike(text) ? 'Suggested next step' : 'Note'
}

function getFailureDetailKind(text = '') {
  const value = String(text || '').trim()
  if (/^(warning|caution|important|heads up)[:.!\s]/i.test(value)) return 'warning'
  if (/^(⚠️|🚨|❗)/u.test(value)) return 'warning'
  return isInstructionLike(value) ? 'suggestion' : 'note'
}

function isInstructionLike(text = '') {
  return /^(ask|choose|check|copy|grant|have|move|pick|press|refresh|rerun|run|select|try|use|wait)\b/i
    .test(String(text || '').trim())
}

function getCurrentGame(interaction, ctx) {
  if (!interaction.guild?.id || !ctx.gameLifecycle?.get) return null
  return ctx.gameLifecycle.get(interaction.guild.id)
}

function getCurrentRole(interaction, ctx) {
  const game = getCurrentGame(interaction, ctx)
  if (!game || !ctx.gameLifecycle?.getRole || !interaction.member?.id) return null
  return ctx.gameLifecycle.getRole(game, interaction.member.id)
}

function getAlreadyInGameSuggestion(role, command) {
  if (role === 'player') {
    return command === 'create-game'
      ? 'You are already a player in the existing game. Try `/status`, or `/leave` if you need to step out.'
      : 'Try `/leave` if you need to step out, or `/status` to check the game.'
  }

  if (role === 'spectator') {
    return 'You are already spectating. Use `/leave` first if you want to switch roles.'
  }

  if (role === 'storyteller') {
    return 'You are the Storyteller. Try `/start`, `/next-phase`, `/requests`, or `/end-game`.'
  }

  return 'Try `/status` or `/players` to check your current place in the game.'
}

function getStorytellerSuggestion(command, hasGame) {
  if (!hasGame) return 'Try `/create-game` first so there is a Storyteller.'

  if (command === 'become-storyteller') {
    return 'Use `/players` to see the current Storyteller, or wait until that seat is empty.'
  }

  return 'Ask the current Storyteller to run this, or use `/players` to see who that is.'
}

function getCommandFallbackSuggestion(command) {
  const suggestions = {
    admin: 'Try `/admin kick user:<user>` for removals or `/admin end-game` to force-end the game.',
    approve: 'Try `/requests` in the Storyteller channel, then approve one of the listed request IDs.',
    reject: 'Try `/requests` in the Storyteller channel, then reject one of the listed request IDs.',
    requests: 'Try `/players` or `/status` if you only need current game info.',
    setup: 'Use four different text channels for `/setup`, then use the game panel it posts.',
    start: 'Try `/players` to confirm the lobby, then have the Storyteller run `/start`.',
    'next-phase': 'Try `/status` to confirm the game is live and check the current phase.',
    'end-game': 'Ask the Storyteller to run `/end-game`, or an admin can use `/admin end-game`.',
    join: 'Try `/spectate` if you only want to watch.',
    invite: 'Use `/voicechat player:<player>` first, then invite more players from that private room.',
    spectate: 'Try `/join` if you want to play instead.',
    leave: 'Try `/status` or `/players` to check whether you are currently in the game.',
    players: 'Try `/create-game` if no game exists yet.',
    status: 'Try `/create-game` if no game exists yet.',
    'become-storyteller': 'Try `/players` to see whether a Storyteller is already assigned.',
    'create-game': 'Try `/join` to play in the existing game, or `/spectate` to watch.',
    voicechat: 'Try `/status` to confirm it is day, then choose a current player.'
  }

  return suggestions[command] || 'Try `/help` to see the available commands.'
}

module.exports = {
  createFailureDetail,
  formatFailureMessage,
  getFailureSuggestion,
  isInstructionLike,
  normalizeFailureDetail
}
