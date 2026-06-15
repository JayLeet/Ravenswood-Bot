const {
  ApplicationCommandOptionType
} = require('discord.js')
const {
  wrapCommand
} = require('../systems/discord/interactions/commandWrapper')
const {
  MAX_TIMER_MINUTES,
  startStorytellerTimer
} = require('../systems/discord/interactions/timerActions')

const options = [
  {
    name: 'minutes',
    description: 'Timer length in minutes, from 1 to 10.',
    type: ApplicationCommandOptionType.Integer,
    required: true,
    min_value: 1,
    max_value: MAX_TIMER_MINUTES
  }
]

module.exports = {
  name: 'timer',
  description: 'Start a game timer. During day discussion, it sounds the Gong when it ends.',
  options,
  data: {
    name: 'timer',
    description: 'Start a game timer. During day discussion, it sounds the Gong when it ends.',
    options
  },

  execute: wrapCommand(async (interaction, { gameLifecycle, serverConfig }) => {
    return startStorytellerTimer({
      gameLifecycle,
      interaction,
      minutes: interaction.options.getInteger('minutes', true),
      serverConfig
    })
  })
}
