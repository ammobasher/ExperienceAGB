import { build } from 'esbuild';

await build({
  entryPoints: ['desktop/backend-entry.mjs'],
  outfile: '.desktop-build/backend.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  packages: 'external',
});
await build({
  entryPoints: ['desktop/runtime-entry.mjs'],
  outfile: '.desktop-build/runtime-check.mjs',
  bundle: true, platform: 'node', format: 'esm', target: 'node24', packages: 'external',
});
