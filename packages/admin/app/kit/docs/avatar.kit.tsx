import { Avatar } from '@/components/ui/view/avatar.client';
import type { KitDoc } from '@/app/kit/kit-doc';

export class AvatarKit {
  static doc(): KitDoc {
    const sizes = ['2xsmall', 'xsmall', 'small', 'base', 'large', 'xlarge'] as const;
    return {
      slug: 'avatar', name: 'Avatar', group: 'Data',
      intro: 'A person, or a thing with a name, as a small square: its picture, or its initial when it has none.',
      from: "import { Avatar } from '@fromcode119/sdk/admin';",
      examples: [
        { title: 'Sizes', demo: <>{sizes.map((size) => <Avatar key={size} fallback="K" size={size} />)}</>, code: sizes.map((size) => `<Avatar fallback="K" size="${size}" />`).join('\n') },
        { title: 'Beside a name', text: 'In a table cell the avatar is `xsmall` and stands 8px before the name.', demo: <span className="fc-dt-who"><Avatar fallback="M" size="xsmall" /><span>Maria Petrova</span></span>, code: '<span className="fc-dt-who">\n  <Avatar fallback="M" size="xsmall" />\n  <span>Maria Petrova</span>\n</span>' },
      ],
      options: [
        { name: 'fallback', type: 'string', does: 'The initial shown when there is no picture.' },
        { name: 'src, alt', type: 'string', does: 'The picture and what it shows.' },
        { name: 'size', type: "2xsmall … xlarge", initial: 'base', does: 'Six sizes, from a table cell to a profile.' },
      ],
    };
  }
}
