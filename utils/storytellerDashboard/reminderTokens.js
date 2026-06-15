const REMINDER_TOKENS = Object.freeze([
  ['dead', '💀 Dead'],
  ['poisoned', '☠️ Poisoned'],
  ['drunk', '🍺 Drunk'],
  ['protected', '🛡️ Protected'],
  ['evil_twin', '👯 Evil Twin'],
  ['red_herring', '🎣 Red Herring'],
  ['marked', '✳️ Marked'],
  ['safe', '✅ Safe']
])

const REMINDER_TOKEN_SOURCE_ROLES = Object.freeze({
  dead: [
    'imp',
    'slayer',
    'gossip',
    'assassin',
    'godfather',
    'tinker',
    'moonchild',
    'pukka',
    'shabaloth',
    'po',
    'fang_gu',
    'vigormortis',
    'zombuul'
  ],
  poisoned: [
    'poisoner',
    'pukka',
    'no_dashii',
    'vigormortis'
  ],
  drunk: [
    'drunk',
    'sailor',
    'innkeeper',
    'courtier',
    'minstrel',
    'goon'
  ],
  protected: [
    'monk',
    'soldier',
    'sailor',
    'innkeeper',
    'tea_lady',
    'pacifist',
    'fool',
    'devils_advocate'
  ],
  evil_twin: [
    'evil_twin'
  ],
  red_herring: [
    'fortune_teller'
  ],
  marked: [
    'butler',
    'witch',
    'cerenovus',
    'devils_advocate',
    'moonchild',
    'klutz',
    'barber',
    'snake_charmer',
    'philosopher',
    'artist',
    'juggler'
  ],
  safe: [
    'monk',
    'soldier',
    'sailor',
    'innkeeper',
    'tea_lady',
    'pacifist',
    'fool',
    'devils_advocate'
  ]
})

function getAvailableReminderTokenEntries(view) {
  const inPlayRoleIds = getInPlayRoleIds(view)
  return REMINDER_TOKENS.filter(([type]) => {
    const sourceRoles = REMINDER_TOKEN_SOURCE_ROLES[type] || []
    return sourceRoles.some(roleId => inPlayRoleIds.has(roleId))
  })
}

function getInPlayRoleIds(view) {
  return new Set(Object.values(view.engine?.roles || {}).filter(Boolean))
}

module.exports = {
  REMINDER_TOKENS,
  REMINDER_TOKEN_SOURCE_ROLES,
  getAvailableReminderTokenEntries,
  getInPlayRoleIds
}
