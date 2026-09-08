export interface IThemeAssetEntry {
  filename: string;
  relativePath: string;
  mimeType: string;
  url: string;
  /**
   * The file's real size on disk. Absent, the library rendered every theme asset as "0 B" — a figure
   * nothing measured, indistinguishable from a genuinely empty file.
   */
  sizeBytes: number;
}
