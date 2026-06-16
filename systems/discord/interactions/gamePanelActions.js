const {
  GAME_PANEL_ACTIONS,
  createGameModeChoicePayload,
  getGameModeFromCreateAction
} = require('../embeds')
const { createHelpPayload } = require('../../../commands/help')
const {
  cleanupUnexpectedRavenswoodChannels
} = require('../../../utils/channelCleanup')
const {
  createLiveGamesEmbed
} = require('../../../utils/gamePanelGames')
const {
  getGameModeLabel
} = require('../../../utils/gameModes')
const {
  createGrimoireRequestNotice,
  createGrimoireRequestSubmittedMessage
} = require('../../../utils/grimoireAccess')
const {
  createSetupSettingsPayload,
  hasAdminSetupSettingsAccess
} = require('../../../utils/setupSettingsPanel')
const {
  getGameRoles
} = require('../../../utils/setupTextChannelPermissions')
const {
  logSetupRecoverable
} = require('../../../utils/setupLogging')


function createGamePanelActionRunner({ gameLifecycle, gameManager }) {
  return async function runGamePanelAction(interaction, serverConfig) {
    if (interaction.customId === GAME_PANEL_ACTIONS.createGame) {
      return {
        ok: true,
        ...createGameModeChoicePayload()
      }
    }



    const gameMode = getGameModeFromCreateAction(interaction.customId)
    if (gameMode) {
      return createGame(interaction, serverConfig, gameLifecycle, gameMode)
    }

    if (interaction.customId === GAME_PANEL_ACTIONS.games) {
      return {
        ok: true,
        embeds: [createLiveGamesEmbed(gameLifecycle, interaction.guild.id)]
      }
    }

    if (interaction.customId === GAME_PANEL_ACTIONS.join) {
      return joinGame(interaction, gameLifecycle)
    }

    if (interaction.customId === GAME_PANEL_ACTIONS.leave) {
      return leaveGame(interaction, gameLifecycle)
    }

    if (interaction.customId === GAME_PANEL_ACTIONS.spectate) {
      return spectateGame(interaction, gameLifecycle)
    }

    if (interaction.customId === GAME_PANEL_ACTIONS.requestGrim) {
      return requestGrim(interaction, gameLifecycle)
    }

    if (interaction.customId === GAME_PANEL_ACTIONS.settings) {
      return openSettings(interaction, serverConfig, gameManager)
    }

    if (interaction.customId === GAME_PANEL_ACTIONS.start) {
      return startGame(interaction, gameLifecycle)
    }

    if (interaction.customId === GAME_PANEL_ACTIONS.help) {
      return {
        ok: true,
        ...createHelpPayload(0)
      }
    }

    return {
      ok: false,
      error: { message: 'Unknown game panel action.' }
    }
  }
}

async function createGame(interaction, serverConfig, gameLifecycle, gameMode) {
  const result = await gameLifecycle.createGame(
    interaction.guild.id,
    interaction.member,
    { gameMode }
  )

  if (!result.ok) return result

  await cleanupUnexpectedRavenswoodChannels(interaction.client, serverConfig)

  return {
    ok: true,
    refreshStorytellerDashboard: true,
    message: `Game created. You are the Storyteller. Mode: ${formatGameMode(gameMode)}.`
  }
}


async function joinGame(interaction, gameLifecycle) {
  const result = await gameLifecycle.join(
    interaction.guild.id,
    interaction.member
  )

  if (!result.ok) return result

  return {
    ok: true,
    message: result.request
      ? 'Join request sent to the Storyteller.'
      : 'You joined as a player.',
    liveMessage: result.publicMessage
  }
}

async function leaveGame(interaction, gameLifecycle) {
  const result = await gameLifecycle.leave(
    interaction.guild.id,
    interaction.member
  )

  if (!result.ok) return result

  if (!result.ended) {
    return {
      ok: true,
      message: result.message || 'You left the game.',
      liveMessage: result.publicMessage
    }
  }

  return {
    ok: true,
    cleanupSetupChannels: result.cleanupSetupChannels,
    message: `Game ended.\nWinner: ${result.winner}\nReason: ${result.reason}`,
    liveMessage:
      `The game has ended.\n` +
      `Winner: ${result.winner}\n` +
      `Reason: ${result.reason}`
  }
}

async function spectateGame(interaction, gameLifecycle) {
  const result = await gameLifecycle.spectate(
    interaction.guild.id,
    interaction.member
  )

  if (!result.ok) return result

  return {
    ok: true,
    message: 'You are now spectating.',
    spectatorMessage: `<@${interaction.member.id}> is now spectating.`
  }
}

async function requestGrim(interaction, gameLifecycle) {
  const result = await gameLifecycle.requestGrimoireAccess(
    interaction.guild.id,
    interaction.member
  )

  if (!result.ok) return result

  return {
    ok: true,
    message: result.alreadyGranted
      ? 'You already have grimoire access. Use `/grimoire` in the spectator channel to view it privately.'
      : createGrimoireRequestSubmittedMessage(),
    storytellerMessage: result.request
      ? createGrimoireRequestNotice(interaction.member.id, result.request.id)
      : null
  }
}

async function openSettings(interaction, serverConfig, gameManager) {
  if (!hasAdminSetupSettingsAccess(interaction)) {
    return { ok: false, error: { message: 'Only server administrators or bot owner access users can use setup settings.' } }
  }

  await interaction.guild.roles.fetch?.().catch(err => logSetupRecoverable('fetch-game-panel-setup-settings-roles', err, {
    guildId: interaction.guild?.id,
    userId: interaction.user?.id
  }))
  return {
    ok: true,
    ...createSetupSettingsPayload({
      guild: interaction.guild,
      serverConfig,
      gameRoles: getGameRoles(interaction.guild, gameManager)
    })
  }
}

async function startGame(interaction, gameLifecycle) {
  const result = await gameLifecycle.startGame(
    interaction.guild.id,
    interaction.member
  )

  if (!result.ok) return result

  return {
    ok: true,
    message: `Game started successfully. Current phase: ${result.view.phaseLabel}.`,
    liveMessage: `The game has started. Current phase: ${result.view.phaseLabel}.`
  }
}

function formatGameMode(gameMode) {
  return getGameModeLabel(gameMode)
}

module.exports = {
  createGamePanelActionRunner,
  formatGameMode
}
