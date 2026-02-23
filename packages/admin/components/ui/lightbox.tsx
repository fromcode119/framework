"use client";

import React, { useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { FrameworkIcons } from '@/lib/icons';

interface LightboxProps {
  images: string[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
  title?: string;
}

export function Lightbox({ images, currentIndex, isOpen, onClose, onNavigate, title }: LightboxProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handlePrev = useCallback(() => {
    if (images.length <= 1) return;
    onNavigate((currentIndex - 1 + images.length) % images.length);
  }, [currentIndex, images.length, onNavigate]);

  const handleNext = useCallback(() => {
    if (images.length <= 1) return;
    onNavigate((currentIndex + 1) % images.length);
  }, [currentIndex, images.length, onNavigate]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, handlePrev, handleNext]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/98 backdrop-blur-3xl animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-slate-950/40" />

      {/* Close Button */}
      <button 
        className="absolute top-6 right-6 lg:top-10 lg:right-10 h-14 w-14 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all z-[110] border border-white/10 active:scale-90"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        <FrameworkIcons.Close size={28} strokeWidth={2.5} />
      </button>

      {/* Navigation - Left */}
      {images.length > 1 && (
        <button 
          className="absolute left-6 lg:left-12 h-20 w-20 rounded-full bg-white/5 text-white flex items-center justify-center hover:bg-white/15 transition-all z-[110] border border-white/5 group active:scale-90"
          onClick={(e) => { e.stopPropagation(); handlePrev(); }}
        >
          <FrameworkIcons.Left size={40} strokeWidth={2} className="group-hover:-translate-x-1 transition-transform" />
        </button>
      )}

      {/* Navigation - Right */}
      {images.length > 1 && (
        <button 
          className="absolute right-6 lg:right-12 h-20 w-20 rounded-full bg-white/5 text-white flex items-center justify-center hover:bg-white/15 transition-all z-[110] border border-white/5 group active:scale-90"
          onClick={(e) => { e.stopPropagation(); handleNext(); }}
        >
          <FrameworkIcons.Right size={40} strokeWidth={2} className="group-hover:translate-x-1 transition-transform" />
        </button>
      )}

      {/* Main Image Container */}
      <div className="relative w-full h-full flex flex-col items-center justify-center p-4 lg:p-10" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex flex-col items-center w-full max-w-7xl">
          <img 
            src={images[currentIndex]} 
            alt={`Preview ${currentIndex + 1}`}
            className="max-w-full max-h-[85vh] lg:max-h-[90vh] object-contain rounded-2xl shadow-[0_80px_160px_-30px_rgba(0,0,0,0.7)] animate-in zoom-in-95 duration-700 ring-1 ring-white/20"
          />
          
          <div className="absolute -bottom-16 left-0 right-0 text-center space-y-1">
             <p className="text-white text-[11px] font-semibold tracking-widest drop-shadow-xl opacity-80">
                {title || 'Platform Preview'}
             </p>
             {images.length > 1 && (
               <p className="text-white/30 text-[9px] font-medium tracking-widest">
                  {currentIndex + 1} / {images.length}
               </p>
             )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
