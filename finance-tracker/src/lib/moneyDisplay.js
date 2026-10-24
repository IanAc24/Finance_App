// Display-only helpers for money. formatMoney stays the single source of the
// text; these only cut that text into pieces so a screen can style them.

// Cuts the text of formatMoney into { sign, symbol, whole, decimals }. The
// parts always join back to the exact input:
//   '−₡31.000'   -> { sign: '−', symbol: '₡', whole: '31.000', decimals: '' }
//   '+₡31.000'   -> { sign: '+', symbol: '₡', whole: '31.000', decimals: '' }
//   '$1,234.50'  -> { sign: '', symbol: '$', whole: '1,234', decimals: '.50' }
// Colones never have decimals (their "." groups thousands), dollars always do.
export function splitMoney(text) {
  const match = /^([−+]?)([^\d−+]*)(\d[\d.,]*)$/.exec(text)
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
  // the epsilon keeps exact halves such as 29/200 = 14.5% from rounding down
  // because of floating point (14.499999999999998)
  const percent = Math.round((part / whole) * 100 + 1e-9)
  return percent < 1 ? '<1%' : `${percent}%`
}

// The percent of a budget that is used, rounded DOWN so that 99.5% never reads
// as "100%" (the budget is not spent yet). The small epsilon keeps exact
// values such as 0.58 from falling to 57 because of floating point; it is
// small enough that one cent short of a ₡1.000.000.000 budget still reads 99%.
export function budgetPercent(ratio) {
  return Math.floor(ratio * 100 + 1e-12)
}

// A thin space (U+2009) between the sign and the money, so '−₡6.400' reads
// '− ₡6.400' without leaving room for a line break
export const THIN = '\u2009'
