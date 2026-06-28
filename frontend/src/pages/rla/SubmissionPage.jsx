import { useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import ReceiptUpload from "../../components/ReceiptUpload";
import SubmissionForm from "../../components/SubmissionForm";
import Confirmation from "../../components/Confirmation";

export default function SubmissionPage() {
  const { cardholder } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState("upload"); // upload | ocr | review | done
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [extractedData, setExtractedData] = useState(null);
  const [confirmation, setConfirmation] = useState(null);

  // guard: must have a cardholder
  if (!cardholder) {
    return (
      <div>
        <p>No cardholder selected.</p>
        <button onClick={() => navigate("/rla")}>Choose cardholder</button>
      </div>
    );
  }

  // 1 -> 2 after upload, run OCR
  const handleUploaded = async (files) => {
    setUploadedFiles(files);
    setStep("ocr"); // show processing screen
    try {
      const res = await apiClient.post("/ocr/extract", {
        filePath: files[0].file_path,
      });
      setExtractedData(res.data.fields);
      setStep("review"); // move to the form
    } catch (err) {
      console.error("OCR failed:", err.message);
      setExtractedData({}); // empty data
      setStep("review"); // proceed for user to fill manually
    }
  };

  // 3 -> 4: after submit, show confirmation
  const handleSubmitted = (conf) => {
    setConfirmation(conf);
    setStep("done");
  };

  return (
    <div>
      <h1>New Submission — {cardholder.cardholder_name}</h1>

      {step === "upload" && <ReceiptUpload onUploaded={handleUploaded} />}

      {step === "ocr" && (
        <div>
          <h2>Reading your document…</h2>
          <p>Extracting receipt details, please wait.</p>
        </div>
      )}

      {step === "review" && (
        <SubmissionForm
          extractedData={extractedData}
          uploadedFiles={uploadedFiles}
          onSubmitted={handleSubmitted}
          onBack={() => setStep("upload")}
        />
      )}

      {step === "done" && (
        <Confirmation
          confirmation={confirmation}
          onNewSubmission={() => {
            // reset everything for another submission
            setStep("upload");
            setUploadedFiles([]);
            setExtractedData(null);
            setConfirmation(null);
          }}
          onHome={() => navigate("/rla/dashboard")}
        />
      )}
    </div>
  );
}
