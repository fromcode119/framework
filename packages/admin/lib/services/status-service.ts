import { BaseService } from './base-service';

type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'default';

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
    active: 'success', completed: 'success', published: 'success',
    shipped: 'success', delivered: 'success', paid: 'success',
    verified: 'success',
    pending: 'warning', processing: 'warning', in_transit: 'warning',
    out_for_delivery: 'warning', partial: 'warning', unpaid: 'warning',
    overdue: 'warning', unverified: 'warning',
    cancelled: 'error', failed: 'error', returned: 'error', lost: 'error',
    voided: 'error', suspended: 'error',
    draft: 'default', archived: 'default', inactive: 'default',
    refunded: 'info',
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
    return StatusService.STATUS_VARIANTS[key] ?? 'default';
  }
}