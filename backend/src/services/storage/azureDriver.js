// Azure Blob Storage driver — the production counterpart to localDriver.
//
// Same five functions, same keys. "receipts/1738-4471.png" is a folder path on
// a local disk and a blob name here; Blob Storage has no real directories, the
// slashes are just part of the name.
//
// Requires:  npm install @azure/storage-blob
// Requires:  AZURE_STORAGE_CONNECTION_STRING in the environment
//
// The container itself is expected to already exist — creating it is an
// infrastructure step for whoever owns the Azure subscription, not something
// the app should do at boot with whatever permissions it happens to have.
const { BlobServiceClient } = require("@azure/storage-blob");

const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER || "receipts";

if (!CONNECTION_STRING) {
  throw new Error(
    "AZURE_STORAGE_CONNECTION_STRING is required when STORAGE_DRIVER=azure"
  );
}

const service = BlobServiceClient.fromConnectionString(CONNECTION_STRING);
const container = service.getContainerClient(CONTAINER_NAME);

const blob = (key) => {
  if (!key || typeof key !== "string") {
    throw new Error(`Invalid storage key: ${key}`);
  }
  return container.getBlockBlobClient(key);
};

const saveFile = async (key, buffer) => {
  await blob(key).uploadData(buffer);
  return key;
};

const getFile = async (key) => {
  return blob(key).downloadToBuffer();
};

const fileExists = async (key) => {
  return blob(key).exists();
};

const deleteFile = async (key) => {
  await blob(key).deleteIfExists();
};

// Streams the blob straight through to the HTTP response, so a large ZIP is
// never held in the server's memory in full.
const createReadStream = async (key) => {
  const response = await blob(key).download();
  return response.readableStreamBody;
};

module.exports = {
  saveFile,
  getFile,
  fileExists,
  deleteFile,
  createReadStream,
};
