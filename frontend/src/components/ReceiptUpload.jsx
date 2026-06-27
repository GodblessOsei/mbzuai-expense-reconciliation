import { useState } from "react";
import apiClient from "../api/client";

export default function ReceiptUpload({ onUploaded }) {
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState("");

  const handleUpload = async () => {
    if (files.length === 0) return;

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    try {
      setStatus("Uploading...");
      const res = await apiClient.post("/uploads", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setStatus(`Uploaded ${res.data.files.length} file(s).`);
      setFiles([]);
      if (onUploaded) onUploaded(res.data.files); // hand files up to parent
    } catch (err) {
      setStatus(
        "Upload failed: " + (err.response?.data?.message || err.message)
      );
    }
  };

  return (
    <div>
      <h2>Upload Receipt</h2>
      <input
        type="file"
        multiple
        accept="image/jpeg,image/png,application/pdf"
        onChange={(e) => setFiles(Array.from(e.target.files))}
      />
      <ul>
        {files.map((f, i) => (
          <li key={i}>{f.name}</li>
        ))}
      </ul>
      <button onClick={handleUpload} disabled={files.length === 0}>
        Upload
      </button>
      <p>{status}</p>
    </div>
  );
}
