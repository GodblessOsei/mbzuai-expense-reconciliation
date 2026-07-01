require("dotenv").config();
const fs = require("fs");
const OpenAI = require("openai");
const { pdf } = require("pdf-to-img");

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";
//"openai/gpt-4o-mini";

const SINGLE_PROMPT = `You are a receipt/invoice data extractor for a university
expense-reconciliation system. This is a legitimate task. Extract the fields from the
single receipt image and return ONLY a JSON object, no markdown, in exactly this shape:
{
  "vendorName": "the actual merchant/store, not the payment processor",
  "purchaseDate": "YYYY-MM-DD",
  "invoiceNumber": "",
  "amountAed": "total as a string, numbers only e.g. 60.00",
  "currency": "AED",
  "cardLastFour": "",
  "isHandwritten": false,
  "confidence": "high | medium | low"
}
Use an empty string for any missing field (false for isHandwritten).`;

const SINGLE_ORDER_PROMPT = `You are a receipt/invoice data extractor for a university
expense-reconciliation system. This is a legitimate task. You are given MULTIPLE images
that are all pages/sections/screenshots of ONE single order or receipt (for example: the
order header on one image, line items on others, and the payment summary on another).
They are NOT separate purchases.

Do NOT add up multiple subtotals or line items. Find the ONE authoritative final total
actually paid (usually labelled "Total Amount Paid", "Total Paid", "Total", or "Grand
Total", typically on the payment summary). Combine information across all the images into
ONE record. Return ONLY this JSON object, no markdown:
{
  "vendorName": "the merchant/store shown (e.g. Carrefour)",
  "purchaseDate": "YYYY-MM-DD",
  "invoiceNumber": "the order number if shown",
  "amountAed": "the single final total paid, numbers only e.g. 501.24",
  "currency": "AED",
  "cardLastFour": "last 4 digits of the card if shown",
  "isHandwritten": false,
  "confidence": "high | medium | low"
}
Use an empty string for any missing field (false for isHandwritten).`;

const SEPARATE_RECEIPTS_PROMPT = `You are a receipt/invoice data extractor for a university
expense-reconciliation system. This is a legitimate task. You are given MULTIPLE SEPARATE
receipts that belong to ONE transaction (for example, one marketplace order fulfilled by
several different sellers, each producing its own receipt).

Do NOT consolidate them yourself. Extract EACH receipt separately and return a JSON ARRAY,
one object per receipt, in the SAME ORDER as the images. Return ONLY the JSON array, no
markdown:
[
  {
    "vendorName": "this receipt's merchant",
    "purchaseDate": "YYYY-MM-DD",
    "invoiceNumber": "",
    "amountAed": "this receipt's total, numbers only e.g. 40.00",
    "currency": "AED",
    "cardLastFour": "",
    "isHandwritten": false,
    "confidence": "high | medium | low"
  }
]
One object per receipt. Use an empty string for any missing field (false for isHandwritten).`;

// Helpers ------
// Turn one file path into ONE OR MORE image content blocks.
// - Images (PNG/JPEG): one block. Real format detected from magic bytes, not the file
//   extension (uploads are often mislabeled, e.g. JPEG named .png).
// - PDFs: detected by the %PDF magic bytes, then each page is rendered to a PNG image
//   block (the gpt4o-mini accepts png/jpeg/gif/webp only — NOT PDF).
const fileToImageBlocks = async (filePath) => {
  const buffer = fs.readFileSync(filePath);

  const isPdf =
    buffer[0] === 0x25 && // %
    buffer[1] === 0x50 && // P
    buffer[2] === 0x44 && // D
    buffer[3] === 0x46; // F

  if (!isPdf) {
    // single image block
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50; // PNG signature
    const mimeType = isPng ? "image/png" : "image/jpeg";
    return [
      {
        type: "image_url",
        image_url: {
          url: `data:${mimeType};base64,${buffer.toString("base64")}`,
        },
      },
    ];
  }

  // PDF -> render each page to a PNG image block
  const blocks = [];
  const document = await pdf(filePath, { scale: 2 }); // scale up for legibility
  for await (const pageImage of document) {
    blocks.push({
      type: "image_url",
      image_url: {
        url: `data:image/png;base64,${pageImage.toString("base64")}`,
      },
    });
  }
  return blocks;
};

const callModel = async (promptText, paths) => {
  // each path may yield several image blocks (a PDF expands to page-images), so flatten.
  const blockArrays = await Promise.all(paths.map(fileToImageBlocks));
  const imageBlocks = blockArrays.flat();
  const content = [{ type: "text", text: promptText }, ...imageBlocks];
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content }],
  });
  const raw = response.choices?.[0]?.message?.content ?? "";
  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("Could not parse model output:", raw);
    return null;
  }
};

