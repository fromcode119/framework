/**
 * Part of a stored file, both ends included, as an HTTP `Range` asks for it (`bytes=start-end`). A video
 * player reads a file this way: a few kilobytes to find its index, then the parts it is about to show.
 */
export interface IStorageByteRange {
  start: number;
  end: number;
}
