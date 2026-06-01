"use client";

import React from 'react';

import { BulkActions } from './bulk-actions';
import { FilterBar } from './filter-bar';

export class CollectionListToolbar extends React.Component<{
  theme: string;
  filterBarProps: Record<string, any>;
  bulkActionsProps: Record<string, any>;
}> {
  render(): React.ReactNode {
    const {
  theme,
  filterBarProps,
  bulkActionsProps
} = this.props;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-4">
        <FilterBar {...filterBarProps} />
      </div>
      <BulkActions theme={theme} {...bulkActionsProps} />
    </div>
  );
  }
}
