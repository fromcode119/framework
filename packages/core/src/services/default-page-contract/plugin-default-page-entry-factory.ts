import type { IResolvedPluginDefaultPageContract } from '@core/default-page-contract/interfaces/resolved-plugin-default-page-contract.interface';
import { BaseService } from '@core/services/base-service';
import { PluginDefaultPageContractMaterializationMode } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-mode.enum';

/**
 * What the two default-page plan factories — materialization and backfill — share.
 *
 * They build different plans from the same contracts, and these three answers must be the SAME
 * answer in both: a route the backfill treats as runtime-parameterised and the materializer does not
 * would be adopted by one pass and created by the other, which is how one contract ends up owning two
 * pages. They were literally duplicated, method for method, in both files.
 */
export abstract class PluginDefaultPageEntryFactory extends BaseService {
  /** The plan entry's reasons, de-duplicated and trimmed — with the fallback when nothing survives. */
  protected createReasons(existingReasons: string[], fallbackReason: string): string[] {
    const normalized = Array.from(
      new Set(
        (existingReasons || [])
          .map((reason) => String(reason || '').trim())
          .filter(Boolean),
      ),
    );

    if (normalized.length) {
      return normalized;
    }

    return [fallbackReason];
  }

  /**
   * A singleton route whose path carries `:parameters` — one CONTRACT, many pages at runtime.
   *
   * Such a contract cannot be materialized to a single page, because there is no single path for it
   * to live at.
   */
  protected isRuntimeParameterizedContract(contract: IResolvedPluginDefaultPageContract): boolean {
    return contract.materializationMode === PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT && this.hasPathParameters(contract.effectiveSlug);
  }

  /** Does any segment of this route path start with `:`? Query and fragment are not part of the path. */
  protected hasPathParameters(value: string): boolean {
    return String(value || '')
      .trim()
      .split('?')[0]
      .split('#')[0]
      .split('/')
      .filter(Boolean)
      .some((segment) => segment.startsWith(':'));
  }
}
