// Migration 002 — real identity: logins, card assignment, authorship
//
// Before this migration the system had no idea who anyone was. `users` held
// only an id and a role string, the frontend picked a "cardholder" as a
// stand-in for logging in, and every transaction was submitted as user_id 1.
//
// This migration separates three ideas that were tangled together:
//
//   PEOPLE  (users)       -- who signs in. Now has a name, email, password.
//   CARDS   (cardholders) -- the physical prepaid cards. A card is its own
//                            thing; it outlives whoever currently holds it.
//   ASSIGNMENT            -- "this card is currently Hawau's". Drives defaults
//                            and visibility, NEVER permission. Any RLA may
//                            spend on any card.
//
// The rename cardholders.user_id -> assigned_user_id is the point of the whole
// design made visible: `user_id` on a card reads like ownership, and ownership
// invites someone to write `WHERE user_id = $me` and silently reimpose the
// restriction the client explicitly does not want.
//
// Columns are added NULLABLE, backfilled, then tightened. Adding NOT NULL in
// one shot fails on any database that already has rows.
//
// Safety properties:
//   - dry run by default; pass --apply to make changes
//   - everything runs in a single transaction; a failure rolls back cleanly
//   - idempotent; re-running on a migrated database is a no-op
//   - additive only -- no column or row is ever dropped
//
// Usage:
//   node src/db/migrations/002-auth-identity.js            (dry run)
//   node src/db/migrations/002-auth-identity.js --apply
require("dotenv").config();

const pool = require("../pool");

const APPLY = process.argv.includes("--apply");

// Development-only password for rows this migration has to invent a login for.
// Any user backfilled here is forced to change it at next sign-in.
const PLACEHOLDER_HASH =
  "$2b$10$kzqB/ZWhhj/Xirt9gjJA9OgHuC3FgjKow6wQrPTR6xapgNkXkoZ2i"; // "Password123!"

// Does this column exist yet? Every step checks first so the script can be
// re-run safely.
const hasColumn = async (client, table, column) => {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return rows.length > 0;
};

