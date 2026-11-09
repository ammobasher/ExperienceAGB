const { basename, join } = require('node:path');

function localURL(value, origin, allowBlob = false) {
  try {
    const url = new URL(value);
    return !url.username && !url.password && url.origin === origin
      && (url.protocol === 'http:' || allowBlob && url.protocol === 'blob:');
  } catch { return false; }
}

function allowedPermission(permission, requestingOrigin, origin) {
  return permission === 'fullscreen' && localURL(requestingOrigin, origin);
}

function downloadName(value) {
  const name = basename(value.replaceAll('\\', '/')).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 180);
  return name && name !== '.' && name !== '..' ? name : 'ExperienceAGB-download';
}

function desktopRuntimePath(resources, platform, architecture) {
  if (!['win32', 'darwin'].includes(platform) || !['x64', 'arm64'].includes(architecture)) throw new Error('Unsupported desktop runtime platform.');
  return join(resources, 'app.asar.unpacked', 'node_modules', '@github', `copilot-sdk-${platform}-${architecture}`, 'prebuilds', `${platform}-${architecture}`, platform === 'win32' ? 'copilot-runtime.exe' : 'copilot-runtime');
}

module.exports = { localURL, allowedPermission, downloadName, desktopRuntimePath };
