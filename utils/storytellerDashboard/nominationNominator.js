const {
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js')
const {
  createForcedNominationCustomId,
  createNominationNominatorCustomId
} = require('./constants')
const {
  truncate
} = require('./formatters')

function createNominationNominatorPayload(view, nominatorId, playerLabels = {}, options = {}) {
  const nominatorLabel = playerLabels[nominatorId] || `<@${nominatorId}>`

  return {
    content: null,
    embeds: [],
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(options.forced ? createForcedNominationCustomId(nominatorId) : createNominationNominatorCustomId(nominatorId))
          .setPlaceholder(`Choose who ${truncate(nominatorLabel, 76)} nominates`)
          .addOptions(createNomineeOptions(view, nominatorId, playerLabels))
      )
    ]
  }
}

function createNomineeOptions(view, nominatorId, playerLabels = {}) {
  return (view.users.players || [])
    .slice(0, 25)
    .map((userId, index) => ({
      label: truncate(playerLabels[userId] || `Player ${index + 1}`, 100),
      value: userId,
      description: truncate(createNomineeDescription(view, userId, nominatorId), 100)
    }))
}

function createNomineeDescription(view, userId, nominatorId) {
  const currentDay = view.day || 1
  const nominations = view.engine.nominations || []
  const alreadyNominated = nominations.some(item =>
    item.day === currentDay &&
    item.nomineeId === userId
  )

  return [
    userId === nominatorId ? 'Self-nomination' : 'Nominee',
    alreadyNominated ? 'Already nominated today' : 'Can be nominated'
  ].join(' | ')
}

module.exports = {
  createNominationNominatorPayload,
  createNomineeOptions,
  createNominatorOptions: createNomineeOptions
}
