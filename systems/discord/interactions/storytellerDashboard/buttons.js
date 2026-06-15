const {
  createStorytellerDashboardButtonHandler
} = require('./buttonHandler')
const {
  handleTimerControlInteraction,
  isTimerButton
} = require('../timerControl')

function createStorytellerDashboardButtonHandlerWithTimer(deps) {
  const handleDashboardButton = createStorytellerDashboardButtonHandler(deps)

  return function handleStorytellerDashboardButton(interaction) {
    if (isTimerButton(interaction.customId)) return handleTimerControlInteraction(interaction, deps)
    return handleDashboardButton(interaction)
  }
}

module.exports = {
  createStorytellerDashboardButtonHandler: createStorytellerDashboardButtonHandlerWithTimer
}
