const { wrapCommand } = require('../systems/discord/interactions/commandWrapper')
const {
  createGameModeChoicePayload
} = require('../utils/gamePanel')

module.exports = {
  name: 'create-game',
  description: 'Create a new game and become the Storyteller.',
  options: [],
  data: {
    name: 'create-game',
    description: 'Create a new game and become the Storyteller.',
    options: []
  },

  execute: wrapCommand(async () => ({
    ok: true,
    ...createGameModeChoicePayload()
  }))
}
