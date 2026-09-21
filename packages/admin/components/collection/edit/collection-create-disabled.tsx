import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';

import Link from 'next/link';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FrameworkIcons } from '@fromcode119/react';

/**
 * Shown instead of the create form when a collection declares `admin.disableCreate`.
 *
 * The flag says an operator cannot add rows here: the runtime writes them. Serving the form anyway let
 * anyone hand-type a row that looks exactly like one the runtime produced — an order line, a consent
 * record, a scheduled job — with none of the checks, history or state machine the real writer applies.
 */
export class CollectionCreateDisabled extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare title: string;
  @prop declare description?: string;
  @prop declare listHref: string;

  render(): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 animate-in fade-in duration-500">
        <div className={`p-6 rounded-xl mb-6 ${dark ? 'bg-slate-900' : 'bg-white shadow-lg shadow-slate-200'}`}>
          <FrameworkIcons.Lock size={40} className="text-indigo-500" strokeWidth={1.25} />
        </div>
        <h2 className={`text-xl font-semibold mb-3 ${dark ? 'text-white' : 'text-slate-900'}`}>
          {this.title} are not created by hand
        </h2>
        <p className="text-slate-500 text-center max-w-md leading-relaxed mb-8">
          {this.description || 'Records in this collection are written by the runtime. Open the list to see the ones that exist.'}
        </p>
        <Button variant={ButtonVariant.PRIMARY} as={Link} href={this.listHref} icon={<FrameworkIcons.Layout size={16} />}>
          Back to {this.title}
        </Button>
      </div>
    );
  }
}
