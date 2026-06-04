"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';
import { InteractiveCanvasState, InteractiveCanvasContextValue } from './interactive-canvas.interfaces';

const InteractiveCanvasContext = createContext<InteractiveCanvasContextValue | undefined>(undefined);

function ProviderComponent({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<InteractiveCanvasState>({
    isEnabled: false,
    targetId: null,
  });

  const toggleEnabled = useCallback(() => {
    setState((prev) => ({ ...prev, isEnabled: !prev.isEnabled }));
  }, []);

  const setTargetId = useCallback((id: string | null) => {
    setState((prev) => ({ ...prev, targetId: id }));
  }, []);

  return (
    <InteractiveCanvasContext.Provider value={{ state, toggleEnabled, setTargetId }}>
      {children}
    </InteractiveCanvasContext.Provider>
  );
}

interface WrapperProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  label?: string;
}

function WrapperComponent({ id, children, className }: WrapperProps) {
  const ctx = useContext(InteractiveCanvasContext);
  if (!ctx || !ctx.state.isEnabled) return <div className={className}>{children}</div>;
  return (
    <div
      className={className}
      style={{ cursor: 'pointer' }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        ctx.setTargetId(id);
      }}
    >
      {children}
    </div>
  );
}

export class InteractiveCanvas {
  static Provider = ProviderComponent;
  static Wrapper = WrapperComponent;
  /** Render-prop consumer for hook-free (class component) access to the canvas context. */
  static Consumer = InteractiveCanvasContext.Consumer;
  static use(): InteractiveCanvasContextValue {
    const context = useContext(InteractiveCanvasContext);
    if (!context) throw new Error('InteractiveCanvas.use() must be called inside InteractiveCanvas.Provider');
    return context;
  }
}