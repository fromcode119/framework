/**
 * Something the operator can START from a record, offered by the plugin that would carry it out — a
 * refund, a shipment, a return.
 *
 * It is a destination, never a mutation: `href` opens that plugin's own screen, where the work is done
 * and confirmed. The framework draws the label and follows the link; it attaches no meaning to either.
 */
export interface IEntityRecordAction {
  /** Stable id, unique within the contributing provider. */
  id: string;
  label: string;
  /** Admin path to open (RuntimeLocationUtils.toAdminPath on the client). */
  href: string;
  /** lucide-react icon name. */
  icon?: string;
  /** The part of the subject this belongs to; stamped from its provider unless the action names one. */
  part?: string;
}
