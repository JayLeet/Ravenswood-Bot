/** @type {import('../../types').ScriptDefinition} */
module.exports = {
  id: 'bad-moon-rising',
  name: 'Bad Moon Rising',
  behaviors: require('./behaviors'),
  roles: require('./roles'),
  setup: require('./setup'),
  nightOrder: require('./night-order')
}
