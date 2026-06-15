function createSetupSuccessMessage(setupResult, channels) {
  const createdMessage = setupResult.autoCreated ? 'Created or reused the Ravenswood Bluff category and BOTC-flavored channels.\n' : ''
  const privateMessage = setupResult.privateAccess && setupResult.botcAccessRole
    ? `Created or reused ${setupResult.botcAccessRole} for private BOTC access.\n`
    : ''
  const voiceMessage = setupResult.sharedVoiceChannels ? 'Shared game voice channels were prepared.\n' : ''
  const waitingRoomMessage = setupResult.sharedVoiceChannels?.waitingRoomVoiceChannel
    ? `Waiting Room voice is ready at <#${setupResult.sharedVoiceChannels.waitingRoomVoiceChannel.id}>.\n`
    : ''
  const cottageMessage = setupResult.cottageCategory ? `Reserved cottage channels were prepared in ${setupResult.cottageCategory.name}.\n` : ''

  return createdMessage +
    privateMessage +
    voiceMessage +
    waitingRoomMessage +
    cottageMessage +
    `The game panel was posted in <#${channels.gameChannel.id}>.\n` +
    `Player grimoires can be opened in <#${channels.playerGrimoireChannel.id}>.\n` +
    `Saved game logs will post in <#${channels.gameLogChannel.id}>.\n` +
    `Live game announcements will post in <#${channels.liveChannel.id}>.\n` +
    `Post-game reveals will post in <#${channels.postGameChannel.id}>.\n` +
    `Spectator-facing info will post in <#${channels.spectatorChannel.id}>.\n` +
    `Storyteller command info belongs in <#${channels.storytellerChannel.id}>.` +
    formatSetupWarnings(setupResult.warnings)
}

function formatSetupWarnings(warnings = []) {
  if (!warnings.length) return ''
  return '\n\nSetup warning:\n' + warnings.map(warning => `- ${warning}`).join('\n')
}

module.exports = {
  createSetupSuccessMessage
}
