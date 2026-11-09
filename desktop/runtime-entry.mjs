import { CopilotClient, RuntimeConnection } from '@github/copilot-sdk';
import { childEnvironment } from '../scripts/copilot.ts';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

globalThis.probeVirtualRuntime = path => new Promise(resolve => {
  const child = spawn(path, ['--version'], { stdio: 'ignore', windowsHide: true });
  child.once('error', error => resolve(error.code));
  child.once('exit', () => resolve('unexpected-execution'));
});
globalThis.verifyBundledRuntime = async path => {
  const directory = await mkdtemp(join(tmpdir(), 'experience-agb-packaged-runtime-test-'));
  const home = join(directory, 'home'), workspace = join(directory, 'workspace');
  await Promise.all([mkdir(home), mkdir(workspace)]);
  const client = new CopilotClient({
    connection: RuntimeConnection.forStdio({ path }),
    mode: 'empty', baseDirectory: home, workingDirectory: workspace, env: childEnvironment(process.env, home),
    useLoggedInUser: false, logLevel: 'none',
  });
  let authenticated;
  try { await client.start(); authenticated = (await client.getAuthStatus()).isAuthenticated; }
  finally {
    try {
      const errors = await client.stop();
      if (errors.length) { await client.forceStop(); throw new Error('Bundled Copilot runtime could not stop gracefully.'); }
    } finally { await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  }
  return { authenticated, stopped: true };
};
