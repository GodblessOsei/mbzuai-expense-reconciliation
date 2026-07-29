const path = require("path");
const { PDFDocument } = require("pdf-lib");
const { fileTypeFromBuffer } = require("file-type");
const storage = require("./storageService");

const formatDateForFilename = (dateString) => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}${month}${year}`;
};

const sanitizeFilenamePart = (value) => {
  return String(value)
    .replace(/[^a-zA-Z0-9]/g, "")
    .trim();
};

// Collision handling ("_01", "_02") now lives in the storage driver as
// getAvailableKey — deciding whether a name is taken is a storage question.

const generateCombinedReceiptPdf = async ({
  filePaths,
  purchaseDate,
  vendorName,
  amountAed,
  cardholderName,
}) => {
  const pdfDoc = await PDFDocument.create();

  // `filePaths` are storage keys. The name is kept for now so the existing
  // callers stay unchanged; normalizeKey absorbs any rows still holding a
  // legacy absolute path.
  for (const fileKey of filePaths) {
    const key = storage.normalizeKey(fileKey, storage.KEY_PREFIX.RECEIPTS);
    const fileBytes = await storage.getFile(key);

    // Detect the real format from the file's magic bytes, never the extension.
    // Phone camera rolls and messaging apps routinely hand us a JPEG named
    // .png; embedPng on JPEG bytes throws, so trusting the name would fail a
    // manager's PDF for a file that is perfectly valid.
    const detected = await fileTypeFromBuffer(fileBytes);
    const mimeType = detected?.mime;

    if (mimeType === "application/pdf") {
      const sourcePdf = await PDFDocument.load(fileBytes);
      const copiedPages = await pdfDoc.copyPages(
        sourcePdf,
        sourcePdf.getPageIndices()
      );
      copiedPages.forEach((page) => pdfDoc.addPage(page));
    } else if (mimeType === "image/png" || mimeType === "image/jpeg") {
      const image =
        mimeType === "image/png"
          ? await pdfDoc.embedPng(fileBytes)
          : await pdfDoc.embedJpg(fileBytes);
      const page = pdfDoc.addPage([image.width, image.height]);
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      });
    } else {
      throw new Error(
        `Unsupported file type for ${key}: ${mimeType || "unrecognised content"}`
      );
    }
  }
  const formattedDate = formatDateForFilename(purchaseDate);
  const safeVendor = sanitizeFilenamePart(vendorName);
  const formattedAmount = Number(amountAed).toFixed(2);
  const safeCardHolder = sanitizeFilenamePart(cardholderName);

  const filename = `${formattedDate}_${safeVendor}_${formattedAmount}AED_${safeCardHolder}.pdf`;
  const key = await storage.getAvailableKey(
    storage.buildKey(storage.KEY_PREFIX.GENERATED, filename)
  );

  const pdfBytes = await pdfDoc.save();
  await storage.saveFile(key, Buffer.from(pdfBytes));

  return {
    filename: path.posix.basename(key),
    key,
  };
};

module.exports = {
  generateCombinedReceiptPdf,
};
