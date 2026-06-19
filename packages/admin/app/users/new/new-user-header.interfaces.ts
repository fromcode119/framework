import type React from 'react';

export interface NewUserHeaderProps {
  theme: string;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
}
