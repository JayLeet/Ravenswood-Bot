const {
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js')
const {
  createPrivateVoiceNoticeSimulationActorCustomId,
  createPrivateVoiceNoticeSimulationTargetCustomId
} = require('../../../utils/privateVoiceRequests')
const {
  getPrivateConversationAccess
} = require('./voiceChannels/dayPrivateAccess')
const {
  createSystemEmbed,
  respondPrivatePayload,
  respondPrivateSystem,
  updateInteraction
} = require('./feedback')

function createTestPrivateVoiceSimulationPayload({ gameLifecycle, game, interaction, action }) {
  const context = createSimulationContext({ gameLifecycle, game, interaction })
  if (!context.ok) return null

  const players = action === 'invite'
    ? context.fakePlayers.filter(playerId => game.playerMadeVoiceChannels?.[playerId])
    : context.fakePlayers
  if (!players.length) {
    return {
      embeds: [createSystemEmbed(
        action === 'invite' ? 'No fake private rooms' : 'No fake players',
        action === 'invite'
          ? 'No fake test player has a private voice room yet. Simulate Start Private Voice first.'
          : 'This test game has no fake players available to simulate.',
        0xe74c3c
      )],
      components: []
    }
  }

  return {
    embeds: [createSystemEmbed(
      action === 'invite' ? 'Choose fake private room' : 'Choose fake player',
      action === 'invite'
        ? 'Choose which fake player owns the room that should send the invite.'
        : 'Choose which fake player should start the private voice chat.',
      0x3498db
    )],
    components: [createSimulationSelectRow({
      customId: createPrivateVoiceNoticeSimulationActorCustomId({
        action,
        guildId: interaction.guild.id
      }),
      game,
      placeholder: action === 'invite' ? 'Choose fake room owner' : 'Choose fake player',
      players,
      view: context.view
    })]
  }
}

async function handleTestPrivateVoiceSimulationActorSelect(interaction, parsed, gameLifecycle) {
  const game = gameLifecycle.get?.(parsed.guildId)
  const context = createSimulationContext({ gameLifecycle, game, interaction })
  if (!context.ok) return respondPrivateSystem(interaction, 'Simulation unavailable', context.message)

  const ownerId = interaction.values?.[0]
  if (!isFakePlayer(gameLifecycle, game, ownerId)) {
    return updateInteraction(interaction, {
      embeds: [createSystemEmbed('Choose a fake player', 'That fake-player choice is no longer valid.')],
      components: []
    })
  }

  const access = getPrivateConversationAccess(game, ownerId)
  if (parsed.action === 'invite' && !game.playerMadeVoiceChannels?.[ownerId]) {
    return updateInteraction(interaction, {
      embeds: [createSystemEmbed(
        'No fake private room',
        `${getPlayerLabel(context.view, game, ownerId)} does not have a private voice room yet.`
      )],
      components: []
    })
  }
  if (access.publicRoom) {
    return updateInteraction(interaction, {
      embeds: [createSystemEmbed(
        'Room already open',
        `${getPlayerLabel(context.view, game, ownerId)}'s private room is already open to all players.`
      )],
      components: []
    })
  }

  const targets = context.fakePlayers
    .filter(playerId => playerId !== ownerId)
    .filter(playerId => !access.invitedPlayerIds.includes(playerId))
  if (!targets.length) {
    return updateInteraction(interaction, {
      embeds: [createSystemEmbed(
        'No fake target available',
        'There are no fake test players left to choose for this private voice action.'
      )],
      components: []
    })
  }

  return updateInteraction(interaction, {
    embeds: [createSystemEmbed(
      parsed.action === 'invite' ? 'Choose fake invite target' : 'Choose fake request target',
      parsed.action === 'invite'
        ? `Choose who ${getPlayerLabel(context.view, game, ownerId)} should invite.`
        : `Choose who ${getPlayerLabel(context.view, game, ownerId)} should start private voice with.`,
      0x3498db
    )],
    components: [createSimulationSelectRow({
      customId: createPrivateVoiceNoticeSimulationTargetCustomId({
        action: parsed.action,
        guildId: parsed.guildId,
        ownerId
      }),
      game,
      placeholder: 'Choose fake target',
      players: targets,
      view: context.view
    })]
  })
}

async function handleTestPrivateVoiceSimulationTargetSelect(interaction, parsed, {
  gameLifecycle,
  gameVoiceChannels
}) {
  const game = gameLifecycle.get?.(parsed.guildId)
  const context = createSimulationContext({ gameLifecycle, game, interaction })
  if (!context.ok) return respondPrivateSystem(interaction, 'Simulation unavailable', context.message)

  const targetId = interaction.values?.[0]
  if (!isFakePlayer(gameLifecycle, game, parsed.ownerId) || !isFakePlayer(gameLifecycle, game, targetId)) {
    return updateInteraction(interaction, {
      embeds: [createSystemEmbed('Choose fake players', 'That fake-player simulation choice is no longer valid.')],
      components: []
    })
  }

  if (typeof gameVoiceChannels?.ensureRequestedPrivateConversation !== 'function') {
    return updateInteraction(interaction, {
      embeds: [createSystemEmbed(
        'Private voice unavailable',
        'The private voice system is not ready, so I could not simulate this action.'
      )],
      components: []
    })
  }

  const access = getPrivateConversationAccess(game, parsed.ownerId)
  const invitedPlayerIds = parsed.action === 'invite'
    ? [...new Set([...access.invitedPlayerIds, targetId])]
    : [parsed.ownerId, targetId]
  const result = await gameVoiceChannels.ensureRequestedPrivateConversation({
    discordClient: interaction.client,
    guildId: parsed.guildId,
    ownerId: parsed.ownerId,
    invitedPlayerIds,
    movePlayerIds: [],
    publicRoom: false
  })

  if (!result.ok) {
    return updateInteraction(interaction, {
      embeds: [createSystemEmbed(
        'Private voice simulation failed',
        result.error?.message || 'The fake private voice action could not be completed.'
      )],
      components: []
    })
  }

  return updateInteraction(interaction, {
    embeds: [createSystemEmbed(
      'Private voice simulated',
      [
        `${getPlayerLabel(context.view, game, parsed.ownerId)} now has a private voice room with ${getPlayerLabel(context.view, game, targetId)}.`,
        'This only simulates fake test-player behavior.'
      ].join('\n'),
      0x2ecc71
    )],
    components: []
  })
}

function createSimulationContext({ gameLifecycle, game, interaction }) {
  if (!game?.testMode) return { ok: false, message: 'Private voice simulation is only available in test games.' }
  const userId = interaction.member?.id || interaction.user?.id || null
  if (!gameLifecycle.isStoryteller?.(game, userId)) {
    return { ok: false, message: 'Only the Storyteller can simulate fake test-player private voice buttons.' }
  }

  const view = gameLifecycle.getGameView?.(interaction.guild.id) || null
  const fakePlayers = getFakePlayers(gameLifecycle, game, view)
  if (!fakePlayers.length) return { ok: false, message: 'This test game has no fake players to simulate.' }
  return { ok: true, fakePlayers, view }
}

function createSimulationSelectRow({ customId, game = null, placeholder, players, view }) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(players.slice(0, 25).map(playerId => ({
        label: truncateSelectLabel(getPlayerLabel(view, game, playerId)),
        value: playerId
      })))
  )
}

function getFakePlayers(gameLifecycle, game, view) {
  const knownPlayerIds = view?.users?.fakePlayers?.length
    ? view.users.fakePlayers
    : Object.keys(game?.users || {})
  return knownPlayerIds.filter(playerId => isFakePlayer(gameLifecycle, game, playerId))
}

function isFakePlayer(gameLifecycle, game, playerId) {
  return Boolean(playerId && gameLifecycle.isFakePlayer?.(game, playerId))
}

function getPlayerLabel(view, game, playerId) {
  return view?.users?.displayNames?.[playerId] ||
    game?.users?.[playerId]?.displayName ||
    `Test Player ${String(playerId || '').replace(/^test-player-/, '')}`
}

function truncateSelectLabel(value, limit = 100) {
  const text = String(value || '')
  return text.length > limit ? text.slice(0, limit) : text
}

module.exports = {
  createTestPrivateVoiceSimulationPayload,
  handleTestPrivateVoiceSimulationActorSelect,
  handleTestPrivateVoiceSimulationTargetSelect
}
