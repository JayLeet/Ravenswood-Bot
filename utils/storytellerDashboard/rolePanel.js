const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js')
const {
  STORYTELLER_DASHBOARD_ACTIONS,
  createRoleSelectCustomId
} = require('./constants')
const {
  formatCategory,
  getRoleDisplayName,
  truncate
} = require('./formatters')
const {
  DRUNK_ROLE_ID
} = require('../../systems/game/roles/setupCounts')
const {
  createDrunkShownRoleOptions
} = require('./randomRoles')

const ROLE_TEAMS = ['townsfolk', 'outsider', 'minion', 'demon']
const DEFAULT_ROLE_TEAM = 'townsfolk'
const ROLE_BUTTON_LIMIT = 20
const TEAM_BUTTON = {
  townsfolk: { style: ButtonStyle.Primary },
  outsider: { style: ButtonStyle.Primary },
  minion: { style: ButtonStyle.Danger },
  demon: { style: ButtonStyle.Danger }
}

function createRolePanelPayload(view, selectedPlayerId, playerLabels = {}, selectedTeam = DEFAULT_ROLE_TEAM) {
  const selectedRole = view.engine.roles?.[selectedPlayerId]
  const shownRole = view.engine.shownRoles?.[selectedPlayerId]
  const playerName = playerLabels[selectedPlayerId] || `Player ${String(selectedPlayerId).slice(-4)}`
  const team = ROLE_TEAMS.includes(selectedTeam) ? selectedTeam : DEFAULT_ROLE_TEAM
  const components = [
    createTeamButtonRow(team),
    ...createRoleButtonRows(view, team),
    ...createDrunkShownRows(view, selectedRole, shownRole)
  ].slice(0, 5)

  return {
    embeds: [
      new EmbedBuilder()
        .setTitle('Assign Role')
        .setDescription(createRolePanelDescription({
          playerName,
          selectedPlayerId,
          selectedRole,
          selectedTeam: team,
          shownRole,
          view
        }))
        .setColor(0x9b59b6)
    ],
    components
  }
}

function createTeamButtonRow(selectedTeam) {
  return new ActionRowBuilder().addComponents(
    ROLE_TEAMS.map(team => new ButtonBuilder()
      .setCustomId(createRoleTeamButtonCustomId(team))
      .setLabel(formatCategory(team))
      .setStyle(team === selectedTeam ? ButtonStyle.Success : TEAM_BUTTON[team].style))
  )
}

function createRoleButtonRows(view, team) {
  const roleIds = (view.engine.roleCategories?.[team] || []).slice(0, ROLE_BUTTON_LIMIT)
  const rows = []
  for (let index = 0; index < roleIds.length; index += 5) {
    rows.push(new ActionRowBuilder().addComponents(
      roleIds.slice(index, index + 5).map(roleId => new ButtonBuilder()
        .setCustomId(createRoleButtonCustomId(team, roleId))
        .setLabel(truncate(getRoleDisplayName(view, roleId), 80))
        .setStyle(TEAM_BUTTON[team].style))
    ))
  }
  return rows
}

function createDrunkShownRows(view, selectedRole, shownRole) {
  if (selectedRole !== DRUNK_ROLE_ID) return []

  const inPlayRoles = Object.values(view.engine.roles || {})
    .filter(roleId => roleId !== shownRole)
  const drunkOptions = createDrunkShownRoleOptions(view, inPlayRoles)
  if (shownRole && !drunkOptions.some(option => option.value === shownRole)) {
    drunkOptions.unshift({ value: shownRole })
  }
  if (!drunkOptions.length) return []

  const roleIds = drunkOptions.map(option => option.value).slice(0, 5)
  return [new ActionRowBuilder().addComponents(
    roleIds.map(roleId => new ButtonBuilder()
      .setCustomId(createDrunkShownRoleButtonCustomId(roleId))
      .setLabel(truncate(getRoleDisplayName(view, roleId), 80))
      .setStyle(roleId === shownRole ? ButtonStyle.Success : ButtonStyle.Primary))
  )]
}

function createRolePanelDescription({ playerName, selectedPlayerId, selectedRole, selectedTeam, shownRole, view }) {
  const scriptHasDrunk = (view.engine.roleCategories?.outsider || []).includes(DRUNK_ROLE_ID)
  const showDrunkMoveGuidance = shouldShowDrunkMoveGuidance({
    selectedRole,
    selectedTeam,
    scriptHasDrunk,
    view
  })

  return [
    `👤 Player: <@${selectedPlayerId}>`,
    `🎭 Current role: ${selectedRole ? getRoleDisplayName(view, selectedRole) : 'Unassigned'}`,
    `📚 Showing: ${formatCategory(selectedTeam)} buttons`,
    selectedRole === DRUNK_ROLE_ID
      ? `🍺 Drunk sees: ${shownRole ? getRoleDisplayName(view, shownRole) : 'Not chosen yet'}`
      : null,
    '',
    `Choose a team, then choose a role for ${playerName}.`,
    selectedRole === DRUNK_ROLE_ID
      ? 'The Townsfolk buttons at the bottom choose what this Drunk sees; they do not change their real role.'
      : null,
    'Use Player Controls if you need to clear this role.',
    '',
    showDrunkMoveGuidance
      ? 'To make this player Drunk, assign Drunk from Outsider roles. They will keep their old Townsfolk role as what they see.'
      : null,
    showDrunkMoveGuidance
      ? 'If another Drunk already exists, that player becomes the Townsfolk they were shown as.'
      : null
  ].filter(Boolean).join('\n')
}

function shouldShowDrunkMoveGuidance({ selectedRole, selectedTeam, scriptHasDrunk, view }) {
  if (!scriptHasDrunk || selectedTeam !== 'outsider' || selectedRole === DRUNK_ROLE_ID) {
    return false
  }

  return (view.engine.roleCategories?.townsfolk || []).includes(selectedRole)
}

function createRoleTeamButtonCustomId(team) {
  return `${STORYTELLER_DASHBOARD_ACTIONS.rolePanel}:${team}`
}

function createRoleButtonCustomId(team, roleId) {
  return `${createRoleSelectCustomId(team)}:${roleId}`
}

function createDrunkShownRoleButtonCustomId(roleId) {
  return `${STORYTELLER_DASHBOARD_ACTIONS.drunkShownRole}:${roleId}`
}

module.exports = {
  DEFAULT_ROLE_TEAM,
  ROLE_TEAMS,
  createDrunkShownRoleButtonCustomId,
  createRoleButtonCustomId,
  createRolePanelPayload,
  createRoleTeamButtonCustomId
}
