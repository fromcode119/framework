"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { ContextHooks } from '@fromcode119/react';

import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';

import { CollectionKeyUtils } from '../collection-key-utils';
import { CollectionListUtils } from './utils';

const RELATIONSHIP_LABEL_CACHE = new Map<string, string>();

export function CollectionListRelationshipCellValue({
  relationTo,
  raw
}: {
  relationTo?: string | string[];
  raw: any;
}) {
  const collections = ContextHooks.useCollections();
  const [resolved, setResolved] = useState<Record<string, string>>({});

  const relationSlugs = useMemo(() => {
    return CollectionKeyUtils.resolveSourceSlugs(relationTo, collections || []);
  }, [collections, relationTo]);

  const tokens = useMemo(() => {
    const entries = Array.isArray(raw) ? raw : [raw];
    return entries
      .map((entry) => {
        const value = CollectionListUtils.resolveRelationScalar(entry);
        const directLabel = CollectionListUtils.resolveRelationDisplayLabel(entry);
        const target = CollectionListUtils.resolveRelationTarget(entry);
        return { value, directLabel, target };
      })
      .filter((entry) => entry.value || entry.directLabel);
  }, [raw]);

  useEffect(() => {
    let disposed = false;
    if (!relationSlugs.length) return () => {
      disposed = true;
    };

    const run = async () => {
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

      if (!disposed && Object.keys(updates).length) {
        setResolved((prev) => ({ ...prev, ...updates }));
      }
    };

    run();
    return () => {
      disposed = true;
    };
  }, [relationSlugs, resolved, tokens]);

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
