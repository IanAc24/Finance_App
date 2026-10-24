import { describe, expect, it } from 'vitest'
import { categories } from '../db/mockData'
import { categoryColors } from './categories'
import { schedules } from './recurring'
import { translations } from './translations'

const { es, en } = translations

// Source files of the app, read as text (not the tests nor translations.js)
const sources = Object.entries(
  import.meta.glob('../**/*.{js,jsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
).filter(
  ([path]) => !path.endsWith('.test.js') && !path.endsWith('/translations.js'),
)

// Strings that are the same in both languages on purpose: the brand name,
// and words that are written the same way in Spanish and English
const SAME_IN_BOTH = ['titleMain', 'titleAccent', 'color', 'colones', 'paySinpe']

// Key families built at run time: t(`schedule.${...}`) and so on
const DYNAMIC_PREFIXES = ['schedule.', 'color.', 'category.']

describe('translations', () => {
  it('es and en have exactly the same keys', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort())
  })

  it('has no empty values', () => {
    for (const [language, strings] of Object.entries(translations)) {
      for (const [key, value] of Object.entries(strings)) {
        expect(value, `${language}.${key}`).not.toBe('')
        expect(value, `${language}.${key}`).toBe(value.trim())
      }
    }
  })

  it('has no Spanish string that is identical to its English one', () => {
    const same = Object.keys(es).filter((key) => es[key] === en[key])
    expect(same.sort()).toEqual([...SAME_IN_BOTH].sort())
  })

  it('has no English words in the Spanish strings', () => {
    const english =
      /\b(the|and|your|you|with|this|that|please|save|saved|delete|cancel|settings|backup|income|expense|home|loading|error|retry|add|data|income|sample|clear|restore|download|search|filter)\b/i
    for (const [key, value] of Object.entries(es)) {
      // the brand name is English everywhere
      const text = value.replace(/I AM POOR FOR NOW/g, '')
      expect(text, `es.${key}`).not.toMatch(english)
    }
  })

  it('has a category.<key> entry for every built-in category', () => {
    for (const category of categories) {
      expect(es[`category.${category.key}`], `es ${category.key}`).toBeTruthy()
      expect(en[`category.${category.key}`], `en ${category.key}`).toBeTruthy()
    }
    expect(es['category.uncategorized']).toBeTruthy()
  })

  it('has a color.<name> entry for every category color', () => {
    for (const name of categoryColors) {
      expect(es[`color.${name}`], `es ${name}`).toBeTruthy()
      expect(en[`color.${name}`], `en ${name}`).toBeTruthy()
    }
  })

  it('has a schedule.<name> entry for every schedule', () => {
    for (const name of schedules) {
      expect(es[`schedule.${name}`], `es ${name}`).toBeTruthy()
      expect(en[`schedule.${name}`], `en ${name}`).toBeTruthy()
    }
  })
})

describe('translation keys in the source', () => {
  it('finds source files to scan', () => {
    expect(sources.length).toBeGreaterThan(20)
  })

  it("every t('key') used in the code exists in both languages", () => {
    const missing = []
    for (const [path, text] of sources) {
      for (const match of text.matchAll(/\bt\(\s*'([^']+)'\s*\)/g)) {
        const key = match[1]
        if (!(key in es) || !(key in en)) missing.push(`${path}: ${key}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('every key is used somewhere (no dead strings)', () => {
    const code = sources.map(([, text]) => text).join('\n')
    const unused = Object.keys(es).filter(
      (key) =>
        !DYNAMIC_PREFIXES.some((prefix) => key.startsWith(prefix)) &&
        !code.includes(`'${key}'`) &&
        !code.includes(`"${key}"`),
    )
    expect(unused).toEqual([])
  })

  it('has no hard-coded text in the screens (it all goes through t())', () => {
    const found = []
    for (const [path, text] of sources.filter(([p]) => p.endsWith('.jsx'))) {
      // text between tags that has letters and is not inside { }
      for (const match of text.matchAll(/>\s*([^<>{}\n]*[A-Za-zÁ-ú][^<>{}\n]*)\s*</g)) {
        const inner = match[1].trim()
        // a comparison in JavaScript (a > b) is not text
        if (/[=&|();]/.test(inner)) continue
        found.push(`${path}: ${inner}`)
      }
      // static attributes read by people or screen readers
      for (const match of text.matchAll(
        /\b(aria-label|aria-description|placeholder|title|alt)="([^"]+)"/g,
      )) {
        found.push(`${path}: ${match[1]}="${match[2]}"`)
      }
    }
    // the names of the languages are written in their own language
    const allowed = ['Español', 'English']
    expect(found.filter((line) => !allowed.some((w) => line.endsWith(w)))).toEqual([])
  })

  it('has no native confirm() or alert() left (the app has its own dialog)', () => {
    const found = []
    for (const [path, text] of sources) {
      if (/window\.(confirm|alert)\(/.test(text)) found.push(path)
    }
    expect(found).toEqual([])
  })
})
