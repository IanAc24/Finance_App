// Dates for the screen. Spanish (Costa Rica) writes day/month/year with two
// digits ('13/10/2026'); English keeps the usual US text ('Oct 13, 2026').
// locale is the one SettingsProvider gives ('es-CR' or 'en-US').
//   year: false      leaves the year out ('13/10' | 'Oct 13')
//   weekday: true    puts the short weekday first ('mar 13/10' | 'Tue, Oct 13')
export function formatDate(date, locale, { year = true, weekday = false } = {}) {
  if (locale.startsWith('es')) {
    // written by hand: without the year, Intl drops the leading zero ('4/10')
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const text = year ? `${day}/${month}/${date.getFullYear()}` : `${day}/${month}`
    if (!weekday) return text
    return `${date.toLocaleDateString('es-CR', { weekday: 'short' })} ${text}`
  }
  return date.toLocaleDateString(locale, {
    ...(weekday && { weekday: 'short' }),
    month: 'short',
    day: 'numeric',
    ...(year && { year: 'numeric' }),
  })
}

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1)

// 'Octubre de 2026' | 'October 2026'. Only the month name is capitalised: in
// Spanish the "de" stays small ("Octubre De 2026" is wrong).
export function formatMonth(date, locale) {
  if (locale.startsWith('es')) {
    const month = date.toLocaleDateString(locale, { month: 'long' })
    return `${capitalize(month)} de ${date.getFullYear()}`
  }
  return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
}

// The month alone, for a sentence: 'octubre' | 'October'
export function monthName(date, locale) {
  const name = date.toLocaleDateString(locale, { month: 'long' })
  return locale.startsWith('es') ? name : capitalize(name)
}
