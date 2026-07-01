// test-ocr.js (in backend/, run with: node test-ocr.js)
require("dotenv").config();
const { extractReceiptData } = require("./src/services/ocrService");

(async () => {
  // the Carrefour case — multiple images of ONE order
  const carrefour = await extractReceiptData(
    [
      "/Users/godblessmensahosei/Downloads/Order Details.pdf",
      "/Users/godblessmensahosei/Downloads/WhatsApp Image 2026-06-29 at 14.00.49 (2).jpeg",
      "/Users/godblessmensahosei/Downloads/Order Details 1.pdf",
      "/Users/godblessmensahosei/Downloads/WhatsApp Image 2026-06-29 at 14.00.49.jpeg",
    ],
    "single_order"
  );
  console.log("SINGLE_ORDER:", JSON.stringify(carrefour, null, 2));
})();
