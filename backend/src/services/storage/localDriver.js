// Local filesystem storage driver.
// Maps a storage KEY (e.g. "receipts/1234-567.png") onto a real path inside
// backend/uploads. This is the driver used in development and for demos.
const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");

const uploadDir = path.join(__dirname, "..", "..", "..", "uploads");

// Turn a key into an absolute path, refusing anything that escapes uploadDir.
// Keys come out of the DB and are derived from user-supplied filenames, so a
// key like "../../.env" must never resolve to a real file outside uploads/.
const resolveKey = (key) => {
  if (!key || typeof key !== "string") {
    throw new Error(`Invalid storage key: ${key}`);
  }
  const full = path.resolve(uploadDir, key);
  if (full !== uploadDir && !full.startsWith(uploadDir + path.sep)) {
    throw new Error(`Storage key escapes upload directory: ${key}`);
  }
  return full;
};

const saveFile = async (key, buffer) => {
  const full = resolveKey(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buffer);
  return key;
};

const getFile = async (key) => {
  return fs.readFile(resolveKey(key));
};

const fileExists = async (key) => {
  try {
    await fs.access(resolveKey(key));
    return true;
  } catch {
    return false;
  }
};

const deleteFile = async (key) => {
  try {
    await fs.unlink(resolveKey(key));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
};

// Streaming read, used by the download endpoints so a large ZIP never has to
// sit in memory in full. Async even though opening a local file is instant —
// remote drivers must await a network call before they have a stream, and the
// interface has to be honest about that.
const createReadStream = async (key) => {
  return fsSync.createReadStream(resolveKey(key));
};

module.exports = {
  saveFile,
  getFile,
  fileExists,
  deleteFile,
  createReadStream,
};
