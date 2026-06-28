import { useState } from "react";
import apiClient from "../api/client";
import Button from "./Button";

export default function ReceiptUpload({ onUploaded }) {
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState("");

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
      if (onUploaded) onUploaded(res.data.files);
    } catch (err) {
      setStatus(
        "Upload failed: " + (err.response?.data?.message || err.message)
      );
    }
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
          type="file"
          multiple
          accept="image/jpeg,image/png,application/pdf"
          onChange={(e) => setFiles(Array.from(e.target.files))}
          className="hidden"
        />
      </label>

      {files.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-mbzuai-navy/70">
          {files.map((f, i) => (
            <li key={i} className="truncate">
              • {f.name}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5">
        <Button onClick={handleUpload} disabled={files.length === 0}>
          Upload &amp; Continue
        </Button>
      </div>
      {status && <p className="mt-2 text-sm text-mbzuai-navy/60">{status}</p>}
    </div>
  );
}
