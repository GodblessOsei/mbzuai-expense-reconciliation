import { useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import Layout from "../../components/Layout";
import Button from "../../components/Button";
import ReceiptUpload from "../../components/ReceiptUpload";
import SubmissionForm from "../../components/SubmissionForm";
import Confirmation from "../../components/Confirmation";

const STEPS = ["upload", "ocr", "review", "done"];
const STEP_LABELS = {
  upload: "Upload",
  ocr: "Extract",
  review: "Review",
  done: "Done",
};

export default function SubmissionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState("upload");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [extractedData, setExtractedData] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [managerFlags, setManagerFlags] = useState([]); // { type, blocking } objects
  const [reviewNotices, setReviewNotices] = useState([]); // soft strings

  // No "choose a cardholder first" gate any more. Identity comes from signing
  // in, and which card was used is asked inside the form as a detail of the
  // purchase.

  const handleUploaded = async (files, mode) => {
    setUploadedFiles(files);
    setStep("ocr");
    try {
      const res = await apiClient.post("/ocr/extract", {
        filePaths: files.map((file) => file.file_path),
        mode,
      });
      setExtractedData(res.data.consolidatedFields);
      setManagerFlags(res.data.managerFlags || []);
      setReviewNotices(res.data.reviewNotices || []);
      setStep("review");
    } catch (err) {
      console.error("OCR failed:", err.message);
      setExtractedData({});
      setManagerFlags([]);
      setReviewNotices([]);
      setStep("review");
    }
  };

  const handleSubmitted = (conf) => {
    setConfirmation(conf);
    setStep("done");
  };

  const currentIndex = STEPS.indexOf(step);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <p className="text-mbzuai-gold font-medium tracking-wide uppercase text-sm">
          New Submission
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-mbzuai-navy">
          {user.fullName}
        </h1>

        {/* Step indicator. Four numbers plus four labels plus three dashes is
            wider than a phone, so on small screens only the CURRENT step keeps
            its label — the others shrink to their numbered circle, which is
            enough to show how far along you are. */}
        <div className="mt-6 flex items-center gap-1.5 sm:gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1.5 sm:gap-2">
              <div
                className={`flex shrink-0 items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${
                  i <= currentIndex
                    ? "bg-mbzuai-navy text-white"
                    : "bg-mbzuai-navy/10 text-mbzuai-navy/40"
                }`}
              >
                {i + 1}
              </div>
              <span
                className={`text-sm whitespace-nowrap ${
                  i === currentIndex ? "inline" : "hidden sm:inline"
                } ${
                  i <= currentIndex ? "text-mbzuai-navy" : "text-mbzuai-navy/40"
                }`}
              >
                {STEP_LABELS[s]}
              </span>
              {i < STEPS.length - 1 && (
                <span className="text-mbzuai-navy/20">—</span>
              )}
            </div>
          ))}
        </div>

        {/* the step content, in a card */}
        <div className="mt-6 bg-white rounded-2xl border border-mbzuai-navy/10 p-5 sm:p-8">
          {step === "upload" && <ReceiptUpload onUploaded={handleUploaded} />}

          {step === "ocr" && (
            <div className="py-10 text-center">
              <div className="inline-block w-8 h-8 border-4 border-mbzuai-navy/20 border-t-mbzuai-navy rounded-full animate-spin" />
              <p className="mt-4 font-medium text-mbzuai-navy">
                Reading your document…
              </p>
              <p className="text-sm text-mbzuai-navy/60">
                Extracting receipt details.
              </p>
            </div>
          )}

          {step === "review" && (
            <SubmissionForm
              extractedData={extractedData}
              uploadedFiles={uploadedFiles}
              managerFlags={managerFlags}
              reviewNotices={reviewNotices}
              onSubmitted={handleSubmitted}
              onBack={() => setStep("upload")}
            />
          )}

          {step === "done" && (
            <Confirmation
              confirmation={confirmation}
              onHome={() => navigate("/rla/dashboard")}
              onNewSubmission={() => {
                setStep("upload");
                setUploadedFiles([]);
                setExtractedData(null);
                setConfirmation(null);
                setManagerFlags([]);
                setReviewNotices([]);
              }}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}
