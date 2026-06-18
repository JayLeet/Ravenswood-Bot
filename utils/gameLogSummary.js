const {
  AttachmentBuilder,
  EmbedBuilder
} = require('discord.js')
const {
  formatDuration,
  formatPlainText,
  formatPlainUser,
  formatReadableTimestamp,
  withGameLogDisplayNames
} = require('./gameLogTextFormat')
const { formatModerationDetails } = require('./gameLogModerationDetails')
const { formatChatLog } = require('./gameLogChatText')
const { formatVotes } = require('./gameLogVotes')

function createGameLogPayload(summary, savedById = null, options = {}) {
  return {
    embeds: [
      new EmbedBuilder()
        .setTitle(`Game Log: ${summary.script || 'Blood on the Clocktower'}`)
        .setDescription(createSummaryDescription(summary, savedById))
        .addFields(createSummaryFields(summary))
        .setColor(summary.winner === 'evil' ? 0xe74c3c : 0x3498db)
        .setTimestamp(new Date(summary.endedAt || Date.now()))
    ],
    files: [createGameLogTextAttachment(summary, savedById, options)]
  }
}

function createGameLogTextAttachment(summary, savedById = null, options = {}) {
  return new AttachmentBuilder(Buffer.from(createGameLogText(summary, savedById, options), 'utf8'), {
    name: createGameLogFileName(summary)
  })
}

function createSummaryDescription(summary, savedById) {
  return [
    `Winner: ${formatWinner(summary.winner)}`,
    `Reason: ${summary.reason || 'No reason recorded'}`,
    `Storyteller: ${formatUser(summary.storytellerId)}`,
    `Duration: ${formatDuration(summary.durationMs)}`,
    savedById ? `Saved by: ${formatUser(savedById)}` : null,
    'Full details are attached as a text file.'
  ].filter(Boolean).join('\n')
}

function createSummaryFields(summary) {
  const fields = [
    ...chunkField('Players', formatPlayers(summary)),
    ...chunkField('Nominations', formatNominations(summary)),
    ...chunkField('Executions', formatExecutions(summary))
  ]
  const reminders = formatReminders(summary)
  if (reminders) fields.push(...chunkField('Reminder Tokens', reminders))
  return fields.slice(0, 25)
}

function createGameLogText(summary, savedById = null, options = {}) {
  const textSummary = withGameLogDisplayNames(summary, savedById, options)
  return [
    createHeader(textSummary, savedById),
    createSection('Players', formatPlayers(textSummary, { plainText: true })),
    createSection('Chat log', formatChatLog(textSummary)),
    createSection('Role changes', formatRoleHistory(textSummary)),
    createSection('Nominations', formatNominations(textSummary, { plainText: true })),
    createSection('Votes', formatVotes(textSummary)),
    createSection('Executions', formatExecutions(textSummary, { plainText: true })),
    createSection('Night actions', formatNightActions(textSummary)),
    createSection('Reminder tokens', formatReminders(textSummary, { plainText: true }) || 'No reminder tokens recorded.'),
    createSection('Current effects', formatStatusEffects(textSummary)),
    createSection('Moderation details', formatModerationDetails(textSummary, savedById))
  ].filter(Boolean).join('\n\n')
}

function createHeader(summary, savedById) {
  return [
    `Script: ${summary.script || 'Blood on the Clocktower'}`,
    `Winner: ${formatWinner(summary.winner)}`,
    `Ended because: ${formatPlainText(summary, summary.reason) || 'No reason recorded'}`,
    `Storyteller: ${formatPlainUser(summary, summary.storytellerId)}`,
    `Saved by: ${savedById ? formatPlainUser(summary, savedById) : 'automatic game-log save'}`,
    `Lobby opened: ${formatReadableTimestamp(summary.createdAt)}`,
    `Game started: ${formatReadableTimestamp(summary.startedAt)}`,
    `Game ended: ${formatReadableTimestamp(summary.endedAt)}`,
    `Length: ${formatDuration(summary.durationMs)}`,
    `Final day: ${summary.day || '?'}`
  ].join('\n')
}

function createSection(title, body) {
  return [`${title}`, '-'.repeat(title.length), body || 'None recorded.'].join('\n')
}

function formatPlayers(summary, options = {}) {
  const alive = new Set(summary.alivePlayers || [])
  const dead = new Set(summary.deadPlayers || [])
  const teamByRole = createTeamByRole(summary)
  const shownRoles = summary.shownRoles || {}
  const players = summary.players || []
  if (!players.length) return 'No players recorded.'

  return players.map((playerId, index) => {
    const role = summary.roles?.[playerId] || 'unassigned'
    const shownRole = shownRoles[playerId]
    const state = dead.has(playerId) ? 'dead' : alive.has(playerId) ? 'alive' : 'unknown'
    const team = teamByRole[role] || 'unknown'
    const roleText = shownRole
      ? `${formatRole(role)}, shown as ${formatRole(shownRole)}`
      : formatRole(role)
    return `${index + 1}. ${formatUserForMode(summary, playerId, options)} was ${formatRoleSentence(roleText, team)} and ended ${state}.`
  }).join('\n')
}

function formatRoleSentence(roleText, team) {
  const role = roleText === 'Unassigned' ? 'unassigned' : `the ${roleText}`
  return `${role} (${formatTeam(team)})`
}

