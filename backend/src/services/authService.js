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

// Usernames are stored lowercase so "Jose" and "jose" cannot become two
// accounts for the same person.
const normalizeUsername = (username) =>
  String(username || "").trim().toLowerCase();

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
  username: row.username,
  role: row.role,
  isActive: row.is_active,
  mustChangePassword: row.must_change_password,
  createdAt: row.created_at,
});

const findUserByUsername = async (username) => {
  const result = await pool.query(
    `SELECT * FROM users WHERE username = $1`,
    [normalizeUsername(username)]
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
const PASSWORD_ALPHABET =
  "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const PASSWORD_LENGTH = 12;

// A byte is 0-255, which is not a whole number of alphabets (256 = 4 x 55 + 36).
// Taking `byte % 55` would therefore hand out the first 36 characters 25% more
// often than the rest, quietly shrinking the space an attacker has to search.
// Bytes in that leftover tail are discarded and redrawn instead.
const LARGEST_UNBIASED_BYTE =
  Math.floor(256 / PASSWORD_ALPHABET.length) * PASSWORD_ALPHABET.length;

const generateTemporaryPassword = () => {
  let password = "";

  while (password.length < PASSWORD_LENGTH) {
    for (const byte of crypto.randomBytes(PASSWORD_LENGTH)) {
      if (byte >= LARGEST_UNBIASED_BYTE) continue; // would skew the result
      password += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
      if (password.length === PASSWORD_LENGTH) break;
    }
  }

  return password;
};

module.exports = {
  hashPassword,
  verifyPassword,
  generateTemporaryPassword,
  normalizeUsername,
  signToken,
  verifyToken,
  toPublicUser,
  findUserByUsername,
  findUserById,
  findAssignedCard,
};
