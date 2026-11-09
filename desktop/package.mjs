import { build as packageApp, Platform, Arch } from 'electron-builder';
import { flipFuses, FuseVersion, FuseV1Options } from '@electron/fuses';
import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const [platform, architecture] = process.argv.slice(2);
if (!['win32', 'darwin'].includes(platform) || !['x64', 'arm64'].includes(architecture) || platform === 'win32' && architecture !== 'x64') {
  throw new Error('Use win32 x64, darwin x64 or darwin arm64.');
}
if (platform === 'darwin' && process.platform !== 'darwin') {
  throw new Error('macOS packaging requires a Mac. Run the Intel/Apple Silicon commands on macOS or publish and dispatch the Desktop installers workflow.');
}
async function npm(args, cwd = process.cwd()) {
  await new Promise((done, fail) => {
    const child = process.platform === 'win32'
      ? spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'npm ' + args.join(' ')], { cwd, stdio: 'inherit' })
      : spawn('npm', args, { cwd, stdio: 'inherit' });
    child.once('error', fail); child.once('exit', code => code === 0 ? done() : fail(new Error(`Packaging preparation failed (${code}).`)));
  });
}
await npm(['run', 'desktop:build']);
const manifest = JSON.parse(await readFile('package.json', 'utf8'));
const stage = resolve('.desktop-build', `${platform}-${architecture}`);
await mkdir(join(stage, 'desktop'), { recursive: true });
await Promise.all([
  cp('dist', join(stage, 'dist'), { recursive: true, force: true }),
  ...['main.cjs', 'preload.cjs', 'policy.cjs'].map(name => cp(join('desktop', name), join(stage, 'desktop', name))),
  cp('.desktop-build/backend.mjs', join(stage, 'desktop/backend.mjs')),
  cp('package.json', join(stage, 'package.json')),
  cp('package-lock.json', join(stage, 'package-lock.json')),
]);
await npm(['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', `--os=${platform}`, `--cpu=${architecture}`], stage);
const nativeMac = platform === 'darwin';
const target = platform === 'win32' ? Platform.WINDOWS : Platform.MAC;
await packageApp({
  targets: target.createTarget(platform === 'win32' ? ['nsis', 'portable'] : ['dmg', 'zip'], architecture === 'x64' ? Arch.x64 : Arch.arm64),
  publish: 'never',
  config: {
    appId: 'io.github.ammobasher.experienceagb',
    productName: 'Experience AGB',
    executableName: 'ExperienceAGB',
    electronVersion: manifest.devDependencies.electron,
    directories: { app: stage, output: 'release' },
    files: ['dist/**/*', 'desktop/*.cjs', 'desktop/backend.mjs', 'package.json'],
    asar: true,
    asarUnpack: ['node_modules/@github/copilot-sdk-*/**/*', 'node_modules/@koromix/**/*', 'node_modules/koffi/**/*'],
    npmRebuild: false,
    win: { signAndEditExecutable: false },
    nsis: { oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true, createDesktopShortcut: true, artifactName: 'ExperienceAGB-${version}-win-${arch}-Setup.${ext}' },
    portable: { artifactName: 'ExperienceAGB-${version}-win-${arch}-Portable.${ext}' },
    mac: {
      category: 'public.app-category.developer-tools',
      minimumSystemVersion: '13.0',
      identity: nativeMac ? '-' : null,
      hardenedRuntime: false,
      artifactName: 'ExperienceAGB-${version}-mac-${arch}.${ext}',
    },
    afterPack: async context => {
      const resources = platform === 'darwin'
        ? join(context.appOutDir, 'ExperienceAGB.app', 'Contents', 'Resources')
        : join(context.appOutDir, 'resources');
      const runtimeDirectory = join(resources, 'app.asar.unpacked', 'node_modules', '@github', `copilot-sdk-${platform}-${architecture}`, 'prebuilds', `${platform}-${architecture}`);
      await Promise.all(['runtime.node', platform === 'win32' ? 'copilot-runtime.exe' : 'copilot-runtime'].map(name => access(join(runtimeDirectory, name))));
      const executable = platform === 'darwin' ? join(context.appOutDir, 'ExperienceAGB.app') : join(context.appOutDir, 'ExperienceAGB.exe');
      await flipFuses(executable, {
        version: FuseVersion.V1,
        [FuseV1Options.RunAsNode]: false,
        [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
        [FuseV1Options.EnableNodeCliInspectArguments]: false,
        [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
        [FuseV1Options.OnlyLoadAppFromAsar]: true,
        [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
      });
    },
  },
});
await writeFile(join('release', `${platform}-${architecture}-build.json`), JSON.stringify({
  application: 'Experience AGB', version: manifest.version, platform, architecture,
  electron: manifest.devDependencies.electron, nativeBuild: process.platform === platform,
  developerIdentitySigned: false, notarized: false,
}, null, 2));
