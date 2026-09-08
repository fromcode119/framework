export interface IMediaItem {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  /**
   * Optional because it can genuinely be unknown (an older api that did not report it). It is never
   * defaulted to 0: a stand-in number reads as a measurement nobody took, and "0 B" is indistinguishable
   * from a genuinely empty file. Unknown size renders as nothing at all.
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
