import type React from 'react';
import { PureReactor } from '@fromcode119/react-class-components';
import { Slot } from '@fromcode119/react';
import { AppEnv } from '@/lib/env';
import { AdminClass } from '@/lib/admin-class';
import { AdminRichText } from '@/components/ui/view/admin-rich-text.client';
import { StatePage } from '@/components/ui/view/state-page.client';

export class ForgeClient extends PureReactor {
  render(): React.ReactNode {
  return (
    <div className="h-full min-h-0 w-full overflow-hidden">
      <Slot
        name="admin.minimal.root"
        fallback={
          <StatePage title={AppEnv.AI_NAME} hint={<AdminRichText k="shell.forge.noExtension" />} />
        }
      />
    </div>
  );
  }
}
