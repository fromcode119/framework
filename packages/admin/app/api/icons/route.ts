import { NextResponse } from 'next/server';
import { IconNames } from '../../../lib/icons';

export async function GET() {
  try {
    const content = `
      /**
       * Framework Icon Proxy Bridge
       * Satisfies 'lucide-react' imports for plugins via importmap redirection.
       */
      const getIcon = (window.getIcon) || ((n) => () => null);
      
      // Named exports for all requested icons
      ${IconNames.map(name => `export const ${name} = getIcon("${name}");`).join('\n')}
      
      // Default export for 'import Lucide from "lucide-react"'
      const icons = new Proxy({}, {
          get: (_, name) => getIcon(name)
      });
      
      export default icons;
    `.trim();

    return new NextResponse(content, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'no-store, must-revalidate'
      }
    });

  } catch (err: any) {
    return new NextResponse('export default {};', {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript'
      }
    });
  }
}
