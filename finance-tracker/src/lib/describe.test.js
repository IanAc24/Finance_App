import { describe, expect, it } from 'vitest'
import { dateWithYear, deleteMessage, itemName, signedAmount } from './describe'

const t = (key) =>
  ({
    typeIncome: 'Ingreso',
    'category.uncategorized': 'Sin categoría',
    'category.food': 'Comida',
  })[key]
const categories = [
  { id: 1, key: 'food', color: 'orange' },
  { id: 9, name: 'Mascotas', color: 'sand' },
]

describe('itemName', () => {
  it('prefers the note', () => {
    expect(itemName({ note: 'Super', type: 'expense', categoryId: 1 }, categories, t)).toBe('Super')
  })

  it('falls back to the category (built-in or custom)', () => {
    expect(itemName({ note: '', type: 'expense', categoryId: 1 }, categories, t)).toBe('Comida')
    expect(itemName({ type: 'expense', categoryId: 9 }, categories, t)).toBe('Mascotas')
  })

  it('says what an income or a category-less expense is', () => {
    expect(itemName({ note: '', type: 'income', categoryId: null }, categories, t)).toBe('Ingreso')
    expect(itemName({ note: '', type: 'expense', categoryId: 77 }, categories, t)).toBe('Sin categoría')
  })
})

describe('signedAmount', () => {
  it('writes the sign before the money', () => {
    expect(signedAmount('−', 6400, 'CRC')).toBe('−₡6.400')
    expect(signedAmount('+', 450000, 'CRC')).toBe('+₡450.000')
  })
})

describe('deleteMessage', () => {
  it('names the item, its amount and its date', () => {
    expect(
      deleteMessage('¿Eliminar «{name}» ({amount}, {date})?', {
        name: 'Supermercado',
        amount: '−₡6.400',
        date: '23/10',
      }),
    ).toBe('¿Eliminar «Supermercado» (−₡6.400, 23/10)?')
  })

  it('works without a date', () => {
    expect(deleteMessage('Delete “{name}” ({amount})?', { name: 'Internet', amount: '−₡20.000' })).toBe(
      'Delete “Internet” (−₡20.000)?',
    )
  })
})

describe('dateWithYear', () => {
  const today = new Date(2026, 9, 23)

  it('leaves the year out inside the current year', () => {
    expect(dateWithYear(new Date(2026, 9, 23), today, 'es-CR')).toBe('23/10')
  })

  it('adds the year when it is another one', () => {
    expect(dateWithYear(new Date(2028, 2, 5), today, 'es-CR')).toBe('05/03/2028')
    expect(dateWithYear(new Date(2025, 11, 31), today, 'es-CR')).toBe('31/12/2025')
  })
})
