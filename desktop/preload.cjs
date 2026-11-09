const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('experienceAGBDesktop', {
  onAIConfigurationChanged(callback) {
    if (typeof callback !== 'function') throw new TypeError('Expected a configuration listener.');
    const listener = () => callback();
    ipcRenderer.on('agb:ai-configuration-changed', listener);
    return () => ipcRenderer.removeListener('agb:ai-configuration-changed', listener);
  },
});
