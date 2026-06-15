function createFakeMember(userId, view = null) {
  const displayName = view?.users?.displayNames?.[userId] || `Test Player ${String(userId).slice(-4)}`

  return {
    id: userId,
    displayName,
    botcFake: true,
    user: {
      id: userId,
      username: displayName
    }
  }
}

function isFakeMember(member) {
  return member?.botcFake === true
}

module.exports = {
  createFakeMember,
  isFakeMember
}
