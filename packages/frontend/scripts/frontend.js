#!/usr/bin/env node
'use strict';

// Run the Next.js frontend from its own package directory.
const path = require('path');
const { spawn } = require('child_process');

const pkgDir = path.resolve(__dirname, '..');
const port = process.env.FRONTEND_PORT || process.env.PORT || '3002';
const cmd = process.env.NODE_ENV === 'production' ? 'start' : 'dev';

let nextBin;
try {
  nextBin = require.resolve('next/dist/bin/next', { paths: [pkgDir] });
} catch {
  console.error('[fromcode-frontend] Could not resolve the "next" binary. Run: npm install inside @fromcode119/frontend');
  process.exit(1);
}

const args = cmd === 'start' ? [nextBin, 'start', '-p', port] : [nextBin, 'dev', '--webpack', '-H', '0.0.0.0', '-p', port];

const child = spawn(process.execPath, args, {
  cwd: pkgDir,
  stdio: 'inherit',
  env: { ...process.env, PORT: port },
});

child.on('exit', code => process.exit(code ?? 0));