const RANK = { high: 3, medium: 2, low: 1 };
const REVERSE_RANK = { 3: "high", 2: "medium", 1: "low" };

const uniqueNonEmpty = (values) => [...new Set(values.filter(Boolean))];

//Mode 1: single receipt

const extractSingle = async (filePath) => {
  const fields = await callModel(SINGLE_PROMPT, [filePath]);
  if (!fields) return null;
  return {
    consolidatedFields: { ...fields, receiptCount: 1 },
    managerFlags: [], // { type, blocking } objects -> DB; none for a single file
    reviewNotices: [],
  };
};

// Mode 2: multiple images of ONE order

const extractSingleOrder = async (filePaths) => {
  const fields = await callModel(SINGLE_ORDER_PROMPT, filePaths);
  if (!fields) return null;
  return {
    consolidatedFields: { ...fields, receiptCount: filePaths.length },
    managerFlags: [{ type: "multi_file_submission", blocking: false }],
    reviewNotices: [
      "Multiple images of one order — please verify the total is the single amount paid.",
    ],
  };
};

// Mode 3: separate receipts (sum in code + mode-aware flags)

const extractSeparateReceipts = async (filePaths) => {
  const perReceipt = await callModel(SEPARATE_RECEIPTS_PROMPT, filePaths);
  if (!Array.isArray(perReceipt) || perReceipt.length === 0) return null;

  const managerFlags = []; // object signature: { type, blocking }
  const reviewNotices = [];

  // Context flag: this is a multi-file submission. Records for the manager, non-blocking.
  managerFlags.push({ type: "multi_file_submission", blocking: false });

  // Sum amounts of all perReceipt prices
  const total = perReceipt.reduce(
    (sum, r) => sum + (Number(r.amountAed) || 0),
    0
  );

  // card digits differ across complete receipts -> serious -> block
  const uniqueCards = uniqueNonEmpty(perReceipt.map((r) => r.cardLastFour));
  if (uniqueCards.length > 1) {
    managerFlags.push({ type: "ocr_card_mismatch", blocking: true });
  }

  // currency differs -> block
  const uniqueCurrencies = uniqueNonEmpty(
    perReceipt.map((r) => (r.currency || "").toUpperCase())
  );
  if (uniqueCurrencies.length > 1) {
    managerFlags.push({ type: "ocr_currency_mismatch", blocking: true });
  }

  // vendor mismatch: EXPECTED here (different sellers in one order), so NOT flagged.
  const vendors = uniqueNonEmpty(perReceipt.map((r) => r.vendorName));

  // date mismatch: minor -> soft notice only, never a DB flag
  const uniqueDates = uniqueNonEmpty(perReceipt.map((r) => r.purchaseDate));
  if (uniqueDates.length > 1) {
    reviewNotices.push(
      "Purchase dates differ across receipts — please verify."
    );
  }

  reviewNotices.push(
    `${perReceipt.length} separate receipts were summed — please verify the total.`
  );

  const dates = perReceipt
    .map((r) => r.purchaseDate)
    .filter(Boolean)
    .sort();

  // Confidence = weakest per-receipt read, dropped one level if any BLOCKING flag fired.
  const ranks = perReceipt.map((r) => RANK[r.confidence] || 2);
  let overall = Math.min(...ranks);
  const hasBlocking = managerFlags.some((f) => f.blocking);
  if (hasBlocking) overall = Math.max(1, overall - 1);

  return {
    consolidatedFields: {
      vendorName: vendors.length === 1 ? vendors[0] : "Multiple vendors",
      purchaseDate: dates[0] || "", // earliest
      invoiceNumber: perReceipt[0].invoiceNumber || "",
      amountAed: total.toFixed(2),
      currency: "AED",
      cardLastFour: uniqueCards.length === 1 ? uniqueCards[0] : "", // blank if mismatch
      isHandwritten: perReceipt.some((r) => r.isHandwritten),
      confidence: REVERSE_RANK[overall],
      receiptCount: perReceipt.length,
      perReceipt, // breakdown, for transparency
    },
    managerFlags,
    reviewNotices,
  };
};

// Entry point: branch on file count + mode
// mode (only used when >1 file):
//   "single_order"      -> multiple images of one order (do NOT sum)
//   "separate_receipts" -> separate receipts of one transaction (sum)
const extractReceiptData = async (filePaths, mode = "separate_receipts") => {
  const paths = Array.isArray(filePaths) ? filePaths : [filePaths];

  if (paths.length === 0) return null;
  if (paths.length === 1) return await extractSingle(paths[0]);

  if (mode === "single_order") return await extractSingleOrder(paths);
  return await extractSeparateReceipts(paths);
};

module.exports = { extractReceiptData };
