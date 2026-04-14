// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BackupsPageClient } from './backups-page-client';
import type {
  BackupCatalogGroupView,
  BackupCatalogItemView,
  RestoreExecuteResponseView,
  RestorePreviewResponseView,
  SystemBackupHookState,
  SystemBackupMutationResponseView,
} from './backups-page-client.interfaces';

const addNotification = vi.fn();

const pluginBackup: BackupCatalogItemView = {
  id: 'plugin-1',
  filename: 'plugin-1.tar.gz',
  displayName: 'Plugin Backup 1',
  group: 'plugins',
  rootKind: 'backups',
  scopeSlug: 'demo-plugin',
  sizeBytes: 1024,
  modifiedAt: '2026-04-13T12:00:00.000Z',
};

const groups: BackupCatalogGroupView[] = [
  {
    key: 'plugins',
    label: 'Plugins',
    items: [pluginBackup],
  },
];

const previewResponse: RestorePreviewResponseView = {
  backup: pluginBackup,
  targetKind: 'plugin:demo-plugin',
  targetLabel: 'Plugin demo-plugin',
  warnings: ['Verify plugin compatibility.'],
  previewToken: 'preview-token-123',
  previewExpiresAt: '2026-04-13T12:10:00.000Z',
  requiredConfirmationText: 'CONFIRM RESTORE plugin-1',
  snapshotType: 'plugins',
};

const executeResponse: RestoreExecuteResponseView = {
  success: true,
  backup: pluginBackup,
  targetKind: 'plugin:demo-plugin',
  rollbackSnapshotPath: '/tmp/rollback.tar.gz',
};

let backupState: SystemBackupHookState;

vi.mock('@/components/use-theme', () => ({
  ThemeHooks: {
    useTheme: () => ({ theme: 'light' }),
  },
}));

vi.mock('@/components/use-notification', () => ({
  NotificationHooks: {
    useNotification: () => ({ addNotification }),
  },
}));

vi.mock('@/components/ui/loader', () => ({
  Loader: ({ label }: { label: string }) => <div>{label}</div>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/confirm-dialog', () => ({
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

vi.mock('./backup-summary-card', () => ({
  BackupSummaryCard: () => <div>summary-card</div>,
}));

vi.mock('./backup-create-card', () => ({
  BackupCreateCard: ({ onCreate }: any) => (
    <div>
      <button type="button" onClick={() => void onCreate()}>create</button>
    </div>
  ),
}));

vi.mock('./backup-operator-notes-card', () => ({
  BackupOperatorNotesCard: () => <div>operator-notes-card</div>,
}));

vi.mock('./backup-list-card', () => ({
  BackupListCard: ({ onDownload, onRefresh, onRequestDelete, onRequestRestore }: any) => (
    <div>
      <button type="button" onClick={() => void onRefresh()}>refresh</button>
      <button type="button" onClick={() => onDownload(pluginBackup.id)}>download</button>
      <button type="button" onClick={() => onRequestDelete(pluginBackup)}>request-delete</button>
      <button type="button" onClick={() => onRequestRestore(pluginBackup)}>request-restore</button>
    </div>
  ),
}));

vi.mock('./backup-restore-dialog', () => ({
  BackupRestoreDialog: ({ isOpen, state, onClose, onTargetScopeChange, onTargetSlugChange, onConfirmationTextChange, onPreview, onExecute }: any) => (
    isOpen ? (
      <div>
        <div>restore-open</div>
        <div>scope:{state.targetScope}</div>
        <div>slug:{state.targetSlug}</div>
        <div>preview:{state.preview ? 'yes' : 'no'}</div>
        <div>execute-disabled:{state.preview ? 'no' : 'yes'}</div>
        <div>{state.formError}</div>
        <button type="button" onClick={() => onTargetScopeChange('plugin')}>scope-plugin</button>
        <button type="button" onClick={() => onTargetScopeChange('system')}>scope-system</button>
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

vi.mock('./use-system-backups', () => ({
  SystemBackupHooks: {
    useBackups: () => backupState,
  },
}));

describe('BackupsPageClient', () => {
  beforeEach(() => {
    addNotification.mockReset();

    const mutationSelection: SystemBackupMutationResponseView['selection'] = {
      requestedSections: ['core'],
      includedSections: ['core'],
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
      createSystemBackup: vi.fn(async () => ({ success: true, backup: pluginBackup, selection: mutationSelection } satisfies SystemBackupMutationResponseView)),
      deleteBackup: vi.fn(async () => ({ success: true, backup: pluginBackup, selection: mutationSelection } satisfies SystemBackupMutationResponseView)),
      downloadBackup: vi.fn(),
      previewRestore: vi.fn(async () => previewResponse),
      executeRestore: vi.fn(async () => executeResponse),
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
        type: 'success',
        title: 'Backup Created',
      }));
      expect(addNotification).toHaveBeenCalledWith(expect.objectContaining({
        type: 'success',
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
        type: 'success',
        title: 'Restore Started',
      }));
    });
  });
});