/** @type {import('../../../types').ScriptRole[]} */
module.exports = [
  {
    id: 'imp',
    name: 'Imp',
    team: 'demon',
    ability: 'Each night except the first, choose a player. They die. If you kill yourself this way, a Minion becomes the Imp.',
    wakes: ['Each other night'],
    howItWorks: 'The Imp chooses a night target to attack. If the Imp attacks themself, the Demon role can pass to a living Minion.',
    limitations: [
      'Does not usually act on the first night.',
      'Protection, drunkenness, poisoning, and Storyteller rulings may change the result.'
    ]
  }
]
