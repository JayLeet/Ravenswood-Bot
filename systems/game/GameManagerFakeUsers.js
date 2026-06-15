function isFakeDiscordUser(userId, user = {}) {
  return user?.fake === true || isFakeDiscordUserId(userId)
}

function isFakeDiscordUserId(userId) {
  return /^(test-player-|fake[_-])/.test(String(userId || ''))
}

module.exports = {
  isFakeDiscordUser,
  isFakeDiscordUserId
}
