const path = require("path");
const { PassThrough } = require("stream");
const { ZipArchive } = require("archiver");
const pool = require("../db/pool");
const storage = require("./storageService");
const { generateReconciliationSpreadsheet } = require("./spreadsheetService");
const { generateCombinedReceiptPdf } = require("./pdfService");

const sanitize = (v) => String(v ?? "").replace(/[^a-zA-Z0-9]/g, "").trim();

const formatDateShort = (v) => {
  if (!v) return "";
  return new Date(v).toLocaleDateString("en-GB").replace(/\//g, "-");
};

const generatePackage = async (cardholderId, reconciliationPeriodId) => {
  // 1. regenerate the spreadsheet — this also marks transactions packaged
  const { key: spreadsheetKey, filename: spreadsheetFilename } =
    await generateReconciliationSpreadsheet(cardholderId, reconciliationPeriodId);

  // 2. collect the packaged transactions. One row per TRANSACTION, not per
  // uploaded file: the ZIP ships the standardized combined PDF, so a
  // multi-file transaction contributes exactly one entry.
  const result = await pool.query(
    `SELECT t.transaction_id, t.pdf_path, t.purchase_date,
            t.vendor_name, t.amount_aed,
            c.cardholder_name, rp.start_date, rp.end_date,
            ARRAY(
              SELECT rf.file_path FROM receipt_files rf
              WHERE rf.transaction_id = t.transaction_id
              ORDER BY rf.receipt_file_id
            ) AS receipt_keys
     FROM transactions t
     JOIN cardholders c   ON c.cardholder_id  = t.cardholder_id
     JOIN reconciliation_periods rp ON rp.reconciliation_period_id = t.reconciliation_period_id
     WHERE t.cardholder_id            = $1
       AND t.reconciliation_period_id = $2
       AND t.status = 'packaged'
     ORDER BY t.purchase_date ASC`,
    [cardholderId, reconciliationPeriodId]
  );

  const transactions = result.rows;
  const { cardholder_name, start_date, end_date } = transactions[0] ?? {};

  // fallback: fetch cardholder + period names if no packaged transactions exist
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

  // The ZIP must carry the standardized PDF named
  // DDMMYYYY_Vendor_AmountAED_Cardholder.pdf, not the raw upload — an RLA's
  // camera roll name ("IMG_0042.jpg", or someone's own bracket convention)
  // carries none of the information the archive is indexed by.
  const receiptEntries = [];
  for (const tx of transactions) {
    let key = tx.pdf_path
      ? storage.normalizeKey(tx.pdf_path, storage.KEY_PREFIX.GENERATED)
      : null;

    // Generating the PDF is a manual manager action, so most transactions
    // reach packaging with pdf_path still NULL. Build it here rather than
    // shipping an incomplete archive — and regenerate when a row outlived
    // its file.
    if (!key || !(await storage.fileExists(key))) {
      const sourceKeys = (tx.receipt_keys || [])
        .filter(Boolean)
        .map((p) => storage.normalizeKey(p, storage.KEY_PREFIX.RECEIPTS));

      if (sourceKeys.length === 0) {
        console.error(
          `package: transaction ${tx.transaction_id} has no receipt files — omitted from ZIP`
        );
        continue;
      }

      try {
        const generated = await generateCombinedReceiptPdf({
          filePaths: sourceKeys,
          purchaseDate: tx.purchase_date,
          vendorName: tx.vendor_name,
          amountAed: tx.amount_aed,
          cardholderName: cardholder_name,
        });
        key = generated.key;
        // Persist it: getAvailableKey appends _01, _02 … on collision, so
        // without this every re-download would mint another copy.
        await pool.query(
          `UPDATE transactions SET pdf_path = $1 WHERE transaction_id = $2`,
          [key, tx.transaction_id]
        );
      } catch (error) {
        // One unreadable upload must not sink the whole package.
        console.error(
          `package: PDF generation failed for transaction ${tx.transaction_id}:`,
          error
        );
        continue;
      }
    }

    receiptEntries.push({
      buffer: await storage.getFile(key),
      name: `receipts/${path.posix.basename(key)}`,
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
