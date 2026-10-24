import { describe, expect, it } from 'vitest'
import { csvSeparator, toCsv, transactionRows } from './csv'

describe('toCsv', () => {
  it('starts with the BOM', () => {
    expect(toCsv([['a']]).startsWith('﻿')).toBe(true)
  })

  it('joins rows with CRLF and cells with commas', () => {
    expect(
      toCsv([
        ['a', 'b'],
        ['c', 'd'],
      ]),
    ).toBe('﻿a,b\r\nc,d')
  })

  it('does not quote plain cells or numbers', () => {
    expect(toCsv([['hello', 12.5, 0]])).toBe('﻿hello,12.5,0')
  })

  it('quotes a cell with a comma', () => {
    expect(toCsv([['a,b']])).toBe('﻿"a,b"')
  })

  it('quotes a cell with a double quote and doubles the inner quotes', () => {
    expect(toCsv([['say "hi"']])).toBe('﻿"say ""hi"""')
  })

  it('quotes a cell with a line break', () => {
    expect(toCsv([['a\nb']])).toBe('﻿"a\nb"')
    expect(toCsv([['a\r\nb']])).toBe('﻿"a\r\nb"')
  })

  it('quotes a cell with leading or trailing spaces', () => {
    expect(toCsv([[' a']])).toBe('﻿" a"')
    expect(toCsv([['a ']])).toBe('﻿"a "')
  })

  it('adds a leading single quote to text starting with = + - or @', () => {
    expect(toCsv([['=SUM(A1)']])).toBe("﻿'=SUM(A1)")
    expect(toCsv([['+1']])).toBe("﻿'+1")
    expect(toCsv([['-1']])).toBe("﻿'-1")
    expect(toCsv([['@cmd']])).toBe("﻿'@cmd")
  })

  it('also guards text starting with a tab or a carriage return', () => {
    expect(toCsv([['\t=1+1']])).toBe("\ufeff'\t=1+1")
    expect(toCsv([['\r=1+1']])).toBe('\ufeff"\'\r=1+1"')
  })

  it('keeps the apostrophe of a note like -5 (documented cost)', () => {
    expect(toCsv([['-5']])).toBe("\ufeff'-5")
  })

  it('uses a semicolon when asked and then quotes semicolons, not commas', () => {
    expect(toCsv([['a', 'b,c', 'd;e']], ';')).toBe('\ufeffa;b,c;"d;e"')
  })

  it('leaves a negative number untouched', () => {
    expect(toCsv([[-5]])).toBe('﻿-5')
  })
})

describe('transactionRows', () => {
  const t = (key) => `T:${key}`
  const categories = [
    { id: 1, key: 'food', color: 'orange' },
    { id: 5, name: 'Pets', color: 'cyan' },
  ]

  it('starts with the header row', () => {
    expect(transactionRows([], categories, t)).toEqual([
      ['date', 'type', 'amount', 'currency', 'category', 'note', 'payment method', 'income source'],
    ])
  })

  it('puts the category label in an expense row', () => {
    const tx = {
      id: 1,
      amount: 8500,
      currency: 'CRC',
      type: 'expense',
      categoryId: 1,
      note: 'Lunch',
      date: '2026-10-02',
    }
    expect(transactionRows([tx], categories, t)[1]).toEqual([
      '2026-10-02',
      'expense',
      8500,
      'CRC',
      'T:category.food',
      'Lunch',
      'T:payCash',
      '',
    ])
  })

  it('uses the name of a custom category', () => {
    const tx = {
      id: 2,
      amount: 5.5,
      currency: 'USD',
      type: 'expense',
      categoryId: 5,
      note: 'Food',
      date: '2026-10-03',
    }
    expect(transactionRows([tx], categories, t)[1][4]).toBe('Pets')
  })

  it('leaves the category empty for income', () => {
    const tx = {
      id: 3,
      amount: 100,
      currency: 'USD',
      type: 'income',
      categoryId: null,
      note: 'Freelance',
      date: '2026-10-04',
    }
    expect(transactionRows([tx], categories, t)[1]).toEqual([
      '2026-10-04',
      'income',
      100,
      'USD',
      '',
      'Freelance',
      'T:payCash',
      '',
    ])
  })

  it('writes the income source in the last column, only for incomes', () => {
    const base = {
      id: 7,
      amount: 100,
      currency: 'CRC',
      type: 'income',
      categoryId: null,
      note: '',
      date: '2026-10-05',
    }
    const row = (changes, lang) =>
      transactionRows([{ ...base, ...changes }], categories, t, lang)[1][7]
    expect(row({ source: 'salary' })).toBe('salary')
    expect(row({ source: 'freelance' }, 'es')).toBe('independiente')
    expect(row({ source: 'gift' }, 'es')).toBe('regalo')
    expect(row({ source: null })).toBe('')
    expect(row({})).toBe('')
    expect(row({ source: 'lottery' })).toBe('')
    // an expense never has one, even if the object carries a value
    expect(row({ type: 'expense', categoryId: 1, source: 'salary' })).toBe('')
  })

  it('writes the payment method as a translated label in the last column', () => {
    const base = {
      id: 6,
      amount: 10,
      currency: 'CRC',
      type: 'expense',
      categoryId: 1,
      note: '',
      date: '2026-10-05',
    }
    const row = (paymentMethod) =>
      transactionRows([{ ...base, paymentMethod }], categories, t)[1]
    expect(row('card')[6]).toBe('T:payCard')
    expect(row('sinpe')[6]).toBe('T:paySinpe')
    expect(row(undefined)[6]).toBe('T:payCash')
  })

  it('leaves the category empty when it no longer exists', () => {
    const tx = {
      id: 4,
      amount: 10,
      currency: 'CRC',
      type: 'expense',
      categoryId: 99,
      note: 'Old',
      date: '2026-10-05',
    }
    expect(transactionRows([tx], categories, t)[1][4]).toBe('')
  })

  it('turns a missing note into an empty string', () => {
    const tx = {
      id: 5,
      amount: 10,
      currency: 'CRC',
      type: 'expense',
      categoryId: 1,
      date: '2026-10-06',
    }
    expect(transactionRows([tx], categories, t)[1][5]).toBe('')
  })

  it('keeps the order of the transactions', () => {
    const list = [
      {
        id: 1,
        amount: 1,
        currency: 'CRC',
        type: 'expense',
        categoryId: 1,
        note: 'a',
        date: '2026-10-01',
      },
      {
        id: 2,
        amount: 2,
        currency: 'CRC',
        type: 'expense',
        categoryId: 1,
        note: 'b',
        date: '2026-10-02',
      },
    ]
    const rows = transactionRows(list, categories, t)
    expect(rows.slice(1).map((row) => row[5])).toEqual(['a', 'b'])
  })
})

