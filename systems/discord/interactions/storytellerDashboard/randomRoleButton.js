const {
  createRandomRolesDrunkShownPayload,
  createRandomRolesPayload,
  getDraftRoleIds,
  getRandomRoleTeamLimit,
  isRandomRoleTeamFull,
  STORYTELLER_DASHBOARD_ACTIONS
} = require('../../embeds')
const {
  acknowledgeInteraction,
  editDashboardFailure,
  editInteractionReply
} = require('../feedback')

function createRandomRoleButtonHandler({
  dashboardState,
  gameLifecycle,
  handleDashboardLifecycleResult
}) {
  return async function handleRandomRoleButton(interaction, context) {
    const teamChoice = parseRandomRoleTeamButton(interaction.customId)
    if (teamChoice) {
      const draft = dashboardState.setRandomRoleDraftTeam(
        interaction.guild.id,
        interaction.member.id,
        'selectedTeam',
        []
      )
      draft.selectedTeam = teamChoice.team
      return updateControlPayload(interaction, createRandomRolesPayload(context.view, draft))
    }

    const toggle = parseRandomRoleToggleButton(interaction.customId)
    if (toggle) {
      const current = dashboardState.getRandomRoleDraft(interaction.guild.id, interaction.member.id)
      const selected = new Set(current[toggle.team] || [])
      const playerCount = context.view.users.players?.length || 0
      const isSelected = selected.has(toggle.roleId)
      if (!isSelected && isRandomRoleTeamFull(playerCount, current, toggle.team)) {
        return editDashboardFailure(interaction, {
          title: `${formatTeamName(toggle.team)} count reached`,
          message: `You already selected ${getRandomRoleTeamLimit(playerCount, current, toggle.team)} ${formatTeamName(toggle.team)} role(s).`,
          suggestion: `Unselect a chosen ${formatTeamName(toggle.team)} role before selecting a different one.`
        })
      }

      if (isSelected) selected.delete(toggle.roleId)
      else selected.add(toggle.roleId)
      const draft = dashboardState.setRandomRoleDraftTeam(
        interaction.guild.id,
        interaction.member.id,
        toggle.team,
        [...selected]
      )
      draft.selectedTeam = toggle.team
      return updateControlPayload(interaction, createRandomRolesPayload(context.view, draft))
    }

    const drunkShown = parseRandomRoleDrunkShownButton(interaction.customId)
    if (drunkShown) {
      const draft = dashboardState.setRandomRoleDraftDrunkShown(
        interaction.guild.id,
        interaction.member.id,
        drunkShown.roleId
      )
      return updateControlPayload(interaction, createRandomRolesDrunkShownPayload(context.view, draft))
    }

    if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.randomRolesConfirm) {
      return handleRandomRoleConfirm(interaction, context, {
        dashboardState,
        gameLifecycle,
        handleDashboardLifecycleResult
      })
    }

    if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.randomRolesDrunkShown) {
      const draft = dashboardState.getRandomRoleDraft(interaction.guild.id, interaction.member.id)
      return updateControlPayload(interaction, createRandomRolesDrunkShownPayload(context.view, draft))
    }

    if (interaction.customId === STORYTELLER_DASHBOARD_ACTIONS.randomRolesBack) {
      const draft = dashboardState.getRandomRoleDraft(interaction.guild.id, interaction.member.id)
      return updateControlPayload(interaction, createRandomRolesPayload(context.view, draft))
    }

    if (interaction.customId !== STORYTELLER_DASHBOARD_ACTIONS.randomRoles) return null

    if (context.view.state !== 'lobby') {
      return editDashboardFailure(interaction, {
        title: 'Lobby only',
        message: 'Random role distribution is only available before the game starts.',
        suggestion: 'Use manual Storyteller controls for any mid-game role changes.'
      })
    }

    const playerCount = context.view.users.players?.length || 0
    if (!playerCount) {
      return editDashboardFailure(interaction, {
        title: 'No players',
        message: 'Add players before randomizing roles.',
        suggestion: 'Have players join first, then open Randomize Roles again.'
      })
    }

    dashboardState.clearRandomRoleDraft(interaction.guild.id, interaction.member.id)
    return updateControlPayload(interaction, createRandomRolesPayload(context.view, {}))
  }
}

