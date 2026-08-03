import { BaseService } from '@/lib/services/base-service';
import { StatusVariant } from '@/lib/enums/status-variant.enum';

/**
 * Service for resolving status labels, colours, and display variants.
 *
 * Centralises all status→UI mappings so components never contain
 * inline ternary chains for status display.
 *
 * @example
 * ```typescript
 * const services = AdminServices.getInstance();
 * const color   = services.status.getStatusColor('pending');   // 'yellow'
 * const label   = services.status.getStatusLabel('completed'); // 'Completed'
 * const variant = services.status.getStatusVariant('error');   // 'error'
 * ```
 */
export class StatusService extends BaseService {
  private static readonly STATUS_LABELS: Record<string, string> = {
    // Generic
    active: 'Active', inactive: 'Inactive', pending: 'Pending',
    completed: 'Completed', cancelled: 'Cancelled', failed: 'Failed',
    draft: 'Draft', published: 'Published', archived: 'Archived',
    // Orders / Commerce
    processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered',
    refunded: 'Refunded', partial: 'Partial',
    // Users
    suspended: 'Suspended', verified: 'Verified', unverified: 'Unverified',
    // Finance
    paid: 'Paid', unpaid: 'Unpaid', overdue: 'Overdue', voided: 'Voided',
    // Logistics
    in_transit: 'In Transit', out_for_delivery: 'Out for Delivery',
    returned: 'Returned', lost: 'Lost',
  };

  private static readonly STATUS_VARIANTS: Record<string, StatusVariant> = {
    active: StatusVariant.SUCCESS, completed: StatusVariant.SUCCESS, published: StatusVariant.SUCCESS,
    shipped: StatusVariant.SUCCESS, delivered: StatusVariant.SUCCESS, paid: StatusVariant.SUCCESS,
    verified: StatusVariant.SUCCESS,
    pending: StatusVariant.WARNING, processing: StatusVariant.WARNING, in_transit: StatusVariant.WARNING,
    out_for_delivery: StatusVariant.WARNING, partial: StatusVariant.WARNING, unpaid: StatusVariant.WARNING,
    overdue: StatusVariant.WARNING, unverified: StatusVariant.WARNING,
    cancelled: StatusVariant.ERROR, failed: StatusVariant.ERROR, returned: StatusVariant.ERROR, lost: StatusVariant.ERROR,
    voided: StatusVariant.ERROR, suspended: StatusVariant.ERROR,
    draft: StatusVariant.DEFAULT, archived: StatusVariant.DEFAULT, inactive: StatusVariant.DEFAULT,
    refunded: StatusVariant.INFO,
  };

  private static readonly STATUS_COLORS: Record<string, string> = {
    active: 'green', completed: 'green', published: 'green',
    shipped: 'green', delivered: 'green', paid: 'green', verified: 'green',
    pending: 'yellow', processing: 'yellow', in_transit: 'yellow',
    out_for_delivery: 'yellow', partial: 'yellow', unpaid: 'yellow',
    overdue: 'orange', unverified: 'yellow',
    cancelled: 'red', failed: 'red', returned: 'red',
    lost: 'red', voided: 'red', suspended: 'red',
    draft: 'gray', archived: 'gray', inactive: 'gray',
    refunded: 'blue',
  };

  /**
   * Returns a human-readable label for a status value.
   * Falls back to capitalising the raw value if not mapped.
   */
  getStatusLabel(status: unknown): string {
    const key = String(status ?? '').toLowerCase().replace(/[-\s]/g, '_');
    return StatusService.STATUS_LABELS[key]
      ?? String(status ?? '-').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /**
   * Returns a Tailwind-compatible colour name for a status value.
   * Falls back to 'gray' for unknown statuses.
   */
  getStatusColor(status: unknown): string {
    const key = String(status ?? '').toLowerCase().replace(/[-\s]/g, '_');
    return StatusService.STATUS_COLORS[key] ?? 'gray';
  }

  /**
   * Returns the UI variant (success/warning/error/info/default) for a status.
   */
  getStatusVariant(status: unknown): StatusVariant {
    const key = String(status ?? '').toLowerCase().replace(/[-\s]/g, '_');
    return StatusService.STATUS_VARIANTS[key] ?? StatusVariant.DEFAULT;
  }
}