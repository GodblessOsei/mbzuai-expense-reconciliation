import { useState } from "react";
import apiClient from "../../api/client";
import ReceiptUpload from "../../components/ReceiptUpload";
import SubmissionForm from "../../components/SubmissionForm";
import Confirmation from "../../components/Confirmation";

export default function RlaDashboard() {
  const [extractedData, setExtractedData] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [confirmation, setConfirmation] = useState(null);

  // after upload, run OCR on the uploaded file's path
  const handleUploaded = async (files) => {
    setUploadedFiles(files);
    try {
      const res = await apiClient.post("/ocr/extract", {
        filePath: files[0].file_path, // send the path of the first file
      });
      setExtractedData(res.data.fields);
    } catch (err) {
      console.error("OCR failed:", err.message);
    }
  };

  return (
    <div>
      <h1>RLA Dashboard</h1>
      <ReceiptUpload onUploaded={handleUploaded} />
      {confirmation ? (
        <Confirmation
          confirmation={confirmation}
          onNewSubmission={() => {
            setConfirmation(null);
            setExtractedData(null);
          }}
        />
      ) : (
        extractedData && (
          <SubmissionForm
            extractedData={extractedData}
            uploadedFiles={uploadedFiles}
            onSubmitted={setConfirmation}
          />
        )
      )}
    </div>
  );
}
