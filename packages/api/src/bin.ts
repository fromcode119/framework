#!/usr/bin/env node
import { bootstrap } from './index';

bootstrap().catch(err => {
  console.error('Unhandled exception during bootstrap execution:', err);
  process.exit(1);
});
