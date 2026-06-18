const { wrapCommand } = require('../utils/commandWrapper')
const {
  createRequestDecisionRows
} = require('../utils/requestDecisionButtons')

module.exports = {
  name: 'requests',
  description: 'View pending join and grimoire requests.',
  options: [],
  data: {
    name: 'requests',
    description: 'View pending join and grimoire requests.',
    options: []
  },
  storytellerChannelOnly: true,

  execute: wrapCommand(async (interaction, { gameLifecycle }) => {
    const result = gameLifecycle.getPendingRequestsForStoryteller(
      interaction.guild.id,
      interaction.member
    )

    if (!result.ok) return result

    if (result.requests.length === 0) {
      return {
        ok: true,
        message: 'There are no pending requests.'
      }
    }

    return {
      ok: true,
      message: result.requests
        .map(req => `Player: <@${req.userId}>\nType: ${req.type}`)
        .join('\n\n'),
      components: createRequestDecisionRows(result.requests)
    }
  })
}
