function createVoteMarkerLegendField() {
  return {
    name: 'Vote markers',
    value: [
      '✅ counted yes • ❌ counted no • ✋ raised • 🪬 ghost raised',
      '❔ pending • 👻❔ ghost vote available • 💀 ghost vote spent'
    ].join('\n'),
    inline: false
  }
}

function getVoteMarker(userId, { counted = [], yesIds = [], deadIds = [], deadVotes = {} } = {}) {
  const countedSet = new Set(counted || [])
  const yes = yesIds.includes(userId)
  const isDead = deadIds.includes(userId)

  if (countedSet.has(userId)) return yes ? '✅' : '❌'
  if (yes) return isDead ? '🪬' : '✋'
  if (isDead) return deadVotes[userId] !== false ? '👻❔' : '💀'
  return '❔'
}

function formatVoterName(userId, playerLabels, options = {}) {
  const label = playerLabels[userId] || `Player ${String(userId).slice(-4)}`
  return `${getVoteMarker(userId, options)} ${label}`
}

function createSeatLayout(playerCount) {
  const hasSouthSeat = playerCount % 2 === 0
  const southIndex = hasSouthSeat ? Math.floor(playerCount / 2) : null
  const leftEnd = hasSouthSeat ? southIndex + 1 : Math.ceil(playerCount / 2)
  const rightEnd = hasSouthSeat ? southIndex - 1 : Math.floor(playerCount / 2)

  return {
    leftIndexes: createDescendingRange(playerCount - 1, leftEnd),
    rightIndexes: createAscendingRange(1, rightEnd),
    southIndex
  }
}

function createAscendingRange(start, end) {
  const values = []
  for (let index = start; index <= end; index += 1) values.push(index)
  return values
}

function createDescendingRange(start, end) {
  const values = []
  for (let index = start; index >= end; index -= 1) values.push(index)
  return values
}

module.exports = {
  createSeatLayout,
  createVoteMarkerLegendField,
  formatVoterName,
  getVoteMarker
}
