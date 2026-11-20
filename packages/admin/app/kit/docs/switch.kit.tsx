import { KitCopy } from '@/app/kit/kit-copy';
import { Switch } from '@/components/ui/view/switch.client';
import { KitPlay } from '@/app/kit/view/kit-play.client';
import type { KitDoc } from '@/app/kit/kit-doc';

export class SwitchKit {
  static doc(): KitDoc {
    return {
      slug: 'switch', name: 'Switch', group: KitCopy.t('docs.switch.forms'),
      intro: KitCopy.t('docs.switch.aSingleThingThatIs'),
      from: "import { Switch } from '@fromcode119/sdk/admin';",
      examples: [
        { title: KitCopy.t('docs.switch.withALabel'), demo: <KitPlay initial={true}>{(value, set) => <Switch checked={value} onChange={set} label={KitCopy.t('docs.switch.soldOnline')} />}</KitPlay>, code: '<Switch checked={online} onChange={setOnline} label="Sold online" />' },
        { title: KitCopy.t('docs.switch.withADescription'), text: KitCopy.t('docs.switch.oneLineUnderTheLabel'), demo: <KitPlay initial={false}>{(value, set) => <Switch checked={value} onChange={set} label={KitCopy.t('docs.switch.giftCards')} description={KitCopy.t('docs.switch.letsCustomersPayWithA')} />}</KitPlay>, code: '<Switch checked={on} onChange={setOn} label="Gift cards" description="Lets customers pay with a gift card at checkout." />' },
        { title: KitCopy.t('docs.switch.states'), demo: <><Switch checked onChange={() => undefined} label={KitCopy.t('docs.switch.on')} /><Switch checked={false} onChange={() => undefined} label={KitCopy.t('docs.switch.off')} /><Switch checked disabled onChange={() => undefined} label={KitCopy.t('docs.switch.onDisabled')} /><Switch checked={false} disabled onChange={() => undefined} label={KitCopy.t('docs.switch.offDisabled')} /></>, code: '<Switch checked onChange={…} label="On" />\n<Switch checked disabled onChange={…} label="On, disabled" />' },
        { title: KitCopy.t('docs.switch.withoutALabel'), text: KitCopy.t('docs.switch.atTheEndOfA'), demo: <KitPlay initial={true}>{(value, set) => <Switch checked={value} onChange={set} />}</KitPlay>, code: '<Switch checked={enabled} onChange={setEnabled} />' },
      ],
      options: [
        { name: 'checked', type: 'boolean', does: KitCopy.t('docs.switch.whetherItIsOn') },
        { name: 'onChange', type: '(checked) => void | Promise', does: KitCopy.t('docs.switch.whatHappensWhenItIs') },
        { name: 'label', type: 'string', does: KitCopy.t('docs.switch.whatItSwitches') },
        { name: 'description', type: 'string', does: KitCopy.t('docs.switch.aLineUnderTheLabel') },
        { name: 'disabled', type: 'boolean', initial: 'false', does: KitCopy.t('docs.switch.notAvailable') },
      ],
    };
  }
}
