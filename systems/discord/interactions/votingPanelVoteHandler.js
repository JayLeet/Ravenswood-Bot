const {
  VOTE_ACTIONS,
  parseVoteSimulationCustomId,
  parseVoteCustomId
} = require('../embeds')
const {
  createSystemEmbed,
  deferPrivateReply,
  editInteractionReply
} = require('./feedback')
const {
  formatFailureMessage
} = require('../../../utils/failureSuggestions')
const {
  createVoteButtonCooldown
} = require('./voteButtonCooldown')
const {
  createBotLogger
} = require('../../../utils/logger')
const {
  createTestVoteSimulationPickerPayload,
  deferVoteSimulationInteraction,
  handleVoteSimulationSelect
} = require('./votingPanelTestSimulation')

function createVotingInteractionHandler({
  gameLifecycle,
  postOrUpdateStorytellerDashboard,
  postOrUpdateVotingPanel,
  temporarilyDisableVotingButtons,
  voteButtonCooldown = createVoteButtonCooldown(),
  log = createBotLogger({ subsystem: 'VotingPanelVoteHandler' }),
  setTimeoutFn = setTimeout
}) {
  return async function handleVotingInteraction(interaction) {
    const simulation = parseVoteSimulationCustomId(interaction.customId)
    if (simulation) {
      await deferVoteSimulationInteraction(interaction)
      if (simulation.guildId !== interaction.guild?.id) {
        return editVoteFailure(interaction, 'That vote simulation is not valid for this server.', 'Open a fresh voting panel and try again.')
      }
      return handleVoteSimulationSelect(interaction, {
        editVoteFailure,
        editVoteSuccess,
        gameLifecycle,
        log,
        parsed: simulation,
        postOrUpdateStorytellerDashboard,
        queuePostVoteUpdates,
        setTimeoutFn,
        temporarilyDisableVotingButtons
      })
    }

    await deferPrivateReply(interaction)

    const parsed = parseVoteCustomId(interaction.customId)
    if (!parsed || parsed.guildId !== interaction.guild?.id) {
      return editVoteFailure(interaction, 'That vote button is not valid for this server.', 'Ask the Storyteller to open a fresh vote.')
    }

    const simulationPicker = createTestVoteSimulationPickerPayload(interaction, gameLifecycle, parsed)
    if (simulationPicker) return editInteractionReply(interaction, simulationPicker)

    const cooldown = voteButtonCooldown.acquire(interaction)
    if (!cooldown.ok) {
      return editVoteFailure(
        interaction,
        'Please wait 1 second before pressing another vote button.',
        'Your previous vote button press is already being processed.'
      )
    }

    let cooldownToken = cooldown.token
    let result

    try {
      result = parsed.action === VOTE_ACTIONS.pertinence
        ? await gameLifecycle.toggleNominationPertinence(
          interaction.guild.id,
          interaction.member,
          parsed.nominationId
        )
        : await gameLifecycle.castVote(
          interaction.guild.id,
          interaction.member,
          parsed.nominationId,
          parsed.action === VOTE_ACTIONS.yes
        )

      if (!result.ok) {
        voteButtonCooldown.release(cooldownToken, { keepCooldown: false })
        cooldownToken = null
        return editVoteFailure(interaction, result.error?.message || 'Unknown error')
      }

      voteButtonCooldown.release(cooldownToken, { keepCooldown: true })
      cooldownToken = null
    } catch (error) {
      voteButtonCooldown.release(cooldownToken, { keepCooldown: false })
      throw error
    }

    const success = await editVoteSuccess(
      interaction,
      formatVoteSuccessMessage(parsed.action, result)
    )

    queuePostVoteUpdates({
      interaction,
      log,
      nomination: result.nomination,
      postOrUpdateStorytellerDashboard,
      setTimeoutFn,
      temporarilyDisableVotingButtons,
      view: result.view
    })

    return success
  }
}

function queuePostVoteUpdates({
  knownMessage,
  interaction,
  log,
  nomination,
  postOrUpdateStorytellerDashboard,
  setTimeoutFn = setTimeout,
  temporarilyDisableVotingButtons,
  view
}) {
  setTimeoutFn(() => {
    return Promise.resolve().then(async () => {
      await temporarilyDisableVotingButtons(
        interaction.client,
        interaction.guild.id,
        nomination,
        view,
        knownMessage === undefined ? interaction.message : knownMessage
      )
      await postOrUpdateStorytellerDashboard(interaction.client, interaction.guild.id)
    })
      .catch(err => {
        log.recoverable('post-vote-public-updates', err, {
          guildId: interaction.guild?.id,
          nominationId: nomination?.id,
          userId: interaction.user?.id || interaction.member?.id
        })
      })
  }, 0)
}

function formatVoteSuccessMessage(action, result) {
  if (action === VOTE_ACTIONS.pertinence) {
    return result.active
      ? 'Pertinence marked.'
      : 'Pertinence cleared.'
  }

  return action === VOTE_ACTIONS.yes
    ? 'Your hand is raised.'
    : 'Your hand is lowered.'
}

function editVoteFailure(interaction, message, suggestion = null) {
  return editInteractionReply(interaction, {
    embeds: [createSystemEmbed('Vote failed', formatFailureMessage(message, suggestion))]
  })
}

function editVoteSuccess(interaction, message) {
  return editInteractionReply(interaction, {
    embeds: [createSystemEmbed('Done', message, 0x2ecc71)]
  })
}

module.exports = {
  createVotingInteractionHandler,
  editVoteFailure,
  editVoteSuccess,
  queuePostVoteUpdates
}
