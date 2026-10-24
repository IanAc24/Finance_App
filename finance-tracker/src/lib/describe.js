import { categoryLabel } from './categories'
import { formatMoney } from './money'
import { formatDate } from './format'

// The name a movement or a recurring item shows in a list: its note, or its
// category, or (an income / no category) a plain word for what it is
export function itemName(item, categories, t) {
  if (item.note) return item.note
  const isIncome = item.type === 'income'
  const category = isIncome
    ? undefined
    : categories.find((c) => c.id === item.categoryId)
  if (category) return categoryLabel(category, t)
  return isIncome ? t('typeIncome') : t('category.uncategorized')
}

// An amount with its sign as the lists show it: '−₡6.400' or '+₡450.000'
export function signedAmount(sign, amount, currency) {
  return `${sign}${formatMoney(amount, currency)}`
}

// Fills a delete-confirmation message such as '¿Eliminar «{name}» ({amount})?'
// so the dialog says exactly which item is about to go
export function deleteMessage(template, { name, amount, date = '' }) {
  const values = { name, amount, date }
  // one pass, so a note that contains "{amount}" is left as typed
  return template.replace(/{(name|amount|date)}/g, (_, key) => values[key])
}

// A date without its year ('23/10'), except when it is in another year than
// `today` ('05/03/2028'), so a far-away date is never ambiguous
export function dateWithYear(date, today, locale) {
  const sameYear = date.getFullYear() === today.getFullYear()
  return formatDate(date, locale, { year: !sameYear })
}
