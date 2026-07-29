const path = require("path");
const pool = require("../db/pool");
const storage = require("../services/storageService");

// multer used to invent the stored filename; now that files come through in
// memory, we build it here. Timestamp + random keeps two RLAs uploading
// "IMG_0001.jpg" at the same moment from colliding.
const buildStoredFilename = (originalName) => {
  const ext = path.extname(originalName || "");
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
};

const uploadReceipts = async (req, res) => {
  try {
    const { transaction_id } = req.body; // may be undefined — that's allowed (file-first)

    if (!req.files || req.files.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No files uploaded" });
    }

    const saved = [];
    for (const file of req.files) {
      const storedFilename = buildStoredFilename(file.originalname);
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
          file.mimetype,
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
