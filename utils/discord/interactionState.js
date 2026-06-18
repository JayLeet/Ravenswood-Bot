function hasInteractionResponse(interaction) {
  return interaction?.deferred === true || interaction?.replied === true
}

module.exports = {
  hasInteractionResponse
}
