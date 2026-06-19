import type React from 'react';

export interface PublisherFormData {
  name: string;
  slug: string;
  version: string;
  description: string;
  category: string;
  downloadUrl: string;
  iconUrl: string;
  capabilities: string;
  author: string;
}

export interface PublisherFormProps {
  theme: string;
  submissionType: 'plugin' | 'theme';
  formData: PublisherFormData;
  loading: boolean;
  onChange: (next: PublisherFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export interface PublisherTypeTabsProps {
  theme: string;
  submissionType: 'plugin' | 'theme';
  onSelect: (next: 'plugin' | 'theme') => void;
}

export interface PublisherFieldShellProps {
  theme: string;
  label: string;
  children: React.ReactNode;
}
