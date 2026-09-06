// authService is the only file in this codebase that knows about password
// hashing and session tokens, which makes it the one place where a mistake
// becomes a security problem rather than a bug. These tests cover it.
//
// The secret is set here, before authService is loaded, so the suite does not
// depend on whatever happens to be in a developer's .env file.
process.env.JWT_SECRET = "test-only-secret-not-used-anywhere-real";

const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const authService = require("../src/services/authService");

// One row of `SELECT * FROM users`. The hash is a real bcrypt hash of
// "Password123!" -- using a realistic value matters, because a made-up string
// can accidentally satisfy an assertion that a real hash would not.
const PASSWORD_HASH =
  "$2b$10$kzqB/ZWhhj/Xirt9gjJA9OgHuC3FgjKow6wQrPTR6xapgNkXkoZ2i";

const dbRow = {
  user_id: 7,
  full_name: "Dylan Maurer",
  username: "dylan@mbzuai.ac.ae",
  password_hash: PASSWORD_HASH,
  role: "manager",
  is_active: true,
  must_change_password: false,
  created_at: new Date("2026-08-01T09:00:00Z"),
};

// ---------------------------------------------------------------------------
// toPublicUser -- shapes a database row into what the browser receives
// ---------------------------------------------------------------------------

test("toPublicUser returns exactly the seven public fields, and nothing else", () => {
  // Comparing the WHOLE object rather than field by field means this fails both
  // when something is dropped and when something new is exposed. A test that
  // checks a few fields individually would miss an added one.
  assert.deepEqual(authService.toPublicUser(dbRow), {
    userId: 7,
    fullName: "Dylan Maurer",
    username: "dylan@mbzuai.ac.ae",
    role: "manager",
    isActive: true,
    mustChangePassword: false,
    createdAt: new Date("2026-08-01T09:00:00Z"),
  });
});

test("toPublicUser never lets the password hash reach the browser", () => {
  const publicUser = authService.toPublicUser(dbRow);
  const serialised = JSON.stringify(publicUser);

  // Search for the actual hash value from the row above -- not for a word that
  // happens to be in it. This is what catches someone rewriting the function as
  // ({ ...row }), whatever they name the field.
  assert.ok(
    !serialised.includes(PASSWORD_HASH),
    "the password hash appeared in the API response"
  );
  assert.ok(
    !serialised.includes("$2b$"),
    "something bcrypt-shaped appeared in the API response"
  );
});

test("toPublicUser ignores extra columns added to the users table later", () => {
  // Someone adds a column for, say, a password reset token. It must not start
  // appearing in API responses just because it exists in the table.
  const rowWithNewColumn = { ...dbRow, reset_token: "secret-reset-token" };

  const serialised = JSON.stringify(authService.toPublicUser(rowWithNewColumn));

  assert.ok(!serialised.includes("secret-reset-token"));
  assert.ok(!serialised.includes("reset"));
});

test("toPublicUser exposes no snake_case keys", () => {
  // CLAUDE.md: the API speaks camelCase, the database speaks snake_case.
  const leaked = Object.keys(authService.toPublicUser(dbRow)).filter((key) =>
    key.includes("_")
  );

  assert.deepEqual(leaked, [], `these keys leaked database naming: ${leaked}`);
});

// ---------------------------------------------------------------------------
// Password hashing -- the thing that stands between a stolen database and
// everyone's password
// ---------------------------------------------------------------------------

test("a password can be checked against its own hash", async () => {
  const hash = await authService.hashPassword("Password123!");

  assert.equal(await authService.verifyPassword("Password123!", hash), true);
});

test("the wrong password is rejected", async () => {
  const hash = await authService.hashPassword("Password123!");

  assert.equal(await authService.verifyPassword("Password123", hash), false);
  assert.equal(await authService.verifyPassword("password123!", hash), false);
  assert.equal(await authService.verifyPassword("", hash), false);
});

test("the stored hash is not the password", async () => {
  const hash = await authService.hashPassword("Password123!");

  assert.ok(!hash.includes("Password123!"));
  assert.ok(hash.startsWith("$2"), "should be a bcrypt hash");
});

test("the same password produces a different hash each time", async () => {
  // bcrypt mixes in random salt. Without it, two people with the same password
  // would have identical hashes -- visible to anyone reading the table, and
  // crackable in bulk rather than one at a time.
  const first = await authService.hashPassword("Password123!");
  const second = await authService.hashPassword("Password123!");

  assert.notEqual(first, second);
  assert.equal(await authService.verifyPassword("Password123!", first), true);
  assert.equal(await authService.verifyPassword("Password123!", second), true);
});

// ---------------------------------------------------------------------------
// Session tokens
// ---------------------------------------------------------------------------

