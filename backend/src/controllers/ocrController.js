const { extractReceiptData } = require("../services/ocrService");

const extractReceipt = async (req, res) => {
    try {
        const { filePaths } = req.body;

        if (!filePaths){
            return res.status(400).json({
                success: false,
                message: "filePaths is required",
            });
        }

        const allExtractedFields = []
        for (let filePath of filePaths){
            const fields = await extractReceiptData(filePath);
            allExtractedFields.push(fields);
        }

        const consolidatedFields = {
            vendorName: allExtractedFields[0].vendorName,
            purchaseDate: allExtractedFields[0].purchaseDate,
            amountAed: 0,
            currency: allExtractedFields[0].currency,
            invoiceNumber: [],
            cardLastFour: allExtractedFields[0].cardLastFour,
        };
        const flags = [];
        const reviewFlags = [];

        if (filePaths.length > 1){
            reviewFlags.push("Submission includes multiple files");
        }
        const compareField = (fields, fieldName, errorMessage) => {
            if (consolidatedFields[fileName] !== "" && consolidatedFields[fieldName] !== fields[fieldName]){
                consolidatedFields[fileName] = "";
                if (!flags.includes(errorMessage)) {
                    flags.push(errorMessage);
                }
            }
        }

        for (let fields of allExtractedFields) {
            compareField(fields, "vendorName", "Vendor names do not match");
            compareField(fields, "purchaseDate", "Purchase dates do not match");
            compareField(fields, "currency", "Currencies do not match");
            compareField(fields, "cardLastFour", "Card numbers do not match");
            
            consolidatedFields.amountAed += Number(fields.amountAed || 0);

            if (fields.invoiceNumber) {
                consolidatedFields.invoiceNumber.push(fields.invoiceNumber)
            }
        }
        consolidatedFields.amountAed = consolidatedFields.amountAed.toString();

        res.status(200).json({
            success: true,
            consolidatedFields,
            flags,
            reviewFlags,
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            success: false,
            message: "Failed ro extract receipt data"
        });
    }
}
module.exports = {
    extractReceipt,
};