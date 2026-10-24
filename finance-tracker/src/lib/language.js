// Which language the app opens in the first time.
// A saved choice ('es' or 'en') always wins. With nothing saved, the first
// browser language that is Spanish or English decides; anything else (or no
// information at all) falls back to Spanish.
export function initialLanguage(saved, browserLanguages) {
  if (saved === 'en' || saved === 'es') return saved
  const list = Array.isArray(browserLanguages) ? browserLanguages : []
  for (const entry of list) {
    if (typeof entry !== 'string') continue
    const code = entry.trim().toLowerCase()
    if (code === 'es' || code.startsWith('es-') || code.startsWith('es_')) {
      return 'es'
    }
    if (code === 'en' || code.startsWith('en-') || code.startsWith('en_')) {
      return 'en'
    }
  }
  return 'es'
}

// The browser's preferred languages, safe where navigator does not exist
export function browserLanguages() {
  if (typeof navigator === 'undefined') return []
  if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
    return navigator.languages
  }
  return navigator.language ? [navigator.language] : []
}
