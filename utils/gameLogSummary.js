const { EmbedBuilder } = require('discord.js')

function createGameLogPayload(summary, savedById = null) {
  return {
    embeds: [
      new EmbedBuilder()
        .setTitle(`Game Log: ${summary.script || 'Blood on the Clocktower'}`)
        .setDescription(createSummaryDescription(summary, savedById))
        .addFields(createSummaryFields(summary))
        .setColor(summary.winner === 'evil' ? 0xe74c3c : 0x3498db)
        .setTimestamp(new Date(summary.endedAt || Date.now()))
    ]
  }
}

function createSummaryDescription(summary, savedById) {
  return [
    `Winner: ${formatWinner(summary.winner)}`,
    `Reason: ${summary.reason || 'No reason recorded'}`,
    `Storyteller: ${summary.storytellerId ? `<@${summary.storytellerId}>` : 'Unknown'}`,
    `Duration: ${formatDuration(summary.durationMs)}`,
    savedById ? `Saved by: <@${savedById}>` : null
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
  return fields
}

function formatPlayers(summary) {
  const alive = new Set(summary.alivePlayers || [])
  const dead = new Set(summary.deadPlayers || [])
  return (summary.players || [])
    .map(playerId => {
      const role = summary.roles?.[playerId] || 'unassigned'
      const state = dead.has(playerId) ? 'dead' : alive.has(playerId) ? 'alive' : 'unknown'
      return `<@${playerId}> - ${formatRole(role)} - ${state}`
    })
    .join('\n') || 'No players recorded.'
}

function formatNominations(summary) {
  const nominations = summary.nominations || []
  if (!nominations.length) return 'No nominations recorded.'
  return nominations.map(nomination => {
    const count = nomination.yesVotes ?? 0
    const threshold = nomination.threshold ?? '?'
    const nominator = nomination.nominatorId ? `<@${nomination.nominatorId}>` : 'Storyteller'
    return `${nominator} nominated <@${nomination.nomineeId}> (${count}/${threshold}) - ${nomination.result || nomination.status}`
  }).join('\n')
}

function formatExecutions(summary) {
  const executions = summary.executionHistory || []
  if (!executions.length) return 'No executions recorded.'
  return executions.map(execution => {
    const outcome = execution.executed ? 'executed' : `survived${execution.preventedBy ? ` by ${execution.preventedBy}` : ''}`
    return `Day ${execution.day || '?'}: <@${execution.playerId}> ${outcome}`
  }).join('\n')
}

function formatReminders(summary) {
  const reminders = summary.reminders || []
  if (!reminders.length) return null
  return reminders
    .map(reminder => `<@${reminder.playerId}> - ${reminder.type || reminder.label || 'reminder'}`)
    .join('\n')
}

function chunkField(name, text) {
  const chunks = []
  let remaining = text || 'None'
  while (remaining.length > 1024) {
    chunks.push({ name, value: remaining.slice(0, 1021) + '...' })
    remaining = remaining.slice(1021)
    name = `${name} continued`
  }
  chunks.push({ name, value: remaining || 'None' })
  return chunks
}

function formatWinner(winner) {
  if (winner === 'good') return 'Good'
  if (winner === 'evil') return 'Evil'
  return winner || 'None'
}

function formatRole(roleId) {
  return `The ${String(roleId).replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase())}`
}

function formatDuration(durationMs) {
  if (!durationMs) return 'Unknown'
  const minutes = Math.max(1, Math.round(durationMs / 60000))
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

module.exports = {
  createGameLogPayload
}
