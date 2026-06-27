const fs = require("fs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");

const uploadDir = path.join(__dirname, "..", "..", "uploads");

const formatDateForFilename = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth()+1).padStart(2, "0");
    const year = date.getFullYear();

    return `${day}${month}${year}`
}

const sanitizeFilenamePart = (value) => {
    return String(value)
    .replace(/[^a-zA-Z0-9]/g, "")
    .trim()
}

const getUniqueFilePath = (baseFilePath) => {
    if (!fs.existsSync(baseFilePath)){
        return baseFilePath;
    }

    const dir = path.dirname(baseFilePath);
    const ext = path.extname(baseFilePath);
    const baseName = path.basename(baseFilePath, ext);

    let counter = 1;

    while (true) {
        const candidate = path.join(
            dir,
            `${baseName}_${String(counter).padStart(2, "0")}${ext}`
        );
        if (!fs.existsSync(candidate)) {
            return candidate;
        }
        counter++;
    }
}

const generateCombinedReceiptPdf = async ({
    filePaths,
    purchaseDate,
    vendorName,
    amountAed,
    cardholderName,
}) => {
    const pdfDoc = await PDFDocument.create();

    for (const filePath of filePaths) {
        const fileBytes = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();

        if (ext === ".pdf") {
            const sourcePdf = await PDFDocument.load(fileBytes);
            const copiedPages = await pdfDoc.copyPages(
                sourcePdf,
                sourcePdf.getPageIndices()
            );
            copiedPages.forEach((page) => pdfDoc.addPage(page));
        }
        else if (ext === ".jpg" || ext === ".jpeg" || ext === ".png") {
            const image = ext === ".png" ? await pdfDoc.embedPng(fileBytes) : await pdfDoc.embedJpg(fileBytes);
            const page = pdfDoc.addPage([image.width, image.height]);
            page.drawImage(image , {
                x: 0,
                y: 0,
                width: image.width,
                height: image.height,
            });
        }
        else {
            throw new Error(`Unsupported file type: $(ext)`);
        } 
    }
    const formattedDate = formatDateForFilename(purchaseDate);
    const safeVendor = sanitizeFilenamePart(vendorName);
    const formattedAmount = Number(amountAed).toFixed(2);
    const safeCardHolder = sanitizeFilenamePart(cardholderName);

    const filename = `${formattedDate}_${safeVendor}_${safeAmount}AED_${safeCardHolder}.pdf`;
    const outputPath = getUniqueFilePath(path.join(uploadDir, filename));

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);

    return {
        filename: path.basename(outputPath),
        filePath: outputPath,
    }
}

module.exports = {
    generateCombinedReceiptPdf,
}
