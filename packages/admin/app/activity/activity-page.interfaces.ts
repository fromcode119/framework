export interface ActivityPageHeaderProps {
  mode: 'system' | 'security';
  theme: string;
  searchQuery: string;
  onModeChange: (mode: 'system' | 'security') => void;
  onSearchQueryChange: (value: string) => void;
  onSearch: (e: React.FormEvent) => void;
}

export interface ActivityDetailModalProps {
  selectedLog: any;
  mode: 'system' | 'security';
  theme: string;
  onClose: () => void;
  onExport: (log: any) => void;
}
