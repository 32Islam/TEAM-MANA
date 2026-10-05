import React, { useRef, useState, useEffect } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Check,
  RotateCcw,
  Trash2,
  Sparkles,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { VirtuocityLogo } from './VirtuocityLogo';

interface LogoUploadSlotProps {
  currentLogoUrl?: string;
  onLogoChange: (newUrl: string) => void;
  className?: string;
  compact?: boolean;
}

export const LogoUploadSlot: React.FC<LogoUploadSlotProps> = ({
  currentLogoUrl,
  onLogoChange,
  className = '',
  compact = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [imageMeta, setImageMeta] = useState<{ width?: number; height?: number; name?: string; size?: string } | null>(null);

  // Measure current image when URL changes
  useEffect(() => {
    if (!currentLogoUrl) {
      setImageMeta(null);
      return;
    }
    const img = new Image();
    img.src = currentLogoUrl;
    img.onload = () => {
      setImageMeta((prev) => ({
        ...prev,
        width: img.naturalWidth,
        height: img.naturalHeight,
      }));
    };
  }, [currentLogoUrl]);

  const processFile = async (file: File) => {
    if (!file) return;

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      setUploadStatus('error');
      setStatusMessage('Please select a valid PNG or image file (.png, .webp, .jpg, .svg)');
      return;
    }

    setUploadStatus('uploading');
    setStatusMessage('Processing PNG file...');

    const reader = new FileReader();
    reader.onerror = () => {
      setUploadStatus('error');
      setStatusMessage('Failed to read file from disk');
    };

    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        setUploadStatus('error');
        setStatusMessage('Error parsing image data');
        return;
      }

      // Calculate file size string
      const sizeKb = (file.size / 1024).toFixed(1);
      const sizeStr = file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : `${sizeKb} KB`;

      setImageMeta({
        name: file.name,
        size: sizeStr,
      });

      // 1. Immediately apply to client state for instant preview
      onLogoChange(dataUrl);

      // 2. Upload to server to persist in /public/uploaded-logo.png and tournament_state.json
      try {
        const response = await fetch('/api/tournament/upload-logo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataUrl,
            fileName: file.name,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.logoUrl) {
            onLogoChange(result.logoUrl);
          }
          setUploadStatus('success');
          setStatusMessage(`PNG logo "${file.name}" uploaded successfully! Active on all screens & OBS.`);
          setTimeout(() => {
            setUploadStatus('idle');
            setStatusMessage('');
          }, 4500);
        } else {
          // Still functional via dataUrl locally
          setUploadStatus('success');
          setStatusMessage(`PNG logo "${file.name}" loaded locally (${sizeStr}).`);
          setTimeout(() => {
            setUploadStatus('idle');
            setStatusMessage('');
          }, 4500);
        }
      } catch (err) {
        console.warn('Could not persist logo to server, keeping local dataUrl:', err);
        setUploadStatus('success');
        setStatusMessage(`PNG logo loaded locally (${sizeStr}).`);
        setTimeout(() => {
          setUploadStatus('idle');
          setStatusMessage('');
        }, 4500);
      }
    };

    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleResetDefault = async () => {
    try {
      await fetch('/api/tournament/reset-logo', { method: 'POST' });
    } catch {}
    onLogoChange('/virtuocity-logo.svg');
    setImageMeta(null);
    setUploadStatus('success');
    setStatusMessage('Reset to default Virtuocity Battleground emblem.');
    setTimeout(() => {
      setUploadStatus('idle');
      setStatusMessage('');
    }, 3000);
  };

  const isCustomLogo =
    currentLogoUrl &&
    currentLogoUrl !== '/virtuocity-logo.svg' &&
    !currentLogoUrl.includes('virtuocity-logo.svg');

  if (compact) {
    return (
      <div className={`space-y-2 ${className}`}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
        />
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-3 transition-all flex items-center gap-3 ${
            isDragging
              ? 'border-[#1a83c5] bg-[#1a83c512] scale-[1.01]'
              : 'border-[#2d3a54] bg-[#090f1d] hover:border-[#1a83c588] hover:bg-[#0d1629]'
          }`}
        >
          <div className="w-12 h-12 rounded-lg bg-[#050b14] border border-slate-800 flex items-center justify-center flex-shrink-0 overflow-hidden relative">
            <VirtuocityLogo size="sm" customUrl={currentLogoUrl} glow={false} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              <span>{isCustomLogo ? 'Change PNG Logo' : 'Upload PNG Logo'}</span>
            </div>
            <p className="text-[11px] text-gray-400 truncate">
              Drag & drop or click to upload PNG
            </p>
          </div>
          <button
            type="button"
            className="px-2.5 py-1 text-xs font-bold   rounded bg-sky-500 hover:bg-[#2ba5ec] text-black transition-colors flex-shrink-0"
          >
            Browse
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3.5 ${className}`}>
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
      />

      {/* Main Drag & Drop Slot Card */}
      <div
        id="png-logo-upload-dropzone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`group relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 overflow-hidden ${
          isDragging
            ? 'border-[#1a83c5] bg-[#1a83c5]/10 shadow-[0_0_25px_rgba(26, 131, 197,0.2)] scale-[1.01]'
            : 'border-[#1E293B] bg-[#0B0E14] hover:border-[#1a83c5]/50 hover:bg-[#121824]'
        }`}
      >
        {/* Subtle Esports Background Grid */}
        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#00E5FF_1px,transparent_1px),linear-gradient(to_bottom,#00E5FF_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

        <div className="relative z-10 p-5 sm:p-6 flex flex-col items-center text-center">
          {/* Active Preview Slot (with transparency checkerboard background) */}
          <div className="relative mb-4 group/preview">
            <div
              className="relative w-48 sm:w-64 h-24 sm:h-28 rounded-xl border border-[#1a83c5]/30 p-3 flex items-center justify-center shadow-lg transition-transform group-hover:scale-105"
              style={{
                backgroundImage:
                  'linear-gradient(45deg, #0B0E14 25%, #121824 25%, #121824 50%, #0B0E14 50%, #0B0E14 75%, #121824 75%, #121824 100%)',
                backgroundSize: '16px 16px',
              }}
            >
              <VirtuocityLogo size="lg" customUrl={currentLogoUrl} glow={true} />
            </div>

            {/* Status indicator badge */}
            <span
              className={`absolute -top-2 -right-2 px-2.5 py-0.5 rounded-lg text-[10px] font-bold font-rajdhani uppercase tracking-wider border shadow-md flex items-center gap-1 ${
                isCustomLogo
                  ? 'bg-[#00FF66]/15 text-[#00FF66] border-[#00FF66]/30'
                  : 'bg-[#1a83c5]/15 text-[#1a83c5] border-[#1a83c5]/30'
              }`}
            >
              <Sparkles className="w-2.5 h-2.5" />
              {isCustomLogo ? 'Custom PNG Active' : 'Default Emblem'}
            </span>
          </div>

          {/* Slot Instructions & Typography */}
          <div className="space-y-1.5 max-w-md">
            <div className="flex items-center justify-center gap-2">
              <Upload className="w-5 h-5 text-[#1a83c5] animate-bounce" />
              <h4 className="text-base sm:text-lg font-bold font-rajdhani uppercase tracking-wider text-white">
                {isDragging ? 'Drop Your PNG Here Now' : 'PNG Tournament Logo Slot'}
              </h4>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 font-sans">
              <span className="text-[#1a83c5] font-bold underline">Click here to browse</span> or drag and drop your PNG file directly into this slot.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 font-mono">
              <span className="px-2.5 py-0.5 rounded-lg bg-[#121824] border border-[#1E293B] text-[11px] text-slate-300">
                Format: .PNG (Transparent recommended), .WEBP, .SVG, .JPG
              </span>
              {imageMeta?.width && imageMeta?.height && (
                <span className="px-2.5 py-0.5 rounded-lg bg-[#1a83c5]/15 border border-[#1a83c5]/30 text-[11px] text-[#1a83c5]">
                  {imageMeta.width} &times; {imageMeta.height} px
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Hover Highlight Border Glow */}
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-[#1a83c5] to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Upload Feedback Banner */}
      {statusMessage && (
        <div
          className={`px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 border font-medium transition-all ${
            uploadStatus === 'error'
              ? 'bg-[#FF5200]/15 border-[#FF5200]/30 text-[#FF5200]'
              : uploadStatus === 'uploading'
              ? 'bg-[#1a83c5]/15 border-[#1a83c5]/30 text-[#1a83c5]'
              : 'bg-[#00FF66]/15 border-[#00FF66]/30 text-[#00FF66]'
          }`}
        >
          {uploadStatus === 'error' ? (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          ) : uploadStatus === 'uploading' ? (
            <div className="w-4 h-4 rounded-full border-2 border-[#1a83c5] border-t-transparent animate-spin flex-shrink-0" />
          ) : (
            <Check className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="flex-1 font-mono">{statusMessage}</span>
        </div>
      )}

      {/* Control Buttons & Actions Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-[#1a83c5] hover:brightness-110 text-black font-extrabold text-xs font-rajdhani uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-[#1a83c5]/20 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload New PNG
          </button>

          {isCustomLogo && (
            <button
              type="button"
              onClick={handleResetDefault}
              className="px-3.5 py-2 bg-[#121824] hover:bg-[#1E293B] text-slate-300 hover:text-white font-bold text-xs font-rajdhani uppercase tracking-wider rounded-xl transition-all border border-[#1E293B] flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#FFB800]" />
              Reset to Default Emblem
            </button>
          )}
        </div>

        <div className="text-[11px] text-slate-500 font-mono">
          Auto-syncs live to Between-Games Stage &amp; OBS overlays
        </div>
      </div>
    </div>
  );
};
