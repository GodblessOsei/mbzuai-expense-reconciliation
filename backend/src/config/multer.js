const multer = require("multer");

// Uploads are held in memory and handed to the storage service by the
// controller — multer no longer decides where bytes land. That choice belongs
// to the storage driver, which may be a local folder or a cloud bucket.
//
// Holding files in memory means an upload's size is now RAM, so a limit is
// required. Receipts are phone photos and small PDFs; 15MB is generous.
const storage = multer.memoryStorage();

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

// fileSize alone bounds ONE file, not the request: without this, a single
// upload could pin 15MB x however many files were attached. 10 covers a
// multi-page order or a multi-seller purchase with room to spare.
const MAX_FILE_COUNT = 10;

// cb(null, false) would mean "skip this file and carry on" — multer drops it
// with no error and no record, so a bad file in a multi-file upload vanishes
// silently and the OCR sums the receipts that survived. A short total on a
// prepaid card is not something to discover at reconciliation time, so an
// unsupported file fails the WHOLE request instead. See handleUploadErrors in
// routes/uploadRoutes.js for the response this turns into.
const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "application/pdf"];
  if (allowed.includes(file.mimetype)) return cb(null, true);

  const error = new Error(
    `"${file.originalname}" isn't a supported file type (${file.mimetype}). ` +
      `Receipts must be JPEG, PNG, or PDF.`
  );
  error.code = "UNSUPPORTED_FILE_TYPE";
  return cb(error);
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: MAX_FILE_COUNT },
});
