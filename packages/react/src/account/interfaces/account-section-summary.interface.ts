/**
 * What a contributor knows about ONE account section, shown beside it: `count` on the menu entry and the
 * overview tile, `text` as the tile's one-line summary ("2 addresses, Lozenets office by default").
 * Both are the contributor's own, already translated; the framework only places them.
 */
export interface IAccountSectionSummary {
  count?: number;
  text?: string;
}
