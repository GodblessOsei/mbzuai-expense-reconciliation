# Deployment Options

### MBZUAI RLA Prepaid Card Reconciliation System

## Overview

Following feedback on the initial deployment plan, we are no longer pursuing Microsoft Azure.
The concern raised was practical rather than technical: Azure is built for large-scale
institutional deployments, and for a system of this size the setup and handover process with
MBZUAI IT would take considerably longer than the system itself took to build.

The underlying finding from that plan still stands. The backend cannot run in a serverless
environment, because receipt scanning takes longer than serverless platforms allow and because
receipt files need to persist for months. So we still need a properly hosted backend — just on
a smaller, simpler platform.

This document lays out the options for the three components that need hosting decisions. The
web interface is not covered here; it stays on Vercel, which suits it well.

The three components are:

1. **The backend server** — receives receipts, runs AI scanning, generates PDFs and spreadsheets
2. **The database** — transaction records, users, cardholders, reconciliation periods
3. **Receipt file storage** — the receipt images and PDFs themselves

---

## 1. The backend server

**What it needs to do.** Accept uploaded receipts, send them to the AI scanning service and wait
for a reply, generate the standardised PDFs, and build the export packages managers download at
the end of each reconciliation period.

**The one hard requirement: it has to stay running.** Receipt scanning can take up to a minute
because an AI model is reading the images. Serverless platforms cut requests off well before
that. We need a server that is simply always on, which is a modest and inexpensive thing to ask
for at our size.

Beyond that, our needs are small. Four cardholders submitting receipts over a two-week cycle is
close to no traffic at all. We are paying for a machine to exist, not for capacity.

### Options

**Render** *(recommended)*
- Pros: Straightforward to set up and, more importantly, straightforward to explain to whoever
  inherits it. Deploys automatically when we push code. Handles security certificates itself.
- Cons: The free tier puts the server to sleep when idle, which brings back the slow-start
  problem we are trying to avoid — so the paid tier is required, not optional.

**Railway**
- Pros: Billed by actual usage, which suits our very low traffic. The database can live in the
  same project as the server, which keeps them close and fast.
- Cons: Usage-based billing is less predictable than a fixed monthly fee. Slightly more moving
  parts to hand over.

**Fly.io**
- Pros: Can run servers in regions closer to the UAE, which makes the system feel faster for
  users in Abu Dhabi. Very capable.
- Cons: More infrastructure knowledge required to operate. Better suited to a team with
  dedicated engineering support than to a handover.

