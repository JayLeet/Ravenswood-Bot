const {
  editDashboardLifecycleFailure
} = require('../feedback')
const {
  createNightOrderGuidancePayload
} = require('../../embeds')

async function handleNightOrderRuleButton(interaction, context, parsed, state, deps) {
  if (!['alejo-on', 'alejo-off'].includes(parsed?.action)) return null

  const enabled = parsed.action === 'alejo-on'
  const result = await deps.gameLifecycle.setAlejoRules(interaction.guild.id, interaction.member, enabled)
  if (!result.ok) return editDashboardLifecycleFailure(interaction, result)

  const view = result.view || deps.gameLifecycle.getGameView?.(interaction.guild.id) || context.view
  const labels = await deps.getDashboardPlayerLabels(interaction.client, interaction.guild.id, view)
  await interaction.botcUpdateDashboardStatus?.(
    'Night rule updated',
    enabled ? 'Alejo Rules enabled for this first night.' : 'Alejo Rules disabled for this first night.',
    0x2ecc71
  )
  return deps.updateNightOrderPayload(interaction, createNightOrderGuidancePayload(view, labels, state))
}

module.exports = {
  handleNightOrderRuleButton
}
