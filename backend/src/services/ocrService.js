require("dotenv").config();
const fs = require("fs");
const OpenAI = require("openai");

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

// ---- prompts ----
const SINGLE_PROMPT = `You are a receipt/invoice data extractor for a university
expense-reconciliation system. This is a legitimate task. Extract the fields and return
ONLY a JSON object, no markdown, in exactly this shape:
{
  "vendorName": "the actual merchant, not the payment processor",
  "purchaseDate": "YYYY-MM-DD",
  "invoiceNumber": "",
  "amountAed": "total as a string, numbers only e.g. 60.00",
  "currency": "AED",
  "cardLastFour": "",
  "isHandwritten": false,
  "confidence": "high"
}
Use an empty string for any missing field (false for isHandwritten).`;

const MULTI_PROMPT = `You are a receipt/invoice data extractor for a university
expense-reconciliation system. This is a legitimate task. You are given MULTIPLE receipts
that belong to ONE transaction (e.g. one Amazon order from several sellers).

Do NOT consolidate them yourself. Instead, extract EACH receipt separately and return an
ARRAY, one object per receipt, in this exact shape. Return ONLY the JSON array, no markdown:
[
  {
    "vendorName": "this receipt's merchant",
    "purchaseDate": "YYYY-MM-DD",
    "invoiceNumber": "",
    "amountAed": "this receipt's total, numbers only e.g. 40.00",
    "currency": "AED",
    "cardLastFour": "",
    "isHandwritten": false,
    ""confidence": "high | medium | low"
  }
]
One object per receipt, in the order given. Empty string for missing fields.`;

// ---- helpers ----
const fileToImageBlock = (filePath) => {
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString("base64");
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50; // magic bytes, not extension
  const mimeType = isPng ? "image/png" : "image/jpeg";
  return {
    type: "image_url",
    image_url: { url: `data:${mimeType};base64,${base64}` },
  };
};

const callModel = async (promptText, paths) => {
  const content = [
    { type: "text", text: promptText },
    ...paths.map(fileToImageBlock),
  ];
  const response = await client.chat.completions.create({
    model: "openai/gpt-4o-mini",
    messages: [{ role: "user", content }],
  });
  const raw = response.choices[0].message.content;
  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    console.error("Could not parse model output:", raw);
    return null;
  }
};

// ---- single-file path (unchanged behaviour) ----
const extractSingle = async (filePath) => {
  return await callModel(SINGLE_PROMPT, [filePath]);
};

// ---- multi-file path: model returns per-receipt array, CODE consolidates + flags ----
const extractMultiple = async (filePaths) => {
  const perReceipt = await callModel(MULTI_PROMPT, filePaths);
  if (!Array.isArray(perReceipt) || perReceipt.length === 0) return null;

  const flags = [];

  // model confidence ranking
  const rank = { high: 3, medium: 2, low: 1 };
  const reverseRank = { 3: "high", 2: "medium", 1: "low" };

  const perReceiptConfidences = perReceipt.map((r) => rank[r.confidence] || 2);
  let overall = Math.min(...perReceiptConfidences);

  if (flags.length > 0) {
    overall = Math.max(1, overall - 1); // never below "low"
  }

  const consolidatedConfidence = reverseRank[overall];

  // sum amounts in code (reliable)
  const total = perReceipt.reduce(
    (sum, r) => sum + (Number(r.amountAed) || 0),
    0
  );

  // card-digit cross-check
  const cardDigits = perReceipt.map((r) => r.cardLastFour).filter(Boolean);
  const uniqueCards = [...new Set(cardDigits)];
  if (uniqueCards.length > 1) flags.push("card_mismatch_across_receipts");

  // currency cross-check
  const currencies = perReceipt
    .map((r) => (r.currency || "").toUpperCase())
    .filter(Boolean);
  const uniqueCurrencies = [...new Set(currencies)];
  if (uniqueCurrencies.length > 1)
    flags.push("currency_mismatch_across_receipts");

  // consolidated fields
  const vendors = [
    ...new Set(perReceipt.map((r) => r.vendorName).filter(Boolean)),
  ];
  const consolidatedVendor =
    vendors.length === 1 ? vendors[0] : "Multiple vendors";
  const dates = perReceipt
    .map((r) => r.purchaseDate)
    .filter(Boolean)
    .sort();
  const cardLastFour = uniqueCards.length === 1 ? uniqueCards[0] : ""; // blank if mismatch

  return {
    vendorName: consolidatedVendor, // RLA edits to umbrella (e.g. "Amazon") if needed
    purchaseDate: dates[0] || "", // earliest
    invoiceNumber: perReceipt[0].invoiceNumber || "",
    amountAed: total.toFixed(2), // code-summed total
    currency: "AED",
    cardLastFour,
    isHandwritten: perReceipt.some((r) => r.isHandwritten),
    confidence: consolidatedConfidence,
    receiptCount: perReceipt.length,
    perReceipt, // the breakdown, for transparency
    consolidationFlags: flags, // flags for the manager
  };
};

// ---- entry point: branch on count ----
const extractReceiptData = async (filePaths) => {
  const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
  if (paths.length === 1) {
    return await extractSingle(paths[0]);
  }
  return await extractMultiple(paths);
};

module.exports = { extractReceiptData };
