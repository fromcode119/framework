"use client";

import React from 'react';
import { AdminComponent } from '@/components/admin-component';

import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';

import { CollectionKeyUtils } from '../collection-key-utils';
import { CollectionListUtils } from './utils';

const RELATIONSHIP_LABEL_CACHE = new Map<string, string>();

interface RelationToken {
  value: any;
  directLabel: any;
  target: any;
}

interface RelationshipCellValueProps {
  relationTo?: string | string[];
  raw: any;
}

interface RelationshipCellValueState {
  resolved: Record<string, string>;
}

export class CollectionListRelationshipCellValue extends AdminComponent<RelationshipCellValueProps, RelationshipCellValueState> {
  state: RelationshipCellValueState = { resolved: {} };
  private runToken = 0;

  private getRelationSlugs(): string[] {
    return CollectionKeyUtils.resolveSourceSlugs(this.props.relationTo, this.collections || []);
  }

  private getTokens(): RelationToken[] {
    const { raw } = this.props;
    const entries = Array.isArray(raw) ? raw : [raw];
    return entries
      .map((entry) => {
        const value = CollectionListUtils.resolveRelationScalar(entry);
        const directLabel = CollectionListUtils.resolveRelationDisplayLabel(entry);
        const target = CollectionListUtils.resolveRelationTarget(entry);
        return { value, directLabel, target };
      })
      .filter((entry) => entry.value || entry.directLabel);
  }

  private resolveLabels = async (): Promise<void> => {
    const token = ++this.runToken;
    const disposed = () => token !== this.runToken;
    const relationSlugs = this.getRelationSlugs();
    const tokens = this.getTokens();
    const resolved = this.state.resolved;
    if (!relationSlugs.length) return;

    {
      const pending = tokens
        .filter((entry) => {
          if (!entry.value) return false;
          if (entry.directLabel && entry.directLabel !== entry.value) return false;
          const candidateSlugs = entry.target ? [entry.target] : relationSlugs;
          return !candidateSlugs.some((relationSlug) => {
            const key = `${relationSlug}:${entry.value}`;
            return RELATIONSHIP_LABEL_CACHE.has(key) || resolved[key];
          });
        })
        .slice(0, 8);

      if (!pending.length) return;
      const updates: Record<string, string> = {};

      await Promise.all(
        pending.map(async (entry) => {
          const candidateSlugs = entry.target ? [entry.target] : relationSlugs;

          for (const relationSlug of candidateSlugs) {
            const key = `${relationSlug}:${entry.value}`;
            try {
              const byId = await AdminApi.get(`${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${encodeURIComponent(relationSlug)}/${encodeURIComponent(entry.value)}`);
              const label = CollectionListUtils.resolveRelationDisplayLabel(byId) || entry.value;
              updates[key] = label;
              RELATIONSHIP_LABEL_CACHE.set(key, label);
              return;
            } catch {
              try {
                const bySlug = await AdminApi.get(
                  `${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/${encodeURIComponent(relationSlug)}?slug=${encodeURIComponent(entry.value)}&limit=1`
                );
                const doc = Array.isArray(bySlug) ? bySlug[0] : bySlug?.docs?.[0];
                const label = CollectionListUtils.resolveRelationDisplayLabel(doc) || entry.value;
                updates[key] = label;
                RELATIONSHIP_LABEL_CACHE.set(key, label);
                return;
              } catch {
                continue;
              }
            }
          }

          const fallbackKey = `${relationSlugs[0]}:${entry.value}`;
          updates[fallbackKey] = entry.value;
          RELATIONSHIP_LABEL_CACHE.set(fallbackKey, entry.value);
        })
      );

      if (!disposed() && Object.keys(updates).length) {
        this.setState((prev) => ({ resolved: { ...prev.resolved, ...updates } }));
      }
    }
  };

  componentDidMount(): void {
    void this.resolveLabels();
  }

  componentDidUpdate(prevProps: RelationshipCellValueProps, prevState: RelationshipCellValueState): void {
    // Re-resolve when inputs change, or after a resolved batch lands (converges: pending filters
    // out already-resolved entries, so no further setState once everything is labeled).
    if (
      prevProps.raw !== this.props.raw ||
      prevProps.relationTo !== this.props.relationTo ||
      prevState.resolved !== this.state.resolved
    ) {
      void this.resolveLabels();
    }
  }

  componentWillUnmount(): void {
    this.runToken++;
  }

  render(): React.ReactNode {
    const { resolved } = this.state;
    const relationSlugs = this.getRelationSlugs();
    const tokens = this.getTokens();

    if (!tokens.length) return <>-</>;

    const labels = tokens.map((entry) => {
      if (entry.directLabel && entry.directLabel !== entry.value) return entry.directLabel;
      const candidateSlugs = entry.target ? [entry.target] : relationSlugs;
      const key = candidateSlugs
        .map((relationSlug) => `${relationSlug}:${entry.value}`)
        .find((candidate) => resolved[candidate] || RELATIONSHIP_LABEL_CACHE.get(candidate));
      return (key && (resolved[key] || RELATIONSHIP_LABEL_CACHE.get(key))) || entry.directLabel || entry.value;
    });

    return <>{labels.slice(0, 3).join(', ')}{labels.length > 3 ? '…' : ''}</>;
  }
}
