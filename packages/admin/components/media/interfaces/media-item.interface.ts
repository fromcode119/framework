export interface IMediaItem {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  /**
   * Absent for assets that ship inside the theme — the theme asset listing carries no size, and a
   * stand-in number would read as a measurement nobody took.
   */
  filesize?: number;
  width?: number;
  height?: number;
  alt?: string;
  /**
   * Set ONLY for assets that ship inside the active theme: the path relative to the theme's `ui/`
   * directory (`images/hero.jpg`). A field that stores a path should store THIS rather than `url`,
   * so the value survives moving between environments; an absolute upload URL pins it to one host.
   * Its presence is also what marks an item as theme-shipped rather than uploaded.
   */
  relativePath?: string;
}
