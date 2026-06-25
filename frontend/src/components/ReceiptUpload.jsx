import { useState } from "react";
import apiClient from "../api/client";

export default function ReceiptUpload() {
  const [files, setFiles] = useState([]); // files the user picked
  const [status, setStatus] = useState(""); // status message
  const [uploadedFiles, setUploadedFiles] = useState([]); // the uploaded receipt_file_id and file_path are here

  const handleUpload = async () => {
    if (files.length === 0) return;

    // FormData is the container for sending files over the network
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file)); // "files" to match backend naming

    try {
      setStatus("Uploading...");
      const res = await apiClient.post("/uploads", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setStatus(`Uploaded ${res.data.files.length} file(s) successfully.`);
      setFiles([]); // clear the picker after success

      setUploadedFiles(res.data.files);
    } catch (err) {
      setStatus(
        "Upload failed: " + (err.response?.data?.message || err.message)
      );
    }
  };

  return (
    <div>
      <h2>Upload Receipts</h2>
      <input
        type="file"
        multiple
        accept="image/jpeg,image/png,application/pdf"
        onChange={(e) => setFiles(Array.from(e.target.files))}
      />
      <ul>
        {files.map((file, i) => (
          <li key={i}>{file.name}</li>
        ))}
      </ul>
      <button onClick={handleUpload} disabled={files.length === 0}>
        Upload
      </button>
      <p>{status}</p>
    </div>
  );
}
