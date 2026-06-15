/** @type {import('../../types').ScriptDefinition} */
module.exports = {
  id: 'sects-violets',
  name: 'Sects & Violets',
  behaviors: require('./behaviors'),
  roles: require('./roles'),
  setup: require('./setup'),
  nightOrder: require('./night-order')
}
