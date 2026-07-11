const fs = require("fs");
const { generatePackage } = require("../services/packageService");
const { getOrCreateReconciliationPeriod } = require("../services/reconciliationPeriodService");

const getCurrentPeriod = async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const row = await getOrCreateReconciliationPeriod(today);
    return res.status(200).json({
      period: {
        reconciliationPeriodId: row.reconciliation_period_id,
        startDate: row.start_date,
        endDate: row.end_date,
      },
    });
  } catch (error) {
    console.error("getCurrentPeriod error:", error);
    return res.status(500).json({ message: "Failed to calculate current period" });
  }
};

const downloadPackage = async (req, res) => {
  try {
    const { cardholder_id, reconciliation_period_id } = req.body;
    if (!cardholder_id || !reconciliation_period_id) {
      return res.status(400).json({ message: "cardholder_id and reconciliation_period_id are required" });
    }

    const { zipPath, zipFilename, receiptCount } = await generatePackage(
      cardholder_id,
      reconciliation_period_id
    );

    res.setHeader("Content-Disposition", `attachment; filename="${zipFilename}"`);
    res.setHeader("Content-Type", "application/zip");
    const stream = fs.createReadStream(zipPath);
    stream.on("error", (err) => {
      console.error("stream error:", err);
      res.status(500).end();
    });
    stream.pipe(res);
  } catch (error) {
    console.error("downloadPackage error:", error);
    return res.status(500).json({ message: "Failed to generate package" });
  }
};

module.exports = { getCurrentPeriod, downloadPackage };
