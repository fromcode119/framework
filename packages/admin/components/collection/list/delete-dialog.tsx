"use client";

import React from 'react';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export function CollectionListDeleteDialog({
  deleteDialogState,
  deleteLoading,
  onClose,
  onConfirm
}: {
  deleteDialogState: { mode: 'single'; id: string } | { mode: 'bulk'; ids: string[] } | null;
  deleteLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      isOpen={Boolean(deleteDialogState)}
      onClose={onClose}
      onConfirm={onConfirm}
      isLoading={deleteLoading}
      title={deleteDialogState?.mode === 'bulk' ? `Delete ${deleteDialogState.ids.length} records` : 'Delete record'}
      description={
        deleteDialogState?.mode === 'bulk'
          ? `Are you sure you want to delete ${deleteDialogState.ids.length} selected records? This action is permanent and cannot be undone.`
          : 'Are you sure you want to delete this record? This action is permanent and cannot be undone.'
      }
      confirmLabel={deleteDialogState?.mode === 'bulk' ? 'Delete Records' : 'Delete Record'}
      cancelLabel="Cancel"
      variant="danger"
    />
  );
}
