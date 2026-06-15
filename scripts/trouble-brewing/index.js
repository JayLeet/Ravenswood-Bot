/** @type {import('../../types').ScriptDefinition} */
module.exports = {
  id: 'trouble-brewing',
  name: 'Trouble Brewing',
  behaviors: require('./behaviors'),
  roles: require('./roles'),
  setup: require('./setup'),
  nightOrder: require('./night-order')
}
