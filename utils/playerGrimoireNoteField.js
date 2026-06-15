function createSelectedPlayerNoteField(view, selectedTargetId, notes = {}, playerLabels = {}) {
  if (!selectedTargetId) return null

  const note = String(notes?.[selectedTargetId]?.note || '').trim()
  if (!note) return null

  const name = playerLabels[selectedTargetId] ||
    view?.users?.displayNames?.[selectedTargetId] ||
    `<@${selectedTargetId}>`
  const value = `Private note: ${note}`

  return {
    name: `Private details: ${name}`,
    value: value.length <= 1024 ? value : `${value.slice(0, 1021)}...`,
    inline: false
  }
}

module.exports = {
  createSelectedPlayerNoteField
}
