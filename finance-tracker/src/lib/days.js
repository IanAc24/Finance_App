import { parseDate, todayString } from './dates'
import { formatDate } from './format'
import { formatMoney } from './money'

// 'YYYY-MM-DD' of the `count` days that end today, oldest first
export function lastDays(today = new Date(), count = 7) {
  const days = []
  for (let back = count - 1; back >= 0; back -= 1) {
    days.push(
      todayString(
        new Date(today.getFullYear(), today.getMonth(), today.getDate() - back),
      ),
    )
  }
  return days
}

// Heading of a day group in History: 'Hoy', 'Ayer', or 'vie 23 de octubre'
// (English: 'Fri, Oct 23'). `year` adds the year (a search can span years).
export function dayTitle(dateText, today, locale, t, { year = false } = {}) {
  if (dateText === todayString(today)) return t('today')
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  if (dateText === todayString(yesterday)) return t('yesterday')
  const date = parseDate(dateText)
  if (locale.startsWith('es')) {
    const weekday = date.toLocaleDateString('es-CR', { weekday: 'short' })
    const month = date.toLocaleDateString('es-CR', { month: 'long' })
    return `${weekday} ${date.getDate()} de ${month}${year ? ` de ${date.getFullYear()}` : ''}`
  }
  return date.toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(year && { year: 'numeric' }),
  })
}

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1)

// Header of Home: 'Viernes · 23 de octubre' | 'Friday · October 23'
export function longDate(date, locale) {
  if (locale.startsWith('es')) {
    const weekday = capitalize(date.toLocaleDateString('es-CR', { weekday: 'long' }))
    const month = date.toLocaleDateString('es-CR', { month: 'long' })
    return `${weekday} · ${date.getDate()} de ${month}`
  }
  const weekday = date.toLocaleDateString(locale, { weekday: 'long' })
  const rest = date.toLocaleDateString(locale, { month: 'long', day: 'numeric' })
  return `${weekday} · ${rest}`
}

// Label of the date pill of the Add screen: Today, Yesterday or '20/10'
export function pillDate(dateText, today, locale, t) {
  if (dateText === todayString(today)) return t('today')
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  if (dateText === todayString(yesterday)) return t('yesterday')
  return formatDate(parseDate(dateText), locale, { year: false })
}

// The net of a day or a month for one currency, with its sign: '+₡1.000' for
// a positive net, '−₡1.000' for a negative one and plain '₡0' for zero
export function signedNet(net, code) {
  if (net === 0) return formatMoney(0, code)
  return `${net > 0 ? '+' : ''}${formatMoney(net, code)}`
}
