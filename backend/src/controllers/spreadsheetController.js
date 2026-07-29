const path = require("path");
const pool = require("../db/pool");
const storage = require("../services/storageService");
const { generateReconciliationSpreadsheet } = require("../services/spreadsheetService");

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const previewPackage = async (req, res) => {
  try {
    const { cardholder_id, reconciliation_period_id } = req.query;

    if (!cardholder_id || !reconciliation_period_id) {
      return res.status(400).json({ success: false, message: "cardholder_id and reconciliation_period_id are required" });
    }

    const result = await pool.query(
      `SELECT
         t.transaction_id,
         t.vendor_name,
         t.amount_aed,
         t.status,
         t.purchase_date,
         EXISTS(
           SELECT 1 FROM flags f
           WHERE f.transaction_id = t.transaction_id AND f.resolved = FALSE
         ) AS has_unresolved_flags
       FROM transactions t
       WHERE t.cardholder_id            = $1
         AND t.reconciliation_period_id = $2
         AND t.status IN ('submitted', 'reviewed', 'packaged')
       ORDER BY t.purchase_date ASC`,
      [cardholder_id, reconciliation_period_id]
    );

    const transactions = result.rows;
    const submitted  = transactions.filter((t) => t.status === "submitted");
    const reviewed   = transactions.filter((t) => t.status === "reviewed");
    const packaged   = transactions.filter((t) => t.status === "packaged");
    const totalSpend = transactions.reduce((s, t) => s + parseFloat(t.amount_aed), 0);
    const excludedAmount = transactions
      .filter((t) => t.has_unresolved_flags)
      .reduce((s, t) => s + parseFloat(t.amount_aed), 0);

    return res.status(200).json({
      success: true,
      preview: {
        totalCount:            transactions.length,
        submittedCount:        submitted.length,
        reviewedCount:         reviewed.length,
        packagedCount:         packaged.length,
        totalSpend,
        excludedAmount,
        eligibleReplenishment: totalSpend - excludedAmount,
      },
    });
  } catch (error) {
    console.error("previewPackage error:", error);
    return res.status(500).json({ success: false, message: "Failed to load preview" });
  }
};

const generateSpreadsheet = async (req, res) => {
  try {
    const { cardholder_id, reconciliation_period_id } = req.body;

    if (!cardholder_id || !reconciliation_period_id) {
      return res.status(400).json({
        success: false,
        message: "cardholder_id and reconciliation_period_id are required",
      });
    }

    const { filename, summary } = await generateReconciliationSpreadsheet(
      cardholder_id,
      reconciliation_period_id
    );

    return res.status(200).json({
      success: true,
      filename,
      summary,
    });
  } catch (error) {
    console.error("generateSpreadsheet error:", error);

    if (error.message.includes("No reviewed transactions")) {
      return res.status(404).json({ success: false, message: error.message });
    }

    return res.status(500).json({ success: false, message: "Failed to generate spreadsheet" });
  }
};

const downloadSpreadsheet = async (req, res) => {
  try {
    const { filename } = req.params;

    // prevent path traversal — only allow the basename. The storage driver
    // rejects escaping keys too, but keeping this makes the intent explicit.
    const safe = path.basename(filename);
    const key = storage.buildKey(storage.KEY_PREFIX.SPREADSHEETS, safe);

    if (!(await storage.fileExists(key))) {
      return res.status(404).json({ success: false, message: "Spreadsheet not found" });
    }

    res.setHeader("Content-Disposition", `attachment; filename="${safe}"`);
    res.setHeader("Content-Type", XLSX_MIME);

    const stream = await storage.createReadStream(key);
    stream.on("error", (err) => {
      console.error("downloadSpreadsheet stream error:", err);
      res.status(500).end();
    });
    return stream.pipe(res);
  } catch (error) {
    console.error("downloadSpreadsheet error:", error);
    return res.status(500).json({ success: false, message: "Failed to download spreadsheet" });
  }
};

module.exports = { previewPackage, generateSpreadsheet, downloadSpreadsheet };
