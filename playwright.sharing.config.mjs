import {defineConfig} from '@playwright/test';
import base from './playwright.config.mjs';

// Exercise the production Worker without the dev server's single-user mock.
// Only this loopback test server accepts the simulated Sites identity headers.
export default defineConfig({
  ...base,
  testDir:'./tests/integration',
  outputDir:'artifacts/sharing-results',
  use:{...base.use,baseURL:'http://127.0.0.1:4174'},
  webServer:{
    command:'node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js dev --config dist/server/wrangler.json --local --persist-to .wrangler/sharing-tests --ip 127.0.0.1 --port 4174 --inspector-port 0',
    url:'http://127.0.0.1:4174',
    reuseExistingServer:false,
    timeout:30000,
  },
});
