const { ActionRowBuilder, EmbedBuilder } = require('discord.js')
const { createPlayerGrimoireOpenButton } = require('../../../utils/playerGrimoire')
const { createInGameHelpButton } = require('../../../commands/help')
const { createRequestStorytellerRow } = require('../../../utils/storytellerRequestButtons')
const { createFirstNightEvilInfoText } = require('../../../utils/nightWakeInfo')
const { createLunaticFirstNightInfoText } = require('../../../utils/lunaticInfo')
const { formatRoleName, formatRoleWithEmoji } = require('../../../utils/roleFormatting')
const { formatAssignedTeamCounts } = require('../../../utils/teamCounts')
const { messages } = require('../../../utils/text/messageRegistry')

const FALLBACK_ABILITY = messages.get('character.fallbackAbility')

function createStartingRoleInfoPayload(role, guildId = null, playerId = null, options = {}) {
  const roleName = role?.name || 'Unassigned'
  const ability = role?.ability || FALLBACK_ABILITY
  const roleLabel = createStartingRoleLabel(role, options.view)
  const teamInfo = createStartingRoleTeamInfo(guildId, playerId, role, options.view)
  const countInfo = createStartingRoleCountInfo(options.view)

  const embed = new EmbedBuilder()
    .setTitle(messages.get('game.start.roleInfo.title', { roleName: roleLabel }))
    .setDescription([
      teamInfo,
      countInfo,
      messages.get('game.start.roleInfo.abilityHeading'),
      ability,
      '',
      messages.get('game.start.roleInfo.footer')
    ].filter(Boolean).join('\n'))
    .setColor(0x9b59b6)
    .setTimestamp()

  return {
    embeds: [embed],
    components: shouldShowStartingRoleButtons(guildId, playerId, options)
      ? [createStartingRoleInfoButtonRow(guildId, playerId)]
      : []
  }
}

function shouldShowStartingRoleButtons(guildId, playerId, options = {}) {
  if (!guildId || !playerId) return false
  return !options.fakePlayer || options.allowFakePlayerControls === true
}

function createStartingRoleTeamInfo(guildId, playerId, role, view) {
  if (!guildId || !playerId || !role || !view) return null
  const lunaticInfo = createLunaticFirstNightInfoText(view, playerId, view.users?.displayNames || {})
  if (lunaticInfo) return removeStartingRoleIdentityLine(lunaticInfo)
  const evilInfo = createFirstNightEvilInfoText({
    actorId: playerId,
    day: view.day || 1,
    firstNightRoleInfo: true,
    guildId,
    playerId,
    roleId: role.id,
    targetType: 'self'
  }, view, view.users?.displayNames || {})
  return removeStartingRoleIdentityLine(evilInfo)
}

function removeStartingRoleIdentityLine(text) {
  if (!text) return null
  return String(text)
    .split('\n')
    .filter(line => !/^You are (?:the Demon|a Minion):\s+/i.test(line))
    .join('\n')
    .replace(/^\n+/, '') || null
}

function createStartingRoleLabel(role, view) {
  if (role?.id && view) return formatRoleWithEmoji(view, role.id)
  if (role?.name) return `the ${role.name}`
  if (role?.id) return `the ${formatRoleName(role.id)}`
  return 'Unassigned'
}

function createStartingRoleInfoButtonRow(guildId, playerId) {
  const requestRow = createRequestStorytellerRow(guildId, playerId)
  const buttons = [...(requestRow?.components || [])]
  buttons.push(createPlayerGrimoireOpenButton(playerId))
  buttons.push(createInGameHelpButton())
  return new ActionRowBuilder().addComponents(buttons)
}

function createStartingRoleCountInfo(view) {
  const counts = formatAssignedTeamCounts(view)
  return counts ? `Setup count: ${counts}` : null
}

function createMentionedStartingRolePayload(payload, playerId, options = {}) {
  if (options.fakePlayer) return payload
  return {
    ...payload,
    allowedMentions: { users: [playerId] },
    content: `<@${playerId}>`
  }
}

module.exports = {
  FALLBACK_ABILITY,
  createMentionedStartingRolePayload,
  createStartingRoleCountInfo,
  createStartingRoleInfoButtonRow,
  createStartingRoleInfoPayload,
  createStartingRoleLabel,
  createStartingRoleTeamInfo
}
