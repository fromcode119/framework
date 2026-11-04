/** The address of a page being server-rendered — the server's `window.location`. */
export interface IRenderLocation {
  path: string;
  origin: string;
  search: string;
}