function formatRoleHistory(summary) {
  const entries = Object.entries(summary.roleHistory || {})
  if (!entries.length) return 'No role changes recorded.'

  return entries.flatMap(([playerId, history]) =>
    (Array.isArray(history) ? history : []).map(entry => [
      formatPlainUser(summary, playerId),
      `used to be ${formatRole(entry.roleId)}`,
      entry.source ? `because of ${formatLabel(entry.source)}` : null,
      entry.changedAt ? `at ${formatTimestamp(entry.changedAt)}` : null
    ].filter(Boolean).join(' - '))
  ).join('\n') || 'No role changes recorded.'
}

function formatNominations(summary, options = {}) {
  const nominations = summary.nominations || []
  if (!nominations.length) return 'No nominations recorded.'
  return nominations.map(nomination => {
    const count = nomination.yesVotes ?? nomination.voteCount ?? 0
    const threshold = nomination.threshold ?? '?'
    const nominator = nomination.nominatorId ? formatUserForMode(summary, nomination.nominatorId, options) : 'Storyteller'
    const nominee = formatUserForMode(summary, nomination.nomineeId, options)
    const outcome = nomination.result || nomination.status || 'unknown'
    const day = nomination.day ? `Day ${nomination.day}: ` : ''
    return `${day}${nominator} nominated ${nominee}. Votes: ${count}/${threshold}. Result: ${formatLabel(outcome)}.`
  }).join('\n')
}

function formatExecutions(summary, options = {}) {
  const executions = summary.executionHistory || []
  if (!executions.length) return 'No executions recorded.'
  return executions.map(execution => {
    const outcome = execution.executed
      ? 'was executed'
      : `survived${execution.preventedBy ? ` because of ${formatLabel(execution.preventedBy)}` : ''}`
    return `Day ${execution.day || '?'}: ${formatUserForMode(summary, execution.playerId, options)} ${outcome}.`
  }).join('\n')
}

function formatNightActions(summary) {
  const actions = summary.nightActions || []
  if (!actions.length) return 'No night actions recorded.'
  return actions.map(action => {
    const actor = formatPlainUser(summary, action.playerId || action.actorId)
    const role = action.roleId ? ` as the ${formatRole(action.roleId)}` : ''
    const target = action.targetId ? ` and picked ${formatPlainUser(summary, action.targetId)}` : ''
    const detail = action.summary || action.result ? formatPlainText(summary, action.summary || action.result) : null
    const status = formatNightActionStatus(action.status)
    return [
      `Night ${action.night || action.day || '?'}: ${actor} acted${role}${target}.`,
      detail,
      status
    ].filter(Boolean).join(' ')
  }).join('\n')
}

function formatNightActionStatus(status) {
  if (!status || status === 'resolved') return null
  return `This action ended as ${formatLabel(status)}.`
}

function formatReminders(summary, options = {}) {
  const reminders = summary.reminders || []
  if (!reminders.length) return null
  return reminders
    .map(reminder => `${formatUserForMode(summary, reminder.playerId, options)} - ${formatLabel(reminder.type || reminder.label || 'reminder')}`)
    .join('\n')
}

function formatStatusEffects(summary) {
  const entries = Object.entries(summary.statusEffects || {})
  if (!entries.length) return 'No status effects recorded.'
  return entries.map(([playerId, effects]) => {
    const active = Object.entries(effects || {})
      .filter(([, value]) => Boolean(value))
      .map(([key]) => formatLabel(key))
      .join(', ')
    return `${formatPlainUser(summary, playerId)} - ${active || 'none'}`
  }).join('\n')
}

function chunkField(name, text) {
  const chunks = []
  let remaining = text || 'None'
  while (remaining.length > 1024) {
    chunks.push({ name, value: `${remaining.slice(0, 1021)}...` })
    remaining = remaining.slice(1021)
    name = `${name} continued`
  }
  chunks.push({ name, value: remaining || 'None' })
  return chunks
}

function createTeamByRole(summary) {
  return Object.fromEntries(
    Object.entries(summary.roleCategories || {})
      .flatMap(([team, roleIds]) => (roleIds || []).map(roleId => [roleId, team]))
  )
}

function formatWinner(winner) {
  if (winner === 'good') return 'Good'
  if (winner === 'evil') return 'Evil'
  return winner || 'None'
}

function formatResult(winner) {
  return winner === 'good' || winner === 'evil' ? `${formatWinner(winner)} won` : formatWinner(winner)
}

function formatTeam(team) {
  if (team === 'townsfolk') return 'Townsfolk'
  if (team === 'outsider') return 'Outsider'
  if (team === 'minion') return 'Minion'
  if (team === 'demon') return 'Demon'
  return team || 'Unknown'
}

function formatRole(roleId) {
  if (!roleId) return 'Unassigned'
  return formatLabel(roleId)
}

function formatLabel(value) {
  return String(value || 'unknown').replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase())
}

function formatUserForMode(summary, userId, options = {}) {
  return options.plainText ? formatPlainUser(summary, userId) : formatUser(userId)
}

function formatUser(userId) {
  return userId ? `<@${userId}>` : 'Unknown'
}

function formatTimestamp(value) {
  const time = Number(value)
  if (!Number.isFinite(time) || time <= 0) return 'Unknown'
  return new Date(time).toISOString()
}

function createGameLogFileName(summary) {
  const stamp = formatTimestamp(summary.endedAt || Date.now()).slice(0, 10)
  const script = String(summary.script || 'botc-game')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'botc-game'
  return `${stamp}-${script}-game-log.txt`
}

module.exports = {
  createGameLogPayload,
  createGameLogText
}
