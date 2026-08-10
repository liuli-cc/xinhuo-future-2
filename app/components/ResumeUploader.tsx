"use client";

import { useState, useRef } from "react";
import { validateResumeFile, ALLOWED_RESUME_EXT, RESUME_MAX_MB } from "../../lib/resume-parser";

interface ResumeUploaderProps {
  onFileSelected: (file: File) => void;
  uploading: boolean;
  progress?: number;
  error?: string;
}

export default function ResumeUploader({ onFileSelected, uploading, progress = 0, error }: ResumeUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const displayError = error || localError;

  const handleFile = (file: File) => {
    setLocalError("");
    const err = validateResumeFile(file.name, file.size, file.type);
    if (err) {
      setLocalError(err);
      return;
    }
    onFileSelected(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Allow selecting the same file again after a failed upload.
    e.target.value = "";
  };

  return (
    <div className={`resume-uploader ${dragOver ? "drag-over" : ""} ${displayError ? "has-error" : ""}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_RESUME_EXT.join(",")}
        onChange={onChange}
        hidden
      />
      <button
        type="button"
        className="upload-zone"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label="选择简历文件"
      >
        {uploading ? (
          <div className="upload-loading">
            <span className="spinner" />
            <p>{progress < 100 ? `正在安全上传简历 ${progress}%` : "正在解析简历..."}</p>
          </div>
        ) : (
          <>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="upload-icon">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <b>上传或拍摄简历</b>
            <span>PDF / Word / TXT / Markdown / JPG / PNG，最大 {RESUME_MAX_MB}MB</span>
            <small>图片与扫描版 PDF 会在当前浏览器内免费 OCR，不上传原图到第三方</small>
          </>
        )}
      </button>
      {displayError && (
        <div className="upload-error">
          <span>{displayError}</span>
        </div>
      )}
    </div>
  );
}
