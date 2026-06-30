const { extractReceiptData } = require("../services/ocrService");

const extractReceipt = async (req, res) => {
  try {
    const { filePaths, mode } = req.body;

    if (!filePaths || filePaths.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "filePaths is required" });
    }

    const result = await extractReceiptData(filePaths, mode);

    if (!result) {
      return res.status(502).json({
        success: false,
        message: "Extraction returned no usable data",
      });
    }

    // service returns { consolidatedFields, flags, reviewFlags }
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("OCR error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to extract receipt data" });
  }
};

module.exports = { extractReceipt };
