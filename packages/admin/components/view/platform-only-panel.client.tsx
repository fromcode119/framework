import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { AdminClass } from '@/lib/admin-class';

/**
 * "This screen belongs to the platform, not to your site."
 *
 * Several admin surfaces act on the ONE container every site runs on — the site registry, the plugin
 * registry's health, the marketplace, maintenance and isolation limits. The API refuses each of them
 * for a site administrator, so the screen must say what it is instead of loading a view that can only
 * fail: five pages had started to grow their own copy of that sentence, which is exactly how the same
 * explanation ends up worded five different ways.
 *
 * `detail` names WHY this particular screen is the platform's, in the operator's terms. It should also
 * say where the equivalent site-level control lives, when there is one.
 */
export class PlatformOnlyPanel extends PureReactor {
  @prop declare detail: ReactNode;

  render(): ReactNode {
    return (
      <div className="p-6 w-full">
        <div className={`${AdminClass.SURFACE} p-6`}>
          <h1 className="text-[13px] font-semibold text-slate-900 dark:text-white">This is a platform screen</h1>
          <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-slate-500">{this.detail}</p>
        </div>
      </div>
    );
  }
}
