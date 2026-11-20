import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { CodeBlock } from '@/components/ui/view/code-block.client';
import type { KitExample } from '@/app/kit/kit-example';

/** One example on a component's page: its name, a line about it, the component, and how it is written. */
export class KitExampleView extends PureReactor {
  @prop declare example: KitExample;

  /** A name between backticks is printed as code. */
  private static said(text: string): ReactNode {
    return text.split('`').map((part, index) => (index % 2 ? <code key={index}>{part}</code> : part));
  }

  render(): ReactNode {
    const { title, text, demo, code, flush } = this.example;
    return (
      <section className="fc-kitdoc__example" id={title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}>
        <h2 className="fc-kitdoc__h2">{title}</h2>
        {text ? <p className="fc-kitdoc__text">{KitExampleView.said(text)}</p> : null}
        <div className={`fc-kitdoc__demo${flush ? ' fc-kitdoc__demo--flush' : ''}`}>{demo}</div>
        {code ? <CodeBlock code={code} /> : null}
      </section>
    );
  }
}
