class RequestNotificationService {
  createJoinRequestNotification(game, request) {
    return `<@${game.storytellerId}> <@${request.userId}> wants to join as a player. Request ID: ${request.id}`
  }

  createReplacementStorytellerNotification(member) {
    return `<@${member.id}> has left as Storyteller. Any user can step in with /become-storyteller.`
  }
}

module.exports = RequestNotificationService
