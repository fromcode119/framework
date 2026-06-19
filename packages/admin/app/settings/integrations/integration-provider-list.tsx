import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { FrameworkIcons } from '@fromcode119/react';
import type { IntegrationProviderListProps } from './integration-provider-list.interfaces';

export class IntegrationProviderList extends React.Component<IntegrationProviderListProps> {
  render(): React.ReactNode {
    const {
      activeIntegration,
      activeProviders,
      selectedProviderId,
      editor,
      removeCandidateId,
      changingProviderId,
      runtimeProviderId,
      onAddProvider,
      onSelectProvider,
      onToggleProvider,
      onRequestRemove,
      onCancelRemove,
      onConfirmRemove,
    } = this.props;
    return (
      <Card className="xl:col-span-4" noPadding>
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">Provider Instances</h3>
            <p className="text-xs text-slate-500 mt-1">
              Multiple providers are supported, including duplicate provider types.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<FrameworkIcons.Plus size={14} />}
            onClick={onAddProvider}
          >
            Add
          </Button>
        </div>

        <div className="p-4 space-y-3">
          {activeProviders.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 px-4 py-8 text-center">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No providers configured.</p>
              <p className="text-xs text-slate-500 mt-1">Add your first provider instance to continue.</p>
            </div>
          )}

          {activeProviders.map((provider) => {
            const providerMeta = activeIntegration?.providers.find((item) => item.key === provider.providerKey);
            const selected = selectedProviderId === provider.id && !editor?.isNew;
            const enabled = provider.enabled !== false;
            const pendingRemove = removeCandidateId === provider.id;
            const isChanging = changingProviderId === provider.id;

            return (
              <div
                key={provider.id}
                className={`rounded-xl border transition-all ${
                  selected
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectProvider(provider.id)}
                  className="w-full text-left px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
                        {provider.name || providerMeta?.label || provider.providerKey.toUpperCase()}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide truncate mt-1">
                        {provider.providerKey}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {runtimeProviderId === provider.id && <Badge variant="info">Runtime</Badge>}
                      <Badge variant={enabled ? 'green' : 'gray'}>{enabled ? 'Enabled' : 'Disabled'}</Badge>
                    </div>
                  </div>
                </button>

                <div className="px-4 pb-3 flex items-center justify-between gap-3">
                  <Switch
                    checked={enabled}
                    onChange={() => {
                      if (!isChanging) onToggleProvider(provider);
                    }}
                    disabled={isChanging}
                  />
                  {!pendingRemove ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<FrameworkIcons.Trash size={14} />}
                      onClick={() => onRequestRemove(provider.id)}
                      className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                    >
                      Remove
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => onConfirmRemove(provider)}
                        isLoading={isChanging}
                      >
                        Confirm
                      </Button>
                      <Button variant="secondary" size="sm" onClick={onCancelRemove}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }
}
