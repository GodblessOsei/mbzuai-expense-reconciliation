# MBZUAI RLA Prepaid Card Reconciliation System

Automates a manual prepaid-card expense workflow for MBZUAI Residential Life.
Residential Life Assistants photograph their receipts, AI reads the transaction
details, and the system flags anything needing review. Managers approve each
two-week reconciliation period and export it as PDFs and spreadsheets.

## Features

- **Receipt scanning** — photograph or upload a receipt (image or PDF) and an AI
  model extracts vendor, date, amount, invoice number and card digits
- **Multi-file submissions** — several pages of one order, or several receipts of
  one purchase; the code does the arithmetic, the model only reads
- **Automatic flagging** — late submissions, card mismatches, currency mismatches
  and alternative payment methods are raised for manager review
- **Two-week reconciliation periods** — Friday to Thursday, assigned automatically
  from the purchase date
- **Manager review** — resolve flags, edit transactions with a full audit trail,
  deactivate people, manage cards and budgets
- **Exports** — standardised PDF per receipt, spreadsheet per period, and a
  zipped archive of the whole period
- **Authentication** — username and password with bcrypt and JWT sessions, split
  into RLA and manager roles

## Tech Stack

### Frontend
- React 19 (plain JavaScript, not TypeScript)
- Vite
- Tailwind CSS v3
- Recharts

### Backend
- Node.js 24
- Express 5
- `pg` (raw SQL — no ORM)

### Database & Storage
- PostgreSQL 16 (Supabase in production)
- Supabase Storage, via any S3-compatible driver

### Other
- OpenRouter (`openai/gpt-4o-mini`) for receipt reading
- pdf-lib, ExcelJS, pdf-to-img for document generation
- Render for hosting

## Project Structure

```text
mbzuai-expense-reconciliation/
├── backend/
│   ├── src/
│   │   ├── controllers/     # thin: validate input, call a service, return
│   │   ├── services/        # business logic (OCR, PDF, spreadsheets, auth)
│   │   ├── routes/
│   │   ├── middleware/      # auth guard, role guard, case conversion
│   │   ├── db/              # pool, schema.sql, seed.sql, manageAdmin.js
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/           # rla/ and manager/ screens
│   │   ├── components/
│   │   ├── context/         # AuthContext
│   │   ├── hooks/
│   │   └── api/             # axios client
│   ├── .env.example
│   └── package.json
│
├── render.yaml              # deployment for both services
├── LICENSE
└── README.md
```

## Prerequisites

