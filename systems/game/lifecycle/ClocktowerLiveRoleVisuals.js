const {
  shouldUseClocktowerLiveRoleVisuals
} = require('../../../utils/clocktowerLiveRoles')

async function createClocktowerLiveFirstNightInfo(manager, game, member) {
  if (!shouldUseClocktowerLiveRoleVisuals(manager, game)) return []
  if (game.day !== 1 || game.phase !== 'night') return []

  const actions = []
  for (const playerId of manager.getPlayerIds(game)) {
    const roleId = game.roles?.[playerId]
    const role = roleId ? manager.scripts.getRole(game.scriptId, roleId) : null
    if (!role || hasFirstNightInfoAction(game, playerId, roleId)) continue

    const action = manager.nightActions.createTargetAction(game, {
      guildId: game.guildId,
      playerId,
      roleId,
      createdBy: member?.id || game.storytellerId,
      source: 'role_visuals',
      autoPrompt: true,
      behaviorId: roleId,
      roleName: role.name,
      prompt: null,
      targetType: 'self',
      targetCount: 1,
      infoOnly: true,
      skipRoleHook: true,
      purpose: 'first_night_info'
    })

    actions.push(action)
    await manager.emit('NIGHT_ACTION_CREATED', {
      game,
      member,
      playerId,
      action,
      source: 'role_visuals',
      reason: 'clocktower-live-role-info'
    })
  }

  return actions
}

function hasFirstNightInfoAction(game, playerId, roleId) {
  return (game.nightActions || []).some(action =>
    action.day === 1 &&
    action.phase === 'night' &&
    action.playerId === playerId &&
    action.roleId === roleId &&
    action.purpose === 'first_night_info'
  )
}

module.exports = {
  createClocktowerLiveFirstNightInfo,
  hasFirstNightInfoAction
}
