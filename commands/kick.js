const {
  ApplicationCommandOptionType
} = require('discord.js')
const { wrapCommand } = require('../utils/commandWrapper')
const {
  fetchGuildMemberWithRecoverableFallback
} = require('../utils/discord/recoverableFetch')
const {
  createBotLogger
} = require('../utils/logger')

const options = [{
  name: 'player',
  description: 'Player to kick and replace.',
  type: ApplicationCommandOptionType.User,
  required: true
}]
const log = createBotLogger({ subsystem: 'KickCommand' })

module.exports = {
  name: 'kick',
  description: 'Kick a player and pause the game until a substitute joins.',
  options,
  data: { name: 'kick', description: 'Kick a player and pause the game until a substitute joins.', options },
  storytellerChannelOnly: true,

  execute: wrapCommand(async (interaction, { gameLifecycle }) => {
    const targetUser = interaction.options.getUser('player', true)
    const targetMember = interaction.options.getMember('player') ||
      await fetchGuildMemberWithRecoverableFallback({
        action: 'fetch-kick-member',
        guild: interaction.guild,
        logger: log,
        userId: targetUser.id
      })
    const result = await gameLifecycle.kickPlayer(interaction.guild.id, interaction.member, targetMember)
    if (!result.ok) return result

    return {
      ok: true,
      message: 'Player kicked. The game is paused until a replacement join request is approved.',
      publicMessage: result.storytellerMessage || result.publicMessage
    }
  }, { ephemeral: false })
}
