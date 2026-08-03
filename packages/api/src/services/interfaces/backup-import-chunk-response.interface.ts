export interface IBackupImportChunkResponse {
  success: true;
  uploadId: string;
  receivedChunks: number;
  totalChunks: number;
  complete: boolean;
}
