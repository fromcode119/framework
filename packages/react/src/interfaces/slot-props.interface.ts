import type { ReactNode } from 'react';

export interface ISlotProps {
  name: string;
  props?: Record<string, any>;
  fallback?: ReactNode;
}
