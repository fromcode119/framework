import { KitCopy } from '@/app/kit/kit-copy';
import type { ReactNode } from 'react';
import { prop, state } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { DataTable } from '@/components/ui/view/data-table.client';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { StatePage } from '@/components/ui/view/state-page.client';
import { CodeBlock } from '@/components/ui/view/code-block.client';
import { KitCatalog } from '@/app/kit/kit-catalog';
import { KitFrame } from '@/app/kit/view/kit-frame.client';
import { KitExampleView } from '@/app/kit/view/kit-example.client';

/** One component's page: what it is, each way of using it with the code for it, and every option it takes. */
export class KitComponentPage extends AdminComponent {
  @prop declare params: Promise<{ component: string }>;
  @state private slug = '';

  async componentDidMount(): Promise<void> {
    this.slug = decodeURIComponent((await this.params).component);
  }

  render(): ReactNode {
    if (!this.slug) return null;
    const doc = KitCatalog.find(this.slug);
    if (!doc) return <KitFrame current={this.slug}><StatePage title={KitCopy.t('component.noSuchComponent')} hint={KitCopy.t('component.noPage', { slug: this.slug })} /></KitFrame>;
    return (
      <KitFrame current={doc.slug}>
        <header className="fc-kitdoc__head">
          <p className="fc-kitdoc__eyebrow">{doc.group}</p>
          <h1 className="fc-kitdoc__h1">{doc.name}</h1>
          <p className="fc-kitdoc__lead">{doc.intro}</p>
          <CodeBlock code={doc.from} />
        </header>
        {doc.examples.map((example) => <KitExampleView key={example.title} example={example} />)}
        {doc.options.length ? (
          <section className="fc-kitdoc__example" id="options">
            <h2 className="fc-kitdoc__h2">{KitCopy.t('component.options')}</h2>
            <ListShell>
              <DataTable
                cards={false}
                columns={[
                  { header: 'Option', id: 'name', accessor: (row: any) => <code className="fc-kitdoc__code">{row.name}</code> },
                  { header: 'Takes', id: 'type', accessor: (row: any) => <code className="fc-kitdoc__code">{row.type}</code> },
                  { header: 'When left out', id: 'initial', accessor: (row: any) => row.initial || '—' },
                  { header: 'What it does', id: 'does', className: 'fc-dt-fill fc-dt-wrap', accessor: (row: any) => row.does },
                ] as any}
                data={doc.options.map((option) => ({ id: option.name, ...option }))}
              />
            </ListShell>
          </section>
        ) : null}
      </KitFrame>
    );
  }
}
