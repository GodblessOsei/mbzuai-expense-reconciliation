import { useState, useRef } from "react";
import apiClient from "../api/client";
import Button from "./Button";

// The camera shortcut is for phones only. A laptop webcam photographs a receipt
// badly — soft focus, glare, low effective resolution — and a bad image doesn't
// fail cleanly, it produces plausible-looking wrong numbers out of the OCR.
// On a laptop the file picker is the right (and only) path.
const IS_MOBILE = (() => {
  if (navigator.userAgentData) return navigator.userAgentData.mobile === true;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as "Macintosh", so touch points are the tell.
  const isIpad = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return /Android|iPhone|iPad|iPod/i.test(ua) || isIpad;
})();

export default function ReceiptUpload({ onUploaded }) {
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState("");
  const [previewFile, setPreviewFile] = useState(null);
  const [mode, setMode] = useState("separate_receipts"); // used for 2+ files
  const inputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const isMultiple = files.length >= 2;

  const handleUpload = async () => {
    if (files.length === 0) return;
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    try {
      setStatus("Uploading…");
      const res = await apiClient.post("/uploads", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setStatus("");
      // pass BOTH the saved files and the chosen mode up.
      // single file -> mode is irrelevant, the ocrService ignores it.
      if (onUploaded) onUploaded(res.data.files, isMultiple ? mode : undefined);
    } catch (err) {
      setStatus(
        "Upload failed: " + (err.response?.data?.message || err.message)
      );
    }
  };

  // Shared by the file picker and the camera: append only what isn't already
  // in the list. iOS names every camera capture "image.jpeg", so the size in
  // the key is what keeps two separate shots from looking like a duplicate.
  const addFiles = (incoming) => {
    setFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const newFiles = incoming.filter(
        (f) => !existingKeys.has(`${f.name}-${f.size}`)
      );
      return [...prev, ...newFiles];
    });
  };

  const handleRemove = (indexToRemove) => {
    setFiles((prev) => {
      const next = prev.filter((_, i) => i !== indexToRemove);
      if (next.length === 0 && inputRef.current) inputRef.current.value = "";
      return next;
    });
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-mbzuai-navy">Upload Receipt</h2>
      <p className="mt-1 text-sm text-mbzuai-navy/60">
        Upload a photo or PDF of your receipt. JPEG, PNG, or PDF.
      </p>

      {/* dashed drop zone (styled label wrapping the file input) */}
      <label className="mt-4 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-mbzuai-navy/20 rounded-2xl py-10 px-6 cursor-pointer hover:border-mbzuai-gold hover:bg-mbzuai-sand/30 transition-colors">
        <span className="text-mbzuai-navy/70 text-sm">
          {files.length > 0
            ? `${files.length} file(s) selected`
            : "Click to choose files"}
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,application/pdf"
          onChange={(e) => {
            addFiles(Array.from(e.target.files));
            e.target.value = "";
          }}
          className="hidden"
        />
      </label>

      {/* Camera shortcut, phones only. `capture` hands off to the device's own
          camera app — no in-page preview to build or permission to negotiate,
          and the RLA gets the focus/flash/HDR controls they already know.
          It lands in the same `files` list as anything picked off disk. */}
      {IS_MOBILE && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            aria-label="Take a picture of the receipt"
            title="Take a picture"
            onClick={() => cameraInputRef.current?.click()}
            /* No border or background — but the box stays 44px so the tap
               target survives losing the circle. */
            className="inline-flex items-center justify-center h-11 w-11 text-mbzuai-navy/50 hover:text-mbzuai-navy transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7"
              aria-hidden="true"
            >
              <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2a1 1 0 0 0 .84-.45l.92-1.4A1 1 0 0 1 9.3 4.7h5.4a1 1 0 0 1 .84.45l.92 1.4a1 1 0 0 0 .84.45h2.2A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />
              <circle cx="12" cy="13" r="3.4" />
            </svg>
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              addFiles(Array.from(e.target.files));
              e.target.value = "";
            }}
          />
        </div>
      )}

      {files.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-mbzuai-navy/70">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 py-1">
              <span className="truncate min-w-0 flex-1">• {f.name}</span>
              <div className="flex shrink-0 gap-3 ml-2">
                <button
                  type="button"
                  onClick={() => setPreviewFile(f)}
                  className="text-sm text-mbzuai-gold underline"
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(i)}
                  className="text-sm text-red-500 underline"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* MODE QUESTION — only when 2+ files */}
      {isMultiple && (
        <div className="mt-5 rounded-xl border border-mbzuai-navy/15 bg-mbzuai-sand/30 p-4">
          <p className="text-sm font-medium text-mbzuai-navy">
            You added {files.length} files. What are they?
          </p>
          <div className="mt-3 space-y-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="single_order"
                checked={mode === "single_order"}
                onChange={(e) => setMode(e.target.value)}
                className="mt-1 accent-mbzuai-navy"
              />
              <span className="text-sm text-mbzuai-navy/80">
                <span className="font-medium">Pages of one order</span> — e.g.
                screenshots or pages of a single receipt/order. (The total won't
                be added up.)
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="separate_receipts"
                checked={mode === "separate_receipts"}
                onChange={(e) => setMode(e.target.value)}
                className="mt-1 accent-mbzuai-navy"
              />
              <span className="text-sm text-mbzuai-navy/80">
                <span className="font-medium">Separate receipts</span> —
                different receipts for this one transaction (e.g. several
                sellers). (Totals will be added up.)
              </span>
            </label>
          </div>
        </div>
      )}
      <div className="mt-5">
        <Button onClick={handleUpload} disabled={files.length === 0}>
          Upload &amp; Continue
        </Button>
      </div>
      {status && <p className="mt-2 text-sm text-mbzuai-navy/60">{status}</p>}

      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-3xl shadow-2xl p-4 w-[90vw] max-w-3xl max-h-[90vh]">
            <div className="flex justify-between items-center mb-3">
              <p className="font-medium text-mbzuai-navy">{previewFile.name}</p>

              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="text-sm text-mbzuai-navy/60 hover:text-mbzuai-navy"
              >
                Close
              </button>
            </div>

            {previewFile.type.startsWith("image/") ? (
              <img
                src={URL.createObjectURL(previewFile)}
                alt={previewFile.name}
                className="max-h-[75vh] w-full object-contain rounded-lg"
              />
            ) : previewFile.type === "application/pdf" ? (
              <iframe
                src={URL.createObjectURL(previewFile)}
                title={previewFile.name}
                className="w-full h-[75vh] rounded-lg border"
              />
            ) : (
              <p className="text-sm text-mbzuai-navy/60">
                Preview is not available for this file type.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
