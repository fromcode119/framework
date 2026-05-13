import type React from 'react';

export interface LocalizedFieldProps {
  label: string;
  input: (locale: string) => React.ReactNode;
  localeScope?: 'admin' | 'frontend';
}
