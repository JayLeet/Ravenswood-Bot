async function ensureStorytellerDashboardReady({
  interaction,
  serverConfigs,
  isSetupComplete,
  createSetupRequiredMessage,
  ensureConfiguredServerReady,
  gameLifecycle
}) {
  const serverConfig = serverConfigs.get(interaction.guild.id)

  if (!isSetupComplete(serverConfig)) {
    return {
      ok: false,
      title: 'Setup required',
      message: createSetupRequiredMessage(),
      suggestion: 'Ask an admin to run `/setup`, then use the Storyteller dashboard it posts.'
    }
  }

  if (!isAllowedDashboardChannel(interaction, serverConfig)) {
    return {
      ok: false,
      title: 'Wrong channel',
      message: `Use the Storyteller dashboard in <#${serverConfig.storytellerChannelId}>.`,
      suggestion: `Go to <#${serverConfig.storytellerChannelId}> and use the dashboard there.`
    }
  }

  const readiness = await ensureConfiguredServerReady(interaction, serverConfig)
  if (!readiness.ok) return readiness

  const game = gameLifecycle.get(interaction.guild.id)
  if (!game) {
    return {
      ok: false,
      title: 'No game',
      message: 'There is no active game to control.',
      suggestion: 'Use the game panel Create button to open a new lobby.'
    }
  }

  if (!gameLifecycle.isStoryteller(game, interaction.member.id)) {
    return {
      ok: false,
      title: 'Storyteller only',
      message: 'Only the current Storyteller can use this dashboard.',
      suggestion: 'Use `/spectate` to watch, or `/join` if you want to play.'
    }
  }

  return {
    ok: true,
    serverConfig,
    game,
    view: gameLifecycle.serializeGame(game, { guildId: interaction.guild.id })
  }
}

function isAllowedDashboardChannel(interaction, serverConfig) {
  if (interaction.channelId === serverConfig.storytellerChannelId) return true
  if (!isPublicRevealChannel(interaction.channelId, serverConfig)) return false

  return isPublicEndRevealControl(interaction.customId)
}

function isPublicRevealChannel(channelId, serverConfig) {
  return channelId === serverConfig.liveChannelId ||
    channelId === serverConfig.postGameChannelId
}

function isPublicEndRevealControl(customId) {
  return String(customId || '').startsWith('botc:storyteller:grim-reveal:') ||
    String(customId || '').startsWith('botc:storyteller:end-reveal:')
}

module.exports = {
  ensureStorytellerDashboardReady,
  isAllowedDashboardChannel,
  isPublicEndRevealControl,
  isPublicRevealChannel
}
