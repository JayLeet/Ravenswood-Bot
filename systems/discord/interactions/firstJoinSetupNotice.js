const {
  FIRST_JOIN_SETUP_CHECK_ID,
  FIRST_JOIN_SETUP_ID,
  FIRST_JOIN_SETUP_MANUAL_ID,
  isFirstJoinSetupNoticeInteraction
} = require('../firstJoinSetupNotice')
const {
  replyPrivateSystem
} = require('./feedback')

const FIRST_JOIN_COMMANDS = Object.freeze({
  [FIRST_JOIN_SETUP_CHECK_ID]: 'setup-check',
  [FIRST_JOIN_SETUP_ID]: 'setup',
  [FIRST_JOIN_SETUP_MANUAL_ID]: 'setup-manual'
})

function createFirstJoinSetupNoticeInteractionSystem({ client, gameManager, saveServerConfigs, serverConfigs }) {
  async function handleFirstJoinSetupNoticeInteraction(interaction) {
    if (!isFirstJoinSetupNoticeInteraction(interaction.customId)) return null

    const commandName = FIRST_JOIN_COMMANDS[interaction.customId]
    const command = client.commands.get(commandName)
    if (!command?.execute) {
      return replyPrivateSystem(
        interaction,
        'Setup action unavailable',
        `I could not find /${commandName}.`,
        'Ask Jay to deploy slash commands, then restart the bot if this keeps happening.'
      )
    }

    interaction.commandName = commandName
    return command.execute(interaction, {
      client,
      gameManager,
      saveServerConfigs,
      serverConfigs
    })
  }

  return { handleFirstJoinSetupNoticeInteraction }
}

module.exports = {
  createFirstJoinSetupNoticeInteractionSystem,
  isFirstJoinSetupNoticeInteraction
}
