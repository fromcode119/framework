import type { ReactNode } from 'react';

export interface IBuildSourceDialogProps {
  children: ReactNode;
  description: string;
  onClose: () => void;
  title: string;
}
