import { Switch } from '@/components/ui/view/switch.client';
import { KitPlay } from '@/app/kit/view/kit-play.client';
import type { KitDoc } from '@/app/kit/kit-doc';

export class SwitchKit {
  static doc(): KitDoc {
    return {
      slug: 'switch', name: 'Switch', group: 'Forms',
      intro: 'A single thing that is on or off, in force the moment it is flipped. For a choice among several use Checkbox.',
      from: "import { Switch } from '@fromcode119/sdk/admin';",
      examples: [
        { title: 'With a label', demo: <KitPlay initial={true}>{(value, set) => <Switch checked={value} onChange={set} label="Sold online" />}</KitPlay>, code: '<Switch checked={online} onChange={setOnline} label="Sold online" />' },
        { title: 'With a description', text: 'One line under the label for what flipping it does.', demo: <KitPlay initial={false}>{(value, set) => <Switch checked={value} onChange={set} label="Gift cards" description="Lets customers pay with a gift card at checkout." />}</KitPlay>, code: '<Switch checked={on} onChange={setOn} label="Gift cards" description="Lets customers pay with a gift card at checkout." />' },
        { title: 'States', demo: <><Switch checked onChange={() => undefined} label="On" /><Switch checked={false} onChange={() => undefined} label="Off" /><Switch checked disabled onChange={() => undefined} label="On, disabled" /><Switch checked={false} disabled onChange={() => undefined} label="Off, disabled" /></>, code: '<Switch checked onChange={…} label="On" />\n<Switch checked disabled onChange={…} label="On, disabled" />' },
        { title: 'Without a label', text: 'At the end of a row that already names the thing.', demo: <KitPlay initial={true}>{(value, set) => <Switch checked={value} onChange={set} />}</KitPlay>, code: '<Switch checked={enabled} onChange={setEnabled} />' },
      ],
      options: [
        { name: 'checked', type: 'boolean', does: 'Whether it is on.' },
        { name: 'onChange', type: '(checked) => void | Promise', does: 'What happens when it is flipped; may be async.' },
        { name: 'label', type: 'string', does: 'What it switches.' },
        { name: 'description', type: 'string', does: 'A line under the label.' },
        { name: 'disabled', type: 'boolean', initial: 'false', does: 'Not available.' },
      ],
    };
  }
}
