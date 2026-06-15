function startEndedCommandSideEffects({
  ctx,
  interaction,
  log,
  result,
  sendResultMessages
}) {
  if (!result.cleanupSetupChannels) return false

  Promise.resolve()
    .then(async () => {
      await cleanupBeforeResultMessages(result, ctx)
      await sendResultMessages(interaction, result, ctx)
      await refreshAfterResult(interaction, result, ctx, log)
    })
    .catch(err => {
      log?.recoverable?.('ended-command-side-effects', err, {
        command: interaction.commandName,
        guildId: interaction.guild?.id,
        userId: interaction.user?.id || interaction.member?.id
      })
    })

  return true
}

async function cleanupAfterResult(result, ctx, log = null) {
  if (result.cleanupSetupChannels && ctx?.cleanupSetupChannels) await ctx.cleanupSetupChannels()
  return refreshAfterResult(null, result, ctx, log)
}

async function cleanupBeforeResultMessages(result, ctx) {
  if (!result.cleanupSetupChannels || !ctx?.cleanupSetupChannels) return
  await ctx.cleanupSetupChannels()
  await ctx.cleanupPostGameChannelMessages?.()
}

function refreshAfterResult(interaction, result, ctx = {}, log = null) {
  if (!result.refreshStorytellerDashboard) return null
  if (typeof ctx.postOrUpdateStorytellerDashboard !== 'function') return null
  const client = interaction?.client || ctx.client
  const guildId = interaction?.guild?.id || result.view?.guildId
  if (!client || !guildId) return null
  return ctx.postOrUpdateStorytellerDashboard(client, guildId).catch(err => {
    log?.recoverable?.('refresh-dashboard-after-command-result', err, { guildId })
    return null
  })
}

module.exports = {
  cleanupAfterResult,
  refreshAfterResult,
  startEndedCommandSideEffects
}
