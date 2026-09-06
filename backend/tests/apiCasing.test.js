// The API speaks camelCase, Postgres speaks snake_case, and the translation now
// happens in middleware rather than by hand in each controller.
//
// These tests cover both halves: the conversion itself, and -- more importantly
// -- that a controller which hands back a raw database row still produces a
// camelCase response. That was the actual bug: `flags` and
// `reconciliation_periods` were going out with column names while `users` and
// `cardholders` were mapped, so the frontend had to know which endpoints spoke
// which language.
process.env.JWT_SECRET = "test-only-secret-not-used-anywhere-real";

const test = require("node:test");
const assert = require("node:assert/strict");

const app = require("../src/app");
const pool = require("../src/db/pool");
const authService = require("../src/services/authService");
const { toApiShape } = require("../src/middleware/camelCaseResponse");
const { withBothSpellings } = require("../src/middleware/normalizeRequestBody");

// ---------------------------------------------------------------------------
// The conversion itself
// ---------------------------------------------------------------------------

test("database column names become API field names", () => {
  assert.deepEqual(
    toApiShape({ reconciliation_period_id: 3, start_date: "2026-07-24" }),
    { reconciliationPeriodId: 3, startDate: "2026-07-24" }
  );
});

test("only keys are renamed -- values are left exactly as they are", () => {
  // Flag types and OCR modes are snake_case DATA. Rewriting them would change
  // what "late_submission" means, not just how it is spelled.
  const converted = toApiShape({ flag_type: "late_submission", mode: "single_order" });

  assert.equal(converted.flagType, "late_submission");
  assert.equal(converted.mode, "single_order");
});

test("dates survive conversion", () => {
  // Recursing into a Date would turn it into {} and every timestamp in the API
  // would silently become an empty object.
  const purchasedAt = new Date("2026-08-01T09:00:00Z");

  assert.equal(toApiShape({ purchase_date: purchasedAt }).purchaseDate, purchasedAt);
});

test("nested objects and arrays are converted all the way down", () => {
  assert.deepEqual(
    toApiShape({ transactions: [{ vendor_name: "Carrefour", flags: [{ flag_id: 1 }] }] }),
    { transactions: [{ vendorName: "Carrefour", flags: [{ flagId: 1 }] }] }
  );
});

test("null and already-camelCase values pass through untouched", () => {
  assert.deepEqual(
    toApiShape({ pdf_path: null, alreadyCamel: 1, count: 0 }),
    { pdfPath: null, alreadyCamel: 1, count: 0 }
  );
});

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

test("a camelCase request body also arrives under its snake_case name", () => {
  // Controllers on the submission path read seventeen snake_case fields. The
  // client sends camelCase and this is what keeps both working.
  const body = withBothSpellings({ amountAed: "10.00", cardholderId: 3 });

  assert.equal(body.amount_aed, "10.00");
  assert.equal(body.cardholder_id, 3);
  assert.equal(body.amountAed, "10.00");
});

test("what the client actually sent always wins over a generated alias", () => {
  const body = withBothSpellings({ amountAed: "NEW", amount_aed: "ORIGINAL" });

  assert.equal(body.amountAed, "NEW");
  assert.equal(body.amount_aed, "ORIGINAL");
});

// ---------------------------------------------------------------------------
// End to end: the endpoints that used to leak column names
// ---------------------------------------------------------------------------

let server;
let baseUrl;
let token;

test.before(async () => {
  const passwordHash = await authService.hashPassword("Password123!");

  pool.query = async (text, params = []) => {
    if (text.includes("FROM users")) {
      return {
        rows: [{
          user_id: 1, full_name: "Dylan Maurer", username: "dylan",
          password_hash: passwordHash, role: "manager",
          is_active: true, must_change_password: false,
          created_at: new Date("2026-08-01T09:00:00Z"),
        }],
      };
    }
    if (text.includes("FROM cardholders")) return { rows: [] };
    // Deliberately snake_case, exactly as Postgres hands it back.
    if (text.includes("FROM reconciliation_periods")) {
      return {
        rows: [
          { reconciliation_period_id: 1, start_date: "2026-07-24", end_date: "2026-08-06" },
          { reconciliation_period_id: 2, start_date: "2026-08-07", end_date: "2026-08-20" },
        ],
      };
    }
    throw new Error(`unstubbed query in test: ${text}`);
  };

  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const signIn = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "dylan", password: "Password123!" }),
  });
  token = (await signIn.json()).token;
});

test.after(() => server?.close());

test("an endpoint that returns raw rows still answers in camelCase", async () => {
  // reconciliationPeriodController does `json({ periods: result.rows })` with no
  // mapping of its own. Before the middleware this replied with
  // reconciliation_period_id / start_date / end_date.
  const response = await fetch(`${baseUrl}/api/reconciliation-periods`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body.periods[0]).sort(), [
    "endDate", "reconciliationPeriodId", "startDate",
  ]);
});

test("no response anywhere contains a snake_case key", async () => {
  // The rule the codebase kept only half the time, now enforced. Add an endpoint
  // to this list when you add one.
  const paths = ["/api/health", "/api/auth/me", "/api/reconciliation-periods"];

  for (const path of paths) {
    const raw = await (
      await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } })
    ).text();

    const snakeKeys = [...raw.matchAll(/"([a-z0-9]+_[a-z0-9_]+)"\s*:/g)].map((m) => m[1]);
    assert.deepEqual(snakeKeys, [], `${path} returned database column names: ${snakeKeys}`);
  }
});
