import { CopilotClient, RuntimeConnection } from '@github/copilot-sdk';
import { childEnvironment } from '../scripts/copilot.ts';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { app } from 'electron';

app.setPath('userData', process.env.DESKTOP_RUNTIME_TEST_PROFILE);
app.setPath('sessionData', process.env.DESKTOP_RUNTIME_TEST_PROFILE);
globalThis.probeVirtualRuntime = path => new Promise((resolve, reject) => {
  const failed = error => ['ENOENT', 'ENOTDIR'].includes(error.code) ? resolve(error.code) : reject(error);
  let child;
  try { child = spawn(path, ['--version'], { stdio: 'ignore', windowsHide: true }); }
  catch (error) { failed(error); return; }
  child.once('error', failed);
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
