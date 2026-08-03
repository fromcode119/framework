import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/reactor';
import { Button } from '@/components/ui/view/button.client';
import { Select } from '@/components/ui/view/select.client';
import { FrameworkIcons } from '@fromcode119/react';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';

export class IntegrationHeader extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<IntegrationHeader, 'theme' | 'activeType' | 'integrationOptions' | 'resettingStaleJs' | 'onChangeType' | 'onResetStaleJs'>;

  @prop declare theme: ThemeMode;
  @prop declare activeType: string;
  @prop declare integrationOptions: Array<{ label: string; value: string }>;
  @prop declare resettingStaleJs: boolean;
  @prop declare onChangeType: (value: string) => void;
  @prop declare onResetStaleJs: () => void;

  render(): ReactNode {
    return (
      <CompactPageHeader
        theme={this.theme}
        icon={<FrameworkIcons.Plugins size={18} strokeWidth={2} />}
        title="Integrations"
        subtitle="Add providers, configure each instance, and enable or disable them individually."
        actions={
          <>
            <div className="w-full lg:w-[360px]">
              <Select
                value={this.activeType}
                onChange={this.onChangeType}
                options={this.integrationOptions}
                placeholder="Select integration..."
                searchable={false}
                size={FieldSize.MD}
              />
            </div>
            <Button
              type="button"
              variant={ButtonVariant.OUTLINE}
              size={FieldSize.MD}
              icon={<FrameworkIcons.Refresh size={14} />}
              onClick={this.onResetStaleJs}
              isLoading={this.resettingStaleJs}
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