async function handleRandomRoleConfirm(interaction, context, deps) {
  const { dashboardState, gameLifecycle, handleDashboardLifecycleResult } = deps
  const draft = dashboardState.getRandomRoleDraft(interaction.guild.id, interaction.member.id)
  const roleIds = getDraftRoleIds(draft)
  const playerCount = context.view.users.players?.length || 0

  if (roleIds.length !== playerCount) {
    return editDashboardFailure(interaction, {
      title: 'Wrong role count',
      message: `Select exactly ${playerCount} real role(s) before confirming.`,
      suggestion: 'If the Drunk is selected, choose their shown Townsfolk separately; do not add it as an extra real role.'
    })
  }

  const result = await gameLifecycle.assignRandomScriptRoles(
    interaction.guild.id,
    interaction.member,
    roleIds,
    { drunkShownRoleId: draft.drunkShownRoleId || null }
  )

  if (!result.ok) return handleDashboardLifecycleResult(interaction, context, result, null)

  dashboardState.clearRandomRoleDraft(interaction.guild.id, interaction.member.id)
  return handleDashboardLifecycleResult(
    interaction,
    context,
    result,
    formatRandomAssignments(result.assignments)
  )
}

function parseRandomRoleTeamButton(customId) {
  const prefix = `${STORYTELLER_DASHBOARD_ACTIONS.randomRolesSelect}:team:`
  if (!String(customId || '').startsWith(prefix)) return null
  return { team: String(customId).slice(prefix.length) }
}

function parseRandomRoleToggleButton(customId) {
  const prefix = `${STORYTELLER_DASHBOARD_ACTIONS.randomRolesSelect}:toggle:`
  if (!String(customId || '').startsWith(prefix)) return null
  const [team, ...roleParts] = String(customId).slice(prefix.length).split(':')
  const roleId = roleParts.join(':')
  if (!team || !roleId) return null
  return { team, roleId }
}

function parseRandomRoleDrunkShownButton(customId) {
  const prefix = `${STORYTELLER_DASHBOARD_ACTIONS.randomRolesDrunkShownSelect}:`
  if (!String(customId || '').startsWith(prefix)) return null
  const roleId = String(customId).slice(prefix.length)
  if (!roleId) return null
  return { roleId }
}

function formatRandomAssignments(assignments = []) {
  if (!assignments.length) return 'No roles were assigned.'

  return [
    'Random roles assigned:',
    '',
    ...assignments.map(assignment => {
      const shown = assignment.shownRoleName
        ? ` (shown as ${assignment.shownRoleName})`
        : ''
      return `<@${assignment.playerId}>: ${assignment.roleName}${shown}`
    }),
    '',
    'If the Storyteller changes their mind later, select the Drunk player, open Assign Role, and change "Drunk thinks they are".'
  ].join('\n')
}

async function updateControlPayload(interaction, payload) {
  if (typeof interaction.botcUpdateDashboardPayload === 'function') {
    await interaction.botcUpdateDashboardPayload(payload)
    await acknowledgeInteraction(interaction)
    return true
  }

  return editInteractionReply(interaction, payload)
}

function formatTeamName(team) {
  const names = {
    demon: 'Demon',
    minion: 'Minion',
    outsider: 'Outsider',
    townsfolk: 'Townsfolk'
  }
  return names[team] || 'Team'
}

module.exports = {
  createRandomRoleButtonHandler,
  formatRandomAssignments,
  formatTeamName,
  handleRandomRoleConfirm,
  parseRandomRoleDrunkShownButton,
  parseRandomRoleTeamButton,
  parseRandomRoleToggleButton,
  updateControlPayload
}
