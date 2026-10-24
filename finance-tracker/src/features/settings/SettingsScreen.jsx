import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTransactions } from '../../context/useTransactions'
import { useAuth } from '../../context/useAuth'
import { useConsent } from '../../context/useConsent'
import { useDialog } from '../../context/useDialog'
import { useSettings } from '../../context/useSettings'
import {
  MAX_BACKUP_BYTES,
  buildBackup,
  inspectBackup,
  summarizeCounts,
} from '../../lib/backup'
import { Icon } from '../../components/CategoryIcon'
import QuincenaSetting from '../../components/QuincenaSetting'
import { downloadCsv, downloadFile, transactionRows } from '../../lib/csv'
import { byNewest, isValidDate, parseDate, todayString } from '../../lib/dates'
import { formatDate } from '../../lib/format'
import { LEGAL_DOCS } from '../../lib/legal'
import { MAX_PROFILE_NAME_LENGTH } from '../../lib/limits'
import { cleanName } from '../../lib/onboarding'
import { BACKUP_SNOOZE_PREF, readPref, removePref, writePref } from '../../lib/prefs'

// The screens that hold what the person manages, in the order they are used
const MANAGE_LINKS = [
  { to: '/savings', icon: 'piggyBank', labelKey: 'savings' },
  { to: '/settings/recurring', icon: 'repeat', labelKey: 'recurring' },
  { to: '/settings/categories', icon: 'tag', labelKey: 'categories' },
  { to: '/settings/budgets', icon: 'wallet', labelKey: 'budgets' },
]

// The date of the last backup made on this device, or null
function readLastBackup() {
  const saved = readPref('lastBackup')
  return saved && isValidDate(saved) ? saved : null
}

