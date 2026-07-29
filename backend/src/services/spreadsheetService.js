const ExcelJS = require("exceljs");
const pool = require("../db/pool");
const storage = require("./storageService");

const NAVY = "FF1B3A6B";
const GOLD = "FFE4C988";
const SAND = "FFF5EFE0";
const WHITE = "FFFFFFFF";
const RED_BG = "FFFDE8E8";
const RED_FG = "FF991B1B";
const GREEN_BG = "FFE2F0D9";
const GREEN_FG = "FF166534";
const AMBER_BG = "FFFCE4D6";
const AMBER_FG = "FF9A5B13";
const GRID = "FFD1D5DB";

const CARD_LIMIT_AED = 5000;
const TOTAL_COLS = 22; // A–V
const LAST_COL_LETTER = "V";
const HEADER_ROW = 9;
const FIRST_DATA_OFFSET = 1; // data starts the row after HEADER_ROW

const sanitize = (v) =>
  String(v ?? "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .trim();

const formatDate = (v) => (v ? new Date(v).toLocaleDateString("en-GB") : "");

const formatRef = (id, purchaseDate) => {
  const year = purchaseDate
    ? new Date(purchaseDate).getFullYear()
    : new Date().getFullYear();
  return `RLA-${year}-${String(id).padStart(4, "0")}`;
};

const fills = {
  navy: { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } },
  gold: { type: "pattern", pattern: "solid", fgColor: { argb: GOLD } },
  sand: { type: "pattern", pattern: "solid", fgColor: { argb: SAND } },
  white: { type: "pattern", pattern: "solid", fgColor: { argb: WHITE } },
  red: { type: "pattern", pattern: "solid", fgColor: { argb: RED_BG } },
  green: { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_BG } },
  amber: { type: "pattern", pattern: "solid", fgColor: { argb: AMBER_BG } },
};

// Status "pill" styling for individual cells — independent of row banding.
const statusPill = (cell, kind) => {
  const map = {
    ok: { bg: GREEN_BG, fg: GREEN_FG },
    warn: { bg: AMBER_BG, fg: AMBER_FG },
    bad: { bg: RED_BG, fg: RED_FG },
  };
  const { bg, fg } = map[kind];
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
  cell.font = { bold: true, size: 9, color: { argb: fg } };
  cell.alignment = { horizontal: "center", vertical: "middle" };
};

// draw one summary "box": label in row A, large value in row B, spanning startCol–endCol
const drawBox = (
  ws,
  labelRow,
  valueRow,
  startCol,
  endCol,
  label,
  value,
  valueColor,
  isCurrency = false
) => {
  ws.mergeCells(labelRow, startCol, labelRow, endCol);
  const lc = ws.getCell(labelRow, startCol);
  lc.value = label;
  lc.font = { size: 9, color: { argb: NAVY } };
  lc.fill = fills.sand;
  lc.alignment = { horizontal: "center", vertical: "bottom", wrapText: true };
  lc.border = {
    top: { style: "medium", color: { argb: NAVY } },
    left: { style: "medium", color: { argb: NAVY } },
    right: { style: "medium", color: { argb: NAVY } },
  };

  ws.mergeCells(valueRow, startCol, valueRow, endCol);
  const vc = ws.getCell(valueRow, startCol);
  vc.value = value;
  vc.font = { bold: true, size: 18, color: { argb: valueColor } };
  vc.fill = fills.white;
  vc.alignment = { horizontal: "center", vertical: "middle" };
  vc.border = {
    bottom: { style: "medium", color: { argb: NAVY } },
    left: { style: "medium", color: { argb: NAVY } },
    right: { style: "medium", color: { argb: NAVY } },
  };
  if (isCurrency) vc.numFmt = "#,##0.00";
};

