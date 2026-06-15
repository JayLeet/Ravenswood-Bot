/** @type {import('../../../types').ScriptRole[]} */
module.exports = [
  {
    id: 'butler',
    name: 'Butler',
    team: 'outsider',
    ability: 'Each night, choose a master. The next day, you may only vote if your master votes too.',
    wakes: ['First night', 'Each other night'],
    howItWorks: 'You choose another player as your master. During the next day, your vote is only valid if your master is voting.',
    limitations: [
      'You may still raise your hand, but the Storyteller determines whether the vote counts.',
      'This is often best handled with Storyteller oversight.'
    ]
  },
  {
    id: 'drunk',
    name: 'Drunk',
    team: 'outsider',
    ability: 'You do not know you are the Drunk. You think you are a Townsfolk character, but you have no ability.',
    wakes: [],
    howItWorks: 'The Drunk is shown a Townsfolk character and believes they are that character, but their ability does not work.',
    limitations: [
      'The Drunk should usually receive the role information for the character they believe they are.'
    ],
    notes: [
      'Storyteller discretion is important for Drunk information.'
    ]
  },
  {
    id: 'recluse',
    name: 'Recluse',
    team: 'outsider',
    ability: 'You might register as evil, as a Minion, or as a Demon, even if dead.',
    wakes: [],
    howItWorks: 'The Storyteller may choose to make the Recluse appear evil or as an evil character type to abilities and effects.',
    limitations: [
      'Registration is Storyteller-controlled and can vary by situation.',
      'The Recluse is still actually good.'
    ]
  },
  {
    id: 'saint',
    name: 'Saint',
    team: 'outsider',
    ability: 'If you are executed, evil wins.',
    wakes: [],
    howItWorks: 'If the Saint dies by execution, the evil team wins immediately.',
    limitations: [
      'Only execution triggers this ability.',
      'Night death does not trigger the Saint loss condition.'
    ]
  }
]