**A self-managed server (DigitalOcean, Hetzner, or MBZUAI's own hardware)**
- Pros: Cheapest option for the computing power. Complete control.
- Cons: Someone becomes permanently responsible for security updates, certificate renewals,
  backups, and monitoring. This recreates exactly the long-term ownership burden that moving
  away from Azure was meant to avoid.

**Recommendation: Render.** The deciding factor is not performance — any of these would run this
system comfortably. It is that this project will be handed to someone else, and Render's setup
can be explained in a single page.

---

## 2. The database

**What it needs to do.** Store transactions, users, cardholders, reconciliation periods and
review flags. The data volume is genuinely small — a few hundred transactions per year.

**The one hard requirement: reliable backups.** This is financial reconciliation data, so losing
it is not an inconvenience, it is a reportable incident. This is the one component where the
cheapest option is not automatically the right one.

### Options

**Supabase** *(recommended)*
- Pros: Standard PostgreSQL, so nothing in our system needs to change. Also provides the file
  storage described in the next section, meaning one provider and one account instead of two.
  Includes a browser interface for inspecting data, which is useful during handover.
- Cons: On the free tier, projects are paused after about a week of inactivity. This matters
  more than it sounds for us — our system is used every two weeks, so a free project could be
  asleep almost every time a manager returns to it. The paid tier removes this.

**Neon**
- Pros: Generous free allowance. Can create instant throwaway copies of the database for testing
  changes safely, which is genuinely useful during development.
- Cons: Does not offer file storage, so we would need a second provider for receipts.

**Railway PostgreSQL**
- Pros: Sits in the same project as the backend, so the two communicate privately and quickly.
  Simplest possible arrangement.
- Cons: Backup arrangements need to be configured deliberately rather than being provided by
  default.

**Render PostgreSQL**
- Pros: Same provider as the backend, so one account and one bill.
- Cons: Free databases are deleted after 90 days. For a system expected to outlive the current
  development period, this is a real risk and the paid tier should be treated as mandatory.

**Recommendation: Supabase**, primarily because it also covers file storage. Consolidating two
components with one provider meaningfully reduces what has to be documented and handed over.

---

## 3. Receipt file storage

**What it needs to do.** Hold the receipt photos and PDFs that RLAs submit, plus the standardised
PDFs, spreadsheets and archive files the system generates.

**Two hard requirements.**

*Files must outlive the server.* Managers read receipts back weeks after submission, when
building a reconciliation package. Files stored on the server itself are erased every time the
server restarts or is updated, so a separate storage service is not optional.

*Storage must be private.* Receipts are financial records tied to named individuals. If files
were publicly accessible, anyone who obtained a link could read them. Access must go through the
system's own login, which our design already enforces.

### Options

**Supabase Storage** *(recommended)*
- Pros: Same provider as the database. Uses the Amazon S3 standard, which matters practically:
  it is the common language of cloud storage, so if we ever move providers, very little code
  changes.
- Cons: Lower transfer speeds than Amazon's own service, which is not a factor at our file sizes.

**Cloudflare R2**
- Pros: Also S3-standard. Notably, no charge for data transfer out, where most providers charge
  per download. Very inexpensive.
- Cons: A separate provider to set up and hand over.

**Amazon S3**
- Pros: The original and the most capable. Cheapest per gigabyte stored.
- Cons: Amazon's permissions system is genuinely difficult to configure correctly, and getting it
  wrong is how storage buckets end up publicly exposed. This is the same "enterprise complexity
  at small scale" problem that ruled out Azure.

**Cloudinary**
- Pros: Automatically generates image previews and thumbnails, which would be a nice improvement
  for browsing receipts.
- Cons: Built for images specifically, and we also store spreadsheets and archive files, which it
  handles awkwardly. It does not use the S3 standard, so it is the one option that would require
  writing separate code rather than reusing what we have.

**Recommendation: Supabase Storage**, for the same consolidation reason as the database. If cost
becomes a concern later, Cloudflare R2 is the natural alternative and the switch would be small.

---

## Points that apply across all three

**Keep everything in the same region.** The backend and database should sit in the same data
centre. Every page in the system asks the database several questions in sequence, and if the two
are far apart, each question pays a travel delay that accumulates into a visible lag. This costs
nothing to get right at setup and is awkward to correct afterwards.

**Watch the free tiers.** Each provider's free tier has a catch that specifically affects a
system used every two weeks: Render sleeps idle servers, Supabase pauses idle projects, and
Render's free databases are deleted after 90 days. The paid entry tiers are inexpensive and
remove all three problems.

**Expected cost.** The entry-level paid tiers across these providers are in the region of
$25–40 per month in total. Exact figures should be confirmed at signup, as provider pricing
changes.

---

## Recommended combination

| Component | Recommendation | Why |
|---|---|---|
| Web interface | Vercel | Already suitable; no change needed |
| Backend server | Render | Always-on, and simple to hand over |
| Database | Supabase | Standard PostgreSQL with proper backups |
| Receipt storage | Supabase Storage | Same provider as the database; S3 standard |

This gives three providers in total, one of which is already in place.

The alternative worth mentioning is **Railway for everything except the web interface**, which
consolidates further to two providers and bills by usage. It is a reasonable choice; we lean
towards Render and Supabase because their setup is easier to document for handover.

---

## What we need to proceed

1. **Confirmation of the direction** — Render plus Supabase, or a preference for one of the
   alternatives above.
2. **Account ownership** — whether these accounts should be created under MBZUAI, under NxtGen
   Launch, or under the development team initially and transferred later. This is worth settling
   early, as moving billing and ownership afterwards is more disruptive than setting it up
   correctly at the start.
3. **Who administers the system after handover** — unchanged from the previous plan, and still
   the most important open question.

## In the meantime

Development is not blocked. The system was already built so that receipt storage can be switched
between local files and cloud storage through a single setting, so adopting any of the storage
options above is a small, contained change rather than a rewrite. Preparation work continues
regardless of which providers are chosen.
