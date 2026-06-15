const {
  ActionRowBuilder,
  EmbedBuilder
} = require('discord.js')
const {
  queuedChannelSend
} = require('../../../../utils/discord/messageActions')
const {
  createPlayerGrimoireOpenButton
} = require('../../../../utils/playerGrimoire')
const {
  createRequestStorytellerRow
} = require('../../../../utils/storytellerRequestButtons')
const {
  createBotLogger
} = require('../../../../utils/logger')

const log = createBotLogger({ subsystem: 'SubstituteBriefing' })

async function sendSubstituteBriefing({ channel, game, gameLifecycle, member }) {
  if (!channel || !game || !gameLifecycle || !member?.id) return null
  if (game.substituteBriefings?.[member.id]) return null

  const roleId = getPlayerFacingRoleId(game, member.id)
  const role = gameLifecycle.scripts.getRole(game.scriptId, roleId)
  const message = await queuedChannelSend(channel, createSubstituteBriefingPayload({
    game,
    memberId: member.id,
    role,
    roleId
  })).catch(err => {
    log.recoverable('send-substitute-briefing', err, {
      channelId: channel.id,
      guildId: game.guildId,
      userId: member.id
    })
    return null
  })

  if (!message) return null
  game.substituteBriefings ??= {}
  game.substituteBriefings[member.id] = {
    day: game.day || 1,
    phase: game.phase || null,
    roleId,
    sentAt: Date.now()
  }
  gameLifecycle.save()
  return message
}

function createSubstituteBriefingPayload({ game, memberId, role, roleId }) {
  const embed = new EmbedBuilder()
    .setTitle('You are now the substitute player')
    .setDescription(createSubstituteBriefingDescription({ game, memberId, role, roleId }))
    .setColor(0x9b59b6)
    .setTimestamp()

  return {
    allowedMentions: { users: [memberId] },
    components: [createSubstituteBriefingButtonRow(game.guildId, memberId)],
    content: `<@${memberId}>`,
    embeds: [embed]
  }
}

function createSubstituteBriefingDescription({ game, memberId, role, roleId }) {
  return [
    'You inherited this seat. This briefing only shows information this seat\'s current player is allowed to know.',
    '',
    `**Character:** ${role?.name || roleId || 'Unknown'}`,
    `**Ability:** ${role?.ability || 'No ability text available.'}`,
    `**Status:** ${formatPlayerStatus(game, memberId)}`,
    '',
    'Your private grimoire notes and player-facing information moved with the seat. Use **Your Grimoire** to review or update them.'
  ].join('\n')
}

function createSubstituteBriefingButtonRow(guildId, memberId) {
  const requestRow = createRequestStorytellerRow(guildId, memberId)
  const buttons = [...(requestRow?.components || [])]
  buttons.push(createPlayerGrimoireOpenButton(memberId))
  return new ActionRowBuilder().addComponents(buttons)
}

function getPlayerFacingRoleId(game, memberId) {
  return game?.shownRoles?.[memberId] || game?.roles?.[memberId] || null
}

function formatPlayerStatus(game, memberId) {
  if ((game.deadPlayers || []).includes(memberId)) {
    return game.deadVotes?.[memberId] === false ? 'Dead, ghost vote spent.' : 'Dead, ghost vote available.'
  }
  return 'Alive.'
}

module.exports = {
  createSubstituteBriefingDescription,
  createSubstituteBriefingPayload,
  formatPlayerStatus,
  getPlayerFacingRoleId,
  sendSubstituteBriefing
}