test("a token identifies the user who signed in", () => {
  const token = authService.signToken({ user_id: 7 });

  assert.equal(authService.verifyToken(token).userId, 7);
});

test("a token carries identity only -- never role or account status", () => {
  // This is a design rule from CLAUDE.md, and it is what makes deactivating
  // someone take effect immediately: requireAuth re-reads role and is_active
  // from the database on every request. If the role travelled inside the token,
  // a manager demoted this morning would keep manager access until it expired.
  const token = authService.signToken(dbRow);
  const payload = authService.verifyToken(token);

  assert.deepEqual(Object.keys(payload).sort(), ["exp", "iat", "userId"]);
  assert.equal(payload.role, undefined);
  assert.equal(payload.username, undefined);
  assert.equal(payload.isActive, undefined);
});

test("a token signed with a different secret is rejected", () => {
  // Someone who knows the token format but not the secret must not be able to
  // mint a session for user 1.
  const forged = jwt.sign({ userId: 1 }, "some-other-secret");

  assert.throws(() => authService.verifyToken(forged), /invalid signature/);
});

test("a tampered token is rejected", () => {
  const token = authService.signToken({ user_id: 7 });
  const tampered = `${token.slice(0, -4)}AAAA`;

  assert.throws(() => authService.verifyToken(tampered));
});

test("an expired token is rejected", () => {
  const expired = jwt.sign({ userId: 7 }, process.env.JWT_SECRET, {
    expiresIn: "-1s",
  });

  assert.throws(() => authService.verifyToken(expired), /jwt expired/);
});

test("signing refuses to run when JWT_SECRET is missing", () => {
  // The server must fail loudly rather than fall back to a default secret that
  // anyone reading this repository could use to forge a login.
  const saved = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;

  try {
    assert.throws(
      () => authService.signToken({ user_id: 7 }),
      /JWT_SECRET is not set/
    );
  } finally {
    process.env.JWT_SECRET = saved;
  }
});

// ---------------------------------------------------------------------------
// Temporary passwords -- printed once by manageAdmin.js, then read aloud or
// written down, which is why the alphabet drops confusable characters
// ---------------------------------------------------------------------------

test("a temporary password never contains characters people misread", () => {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const password = authService.generateTemporaryPassword();

    for (const confusable of ["0", "O", "1", "l", "I"]) {
      assert.ok(
        !password.includes(confusable),
        `"${confusable}" appeared in ${password} — someone will mistype this`
      );
    }
  }
});

test("a temporary password is 12 characters", () => {
  assert.equal(authService.generateTemporaryPassword().length, 12);
});

test("every character is equally likely, so the password space is not shrunk", () => {
  // A byte is 0-255 and the alphabet has 55 characters, which does not divide
  // evenly. The obvious `byte % 55` makes the first 36 characters appear 25%
  // more often, which quietly reduces how much an attacker has to guess.
  // This fails if anyone reverts to the simpler version.
  const counts = new Map();

  for (let attempt = 0; attempt < 20000; attempt += 1) {
    for (const character of authService.generateTemporaryPassword()) {
      counts.set(character, (counts.get(character) || 0) + 1);
    }
  }

  const frequencies = [...counts.values()];
  const average = frequencies.reduce((a, b) => a + b, 0) / frequencies.length;
  const worstGap = (Math.max(...frequencies) - Math.min(...frequencies)) / average;

  assert.equal(counts.size, 55, "every character should be reachable");
  assert.ok(
    worstGap < 0.1,
    `characters are unevenly distributed (${(worstGap * 100).toFixed(1)}% spread) — check for modulo bias`
  );
});

test("two temporary passwords are never the same", () => {
  const generated = new Set();
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    generated.add(authService.generateTemporaryPassword());
  }

  assert.equal(generated.size, 1000);
});

// ---------------------------------------------------------------------------
// Username normalisation -- users.username is UNIQUE, so two spellings of one address
// would become two accounts for one person
// ---------------------------------------------------------------------------

test("usernames that differ only by capitals or spaces are treated as one address", () => {
  const expected = "dylan@mbzuai.ac.ae";

  assert.equal(authService.normalizeUsername("dylan@mbzuai.ac.ae"), expected);
  assert.equal(authService.normalizeUsername("Dylan@MBZUAI.ac.ae"), expected);
  assert.equal(authService.normalizeUsername("  dylan@mbzuai.ac.ae  "), expected);
  assert.equal(authService.normalizeUsername("DYLAN@MBZUAI.AC.AE"), expected);
});

test("a missing username becomes an empty string rather than crashing", () => {
  assert.equal(authService.normalizeUsername(undefined), "");
  assert.equal(authService.normalizeUsername(null), "");
});