const generateReconciliationSpreadsheet = async (
  cardholderId,
  reconciliationPeriodId
) => {
  const result = await pool.query(
    `SELECT
       t.*,
       c.cardholder_name,
       c.last_four_digits,
       rp.start_date AS period_start,
       rp.end_date   AS period_end,
       EXISTS(
         SELECT 1 FROM flags f
         WHERE f.transaction_id = t.transaction_id AND f.resolved = FALSE
       ) AS has_unresolved_flags,
       ARRAY(
         SELECT flag_type FROM flags f
         WHERE f.transaction_id = t.transaction_id ORDER BY created_at
       ) AS flag_types,
       ARRAY(
         SELECT original_filename FROM receipt_files rf
         WHERE rf.transaction_id = t.transaction_id
       ) AS receipt_filenames
     FROM transactions t
     LEFT JOIN cardholders c  ON c.cardholder_id            = t.cardholder_id
     LEFT JOIN reconciliation_periods rp ON rp.reconciliation_period_id = t.reconciliation_period_id
     WHERE t.cardholder_id            = $1
       AND t.reconciliation_period_id = $2
       AND t.status IN ('submitted', 'reviewed')
     ORDER BY t.purchase_date ASC`,
    [cardholderId, reconciliationPeriodId]
  );

  const transactions = result.rows;
  if (transactions.length === 0) {
    throw new Error(
      "No reviewed transactions found for this cardholder and period"
    );
  }

  const { cardholder_name, last_four_digits, period_start, period_end } =
    transactions[0];

  const totalSpend = transactions.reduce(
    (s, t) => s + parseFloat(t.amount_aed),
    0
  );
  const excludedAmount = transactions
    .filter((t) => t.has_unresolved_flags)
    .reduce((s, t) => s + parseFloat(t.amount_aed), 0);
  const eligibleReplenishment = totalSpend - excludedAmount;
  const unresolvedExceptions = transactions.filter(
    (t) => t.has_unresolved_flags
  ).length;
  const missingReceiptCount = transactions.filter(
    (t) => t.receipt_filenames.length === 0
  ).length;

  // ── workbook ──────────────────────────────────────────────────────────────
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MBZUAI RLA System";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("Reconciliation", {
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
    },
  });

  // 22 data columns A–V, matching Section 22 of the brief in order.
  ws.columns = [
    { key: "ref", width: 16 }, // A  1  Transaction Reference
    { key: "submitter", width: 16 }, // B  2  Submitter Name
    { key: "cardholder", width: 14 }, // C  3  Cardholder Name
    { key: "last_four", width: 10 }, // D  4  Last 4 Digits
    { key: "purchase_date", width: 13 }, // E  5  Purchase Date
    { key: "submission_date", width: 13 }, // F  6  Submission Date
    { key: "vendor", width: 20 }, // G  7  Vendor
    { key: "invoice", width: 16 }, // H  8  Order/Receipt/Invoice #
    { key: "department", width: 16 }, // I  9  Department
    { key: "category", width: 16 }, // J  10 Purchase Category
    { key: "event", width: 16 }, // K  11 Event/Activity
    { key: "description", width: 22 }, // L  12 Purchase Description
    { key: "amount", width: 14 }, // M  13 Transaction Amount (AED)
    { key: "currency", width: 10 }, // N  14 Original Currency
    { key: "payment_method", width: 18 }, // O  15 Payment Method
    { key: "receipt_files", width: 26 }, // P  16 Receipt Filename(s)
    { key: "receipt_status", width: 12 }, // Q  17 Receipt Status
    { key: "exception", width: 13 }, // R  18 Exception Status
    { key: "late", width: 11 }, // S  19 Late Submission
    { key: "split", width: 18 }, // T  20 Split-Payment Ref
    { key: "replenishment", width: 14 }, // U  21 Replenishment Eligible
    { key: "notes", width: 24 }, // V  22 Notes
  ];

  // summary box column boundaries (3 boxes spanning A–V, 7/7/8 cols)
  const BOX = [
    { start: 1, end: 7 }, // A–G
    { start: 8, end: 14 }, // H–N
    { start: 15, end: 22 }, // O–V
  ];

  // ── ROW 1: title ──────────────────────────────────────────────────────────
  ws.mergeCells(`A1:${LAST_COL_LETTER}1`);
  Object.assign(ws.getCell("A1"), {
    value: "MBZUAI RESIDENTIAL LIFE — BI-WEEKLY CARDHOLDER RECONCILIATION",
    font: { bold: true, size: 14, color: { argb: WHITE } },
    fill: fills.navy,
    alignment: { horizontal: "center", vertical: "middle" },
  });
  ws.getRow(1).height = 34;

  // ── ROW 2: cardholder + period info (full width, split left/right) ────────
  ws.mergeCells(2, 1, 2, 11); // A2:K2 — left: cardholder/card
  Object.assign(ws.getCell("A2"), {
    value: `Cardholder: ${cardholder_name}     |     Card: Visa Prepaid #${last_four_digits}`,
    font: { bold: true, size: 10, color: { argb: WHITE } },
    fill: fills.navy,
    alignment: { horizontal: "left", vertical: "middle", indent: 2 },
  });

  ws.mergeCells(2, 12, 2, 22); // L2:V2 — right: period + generated
  Object.assign(ws.getCell("L2"), {
    value: `Period: ${formatDate(period_start)} – ${formatDate(period_end)}     |     Generated: ${formatDate(new Date())}`,
    font: { size: 10, color: { argb: WHITE } },
    fill: fills.navy,
    alignment: { horizontal: "right", vertical: "middle", indent: 2 },
  });
  ws.getRow(2).height = 22;

  // ── ROW 3: "PERIOD SUMMARY" header ───────────────────────────────────────
  ws.mergeCells(`A3:${LAST_COL_LETTER}3`);
  Object.assign(ws.getCell("A3"), {
    value: "PERIOD SUMMARY",
    font: { bold: true, size: 11, color: { argb: WHITE } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF142d52" } },
    alignment: { horizontal: "center", vertical: "middle", indent: 2 },
  });
  ws.getRow(3).height = 20;

  // ── ROWS 4–5: summary boxes row 1 ────────────────────────────────────────
  drawBox(
    ws,
    4,
    5,
    BOX[0].start,
    BOX[0].end,
    "Card Limit (AED)",
    CARD_LIMIT_AED,
    NAVY,
    true
  );
  drawBox(
    ws,
    4,
    5,
    BOX[1].start,
    BOX[1].end,
    "Total Submitted Spend (AED)",
    totalSpend,
    NAVY,
    true
  );
  drawBox(
    ws,
    4,
    5,
    BOX[2].start,
    BOX[2].end,
    "Total Eligible for Replenishment (AED)",
    eligibleReplenishment,
    GREEN_FG,
    true
  );
  ws.getRow(4).height = 18;
  ws.getRow(5).height = 32;

  // ── ROWS 6–7: summary boxes row 2 ────────────────────────────────────────
  drawBox(
    ws,
    6,
    7,
    BOX[0].start,
    BOX[0].end,
    "Total Excluded — Unresolved Exceptions (AED)",
    excludedAmount,
    excludedAmount > 0 ? RED_FG : NAVY,
    true
  );
  drawBox(
    ws,
    6,
    7,
    BOX[1].start,
    BOX[1].end,
    "Number of Transactions",
    transactions.length,
    NAVY,
    false
  );
  drawBox(
    ws,
    6,
    7,
    BOX[2].start,
    BOX[2].end,
    "Missing / Incomplete Receipts",
    missingReceiptCount,
    missingReceiptCount > 0 ? RED_FG : NAVY,
    false
  );
  ws.getRow(6).height = 18;
  ws.getRow(7).height = 32;

  // ── ROW 8: blank spacer ───────────────────────────────────────────────────
  ws.getRow(8).height = 8;

  // ── ROW 9: column headers ─────────────────────────────────────────────────
  const COL_HEADERS = [
    "Reference",
    "Submitter",
    "Cardholder",
    "Last 4 Digits",
    "Purchase Date",
    "Submission Date",
    "Vendor",
    "Invoice / Order #",
    "Department",
    "Category",
    "Event / Activity",
    "Description",
    "Amount (AED)",
    "Currency",
    "Payment Method",
    "Receipt File(s)",
    "Receipt Status",
    "Exception Status",
    "Late Submission",
    "Split-Payment Ref",
    "Replenishment Eligible",
    "Notes",
  ];

  COL_HEADERS.forEach((h, i) => {
    const cell = ws.getRow(HEADER_ROW).getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 10, color: { argb: WHITE } };
    cell.fill = fills.navy;
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
      indent: 1,
    };
    cell.border = { bottom: { style: "medium", color: { argb: GOLD } } };
  });
  ws.getRow(HEADER_ROW).height = 36;

  // Freeze everything above and including the header row, so it stays visible on scroll.
  ws.views = [{ state: "frozen", ySplit: HEADER_ROW }];

  // ── DATA ROWS (row 10+) ───────────────────────────────────────────────────
  transactions.forEach((t, idx) => {
    const isLate = t.flag_types.includes("late_submission");
    const exception = t.has_unresolved_flags
      ? "Unresolved"
      : t.flag_types.length > 0
        ? "Resolved"
        : "None";
    const receipts =
      t.receipt_filenames.length > 0
        ? t.receipt_filenames.join(", ")
        : "No file";
    const receiptStatus =
      t.receipt_filenames.length > 0 ? "Complete" : "Missing";
    const splitRef = t.is_split_payment
      ? `Part ${t.payment_part_number ?? "?"} of ${t.total_payment_parts ?? "?"}`
      : "";
    const eligibleLabel = t.has_unresolved_flags ? "No" : "Yes";

    const row = ws.addRow([
      formatRef(t.transaction_id, t.purchase_date),
      // NOTE: assumes submitter_name is captured directly on the transaction
      // (no real user accounts exist per the role-picker auth design).
      // Rename if your Prisma field differs.
      t.submitter_name ?? "",
      cardholder_name,
      last_four_digits ?? "",
      formatDate(t.purchase_date),
      formatDate(t.submission_date),
      t.vendor_name ?? "",
      t.invoice_number ?? "",
      t.department ?? "",
      t.category ?? "",
      // NOTE: assumes event_activity / purchase_description columns exist
      // on transactions per Section 8 of the brief — rename if different.
      t.event_activity ?? "",
      t.purchase_description ?? "",
      parseFloat(t.amount_aed),
      t.original_currency ?? "",
      t.payment_method ?? "",
      receipts,
      receiptStatus,
      exception,
      isLate ? "Yes" : "No",
      splitRef,
      eligibleLabel,
      t.notes ?? "",
    ]);

    row.getCell(13).numFmt = "#,##0.00"; // Amount column (M)
    row.height = 22;

    // Zebra banding: unresolved-flag rows stay red for visibility; otherwise
    // alternate white/sand so long tables stay easy to scan.
    const zebraFill = t.has_unresolved_flags
      ? fills.red
      : idx % 2 === 0
        ? fills.white
        : fills.sand;
    const zebraFg = t.has_unresolved_flags ? RED_FG : NAVY;

    row.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col > TOTAL_COLS) return;
      cell.fill = zebraFill;
      cell.font = { size: 10, color: { argb: zebraFg } };
      cell.alignment = { vertical: "middle", wrapText: false, indent: 1 };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: GRID } },
        right: { style: "thin", color: { argb: GRID } },
      };
    });

    // Status "pills" — colored independently of row banding so they pop
    // out even inside a red (unresolved) row.
    statusPill(row.getCell(17), receiptStatus === "Complete" ? "ok" : "bad"); // Q Receipt Status
    statusPill(
      row.getCell(18),
      exception === "None" ? "ok" : exception === "Resolved" ? "warn" : "bad"
    ); // R Exception
    statusPill(row.getCell(19), isLate ? "warn" : "ok"); // S Late Submission
    statusPill(row.getCell(21), eligibleLabel === "Yes" ? "ok" : "bad"); // U Replenishment Eligible
  });

  // ── TOTALS ROW ────────────────────────────────────────────────────────────
  const totalsRow = ws.addRow(Array(TOTAL_COLS).fill(""));
  totalsRow.getCell(1).value = "TOTALS";
  totalsRow.getCell(13).value = totalSpend; // Amount column (M)
  totalsRow.getCell(13).numFmt = "#,##0.00";
  totalsRow.height = 22;

  totalsRow.eachCell({ includeEmpty: true }, (cell, col) => {
    if (col > TOTAL_COLS) return;
    cell.fill = fills.gold;
    cell.font = { bold: true, size: 10, color: { argb: NAVY } };
    cell.alignment = {
      vertical: "middle",
      horizontal: col === 1 ? "left" : col === 13 ? "right" : "center",
    };
    cell.border = { top: { style: "medium", color: { argb: NAVY } } };
  });

  // ── LEGEND ────────────────────────────────────────────────────────────────
  const legendRowNum = totalsRow.number + 2;
  ws.mergeCells(legendRowNum, 1, legendRowNum, TOTAL_COLS);
  const legendCell = ws.getCell(legendRowNum, 1);
  legendCell.value =
    "Legend:  Green = OK / Eligible / Complete    Amber = Review / Late / Resolved Exception    Red = Missing / Unresolved / Excluded";
  legendCell.font = { italic: true, size: 8, color: { argb: "FF595959" } };
  ws.getRow(legendRowNum).height = 16;

  // ── SAVE ──────────────────────────────────────────────────────────────────
  const periodStr = `${formatDate(period_start).replace(/\//g, "-")}_${formatDate(period_end).replace(/\//g, "-")}`;
  const filename = `MBZUAI_Reconciliation_${sanitize(cardholder_name)}_${periodStr}.xlsx`;
  const key = storage.buildKey(storage.KEY_PREFIX.SPREADSHEETS, filename);

  // writeBuffer instead of writeFile — the storage driver decides where bytes
  // land, so ExcelJS hands us the bytes rather than touching the disk itself.
  const buffer = await workbook.xlsx.writeBuffer();
  await storage.saveFile(key, Buffer.from(buffer));

  await pool.query(
    `UPDATE transactions SET status = 'packaged'
     WHERE cardholder_id = $1 AND reconciliation_period_id = $2 AND status IN ('submitted', 'reviewed')`,
    [cardholderId, reconciliationPeriodId]
  );

  return {
    key,
    filename,
    summary: {
      totalSpend,
      excludedAmount,
      eligibleReplenishment,
      transactionCount: transactions.length,
      unresolvedExceptions,
      missingReceiptCount,
    },
  };
};

module.exports = { generateReconciliationSpreadsheet };
