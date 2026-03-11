import type { PaginationInput, PaginationMeta } from './pagination.interfaces';

/**
 * Pagination parsing and meta generation utilities.
 *
 * @example
 * const input = PaginationUtils.parse(req.query);
 * const offset = PaginationUtils.offset(input);
 * const meta = PaginationUtils.meta(totalCount, input);
 */
export class PaginationUtils {
  static parse(input: unknown, defaults: Partial<PaginationInput> = {}): PaginationInput {
    const q = (input ?? {}) as Record<string, unknown>;
    const page = Math.max(1, Math.floor(Number(q.page) || 1));
    const rawPerPage = Number(q.per_page ?? q.perPage ?? q.limit ?? defaults.perPage ?? 20);
    const perPage = Math.min(200, Math.max(1, Math.floor(rawPerPage)));
    return { page, perPage };
  }

  static offset(input: PaginationInput): number {
    return (input.page - 1) * input.perPage;
  }

  static meta(total: number, input: PaginationInput): PaginationMeta {
    const totalPages = total > 0 ? Math.ceil(total / input.perPage) : 0;
    return {
      page: input.page,
      perPage: input.perPage,
      total,
      totalPages,
      hasNextPage: input.page < totalPages,
      hasPrevPage: input.page > 1,
    };
  }
}