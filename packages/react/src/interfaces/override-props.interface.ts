import type { ReactNode } from 'react';

export interface IOverrideProps {
  name: string;
  props?: Record<string, any>;
  fallback?: ReactNode;
  children?: ReactNode;
}
