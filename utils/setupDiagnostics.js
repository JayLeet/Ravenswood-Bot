const CONFIG_CHANNELS = Object.freeze([
  ['Game panel channel', 'gameChannelId'],
  ['Game-log archive channel', 'gameLogChannelId'],
  ['Live announcements channel', 'liveChannelId'],
  ['Player grimoire channel', 'playerGrimoireChannelId'],
  ['Post-game reveal channel', 'postGameChannelId'],
  ['Spectator info channel', 'spectatorChannelId'],
  ['Storyteller channel', 'storytellerChannelId']
])

function formatSetupCheckReport(report) {
  const lines = [
    '**Setup readiness**',
    '',
    'This checks whether I have the Discord permissions needed to run `/setup` or `/setup-channels`.'
  ]

  lines.push(formatCheck(
    'Setup permissions',
    !report.missingPermissions?.length,
    formatPermissionIssue(report.missingPermissions)
  ))

  if (report.ok) {
    lines.push('', 'Everything looks ready to choose setup.')
  } else {
    lines.push('', 'Fix the failed checks above, then run `/setup-check` again.')
  }

  return lines.join('\n')
}

function formatCheck(label, ok, failure) {
  return `${ok ? '✅' : '❌'} **${label}:** ${ok ? 'OK' : failure}`
}

function formatPermissionIssue(missing = []) {
  if (!missing.length) return 'OK'
  return `Missing: ${missing.join(', ')}`
}

function getConfiguredChannelEntries(serverConfig, channelsByKey = {}) {
  return CONFIG_CHANNELS.map(([label, key]) => ({
    label,
    key,
    id: serverConfig?.[key] || null,
    channel: channelsByKey[key] || null
  }))
}

function isSetupReportOk(report) {
  return !(report.missingPermissions || []).length
}

module.exports = {
  CONFIG_CHANNELS,
  formatSetupCheckReport,
  getConfiguredChannelEntries,
  isSetupReportOk
}
