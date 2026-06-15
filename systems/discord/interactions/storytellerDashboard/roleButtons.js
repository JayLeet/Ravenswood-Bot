const {
  STORYTELLER_DASHBOARD_ACTIONS
} = require('../../embeds')
const {
  ROLE_TEAMS,
  createRolePanelPayload
} = require('../../../../utils/storytellerDashboard/rolePanel')
const {
  editDashboardFailure
} = require('../feedback')
const {
  DRUNK_ROLE_ID
} = require('../../../game/roles/setupCounts')
const {
  formatDashboardPlayer
} = require('./fakePlayers')
const {
  updateControlPayload
} = require('./randomRoleButton')

function createRoleButtonHandler({
  dashboardState,
  gameLifecycle,
  getDashboardPlayerLabels,
  handleDashboardLifecycleResult
}) {
  return async function handleRoleButton(interaction, context) {
    if (!isRoleButton(interaction.customId)) return null

    const playerId = dashboardState.getSelectedPlayer(interaction.guild.id, interaction.member.id)
    if (!playerId) {
      return editDashboardFailure(interaction, {
        title: 'Select a player',
        message: 'Choose a player from the dashboard first.',
        suggestion: 'Use the player dropdown, then choose Assign Role again.'
      })
    }

    if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.clearRoleButton) {
      const result = await gameLifecycle.clearScriptRole(interaction.guild.id, interaction.member, playerId)
      return handleDashboardLifecycleResult(
        interaction,
        context,
        result,
        result.ok ? `Cleared the role for ${formatDashboardPlayer(context, playerId)}.` : null
      )
    }

    const teamChoice = parseRoleTeamButton(interaction.customId)
    if (teamChoice) {
      const playerLabels = await getDashboardPlayerLabels(interaction.client, interaction.guild.id, context.view)
      return updateControlPayload(
        interaction,
        createRolePanelPayload(context.view, playerId, playerLabels, teamChoice.team)
      )
    }

    const drunkChoice = parseDrunkShownRoleButton(interaction.customId)
    if (drunkChoice) {
      const result = await gameLifecycle.setDrunkShownRole(
        interaction.guild.id,
        interaction.member,
        playerId,
        drunkChoice.roleId
      )
      const labels = result.ok
        ? await getDashboardPlayerLabels(interaction.client, interaction.guild.id, result.view)
        : null
      if (result.ok) {
        return updateControlPayload(interaction, createRolePanelPayload(result.view, playerId, labels, 'townsfolk'))
      }
      return handleDashboardLifecycleResult(interaction, context, result)
    }

    const roleChoice = parseRoleChoiceButton(interaction.customId)
    if (roleChoice) {
      const result = await gameLifecycle.assignScriptRole(
        interaction.guild.id,
        interaction.member,
        playerId,
        roleChoice.roleId
      )
      if (result.ok && roleChoice.roleId === DRUNK_ROLE_ID) {
        const labels = await getDashboardPlayerLabels(interaction.client, interaction.guild.id, result.view)
        return updateControlPayload(interaction, createRolePanelPayload(result.view, playerId, labels, roleChoice.team))
      }
      return handleDashboardLifecycleResult(
        interaction,
        context,
        result,
        result.ok ? `Assigned ${result.roleName || roleChoice.roleId} to ${formatDashboardPlayer(context, playerId)}.` : null
      )
    }

    const playerLabels = await getDashboardPlayerLabels(interaction.client, interaction.guild.id, context.view)
    return updateControlPayload(
      interaction,
      createRolePanelPayload(context.view, playerId, playerLabels)
    )
  }
}

function isRoleButton(customId) {
  return customId === STORYTELLER_DASHBOARD_ACTIONS.rolePanel ||
    customId === STORYTELLER_DASHBOARD_ACTIONS.clearRoleButton ||
    !!parseRoleTeamButton(customId) ||
    !!parseRoleChoiceButton(customId) ||
    !!parseDrunkShownRoleButton(customId)
}

function parseRoleTeamButton(customId) {
  const prefix = `${STORYTELLER_DASHBOARD_ACTIONS.rolePanel}:`
  if (!String(customId || '').startsWith(prefix)) return null
  const team = String(customId).slice(prefix.length)
  if (!ROLE_TEAMS.includes(team)) return null
  return { team }
}

function parseRoleChoiceButton(customId) {
  const prefix = `${STORYTELLER_DASHBOARD_ACTIONS.roleSelect}:`
  if (!String(customId || '').startsWith(prefix)) return null
  const [team, ...roleParts] = String(customId).slice(prefix.length).split(':')
  if (!ROLE_TEAMS.includes(team)) return null
  const roleId = roleParts.join(':')
  if (!roleId) return null
  return { team, roleId }
}

function parseDrunkShownRoleButton(customId) {
  const prefix = `${STORYTELLER_DASHBOARD_ACTIONS.drunkShownRole}:`
  if (!String(customId || '').startsWith(prefix)) return null
  const roleId = String(customId).slice(prefix.length)
  if (!roleId) return null
  return { roleId }
}

module.exports = {
  createRoleButtonHandler,
  isRoleButton,
  parseDrunkShownRoleButton,
  parseRoleChoiceButton,
  parseRoleTeamButton
}
