import { NextResponse } from 'next/server';
import { IconNames } from '../../lib/icons';

export async function GET() {
  try {
    const content = `
/**
 * Framework Frontend Icon Registry Proxy (Client-side)
 * Maps 'lucide-react' imports to the centralized framework registry.
 */
const proxy = (name) => (props) => {
  const fn = window.getIcon;
  const Component = fn ? fn(name) : (window.FrameworkIcons ? window.FrameworkIcons[name] : null);
  return Component ? window.React.createElement(Component, props) : null;
};

${IconNames.map(name => `export const ${name} = proxy("${name}");`).join('\n')}

export default new Proxy({}, {
  get: (_, name) => proxy(name)
});
    `.trim();

    return new NextResponse(content, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'no-store, must-revalidate'
      }
    });

  } catch (err: any) {
    return new NextResponse('export default {};', { 
      status: 200, // Return 200 even on error to prevent module loading failures, but empty
      headers: { 'Content-Type': 'application/javascript' } 
    });
  }
}
