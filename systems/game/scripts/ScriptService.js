const scripts = require('../../../scripts')

class ScriptService {
  constructor(registry = scripts) {
    this.registry = registry
    this.defaultScriptId = registry.DEFAULT_SCRIPT_ID
  }

  getDefaultScript() {
    return this.registry.getDefaultScript()
  }

  getRole(scriptId, roleId) {
    return this.registry.getRole(scriptId, roleId)
  }

  findRole(scriptId, query) {
    return this.registry.findRole(scriptId, query)
  }

  getRoleBehavior(scriptId, roleId) {
    return this.registry.getRoleBehavior(scriptId, roleId)
  }

  getRoleNameMap(scriptId) {
    return this.registry.getRoleNameMap(scriptId)
  }

  getScript(value) {
    return this.registry.getScript(value)
  }

  listScripts() {
    return this.registry.listScripts()
  }

  normalizeScriptId(value) {
    return this.registry.normalizeScriptId(value)
  }

  validateScript(script) {
    return this.registry.validateScript(script)
  }

  validateScripts(scripts, options = {}) {
    return this.registry.validateScripts(scripts, options)
  }
}

module.exports = ScriptService
