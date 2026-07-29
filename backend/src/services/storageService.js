// Storage service — the single place the rest of the app talks to for files.
//
// Nothing outside this module should call `fs` for receipts, generated PDFs,
// spreadsheets or packages. Callers deal in KEYS ("receipts/1234-567.png"),
// never in absolute paths, so the same code works whether the bytes live on a
// local disk (dev/demo) or deployed environment.
//
// Which driver runs is decided by STORAGE_DRIVER in the environment.
const DRIVER_NAME = process.env.STORAGE_DRIVER || "local";

// Drivers are loaded lazily so that selecting "local" never requires the Azure
// SDK to be installed, and vice versa.
const drivers = {
  local: () => require("./storage/localDriver"),
  azure: () => require("./storage/azureDriver"),
};

const loadDriver = drivers[DRIVER_NAME];
if (!loadDriver) {
  throw new Error(
    `Unknown STORAGE_DRIVER "${DRIVER_NAME}". Expected one of: ${Object.keys(drivers).join(", ")}`
  );
}

const driver = loadDriver();

// Key prefixes — the "folders" files are organised under. Kept here so the
// naming stays consistent across services and is easy to audit.
const KEY_PREFIX = {
  RECEIPTS: "receipts",
  GENERATED: "generated",
  SPREADSHEETS: "spreadsheets",
  PACKAGES: "packages",
};

const buildKey = (prefix, filename) => `${prefix}/${filename}`;

// Accepts either a storage key ("receipts/1738-4471.png") or a legacy absolute
// filesystem path ("/Users/.../backend/uploads/1738-4471.png") and always
// returns a key. The caller passes the prefix because it knows which kind of
// file it is holding — receipt_files rows are receipts, transactions.pdf_path
// rows are generated PDFs — so no guessing from the filename is needed.
//
// This exists so the code tolerates un-migrated rows while the refactor is in
// progress. Once the data migration has run everywhere, it can be deleted.
const LOOKS_ABSOLUTE = /^(\/|[A-Za-z]:[\\/]|\\\\)/;

const normalizeKey = (value, prefix) => {
  if (!value || typeof value !== "string") return value;

  // Anything already prefixed is a key — pass it through untouched, whatever
  // its prefix. Forcing the caller's expected prefix here would silently
  // rewrite a valid "generated/x.pdf" into a non-existent "receipts/x.pdf".
  if (!LOOKS_ABSOLUTE.test(value) && value.includes("/")) return value;

  const filename = value.split(/[/\\]/).filter(Boolean).pop();
  return buildKey(prefix, filename);
};

// Returns a key that is not yet taken, appending _01, _02, ... on collision.
// Generated PDFs are named from date+vendor+amount+cardholder, so two different
// transactions can legitimately produce the same name. Built on fileExists so
// every driver gets it for free.
const getAvailableKey = async (key) => {
  if (!(await driver.fileExists(key))) return key;

  const lastSlash = key.lastIndexOf("/");
  const dir = lastSlash === -1 ? "" : key.slice(0, lastSlash + 1);
  const filename = key.slice(lastSlash + 1);
  const dot = filename.lastIndexOf(".");
  const base = dot === -1 ? filename : filename.slice(0, dot);
  const ext = dot === -1 ? "" : filename.slice(dot);

  let counter = 1;
  while (true) {
    const candidate = `${dir}${base}_${String(counter).padStart(2, "0")}${ext}`;
    if (!(await driver.fileExists(candidate))) return candidate;
    counter++;
  }
};

module.exports = {
  driverName: DRIVER_NAME,
  KEY_PREFIX,
  buildKey,
  normalizeKey,
  getAvailableKey,

  saveFile: (key, buffer) => driver.saveFile(key, buffer),
  getFile: (key) => driver.getFile(key),
  fileExists: (key) => driver.fileExists(key),
  deleteFile: (key) => driver.deleteFile(key),
  createReadStream: (key) => driver.createReadStream(key),
};
