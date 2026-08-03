/** A marketplace appearance row (mirrors the API's AppearanceCatalogEntry, minus the download URL). */
export class AppearanceCatalogItem {
  slug = '';
  name = '';
  version = '';
  description = '';
  author = '';
  installed = false;
  installedVersion = '';
  updateAvailable = false;

  static from(row: any): AppearanceCatalogItem {
    const item = new AppearanceCatalogItem();
    item.slug = String(row?.slug ?? '');
    item.name = String(row?.name ?? '');
    item.version = String(row?.version ?? '');
    item.description = String(row?.description ?? '');
    item.author = String(row?.author ?? '');
    item.installed = Boolean(row?.installed);
    item.installedVersion = String(row?.installedVersion ?? '');
    item.updateAvailable = Boolean(row?.updateAvailable);
    return item;
  }
}
