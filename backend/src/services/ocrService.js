require("dotenv").config();
const fs = require("fs");
const OpenAI = require("openai");

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const MODEL = "openai/gpt-4o-mini";

/* ------------------------------------------------------------------ */
/* Prompts                                                            */
/* ------------------------------------------------------------------ */

// One receipt, one record.
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

// Several images that are all PAGES/SECTIONS of ONE order. Do NOT sum.
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

// Several SEPARATE receipts that together make one transaction (e.g. one Amazon order
// fulfilled by different sellers). Extract EACH separately; code will sum + cross-check.
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

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

// Build one image content block. Detects the real format from magic bytes rather than
// trusting the file extension (uploaded files are often mislabeled, e.g. JPEG named .png).
const fileToImageBlock = (filePath) => {
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString("base64");
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50; // PNG signature
  const mimeType = isPng ? "image/png" : "image/jpeg";
  return {
    type: "image_url",
    image_url: { url: `data:${mimeType};base64,${base64}` },
  };
};

// Make one model call with a text prompt + one or more images. Returns parsed JSON or null.
const callModel = async (promptText, paths) => {
  const content = [
    { type: "text", text: promptText },
    ...paths.map(fileToImageBlock),
  ];
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

/* ------------------------------------------------------------------ */
/* Mode 1: single receipt                                             */
/* ------------------------------------------------------------------ */
const extractSingle = async (filePath) => {
  const fields = await callModel(SINGLE_PROMPT, [filePath]);
  return {
    consolidatedFields: fields,
    flags: [], // nothing to cross-check on one file
    reviewFlags: [],
  };
};

/* ------------------------------------------------------------------ */
/* Mode 2: multiple images of ONE order (do NOT sum)                  */
/* ------------------------------------------------------------------ */
const extractSingleOrder = async (filePaths) => {
  const fields = await callModel(SINGLE_ORDER_PROMPT, filePaths);
  if (!fields) return null;
  return {
    consolidatedFields: { ...fields, receiptCount: filePaths.length },
    flags: [],
    reviewFlags: [
      "Multiple images of one order — please verify the total is correct",
    ],
  };
};

/* ------------------------------------------------------------------ */
/* Mode 3: separate receipts (sum in code + cross-check flags)        */
/* ------------------------------------------------------------------ */
const extractSeparateReceipts = async (filePaths) => {
  const perReceipt = await callModel(SEPARATE_RECEIPTS_PROMPT, filePaths);
  if (!Array.isArray(perReceipt) || perReceipt.length === 0) return null;

  const flags = []; // blocking conflicts
  const reviewFlags = []; // soft notices

  const total = perReceipt.reduce(
    (sum, r) => sum + (Number(r.amountAed) || 0),
    0
  );

  // cross-checks -> blocking flags
  const uniqueCards = [
    ...new Set(perReceipt.map((r) => r.cardLastFour).filter(Boolean)),
  ];
  if (uniqueCards.length > 1)
    flags.push("Card numbers do not match across receipts");

  const uniqueCurrencies = [
    ...new Set(
      perReceipt.map((r) => (r.currency || "").toUpperCase()).filter(Boolean)
    ),
  ];
  if (uniqueCurrencies.length > 1)
    flags.push("Currencies do not match across receipts");

  // soft notice
  reviewFlags.push(
    `${perReceipt.length} separate receipts summed — please verify the total`
  );

  const vendors = [
    ...new Set(perReceipt.map((r) => r.vendorName).filter(Boolean)),
  ];
  const dates = perReceipt
    .map((r) => r.purchaseDate)
    .filter(Boolean)
    .sort();

  const perReceiptRanks = perReceipt.map((r) => RANK[r.confidence] || 2);
  let overall = Math.min(...perReceiptRanks);
  if (flags.length > 0) overall = Math.max(1, overall - 1);

  return {
    consolidatedFields: {
      vendorName: vendors.length === 1 ? vendors[0] : "Multiple vendors",
      purchaseDate: dates[0] || "",
      invoiceNumber: perReceipt[0].invoiceNumber || "",
      amountAed: total.toFixed(2),
      currency: "AED",
      cardLastFour: uniqueCards.length === 1 ? uniqueCards[0] : "",
      isHandwritten: perReceipt.some((r) => r.isHandwritten),
      confidence: REVERSE_RANK[overall],
      receiptCount: perReceipt.length,
      perReceipt,
    },
    flags, // blocking
    reviewFlags, // informational
  };
};

/* ------------------------------------------------------------------ */
/* Entry point: branch on file count + mode                           */
/* ------------------------------------------------------------------ */
// mode is only relevant when there is more than one file:
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
