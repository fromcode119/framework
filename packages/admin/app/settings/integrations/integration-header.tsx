import React from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { FrameworkIcons } from '@fromcode119/react';
import { CompactPageHeader } from '@/components/ui/compact-page-header';
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
      <CompactPageHeader
        theme={theme}
        icon={<FrameworkIcons.Plugins size={18} strokeWidth={2} />}
        title="Integrations"
        subtitle="Add providers, configure each instance, and enable or disable them individually."
        actions={
          <>
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
          </>
        }
      />
    );
  }
}
