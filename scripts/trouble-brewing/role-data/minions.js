/** @type {import('../../../types').ScriptRole[]} */
module.exports = [
  {
    id: 'poisoner',
    name: 'Poisoner',
    team: 'minion',
    ability: 'Each night, choose a player. They are poisoned tonight and tomorrow day.',
    wakes: ['First night', 'Each other night'],
    howItWorks: 'The chosen player has no working ability and may receive false information until the poison wears off.',
    limitations: [
      'Poison timing and cleanup should be tracked carefully.',
      'The Storyteller decides what false information is given.'
    ]
  },
  {
    id: 'spy',
    name: 'Spy',
    team: 'minion',
    ability: 'Each night, you may see the Grimoire. You might register as good or as a Townsfolk or Outsider, even if dead.',
    wakes: ['First night', 'Each other night'],
    howItWorks: 'The Spy gets broad information about the game state, and may appear good to character abilities.',
    limitations: [
      'The exact Grimoire view is Storyteller-controlled.',
      'Registration is Storyteller-controlled and can vary by situation.'
    ]
  },
  {
    id: 'scarlet_woman',
    name: 'Scarlet Woman',
    team: 'minion',
    ability: 'If there are five or more players alive and the Demon dies, you become the Demon.',
    wakes: [],
    howItWorks: 'This keeps the evil team alive by replacing the Demon when the Demon dies with enough living players.',
    limitations: [
      'Only works while there are at least five living players.',
      'Only works if the Scarlet Woman can become the Demon.'
    ]
  },
  {
    id: 'baron',
    name: 'Baron',
    team: 'minion',
    ability: 'There are extra Outsiders in play.',
    wakes: [],
    howItWorks: 'During setup, the Baron changes the character distribution by adding extra Outsiders and reducing Townsfolk.',
    limitations: [
      'This is a setup effect, not an active night ability.',
      'The exact setup change should be handled before the game starts.'
    ]
  }
]
