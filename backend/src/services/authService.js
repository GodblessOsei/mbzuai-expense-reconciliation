// Password hashing and session tokens.
//
// Deliberately the ONLY place in the codebase that knows about bcrypt or JWT,
// so swapping either later (university SSO, for instance) touches one file.

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db/pool");

const SALT_ROUNDS = 10;
const TOKEN_TTL = process.env.JWT_EXPIRES_IN || "12h"; // one working day

// Fail loudly at startup rather than silently signing tokens with a default
// secret that anyone reading this repository could forge.
const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET is not set. Copy .env.example to .env and set it before starting the server."
    );
  }
  return secret;
};

const hashPassword = (plainText) => bcrypt.hash(plainText, SALT_ROUNDS);

const verifyPassword = (plainText, hash) => bcrypt.compare(plainText, hash);

// Emails are stored lowercase so "Jose@x.dev" and "jose@x.dev" cannot become
// two accounts for the same person.
const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

// The token carries identity only. Anything that decides access (role,
// is_active) is re-read from the database on every request by requireAuth --
// a token minted before someone was deactivated must not keep working.
const signToken = (user) =>
  jwt.sign({ userId: user.user_id }, getSecret(), { expiresIn: TOKEN_TTL });

const verifyToken = (token) => jwt.verify(token, getSecret());

// Shape a user row for the API boundary: camelCase, and never the hash.
const toPublicUser = (row) => ({
  userId: row.user_id,
  fullName: row.full_name,
  email: row.email,
  role: row.role,
  isActive: row.is_active,
  mustChangePassword: row.must_change_password,
  createdAt: row.created_at,
});

const findUserByEmail = async (email) => {
  const result = await pool.query(
    `SELECT * FROM users WHERE email = $1`,
    [normalizeEmail(email)]
  );
  return result.rows[0] || null;
};

const findUserById = async (userId) => {
  const result = await pool.query(
    `SELECT * FROM users WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0] || null;
};

// The card this person currently holds, if any. Used to pre-select their own
// card on the submission form and to scope what they can see. Never used to
// decide whether they may submit -- any RLA may spend on any card.
const findAssignedCard = async (userId) => {
  const result = await pool.query(
    `SELECT cardholder_id, cardholder_name, last_four_digits, assigned_at
       FROM cardholders
      WHERE assigned_user_id = $1 AND is_active = TRUE
      ORDER BY cardholder_id
      LIMIT 1`,
    [userId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    cardholderId: row.cardholder_id,
    cardholderName: row.cardholder_name,
    lastFourDigits: row.last_four_digits,
    assignedAt: row.assigned_at,
  };
};

// A temporary password for a new account or a reset, shown to the manager once
// and read out to the person. crypto.randomBytes rather than Math.random --
// this briefly IS the credential.
//
// Ambiguous characters (0/O, 1/l/I) are excluded because these get spoken
// aloud or written on paper.
const generateTemporaryPassword = () => {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(12);
  return Array.from(bytes)
    .map((byte) => alphabet[byte % alphabet.length])
    .join("");
};

module.exports = {
  hashPassword,
  verifyPassword,
  generateTemporaryPassword,
  normalizeEmail,
  signToken,
  verifyToken,
  toPublicUser,
  findUserByEmail,
  findUserById,
  findAssignedCard,
};
