// Display-only helpers for money. formatMoney stays the single source of the
// text; these only cut that text into pieces so a screen can style them.

// Cuts the text of formatMoney into { sign, symbol, whole, decimals }. The
// parts always join back to the exact input:
//   '−₡31.000'   -> { sign: '−', symbol: '₡', whole: '31.000', decimals: '' }
//   '$1,234.50'  -> { sign: '', symbol: '$', whole: '1,234', decimals: '.50' }
// Colones never have decimals (their "." groups thousands), dollars always do.
export function splitMoney(text) {
  const match = /^(−?)([^\d−]*)(\d[\d.,]*)$/.exec(text)
  if (!match) return { sign: '', symbol: '', whole: text, decimals: '' }
  const [, sign, symbol, number] = match
  const dot = symbol === '$' ? number.lastIndexOf('.') : -1
  if (dot === -1) return { sign, symbol, whole: number, decimals: '' }
  return { sign, symbol, whole: number.slice(0, dot), decimals: number.slice(dot) }
}

// A share of a whole as text: '38%'. A tiny but real share says '<1%' instead
// of a misleading '0%'. With no whole there is nothing to share: '0%'.
export function shareText(part, whole) {
  if (!(whole > 0) || !(part > 0)) return '0%'
  const percent = Math.round((part / whole) * 100)
  return percent < 1 ? '<1%' : `${percent}%`
}
