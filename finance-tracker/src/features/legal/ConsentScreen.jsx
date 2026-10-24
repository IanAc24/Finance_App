import { useEffect, useRef, useState } from 'react'
import { useConsent } from '../../context/useConsent'
import { useSettings } from '../../context/useSettings'
import { useTransactions } from '../../context/useTransactions'
import LanguageSwitch from '../../components/LanguageSwitch'
import LegalText from '../../components/LegalText'
import Logo from '../../components/Logo'
import { LEGAL_DOCS } from '../../lib/legal'
import { isOnboarded } from '../../lib/onboarding'

// Shown before the welcome and the app until the current legal texts are
// accepted (Ley 8968, art. 5: informed, express, electronic consent). It
// replaces the whole app, so the four documents open here in place, with a
// button to come back.
export default function ConsentScreen() {
  const { t } = useSettings()
  const { accept } = useConsent()
  const { profile, transactions, savings, recurring, budgets } = useTransactions()

  const [checked, setChecked] = useState(false)
  const [doc, setDoc] = useState(null)

  const heading = useRef(null)
  const reading = useRef(null)
  const list = useRef(null)
  const lastDoc = useRef(null)
  const firstRender = useRef(true)

  // people who used the app before this screen existed keep their data
  const hasData =
    isOnboarded(profile) ||
    transactions.length > 0 ||
    savings.length > 0 ||
    recurring.length > 0 ||
    budgets.length > 0

  // the title takes the focus when the screen opens (a screen reader reads
  // it); opening a document focuses the document, and coming back focuses the
  // link that opened it
  useEffect(() => {
    if (doc) {
      window.scrollTo(0, 0)
      reading.current?.focus()
    } else if (firstRender.current) {
      heading.current?.focus()
    } else {
      list.current?.querySelector(`[data-doc="${lastDoc.current}"]`)?.focus()
    }
    firstRender.current = false
  }, [doc])

  const open = (id) => {
    lastDoc.current = id
    setDoc(id)
  }

  if (doc) {
    return (
      <div className="onboarding consent">
        <div ref={reading} tabIndex={-1} className="consent-reading">
          <button type="button" className="back-link" onClick={() => setDoc(null)}>
            ‹ {t('legalBack')}
          </button>
          <LegalText doc={doc} />
          <button type="button" className="back-link" onClick={() => setDoc(null)}>
            ‹ {t('legalBack')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="onboarding consent">
      <LanguageSwitch />
      <div className="ob-brand">
        <Logo className="ob-logo" />
      </div>

      <section className="card ob-card">
        <h1 className="screen-title ob-title" ref={heading} tabIndex={-1}>
          {hasData ? t('consentTitleUpdate') : t('consentTitle')}
        </h1>
        <p className="sub">{t('consentPurpose')}</p>
        {hasData && <p className="sub">{t('consentExisting')}</p>}

        <h2 className="field-title">{t('consentStoresTitle')}</h2>
        <p>{t('consentStores')}</p>
        <p>{t('consentLocal')}</p>

        <h2 className="field-title">{t('consentRightsTitle')}</h2>
        <p>{t('consentRights')}</p>

        <h2 className="field-title">{t('consentDocsTitle')}</h2>
        <ul className="legal-links" ref={list}>
          {LEGAL_DOCS.map(({ id, titleKey }) => (
            <li key={id}>
              <button
                type="button"
                className="text-link"
                data-doc={id}
                onClick={() => open(id)}
              >
                {t(titleKey)}
              </button>
            </li>
          ))}
        </ul>

        <label className="consent-check">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
          />
          <span>{t('consentCheck')}</span>
        </label>

        <button type="button" className="btn" disabled={!checked} onClick={accept}>
          {t('consentAccept')}
        </button>
        <p className="sub consent-note">{t('consentNote')}</p>
      </section>
    </div>
  )
}
