// Storage service — the single place the rest of the app talks to for files.
//
// Nothing outside this module should call `fs` for receipts, generated PDFs,
// spreadsheets or packages. Callers deal in KEYS ("receipts/1234-567.png"),
// never in absolute paths, so the same code works whether the bytes live on a
// local disk (dev/demo) or in Azure Blob Storage (production).
//
// Which driver runs is decided by STORAGE_DRIVER in the environment.
const DRIVER_NAME = process.env.STORAGE_DRIVER || "local";

const drivers = {
  local: () => require("./storage/localDriver"),
  // azure: () => require("./storage/azureDriver"),   // added in a later step
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

module.exports = {
  driverName: DRIVER_NAME,
  KEY_PREFIX,
  buildKey,

  saveFile: (key, buffer) => driver.saveFile(key, buffer),
  getFile: (key) => driver.getFile(key),
  fileExists: (key) => driver.fileExists(key),
  deleteFile: (key) => driver.deleteFile(key),
  createReadStream: (key) => driver.createReadStream(key),
  getAvailableKey: (key) => driver.getAvailableKey(key),
};
