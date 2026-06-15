async function runPlayerChoice(interaction, deps) {
  const { gameLifecycle, nominatorId } = deps
  const nomineeId = interaction.values[0]

  const result = await gameLifecycle.createNomination(
    interaction.guild.id,
    interaction.member,
    nomineeId,
    { nominatorId }
  )

  return { result, nominatorId, nomineeId }
}

module.exports = {
  runPlayerChoice
}
