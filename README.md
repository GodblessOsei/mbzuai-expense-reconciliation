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

## Deployment (Render + Supabase)

Backend on Render, Postgres and file storage on Supabase, frontend on Vercel.

Render service settings:

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Build Command | `npm ci` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

Environment variables are listed in `backend/.env.example`. Do NOT set `PORT` —
Render assigns it.

### Heap ceiling

Set `NODE_OPTIONS` as a Render environment variable, sized to the instance:

| Instance RAM | NODE_OPTIONS |
|---|---|
| 512 MB | `--max-old-space-size=400` |
| 2 GB   | `--max-old-space-size=1536` |
| 4 GB   | `--max-old-space-size=3072` |

Roughly 75-80% of container RAM, leaving room for the runtime and for Buffers,
which live outside the V8 heap.

Without a ceiling below the container limit, V8 may size its heap from the
HOST's memory rather than the container's, delay garbage collection past the
limit, and get OOM-killed by the kernel — a silent process death with nothing
in the logs. With it, the same situation raises a normal "JavaScript heap out
of memory" error with a stack trace.

This must be a real environment variable, NOT a line in `.env`: dotenv loads
after Node has already started and sized the heap, so it would have no effect.
It is deliberately not in `.env.example` for that reason.
