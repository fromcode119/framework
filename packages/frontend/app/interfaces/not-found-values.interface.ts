/** Hook values the {@link NotFound} bridge reads before resolving a theme override. */
export interface INotFoundValues {
  path: string | null;
  /** The translation context's locale — the server render has no `<html lang>` to read. */
  locale: string;
}
