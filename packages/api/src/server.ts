import { APIServer } from './index';

APIServer.bootstrap().catch(err => {
  console.error('Unhandled exception during bootstrap execution:', err);
  process.exit(1);
});
