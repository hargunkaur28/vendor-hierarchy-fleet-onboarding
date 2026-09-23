import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, X, Eye } from 'lucide-react';
import type { DocType } from '@/types';
import { MAX_FILE_SIZE, ACCEPTED_FILE_TYPES } from '@/config/constants';
import { toast } from 'sonner';

interface DocumentUploaderProps {
  docType: DocType;
  label?: string;
  initialExpiry?: string;
  initialFileName?: string;
  onUploadSuccess: (data: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    expiryDate: string;
  }) => void;
  /** Fires when the expiry date is changed on an existing document (no new file attached) */
  onExpiryChange?: (expiryDate: string) => void;
  disabled?: boolean;
}

const DEFAULT_DOC_LABELS: Record<DocType, string> = {
  RC: 'RC Certificate',
  PERMIT: 'Commercial Permit',
  PUC: 'PUC Certificate',
  INSURANCE: 'Vehicle Insurance',
  DL: 'Driving License',
};

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  docType,
  label,
  initialExpiry = '',
  initialFileName = '',
  onUploadSuccess,
  onExpiryChange,
  disabled = false,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState<string>(initialExpiry);
  const [progress, setProgress] = useState<number>(initialFileName ? 100 : 0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndProcessFile = (selectedFile: File) => {
    setError(null);

    // Type validation
    if (!ACCEPTED_FILE_TYPES.includes(selectedFile.type as (typeof ACCEPTED_FILE_TYPES)[number])) {
      const err = `Invalid file type "${selectedFile.type || 'unknown'}". Only PDF, JPEG, and PNG are allowed.`;
      setError(err);
      toast.error(err);
      return;
    }

    // Size validation
    if (selectedFile.size > MAX_FILE_SIZE) {
      const sizeMb = (selectedFile.size / (1024 * 1024)).toFixed(1);
      const err = `File size (${sizeMb} MB) exceeds maximum allowed size of 5 MB.`;
      setError(err);
      toast.error(err);
      return;
    }

    // Expiry date validation
    if (!expiryDate) {
      setError('Please select document expiry date.');
      toast.error('Please specify document expiry date before uploading.');
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (expiryDate < todayStr) {
      const err = 'Expiry date cannot be in the past for a new document upload.';
      setError(err);
      toast.error(err);
      return;
    }

    setFile(selectedFile);

    // Generate preview for images
    if (selectedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }

    // Simulate upload progress
    setIsUploading(true);
    setProgress(15);
    const timer1 = setTimeout(() => setProgress(65), 150);
    const timer2 = setTimeout(() => {
      setProgress(100);
      setIsUploading(false);
      onUploadSuccess({
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type,
        expiryDate,
      });
      toast.success(`${docType} document prepared for submission.`);
    }, 350);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      validateAndProcessFile(selected);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      validateAndProcessFile(dropped);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreviewUrl(null);
    setProgress(0);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
      {/* Header with Type label and Expiry Input */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-800 tracking-tight truncate">
              {label || DEFAULT_DOC_LABELS[docType] || docType}
            </h4>
            <p className="text-[10px] text-slate-400">PDF, JPG or PNG (max 5 MB)</p>
          </div>
        </div>

        {/* Expiry Date input */}
        <div className="flex items-center gap-1.5">
          <label htmlFor={`expiry-${docType}`} className="text-[11px] font-medium text-slate-600 whitespace-nowrap">
            Expiry Date <span className="text-rose-500">*</span>:
          </label>
          <input
            id={`expiry-${docType}`}
            type="date"
            value={expiryDate}
            onChange={(e) => {
              const newDate = e.target.value;
              setExpiryDate(newDate);
              setError(null);
              // Notify parent of expiry change for existing documents
              if (onExpiryChange && initialFileName && newDate) {
                onExpiryChange(newDate);
              }
            }}
            disabled={disabled || isUploading}
            className="flex-1 min-w-0 px-2 py-1 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-indigo-500 text-slate-800 font-medium"
            required
          />
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-1.5 text-xs text-rose-700">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
          <p className="leading-tight">{error}</p>
        </div>
      )}

      {/* Upload Dropzone or Attached State */}
      {file || initialFileName ? (
        <div className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg">
          <div className="flex items-center gap-2.5 min-w-0">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Document preview"
                className="w-10 h-10 object-cover rounded-md border border-slate-200"
              />
            ) : (
              <div className="w-10 h-10 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">
                {file?.name || initialFileName}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {file && (
                  <span className="text-[10px] text-slate-400">
                    {(file.size / 1024).toFixed(0)} KB
                  </span>
                )}
                {progress === 100 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Attached</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-50"
                title="View preview"
                aria-label="View document preview"
              >
                <Eye className="w-4 h-4" />
              </a>
            )}
            {!disabled && (
              <button
                type="button"
                onClick={handleReset}
                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-50 cursor-pointer"
                title="Remove file"
                aria-label="Remove document"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-indigo-500 bg-indigo-50/50'
              : 'border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50/50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          aria-label={`Upload ${docType} document`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES.join(',')}
            onChange={handleFileChange}
            className="hidden"
            disabled={disabled}
          />
          <UploadCloud className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
          <p className="text-xs font-semibold text-slate-700">
            Click to upload or drag & drop {docType}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Requires valid expiry date before attaching
          </p>
        </div>
      )}

      {/* Upload Progress Bar */}
      {isUploading && (
        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-indigo-600 h-full transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};
