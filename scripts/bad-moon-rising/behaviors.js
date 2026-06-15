const {
  executionShield,
  teaLadyExecutionShield,
  markExclusiveStatus
} = require('../../systems/game/roles/behaviorEffects')
const hooks = require('../trouble-brewing/roleHooks')

/** @type {Record<string, import('../../types').RoleBehaviorDefinition>} */
module.exports = {
  devils_advocate: {
    nightAction: {
      prompt: 'Choose a living player to protect from execution tomorrow.',
      target: 'living-player'
    },
    onNight: markExclusiveStatus('protected', 'The target is protected from execution.'),
    onPhaseStart: hooks.clearStatusOnPhase('protected', 'night')
  },

  fool: {
    executionShield: executionShield('fool', { consumesFool: true })
  },

  sailor: {
    executionShield: executionShield('sailor'),
    preventsDemonKill: true
  },

  tea_lady: {
    executionShield: teaLadyExecutionShield
  },

  pukka: {
    nightAction: {
      prompt: 'Choose a player to poison.',
      target: 'player'
    },
    onNight: markExclusiveStatus('poisoned', 'The target is poisoned by the Pukka.')
  },

  zombuul: {
    onDeath: recordZombuulDeath,
    onExecution: recordZombuulDeath
  }
}

async function recordZombuulDeath({ game, playerId }) {
  game.zombuulDeaths ??= {}
  const deaths = Number(game.zombuulDeaths[playerId] || 0) + 1
  game.zombuulDeaths[playerId] = deaths

  if (deaths === 1) {
    return {
      summary: 'The Zombuul died for the first time and still counts as the living Demon.',
      hiddenAlive: true
    }
  }

  return {
    summary: 'The Zombuul died again and no longer counts as a living Demon.',
    hiddenAlive: false
  }
}
