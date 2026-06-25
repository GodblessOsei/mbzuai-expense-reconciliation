const pool = require("../db/pool");

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
      const result = await pool.query(
        `INSERT INTO receipt_files
           (transaction_id, original_filename, stored_filename, file_path, file_type, upload_date)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING *`,
        [
          transaction_id || null,
          file.originalname,
          file.filename,
          file.path,
          file.mimetype,
        ]
      );
      saved.push(result.rows[0]);
    }

    res.status(201).json({ success: true, files: saved });
  } catch (error) {
    console.error(error.message);
    res
      .status(500)
      .json({ success: false, message: "Failed to upload receipts" });
  }
};

module.exports = { uploadReceipts };
