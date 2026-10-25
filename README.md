# I AM POOR FOR NOW

**POBRE, POR AHORA** in Spanish. A personal finance app for Costa Rica: it follows your income, expenses, savings, budgets and fixed bills through each quincena (pay period), in colones and dollars, in Spanish or English.

> **Status:** in development. The web app works in the browser: you sign in with email and password, and each account's data is kept in the cloud (Firebase Firestore), so it is the same in any browser. The Android app is planned.

## Where things are

| Folder or file | What it holds |
| --- | --- |
| [`finance-tracker/`](finance-tracker/) | The app (React + Vite). Its [README](finance-tracker/README.md) has the features, how to run it, the tech stack and the progress log |
| [`docs/`](docs/) | Decisions, backlog, plans, audits and legal drafts (in Spanish) |

## Run it

You need Node.js 22.13 or newer.

```bash
cd finance-tracker
npm install
npm run dev
```

Then open the address Vite prints, usually http://localhost:5173. Sign-in needs the Firebase settings in `finance-tracker/.env.local` (copy `.env.example`; never commit it). More in the [app README](finance-tracker/README.md#getting-started).

## Documents

- [Decision log](docs/decisiones.md) and [backlog](docs/backlog.md)
- [Firebase plan](docs/plan-base-de-datos-firebase.md), [data per account](docs/datos-por-cuenta.md) and [handoff sheets](docs/traspasos/) (ficha 006: publish the Firestore rules)
- [Deploy to Netlify](docs/despliegue-netlify.md)
- [Design research, UI audit and redesign QA](docs/diseno/)
- [Code and docs audit](docs/auditoria-codigo-y-documentos.md)
- [Data and dark patterns audit](docs/auditoria-datos-y-patrones.md)
- [Encryption research](docs/investigacion-cifrado.md)
- [QA guide](docs/qa/guia-qa.md): how to run every test suite (including against the real Firebase), what was found, and how to reuse it in another project; plus the [income and savings QA](docs/qa/qa-ingresos-ahorros.md) and the [Firebase security review](docs/qa/revision-seguridad-firebase.md)
- [Security policy](SECURITY.md) and [threat model](docs/seguridad/modelo-de-amenazas.md) (in Spanish)
- [Legal drafts](docs/legal/): privacy policy, terms and conditions, refund policy and cookie policy. Drafts only, pending review by a Costa Rican lawyer

## Team

- **Ian** (branch `ZOH`): design and the visual side of the app
- **Furyan** (branch `PAT`): database and data; merges into `main`
