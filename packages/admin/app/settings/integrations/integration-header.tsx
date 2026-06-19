import React from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { FrameworkIcons } from '@fromcode119/react';
import type { IntegrationHeaderProps } from './integration-header.interfaces';

export class IntegrationHeader extends React.Component<IntegrationHeaderProps> {
  render(): React.ReactNode {
    const {
      theme,
      activeType,
      integrationOptions,
      resettingStaleJs,
      onChangeType,
      onResetStaleJs,
    } = this.props;
    return (
      <div
        className={`sticky top-0 z-30 border-b backdrop-blur-md px-8 py-6 ${
          theme === 'dark' ? 'bg-slate-950/50 border-slate-800' : 'bg-white/50 border-slate-100'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h1 className={`text-xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              Integrations
            </h1>
            <p className="text-[11px] font-semibold text-slate-500 tracking-tight">
              Add providers, configure each instance, and enable or disable them individually.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[520px] lg:flex-row lg:items-center lg:justify-end">
            <div className="w-full lg:w-[360px]">
              <Select
                value={activeType}
                onChange={onChangeType}
                options={integrationOptions}
                placeholder="Select integration..."
                searchable={false}
                size="md"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="md"
              icon={<FrameworkIcons.Refresh size={14} />}
              onClick={onResetStaleJs}
              isLoading={resettingStaleJs}
              className="w-full lg:w-auto"
            >
              Reset Stale JS
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