describe('Spanish CSV', () => {
  const t = (key) => `T:${key}`
  const categories = [{ id: 1, key: 'food', color: 'orange' }]
  const list = [
    { id: 1, amount: 8500.5, currency: 'CRC', type: 'expense', categoryId: 1, note: 'Almuerzo; con café', date: '2026-10-02' },
    { id: 2, amount: 250000, currency: 'CRC', type: 'income', categoryId: null, note: '', date: '2026-10-01' },
    { id: 3, amount: 9.99, currency: 'USD', type: 'expense', categoryId: 1, note: '=CMD()', date: '2026-10-06' },
  ]

  it('has Spanish headers and words for the type', () => {
    const rows = transactionRows(list, categories, t, 'es')
    expect(rows[0]).toEqual([
      'fecha', 'tipo', 'monto', 'moneda', 'categoría', 'nota', 'método de pago', 'fuente del ingreso',
    ])
    expect(rows.map((row) => row[1]).slice(1)).toEqual(['gasto', 'ingreso', 'gasto'])
  })

  it('writes the decimal mark as a comma', () => {
    const rows = transactionRows(list, categories, t, 'es')
    expect(rows.map((row) => row[2]).slice(1)).toEqual(['8500,5', '250000', '9,99'])
  })

  it('stays in English for en and for anything unknown', () => {
    expect(transactionRows(list, categories, t, 'en')[0][0]).toBe('date')
    expect(transactionRows(list, categories, t, 'fr')[0][0]).toBe('date')
    expect(transactionRows(list, categories, t, 'en')[1][2]).toBe(8500.5)
  })

  it('builds a file Excel (es-CR) opens in columns: ; + BOM + UTF-8 text', () => {
    const csv = toCsv(transactionRows(list, categories, t, 'es'), csvSeparator('es'))
    expect(csv.startsWith('\ufeff')).toBe(true)
    const lines = csv.slice(1).split('\r\n')
    expect(lines[0]).toBe('fecha;tipo;monto;moneda;categoría;nota;método de pago;fuente del ingreso')
    expect(lines[1]).toBe('2026-10-02;gasto;8500,5;CRC;T:category.food;"Almuerzo; con café";T:payCash;')
    expect(lines[3]).toBe("2026-10-06;gasto;9,99;USD;T:category.food;'=CMD();T:payCash;")
  })

  it('picks the separator by language', () => {
    expect(csvSeparator('es')).toBe(';')
    expect(csvSeparator('en')).toBe(',')
    expect(csvSeparator()).toBe(',')
  })
})
