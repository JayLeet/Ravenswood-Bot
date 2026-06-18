const {
  ApplicationCommandOptionType,
  PermissionFlagsBits
} = require('discord.js')
const { wrapCommand } = require('../utils/commandWrapper')
const {
  createEndGameLogComponents
} = require('../utils/gameLogEndResult')
const {
  fetchGuildMemberWithRecoverableFallback
} = require('../utils/discord/recoverableFetch')
const {
  createBotLogger
} = require('../utils/logger')
const {
  hasAdministratorOrGlobalCommandAccess
} = require('../utils/commandAccess')

const roleLabels = {
  player: 'Player',
  spectator: 'Spectator',
  storyteller: 'Storyteller'
}
const log = createBotLogger({ subsystem: 'AdminCommand' })

const options = [
  {
    name: 'end-game',
    description: 'Forcefully end and clean up the active game.',
    type: ApplicationCommandOptionType.Subcommand,
    options: [
      {
        name: 'reason',
        description: 'Optional reason to show in the game-end message.',
        type: ApplicationCommandOptionType.String,
        required: false,
        max_length: 200
      }
    ]
  },
  {
    name: 'kick',
    description: 'Remove a player, spectator, or Storyteller without ending the game.',
    type: ApplicationCommandOptionType.Subcommand,
    options: [
      {
        name: 'user',
        description: 'The player, spectator, or Storyteller to remove.',
        type: ApplicationCommandOptionType.User,
        required: true
      }
    ]
  }
]

module.exports = {
  name: 'admin',
  description: 'Admin-only game moderation tools.',
  options,
  data: {
    name: 'admin',
    description: 'Admin-only game moderation tools.',
    options,
    default_member_permissions: PermissionFlagsBits.Administrator.toString()
  },
  default_member_permissions: PermissionFlagsBits.Administrator.toString(),

  execute: wrapCommand(async (interaction, ctx) => {
    const { gameLifecycle } = ctx
    if (!hasAdministratorOrGlobalCommandAccess(interaction)) {
      return {
        ok: false,
        error: { message: 'You need Administrator permission or bot owner access to use this command.' }
      }
    }

    const subcommand = interaction.options.getSubcommand()

    if (subcommand === 'kick') {
      const targetUser = interaction.options.getUser('user')
      const targetMember = await fetchGuildMemberWithRecoverableFallback({
        action: 'fetch-admin-kick-member',
        guild: interaction.guild,
        logger: log,
        userId: targetUser.id
      })

      const result = await gameLifecycle.adminRemoveUser(
        interaction.guild.id,
        interaction.member,
        targetMember
      )

      if (!result.ok) return result

      const roleLabel = roleLabels[result.removedRole] || result.removedRole
      const publicMessage = result.replacementNeeded
        ? `<@${result.removedUserId}> was removed as Storyteller by <@${interaction.member.id}>. Any eligible user can step in with /become-storyteller.`
        : `<@${result.removedUserId}> was removed as ${roleLabel} by <@${interaction.member.id}>.`

      return {
        ok: true,
        message: `Removed <@${result.removedUserId}> from the active game as ${roleLabel}.`,
        publicMessage,
        view: result.view
      }
    }

    if (subcommand === 'end-game') {
      const reason = interaction.options.getString('reason')
      const result = await gameLifecycle.adminForceEnd(
        interaction.guild.id,
        interaction.member,
        reason ? `Force-ended by <@${interaction.member.id}>: ${reason}` : null
      )

      if (!result.ok) return result
      const logComponents = await createEndGameLogComponents({
        client: interaction.client,
        deletePendingGameSummary: ctx.deletePendingGameSummary,
        guildId: interaction.guild.id,
        result,
        serverConfigs: ctx.serverConfigs
      })

      return {
        ...result,
        postGameComponents: logComponents,
        postGameMessage: logComponents.length
          ? 'The game was force-ended. Save or discard this game history here.'
          : null,
        publicMessage:
          `The game was force-ended by <@${interaction.member.id}>.\n` +
          `Reason: ${result.reason}`
      }
    }

    return {
      ok: false,
      error: { message: 'Unknown admin action.' }
    }
  })
}
