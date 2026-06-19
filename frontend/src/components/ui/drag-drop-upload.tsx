import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Upload, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DragDropUploadProps {
  onFileUpload: (file: File) => void;
  uploadedFile?: File | null;
  isParsing?: boolean;
  parseError?: string | null;
  parsedContent?: string | null;
  disabled?: boolean;
  accept?: string;
  className?: string;
  title?: string;
  description?: string;
}

export const DragDropUpload = ({
  onFileUpload,
  uploadedFile,
  isParsing = false,
  parseError = null,
  parsedContent = null,
  disabled = false,
  accept = ".pdf",
  className,
  title = "Click to upload PDF",
  description = "Notes, textbook chapters, or assignments"
}: DragDropUploadProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setIsDragActive(true);
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Use drag counter instead of contains check
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);
    setIsDragActive(false);

    if (disabled || isParsing) {
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      if (accept === ".pdf" && file.type === "application/pdf") {
        onFileUpload(file);
      } else if (accept !== ".pdf") {
        onFileUpload(file);
      } else {
      }
    } else {
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const handleClick = () => {
    if (!disabled && !isParsing && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const getStatusIcon = () => {
    if (isParsing) {
      return <div className="w-4 h-4 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />;
    }
    if (parsedContent) {
      return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    }
    if (parseError) {
      return <AlertCircle className="w-5 h-5 text-red-600" />;
    }
    if (uploadedFile) {
      return <FileText className="w-5 h-5 text-yellow-600" />;
    }
    return <Upload className="w-5 h-5 text-indigo-600" />;
  };

  const getStatusColor = () => {
    if (isParsing) return 'bg-blue-100';
    if (parsedContent) return 'bg-green-100';
    if (parseError) return 'bg-red-100';
    if (uploadedFile) return 'bg-yellow-100';
    return 'bg-indigo-100';
  };

  const getStatusText = () => {
    if (isParsing) return 'Processing...';
    if (parsedContent) return 'Ready for study plan';
    if (parseError) return 'Processing failed - click to try again';
    if (uploadedFile) return 'Click to change file';
    return description;
  };

  const getTextColor = () => {
    if (isParsing) return 'text-blue-700';
    if (parsedContent) return 'text-green-700';
    if (parseError) return 'text-red-700';
    if (uploadedFile) return 'text-yellow-700';
    return 'text-gray-800';
  };

  return (
    <div
      className={cn(
        "relative border-2 border-dashed rounded-lg p-4 text-center transition-all duration-300 cursor-pointer",
        "bg-gradient-to-br from-indigo-50/30 to-purple-50/30",
        isDragOver
          ? "border-indigo-400 bg-indigo-50/60 shadow-lg ring-2 ring-indigo-200 scale-[1.02]"
          : "border-indigo-200 hover:from-indigo-50/50 hover:to-purple-50/50 hover:border-indigo-300",
        (disabled || isParsing) && "pointer-events-none opacity-50",
        className
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isParsing}
      />
      
      <div className="flex flex-col items-center gap-2">
        {uploadedFile ? (
          <>
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", getStatusColor())}>
              {getStatusIcon()}
            </div>
            <div>
              <span className={cn("text-sm font-medium", getTextColor())}>
                {uploadedFile.name}
              </span>
              <p className="text-xs text-gray-500 mt-1">
                {getStatusText()}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
              isDragOver ? "bg-indigo-200 scale-110" : "bg-indigo-100"
            )}>
              <Upload className={cn(
                "w-5 h-5 transition-all duration-300",
                isDragOver ? "text-indigo-700" : "text-indigo-600"
              )} />
            </div>
            <div>
              <span className={cn(
                "text-sm font-medium transition-colors duration-300",
                isDragOver ? "text-indigo-700" : "text-gray-800"
              )}>
                {isDragOver ? "Drop file here" : title}
              </span>
              <p className={cn(
                "text-xs mt-1 transition-colors duration-300",
                isDragOver ? "text-indigo-600" : "text-gray-500"
              )}>
                {isDragOver ? "Release to upload" : description}
              </p>
            </div>
          </>
        )}
      </div>

      {isDragOver && (
        <>
          <div className="absolute inset-0 bg-indigo-400/10 rounded-lg animate-pulse pointer-events-none" />
          <div className="absolute inset-0 border-2 border-indigo-400 rounded-lg animate-pulse pointer-events-none" />
        </>
      )}

      {/* Floating drop indicator */}
      {isDragOver && (
        <div className="absolute -top-2 -right-2 bg-indigo-500 text-white text-xs px-2 py-1 rounded-full animate-bounce shadow-lg">
          Drop here!
        </div>
      )}
    </div>
  );
};