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

// Heading of a day group: 'Hoy · mar 13/10', 'Ayer · lun 12/10' or just
// 'vie 09/10'. `year` adds the year (a search can span years).
export function dayHeading(dateText, today, locale, t, { year = false } = {}) {
  const plain = formatDate(parseDate(dateText), locale, { weekday: true, year })
  const yesterday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 1,
  )
  if (dateText === todayString(today)) return `${t('today')} · ${plain}`
  if (dateText === todayString(yesterday)) return `${t('yesterday')} · ${plain}`
  return plain
}

// The net of a day or a month for one currency, with its sign: '+₡1.000' for
// a positive net, '−₡1.000' for a negative one and plain '₡0' for zero
export function signedNet(net, code) {
  if (net === 0) return formatMoney(0, code)
  return `${net > 0 ? '+' : ''}${formatMoney(net, code)}`
}
