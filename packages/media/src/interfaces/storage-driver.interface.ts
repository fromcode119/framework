import type { Readable } from 'stream';

/** Storage driver interface */
export interface IStorageDriver {
  readonly provider: string;
  save(file: Buffer, filename: string, options?: any): Promise<string>;
  read(filepath: string): Promise<Buffer>;
  /**
   * Read-back as a STREAM rather than a Buffer. `read` loads the whole object into memory, which is
   * fine for the image variants it was written for and wrong for the file downloads a private,
   * entitlement-gated route serves — those have no size ceiling worth trusting.
   */
  stream(filepath: string): Promise<Readable>;
  delete(filepath: string): Promise<void>;
  getUrl(filepath: string): string;
}
