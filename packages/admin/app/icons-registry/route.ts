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
  "ArrowLeft", "ArrowRight", "FileText", "LayoutTemplate", "Tag",
  "PlusCircle", "BarChart3", "Layers", "MoreVertical", "MoreHorizontal",
  "Circle", "CheckCircle", "AlertCircle", "HelpCircle", "Pencil", "Trash"
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

  // 1. Add named exports for common icons (fast path)
  commonIcons.forEach(name => {
    parts.push(`export const ${name} = proxy("${name}");`);
  });

  // 2. Automatically export all icons known by the framework
  // This ensures that any icon used via named import in a plugin 
  // will have a corresponding export.
  const otherIcons = IconNames.filter(name => 
    !commonIcons.includes(name) && 
    /^[A-Z]/.test(name) // Only export PascalCase names (likely icons)
  );

  otherIcons.forEach(name => {
    parts.push(`export const ${name} = proxy("${name}");`);
  });

  parts.push(``);
  parts.push(`// Default export is a Proxy for dynamic icon access`);
  parts.push(`export default new Proxy({}, { get: (_, name) => proxy(name) });`);

  return parts.join('\n');
};

const cachedContent = generateRegistryContent();

export async function GET() {
  return new NextResponse(cachedContent, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store, must-revalidate',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
