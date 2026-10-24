import { categoryLabel } from './categories'
import { normalizeSource } from './income'
import { paymentLabel } from './payment'

// Quotes a value when it has the separator, a quote, a line break or outer
// spaces. Text starting with = + - @ (or a tab or carriage return) is run as
// a formula by Excel and Sheets, so it gets a leading quote; numbers (the
// amount column) are left as they are. The leading quote becomes part of the
// text in the sheet: it is the price of keeping a note like "-5" harmless.
function escapeCell(value, separator) {
  const risky = typeof value === 'string' && /^[=+\-@\t\r]/.test(value)
  const text = risky ? `'${value}` : String(value)
  if (!text.includes(separator) && !/["\r\n]|^\s|\s$/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

// The BOM at the start makes Excel read accents and ₡ as UTF-8. The
// separator is ',' by default; Spanish (Costa Rica) spreadsheets expect ';'
// because the comma is their decimal mark.
export function toCsv(rows, separator = ',') {
  return (
    '﻿' +
    rows.map((row) => row.map((v) => escapeCell(v, separator)).join(separator)).join('\r\n')
  )
}

// What changes with the language of the file: the separator, the header and
// the words for the type, and the decimal mark of the amount
const CSV_LANGUAGES = {
  en: {
    separator: ',',
    header: ['date', 'type', 'amount', 'currency', 'category', 'note', 'payment method', 'income source'],
    income: 'income',
    sources: { salary: 'salary', freelance: 'freelance', gift: 'gift', other: 'other' },
    expense: 'expense',
    amount: (value) => value,
  },
  es: {
    separator: ';',
    header: ['fecha', 'tipo', 'monto', 'moneda', 'categoría', 'nota', 'método de pago', 'fuente del ingreso'],
    income: 'ingreso',
    sources: { salary: 'salario', freelance: 'independiente', gift: 'regalo', other: 'otro' },
    expense: 'gasto',
    // with ';' as the separator Excel (es-CR) reads the comma as the decimal
    amount: (value) => String(value).replace('.', ','),
  },
}

export function csvSeparator(lang = 'en') {
  return (CSV_LANGUAGES[lang] ?? CSV_LANGUAGES.en).separator
}

// Header plus one row per transaction, in the order given. Dates stay as
// YYYY-MM-DD (sortable, and every spreadsheet reads them).
export function transactionRows(transactions, categories, t, lang = 'en') {
  const language = CSV_LANGUAGES[lang] ?? CSV_LANGUAGES.en
  const rows = transactions.map((tx) => {
    const category = categories.find((c) => c.id === tx.categoryId)
    return [
      tx.date,
      tx.type === 'income' ? language.income : language.expense,
      language.amount(tx.amount),
      tx.currency,
      category ? categoryLabel(category, t) : '',
      tx.note ?? '',
      paymentLabel(tx.paymentMethod, t),
      // empty for expenses and for incomes saved without a source
      tx.type === 'income' ? (language.sources[normalizeSource(tx.source)] ?? '') : '',
    ]
  })
  return [language.header, ...rows]
}

// Saves text as a file through a temporary link
export function downloadFile(filename, text, type) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // some browsers cancel the download if the URL is revoked right away
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadCsv(filename, rows, lang = 'en') {
  downloadFile(filename, toCsv(rows, csvSeparator(lang)), 'text/csv;charset=utf-8')
}
