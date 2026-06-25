const fs = require("fs");
const {
  AzureKeyCredential,
  DocumentAnalysisClient,
} = require("@azure/ai-form-recognizer");
const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
const apiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;


const client = new DocumentAnalysisClient(
    endpoint,
    new AzureKeyCredential(apiKey)
);

const extractReceiptData = async (filePath) => {
    const fileStream = fs.createReadStream(filePath);

    const poller = await client.beginAnalyzeDocument(
        "prebuilt-receipt",
        fileStream
    );

    const result = await poller.pollUntilDone();
    console.log(result.documents?.[0]?.fields);

    return result.documents?.[0]?.fields
}

module.exports = {
    extractReceiptData,
};