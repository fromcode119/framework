import { NextResponse } from 'next/server';
import { IconNames } from '../../lib/icons';

/**
 * Framework Icon Registry Proxy (Client-side)
 * This route generates an ESM module that proxies 'lucide-react' imports
 * to the centralized framework icon registry (window.FrameworkIcons).
 */

const commonIcons = [
  "Search", "Plus", "Trash2", "Loader2", "Save", "Edit", 
  "Settings", "Layout", "Shield", "User", "Activity", "Check",
  "X", "ChevronDown", "ChevronUp", "ChevronRight", "ChevronLeft",
  "ArrowLeft", "ArrowRight", "FileText", "LayoutTemplate", "Tag"
];

// Pre-compute the JS content to avoid expensive string operations per request
const generateRegistryContent = () => {
  const parts = [
    `/** Framework Icon Registry Proxy */`,
    `const proxy = (name) => (props) => {`,
    `  const fn = window.getIcon;`,
    `  const Component = fn ? fn(name) : (window.FrameworkIcons ? window.FrameworkIcons[name] : null);`,
    `  if (!Component && window.console) {`,
    `    if (!window._missingIcons) window._missingIcons = new Set();`,
    `    if (!window._missingIcons.has(name)) {`,
    `      window._missingIcons.add(name);`,
    `      console.warn(\`[Icons] Icon "\${name}" not found. Rendering null.\`);`,
    `    }`,
    `  }`,
    `  return Component ? window.React.createElement(Component, props) : null;`,
    `};`,
    ``
  ];

  // Add named exports for common icons
  commonIcons.forEach(name => {
    parts.push(`export const ${name} = proxy("${name}");`);
  });

  // Add all other icons from the framework library
  const otherIcons = IconNames.filter(name => 
    !commonIcons.includes(name) && 
    /^[A-Z]/.test(name) // Only export PascalCase names (likely icons)
  );

  otherIcons.forEach(name => {
    parts.push(`export const ${name} = proxy("${name}");`);
  });

  parts.push(``);
  parts.push(`export default new Proxy({}, { get: (_, name) => proxy(name) });`);

  return parts.join('\n');
};

const cachedContent = generateRegistryContent();

export async function GET() {
  return new NextResponse(cachedContent, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-store, must-revalidate',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
