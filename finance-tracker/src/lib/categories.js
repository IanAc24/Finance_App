import { translations } from './translations'

// Colors for custom categories, taken in order and then repeated.
// Each one is the name of a --cat-* variable in index.css
export const customColors = ['fuchsia', 'slate', 'sand', 'cyan']

// Every color a category can have; each is a --cat-* variable in index.css
export const categoryColors = [
  'orange',
  'blue',
  'violet',
  'lime',
  ...customColors,
]

// The color for a custom category, given how many came before it
export function customColorAt(index) {
  return customColors[index % customColors.length]
}

// Stands in for expenses whose category is missing; never saved
export const uncategorized = { id: 0, key: 'uncategorized', color: 'slate' }

export function categoryColor(category) {
  return `var(--cat-${category.color})`
}

// The soft fill of a bar segment or legend dot: a pastel in both themes (the
// --seg-* variables), with dark text on top. categoryColor stays for text and
// icons, which need the stronger tone on a light background.
export function categoryFill(category) {
  return `var(--seg-${category.color})`
}

// Built-in categories have a translation key, custom ones have a name
export function categoryLabel(category, t) {
  return category.name ?? t(`category.${category.key}`)
}

// 'Comída ' -> 'comida': ignores case, accents and outer spaces
export function normalize(text) {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

// Built-in categories match their name in any language
export function findCategoryByName(categories, name) {
  const wanted = normalize(name)
  return categories.find((c) => {
    if (c.name) return normalize(c.name) === wanted
    return Object.values(translations).some(
      (strings) => normalize(strings[`category.${c.key}`]) === wanted,
    )
  })
}
