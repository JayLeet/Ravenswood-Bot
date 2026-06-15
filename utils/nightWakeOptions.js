const COMMON_WAKE_OPTIONS = Object.freeze([
  { key: 'got_it', label: '👍 Got it', text: 'Got it' },
  { key: 'good', label: '😇 Good', text: 'Good' },
  { key: 'evil', label: '😈 Evil', text: 'Evil' },
  { key: 'yes', label: '✅ Yes', text: 'Yes' },
  { key: 'no', label: '❌ No', text: 'No' }
])

const NUMBER_WAKE_OPTIONS = Object.freeze([
  { key: '0', label: '0️⃣ 0', text: '0' },
  { key: '1', label: '1️⃣ 1', text: '1' },
  { key: '2', label: '2️⃣ 2', text: '2' },
  { key: '3', label: '3️⃣ 3', text: '3' },
  { key: '4', label: '4️⃣ 4', text: '4' },
  { key: '5', label: '5️⃣ 5', text: '5' },
  { key: '6', label: '6️⃣ 6', text: '6' }
])

const SECOND_PAGE_WAKE_OPTIONS = Object.freeze([
  { key: 'use_ability', label: '✨ Use your ability?', text: 'Use your ability?' },
  { key: 'make_choice', label: '🎯 Make a choice', text: 'Make a choice' },
  {
    key: 'not_in_play',
    label: '🚫 These characters are not in play',
    text: 'These characters are not in play'
  },
  { key: 'this_demon', label: '😈 This is the Demon', text: 'This is the Demon' },
  { key: 'your_minions', label: '👥 These are your minions', text: 'These are your minions' },
  { key: 'you_are', label: '🎭 You are', text: 'You are' },
  { key: 'this_player_is', label: '👤 This player is', text: 'This player is' },
  {
    key: 'character_selected_you',
    label: '👉 This character selected you',
    text: 'This character selected you'
  }
])

const ALL_WAKE_OPTIONS = Object.freeze([
  ...COMMON_WAKE_OPTIONS,
  ...NUMBER_WAKE_OPTIONS,
  ...SECOND_PAGE_WAKE_OPTIONS
])

function getWakeOptionText(key) {
  return ALL_WAKE_OPTIONS.find(option => option.key === key)?.text || null
}

module.exports = {
  ALL_WAKE_OPTIONS,
  COMMON_WAKE_OPTIONS,
  NUMBER_WAKE_OPTIONS,
  SECOND_PAGE_WAKE_OPTIONS,
  getWakeOptionText
}
