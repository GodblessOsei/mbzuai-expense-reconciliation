// Lets a request body arrive in camelCase even where a controller reads the
// snake_case column name.
//
// Incoming bodies were as inconsistent as outgoing ones: cardholderController
// reads `lastFourDigits` while transactionController reads `amount_aed`, so the
// frontend had to remember which spelling each endpoint wanted. Now the client
// sends camelCase everywhere and this fills in the other spelling.
//
// It ADDS aliases, it never replaces: a key the client actually sent always
// wins over a generated one. That is what makes it safe to apply to the receipt
// submission path, which reads seventeen snake_case fields and is the last place
// in this system anyone should be hand-editing to satisfy a naming convention.
//
// Only req.body is touched. Multer handles file uploads and runs per-route,
// after this, so uploads are unaffected.

const toCamelKey = (key) =>
  key.replace(/_+([a-z0-9])/g, (_match, character) => character.toUpperCase());

const toSnakeKey = (key) =>
  key.replace(/[A-Z]/g, (character) => `_${character.toLowerCase()}`);

const withBothSpellings = (value) => {
  if (Array.isArray(value)) return value.map(withBothSpellings);

  if (
    value === null ||
    typeof value !== "object" ||
    value instanceof Date ||
    Buffer.isBuffer(value)
  ) {
    return value;
  }

  const normalized = {};

  // Pass one: everything the client actually sent, so these can never be
  // clobbered by an alias generated in pass two.
  for (const [key, nested] of Object.entries(value)) {
    normalized[key] = withBothSpellings(nested);
  }

  // Pass two: fill in whichever spelling is missing.
  for (const [key, nested] of Object.entries(normalized)) {
    for (const alias of [toCamelKey(key), toSnakeKey(key)]) {
      if (!(alias in normalized)) normalized[alias] = nested;
    }
  }

  return normalized;
};

const normalizeRequestBody = (req, res, next) => {
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    req.body = withBothSpellings(req.body);
  }
  return next();
};

module.exports = normalizeRequestBody;
module.exports.withBothSpellings = withBothSpellings;
