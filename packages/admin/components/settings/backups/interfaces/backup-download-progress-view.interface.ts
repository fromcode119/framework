export interface IBackupDownloadProgressView {
  activeId: string;
  percent: number | null;
  label: string;
  loadedBytes: number;
  totalBytes: number | null;
}
