// Translates every JSON response from database naming to API naming.
//
// The convention -- snake_case in Postgres, camelCase over the wire -- used to
// be applied by hand in each controller, which meant it was applied in about
// half of them. `flags`, `reconciliation_periods` and `budget_items` were going
// out with raw column names while `users` and `cardholders` were mapped, so the
// frontend had to know which endpoints spoke which language.
//
// Doing it here instead of in each controller makes the rule impossible to
// forget: a route added next year is converted because it went through res.json,
// not because someone remembered to map it.
//
// IMPORTANT: this renames keys, it does not choose them. Anything that must not
// reach the browser still has to be left out of the query or filtered by hand --
// `authService.toPublicUser` exists for exactly that reason, and a raw
// `SELECT * FROM users` would still send the password hash, just camelCased.

const toCamelKey = (key) =>
  key.replace(/_+([a-z0-9])/g, (_match, character) => character.toUpperCase());

const toApiShape = (value) => {
  if (Array.isArray(value)) return value.map(toApiShape);

  // Dates and Buffers are objects but must survive untouched: recursing into a
  // Date would turn it into {} and every timestamp in the API would vanish.
  if (
    value === null ||
    typeof value !== "object" ||
    value instanceof Date ||
    Buffer.isBuffer(value)
  ) {
    return value;
  }

  const converted = {};
  for (const [key, nested] of Object.entries(value)) {
    converted[toCamelKey(key)] = toApiShape(nested);
  }
  return converted;
};

const camelCaseResponse = (req, res, next) => {
  const sendJson = res.json.bind(res);
  res.json = (body) => sendJson(toApiShape(body));
  return next();
};

module.exports = camelCaseResponse;
module.exports.toApiShape = toApiShape;
module.exports.toCamelKey = toCamelKey;
