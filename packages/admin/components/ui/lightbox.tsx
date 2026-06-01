"use client";

import React from 'react';
import { createPortal } from 'react-dom';
import { FrameworkIcons } from '@fromcode119/react';

interface LightboxProps {
  images: string[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
  title?: string;
}

interface LightboxState {
  mounted: boolean;
}

export class Lightbox extends React.Component<LightboxProps, LightboxState> {
  state: LightboxState = { mounted: false };

  private handlePrev = (): void => {
    const { images, currentIndex, onNavigate } = this.props;
    if (images.length <= 1) return;
    onNavigate((currentIndex - 1 + images.length) % images.length);
  };

  private handleNext = (): void => {
    const { images, currentIndex, onNavigate } = this.props;
    if (images.length <= 1) return;
    onNavigate((currentIndex + 1) % images.length);
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.props.isOpen) return;
    if (e.key === 'Escape') this.props.onClose();
    if (e.key === 'ArrowLeft') this.handlePrev();
    if (e.key === 'ArrowRight') this.handleNext();
  };

  private applyOpenSideEffects(): void {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = this.props.isOpen ? 'hidden' : '';
  }

  componentDidMount(): void {
    this.setState({ mounted: true });
    if (typeof window !== 'undefined') window.addEventListener('keydown', this.handleKeyDown);
    this.applyOpenSideEffects();
  }

  componentDidUpdate(prevProps: LightboxProps): void {
    if (prevProps.isOpen !== this.props.isOpen) this.applyOpenSideEffects();
  }

  componentWillUnmount(): void {
    if (typeof window !== 'undefined') window.removeEventListener('keydown', this.handleKeyDown);
    if (typeof document !== 'undefined') document.body.style.overflow = '';
  }

  render(): React.ReactNode {
    const { images, currentIndex, isOpen, onClose, title } = this.props;
    const handlePrev = this.handlePrev;
    const handleNext = this.handleNext;

    if (!isOpen || !this.state.mounted) return null;

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
}
