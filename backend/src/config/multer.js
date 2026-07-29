const multer = require("multer");

// Uploads are held in memory and handed to the storage service by the
// controller — multer no longer decides where bytes land. That choice belongs
// to the storage driver, which may be a local folder or a cloud bucket.
//
// Holding files in memory means an upload's size is now RAM, so a limit is
// required. Receipts are phone photos and small PDFs; 15MB is generous.
const storage = multer.memoryStorage();

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "application/pdf"];
  cb(null, allowed.includes(file.mimetype));
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});
