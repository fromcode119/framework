"use client";

import React from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export class ThemeSettingsDialogs extends React.Component<{ page: any; model: any }> {
  render(): React.ReactNode {
    const { page, model } = this.props;
    const { themeDetail } = model;
    const { isRunSeedsConfirmOpen, isResetThemeConfirmOpen, isDeleteConfirmOpen, isReseeding, isResettingTheme, isDeleting } = page.state;
    return (
      <>
        <ConfirmDialog
          isOpen={isRunSeedsConfirmOpen}
          onClose={() => page.setState({ isRunSeedsConfirmOpen: false })}
          onConfirm={() => void page.handleRunSeeds()}
          title="Run Theme Seeds?"
          description={`This will replay seed content for "${themeDetail?.name || 'this theme'}" and may overwrite existing records.`}
          confirmLabel="Run Seeds"
          cancelLabel="Cancel"
          variant="primary"
          isLoading={isReseeding}
        />

        <ConfirmDialog
          isOpen={isResetThemeConfirmOpen}
          onClose={() => page.setState({ isResetThemeConfirmOpen: false })}
          onConfirm={() => void page.handleResetTheme()}
          title="Reset Theme + Re-seed?"
          description={`This resets "${themeDetail?.name || 'this theme'}" config to defaults and then runs seeds again.`}
          confirmLabel="Reset & Run Seeds"
          cancelLabel="Cancel"
          variant="danger"
          isLoading={isResettingTheme}
        />

        <ConfirmDialog
          isOpen={isDeleteConfirmOpen}
          onClose={() => page.setState({ isDeleteConfirmOpen: false })}
          onConfirm={() => void page.handleDelete()}
          title="Delete Theme?"
          description={
            themeDetail?.state === 'active'
              ? `Theme "${themeDetail?.name || 'this theme'}" is active. The system will activate another theme if available, or continue with no active theme. Continue?`
              : `Are you sure you want to delete "${themeDetail?.name || 'this theme'}"? This action cannot be undone.`
          }
          confirmLabel="Delete Theme"
          cancelLabel="Cancel"
          variant="danger"
          isLoading={isDeleting}
        />
      </>
    );
  }
}
