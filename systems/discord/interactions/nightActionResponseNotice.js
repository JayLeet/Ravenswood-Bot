async function createNightActionResponseNotice({
  action,
  interaction,
  getPlayerLabel,
  getRoleLabel
}) {
  const playerName = await getPlayerLabel(interaction, action.actorId || action.playerId)
  const prompt = formatPrompt(action.prompt)
  const response = await formatResponse(action, interaction, getPlayerLabel, getRoleLabel)

  return [
    `${playerName} submitted a night response.`,
    prompt ? `Prompt: ${prompt}` : null,
    response ? `Response: ${response}` : null
  ].filter(Boolean).join('\n')
}

async function formatResponse(action, interaction, getPlayerLabel, getRoleLabel) {
  if (action.responseText) return action.responseText
  if (action.targetIds?.length) {
    const labels = []
    for (const targetId of action.targetIds) {
      labels.push(await getPlayerLabel(interaction, targetId))
    }
    return labels.join(', ')
  }
  if (action.targetId) return getPlayerLabel(interaction, action.targetId)
  if (action.roleId) return getRoleLabel(interaction, action.roleId)
  return 'Submitted.'
}

function formatPrompt(prompt) {
  const text = String(prompt || '').trim()
  if (!text) return null
  if (text.length <= 500) return text
  return `${text.slice(0, 497)}...`
}

module.exports = {
  createNightActionResponseNotice
}
