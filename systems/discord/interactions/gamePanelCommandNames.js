const { GAME_PANEL_ACTIONS } = require('../embeds')

function getGamePanelCommandName(customId) {
  const commands = {
    [GAME_PANEL_ACTIONS.createClocktowerOnlineGame]: 'create-game',
    [GAME_PANEL_ACTIONS.createDiscordOnlyGame]: 'create-game',
    [GAME_PANEL_ACTIONS.createGame]: 'create-game',
    [GAME_PANEL_ACTIONS.games]: 'games',
    [GAME_PANEL_ACTIONS.help]: 'help',
    [GAME_PANEL_ACTIONS.join]: 'join',
    [GAME_PANEL_ACTIONS.leave]: 'leave',
    [GAME_PANEL_ACTIONS.requestGrim]: 'request-grim',
    [GAME_PANEL_ACTIONS.settings]: 'settings',
    [GAME_PANEL_ACTIONS.spectate]: 'spectate',
    [GAME_PANEL_ACTIONS.start]: 'start'
  }

  return commands[customId] || null
}

module.exports = {
  getGamePanelCommandName
}
