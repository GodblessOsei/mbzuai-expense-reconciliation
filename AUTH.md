# Authentication

## Local setup

```bash
cd backend
npm install

# Session signing key — required, the server refuses to start a session without it
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# paste into .env as JWT_SECRET=...

psql -d postgres -f src/db/schema.sql      # fresh database only
node src/db/migrations/002-auth-identity.js --apply   # existing database only
psql -d postgres -f src/db/seed.sql
node src/server.js                         # no nodemon — restart after changes
```

### Seeded development logins

Every seeded account uses the password **`Password123!`**.

| Email | Role | Card |
|---|---|---|
| `neil.hammond@example.dev` | manager | — |
| `jose@example.dev` | RLA | •••• 8593 |
| `xiwei@example.dev` | RLA | •••• 6954 |
| `hawau@example.dev` | RLA | •••• 4924 |
| `seung@example.dev` | RLA | •••• 9570 |

These exist so a new developer can clone, seed and sign in with no setup. They are for
local development only. For a real deployment, seed nothing and create the first manager
with `manageAdmin.js` below.

## The design in one idea

Three things that used to be tangled together are now separate:

- **People** (`users`) — who signs in. Has a name, an email, a password.
- **Cards** (`cardholders`) — the physical prepaid cards. A card is a thing in its own
  right: it outlives whoever currently holds it and keeps its history when reassigned.
- **Assignment** (`cardholders.assigned_user_id`) — "this card is currently Hawau's".
  Drives defaults and visibility. **Never a permission.**

The client is explicit that RLAs use each other's cards. So the card can no longer identify
the person, and identity moved onto the submitter instead.

### The two rules that carry it

**1. `user_id` comes from the session. `cardholder_id` comes from the request body.**

`transactions.user_id` is read from `req.user` in the controller and is never accepted from
the client. It is the only accountability anchor left once cards are shared — a submitter
the client could name would be a claim, not a fact, and the audit trail would be decorative.

The same applies to `additional_spending.created_by_user_id` and to the `editor` name on
`audit_logs`.

**2. Default deny.**

`app.use("/api", requireAuth)` sits in app.js above every route except `/api/auth`.
Routes added later are protected automatically and must be deliberately moved above the
line to be public. Guarding routes one at a time means the next route someone adds is open
until they remember.

`requireAuth` re-reads the user row on every request rather than trusting the token's copy.
One indexed lookup makes deactivation instant instead of "whenever their token expires".

## What each role sees

**Managers** see everything, and all managers see the same everything — no per-manager
scoping anywhere. Individual logins exist purely so actions carry a name, not to vary
access.

**RLAs** see the union of two sets, via `GET /api/transactions/mine`:

- everything **they submitted**, wherever it was charged
- everything charged to **their card**, whoever submitted it

Both are needed and they answer different questions. The AED 5,000 limit is a fact about
the *card*, so it must include spending someone else put on it. "Did I file on time" is a
fact about the *submitter*. The dashboard keeps these visually separate for that reason —
one merged total would eventually mislead someone about their balance.

Lateness follows the submitter, not the card: if Jose sits on a receipt he bought on
Hawau's card, that is Jose's late filing.

Card-based visibility starts at `cardholders.assigned_at`, so a new cardholder cannot
browse the previous holder's receipts.

## Administration

RLAs and managers are administered on **separate screens**, because the rules differ:

| | `/manager/rlas` | `/manager/managers` |
|---|---|---|
| Holds a prepaid card | **Exactly one, always** | **Never** |
| Cards available | unlimited — register any new one | — |
| What they do | submit expenses | review and administer |

**Every RLA holds exactly one card, and there is no cap on cards.** Adding an RLA is
therefore never blocked on card supply — the manager either types the last four digits of a
new card, or picks one already in the system that nobody is holding. Both happen in the
same request (`POST /api/users` takes either `newCardLastFour` or `cardholderId`), so a
half-finished create cannot leave a cardless RLA behind.

Three rules the API enforces:

- **A manager never holds a card.** `createUser` rejects a manager given one;
  `assignCardholder` rejects any card assigned to a manager.
- **A card another ACTIVE RLA holds cannot be taken.** Taking it would leave that person
  cardless. The manager must free it first — switch them off, or give them a different
  card. The error names the holder.
- **One card per person.** Assigning a card releases any other card that person holds.
  Everything downstream assumes this: the RLA dashboard shows a single balance meter and
  `findAssignedCard` takes `LIMIT 1`, so a second card would silently never be seen.

Switching an RLA off **releases** their card. Releasing is not retiring: the card keeps its
number, its limit and every transaction charged to it, and becomes free for their
replacement. Reactivating someone does not restore their old card — it may already belong
to someone else.

`cardholder_name` follows whoever currently holds the card, because it is the name
spreadsheets and packages print. A released card falls back to `Card 8593`.

**"Removing" someone sets `is_active = FALSE`. Never delete.** Transactions and audit_logs
reference `user_id`; a delete would either fail on the constraint or quietly rewrite
financial history. A switched-off person cannot sign in and vanishes from every dropdown,
but everything they submitted stays exactly as it was, with their name on it.

Retiring a **card** is a separate action. A person leaving does not retire a card.

### Passwords

There is no mail server, so the manager is the delivery mechanism — which works because
this is a handful of people in one building who know each other by sight. Creating a user
or resetting a password returns a temporary password shown **once**; only its hash is
stored. The recipient is forced to choose their own at next sign-in.

Managers reset each other. They are exact peers with identical access, so there is no
privilege for one to gain over another, and nobody waits on a single administrator.

### The two doors outside the app

```bash
node src/db/manageAdmin.js create --email=... --name="Full Name" [--role=manager|rla]
node src/db/manageAdmin.js reset  --email=...
node src/db/manageAdmin.js list
```

`create` makes the **first manager** — nobody can sign in to create anyone until one
exists. `reset` is the **locked-out escape hatch**; it also reactivates the account, since
a password alone would not help if the account had been switched off. Shell access to the
server is the access control. Every system has this door; the failure mode is pretending it
does not and improvising during an outage.

Note that deactivation cannot lock the system out: `requireRole` guarantees the caller is
an active manager, and a manager cannot deactivate themselves, so there is always at least
one manager left standing.

## Gotchas

- **A plain `<a href>` cannot download a protected file.** Browser navigation sends no
  Authorization header. Use `openAuthedFile` / `downloadAuthedFile` from `api/client.js`,
  which fetch with the token and hand the browser a blob URL. A token in the query string
  would put a credential into browser history and server logs.
- **Emails are stored lowercase.** Normalise at the controller edge or you get two accounts
  for one person.
- **Login failures are deliberately vague** ("Incorrect email or password") for missing,
  wrong-password and deactivated accounts alike — distinguishing them tells an outsider
  which emails are real. Manager-facing errors are specific, because managers are trusted.
- **Route guards in the frontend are convenience, not security.** They stop an RLA seeing a
  manager screen; the backend stops them calling the endpoint.
