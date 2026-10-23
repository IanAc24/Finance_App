import { parseDate, todayString } from '../lib/dates'
import { formatDate } from '../lib/format'
import { categoryLabel } from '../lib/categories'
import { formatMoney } from '../lib/money'
import { paymentNote } from '../lib/payment'
import { copy, daysText, leftSentence } from './copy'

// What a row needs to show about a transaction. Expenses are "−", income "+".
export function describeTx(tx, categories, t) {
  const isIncome = tx.type === 'income'
  const category = categories.find((c) => c.id === tx.categoryId)
  const label = category
    ? categoryLabel(category, t)
    : isIncome
      ? copy.noteFallbackIncome
      : copy.uncategorized
  const method = paymentNote(tx.paymentMethod, t)
  return {
    isIncome,
    category: isIncome ? undefined : category,
    kind: isIncome ? 'income' : undefined,
    label,
    name: tx.note || label,
    // the category is the name when there is no note, so it is not repeated
    metaParts: [tx.note ? label : null, method].filter(Boolean),
    amountText: `${isIncome ? '+' : '−'}${formatMoney(tx.amount, tx.currency)}`,
  }
}

// "+₡1.000" for a positive net, "−₡1.000" for a negative one, plain for zero
export function signedNet(net, code) {
  if (net === 0) return formatMoney(0, code)
  return `${net > 0 ? '+' : ''}${formatMoney(net, code)}`
}

// The words and numbers of the headline of one currency (see HomeScreen):
// what can be spent today, or what is left when there is no income to divide
export function summaryOf(c, { manual, daysLeft }) {
  const days = manual.overdue ? copy.waitingPay : daysText(daysLeft)
  const message = {
    pendingExceeds: copy.pendingExceeds,
    waitingIncome: copy.waitingIncome,
    over: copy.over,
  }[c.status]
  return {
    hasBase: c.hasBase,
    amount: formatMoney(c.hasBase ? c.perDay : c.left, c.code),
    left: formatMoney(c.left, c.code),
    days,
    message,
    sentence: leftSentence(formatMoney(c.left, c.code), days),
  }
}

// "Hoy · mar 13/10", "Ayer · lun 12/10" or just "vie 09/10"
export function dayLabel(dateText, today, locale) {
  const date = parseDate(dateText)
  const plain = formatDate(date, locale, { weekday: true, year: false })
  const todayText = todayString(today)
  const yesterdayText = todayString(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1),
  )
  if (dateText === todayText) return `${copy.today} · ${plain}`
  if (dateText === yesterdayText) return `${copy.yesterday} · ${plain}`
  return plain
}
