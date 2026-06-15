const {
  createGrimRevealPayload
} = require('../../embeds')

function createGrimRevealNoticePayload(view, revealId, labels = {}) {
  const storytellerId = view.storytellerId || view.users?.storyteller
  const payload = createGrimRevealPayload(view, revealId, labels)

  if (!storytellerId) return payload

  return {
    ...payload,
    content: `<@${storytellerId}> ${createRevealNoticeText(view)}`,
    allowedMentions: { users: [storytellerId] }
  }
}

function createRevealNoticeText(view) {
  return view?.pendingEndReveal?.skipPlayerReveal
    ? 'choose which team won, or cancel to resume the game.'
    : 'reveal the Grimoire here when ready.'
}

module.exports = {
  createGrimRevealNoticePayload,
  createRevealNoticeText
}
