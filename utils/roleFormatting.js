const {
  getRoleEmoji
} = require('./storytellerDashboard/roleEmojis')

function formatRoleName(roleId) {
  return String(roleId || 'unknown')
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getRoleName(view, roleId) {
  return view?.engine?.roleNames?.[roleId] || formatRoleName(roleId)
}

function formatRoleWithArticle(view, roleId) {
  return `The ${getRoleName(view, roleId)}`
}

function formatRoleWithEmoji(view, roleId) {
  return `${getRoleEmoji(view, roleId)} ${formatRoleWithArticle(view, roleId)}`
}

module.exports = {
  formatRoleName,
  formatRoleWithArticle,
  formatRoleWithEmoji,
  getRoleName
}
