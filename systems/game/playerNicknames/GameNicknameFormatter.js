const {
  getVoteMarker
} = require('../../../utils/votingSeatingMap')
const {
  ROLE_EMOJIS,
  TEAM_EMOJIS,
  getRoleEmoji
} = require('../../../utils/storytellerDashboard/roleEmojis')

const NOMINATOR_SUFFIX = '✋'
const NOMINEE_SUFFIX = '🎯'
const EXECUTION_CANDIDATE_SUFFIX = '☠️'
const PERTINENCE_SUFFIX = '\u{1F5E3}\u{2757}\u{FE0F}'
const VOTE_MARKER_PREFIXES = ['✅ ', '❌ ', '✋ ', '🪬 ', '❔ ', '👻❔ ', '💀 ']
const MAX_KNOWN_SEAT_PREFIXES = 20
const SUPERSCRIPT_DIGITS = Object.freeze({
  0: '\u2070',
  1: '\u00B9',
  2: '\u00B2',
  3: '\u00B3',
  4: '\u2074',
  5: '\u2075',
  6: '\u2076',
  7: '\u2077',
  8: '\u2078',
  9: '\u2079'
})

function createPlayerNickname(currentName, game, userId, nicknamePrefixes) {
  const baseName = stripGameNicknameDecorators(currentName, nicknamePrefixes)
  const { prefix, suffix } = getPlayerNicknameParts(game, userId, nicknamePrefixes)
  return `${prefix}${baseName}${suffix}`
}

function getPlayerNicknameParts(game, userId, nicknamePrefixes) {
  const activeNomination = getActiveNomination(game)
  if (activeNomination) {
    return {
      prefix: `${getPlayerSeatPrefix(game, userId)}${getActiveNominationMarker(game, userId, activeNomination)} `,
      suffix: getPlayerNicknameSuffix(game, userId, activeNomination)
    }
  }

  return {
    prefix: `${getPlayerSeatPrefix(game, userId)}${getNormalPlayerPrefix(game, userId, nicknamePrefixes)}`,
    suffix: getPlayerNicknameSuffix(game, userId)
  }
}

function getNormalPlayerPrefix(game, userId, nicknamePrefixes) {
  if (isPlayerRevealed(game, userId)) return `${getPlayerRoleEmoji(game, userId)} `

  const type = getPlayerNicknameType(game, userId)
  return nicknamePrefixes[type]
}

function getPlayerNicknameType(game, userId) {
  if ((game.deadPlayers || []).includes(userId)) {
    return game.deadVotes?.[userId] === false ? 'deadVoteSpent' : 'deadWithVote'
  }

  return 'player'
}

function getActiveNominationMarker(game, userId, nomination) {
  const yesIds = (game.votes || [])
    .filter(vote => vote.nominationId === nomination.id && vote.value === true)
    .map(vote => vote.userId)

  return getVoteMarker(userId, {
    counted: nomination.countedVotePlayerIds || [],
    deadIds: game.deadPlayers || [],
    deadVotes: game.deadVotes || {},
    yesIds
  })
}

function getPlayerNicknameSuffix(game, userId, nomination = null) {
  const suffixes = []

  if (game.executionCandidate?.nomineeId === userId) suffixes.push(EXECUTION_CANDIDATE_SUFFIX)
  if (nomination?.nominatorId === userId) suffixes.push(NOMINATOR_SUFFIX)
  if (nomination?.nomineeId === userId) suffixes.push(NOMINEE_SUFFIX)
  if (nomination?.status === 'seconded' && nomination.pertinencePlayerIds?.includes(userId)) {
    suffixes.push(PERTINENCE_SUFFIX)
  }

  return suffixes.length ? ` ${suffixes.join('')}` : ''
}

function getPlayerSeatPrefix(game, userId) {
  const seatNumber = getPlayerSeatNumber(game, userId)
  return seatNumber ? formatSuperscriptNumber(seatNumber) : ''
}

function getPlayerSeatNumber(game, userId) {
  const playerIds = getGamePlayerIds(game)
  const index = playerIds.indexOf(userId)
  return index >= 0 ? index + 1 : null
}

function getGamePlayerIds(game) {
  return Object.entries(game?.users || {})
    .filter(([, user]) => user.role === 'player')
    .map(([playerId]) => playerId)
}

function formatSuperscriptNumber(value) {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1) return ''
  return String(number)
    .split('')
    .map(digit => SUPERSCRIPT_DIGITS[digit] || '')
    .join('')
}

function stripGameNicknameDecorators(name, nicknamePrefixes) {
  let nextName = String(name || '').trim()
  let changed = true

  while (changed) {
    changed = false
    const strippedPrefix = stripKnownPrefix(nextName, getKnownNicknamePrefixes(nicknamePrefixes))
    if (strippedPrefix !== nextName) {
      nextName = strippedPrefix
      changed = true
    }

    const strippedSuffix = stripKnownSuffix(nextName)
    if (strippedSuffix !== nextName) {
      nextName = strippedSuffix
      changed = true
    }
  }

  return nextName || String(name || '').trim()
}

function stripKnownPrefix(name, prefixes) {
  for (const prefix of prefixes) {
    if (name.startsWith(prefix)) return name.slice(prefix.length).trimStart()
  }
  return name
}

function stripKnownSuffix(name) {
  return String(name || '')
    .replace(/\s*(?:☠️|✋|🎯|\u{1F5E3}\u{2757}\u{FE0F})+\s*$/u, '')
    .trimEnd()
}

function getKnownNicknamePrefixes(nicknamePrefixes) {
  const prefixes = [
    ...VOTE_MARKER_PREFIXES,
    ...Object.values(nicknamePrefixes),
    ...Object.values(ROLE_EMOJIS).flatMap(emoji => [`${emoji}❌ `, `${emoji} `]),
    ...Object.values(TEAM_EMOJIS).map(emoji => `${emoji} `)
  ]

  return [
    ...createKnownSeatPrefixes(prefixes),
    ...prefixes
  ]
}

function createKnownSeatPrefixes(prefixes) {
  const seatPrefixes = []
  for (let seat = 1; seat <= MAX_KNOWN_SEAT_PREFIXES; seat += 1) {
    const seatPrefix = formatSuperscriptNumber(seat)
    for (const prefix of prefixes) seatPrefixes.push(`${seatPrefix}${prefix}`)
  }
  return seatPrefixes
}

function getActiveNomination(game) {
  return [...(game.nominations || [])]
    .reverse()
    .find(nomination =>
      (nomination.day == null || nomination.day === (game.day || 1)) &&
      ['pending_second', 'seconded', 'voting'].includes(nomination.status)
    ) || null
}

function isPlayerRevealed(game, userId) {
  return (game.pendingEndReveal?.revealedPlayers || []).includes(userId)
}

function getPlayerRoleEmoji(game, userId) {
  return getRoleEmoji({ engine: { roleCategories: game.roleCategories || {} } }, game.roles?.[userId])
}

module.exports = {
  createPlayerNickname,
  formatSuperscriptNumber,
  getActiveNomination,
  getKnownNicknamePrefixes,
  getPlayerNicknameParts,
  getPlayerNicknameType,
  getPlayerSeatNumber,
  stripGameNicknameDecorators
}
