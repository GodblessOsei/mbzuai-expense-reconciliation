const { extractReceiptData } = require("../services/ocrService");

const extractReceipt = async (req, res) => {
    try {
        const { filePath } = req.body;

        if (!filePath){
            return res.status(400).json({
                success: false,
                message: "filePath is required",
            });
        }
        const fields = await extractReceiptData(filePath);
        res.status(200).json({
            success: true,
            fields,
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