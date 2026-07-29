const { PassThrough } = require("stream");
const { ZipArchive } = require("archiver");
const pool = require("../db/pool");
const storage = require("./storageService");
const { generateReconciliationSpreadsheet } = require("./spreadsheetService");

const sanitize = (v) => String(v ?? "").replace(/[^a-zA-Z0-9]/g, "").trim();

const formatDateShort = (v) => {
  if (!v) return "";
  return new Date(v).toLocaleDateString("en-GB").replace(/\//g, "-");
};

const generatePackage = async (cardholderId, reconciliationPeriodId) => {
  // 1. generate (or re-use) the spreadsheet — this also marks transactions packaged
  const { key: spreadsheetKey, filename: spreadsheetFilename } =
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
  const zipFilename = `MBZUAI_RLA_Package_${sanitize(holderName)}_${periodStr}.zip`;
  const zipKey = storage.buildKey(storage.KEY_PREFIX.PACKAGES, zipFilename);

  // archive.file() reads a path off the disk, which is no longer where files
  // necessarily live. Fetch the bytes first and append buffers instead.
  const spreadsheetBuffer = await storage.getFile(spreadsheetKey);

  const receiptEntries = [];
  for (const f of files) {
    if (!f.file_path) continue;
    const key = storage.normalizeKey(f.file_path, storage.KEY_PREFIX.RECEIPTS);
    // a row can outlive its file; skip rather than fail the whole package
    if (!(await storage.fileExists(key))) continue;
    receiptEntries.push({
      buffer: await storage.getFile(key),
      name: `receipts/${f.original_filename || f.stored_filename}`,
    });
  }

  // Build the ZIP in memory, then hand the finished bytes to storage.
  const zipBuffer = await new Promise((resolve, reject) => {
    const archive   = new ZipArchive({ zlib: { level: 6 } });
    const collector = new PassThrough();
    const chunks    = [];

    collector.on("data", (chunk) => chunks.push(chunk));
    collector.on("end", () => resolve(Buffer.concat(chunks)));
    collector.on("error", reject);
    archive.on("error", reject);

    archive.pipe(collector);

    // spreadsheet at the root of the ZIP
    archive.append(spreadsheetBuffer, { name: spreadsheetFilename });

    // receipt files in a receipts/ subfolder
    receiptEntries.forEach((entry) =>
      archive.append(entry.buffer, { name: entry.name })
    );

    archive.finalize();
  });

  await storage.saveFile(zipKey, zipBuffer);

  return {
    zipKey,
    zipFilename,
    receiptCount: receiptEntries.length,
  };
};

module.exports = { generatePackage };
