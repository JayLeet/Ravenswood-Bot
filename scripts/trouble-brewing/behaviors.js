const {
  killTarget,
  markExclusiveStatus,
  markStatus,
  recordTarget
} = require('../../systems/game/roles/behaviorEffects')
const hooks = require('./roleHooks')

const receivedInfo = prompt => ({
  prompt,
  target: 'self',
  receiptKind: 'received_info'
})

/** @type {Record<string, import('../../types').RoleBehaviorDefinition>} */
module.exports = {
  washerwoman: {
    nightAction: receivedInfo('Acknowledge your Washerwoman information.'),
    onNight: hooks.acknowledgeInfo('Washerwoman information was delivered.')
  },

  librarian: {
    nightAction: receivedInfo('Acknowledge your Librarian information.'),
    onNight: hooks.acknowledgeInfo('Librarian information was delivered.')
  },

  investigator: {
    nightAction: receivedInfo('Acknowledge your Investigator information.'),
    onNight: hooks.acknowledgeInfo('Investigator information was delivered.')
  },

  chef: {
    nightAction: receivedInfo('Acknowledge your Chef number.'),
    onNight: hooks.chefInfo
  },

  empath: {
    nightAction: receivedInfo('Acknowledge your Empath number.'),
    onNight: hooks.empathInfo
  },

  fortune_teller: {
    nightAction: {
      prompt: 'Choose two players to check.',
      target: 'player',
      targetCount: 2
    },
    onNight: hooks.fortuneTellerInfo
  },

  undertaker: {
    nightAction: {
      prompt: 'Acknowledge the executed player character.',
      target: 'self',
      receiptKind: 'received_info',
      condition: hooks.hasExecutedPlayer
    },
    onNight: hooks.undertakerInfo
  },

  ravenkeeper: {
    onDeath: hooks.ravenkeeperWake,
    onNight: hooks.revealTargetRole
  },

  saint: {
    onExecution: hooks.saintExecution
  },

  soldier: {
    preventsDemonKill: true
  },

  mayor: {
    modifyVote: hooks.mayorNoExecutionWin
  },

  butler: {
    nightAction: {
      prompt: 'Choose your master for this voting day.',
      target: 'living-player'
    },
    onNight: recordTarget('The Butler chose a master.')
  },

  imp: {
    nightAction: {
      prompt: 'Choose a player to attack.',
      target: 'player'
    },
    onNight: killTarget
  },

  monk: {
    nightAction: {
      prompt: 'Choose a player to protect tonight.',
      target: 'living-player',
      allowSelf: false
    },
    onNight: markStatus('protected', 'The target is protected tonight.'),
    onPhaseStart: hooks.clearStatusOnPhase('protected', 'day')
  },

  poisoner: {
    nightAction: {
      prompt: 'Choose a player to poison.',
      target: 'player'
    },
    onNight: markExclusiveStatus('poisoned', 'The target is poisoned until tomorrow night.'),
    onPhaseStart: hooks.clearStatusOnPhase('poisoned', 'night')
  },

  scarlet_woman: {
    onDemonDeath: hooks.scarletWomanCatch
  },

  spy: {
    nightAction: {
      prompt: 'Review the Grimoire.',
      target: 'self'
    },
    onNight: hooks.acknowledgeInfo('Spy viewed the Grimoire.')
  }
}
