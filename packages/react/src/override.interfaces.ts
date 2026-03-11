import type { ReactNode } from 'react';

export interface OverrideProps {
  name: string;
  props?: Record<string, any>;
  fallback?: ReactNode;
  children?: ReactNode;
}