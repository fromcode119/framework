import { Enum } from '@fromcode119/react-class-components/lang';

/** Where a public record can be listed: a catalogue or list on the site, the site's search, the sitemap. */
export class PublicListingSurface extends Enum {
  static readonly CATALOG = new PublicListingSurface('catalog');
  static readonly SEARCH = new PublicListingSurface('search');
  static readonly SITEMAP = new PublicListingSurface('sitemap');

  private constructor(value: string) {
    super(value);
  }
}
