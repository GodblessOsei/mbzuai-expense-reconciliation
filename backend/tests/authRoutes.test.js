// These tests start the real Express app and make real HTTP requests to it.
//
// The unit tests in authService.test.js prove the individual functions behave.
// They cannot prove the app is WIRED correctly -- that login actually calls
// toPublicUser, that the guard in app.js really covers every route, that a
// manager-only route really refuses an RLA. Those are properties of the
// assembly, not of any one function, so they need the assembled thing.
//
// The database is replaced with a small stand-in below, so this suite needs no
// Postgres and still exercises every layer above it: routing, CORS, the auth
// middleware, the controllers and the JSON that finally goes over the wire.
process.env.JWT_SECRET = "test-only-secret-not-used-anywhere-real";

const test = require("node:test");
const assert = require("node:assert/strict");

const app = require("../src/app");
const pool = require("../src/db/pool");
const authService = require("../src/services/authService");

const PASSWORD = "Password123!";

let server;
let baseUrl;
let users;
let cards;

// Answer the three queries the auth path makes, from plain arrays. Matching on
// the SQL text keeps the stand-in honest: if someone changes a query, this
// stops answering it and the tests fail rather than silently passing.
const fakeQuery = async (text, params = []) => {
  if (text.includes("FROM users") && text.includes("username")) {
    const username = params[0];
    return { rows: users.filter((u) => u.username === username) };
  }
  if (text.includes("FROM users") && text.includes("user_id")) {
    const userId = params[0];
    return { rows: users.filter((u) => u.user_id === userId) };
  }
  if (text.includes("FROM cardholders")) {
    const userId = params[0];
    return { rows: cards.filter((c) => c.assigned_user_id === userId) };
  }
  throw new Error(`unstubbed query in test: ${text}`);
};

const post = (path, body, token) =>
  fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

