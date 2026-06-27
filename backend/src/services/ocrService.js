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

// converts Azure's date object → "YYYY-MM-DD" string for the form's date input
const formatDate = (dateValue) => {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  if (isNaN(d)) return "";
  return d.toISOString().split("T")[0];
};

// translates Azure's raw fields into the shape our form expects
const mapReceiptFields = (fields) => {
  return {
    vendorName: fields?.MerchantName?.value || "",
    purchaseDate: formatDate(fields?.TransactionDate?.value),
    amountAed:
      fields?.Total?.value != null ? fields.Total.value.toString() : "",
    currency: "AED",
    invoiceNumber: "",
    cardLastFour: "",
    confidence: fields?.Total?.confidence ?? null,
  };
};

const extractReceiptData = async (filePath) => {
  const fileStream = fs.createReadStream(filePath);

  const poller = await client.beginAnalyzeDocument(
    "prebuilt-receipt",
    fileStream
  );

  const result = await poller.pollUntilDone();
  //console.log(result.documents?.[0]?.fields);
  const rawFields = result.documents?.[0]?.fields;
  console.log(rawFields);

  if (!rawFields) {
    return null; // Azure found no receipt data
  }

  return mapReceiptFields(rawFields);
};

module.exports = {
  extractReceiptData,
};
