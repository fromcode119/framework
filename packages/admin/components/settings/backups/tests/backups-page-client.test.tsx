import { BackupCatalogGroupKey } from '@fromcode119/core';
import { BackupCatalogRootKind } from '@fromcode119/core';
import { BackupSectionKey } from '@fromcode119/core';
import { SnapshotType } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { RestoreTargetScope } from '@/components/settings/backups/enums/restore-target-scope.enum';
// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BackupsPageClient } from '@/components/settings/backups/view/backups-page-client.client';
import type { IBackupCatalogGroupView } from '@/components/settings/backups/interfaces/backup-catalog-group-view.interface';
import type { IBackupCatalogItemView } from '@/components/settings/backups/interfaces/backup-catalog-item-view.interface';
import type { IRestoreExecuteResponseView } from '@/components/settings/backups/interfaces/restore-execute-response-view.interface';
import type { IRestorePreviewResponseView } from '@/components/settings/backups/interfaces/restore-preview-response-view.interface';
import type { ISystemBackupHookState } from '@/components/settings/backups/interfaces/system-backup-hook-state.interface';
import type { ISystemBackupMutationResponseView } from '@/components/settings/backups/interfaces/system-backup-mutation-response-view.interface';
const addNotification = vi.fn();

const pluginBackup: IBackupCatalogItemView = {
  id: 'plugin-1',
  filename: 'plugin-1.tar.gz',
  displayName: 'Plugin Backup 1',
  group: BackupCatalogGroupKey.PLUGINS,
  rootKind: BackupCatalogRootKind.BACKUPS,
  scopeSlug: 'demo-plugin',
  sizeBytes: 1024,
  modifiedAt: '2026-04-13T12:00:00.000Z',
};

const groups: IBackupCatalogGroupView[] = [
  {
    key: BackupCatalogGroupKey.PLUGINS,
    label: 'Plugins',
    items: [pluginBackup],
  },
];

const previewResponse: IRestorePreviewResponseView = {
  backup: pluginBackup,
  targetKind: 'plugin:demo-plugin',
  targetLabel: 'Plugin demo-plugin',
  warnings: ['Verify plugin compatibility.'],
  previewToken: 'preview-token-123',
  previewExpiresAt: '2026-04-13T12:10:00.000Z',
  requiredConfirmationText: 'CONFIRM RESTORE plugin-1',
  snapshotType: SnapshotType.PLUGINS,
};

const executeResponse: IRestoreExecuteResponseView = {
  success: true,
  backup: pluginBackup,
  targetKind: 'plugin:demo-plugin',
  rollbackSnapshotPath: '/tmp/rollback.tar.gz',
};

let backupState: ISystemBackupHookState;

vi.mock('@/components/view/use-theme.client', () => ({
  ThemeHooks: {
    useTheme: () => ({ theme: 'light' }),
  },
}));

vi.mock('@/components/view/use-notification.client', () => ({
  NotificationHooks: {
    useNotification: () => ({ addNotification }),
  },
}));

vi.mock('@/components/ui/view/loader.client', () => ({
  Loader: ({ label }: { label: string }) => <div>{label}</div>,
}));

vi.mock('@/components/ui/view/card.client', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/view/confirm-dialog.client', () => ({
  ConfirmDialog: ({ isOpen, description, onConfirm, onClose }: any) => (
    isOpen ? (
      <div>
        <div>{description}</div>
        <button type="button" onClick={() => void onConfirm()}>confirm-delete</button>
        <button type="button" onClick={onClose}>close-delete</button>
      </div>
    ) : null
  ),
}));

vi.mock('@/components/settings/backups/view/backup-summary-card.client', () => ({
  BackupSummaryCard: () => <div>summary-card</div>,
}));

vi.mock('@/components/settings/backups/view/backup-create-card.client', () => ({
  BackupCreateCard: ({ onCreate }: any) => (
    <div>
      <button type="button" onClick={() => void onCreate()}>create</button>
    </div>
  ),
}));

