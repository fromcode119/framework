/** The answer of `POST /sources/check-updates`. */
export interface ISourceUpdateCheck {
  total: number;
  changed: number;
  updates: { slug: string; type: string; hasUpdate: boolean; remoteSha: string | null }[];
}
