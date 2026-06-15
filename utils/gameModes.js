const GAME_MODE = Object.freeze({
  clocktowerLive: 'clocktower-live',
  discordOnly: 'discord-only'
})

function isClocktowerLiveMode(value) {
  const mode = typeof value === 'string' ? value : value?.gameMode
  return mode === GAME_MODE.clocktowerLive
}

function getGameModeLabel(value) {
  return isClocktowerLiveMode(value) ? 'Clocktower.live' : 'Discord-only'
}

module.exports = {
  GAME_MODE,
  getGameModeLabel,
  isClocktowerLiveMode
}
