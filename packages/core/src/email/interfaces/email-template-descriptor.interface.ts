/**
 * One kind of email a sender can send, as it declares it for the email catalog: what it is called,
 * WHEN it goes out, and the example data its preview is drawn with. Data only — the render method is
 * NAMED, never passed, so the declaration survives the channel to an isolated plugin.
 */
export interface IEmailTemplateDescriptor {
  /** Unique within its sender (`order-confirmation`). The log records it as `<sender>:<key>`. */
  key: string;
  /** i18n key (the sender's own dictionary) for the email's name: "Order confirmation". */
  labelKey: string;
  /** i18n key for WHEN it is sent, as a sentence: "When an order moves to Processing". */
  triggerKey: string;
  /** i18n key for what it says, in a line. Optional. */
  descriptionKey?: string;
  /** The opt-outable stream it belongs to; absent = transactional. */
  category?: string;
  /** It carries a sign-in, reset or share link: the log keeps no content and the preview says so. */
  sensitive?: boolean;
  /** Example data the preview and "send a test" render with. Declared by the sender, shown as an example. */
  sample: Record<string, unknown>;
  /** The method on the sender's API that renders it: called with `{ key, data }`, returns `{ subject, html, text }`. */
  method: string;
}