const run = async () => {
  const client = await pool.connect();
  const log = [];

  try {
    await client.query("BEGIN");

    // ---- resync the id sequences ---------------------------------------
    // Rows inserted with an explicit user_id (by hand, or restored from a
    // dump) leave the SERIAL sequence behind the real maximum, so the next
    // INSERT collides with an id that already exists. Harmless to run when
    // the sequence is already correct.
    for (const [table, column] of [
      ["users", "user_id"],
      ["cardholders", "cardholder_id"],
    ]) {
      await client.query(
        `SELECT setval(
                  pg_get_serial_sequence($1, $2),
                  COALESCE((SELECT MAX(${column}) FROM ${table}), 0) + 1,
                  false
                )`,
        [table, column]
      );
    }
    log.push("sequences: resynced users and cardholders id counters");

    // ---- users: give people an actual identity -------------------------
    const userCols = [
      ["full_name", "TEXT"],
      ["email", "TEXT"],
      ["password_hash", "TEXT"],
      ["must_change_password", "BOOLEAN NOT NULL DEFAULT TRUE"],
      ["is_active", "BOOLEAN NOT NULL DEFAULT TRUE"],
      ["created_at", "TIMESTAMP NOT NULL DEFAULT NOW()"],
      ["deactivated_at", "TIMESTAMP"],
    ];

    for (const [column, type] of userCols) {
      if (await hasColumn(client, "users", column)) continue;
      await client.query(`ALTER TABLE users ADD COLUMN ${column} ${type}`);
      log.push(`users: added ${column}`);
    }

    // Backfill any pre-existing user rows. They have no name or email, so we
    // synthesise both from the id -- enough to satisfy NOT NULL and UNIQUE
    // without inventing a plausible-looking real person.
    const orphanUsers = await client.query(
      `UPDATE users
          SET full_name     = COALESCE(full_name, 'Legacy User ' || user_id),
              email         = COALESCE(email, 'legacy-user-' || user_id || '@example.invalid'),
              password_hash = COALESCE(password_hash, $1),
              role          = COALESCE(role, 'rla'),
              must_change_password = TRUE
        WHERE full_name IS NULL
           OR email IS NULL
           OR password_hash IS NULL
           OR role IS NULL
        RETURNING user_id`,
      [PLACEHOLDER_HASH]
    );
    if (orphanUsers.rowCount > 0) {
      log.push(
        `users: backfilled ${orphanUsers.rowCount} legacy row(s) (forced password change)`
      );
    }

    // Tighten only once the data can satisfy the constraints.
    await client.query(`ALTER TABLE users ALTER COLUMN full_name SET NOT NULL`);
    await client.query(`ALTER TABLE users ALTER COLUMN email SET NOT NULL`);
    await client.query(
      `ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL`
    );
    await client.query(`ALTER TABLE users ALTER COLUMN role SET NOT NULL`);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
      EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD CONSTRAINT users_role_check
          CHECK (role IN ('rla', 'manager'));
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    log.push("users: constraints tightened (NOT NULL, unique email, role check)");

    // ---- cardholders: a card is not a person ---------------------------
    if (await hasColumn(client, "cardholders", "user_id")) {
      await client.query(
        `ALTER TABLE cardholders RENAME COLUMN user_id TO assigned_user_id`
      );
      log.push("cardholders: user_id -> assigned_user_id");
    }

    if (!(await hasColumn(client, "cardholders", "is_active"))) {
      await client.query(
        `ALTER TABLE cardholders ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE`
      );
      log.push("cardholders: added is_active");
    }

    if (!(await hasColumn(client, "cardholders", "assigned_at"))) {
      await client.query(
        `ALTER TABLE cardholders ADD COLUMN assigned_at DATE`
      );
      log.push("cardholders: added assigned_at");
    }

    // ---- transactions: the submitter becomes mandatory ------------------
    // Legacy rows were all written as user_id 1 by the hardcoded frontend. If
    // any are NULL we cannot invent a submitter, so we park them on a clearly
    // marked system user rather than silently attributing them to a real person.
    const nullSubmitters = await client.query(
      `SELECT COUNT(*)::int AS count FROM transactions WHERE user_id IS NULL`
    );

    if (nullSubmitters.rows[0].count > 0) {
      const systemUser = await client.query(
        `INSERT INTO users (full_name, email, password_hash, role, is_active, must_change_password)
         VALUES ('Unknown (pre-login submissions)', 'unknown@example.invalid', $1, 'rla', FALSE, FALSE)
         ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
         RETURNING user_id`,
        [PLACEHOLDER_HASH]
      );
      await client.query(
        `UPDATE transactions SET user_id = $1 WHERE user_id IS NULL`,
        [systemUser.rows[0].user_id]
      );
      log.push(
        `transactions: ${nullSubmitters.rows[0].count} row(s) without a submitter attributed to a disabled placeholder user`
      );
    }

    await client.query(
      `ALTER TABLE transactions ALTER COLUMN user_id SET NOT NULL`
    );
    log.push("transactions: user_id is now NOT NULL");

    // ---- additional_spending: record who entered the figure -------------
    if (!(await hasColumn(client, "additional_spending", "created_by_user_id"))) {
      await client.query(
        `ALTER TABLE additional_spending
           ADD COLUMN created_by_user_id INTEGER REFERENCES users(user_id)`
      );
      log.push("additional_spending: added created_by_user_id");
    }

    if (!(await hasColumn(client, "additional_spending", "created_at"))) {
      await client.query(
        `ALTER TABLE additional_spending
           ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT NOW()`
      );
      log.push("additional_spending: added created_at");
    }

    if (APPLY) {
      await client.query("COMMIT");
      console.log("\nMigration 002 APPLIED:\n");
    } else {
      await client.query("ROLLBACK");
      console.log("\nDRY RUN — nothing was changed. Would apply:\n");
    }

    if (log.length === 0) {
      console.log("  (nothing to do — database already migrated)");
    } else {
      log.forEach((line) => console.log(`  - ${line}`));
    }

    if (!APPLY) {
      console.log("\nRe-run with --apply to commit these changes.");
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration 002 failed, rolled back:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

run();