vi.mock('@/components/settings/backups/view/backup-operator-notes-card.client', () => ({
  BackupOperatorNotesCard: () => <div>operator-notes-card</div>,
}));

vi.mock('@/components/settings/backups/view/backup-list-card.client', () => ({
  BackupListCard: ({ onDownload, onRefresh, onRequestDelete, onRequestRestore }: any) => (
    <div>
      <button type="button" onClick={() => void onRefresh()}>refresh</button>
      <button type="button" onClick={() => onDownload(pluginBackup.id)}>download</button>
      <button type="button" onClick={() => onRequestDelete(pluginBackup)}>request-delete</button>
      <button type="button" onClick={() => onRequestRestore(pluginBackup)}>request-restore</button>
    </div>
  ),
}));

vi.mock('@/components/settings/backups/view/backup-restore-dialog.client', () => ({
  BackupRestoreDialog: ({ isOpen, state, onClose, onTargetScopeChange, onTargetSlugChange, onConfirmationTextChange, onPreview, onExecute }: any) => (
    isOpen ? (
      <div>
        <div>restore-open</div>
        {/*
          `state.targetScope` is a reactor `RestoreTargetScope` Enum MEMBER, not a string. Rendering the
          member itself threw `Objects are not valid as a React child (found: object with keys {value})`
          and took both restore tests down — a fake that did not match the contract the real
          `BackupRestoreDialog` is handed. The real dialog only ever COMPARES the member (never renders
          it), so this is a fixture bug, not a product bug; `.value` is the string form.
        */}
        <div>scope:{state.targetScope.value}</div>
        <div>slug:{state.targetSlug}</div>
        <div>preview:{state.preview ? 'yes' : 'no'}</div>
        <div>execute-disabled:{state.preview ? 'no' : 'yes'}</div>
        <div>{state.formError}</div>
        {/*
          Pass real Enum MEMBERS, exactly as the real dialog's scope buttons do. The raw strings this
          used to send could never satisfy the controller's `value === RestoreTargetScope.SYSTEM`
          identity check — the recurring "Enum compared to a raw string is always false" trap.
        */}
        <button type="button" onClick={() => onTargetScopeChange(RestoreTargetScope.PLUGIN)}>scope-plugin</button>
        <button type="button" onClick={() => onTargetScopeChange(RestoreTargetScope.SYSTEM)}>scope-system</button>
        <button type="button" onClick={() => onTargetSlugChange('')}>slug-empty</button>
        <button type="button" onClick={() => onTargetSlugChange('restored-plugin')}>slug-restored</button>
        <button type="button" onClick={() => onConfirmationTextChange('CONFIRM RESTORE plugin-1')}>set-confirmation</button>
        <button type="button" onClick={() => void onPreview()}>preview</button>
        <button type="button" onClick={() => void onExecute()}>execute</button>
        <button type="button" onClick={onClose}>close-restore</button>
      </div>
    ) : null
  ),
}));

vi.mock('@/components/settings/backups/view/use-system-backups.client', () => ({
  SystemBackupHooks: {
    useBackups: () => backupState,
  },
}));

