#!/usr/bin/env node
/**
 * Post-conversion fixups for oop-codemod output:
 *  1. Ensure `import React from 'react';` exists when the file references `React.`.
 *  2. Lift an inline object prop-type from the `const {...}: {TYPE} = this.props;` line into the
 *     class generic when the codemod defaulted it to `React.Component<{}>`.
 */
import { readFileSync, writeFileSync } from 'node:fs';

let touched = 0;
for (const file of process.argv.slice(2)) {
  let src = readFileSync(file, 'utf8');
  const orig = src;

  // (2) Lift inline prop type into the generic.
  if (src.includes('extends React.Component<{}>')) {
    const m = src.match(/const (\{[^}]*\}):\s*(\{[\s\S]*?\})\s*=\s*this\.props;/);
    if (m) {
      const inlineType = m[2];
      src = src.replace('extends React.Component<{}>', `extends React.Component<${inlineType}>`);
      src = src.replace(m[0], `const ${m[1]} = this.props;`);
    }
  }

  // (1) Add React import if `React.` is used but React isn't imported.
  if (/\bReact\./.test(src) && !/import\s+React[ ,]|import\s+\*\s+as\s+React\b|import\s+React\s+from/.test(src)) {
    if (/^"use client";/.test(src)) {
      src = src.replace(/^"use client";\s*\n/, `"use client";\n\nimport React from 'react';\n`);
    } else {
      src = `import React from 'react';\n` + src;
    }
  }

  if (src !== orig) { writeFileSync(file, src); console.log('FIXED', file); touched++; }
}
console.log(`\n${touched} files fixed`);
