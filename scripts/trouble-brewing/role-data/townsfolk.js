/** @type {import('../../../types').ScriptRole[]} */
module.exports = [
  {
    id: 'washerwoman',
    name: 'Washerwoman',
    team: 'townsfolk',
    ability: 'You start knowing that one of two players is a particular Townsfolk character.',
    wakes: ['First night'],
    howItWorks: 'The Storyteller gives you two players and one Townsfolk character. One of those players is that character, unless you are drunk or poisoned.',
    limitations: [
      'Only receives information on the first night.',
      'The information can be false if you are drunk or poisoned.'
    ],
    notes: [
      'The Storyteller may use this to confirm a real Townsfolk or create a believable world for a Drunk.'
    ]
  },
  {
    id: 'librarian',
    name: 'Librarian',
    team: 'townsfolk',
    ability: 'You start knowing that one of two players is a particular Outsider character, or that no Outsiders are in play.',
    wakes: ['First night'],
    howItWorks: 'The Storyteller gives you two players and one Outsider character, or tells you that there are no Outsiders in play.',
    limitations: [
      'Only receives information on the first night.',
      'The information can be false if you are drunk or poisoned.'
    ],
    notes: [
      'If there are no Outsiders in play, the Storyteller may tell the Librarian that.'
    ]
  },
  {
    id: 'investigator',
    name: 'Investigator',
    team: 'townsfolk',
    ability: 'You start knowing that one of two players is a particular Minion character.',
    wakes: ['First night'],
    howItWorks: 'The Storyteller gives you two players and one Minion character. One of those players is that Minion, unless you are drunk or poisoned.',
    limitations: [
      'Only receives information on the first night.',
      'The information can be false if you are drunk or poisoned.'
    ],
    notes: [
      'The Recluse may register as a Minion for this information.'
    ]
  },
  {
    id: 'chef',
    name: 'Chef',
    team: 'townsfolk',
    ability: 'You start knowing how many pairs of evil players are sitting next to each other.',
    wakes: ['First night'],
    howItWorks: 'Count adjacent evil pairs around the circle. Each neighboring evil pair adds one to the number.',
    limitations: [
      'Only receives information on the first night.',
      'The information can be false if you are drunk or poisoned.'
    ],
    notes: [
      'The Recluse may register as evil for this information.'
    ]
  },
  {
    id: 'empath',
    name: 'Empath',
    team: 'townsfolk',
    ability: 'Each night, you learn how many of your two living neighbors are evil.',
    wakes: ['First night', 'Each other night'],
    howItWorks: 'The Storyteller checks your nearest living neighbor clockwise and counterclockwise, then tells you how many are evil.',
    limitations: [
      'Dead players are skipped when finding living neighbors.',
      'The information can be false if you are drunk or poisoned.'
    ],
    notes: [
      'The Recluse may register as evil for this information.'
    ]
  },
  {
    id: 'fortune_teller',
    name: 'Fortune Teller',
    team: 'townsfolk',
    ability: 'Each night, choose two players and learn whether either is the Demon. One good player may falsely register as the Demon.',
    wakes: ['First night', 'Each other night'],
    howItWorks: 'You choose two players. The Storyteller answers yes if at least one chosen player registers as the Demon, otherwise no.',
    limitations: [
      'One good player may be the red herring and register as the Demon.',
      'The information can be false if you are drunk or poisoned.'
    ],
    notes: [
      'The red herring should be tracked by the Storyteller.'
    ]
  },
  {
    id: 'undertaker',
    name: 'Undertaker',
    team: 'townsfolk',
    ability: 'Each night except the first, you learn which character was executed today.',
    wakes: ['Each other night, if a player was executed today'],
    howItWorks: 'If someone was executed during the day, the Storyteller tells you that player\'s character.',
    limitations: [
      'Does not wake on the first night.',
      'Usually only receives information after an execution.',
      'The information can be false if you are drunk or poisoned.'
    ],
    notes: [
      'The Recluse or Spy may register differently to the Undertaker.'
    ]
  },
  {
    id: 'monk',
    name: 'Monk',
    team: 'townsfolk',
    ability: 'Each night except the first, choose a player other than yourself. They are safe from the Demon tonight.',
    wakes: ['Each other night'],
    howItWorks: 'You choose one other player. If the Demon attacks that player tonight, the attack does not kill them.',
    limitations: [
      'Cannot protect yourself.',
      'Does not protect from non-Demon deaths unless the Storyteller rules otherwise.',
      'Has no effect while drunk or poisoned.'
    ]
  },
  {
    id: 'ravenkeeper',
    name: 'Ravenkeeper',
    team: 'townsfolk',
    ability: 'If you die at night, you are woken to choose a player and learn their character.',
    wakes: ['At night, only if you died that night'],
    howItWorks: 'After dying at night, you choose one player. The Storyteller tells you that player\'s character.',
    limitations: [
      'Does not trigger from execution during the day.',
      'The information can be false if you are drunk or poisoned at the relevant time.'
    ]
  },
  {
    id: 'virgin',
    name: 'Virgin',
    team: 'townsfolk',
    ability: 'The first time you are nominated, if the nominator is a Townsfolk, that nominator is executed immediately.',
    wakes: [],
    howItWorks: 'This is a public daytime ability. It can confirm that the nominator registers as Townsfolk if the ability triggers.',
    limitations: [
      'Only the first nomination of the Virgin can trigger this ability.',
      'Does not trigger if the nominator is not a Townsfolk or if the Virgin has no ability.'
    ],
    notes: [
      'The Spy or Recluse may register differently for this ability.'
    ]
  },
  {
    id: 'slayer',
    name: 'Slayer',
    team: 'townsfolk',
    ability: 'Once per game during the day, you may publicly choose a player. If they are the Demon, they die.',
    wakes: [],
    howItWorks: 'The Slayer makes a public shot during the day. If the target is the Demon and the ability works, the target dies.',
    limitations: [
      'Can only use the ability once per game.',
      'Does nothing if the target is not the Demon or the Slayer has no ability.'
    ],
    notes: [
      'The Recluse may register as the Demon for this ability.'
    ]
  },
  {
    id: 'soldier',
    name: 'Soldier',
    team: 'townsfolk',
    ability: 'You are safe from the Demon.',
    wakes: [],
    howItWorks: 'If the Demon attacks you at night, you do not die from that Demon attack.',
    limitations: [
      'Does not protect from execution or non-Demon deaths.',
      'Has no effect while drunk or poisoned.'
    ]
  },
  {
    id: 'mayor',
    name: 'Mayor',
    team: 'townsfolk',
    ability: 'If only three players live and no execution happens, good wins. If you are attacked at night, another player might die instead.',
    wakes: [],
    howItWorks: 'The Mayor can create a good win condition at the end of a day with three living players and no execution.',
    limitations: [
      'The win condition depends on the game reaching the correct end-of-day state.',
      'The night attack redirection is Storyteller-controlled.'
    ]
  }
]