const get = (path, token) =>
  fetch(`${baseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

const signIn = async (username) => {
  const response = await post("/api/auth/login", { username, password: PASSWORD });
  return (await response.json()).token;
};

test.before(async () => {
  const passwordHash = await authService.hashPassword(PASSWORD);

  users = [
    {
      user_id: 1, full_name: "Dylan Maurer", username: "dylan@mbzuai.ac.ae",
      password_hash: passwordHash, role: "manager",
      is_active: true, must_change_password: false,
      created_at: new Date("2026-08-01T09:00:00Z"),
    },
    {
      user_id: 2, full_name: "Hawau", username: "hawau@mbzuai.ac.ae",
      password_hash: passwordHash, role: "rla",
      is_active: true, must_change_password: false,
      created_at: new Date("2026-08-01T09:00:00Z"),
    },
    {
      user_id: 3, full_name: "Former RLA", username: "gone@mbzuai.ac.ae",
      password_hash: passwordHash, role: "rla",
      is_active: false, must_change_password: false,
      created_at: new Date("2026-08-01T09:00:00Z"),
    },
  ];

  cards = [
    { cardholder_id: 4, assigned_user_id: 2, cardholder_name: "Hawau",
      last_four_digits: "4924", is_active: true, assigned_at: "2026-08-01" },
  ];

  pool.query = fakeQuery;

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server?.close());

// ---------------------------------------------------------------------------
// Signing in
// ---------------------------------------------------------------------------

test("a correct username and password returns a token and the user", async () => {
  const response = await post("/api/auth/login", {
    username: "dylan@mbzuai.ac.ae",
    password: PASSWORD,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.ok(body.token, "a token should be issued");
  assert.equal(body.user.fullName, "Dylan Maurer");
  assert.equal(body.user.role, "manager");
});

test("the login response never contains a password hash", async () => {
  // This is the test that closes the real gap: authService.toPublicUser being
  // correct means nothing if a controller returns the raw row instead. Here we
  // read the actual bytes sent to the browser.
  const response = await post("/api/auth/login", {
    username: "dylan@mbzuai.ac.ae",
    password: PASSWORD,
  });
  const raw = await response.text();

  assert.ok(!raw.includes("$2b$"), "a bcrypt hash was sent to the browser");
  assert.ok(!raw.includes("password_hash"));
  assert.ok(!raw.includes("passwordHash"), "the hash leaked under its camelCase name");
});

test("the login response speaks camelCase, not database column names", async () => {
  const response = await post("/api/auth/login", {
    username: "hawau@mbzuai.ac.ae",
    password: PASSWORD,
  });
  const body = await response.json();

  assert.deepEqual(Object.keys(body.user).sort(), [
    "createdAt", "fullName", "isActive", "mustChangePassword", "role", "userId", "username",
  ]);
  assert.equal(body.assignedCard.lastFourDigits, "4924");
  assert.equal(body.assignedCard.last_four_digits, undefined);
});

test("a wrong password, an unknown username and a disabled account look identical", async () => {
  // Different messages would let an outsider discover which username addresses are
  // real accounts by reading the replies.
  const wrongPassword = await post("/api/auth/login", {
    username: "dylan@mbzuai.ac.ae", password: "not-the-password",
  });
  const unknownUsername = await post("/api/auth/login", {
    username: "nobody@mbzuai.ac.ae", password: PASSWORD,
  });
  const disabledAccount = await post("/api/auth/login", {
    username: "gone@mbzuai.ac.ae", password: PASSWORD,
  });

  for (const response of [wrongPassword, unknownUsername, disabledAccount]) {
    assert.equal(response.status, 401);
    assert.equal((await response.json()).message, "Incorrect username or password");
  }
});

test("signing in without an username or password is a 400, not a crash", async () => {
  const noPassword = await post("/api/auth/login", { username: "dylan@mbzuai.ac.ae" });
  const nothing = await post("/api/auth/login", {});

  assert.equal(noPassword.status, 400);
  assert.equal(nothing.status, 400);
});

// ---------------------------------------------------------------------------
// The guard in app.js
// ---------------------------------------------------------------------------

test("a protected route refuses a request with no token", async () => {
  const response = await get("/api/transactions");

  assert.equal(response.status, 401);
});

test("a protected route refuses a made-up token", async () => {
  const response = await get("/api/transactions", "not.a.real.token");

  assert.equal(response.status, 401);
});

test("the health check stays public", async () => {
  // It is the platform's liveness probe. If the guard ever swallowed it, the
  // host would decide the server is dead and restart it in a loop.
  const response = await get("/api/health");

  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "ok");
});

test("someone deactivated after signing in is refused immediately", async () => {
  // Their token is still valid and unexpired. Access must stop anyway, because
  // requireAuth re-reads the account rather than trusting the token.
  const token = await signIn("hawau@mbzuai.ac.ae");
  assert.equal((await get("/api/auth/me", token)).status, 200);

  users.find((u) => u.user_id === 2).is_active = false;
  try {
    assert.equal((await get("/api/auth/me", token)).status, 401);
  } finally {
    users.find((u) => u.user_id === 2).is_active = true;
  }
});

// ---------------------------------------------------------------------------
// Manager-only routes
// ---------------------------------------------------------------------------

test("an RLA is refused from every manager-only route", async () => {
  // Hiding a button is not access control. Each of these is gated in app.js and
  // this is what proves the gate is actually attached.
  const token = await signIn("hawau@mbzuai.ac.ae");

  for (const path of [
    "/api/spreadsheets", "/api/packages", "/api/additional-spending",
    "/api/budgets", "/api/dashboard",
  ]) {
    const response = await get(path, token);
    assert.equal(response.status, 403, `${path} should be manager-only`);
  }
});

test("a manager is not blocked by the role gate", async () => {
  const token = await signIn("dylan@mbzuai.ac.ae");

  for (const path of ["/api/dashboard", "/api/budgets"]) {
    const response = await get(path, token);
    assert.notEqual(response.status, 403, `${path} should allow a manager`);
    assert.notEqual(response.status, 401);
  }
});

// ---------------------------------------------------------------------------
// Rehydrating a session on page refresh
// ---------------------------------------------------------------------------

test("GET /api/auth/me returns the signed-in user and their card", async () => {
  const token = await signIn("hawau@mbzuai.ac.ae");

  const response = await get("/api/auth/me", token);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.user.userId, 2);
  assert.equal(body.assignedCard.lastFourDigits, "4924");
});

test("GET /api/auth/me leaks no hash either", async () => {
  const token = await signIn("dylan@mbzuai.ac.ae");

  const raw = await (await get("/api/auth/me", token)).text();

  assert.ok(!raw.includes("$2b$"));
  assert.ok(!raw.includes("password_hash"));
  assert.ok(!raw.includes("passwordHash"), "the hash leaked under its camelCase name");
});

test("a manager with no card gets null rather than an error", async () => {
  const token = await signIn("dylan@mbzuai.ac.ae");

  const body = await (await get("/api/auth/me", token)).json();

  assert.equal(body.assignedCard, null);
});
