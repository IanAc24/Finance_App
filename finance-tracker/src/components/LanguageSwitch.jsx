import { useSettings } from '../context/useSettings'

// "Español | English" choice for the first screens (consent and welcome), so
// a person can read them in the language they understand before anything else
export default function LanguageSwitch() {
  const { lang, setLang, t } = useSettings()
  return (
    <div className="lang-switch">
      <div className="pill-group" role="group" aria-label={t('language')}>
        <button
          type="button"
          className={lang === 'es' ? 'pill active' : 'pill'}
          aria-pressed={lang === 'es'}
          lang="es"
          onClick={() => setLang('es')}
        >
          Español
        </button>
        <button
          type="button"
          className={lang === 'en' ? 'pill active' : 'pill'}
          aria-pressed={lang === 'en'}
          lang="en"
          onClick={() => setLang('en')}
        >
          English
        </button>
      </div>
    </div>
  )
}
