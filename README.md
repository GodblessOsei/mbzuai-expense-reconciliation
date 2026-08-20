# MBZUAI RLA Prepaid Card Reconciliation System

## Toolchain

- Node 24 (run `nvm use`)
- PostgreSQL 16
- Package manager: npm only (do not mix yarn/pnpm)
- JSON responses use camelCase

## Branching & PR workflow

- `main` — stable, demo-ready code only
- `dev` — integration branch; all work merges here first
- `feature/<name>-<desc>` — e.g. feature/godbless-upload-ui
- Flow: branch off `dev` → build → PR into `dev` → reviewed by the other
  person → merge. Only merge `dev` → `main` when demo-ready.
- Rule: if you add an env var, update the matching `.env.example` in the
  same commit.

## Getting started (fresh clone)

1. nvm use (Node 24)
2. cd backend && npm ci && cp .env.example .env (fill in values)
3. cd frontend && npm ci && cp .env.example .env
4. Backend: npm run dev (port 5050)
5. Frontend: npm run dev (port 5173)
