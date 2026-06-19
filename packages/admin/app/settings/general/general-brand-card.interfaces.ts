import type React from 'react';

export interface GeneralBrandCardProps {
  settings: Record<string, any>;
  setSettings: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  theme: string;
  toggleTheme: () => void;
}
