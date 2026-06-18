const {
  formatMissingBotPermissions,
  getMissingBotSetupPermissions
} = require('../systems/discord/permissions')
const {
  findExistingAutoSetupCategory
} = require('./setupAutoCategory')

async function preflightSetupPermissions(guild) {
  const existingSetupCategory = await findExistingAutoSetupCategory(guild)
  const missingPermissions = getMissingBotSetupPermissions(guild, { existingSetupCategory })
  if (!missingPermissions.length) return null
  return { message: formatMissingBotPermissions(missingPermissions) }
}

module.exports = {
  preflightSetupPermissions
}
