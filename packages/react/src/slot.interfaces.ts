import type { ReactNode } from 'react';

export interface SlotProps {
  name: string;
  props?: Record<string, any>;
  fallback?: ReactNode;
}
