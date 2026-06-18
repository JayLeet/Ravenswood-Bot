const { listScripts } = require('../../systems/game/scripts')
const {
  STORYTELLER_PLAYER_ACTIONS
} = require('./constants')
const {
  formatCategory,
  getRoleDisplayName,
  truncate
} = require('./formatters')

function createScriptOptions(view) {
  return listScripts().map(script => ({
    label: truncate(script.name, 100),
    value: script.id,
    description: truncate(script.recommendedFor || 'Official script', 100),
    default: script.id === view.scriptId
  }))
}

function createRoleOptions(view, options = {}) {
  const categories = view.engine.roleCategories || {}
  return Object.entries(categories)
    .flatMap(([category, roles]) => createRoleOptionsForTeam(view, category, roles || [], options))
    .slice(0, 25)
}

function createRoleOptionsForTeam(view, category, roleIds = [], options = {}) {
  const roleOwners = createRoleOwnerLookup(view)
  return roleIds.slice(0, 25).map(role => createRoleOption(view, role, category, roleOwners, options))
}

function createRoleOption(view, role, category, roleOwners, options) {
  const ownerId = roleOwners[role]
  const selectedPlayerId = options.selectedPlayerId || null
  const isCurrent = !!selectedPlayerId && view.engine.roles?.[selectedPlayerId] === role
  const ownerLabel = ownerId
    ? options.playerLabels?.[ownerId] || `Player ${ownerId.slice(-4)}`
    : null

  return {
    label: truncate(`${isCurrent ? 'Current: ' : ''}${getRoleDisplayName(view, role)}`, 100),
    value: role,
    description: truncate(createRoleOptionDescription(category, ownerId, ownerLabel, isCurrent), 100),
    default: isCurrent
  }
}

function createRoleOptionDescription(category, ownerId, ownerLabel, isCurrent) {
  const status = !ownerId
    ? 'Unassigned'
    : isCurrent
      ? 'Assigned to selected player'
      : `Assigned to ${ownerLabel}`

  return `${formatCategory(category)} | ${status}`
}

function createRoleOwnerLookup(view) {
  const owners = {}

  for (const [userId, roleId] of Object.entries(view.engine.roles || {})) {
    if (!roleId || owners[roleId]) continue
    owners[roleId] = userId
  }

  return owners
}

function createPlayerActionOptions() {
  return [
    {
      label: 'Clear role',
      value: STORYTELLER_PLAYER_ACTIONS.clearRole,
      description: 'Remove the assigned script role.'
    },
    {
      label: 'Make nomination',
      value: STORYTELLER_PLAYER_ACTIONS.nominateByPlayer,
      description: 'Selected player nominates a chosen target.'
    },
    {
      label: 'Nominate Storyteller',
      value: STORYTELLER_PLAYER_ACTIONS.storytellerTarget,
      description: 'Selected player nominates the Storyteller when allowed.'
    },
    {
      label: 'Open vote',
      value: STORYTELLER_PLAYER_ACTIONS.openVote,
      description: 'Open anonymous voting for the selected nominee.'
    },
    {
      label: 'Resolve vote',
      value: STORYTELLER_PLAYER_ACTIONS.resolveVote,
      description: 'Close the vote and apply the execution result.'
    },
    {
      label: 'Mark for execution',
      value: STORYTELLER_PLAYER_ACTIONS.markExecutionCandidate,
      description: 'Manually put the selected player on the block.'
    },
    {
      label: 'Kill',
      value: STORYTELLER_PLAYER_ACTIONS.kill,
      description: 'Move the player to the dead list.'
    },
    {
      label: 'Revive',
      value: STORYTELLER_PLAYER_ACTIONS.revive,
      description: 'Move the player back to the alive list.'
    },
    {
      label: 'Mark poisoned',
      value: STORYTELLER_PLAYER_ACTIONS.poisoned,
      description: 'Set poisoned on this player.'
    },
    {
      label: 'Mark drunk',
      value: STORYTELLER_PLAYER_ACTIONS.drunk,
      description: 'Set drunk on this player.'
    },
    {
      label: 'Mark protected',
      value: STORYTELLER_PLAYER_ACTIONS.protected,
      description: 'Set protected on this player.'
    },
    {
      label: 'Quick info',
      value: STORYTELLER_PLAYER_ACTIONS.quickInfo,
      description: 'Open fast private response controls.'
    },
    {
      label: 'Mark evil twin',
      value: STORYTELLER_PLAYER_ACTIONS.evilTwin,
      description: 'Set evil twin on this player.'
    },
    {
      label: 'Mark red herring',
      value: STORYTELLER_PLAYER_ACTIONS.redHerring,
      description: 'Set Fortune Teller red herring on this player.'
    },
    {
      label: 'Clear status',
      value: STORYTELLER_PLAYER_ACTIONS.clearStatus,
      description: 'Remove active Grim markers.'
    },
    {
      label: 'Add reminder',
      value: STORYTELLER_PLAYER_ACTIONS.addReminder,
      description: 'Store a private Storyteller reminder.'
    },
    {
      label: 'Trigger reminder',
      value: STORYTELLER_PLAYER_ACTIONS.triggerReminder,
      description: 'Mark the latest active reminder as triggered.'
    },
    {
      label: 'Wake player',
      value: STORYTELLER_PLAYER_ACTIONS.wake,
      description: 'Open their private night channel and ask for a target.'
    },
    {
      label: 'Resolve night action',
      value: STORYTELLER_PLAYER_ACTIONS.resolveNightAction,
      description: 'Mark the latest submitted target choice as resolved.'
    },
    {
      label: 'Send or edit info',
      value: STORYTELLER_PLAYER_ACTIONS.secretInfo,
      description: 'Review suggested info, edit it, then send privately.'
    }
  ]
}

function getSelectedPlayerId(view, selectedPlayerId) {
  if (!selectedPlayerId) return null
  return (view.users.players || []).includes(selectedPlayerId) ? selectedPlayerId : null
}

module.exports = {
  createPlayerActionOptions,
  createRoleOptions,
  createRoleOptionsForTeam,
  createScriptOptions,
  getSelectedPlayerId
}
