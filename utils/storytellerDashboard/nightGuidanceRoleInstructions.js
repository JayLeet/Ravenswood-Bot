const ROLE_INSTRUCTIONS = {
  washerwoman: ({ player }) => [
    '🧺 Washerwoman info:',
    `Tell ${player} two players and one Townsfolk character.`,
    'One of those two players should be that Townsfolk character.'
  ],
  librarian: ({ player }) => [
    '📚 Librarian info:',
    `Tell ${player} two players and one Outsider character, or that no Outsiders are in play.`
  ],
  investigator: ({ player }) => [
    '🔎 Investigator info:',
    `Tell ${player} two players and one Minion character.`,
    'One of those two players should be that Minion character.'
  ],
  chef: ({ player }) => [
    '👨‍🍳 Chef number:',
    `Tell ${player} how many pairs of evil players sit next to each other.`
  ],
  empath: ({ player }) => [
    '💗 Empath number:',
    `Tell ${player} how many of their two nearest living neighbors are evil.`
  ],
  fortune_teller: ({ player }) => [
    '🔮 Fortune Teller check:',
    `Have ${player} choose two players.`,
    'Tell them whether either chosen player registers as the Demon.'
  ],
  undertaker: ({ player }) => [
    '🪏 Undertaker info:',
    `Tell ${player} which character was executed today.`
  ],
  monk: ({ player }) => [
    '✝️ Monk protection:',
    `Have ${player} choose one player other than themself.`,
    'That player is safe from the Demon tonight.'
  ],
  ravenkeeper: ({ player }) => [
    '🐦‍⬛ Ravenkeeper info:',
    `Have ${player} choose a player, then tell them that player's character.`
  ],
  butler: ({ player }) => [
    '🤵 Butler master:',
    `Have ${player} choose a living player as their master for tomorrow's votes.`
  ],
  poisoner: ({ player }) => [
    '☠️ Poisoner choice:',
    `Have ${player} choose a player to poison tonight and tomorrow day.`
  ],
  spy: () => [
    '🕵️ Spy Grimoire:',
    'The Spy has received a copy of the Grimoire.',
    'Talk with the Spy if they have questions about what they were sent.'
  ],
  imp: ({ player, firstNight }) => firstNight
    ? createDemonBluffInstruction()
    : [
        '🔱 Imp attack:',
        `Have ${player} choose a player to attack.`,
        'If the Imp chooses themself, prepare a Minion to become the Imp.'
      ],

  clockmaker: ({ player }) => [
    '🕰️ Clockmaker number:',
    `Tell ${player} how many steps sit between the Demon and their nearest Minion.`
  ],
  dreamer: ({ player }) => [
    '💤 Dreamer choice:',
    `Have ${player} choose a player.`,
    'Tell them one good character and one evil character; one is correct.'
  ],
  snake_charmer: ({ player }) => [
    '🐍 Snake Charmer choice:',
    `Have ${player} choose a living player.`,
    'If they chose a Demon, swap their characters and poison the old Demon.'
  ],
  mathematician: ({ player }) => [
    '🧮 Mathematician number:',
    `Tell ${player} how many abilities worked abnormally since dawn because of another character.`
  ],
  flowergirl: ({ player }) => [
    '🌸 Flowergirl info:',
    `Tell ${player} whether a Demon voted today.`
  ],
  town_crier: ({ player }) => [
    '📣 Town Crier info:',
    `Tell ${player} whether a Minion nominated today.`
  ],
  oracle: ({ player }) => [
    '🔮 Oracle number:',
    `Tell ${player} how many dead players are evil.`
  ],
  sage: ({ player }) => [
    '🕯️ Sage info:',
    `If the Demon killed ${player}, tell them two players, one of whom is the Demon.`
  ],
  evil_twin: ({ player }) => [
    '👯 Evil Twin info:',
    `Show ${player} their opposing Twin and make sure both Twins learn each other.`
  ],
  witch: ({ player }) => [
    '🧙 Witch curse:',
    `Have ${player} choose a player.`,
    'If that player nominates tomorrow, they die.'
  ],
  cerenovus: ({ player }) => [
    '🎭 Cerenovus madness:',
    `Have ${player} choose a player and a good character.`,
    'That player is mad they are that character tomorrow, or might be executed.'
  ],
  pit_hag: ({ player }) => [
    '🧪 Pit-Hag change:',
    `Have ${player} choose a player and a character for them to become.`,
    'If a Demon is created, deaths tonight are arbitrary.'
  ],
  fang_gu: ({ player, firstNight }) => firstNight
    ? createDemonBluffInstruction()
    : [
        '🐉 Fang Gu attack:',
        `Have ${player} choose a player to attack.`,
        'If this first kills an Outsider, that Outsider becomes the evil Fang Gu.'
      ],
  vigormortis: ({ player, firstNight }) => firstNight
    ? createDemonBluffInstruction()
    : [
        '🪦 Vigormortis attack:',
        `Have ${player} choose a player to attack.`,
        'If a Minion dies this way, track their kept ability and poisoned Townsfolk neighbor.'
      ],
  no_dashii: ({ player, firstNight }) => firstNight
    ? createDemonBluffInstruction()
    : [
        '☣️ No Dashii attack:',
        `Have ${player} choose a player to attack.`,
        'Keep the two Townsfolk neighbors poisoned.'
      ],
  vortox: ({ player, firstNight }) => firstNight
    ? createDemonBluffInstruction()
    : [
        '🌪️ Vortox attack:',
        `Have ${player} choose a player to attack.`,
        'Remember Townsfolk information must be false.'
      ],

  grandmother: ({ player }) => [
    '👵 Grandmother info:',
    `Tell ${player} one good player and that player's character.`
  ],
  sailor: ({ player }) => [
    '⛵ Sailor choice:',
    `Have ${player} choose an alive player.`,
    'Either the Sailor or the chosen player is drunk until dusk.'
  ],
  chambermaid: ({ player }) => [
    '🧹 Chambermaid number:',
    `Have ${player} choose two alive players other than themself.`,
    'Tell them how many of those players woke tonight due to their ability.'
  ],
  exorcist: ({ player }) => [
    '📖 Exorcist choice:',
    `Have ${player} choose a player different from last night.`,
    'If they chose the Demon, tell the Demon who the Exorcist is and do not wake the Demon.'
  ],
  innkeeper: ({ player }) => [
    '🍻 Innkeeper protection:',
    `Have ${player} choose two players.`,
    'They cannot die tonight, but one of them is drunk until dusk.'
  ],
  gambler: ({ player }) => [
    '🎲 Gambler guess:',
    `Have ${player} choose a player and guess that player's character.`,
    'If the guess is wrong, the Gambler dies.'
  ],
  gossip: ({ player }) => [
    '🗣️ Gossip result:',
    `If ${player}'s public statement was true today, choose a player to die tonight.`
  ],
  courtier: ({ player }) => [
    '🍷 Courtier choice:',
    `Have ${player} choose a character.`,
    'That character is drunk for 3 nights and 3 days.'
  ],
  professor: ({ player }) => [
    '⚰️ Professor choice:',
    `Have ${player} choose a dead player.`,
    'If that player is a Townsfolk, they are resurrected.'
  ],
  godfather: ({ player, firstNight }) => firstNight
    ? [
        '🌹 Godfather info:',
        `Tell ${player} which Outsiders are in play.`
      ]
    : [
        '🌹 Godfather kill:',
        `If an Outsider died today, have ${player} choose a player to die tonight.`
      ],
  devils_advocate: ({ player }) => [
    "⚖️ Devil's Advocate protection:",
    `Have ${player} choose a living player.`,
    'If that player is executed tomorrow, they do not die.'
  ],
  assassin: ({ player }) => [
    '🗡️ Assassin kill:',
    `If ${player} uses their once-per-game ability, have them choose a player to die.`
  ],
  pukka: ({ player, firstNight }) => firstNight
    ? [
        '🐡 Pukka poison:',
        `Have ${player} choose a player to poison.`
      ]
    : [
        '🐡 Pukka poison:',
        `Have ${player} choose a player to poison.`,
        'The previously poisoned player dies and becomes healthy.'
      ],
  zombuul: ({ player }) => [
    '🧟 Zombuul attack:',
    `If nobody died today, have ${player} choose a player to attack.`
  ],
  shabaloth: ({ player }) => [
    '🍽️ Shabaloth attack:',
    `Have ${player} choose two players to attack.`,
    'A dead player chosen last night might be regurgitated.'
  ],
  po: ({ player }) => [
    '🔥 Po attack:',
    `Have ${player} choose one player, or no one.`,
    'If the Po chose no one last time, they choose three players tonight.'
  ],
  lunatic: ({ player }) => [
    '🌙 Lunatic info:',
    `Treat ${player} as if they are the Demon from their point of view.`,
    'Give them the fake Demon information needed for that world.'
  ]
}

function createDemonBluffInstruction() {
  return [
    '🔥 Send Demon bluffs:',
    'Use Wake -> More Info -> These characters are not in play.',
    'Choose exactly 3 good characters that are not in play, then Submit.'
  ]
}

module.exports = {
  ROLE_INSTRUCTIONS,
  createDemonBluffInstruction
}
