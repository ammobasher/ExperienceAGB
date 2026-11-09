const { app, BrowserWindow, Menu, dialog, session } = require('electron');
const { rm } = require('node:fs/promises');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { localURL, allowedPermission, downloadName, desktopRuntimePath } = require('./policy.cjs');

app.setName('Experience AGB');
let host, window, origin, desktopSession, sessionDirectory;
let quitting = false;
let credentialDialog = false;
let backend;

function showError(message) {
  console.error(message);
  dialog.showErrorBox('Experience AGB', message);
}
function notifyConfigurationChanged() {
  if (window && !window.isDestroyed()) window.webContents.send('agb:ai-configuration-changed');
}
async function configureAI(clear = false) {
  if (credentialDialog || quitting) return;
  credentialDialog = true;
  try {
    if (clear) {
      host.configureCredentials({ apiKey: '', copilotToken: '' });
    } else {
      const approval = await dialog.showMessageBox(window, {
        type: 'info', title: 'Optional AI credentials', buttons: ['Choose credential file', 'Cancel'], defaultId: 1, cancelId: 1,
        message: 'Load explicit provider credentials for this app session?',
        detail: 'Select a local JSON file containing copilotToken and/or anthropicApiKey. Credentials remain in the desktop backend memory until cleared or the app quits; this app does not save them. The selected file persists on disk. Loading credentials does not send an inference request. Each AI request still requires the existing on-screen approvals.',
      });
      if (approval.response !== 0) return;
      const selected = await dialog.showOpenDialog(window, { title: 'Choose private AI credential JSON', properties: ['openFile'], filters: [{ name: 'JSON credential file', extensions: ['json'] }] });
      if (selected.canceled || selected.filePaths.length !== 1) return;
      const credentials = await backend.readDesktopCredentials(selected.filePaths[0]);
      host.configureCredentials(credentials);
    }
    notifyConfigurationChanged();
    await dialog.showMessageBox(window, { type: 'info', title: 'AI configuration', message: clear ? 'AI credentials cleared.' : 'AI credentials loaded for this session only.', detail: 'Local model and profile state are unchanged. Previous AI output and approvals have been cleared; no inference request was sent.' });
  } catch (error) {
    const safeMessages = [
      'Credential file exceeds 4 KiB.',
      'Credential file must be valid JSON without duplicate keys.',
      'Credential file supports only copilotToken and anthropicApiKey.',
      'Supplied credentials must be nonempty strings of at most 512 characters, without surrounding whitespace or line breaks.',
      'Supply at least one explicit provider credential.',
      'Cancel or finish the active AI request before changing credentials.',
    ];
    showError(safeMessages.includes(error.message) ? error.message : 'The credential file could not be loaded. Previous credentials are unchanged.');
  } finally { credentialDialog = false; }
}
function installMenu() {
  const file = { label: 'File', submenu: [
    { label: 'Load AI credentials...', click: () => void configureAI() },
    { label: 'Clear AI credentials', click: () => void configureAI(true) },
    { type: 'separator' }, { role: 'close' },
  ] };
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    file, { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { role: 'windowMenu' },
    { label: 'Help', submenu: [{ label: 'About Experience AGB', click: () => app.showAboutPanel() }] },
    ...(process.platform !== 'darwin' ? [{ label: 'Quit', click: () => app.quit() }] : []),
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
async function openWindow() {
  window = new BrowserWindow({
    title: 'Experience AGB', width: 1440, height: 1000, minWidth: 360, minHeight: 500, show: false, backgroundColor: '#f4f7fb',
    webPreferences: {
      session: desktopSession, preload: join(__dirname, 'preload.cjs'),
      nodeIntegration: false, nodeIntegrationInWorker: false, contextIsolation: true, sandbox: true,
      webSecurity: true, allowRunningInsecureContent: false, webviewTag: false, navigateOnDragDrop: false,
    },
  });
  const blockedNavigation = () => void dialog.showMessageBox(window, {
    type: 'info', title: 'External page blocked', message: 'Only this app\'s bundled pages can open in the desktop window.',
    detail: 'External source links are not opened automatically. Consult the project documentation in your regular browser.',
  });
  window.webContents.setWindowOpenHandler(() => { blockedNavigation(); return { action: 'deny' }; });
  window.webContents.on('will-navigate', (event, url) => { if (!localURL(url, origin)) { event.preventDefault(); blockedNavigation(); } });
  window.webContents.on('will-redirect', (event, url) => { if (!localURL(url, origin)) { event.preventDefault(); blockedNavigation(); } });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.on('render-process-gone', () => showError('The app view stopped unexpectedly. Use View > Reload to reopen it; unsaved model/profile state is lost.'));
  window.on('closed', () => { window = undefined; });
  await window.loadURL(origin + '/');
  window.show();
}
async function start() {
  sessionDirectory = mkdtempSync(join(tmpdir(), 'experience-agb-desktop-'));
  app.setPath('sessionData', sessionDirectory);
  backend = await import(pathToFileURL(join(app.getAppPath(), app.isPackaged ? 'desktop/backend.mjs' : '.desktop-build/backend.mjs')).href);
  host = backend.createAIHost({
    root: join(app.getAppPath(), 'dist'),
    credentialSetup: 'Desktop: use File > Load AI credentials to select an explicitly approved local credential JSON. Credentials stay in backend memory for this session; no terminal or server restart is needed.',
    credentialSource: 'desktop session only; explicitly selected credential file',
    copilotRuntimePath: app.isPackaged ? desktopRuntimePath(process.resourcesPath, process.platform, process.arch) : undefined,
  });
  await new Promise((resolve, reject) => { host.server.once('error', reject); host.server.listen(0, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${host.server.address().port}`;
  desktopSession = session.fromPartition(`experience-agb-${randomUUID()}`, { cache: false });
  desktopSession.setPermissionRequestHandler((contents, permission, callback, details) => callback(
    contents === window?.webContents && allowedPermission(permission, details.requestingUrl, origin),
  ));
  desktopSession.setPermissionCheckHandler((contents, permission, requestingOrigin) => contents === window?.webContents && allowedPermission(permission, requestingOrigin, origin));
  desktopSession.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => callback({ cancel: !localURL(details.url, origin, true) }));
  desktopSession.on('will-download', (event, item, contents) => {
    if (contents !== window?.webContents || !localURL(item.getURL(), origin, true) || !item.getURL().startsWith('blob:')) { event.preventDefault(); return; }
    item.setSaveDialogOptions({ title: 'Save explicitly prepared local download', defaultPath: join(app.getPath('downloads'), downloadName(item.getFilename())) });
    item.once('done', (_event, state) => { if (state !== 'completed' && state !== 'cancelled') showError('The prepared download could not be saved. Prepare it again and choose an available destination.'); });
  });
  app.setAboutPanelOptions({
    applicationName: 'Experience AGB', applicationVersion: app.getVersion(),
    copyright: 'ExperienceAGB contributors',
    credits: 'Local-first exploratory AGB viewer. Scoring and companion propensity mappings remain unverified previews. AI is optional and requires separate approval. No automatic updater or raw-model upload.',
  });
  installMenu();
  await openWindow();
  app.on('activate', () => { if (!window && !quitting) void openWindow().catch(() => { showError('The app window could not be opened.'); app.quit(); }); });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => app.quit());
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('before-quit', event => {
    if (quitting) return;
    event.preventDefault(); quitting = true;
    void (async () => {
      try { await host?.close(); }
      catch { console.error('The desktop backend could not finish cleanup.'); }
      try { await desktopSession?.clearStorageData(); await desktopSession?.clearCache(); }
      catch { console.error('The desktop session cache could not be cleared.'); }
      if (window && !window.isDestroyed()) window.destroy();
      if (sessionDirectory) {
        try { await rm(sessionDirectory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
        catch { console.error('The temporary desktop session directory could not be removed.'); }
      }
      app.quit();
    })();
  });
  void app.whenReady().then(start).catch(() => { showError('Experience AGB could not start its packaged local backend. Reinstall the app, or rebuild it with npm run desktop:build.'); app.quit(); });
}
