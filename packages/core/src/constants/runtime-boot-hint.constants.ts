/**
 * The marker a server-rendered surface carries when it cannot show its content until the storefront
 * runtime boots — a player that loads the reader's own access, a form that only exists in the browser.
 *
 * The storefront delays the runtime until the visitor's first intent or an idle fallback, which is right
 * for a page that is complete as server HTML. A page whose main surface is still a loading state would
 * sit on that state for the whole fallback, so the boot trigger looks for this attribute once the
 * document has parsed and boots straight away when any element carries it.
 */
export class RuntimeBootHintConstants {
  static readonly ATTRIBUTE = 'data-fc-boot-now';
}
