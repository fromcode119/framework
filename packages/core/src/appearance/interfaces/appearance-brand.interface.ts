/**
 * What a site's console is called and which icon it shows, from the appearance the site wears —
 * answered by the api's public host route so the admin can write them into the page head on the
 * server, before any appearance code has loaded.
 */
export interface IAppearanceBrand {
  /** The appearance manifest's `name`. */
  name: string;
  /** The admin path of the icon its manifest declares (`/appearances/<id>/ui/<file>`); '' when none. */
  icon: string;
}
