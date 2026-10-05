import React, { useRef } from 'react';
import { Image as ImageIcon, Upload } from 'lucide-react';

interface TournamentLogoSlotProps {
  logoUrl?: string;
  onUploadLogo?: (url: string) => void;
  isInteractive?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  className?: string;
}

/**
 * Designated empty placeholder space at the top of the overlay for an uploaded tournament logo.
 * If a logo URL is provided, displays the logo; otherwise displays the designated placeholder.
 */
export const TournamentLogoSlot: React.FC<TournamentLogoSlotProps> = ({
  logoUrl,
  onUploadLogo,
  isInteractive = false,
  size = 'md',
  className = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadLogo) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const rawData = evt.target?.result as string;
      if (!rawData) return;

      const img = new Image();
      img.onload = () => {
        const maxDim = 600;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (ctx) {
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/png');
          onUploadLogo(compressed);
        } else {
          onUploadLogo(rawData);
        }
      };
      img.onerror = () => {
        onUploadLogo(rawData);
      };
      img.src = rawData;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const dimensions = {
    sm: 'h-10 sm:h-12 max-w-[160px] sm:max-w-[200px]',
    md: 'h-12 sm:h-16 max-w-[220px] sm:max-w-[280px]',
    lg: 'h-16 sm:h-20 max-w-[280px] sm:max-w-[360px]',
    hero: 'h-24 sm:h-28 md:h-36 max-w-[420px] sm:max-w-[540px]',
  }[size];

  // Chamfered clipping style
  const chamferStyle = {
    clipPath: 'polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px)',
  };

  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      {isInteractive && onUploadLogo && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      )}

      {logoUrl ? (
        /* Uploaded Tournament Logo - Clean transparent presentation without background box */
        <div
          onClick={() => isInteractive && fileInputRef.current?.click()}
          className={`relative px-2 py-1 flex items-center justify-center transition-all group ${
            isInteractive ? 'cursor-pointer' : ''
          }`}
        >
          <img
            src={logoUrl}
            alt="Tournament Logo"
            className={`${dimensions} object-contain filter drop-shadow-[0_0_12px_rgba(26, 131, 197,0.4)]`}
            referrerPolicy="no-referrer"
          />
          {isInteractive && (
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center rounded-xl transition-opacity">
              <Upload className="w-5 h-5 text-sky-400 animate-bounce" />
              <span className="text-[10px] font-bold text-white tracking-wider uppercase">Change Logo</span>
            </div>
          )}
        </div>
      ) : (
        /* Designated Empty Placeholder Space for Uploaded Tournament Logo */
        <div
          onClick={() => isInteractive && fileInputRef.current?.click()}
          style={chamferStyle}
          className={`relative w-full ${dimensions} px-4 py-2 flex items-center justify-center gap-2.5 bg-[#0A1535]/60 border border-dashed border-[#1a83c5]/60 hover:border-[#1a83c5] backdrop-blur-sm transition-all ${
            isInteractive ? 'cursor-pointer hover:bg-[#0A1535]/90 group' : ''
          }`}
          title={isInteractive ? 'Click to upload Tournament Logo' : 'Tournament Logo Placeholder'}
        >
          <div className="w-5 h-5 rounded flex items-center justify-center bg-[#1a83c5]/20 text-[#1a83c5] group-hover:text-[#1a83c5]">
            {isInteractive ? <Upload className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
          </div>
          <div className="flex flex-col items-center leading-none">
            <span className="text-[11px] sm:text-xs font-rajdhani font-black uppercase tracking-widest text-[#FFFFFF] drop-shadow-[0_0_4px_rgba(255,255,255,0.4)]">
              TOURNAMENT LOGO
            </span>
            <span className="text-[9px] font-mono text-[#1a83c5]/80 uppercase tracking-tight">
              {isInteractive ? 'Click to Upload' : 'Designated Space'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
