const {
  isTimerButton,
  parseTimerButton,
  pauseGongTimer,
  resumeGongTimer
} = require('./gongTimer')
const {
  respondPrivateSystem,
  updateInteraction
} = require('./feedback')

async function handleTimerControlInteraction(interaction, { gameLifecycle }) {
  const parsed = parseTimerButton(interaction.customId)
  if (!parsed) return null

  const game = gameLifecycle.get(interaction.guild.id)
  if (!game) {
    return respondPrivateSystem(
      interaction,
      'Timer unavailable',
      'That timer is no longer connected to an active game.',
      'Start a new timer if the game is still running.'
    )
  }

  if (!gameLifecycle.isStoryteller(game, interaction.member.id)) {
    return respondPrivateSystem(
      interaction,
      'Only the Storyteller can use this button.',
      'Only the Storyteller can pause or resume this timer.',
      'Ask the Storyteller to use the timer controls.'
    )
  }

  const result = parsed.action === 'pause'
    ? pauseGongTimer(interaction.guild.id)
    : resumeGongTimer(interaction.guild.id)

  if (!result.ok) {
    return respondPrivateSystem(
      interaction,
      'Timer unavailable',
      result.error?.message || 'That timer is no longer active.',
      'Start a new timer if you still need one.'
    )
  }

  return updateInteraction(interaction, result.payload)
}

module.exports = {
  handleTimerControlInteraction,
  isTimerButton
}
