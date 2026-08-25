const express = require("express");
const router = express.Router();
const upload = require("../config/multer");
const { uploadReceipts } = require("../controllers/uploadController");

// Multer rejects before the controller ever runs, and app.js has no error
// middleware — without this, a rejected upload falls through to Express's
// default handler and answers with an HTML stack trace, so the frontend's
// `err.response.data.message` is undefined and the RLA sees nothing useful.
//
// Four arguments is what marks a middleware as an error handler in Express, so
// this is skipped on the happy path and only entered when multer passes an
// error. Scoped to this route rather than added to app.js — uploads are the
// only place multer runs.
const handleUploadErrors = (error, req, res, next) => {
  if (error.code === "UNSUPPORTED_FILE_TYPE") {
    return res.status(400).json({ success: false, message: error.message });
  }
  if (error.code === "LIMIT_FILE_COUNT") {
    return res.status(400).json({
      success: false,
      message: "That's too many files for one submission (10 maximum).",
    });
  }
  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "That file is over the 15MB limit.",
    });
  }
  console.error("upload middleware error:", error);
  return res
    .status(500)
    .json({ success: false, message: "Failed to upload receipts" });
};

// POST /api/uploads  — "files" is the field name the frontend must use
router.post("/", upload.array("files"), handleUploadErrors, uploadReceipts);

module.exports = router;
