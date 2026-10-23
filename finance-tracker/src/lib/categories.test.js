import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  categoryColor,
  categoryColors,
  categoryFill,
  categoryLabel,
  customColorAt,
  findCategoryByName,
  normalize,
} from './categories'

describe('categoryLabel', () => {
  it('returns the name of a custom category', () => {
    const t = () => 'should not be used'
    expect(categoryLabel({ id: 5, name: 'Pets', color: 'cyan' }, t)).toBe('Pets')
  })

  it('translates a built-in category with category.<key>', () => {
    const asked = []
    const t = (key) => {
      asked.push(key)
      return 'Translated'
    }
    expect(categoryLabel({ id: 1, key: 'food', color: 'orange' }, t)).toBe(
      'Translated',
    )
    expect(asked).toEqual(['category.food'])
  })
})

describe('categoryColor', () => {
  it('returns the CSS variable of the color', () => {
    expect(categoryColor({ color: 'orange' })).toBe('var(--cat-orange)')
    expect(categoryColor({ color: 'sand' })).toBe('var(--cat-sand)')
  })
})

describe('categoryFill', () => {
  it('returns the soft segment variable of the color', () => {
    expect(categoryFill({ color: 'orange' })).toBe('var(--seg-orange)')
  })

  it('has a --seg-* value in both themes for every category color', () => {
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
    const at = css.indexOf(":root[data-theme='light'] {")
    const dark = css.slice(0, at)
    const light = css.slice(at)
    for (const color of categoryColors) {
      expect(dark).toContain(`--seg-${color}:`)
      expect(light).toContain(`--seg-${color}:`)
    }
  })
})

describe('customColorAt', () => {
  it('gives fuchsia, slate, sand, cyan for 0 to 3', () => {
    expect([0, 1, 2, 3].map(customColorAt)).toEqual([
      'fuchsia',
      'slate',
      'sand',
      'cyan',
    ])
  })

  it('wraps around after the last color', () => {
    expect(customColorAt(4)).toBe('fuchsia')
    expect(customColorAt(5)).toBe('slate')
  })
})

describe('categoryColors', () => {
  it('has 8 unique color names', () => {
    expect(categoryColors).toHaveLength(8)
    expect(new Set(categoryColors).size).toBe(8)
  })
})

describe('findCategoryByName', () => {
  const food = { id: 1, key: 'food', color: 'orange' }
  const fun = { id: 4, key: 'fun', color: 'lime' }
  const pets = { id: 5, name: 'Mascotas', color: 'cyan' }
  const categories = [food, fun, pets]

  it('finds a built-in category by its English name', () => {
    expect(findCategoryByName(categories, 'Food')).toBe(food)
  })

  it('finds a built-in category by its Spanish name', () => {
    expect(findCategoryByName(categories, 'Comida')).toBe(food)
    expect(findCategoryByName(categories, 'Diversión')).toBe(fun)
  })

  it('ignores case, accents and surrounding spaces', () => {
    expect(findCategoryByName(categories, ' COMÍDA ')).toBe(food)
    expect(findCategoryByName(categories, 'diversion')).toBe(fun)
    expect(findCategoryByName(categories, '  fun')).toBe(fun)
  })

  it('finds a custom category by name', () => {
    expect(findCategoryByName(categories, 'mascotas')).toBe(pets)
  })

  it('returns undefined for an unknown name', () => {
    expect(findCategoryByName(categories, 'Travel')).toBeUndefined()
  })
})

describe('normalize', () => {
  it('ignores case, accents and outer spaces', () => {
    expect(normalize('  Café CON Leche ')).toBe('cafe con leche')
    expect(normalize('Diversión')).toBe('diversion')
  })
})
