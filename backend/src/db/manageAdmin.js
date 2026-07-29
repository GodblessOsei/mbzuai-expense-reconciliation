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
//   node src/db/manageAdmin.js create --email=neil@example.dev --name="Neil Hammond"
//   node src/db/manageAdmin.js reset  --email=neil@example.dev
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

const printCredentials = (label, email, password) => {
  console.log(`\n${label}\n`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log(
    "\nThis password is shown ONCE — only its hash is stored. Hand it over"
  );
  console.log("directly; they will be asked to change it at first sign-in.\n");
};

const create = async (args) => {
  const { email, name, role = "manager" } = args;

  if (!email || !name) {
    console.error(
      'Usage: node src/db/manageAdmin.js create --email=... --name="Full Name" [--role=manager|rla]'
    );
    process.exitCode = 1;
    return;
  }

  if (!["manager", "rla"].includes(role)) {
    console.error("--role must be 'manager' or 'rla'");
    process.exitCode = 1;
    return;
  }

  const normalizedEmail = authService.normalizeEmail(email);

  if (await authService.findUserByEmail(normalizedEmail)) {
    console.error(
      `A user with ${normalizedEmail} already exists. Use 'reset' to issue a new password.`
    );
    process.exitCode = 1;
    return;
  }

  const password = authService.generateTemporaryPassword();

  await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, must_change_password)
     VALUES ($1, $2, $3, $4, TRUE)`,
    [name.trim(), normalizedEmail, await authService.hashPassword(password), role]
  );

  printCredentials(`Created ${role}: ${name}`, normalizedEmail, password);
};

const reset = async (args) => {
  const { email } = args;

  if (!email) {
    console.error("Usage: node src/db/manageAdmin.js reset --email=...");
    process.exitCode = 1;
    return;
  }

  const normalizedEmail = authService.normalizeEmail(email);
  const user = await authService.findUserByEmail(normalizedEmail);

  if (!user) {
    console.error(`No user with email ${normalizedEmail}`);
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

  printCredentials(`Reset password for ${user.full_name}`, normalizedEmail, password);
};

const list = async () => {
  const { rows } = await pool.query(
    `SELECT full_name, email, role, is_active FROM users
      ORDER BY is_active DESC, role, full_name`
  );

  if (rows.length === 0) {
    console.log("\nNo users yet. Create the first manager with:\n");
    console.log(
      '  node src/db/manageAdmin.js create --email=... --name="Full Name"\n'
    );
    return;
  }

  console.log("");
  rows.forEach((row) => {
    const status = row.is_active ? "active  " : "disabled";
    console.log(
      `  ${status}  ${row.role.padEnd(7)}  ${row.full_name.padEnd(24)}  ${row.email}`
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
        '  create --email=... --name="Full Name" [--role=manager|rla]'
      );
      console.log("  reset  --email=...");
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
