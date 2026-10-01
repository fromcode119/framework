/**
 * The `context.realtime` surface of {@link PluginContext}: live events to the browsers a plugin chose.
 *
 * A room is a name inside the calling plugin — `roomToken('conversation-12')` from the plugin `alpha`
 * is the room `alpha:conversation-12` of the site the code runs for — so a plugin can neither listen
 * to nor speak in another plugin's rooms, or another site's.
 *
 * The plugin decides who may listen: it mints a token only for a browser it has checked (the customer
 * of that conversation, the site's support staff) and hands it over in its own response. The browser
 * opens the room with the SDK's `RealtimeRoomClient`. The socket only listens; what the browser says
 * goes through the plugin's own routes.
 */
export interface IPluginContextRealtime {
  /**
   * A token that admits one socket to `name` on this site, valid for `ttlSeconds` (default an hour,
   * at most a day). Throws outside a site — a room always belongs to one.
   */
  roomToken(name: string, options?: { ttlSeconds?: number }): Promise<string>;

  /** Send `{ type, payload }` to every socket in the room `name` on this site, in every api process. */
  emit(name: string, type: string, payload?: unknown): Promise<void>;
}