- Node.js 24 (`nvm use`)
- npm (do not mix in yarn or pnpm)
- PostgreSQL 16
- Git
- An [OpenRouter](https://openrouter.ai) API key for receipt scanning

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/<org>/mbzuai-expense-reconciliation.git
cd mbzuai-expense-reconciliation
nvm use
```

### 2. Install dependencies

```bash
cd backend && npm ci
cd ../frontend && npm ci
```

### 3. Configure environment variables

```bash
cd backend && cp .env.example .env
cd ../frontend && cp .env.example .env
```

Generate a session key and paste it into `backend/.env` as `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 4. Create the database

```bash
cd backend
psql -d postgres -f src/db/schema.sql    # creates every table
psql -d postgres -f src/db/seed.sql      # test data — LOCAL ONLY
```

Seeded accounts all use the password `Password123!`:

| Username | Role | Card |
|---|---|---|
| `neil.hammond@example.dev` | manager | — |
| `jose@example.dev` | RLA | 8593 |
| `xiwei@example.dev` | RLA | 6954 |
| `hawau@example.dev` | RLA | 4924 |
| `seung@example.dev` | RLA | 9570 |

## Environment Variables

| Variable | Description |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Local Postgres connection |
| `DATABASE_URL` | Full connection string; used instead of the above when set (production) |
| `PORT` | Backend port, default 5050. Never set this on Render |
| `JWT_SECRET` | **Required.** Signs session tokens; the server refuses to start a session without it |
| `JWT_EXPIRES_IN` | Session length, default `12h` |
| `OPENROUTER_API_KEY` | Receipt scanning |
| `STORAGE_DRIVER` | `local` for development, `s3` for production |
| `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Supabase Storage; only when `STORAGE_DRIVER=s3` |
| `CORS_ORIGINS` | Allowed browser origins. Not needed in the standard deployment |
| `VITE_API_BASE_URL` | Frontend only. Keep it as `/api` |

## Running Locally

Two terminals.

```bash
cd backend && npm run dev      # http://localhost:5050
```

```bash
cd frontend && npm run dev     # http://localhost:5173
```

Open http://localhost:5173. The Vite dev server proxies `/api` to the backend,
so there is no CORS to configure.

> `npm start` has no auto-restart. Restart it after every change.

## API

All routes are under `/api` and require a `Bearer` token except where noted.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Sign in — **public** |
| GET | `/api/auth/me` | Current user, for restoring a session on refresh |
| POST | `/api/auth/change-password` | Change your own password |
| GET | `/api/health` | Liveness probe — **public** |
| POST | `/api/uploads` | Upload receipt files |
| POST | `/api/ocr/extract` | Read data off uploaded receipts |
| POST | `/api/transactions/final-submit` | Submit a transaction |
| GET | `/api/transactions/mine` | Your own submissions |
| GET | `/api/transactions` | All transactions — *manager* |
| PATCH | `/api/transactions/:id` | Edit a transaction — *manager* |
| POST | `/api/transactions/:id/generate-pdf` | Generate the standardised PDF — *manager* |
| GET | `/api/transactions/:id/pdf` | Download it — *manager* |
| GET | `/api/transactions/:id/audit-logs` | Who changed what — *manager* |
| PATCH | `/api/flags/:flagId/resolve` | Resolve a flag |
| GET | `/api/cardholders` | All cards |
| PATCH | `/api/cardholders/:id/assign` | Assign a card to someone — *manager* |
| GET/POST | `/api/users` | List and create people — *manager* |
| POST | `/api/users/:userId/reset-password` | Issue a temporary password — *manager* |
| GET | `/api/reconciliation-periods` | All two-week periods |
| GET/POST | `/api/budgets/:year` | Annual budget — *manager* |
| GET | `/api/dashboard/spending-by-*` | Charts by category, cardholder, department, vendor, budget item — *manager* |
| GET/POST | `/api/spreadsheets` | Preview, generate and download — *manager* |
| POST | `/api/packages/download` | Zipped archive for a period — *manager* |

Requests and responses are camelCase; the database is snake_case. Middleware
translates between them.

## Testing

```bash
cd backend && npm test
```

Uses Node's built-in test runner — nothing to install. Covers password hashing,
session tokens, reconciliation-period maths, CORS rules, and the API routes end
to end. Needs no database and runs in about a second.

## Deployment

The API and web interface run on **Render**; the database and receipt storage
are **Supabase**. `render.yaml` defines both Render services.

Follow these in order.

### 1. Create the Supabase project

1. Sign up at [supabase.com](https://supabase.com) and create a new project.
2. Choose a strong database password and **save it** — you need it in step 2.
3. Wait for the project to finish provisioning (a minute or two).

### 2. Get the database connection string

1. In your Supabase project, click **Connect** at the top of the page.
2. Choose **Session pooler** (not Direct connection — the direct host is
   IPv6-only and many networks cannot reach it).
3. Copy the string. It looks like
   `postgresql://postgres.abc:[YOUR-PASSWORD]@aws-0-eu-west-2.pooler.supabase.com:5432/postgres`
4. Replace `[YOUR-PASSWORD]` with the password from step 1. Save this as your
   `DATABASE_URL`.

### 3. Create the database tables

From your own machine, using the string from step 2:

```bash
psql "postgresql://postgres.abc:yourpassword@aws-0-...:5432/postgres" \
  -f backend/src/db/schema.sql
```

Do **not** run `seed.sql` — that is test data with a publicly known password.

### 4. Set up file storage

1. In Supabase, go to **Storage** and create a bucket named `receipts`.
2. Go to **Storage → S3 Connection** and copy the **endpoint URL** and **region**.
3. Go to **Storage → S3 Access Keys**, create a key pair, and copy both values.
   The secret is shown once.

### 5. Get an OpenRouter key

1. Sign up at [openrouter.ai](https://openrouter.ai).
2. Create an API key and add some credit. Receipt scanning uses
   `openai/gpt-4o-mini`, which costs a fraction of a cent per receipt.

### 6. Deploy to Render

1. Sign up at [render.com](https://render.com) and connect your GitHub account.
2. Add a payment method. The API runs on the smallest paid instance; free
   instances sleep when idle and are slow to wake.
3. Click **New → Blueprint**.
4. Select this repository and the branch to deploy (`main`).
5. Render reads `render.yaml` and shows two services:
   `mbzuai-reconciliation-api` and `mbzuai-reconciliation-web`.
6. Render prompts for the secrets it cannot generate. Fill in the values you
   collected above:

   | Variable | From |
   |---|---|
   | `DATABASE_URL` | step 2 |
   | `OPENROUTER_API_KEY` | step 5 |
   | `S3_BUCKET` | `receipts` |
   | `S3_ENDPOINT`, `S3_REGION` | step 4 |
   | `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | step 4 |

   You are **not** asked for `JWT_SECRET`. Render generates it.

7. Click **Apply** and wait for both services to build.

### 7. Set the memory ceiling

On the API service: **Environment → Add Environment Variable**.

| Key | Value |
|---|---|
| `NODE_OPTIONS` | `--max-old-space-size=400` |

Use roughly 75% of the instance's RAM. Without it Node can size its heap from
the host's memory and get killed by the kernel with nothing in the logs.

Set it as a Render variable, not in `.env` — `.env` is read after Node has
already sized the heap.

### 8. Create the first manager

Nobody can sign in until a manager exists, and no API route can create the
first one. Open the API service's **Shell** tab in Render:

```bash
node src/db/manageAdmin.js create --username=dylan --name="Dylan Maurer"
```

It prints a temporary password **once** — copy it before closing the shell.
That manager creates everyone else from inside the app.

### 9. Check it works

1. Open the web service's URL (`https://mbzuai-reconciliation-web.onrender.com`).
2. Sign in with the username and temporary password from step 8.
3. You are asked to set a new password.
4. Go to **Managers** and **RLAs** to add the rest of the team.

If the site loads but every action fails, the `/api` rewrite is not reaching the
API. Set `VITE_API_BASE_URL` on the web service to
`https://mbzuai-reconciliation-api.onrender.com/api`, set `CORS_ORIGINS` on the
API service to the web service's URL, then redeploy both.

## Contributing

- `main` — stable, demo-ready only
- `dev` — integration branch; everything merges here first
- `feature/<name>-<description>` — e.g. `feature/godbless-upload-ui`

1. Branch off `dev`
2. Make your changes
3. Run `npm test` in `backend`
4. Open a pull request into `dev`
5. Merge `dev` into `main` only when demo-ready

If you add an environment variable, update the matching `.env.example` in the
same commit.

## License

Proprietary. Copyright (c) 2026 Mohamed bin Zayed University of Artificial
Intelligence, all rights reserved. See [LICENSE](LICENSE).
