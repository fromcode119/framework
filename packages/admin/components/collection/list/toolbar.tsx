"use client";

import React from 'react';

import { BulkActions } from './bulk-actions';
import { FilterBar } from './filter-bar';

export function CollectionListToolbar({
  theme,
  filterBarProps,
  bulkActionsProps
}: {
  theme: string;
  filterBarProps: Record<string, any>;
  bulkActionsProps: Record<string, any>;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-4">
        <FilterBar {...filterBarProps} />
      </div>
      <BulkActions theme={theme} {...bulkActionsProps} />
    </div>
  );
}