describe('BackupsPageClient', () => {
  beforeEach(() => {
    addNotification.mockReset();

    const mutationSelection: ISystemBackupMutationResponseView['selection'] = {
      requestedSections: [BackupSectionKey.CORE],
      includedSections: [BackupSectionKey.CORE],
      warnings: [],
    };

    backupState = {
      groups,
      capabilities: {
        canManage: true,
        canRestore: true,
      },
      errorMessage: '',
      isLoading: false,
      isRefreshing: false,
      isCreating: false,
      createProgress: null,
      downloadProgress: null,
      activeDeleteId: '',
      activePreviewId: '',
      activeRestoreId: '',
      refreshBackups: vi.fn(async () => ({ groups, capabilities: { canManage: true, canRestore: true } })),
      createSystemBackup: vi.fn(async () => ({ success: true, backup: pluginBackup, selection: mutationSelection } satisfies ISystemBackupMutationResponseView)),
      deleteBackup: vi.fn(async () => ({ success: true, backup: pluginBackup, selection: mutationSelection } satisfies ISystemBackupMutationResponseView)),
      downloadBackup: vi.fn(),
      previewRestore: vi.fn(async () => previewResponse),
      executeRestore: vi.fn(async () => executeResponse),
      isImporting: false,
      importProgress: null,
      importBackup: vi.fn(async () => ({ success: true, backup: pluginBackup, selection: mutationSelection } satisfies ISystemBackupMutationResponseView)),
    };
  });

  it('wires refresh, create, download, and delete actions through the page controller', async () => {
    render(<BackupsPageClient />);

    fireEvent.click(screen.getByRole('button', { name: 'refresh' }));
    fireEvent.click(screen.getByRole('button', { name: 'create' }));
    fireEvent.click(screen.getByRole('button', { name: 'download' }));
    fireEvent.click(screen.getByRole('button', { name: 'request-delete' }));

    await waitFor(() => {
      expect(backupState.refreshBackups).toHaveBeenCalledTimes(1);
      expect(backupState.createSystemBackup).toHaveBeenCalledTimes(1);
      expect(backupState.downloadBackup).toHaveBeenCalledWith(pluginBackup.id);
      expect(screen.getByText(/Delete Plugin Backup 1/)).not.toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: 'confirm-delete' }));

    await waitFor(() => {
      expect(backupState.deleteBackup).toHaveBeenCalledWith(pluginBackup.id);
      expect(addNotification).toHaveBeenCalledWith(expect.objectContaining({
        type: NotificationType.SUCCESS,
        title: 'Backup Created',
      }));
      expect(addNotification).toHaveBeenCalledWith(expect.objectContaining({
        type: NotificationType.SUCCESS,
        title: 'Backup Deleted',
      }));
    });
  });

  it('blocks restore preview when a non-system target slug is blank', async () => {
    render(<BackupsPageClient />);

    fireEvent.click(screen.getByRole('button', { name: 'request-restore' }));
    expect(screen.getByText('restore-open')).not.toBeNull();
    expect(screen.getByText('execute-disabled:yes')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'slug-empty' }));
    fireEvent.click(screen.getByRole('button', { name: 'preview' }));

    await waitFor(() => {
      expect(backupState.previewRestore).not.toHaveBeenCalled();
      expect(screen.getByText('A plugin slug is required before preview.')).not.toBeNull();
      expect(screen.getByText('preview:no')).not.toBeNull();
    });
  });

  it('enables execute restore after preview and forwards the confirmed restore payload', async () => {
    render(<BackupsPageClient />);

    fireEvent.click(screen.getByRole('button', { name: 'request-restore' }));
    fireEvent.click(screen.getByRole('button', { name: 'slug-restored' }));
    fireEvent.click(screen.getByRole('button', { name: 'preview' }));

    await waitFor(() => {
      expect(backupState.previewRestore).toHaveBeenCalledWith(pluginBackup.id, 'plugin:restored-plugin');
      expect(screen.getByText('preview:yes')).not.toBeNull();
      expect(screen.getByText('execute-disabled:no')).not.toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: 'set-confirmation' }));
    fireEvent.click(screen.getByRole('button', { name: 'execute' }));

    await waitFor(() => {
      expect(backupState.executeRestore).toHaveBeenCalledWith(
        pluginBackup.id,
        'plugin:restored-plugin',
        'preview-token-123',
        'CONFIRM RESTORE plugin-1',
      );
      expect(addNotification).toHaveBeenCalledWith(expect.objectContaining({
        type: NotificationType.SUCCESS,
        title: 'Restore Started',
      }));
    });
  });
});