export interface Version {
  id: number;
  version: number;
  date: Date;
  user: string;
  action: string;
  changes: any;
}

export interface VersionHistoryProps {
  collectionSlug: string;
  recordId: string;
  onRestore: (data: any, versionId: number) => void;
  activeVersionId: number | null;
  theme: string;
}

export interface VersionHistoryState {
  revisions: Version[];
  loading: boolean;
  hasMore: boolean;
  page: number;
  selectedRevision: Version | null;
}

export interface VersionHistoryListProps {
  revisions: Version[];
  loading: boolean;
  hasMore: boolean;
  activeVersionId: number | null;
  onSelect: (version: Version | null) => void;
  onRestore: (data: any, versionId: number) => void;
  onLoadMore: () => void;
}

export interface VersionRevisionModalProps {
  selectedRevision: Version;
  revisions: Version[];
  currentRevIndex: number;
  theme: string;
  onSelect: (version: Version | null) => void;
  onRestore: (data: any, versionId: number) => void;
}
