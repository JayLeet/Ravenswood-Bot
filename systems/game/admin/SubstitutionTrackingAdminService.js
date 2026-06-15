const AdminGameService = require('./AdminGameService')
const {
  createSubstitutionHistory
} = require('./substitutionHistory')

class SubstitutionTrackingAdminService extends AdminGameService {
  substitutePlayer(manager, game, oldPlayerId, requestedMember) {
    const previousUser = game.users?.[oldPlayerId] || {}
    const result = super.substitutePlayer(manager, game, oldPlayerId, requestedMember)
    if (!result.ok) return result

    const newPlayerId = requestedMember.id
    if (game.users?.[newPlayerId]) {
      game.users[newPlayerId].substitutionHistory = createSubstitutionHistory(
        previousUser,
        oldPlayerId,
        newPlayerId
      )
    }

    return result
  }
}

module.exports = SubstitutionTrackingAdminService
