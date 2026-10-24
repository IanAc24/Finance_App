import privacyEs from '../../../docs/legal/politica-de-privacidad.es.md?raw'
import privacyEn from '../../../docs/legal/politica-de-privacidad.en.md?raw'
import termsEs from '../../../docs/legal/terminos-y-condiciones.es.md?raw'
import termsEn from '../../../docs/legal/terminos-y-condiciones.en.md?raw'
import refundsEs from '../../../docs/legal/politica-de-reembolsos.es.md?raw'
import refundsEn from '../../../docs/legal/politica-de-reembolsos.en.md?raw'
import cookiesEs from '../../../docs/legal/politica-de-cookies.es.md?raw'
import cookiesEn from '../../../docs/legal/politica-de-cookies.en.md?raw'

// The legal texts live in docs/legal (the lawyer edits them there); the app
// bundles them as they are
const SOURCES = {
  privacy: { es: privacyEs, en: privacyEn },
  terms: { es: termsEs, en: termsEn },
  refunds: { es: refundsEs, en: refundsEn },
  cookies: { es: cookiesEs, en: cookiesEn },
}

// The Markdown of a document in a language ('' when it does not exist)
export function legalSource(doc, lang) {
  return SOURCES[doc]?.[lang] ?? ''
}
