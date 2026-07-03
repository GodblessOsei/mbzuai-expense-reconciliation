const path = require("path");
const fs = require("fs");
const archiver = require("archiver");
const pool = require("../db/pool");
const { generateReconciliationSpreadsheet } = require("./spreadsheetService");

const packageDir = path.join(__dirname, "..", "..", "uploads", "packages");
if (!fs.existsSync(packageDir)) fs.mkdirSync(packageDir, { recursive: true });

const sanitize = (v) => String(v ?? "").replace(/[^a-zA-Z0-9]/g, "").trim();

const formatDateShort = (v) => {
  if (!v) return "";
  return new Date(v).toLocaleDateString("en-GB").replace(/\//g, "-");
};

const generatePackage = async (cardholderId, reconciliationPeriodId) => {
  // 1. generate (or re-use) the spreadsheet — this also marks transactions packaged
  const { filePath: spreadsheetPath, filename: spreadsheetFilename } =
    await generateReconciliationSpreadsheet(cardholderId, reconciliationPeriodId);

  // 2. collect all receipt PDFs for packaged transactions in this period
  const result = await pool.query(
    `SELECT rf.file_path, rf.original_filename, rf.stored_filename,
            c.cardholder_name, rp.start_date, rp.end_date
     FROM receipt_files rf
     JOIN transactions t  ON t.transaction_id = rf.transaction_id
     JOIN cardholders c   ON c.cardholder_id  = t.cardholder_id
     JOIN reconciliation_periods rp ON rp.reconciliation_period_id = t.reconciliation_period_id
     WHERE t.cardholder_id            = $1
       AND t.reconciliation_period_id = $2
       AND t.status = 'packaged'`,
    [cardholderId, reconciliationPeriodId]
  );

  const files = result.rows;
  const { cardholder_name, start_date, end_date } = files[0] ?? {};

  // fallback: fetch cardholder + period names if no receipt files exist
  let holderName = cardholder_name;
  let periodStart = start_date;
  let periodEnd = end_date;

  if (!holderName) {
    const meta = await pool.query(
      `SELECT c.cardholder_name, rp.start_date, rp.end_date
       FROM cardholders c, reconciliation_periods rp
       WHERE c.cardholder_id = $1 AND rp.reconciliation_period_id = $2`,
      [cardholderId, reconciliationPeriodId]
    );
    holderName  = meta.rows[0]?.cardholder_name;
    periodStart = meta.rows[0]?.start_date;
    periodEnd   = meta.rows[0]?.end_date;
  }

  // 3. build ZIP
  const periodStr   = `${formatDateShort(periodStart)}_${formatDateShort(periodEnd)}`;
  const zipFilename = `MBZUAI_Package_${sanitize(holderName)}_${periodStr}.zip`;
  const zipPath     = path.join(packageDir, zipFilename);

  await new Promise((resolve, reject) => {
    const output  = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 6 } });

    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);

    // spreadsheet at the root of the ZIP
    archive.file(spreadsheetPath, { name: spreadsheetFilename });

    // receipt files in a receipts/ subfolder
    files.forEach((f) => {
      if (f.file_path && fs.existsSync(f.file_path)) {
        archive.file(f.file_path, { name: `receipts/${f.original_filename || f.stored_filename}` });
      }
    });

    archive.finalize();
  });

  return {
    zipPath,
    zipFilename,
    receiptCount: files.length,
  };
};

module.exports = { generatePackage };