export default function SettingsScreen() {
  const { lang, setLang, theme, setTheme, locale, t } = useSettings()
  const { alert, confirm } = useDialog()
  const { user, signOut } = useAuth()
  const {
    transactions,
    categories,
    budgets,
    recurring,
    savings,
    quincenaSchedule,
    profile,
    loadSampleData,
    clearAllData,
    restoreData,
    saveProfileName,
    startOnboarding,
  } = useTransactions()

  const { consent, withdraw } = useConsent()

  const [busy, setBusy] = useState(false)
  const [lastBackup, setLastBackup] = useState(readLastBackup)
  const [nameText, setNameText] = useState(profile.name)

  const hasTransactions = transactions.length > 0
  const customCount = categories.filter((c) => c.name).length
  // what a restore or "clear all" would replace or erase
  const currentCounts = {
    transactions: transactions.length,
    budgets: budgets.length,
    recurring: recurring.length,
    savings: savings.length,
    categories: customCount,
  }
  const hasAnyData = Object.values(currentCounts).some((n) => n > 0)

  // writes can fail: tell the user instead of failing silently.
  // Only one data action runs at a time.
  const run = async (action) => {
    if (busy) return
    setBusy(true)
    try {
      await action()
    } catch (error) {
      console.error(error)
      await alert(t('saveError'))
    } finally {
      setBusy(false)
    }
  }

  // the local data is not touched: it is there again after signing back in
  const handleSignOut = async () => {
    if (busy) return
    setBusy(true)
    try {
      await signOut()
    } catch (error) {
      console.warn('auth', error?.code ?? 'unknown')
      await alert(t('authUnknown'))
      setBusy(false)
    }
  }

  const handleExportAll = () => {
    const list = [...transactions].sort(byNewest)
    downloadCsv(
      'i-am-poor-for-now-all.csv',
      transactionRows(list, categories, t, lang),
      lang,
    )
  }

  const saveBackupFile = (name) => {
    const backup = buildBackup({
      transactions,
      categories,
      budgets,
      recurring,
      savings,
      quincenaSchedule,
      profile,
    })
    downloadFile(name, JSON.stringify(backup, null, 2), 'application/json')
  }

  const handleDownloadBackup = () => {
    const today = todayString()
    saveBackupFile(`i-am-poor-for-now-backup-${today}.json`)
    writePref('lastBackup', today)
    removePref(BACKUP_SNOOZE_PREF)
    setLastBackup(today)
  }

  const backupError = (reason) => {
    if (reason === 'tooBig') return t('backupTooBig')
    if (reason === 'newer') return t('backupNewer')
    return t('invalidBackup')
  }

  const handleRestoreFile = async (event) => {
    const input = event.target
    const file = input.files[0]
    if (!file) return
    if (file.size > MAX_BACKUP_BYTES) {
      input.value = ''
      await alert(t('backupTooBig'))
      return
    }
    let text
    try {
      text = await file.text()
    } catch (error) {
      console.error(error)
      await alert(t('invalidBackup'))
      return
    } finally {
      // so the same file can be picked again
      input.value = ''
    }
    const result = inspectBackup(
      text,
      categories.filter((c) => c.key),
    )
    if (!result.ok) {
      await alert(backupError(result.reason))
      return
    }
    const lines = [
      t('restoreReplaces'),
      '',
      `${t('restoreNow')}: ${summarizeCounts(currentCounts, t)}`,
      `${t('restoreFile')}: ${summarizeCounts(result.counts, t)}`,
    ]
    if (result.droppedTotal > 0) {
      lines.push('', `${t('restoreDropped')}: ${result.droppedTotal}`)
    }
    if (result.trimmed > 0) {
      lines.push('', `${t('restoreTrimmed')}: ${result.trimmed}`)
    }
    const answer = await confirm({
      message: lines.join('\n'),
      confirmLabel: t('restoreConfirm'),
      danger: true,
      // the data about to be replaced can be saved to a file first
      checkbox: hasAnyData
        ? { label: t('restoreMakeBackup'), defaultChecked: true }
        : undefined,
    })
    if (!answer.confirmed) return
    run(async () => {
      if (hasAnyData && answer.checked) {
        saveBackupFile(`i-am-poor-for-now-before-restore-${todayString()}.json`)
      }
      await restoreData(result.data)
    })
  }

  const handleClear = async () => {
    const message = [
      t('clearIntro'),
      '',
      summarizeCounts(currentCounts, t),
      '',
      t('clearResetsSchedule'),
      '',
      t('cannotUndo'),
    ].join('\n')
    const { confirmed, checked } = await confirm({
      message,
      confirmLabel: t('clearConfirm'),
      danger: true,
      // what is about to be erased can be saved to a file first
      checkbox: { label: t('clearMakeBackup'), defaultChecked: false },
    })
    if (!confirmed) return
    run(async () => {
      if (checked) saveBackupFile(`i-am-poor-for-now-before-clear-${todayString()}.json`)
      await clearAllData()
    })
  }

  // Withdrawing the consent erases the data like "Clear all" and then shows
  // the consent screen again
  const handleWithdraw = async () => {
    const { confirmed } = await confirm({
      message: t('withdrawIntro'),
      confirmLabel: t('withdrawConfirm'),
      danger: true,
    })
    if (!confirmed) return
    run(async () => {
      await clearAllData()
      withdraw()
    })
  }

  return (
    <>
      <h1 className="screen-title">{t('settings')}</h1>

      <div className="cols">
        <div className="col">
          <section className="card">
            <h2 className="section-title">{t('account')}</h2>
            <p className="account-email">{user?.email}</p>
            <p className="sub">{t('signOutHint')}</p>
            <div className="actions">
              <button
                type="button"
                className="btn secondary"
                disabled={busy}
                onClick={handleSignOut}
              >
                {t('signOut')}
              </button>
            </div>
          </section>

          <section className="card">
            <h2 className="section-title">{t('manage')}</h2>
            <ul className="list">
              {MANAGE_LINKS.map(({ to, icon, labelKey }) => (
                <li key={to}>
                  <Link className="tx-row row-link" to={to}>
                    <span className="cat-icon is-nav" aria-hidden="true">
                      <Icon name={icon} size={20} />
                    </span>
                    <span className="tx-text">
                      <span className="tx-name">{t(labelKey)}</span>
                    </span>
                    <span className="row-chevron" aria-hidden="true">
                      <Icon name="chevronRight" size={20} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h2 className="section-title">{t('language')}</h2>
            <div className="pill-group wrap">
              <button
                type="button"
                className={lang === 'es' ? 'pill active' : 'pill'}
                aria-pressed={lang === 'es'}
                onClick={() => setLang('es')}
              >
                Español
              </button>
              <button
                type="button"
                className={lang === 'en' ? 'pill active' : 'pill'}
                aria-pressed={lang === 'en'}
                onClick={() => setLang('en')}
              >
                English
              </button>
            </div>
          </section>

          <section className="card">
            <h2 className="section-title">{t('theme')}</h2>
            <div className="pill-group wrap">
              <button
                type="button"
                className={theme === 'dark' ? 'pill active' : 'pill'}
                aria-pressed={theme === 'dark'}
                onClick={() => setTheme('dark')}
              >
                {t('dark')}
              </button>
              <button
                type="button"
                className={theme === 'light' ? 'pill active' : 'pill'}
                aria-pressed={theme === 'light'}
                onClick={() => setTheme('light')}
              >
                {t('light')}
              </button>
            </div>
          </section>

          <section className="card" key={profile.name}>
            <label className="field">
              <span className="label">{t('profileName')}</span>
              <input
                type="text"
                autoComplete="given-name"
                maxLength={MAX_PROFILE_NAME_LENGTH}
                value={nameText}
                onChange={(e) => setNameText(e.target.value)}
              />
            </label>
            <div className="actions">
              <button
                type="button"
                className="btn"
                disabled={busy || cleanName(nameText) === profile.name}
                onClick={() => run(() => saveProfileName(nameText))}
              >
                {t('save')}
              </button>
            </div>
          </section>

          <QuincenaSetting />

          <section className="card">
            <h2 className="section-title">{t('setupSection')}</h2>
            <p className="sub">{t('redoSetupHint')}</p>
            <div className="actions">
              <button
                type="button"
                className="btn secondary"
                disabled={busy}
                onClick={startOnboarding}
              >
                {t('redoSetup')}
              </button>
            </div>
          </section>

        </div>

        <div className="col">
          <section className="card">
            <h2 className="section-title">{t('data')}</h2>
            <div className="actions">
              <button
                type="button"
                className="btn secondary"
                disabled={!hasTransactions || busy}
                onClick={handleExportAll}
              >
                {t('exportAll')}
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={handleDownloadBackup}
              >
                {t('downloadBackup')}
              </button>
              <label className={busy ? 'btn secondary disabled' : 'btn secondary'}>
                {t('restoreBackup')}
                <input
                  type="file"
                  accept="application/json,.json"
                  hidden
                  disabled={busy}
                  onChange={handleRestoreFile}
                />
              </label>
              {!hasTransactions && (
                <button
                  type="button"
                  className="btn secondary"
                  disabled={busy}
                  onClick={async () => {
                    const { confirmed } = await confirm({
                      message: t('loadSampleConfirm'),
                      confirmLabel: t('loadSample'),
                    })
                    if (confirmed) run(loadSampleData)
                  }}
                >
                  {t('loadSample')}
                </button>
              )}
              {hasAnyData && (
                <button
                  type="button"
                  className="btn danger"
                  disabled={busy}
                  onClick={handleClear}
                >
                  {t('clearAll')}
                </button>
              )}
            </div>
            <p className="sub backup-note">
              {lastBackup
                ? `${t('lastBackup')} ${formatDate(parseDate(lastBackup), locale)}`
                : t('noBackupYet')}
            </p>
          </section>

          <section className="card">
            <h2 className="section-title">{t('legalSection')}</h2>
            {consent && (
              <p className="sub">
                {t('legalAccepted')
                  .replace('{v}', consent.version)
                  .replace(
                    '{date}',
                    formatDate(new Date(consent.acceptedAt), locale),
                  )}
              </p>
            )}
            <ul className="legal-links">
              {LEGAL_DOCS.map(({ id, titleKey }) => (
                <li key={id}>
                  <Link className="text-link" to={`/legal/${id}`}>
                    {t(titleKey)}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="actions">
              <button
                type="button"
                className="btn danger"
                disabled={busy}
                onClick={handleWithdraw}
              >
                {t('withdrawConsent')}
              </button>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
