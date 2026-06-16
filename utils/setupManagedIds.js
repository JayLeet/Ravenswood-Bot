function mergeSetupIds(config = {}, key, ids = []) {
  return uniqueSetupIds([
    ...(Array.isArray(config[key]) ? config[key] : []),
    ...ids
  ])
}

function uniqueSetupIds(ids = []) {
  return [...new Set(ids.filter(Boolean).map(String))]
}

module.exports = {
  mergeSetupIds,
  uniqueSetupIds
}
