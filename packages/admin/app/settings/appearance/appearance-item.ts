/** One row in the Settings → Appearance picker (mirrors the API's AppearanceSummary). */
export class AppearanceItem {
  slug = '';
  name = '';
  version = '';
  builtIn = false;
  sourceUrl?: string;

  static from(row: any): AppearanceItem {
    const item = new AppearanceItem();
    item.slug = String(row?.slug ?? '');
    item.name = String(row?.name ?? '');
    item.version = String(row?.version ?? '');
    item.builtIn = Boolean(row?.builtIn);
    if (row?.sourceUrl) item.sourceUrl = String(row.sourceUrl);
    return item;
  }
}
