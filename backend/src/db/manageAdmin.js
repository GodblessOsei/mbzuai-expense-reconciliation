// The two doors that cannot go through the app itself.
//
// 1. THE FIRST ACCOUNT. Nobody can sign in to create anyone until one manager
//    exists, so the first one has to be made from outside the app. Once.
//
// 2. THE LAST MANAGER LOCKED OUT. Managers normally reset each other, but that
//    has nobody to call if only one manager exists and they are locked out.
//
// Every system has this door. The failure mode is pretending it does not and
// then improvising during an outage, so it is a committed, documented script.
// It requires shell access to the server, which is the access control.
//
// Usage:
//   node src/db/manageAdmin.js create --username=dylan --name="Dylan Maurer"
//   node src/db/manageAdmin.js reset  --username=dylan
//   node src/db/manageAdmin.js list
require("dotenv").config();

const pool = require("../db/pool");
const authService = require("../services/authService");

// --key=value -> { key: value }
const parseArgs = () =>
  process.argv.slice(3).reduce((args, arg) => {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) args[match[1]] = match[2];
    return args;
  }, {});

const printCredentials = (label, username, password) => {
  console.log(`\n${label}\n`);
  console.log(`  Username: ${username}`);
  console.log(`  Password: ${password}`);
  console.log(
    "\nThis password is shown ONCE — only its hash is stored. Hand it over"
  );
  console.log("directly; they will be asked to change it at first sign-in.\n");
};

const create = async (args) => {
  const { username, name, role = "manager" } = args;

  if (!username || !name) {
    console.error(
      'Usage: node src/db/manageAdmin.js create --username=... --name="Full Name" [--role=manager|rla]'
    );
    process.exitCode = 1;
    return;
  }

  if (!["manager", "rla"].includes(role)) {
    console.error("--role must be 'manager' or 'rla'");
    process.exitCode = 1;
    return;
  }

  const normalizedUsername = authService.normalizeUsername(username);

  if (await authService.findUserByUsername(normalizedUsername)) {
    console.error(
      `A user with ${normalizedUsername} already exists. Use 'reset' to issue a new password.`
    );
    process.exitCode = 1;
    return;
  }

  const password = authService.generateTemporaryPassword();

  await pool.query(
    `INSERT INTO users (full_name, username, password_hash, role, must_change_password)
     VALUES ($1, $2, $3, $4, TRUE)`,
    [name.trim(), normalizedUsername, await authService.hashPassword(password), role]
  );

  printCredentials(`Created ${role}: ${name}`, normalizedUsername, password);
};

const reset = async (args) => {
  const { username } = args;

  if (!username) {
    console.error("Usage: node src/db/manageAdmin.js reset --username=...");
    process.exitCode = 1;
    return;
  }

  const normalizedUsername = authService.normalizeUsername(username);
  const user = await authService.findUserByUsername(normalizedUsername);

  if (!user) {
    console.error(`No user with username ${normalizedUsername}`);
    process.exitCode = 1;
    return;
  }

  const password = authService.generateTemporaryPassword();

  // Reactivate as well as reset: if someone deactivated the last manager by
  // mistake, a password alone would not get them back in.
  await pool.query(
    `UPDATE users
        SET password_hash = $1, must_change_password = TRUE,
            is_active = TRUE, deactivated_at = NULL
      WHERE user_id = $2`,
    [await authService.hashPassword(password), user.user_id]
  );

  printCredentials(`Reset password for ${user.full_name}`, normalizedUsername, password);
};

const list = async () => {
  const { rows } = await pool.query(
    `SELECT full_name, username, role, is_active FROM users
      ORDER BY is_active DESC, role, full_name`
  );

  if (rows.length === 0) {
    console.log("\nNo users yet. Create the first manager with:\n");
    console.log(
      '  node src/db/manageAdmin.js create --username=... --name="Full Name"\n'
    );
    return;
  }

  console.log("");
  rows.forEach((row) => {
    const status = row.is_active ? "active  " : "disabled";
    console.log(
      `  ${status}  ${row.role.padEnd(7)}  ${row.full_name.padEnd(24)}  ${row.username}`
    );
  });
  console.log("");
};

const run = async () => {
  const command = process.argv[2];
  const args = parseArgs();

  try {
    if (command === "create") await create(args);
    else if (command === "reset") await reset(args);
    else if (command === "list") await list();
    else {
      console.log("\nCommands:\n");
      console.log(
        '  create --username=... --name="Full Name" [--role=manager|rla]'
      );
      console.log("  reset  --username=...");
      console.log("  list\n");
    }
  } catch (error) {
    console.error("manageAdmin failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
