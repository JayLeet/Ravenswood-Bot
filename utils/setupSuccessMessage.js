function createSetupSuccessMessage(setupResult, channels) {
  const prepared = [
    setupResult.autoCreated ? '- Ravenswood Bluff setup channels were created or reused.' : null,
    setupResult.privateAccess && setupResult.botcAccessRole
      ? `- ${setupResult.botcAccessRole} is ready for private BOTC access.`
      : null,
    setupResult.sharedVoiceChannels ? '- Shared game voice channels were prepared.' : null,
    setupResult.sharedVoiceChannels?.waitingRoomVoiceChannel
      ? `- Waiting Room voice is ready at <#${setupResult.sharedVoiceChannels.waitingRoomVoiceChannel.id}>.`
      : null,
    setupResult.cottageCategory ? `- Reserved cottage channels were prepared in ${setupResult.cottageCategory.name}.` : null
  ].filter(Boolean)

  return [
    'Setup is ready. You can create a game from the game panel.',
    prepared.length ? `\n**Prepared**\n${prepared.join('\n')}` : null,
    [
      '\n**Where things are**',
      `- Game panel: <#${channels.gameChannel.id}>`,
      `- Player grimoires: <#${channels.playerGrimoireChannel.id}>`,
      `- Game-log archive: <#${channels.gameLogChannel.id}>`,
      `- Live announcements: <#${channels.liveChannel.id}>`,
      `- Post-game reveals: <#${channels.postGameChannel.id}>`,
      `- Spectator info: <#${channels.spectatorChannel.id}>`,
      `- Storyteller commands: <#${channels.storytellerChannel.id}>`
    ].join('\n')
  ].filter(Boolean).join('\n') +
    formatSetupWarnings(setupResult.warnings)
}

function formatSetupWarnings(warnings = []) {
  if (!warnings.length) return ''
  return '\n\nSetup warning:\n' + warnings.map(warning => `- ${warning}`).join('\n')
}

module.exports = {
  createSetupSuccessMessage
}
