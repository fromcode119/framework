import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminLink } from '@/components/view/admin-link.client';
import { KitCatalog } from '@/app/kit/kit-catalog';

/** The kit's own frame: the list of components at the side, one component's page beside it. */
export class KitFrame extends PureReactor {
  @prop declare children: ReactNode;
  /** The component on show, so its row in the list is marked. */
  @prop declare current?: string;

  render(): ReactNode {
    return (
      <div className="fc-kitdoc">
        <nav className="fc-kitdoc__nav" aria-label="Kit">
          <AdminLink href="/kit" className={`fc-kitdoc__link${this.current ? '' : ' fc-kitdoc__link--on'}`}>Overview</AdminLink>
          {KitCatalog.groups().map((group) => (
            <div key={group.name} className="fc-kitdoc__group">
              <p className="fc-kitdoc__group-name">{group.name}</p>
              {group.docs.map((doc) => (
                <AdminLink key={doc.slug} href={`/kit/${doc.slug}`} className={`fc-kitdoc__link${doc.slug === this.current ? ' fc-kitdoc__link--on' : ''}`}>{doc.name}</AdminLink>
              ))}
            </div>
          ))}
          <div className="fc-kitdoc__group">
            <p className="fc-kitdoc__group-name">Not yet split</p>
            <AdminLink href="/kit/all" className={`fc-kitdoc__link${this.current === 'all' ? ' fc-kitdoc__link--on' : ''}`}>The old sheet</AdminLink>
          </div>
        </nav>
        <div className="fc-kitdoc__main">{this.children}</div>
      </div>
    );
  }
}
