const {
  createGrimoireRequestSubmittedMessage
} = require('../../../utils/grimoireAccess')
const {
  leaveLivePlayerForReplacement
} = require('./LivePlayerLeaveReplacement')
const {
  getReplaceableFakePlayerId,
  replaceFakeTestPlayerWithMember
} = require('./TestLobbyReplacement')

class MembershipService {
  constructor({ errorTypes }) {
    this.errorTypes = errorTypes
  }

  async join(requests, manager, guildId, member) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(this.errorTypes.NOT_FOUND, 'No game')

    const userId = member.id
    const currentRole = manager.getRole(game, userId)

    if (currentRole && !this.canSpectatorRequestJoinDuringPause(manager, game, member, currentRole)) {
      return manager.createError(this.errorTypes.ALREADY_IN_GAME, 'Already in game')
    }

    if (game.state === 'in-game') {
      const request = requests.createRequest(game, userId, 'join')
      if (!request.ok) return request

      manager.save()

      return manager.createSuccess({
        message: 'Join request sent to the Storyteller.',
        request: request.request,
        publicMessage: requests.createJoinRequestNotification(game, request.request)
      })
    }

    const fakePlayerId = getReplaceableFakePlayerId(game)
    if (fakePlayerId) {
      return this.joinReplacingFakeTestPlayer(
        requests,
        manager,
        guildId,
        game,
        member,
        fakePlayerId
      )
    }

    const playerCount = Object.values(game.users).filter(user => user.role === 'player').length

    if (playerCount >= game.maxPlayers) {
      return manager.createError(this.errorTypes.GAME_FULL, 'Game full')
    }

    const roleAdded = await manager.gameManager.addPlayerRole(member)
    if (!roleAdded) {
      return manager.createError(
        this.errorTypes.TRANSACTION_FAILED,
        'Could not assign Player role'
      )
    }

    manager.setRole(game, userId, 'player')
    manager.addAlivePlayer(game, userId)
    requests.removePendingRequestsForUser(game, userId)
    await manager.gameManager.setNickname(member, 'player')

    await manager.emit('PLAYER_JOINED', { game, member })

    manager.save()

