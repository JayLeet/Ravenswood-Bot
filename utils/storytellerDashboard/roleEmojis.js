const HIDDEN_ROLE_EMOJI = '❔'

const TEAM_EMOJIS = Object.freeze({
  townsfolk: '🌞',
  outsider: '🌙',
  minion: '🐍',
  demon: '🔥',
  unknown: '🎭'
})

const ROLE_EMOJIS = Object.freeze({
  washerwoman: '🧺',
  librarian: '📚',
  investigator: '🔎',
  chef: '👨‍🍳',
  empath: '💗',
  fortune_teller: '🔮',
  undertaker: '🪏',
  monk: '✝️',
  ravenkeeper: '🐦‍⬛',
  virgin: '💍',
  slayer: '🏹',
  soldier: '🛡️',
  mayor: '🏛️',
  butler: '🤵',
  drunk: '🍺',
  recluse: '🪔',
  saint: '🪽',
  poisoner: '🧪',
  spy: '🕵️',
  scarlet_woman: '💋',
  baron: '🎩',
  imp: '🔱',
  grandmother: '👵',
  sailor: '⚓',
  chambermaid: '🧹',
  exorcist: '📖',
  innkeeper: '🍻',
  gambler: '🎲',
  gossip: '💬',
  courtier: '🍷',
  professor: '⚛️',
  minstrel: '🎻',
  tea_lady: '🫖',
  pacifist: '🕊️',
  fool: '🤡',
  goon: '🥸',
  lunatic: '🌀',
  tinker: '🔧',
  moonchild: '🌙',
  godfather: '🥀',
  devils_advocate: '⚖️',
  assassin: '🗡️',
  mastermind: '🪑',
  zombuul: '🧟',
  pukka: '🐍',
  shabaloth: '🦷',
  po: '🩸',
  clockmaker: '🕰️',
  dreamer: '💤',
  snake_charmer: '🐍',
  mathematician: '📐',
  flowergirl: '🌸',
  town_crier: '🔔',
  oracle: '👁️',
  savant: '🦽',
  seamstress: '✂️',
  philosopher: '🚬',
  artist: '🎨',
  juggler: '🤹',
  sage: '🕯️',
  mutant: '🎪',
  sweetheart: '🎀',
  barber: '💈',
  klutz: '🍌',
  evil_twin: '👯',
  witch: '🧙',
  cerenovus: '🧠',
  pit_hag: '🫕',
  fang_gu: '🐉',
  vigormortis: '💀',
  no_dashii: '🐙',
  vortox: '🌪️'
})

function getRoleEmoji(view, roleId) {
  if (!roleId) return TEAM_EMOJIS.unknown
  return ROLE_EMOJIS[roleId] || getTeamEmoji(getRoleTeam(view, roleId))
}

function getTeamEmoji(team) {
  return TEAM_EMOJIS[team] || TEAM_EMOJIS.unknown
}

function getRoleTeam(view, roleId) {
  for (const [team, roleIds] of Object.entries(view?.engine?.roleCategories || {})) {
    if ((roleIds || []).includes(roleId)) return team
  }
  return 'unknown'
}

module.exports = {
  HIDDEN_ROLE_EMOJI,
  ROLE_EMOJIS,
  TEAM_EMOJIS,
  getRoleEmoji,
  getRoleTeam,
  getTeamEmoji
}
