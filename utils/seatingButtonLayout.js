const {
  createSeatLayout
} = require('./votingSeatingMap')

const BUTTON_LABEL_WIDTH = 13
const SPACER_WIDTH_COMPENSATION = 2
const FIGURE_SPACE = '\u2007'
const BRAILLE_BLANK = '\u2800'
// Discord renders braille blanks wider than ordinary label text, so spacer labels
// use a small compensation to line up with visible player buttons.
const SPACER_BUTTON_LABEL = createSpacerButtonLabel(BUTTON_LABEL_WIDTH)

function createSeatingButtonLayout(itemIds = [], options = {}) {
  const ids = itemIds.filter(Boolean)
  if (!ids.length) return []

  const rows = ids.length === 1
    ? [[null, ids[0], null]]
    : createMultiSeatRows(ids)

  return limitRows(rows, options.maxRows)
}

function createMultiSeatRows(ids) {
  const rows = [[null, ids[0], null]]
  const layout = createSeatLayout(ids.length)

  for (let index = 0; index < layout.leftIndexes.length; index += 1) {
    rows.push([
      ids[layout.leftIndexes[index]] || null,
      null,
      ids[layout.rightIndexes[index]] || null
    ])
  }

  if (layout.southIndex !== null) rows.push([null, ids[layout.southIndex], null])
  return rows
}

function createCompactButtonLayout(itemIds = [], options = {}) {
  const width = options.width || 5
  const ids = itemIds.filter(Boolean)
  const rows = []

  for (let index = 0; index < ids.length; index += width) {
    rows.push(ids.slice(index, index + width))
  }

  return limitRows(rows, options.maxRows)
}

function limitRows(rows, maxRows) {
  return Number.isFinite(maxRows) ? rows.slice(0, maxRows) : rows
}

function padButtonLabel(label, width = BUTTON_LABEL_WIDTH) {
  const text = String(label || '')
  if (text.length >= width) return text
  const missing = width - text.length
  const left = Math.floor(missing / 2)
  const right = missing - left
  return `${FIGURE_SPACE.repeat(left)}${text}${FIGURE_SPACE.repeat(right)}`
}

function createSpacerButtonLabel(width = BUTTON_LABEL_WIDTH) {
  return BRAILLE_BLANK.repeat(Math.max(1, width - SPACER_WIDTH_COMPENSATION))
}

function getButtonLabelWidth(labels = []) {
  return labels
    .map(label => String(label || '').length)
    .reduce((max, length) => Math.max(max, length), BUTTON_LABEL_WIDTH)
}

module.exports = {
  BUTTON_LABEL_WIDTH,
  SPACER_BUTTON_LABEL,
  createCompactButtonLayout,
  createSpacerButtonLabel,
  createSeatingButtonLayout,
  getButtonLabelWidth,
  padButtonLabel
}