    return manager.createSuccess({
      view: manager.serializeGame(game, { guildId })
    })
  }

  async joinReplacingFakeTestPlayer(requests, manager, guildId, game, member, fakePlayerId) {
    const roleAdded = await manager.gameManager.addPlayerRole(member)
    if (!roleAdded) {
      return manager.createError(
        this.errorTypes.TRANSACTION_FAILED,
        'Could not assign Player role'
      )
    }

    const availableFakePlayerId = game.users?.[fakePlayerId]?.fake === true
      ? fakePlayerId
      : getReplaceableFakePlayerId(game)
    if (!availableFakePlayerId) {
      await manager.gameManager.removePlayerRole?.(member)
      return manager.createError(this.errorTypes.GAME_FULL, 'Game full')
    }

    const replacement = replaceFakeTestPlayerWithMember(game, availableFakePlayerId, member)
    if (!replacement) {
      return manager.createError(this.errorTypes.INVALID_STATE, 'No fake player slot is available')
    }

    requests.removePendingRequestsForUser(game, member.id)
    await manager.gameManager.setNickname(member, 'player')

    await manager.emit('PLAYER_JOINED', {
      game,
      member,
      replacedFakePlayerId: availableFakePlayerId,
      testMode: true
    })

    manager.save()

    return manager.createSuccess({
      replacedFakePlayerId: availableFakePlayerId,
      view: manager.serializeGame(game, { guildId })
    })
  }

  canSpectatorRequestJoinDuringPause(manager, game, member, currentRole) {
    return currentRole === 'spectator' &&
      !!game.paused &&
      !manager.gameManager.hasGrimoireSpectatorRole(member)
  }

  async spectate(requests, manager, guildId, member) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(this.errorTypes.NOT_FOUND, 'No game')

    const userId = member.id

    if (manager.getRole(game, userId)) {
      return manager.createError(this.errorTypes.ALREADY_IN_GAME, 'Already in game')
    }

    const roleAdded = await manager.gameManager.addSpectatorRole(member)
    if (!roleAdded) {
      return manager.createError(
        this.errorTypes.TRANSACTION_FAILED,
        'Could not assign Spectator role'
      )
    }

    manager.setRole(game, userId, 'spectator')
    requests.removePendingRequestsForUser(game, userId)
    await manager.gameManager.setNickname(member, 'spectator')

    await manager.emit('PLAYER_SPECTATED', { game, member })

    manager.save()

    return manager.createSuccess({
      view: manager.serializeGame(game, { guildId })
    })
  }

  async requestGrimoireAccess(requests, manager, guildId, member) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(this.errorTypes.NOT_FOUND, 'No game')

    if (manager.getRole(game, member.id) !== 'spectator') {
      return manager.createError(
        this.errorTypes.PERMISSION_DENIED,
        'Only spectators can request grimoire access.'
      )
    }

    if (manager.gameManager.hasGrimoireSpectatorRole(member)) {
      await manager.gameManager.setNickname(member, 'grimoireSpectator')
      return manager.createSuccess({ alreadyGranted: true })
    }

    const request = requests.createRequest(game, member.id, 'grimoire')
    if (!request.ok) return request

    manager.save()

    return manager.createSuccess({
      message: createGrimoireRequestSubmittedMessage(),
      request: request.request,
      publicMessage: `<@${member.id}> requested grimoire access.`
    })
  }

  async leave(requests, manager, guildId, member) {
    const game = manager.get(guildId)
    if (!game) return manager.createError(this.errorTypes.NOT_FOUND, 'No game')

    const userId = member.id
    const role = manager.getRole(game, userId)

    if (!role) {
      return manager.createError(this.errorTypes.INVALID_STATE, 'Not in game')
    }

    if (role === 'player' && game.state === 'in-game') {
      return leaveLivePlayerForReplacement({
        requests,
        manager,
        guildId,
        game,
        member,
        errorTypes: this.errorTypes
      })
    }

    const wasStoryteller = role === 'storyteller'

    if (role === 'player') {
      const roleRemoved = await manager.gameManager.removePlayerRole(member)
      if (!roleRemoved) {
        return manager.createError(
          this.errorTypes.TRANSACTION_FAILED,
          'Could not remove Player role'
        )
      }
    }
    if (role === 'spectator') {
      const roleRemoved = await manager.gameManager.removeSpectatorRole(member)
      if (!roleRemoved) {
        return manager.createError(
          this.errorTypes.TRANSACTION_FAILED,
          'Could not remove Spectator role'
        )
      }
      await manager.gameManager.removeGrimoireSpectatorRole(member)
    }
    if (role === 'storyteller') {
      const roleRemoved = await manager.gameManager.removeStorytellerRole(member)
      if (!roleRemoved) {
        return manager.createError(
          this.errorTypes.TRANSACTION_FAILED,
          'Could not remove Storyteller role'
        )
      }
    }

    if (wasStoryteller) {
      game.storytellerId = null
    }

    requests.removePendingRequestsForUser(game, userId)
    if (role === 'player') {
      await manager.cleanupNightChannelForUser(member.guild, game, userId)
      await manager.cleanupNightVoiceChannelForUser(member.guild, game, userId)
      manager.removePlayerFromEngine(game, userId)
    }
    manager.removeUser(game, userId)
    await manager.gameManager.restoreNickname(member)

    await manager.emit('PLAYER_LEFT', { game, member })

    const win = manager.evaluateWinConditions(game)
    if (win) return manager.forceEnd(game, win, member.guild)

    if (role === 'player' && manager.hasNoPlayers(game)) {
      return manager.forceEnd(game, {
        winner: 'none',
        reason: `Ended because <@${member.id}> left as the last player`
      }, member.guild)
    }

    if (Object.keys(game.users || {}).length === 0) {
      return manager.forceEnd(game, {
        winner: 'none',
        reason: `Ended because <@${member.id}> left and no participants remain`
      }, member.guild)
    }

    manager.save()

    return manager.createSuccess({
      message: wasStoryteller
        ? 'You left the game. A replacement Storyteller is needed.'
        : 'You left the game.',
      publicMessage: wasStoryteller
        ? this.createStorytellerLeftMessage(requests, game, member)
        : null,
      view: manager.serializeGame(game, { guildId })
    })
  }

  createStorytellerLeftMessage(requests, game, member) {
    const messages = [requests.createReplacementStorytellerNotification(member)]
    if (game.replacementSlot?.oldPlayerId) {
      messages.push('A replacement player is still needed for the paused game.')
    }
    return messages.join('\n')
  }
}

module.exports = MembershipService
