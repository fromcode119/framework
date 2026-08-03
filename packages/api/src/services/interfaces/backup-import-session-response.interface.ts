export interface IBackupImportSessionResponse {
  success: true;
  uploadId: string;
  chunkSizeBytes: number;
  totalChunks: number;
  originalFilename: string;
}
