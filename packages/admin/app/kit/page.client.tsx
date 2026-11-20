import { KitCopy } from '@/app/kit/kit-copy';
import type { ReactNode } from 'react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminLink } from '@/components/view/admin-link.client';
import { KitCatalog } from '@/app/kit/kit-catalog';
import { KitFrame } from '@/app/kit/view/kit-frame.client';

/**
 * The kit: every console component, each on a page of its own with its variants, its states, the code
 * for each and the options it takes. A screen is built from these and from nothing else, so changing
 * a component here changes it everywhere it stands.
 */
export class KitPage extends AdminComponent {
  render(): ReactNode {
    return (
      <KitFrame>
        <header className="fc-kitdoc__head">
          <h1 className="fc-kitdoc__h1">{KitCopy.t('page.kit')}</h1>
          <p className="fc-kitdoc__lead">{KitCopy.t('page.everyComponentOfTheConsole')}</p>
        </header>
        {KitCatalog.groups().map((group) => (
          <section key={group.name} className="fc-kitdoc__example">
            <h2 className="fc-kitdoc__h2">{group.name}</h2>
            <div className="fc-kitdoc__index">
              {group.docs.map((doc) => (
                <AdminLink key={doc.slug} href={`/kit/${doc.slug}`} className="fc-kitdoc__tile">
                  <span className="fc-kitdoc__tile-name">{doc.name}</span>
                  <span className="fc-kitdoc__tile-text">{doc.intro}</span>
                </AdminLink>
              ))}
            </div>
          </section>
        ))}
      </KitFrame>
    );
  }
}
