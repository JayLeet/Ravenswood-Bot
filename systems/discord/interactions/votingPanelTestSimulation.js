const {
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js')
const {
  VOTE_ACTIONS,
  createVoteSimulationCustomId
} = require('../embeds')
const {
  acknowledgeInteraction,
  createSystemEmbed,
} = require('./feedback')
const {
  resolveTestPlayerInteractionMember
} = require('./testPlayerSimulation')

function deferVoteSimulationInteraction(interaction) {
  return acknowledgeInteraction(interaction)
}

async function handleVoteSimulationSelect(interaction, {
  editVoteFailure,
  editVoteSuccess,
  gameLifecycle,
  log,
  parsed,
  postOrUpdateStorytellerDashboard,
  queuePostVoteUpdates,
  setTimeoutFn,
  temporarilyDisableVotingButtons
}) {
  const selectedPlayerId = interaction.values?.[0]
  if (!selectedPlayerId) return editVoteFailure(interaction, 'Choose a fake test player first.')

  const game = gameLifecycle.get?.(interaction.guild.id)
  const view = gameLifecycle.getGameView?.(interaction.guild.id)
  const member = resolveTestPlayerInteractionMember({
    gameLifecycle,
    game,
    interaction,
    playerId: selectedPlayerId,
    view
  })

  if (member?.id !== selectedPlayerId) {
    return editVoteFailure(
      interaction,
      'Only the Storyteller can simulate fake test-player vote buttons.',
      'Use this only in a test game with fake players.'
    )
  }

  const result = await gameLifecycle.castVote(
    interaction.guild.id,
    member,
    parsed.nominationId,
    parsed.action === VOTE_ACTIONS.yes
  )

  if (!result.ok) return editVoteFailure(interaction, result.error?.message || 'Unknown error')

  const success = await editVoteSuccess(
    interaction,
    formatSimulatedVoteSuccessMessage(parsed.action, selectedPlayerId, result.view || view)
  )

  queuePostVoteUpdates({
    interaction,
    knownMessage: null,
    log,
    nomination: result.nomination,
    postOrUpdateStorytellerDashboard,
    setTimeoutFn,
    temporarilyDisableVotingButtons,
    view: result.view
  })

  return success
}

function createTestVoteSimulationPickerPayload(interaction, gameLifecycle, parsed) {
  if (parsed.action === VOTE_ACTIONS.pertinence) return null

  const game = gameLifecycle.get?.(interaction.guild.id)
  if (!game?.testMode || !gameLifecycle.isStoryteller?.(game, interaction.member?.id)) return null

  const view = gameLifecycle.getGameView?.(interaction.guild.id)
  const fakePlayers = (view?.users?.fakePlayers || [])
    .filter(playerId => gameLifecycle.isFakePlayer?.(game, playerId) === true)
    .slice(0, 25)

  if (!fakePlayers.length) return null

  const customId = createVoteSimulationCustomId(parsed.action, interaction.guild.id, parsed.nominationId)
  if (!customId) return null

  return {
    embeds: [
      createSystemEmbed(
        'Choose fake voter',
        `Choose which fake test player should ${parsed.action === VOTE_ACTIONS.yes ? 'raise' : 'lower'} their hand.`,
        0x3498db
      )
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(customId)
          .setPlaceholder('Choose fake voter')
          .addOptions(fakePlayers.map(playerId => ({
            label: truncateSelectLabel(view?.users?.displayNames?.[playerId] || `Test Player ${String(playerId).slice(-4)}`),
            value: playerId
          })))
      )
    ]
  }
}

function formatSimulatedVoteSuccessMessage(action, playerId, view) {
  const playerName = view?.users?.displayNames?.[playerId] || `Test Player ${String(playerId).slice(-4)}`
  return action === VOTE_ACTIONS.yes
    ? `${playerName}'s hand is raised.`
    : `${playerName}'s hand is lowered.`
}

function truncateSelectLabel(value, limit = 100) {
  const text = String(value || '')
  return text.length > limit ? text.slice(0, limit) : text
}

module.exports = {
  createTestVoteSimulationPickerPayload,
  deferVoteSimulationInteraction,
  handleVoteSimulationSelect
}
