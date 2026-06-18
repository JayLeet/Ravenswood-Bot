function getBotUserId(guild, fallback = null) {
  return guild?.client?.user?.id || guild?.members?.me?.id || fallback
}

module.exports = {
  getBotUserId
}
