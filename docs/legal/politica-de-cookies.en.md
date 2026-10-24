# Cookies and Storage Policy: I AM POOR FOR NOW (POBRE, POR AHORA)

Version 1.0 · [FECHA / DATE]

> DRAFT: must be reviewed by a Costa Rican lawyer before it is published. The Spanish text is the main one; this is a courtesy translation.

Versión en español: cambia el idioma a Español en Ajustes (Settings).

## 1. Short summary

- The app uses no cookies.
- The app uses no tracking, usage analytics, ads or third-party services.
- It only stores on your device what it needs to work: your data and your preferences.
- There is no cookie banner because none is needed today (section 6).

## 2. What we do NOT use

- Cookies of any kind (first-party or third-party).
- Google Analytics or similar tools.
- Ad or social media pixels.
- Fonts or scripts downloaded from other sites (the fonts are bundled in the app).

## 3. What the app stores in your browser

In the browser, the app stores the following. On Android it will store equivalent things inside the app.

### Database (IndexedDB)

| What | Content | Why it is necessary |
|---|---|---|
| The app's database (IndexedDB, created by the jeep-sqlite library; it holds the SQLite database "quincena") | All your data: profile, transactions, categories, budgets, recurring bills, savings and pay period schedule | Without it the app cannot save anything you type |

### Preferences (localStorage)

| Key | What it stores | Why it is necessary |
|---|---|---|
| `lang` | Language (`es` or `en`) | To show the app in your language |
| `theme` | Theme (`dark` or `light`) | To show the theme you chose |
| `lastCurrency` | Last currency used | To suggest it when adding a transaction |
| `lastPaymentMethod` | Last payment method used | To suggest it when adding a transaction |
| `lastCategoryId` | Last expense category used | To suggest it when adding an expense |
| `lastBackup` | Date of the last backup downloaded | To tell you when it is time for a backup |
| `backupReminderSnoozedUntil` | Date until which you asked not to see the backup reminder ("Not now", 14 days) | Not to show you the reminder again before that date |
| `rolloverSkipped.CRC` and `rolloverSkipped.USD` | The pay period in which you skipped the offer to move the leftover to savings | Not to offer it again in that pay period |
| `finance-data` (old versions only) | Data from old versions of the app, already copied into the database | To bring your old data into the new version |
| `finance-data-imported` | A mark saying that copy was already done | So it is not copied twice |

These preferences do not identify you and do not leave your device. The `finance-data` and `finance-data-imported` keys may not exist if you never used an old version.

## 4. Why they are strictly necessary

Everything in section 3 is needed to give you the service you ask for: saving your data and showing the app the way you left it. It is not used to measure you or to show you ads, and it is shared with nobody.

## 5. How to delete them

- Your data: Settings > "Clear all data". This empties the database and removes the preferences in section 3, except the language, the theme and the record of your consent.
- Everything (data and preferences), in the browser: open the site settings and choose to clear the site data (in Chrome: padlock next to the address > Site settings > Clear data). Clearing "cookies and site data" from history also works.
- On Android: uninstall the app, or go to the phone's Settings > Apps > the app > Storage > Clear data.
- Important: this also deletes your financial data. Download a backup first if you want to keep it.

## 6. Is a consent banner needed?

- Not today. Costa Rica has no specific cookie law. The rule comes from Law 8968 when data that identifies a person is processed. The storage above is necessary for the app to work, identifies nobody outside your device, and does not leave it. [UNVERIFIED: the lawyer must confirm this conclusion.]
- Before adding usage analytics, ads or any storage that is not strictly necessary, we will add a banner where you can accept or reject, with "reject" as easy as "accept", and we will not turn anything on before you answer.

## 7. Future changes

When cloud sync is turned on (not active yet), signing in will store a session (a session identifier) on your device to keep you signed in. That will be strictly necessary and we will add it to this list. Data will go to the cloud as described in the privacy policy, section 13.

## 8. Contact

[CORREO DE CONTACTO] · [DIRECCIÓN]

## Items the team must fill in

- [FECHA]
- [CORREO DE CONTACTO]
- [DIRECCIÓN]
- Confirm the exact name of the IndexedDB database with DevTools (Application tab) before publishing
