/** Storage driver interface */
export interface StorageDriver {
  readonly provider: string;
  save(file: Buffer, filename: string, options?: any): Promise<string>;
  read(filepath: string): Promise<Buffer>;
  delete(filepath: string): Promise<void>;
  getUrl(filepath: string): string;
}
