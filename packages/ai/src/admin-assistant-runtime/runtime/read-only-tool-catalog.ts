import type { IRuntimeContext } from '@ai/admin-assistant-runtime/runtime/interfaces/runtime-context.interface';
import { FactualQueryToolService } from '@ai/admin-assistant-runtime/runtime/factual-query-tool-service';

/**
 * Which tools a READ-ONLY assistant turn may see, and how they are described to the model.
 *
 * The filter is the safety boundary: a read-only turn is given only tools marked `readOnly`, so the
 * model cannot call something that writes even if it decides it wants to. Filtering the CATALOG is
 * what makes that true — refusing the call afterwards would still let the model plan around a tool
 * it should never have been offered.
 */
export class ReadOnlyToolCatalog {
  static selectReadOnlyTools(
    context: IRuntimeContext,
    message: string,
  ): Array<{ tool: string; description: string; metadata?: Record<string, unknown> }> {
    const allTools = (Array.isArray(context.tools) ? context.tools : [])
      .filter((tool) => tool?.readOnly === true)
      .map((tool) => ({
        tool: String(tool?.tool || '').trim(),
        description: String(tool?.description || '').trim(),
        metadata: tool?.metadata && typeof tool.metadata === 'object'
          ? { ...(tool.metadata as Record<string, unknown>) }
          : undefined,
      }))
      .filter((tool) => !!tool.tool);

    const ranked = FactualQueryToolService.rankReadOnlyTools(context, message);
    if (ranked.length === 0) return allTools.slice(0, 18);
    const byName = new Map(allTools.map((tool) => [tool.tool, tool]));
    const prioritized = ranked.flatMap((tool) => {
      const entry = byName.get(tool.tool);
      return entry ? [entry] : [];
    });
    const fallback = allTools.filter((tool) => !prioritized.some((entry) => entry.tool === tool.tool));
    return [...prioritized, ...fallback].slice(0, 18);
  }
  static serializeToolCatalog(
    tools: Array<{ tool: string; description: string; metadata?: Record<string, unknown> }>,
  ): string {
    return JSON.stringify(tools.map((tool) => ({
      tool: tool.tool,
      description: tool.description,
      metadata: tool.metadata && typeof tool.metadata === 'object'
        ? { category: tool.metadata.category, entity: tool.metadata.entity, filters: tool.metadata.filters, returns: tool.metadata.returns, followupHints: tool.metadata.followupHints }
        : undefined,
    })));
  }

  static buildCheckpointContext(context: IRuntimeContext): string {
    const factual = context.checkpoint?.memory?.factual;
    if (factual?.tool) {
      return JSON.stringify({
        tool: factual.tool,
        input: factual.input,
        rangeLabel: factual.rangeLabel,
        rangeFrom: factual.rangeFrom,
        rangeTo: factual.rangeTo,
        primaryMetricPath: factual.primaryMetricPath,
      });
    }
    const listing = context.checkpoint?.memory?.listing;
    if (listing?.collectionSlug) {
      return JSON.stringify({ collectionSlug: listing.collectionSlug, lastSelectedRowIndex: listing.lastSelectedRowIndex, lastSelectedField: listing.lastSelectedField });
    }
    return '';
  }
}
