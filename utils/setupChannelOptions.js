function hasAnySetupChannelOption(channels) {
  return Object.values(channels).some(Boolean)
}

function hasAllSetupChannelOptions(channels) {
  return Object.values(channels).every(Boolean)
}

module.exports = {
  hasAllSetupChannelOptions,
  hasAnySetupChannelOption
}
