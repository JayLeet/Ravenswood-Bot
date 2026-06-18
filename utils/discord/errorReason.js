function getDiscordErrorReason(err) {
  return err?.message || err?.rawError?.message || String(err || 'unknown error')
}

module.exports = {
  getDiscordErrorReason
}
