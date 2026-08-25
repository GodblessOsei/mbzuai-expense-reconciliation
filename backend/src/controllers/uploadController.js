const { fileTypeFromBuffer } = require("file-type");
const pool = require("../db/pool");
const storage = require("../services/storageService");

const SUPPORTED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];

// multer used to invent the stored filename; now that files come through in
// memory, we build it here. Timestamp + random keeps two RLAs uploading
// "IMG_0001.jpg" at the same moment from colliding. The extension comes from
// the detected format, not the original name, so the stored key never claims
// to be something the bytes aren't.
const buildStoredFilename = (extension) =>
  `${Date.now()}-${Math.round(Math.random() * 1e9)}.${extension}`;

const uploadReceipts = async (req, res) => {
  try {
    // `|| {}` because Express 5 leaves req.body UNDEFINED when no body parser
    // matched — a bodyless POST here would otherwise throw on the destructure
    // and surface as a 500, hiding the real answer ("No files uploaded").
    // Express 4 defaulted it to {}, which is why this read as safe.
    const { transaction_id } = req.body || {}; // may be undefined — allowed (file-first)

    if (!req.files || req.files.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No files uploaded" });
    }

    // multer's fileFilter only sees the mimetype the BROWSER supplied, and the
    // browser derives that from the file extension. A HEIC renamed .jpg walks
    // straight through that gate, then fails much later inside OCR or the PDF
    // builder, where the cause is nowhere near the symptom. The bytes are the
    // only honest answer, so every file is re-checked against its magic bytes.
    //
    // This happens BEFORE anything is written. Rejecting partway through the
    // save loop would leave the earlier files stored and their rows inserted,
    // for a request that ultimately failed.
    const checked = [];
    for (const file of req.files) {
      const detected = await fileTypeFromBuffer(file.buffer);
      if (!detected || !SUPPORTED_MIME_TYPES.includes(detected.mime)) {
        return res.status(400).json({
          success: false,
          message:
            `"${file.originalname}" isn't a supported file type` +
            `${detected ? ` (it is really ${detected.mime})` : ""}. ` +
            `Receipts must be JPEG, PNG, or PDF.`,
        });
      }
      checked.push({ file, detected });
    }

    const saved = [];
    for (const { file, detected } of checked) {
      const storedFilename = buildStoredFilename(detected.ext);
      const key = storage.buildKey(storage.KEY_PREFIX.RECEIPTS, storedFilename);

      // Write the bytes first — if this throws we must not leave a DB row
      // pointing at a file that was never stored.
      await storage.saveFile(key, file.buffer);

      const result = await pool.query(
        `INSERT INTO receipt_files
           (transaction_id, original_filename, stored_filename, file_path, file_type, upload_date)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING *`,
        [
          transaction_id || null,
          file.originalname,
          storedFilename,
          key,
          // the detected type, never file.mimetype — the row records what the
          // bytes are, not what the upload claimed.
          detected.mime,
        ]
      );
      saved.push(result.rows[0]);
    }

    return res.status(201).json({ success: true, files: saved });
  } catch (error) {
    console.error("uploadReceipts error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to upload receipts" });
  }
};

module.exports = { uploadReceipts };
