// Migration 001 — absolute filesystem paths -> storage keys
//
// Legacy rows stored the full path of a file on the developer's machine:
//   /Users/godbless/.../backend/uploads/1783760767200-175243539.png
// which is meaningless anywhere else. This rewrites them as storage keys:
//   receipts/1783760767200-175243539.png
// and copies the bytes into the matching location via the storage service.
//
// Because it writes through storageService, the SAME script does two jobs:
//   STORAGE_DRIVER=local  -> reorganises backend/uploads into subfolders
//   STORAGE_DRIVER=azure  -> uploads the existing local files to Blob Storage
//
// Safety properties:
//   - dry run by default; pass --apply to make changes
//   - originals are COPIED, never deleted, so the migration is reversible
//   - idempotent; rows already holding keys are skipped
//   - DB updates run in a single transaction
//
// Usage:
//   node src/db/migrations/001-paths-to-keys.js            (dry run)
//   node src/db/migrations/001-paths-to-keys.js --apply
require("dotenv").config();

const fs = require("fs/promises");
const path = require("path");
const pool = require("../pool");
const storage = require("../../services/storageService");

const uploadDir = path.join(__dirname, "..", "..", "..", "uploads");
const APPLY = process.argv.includes("--apply");

// Each table that holds a file reference, and which prefix its files belong to.
const TARGETS = [
  {
    label: "receipt_files.file_path",
    table: "receipt_files",
    idColumn: "receipt_file_id",
    pathColumn: "file_path",
    prefix: storage.KEY_PREFIX.RECEIPTS,
  },
  {
    label: "transactions.pdf_path",
    table: "transactions",
    idColumn: "transaction_id",
    pathColumn: "pdf_path",
    prefix: storage.KEY_PREFIX.GENERATED,
  },
];

// Legacy values are absolute paths; already-migrated values are keys.
const isLegacyPath = (value) => path.isAbsolute(value);

// Where the bytes currently live on this machine.
const legacySourcePath = (value) =>
  path.isAbsolute(value) ? value : path.join(uploadDir, value);

const migrateTarget = async (client, target) => {
  const { label, table, idColumn, pathColumn, prefix } = target;

  const { rows } = await client.query(
    `SELECT ${idColumn} AS id, ${pathColumn} AS value
       FROM ${table}
      WHERE ${pathColumn} IS NOT NULL`
  );

  const stats = { total: rows.length, migrated: 0, skipped: 0, missingFiles: [] };

  for (const row of rows) {
    if (!isLegacyPath(row.value)) {
      stats.skipped++;
      continue;
    }

    const key = storage.normalizeKey(row.value, prefix);
    const source = legacySourcePath(row.value);

    // Copy the bytes to their new home. A row whose file has already vanished
    // is still worth rewriting — the key is correct either way, and the row was
    // already broken before this migration touched it.
    let buffer = null;
    try {
      buffer = await fs.readFile(source);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      stats.missingFiles.push({ id: row.id, source });
    }

    if (APPLY) {
      if (buffer && !(await storage.fileExists(key))) {
        await storage.saveFile(key, buffer);
      }
      await client.query(
        `UPDATE ${table} SET ${pathColumn} = $1 WHERE ${idColumn} = $2`,
        [key, row.id]
      );
    }

    stats.migrated++;
    if (!APPLY && stats.migrated <= 3) {
      console.log(`   e.g. #${row.id}: ${row.value}\n        -> ${key}`);
    }
  }

  console.log(
    `\n${label}: ${stats.total} rows | ${stats.migrated} to migrate | ${stats.skipped} already keys`
  );
  if (stats.missingFiles.length) {
    console.log(
      `   warning: ${stats.missingFiles.length} row(s) reference a file that no longer exists on disk:`
    );
    stats.missingFiles.forEach((m) => console.log(`     #${m.id} -> ${m.source}`));
  }

  return stats;
};

const run = async () => {
  console.log(
    `Migration 001 — paths to keys  [${APPLY ? "APPLY" : "DRY RUN"}]  driver=${storage.driverName}\n`
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const target of TARGETS) {
      await migrateTarget(client, target);
    }

    if (APPLY) {
      await client.query("COMMIT");
      console.log("\nCommitted. Original files were left in place (copies, not moves).");
    } else {
      await client.query("ROLLBACK");
      console.log("\nDry run — nothing was written. Re-run with --apply to commit.");
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed, rolled back:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

run();
