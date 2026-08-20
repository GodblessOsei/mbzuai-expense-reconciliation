// S3-compatible object storage driver — the production counterpart to
// localDriver. Talks the S3 API, so the same code runs against Supabase
// Storage, Cloudflare R2, MinIO or AWS S3 itself; only the env vars change.
//
// Same five functions, same keys. "receipts/1738-4471.png" is a folder path on
// a local disk and a flat object key here — object stores have no real
// directories, the slashes are just part of the name.
//
// Requires S3_BUCKET, S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID,
// S3_SECRET_ACCESS_KEY. The bucket is expected to already exist; creating it
// is an infrastructure step, not something the app should do at boot.
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

const BUCKET = process.env.S3_BUCKET;
const ENDPOINT = process.env.S3_ENDPOINT;

const missing = [
  ["S3_BUCKET", BUCKET],
  ["S3_ENDPOINT", ENDPOINT],
  ["S3_ACCESS_KEY_ID", process.env.S3_ACCESS_KEY_ID],
  ["S3_SECRET_ACCESS_KEY", process.env.S3_SECRET_ACCESS_KEY],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

// Fail at boot, not on the first upload. A misconfigured deploy should refuse
// to start rather than accept receipts it cannot store.
if (missing.length > 0) {
  throw new Error(
    `Missing ${missing.join(", ")} — required when STORAGE_DRIVER=s3`
  );
}

const client = new S3Client({
  endpoint: ENDPOINT,
  // Supabase ignores the region but the SDK refuses to sign without one.
  region: process.env.S3_REGION || "us-east-1",
  // Supabase serves buckets as <endpoint>/<bucket>/<key>. The SDK's default is
  // virtual-host style (<bucket>.<endpoint>/<key>), which resolves to nothing.
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

const assertKey = (key) => {
  if (!key || typeof key !== "string") {
    throw new Error(`Invalid storage key: ${key}`);
  }
  return key;
};

// The bytes are the authority on type everywhere else in this app, but S3 will
// not sniff — it stores whatever Content-Type we declare and serves it back.
// Guessing from our own generated extension is safe: these keys are built by
// buildStoredFilename from a detected type, never from the upload's claim.
const CONTENT_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip",
};

const contentTypeFor = (key) => {
  const dot = key.lastIndexOf(".");
  if (dot === -1) return "application/octet-stream";
  return CONTENT_TYPES[key.slice(dot).toLowerCase()] || "application/octet-stream";
};

const saveFile = async (key, buffer) => {
  assertKey(key);
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentTypeFor(key),
    })
  );
  return key;
};

const getFile = async (key) => {
  assertKey(key);
  const response = await client.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key })
  );
  // Body is a Node Readable here; this helper drains it into one Buffer.
  return Buffer.from(await response.Body.transformToByteArray());
};

// HEAD fetches metadata without the body, so this costs nothing for a 40MB ZIP.
const fileExists = async (key) => {
  assertKey(key);
  try {
    await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (error) {
    // A missing object is an expected answer, not a failure. Anything else --
    // bad credentials, wrong bucket, network down -- must propagate, or a
    // broken deploy would look exactly like an empty bucket.
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
};

const deleteFile = async (key) => {
  assertKey(key);
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
};

// Streams straight through to the HTTP response, so a large ZIP is never held
// in the server's memory in full.
const createReadStream = async (key) => {
  assertKey(key);
  const response = await client.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key })
  );
  return response.Body;
};

module.exports = {
  saveFile,
  getFile,
  fileExists,
  deleteFile,
  createReadStream,
};
