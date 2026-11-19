const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kortexSettings', {
  get: (key) => ipcRenderer.invoke('settings:get', key),
  set: (key, val) => ipcRenderer.invoke('settings:set', key, val),
  getAll: () => ipcRenderer.invoke('settings:getAll'),
  onChanged: (cb) => ipcRenderer.on('settings:changed', (e, data) => cb(data)),
  app: {
    relaunch: () => ipcRenderer.send('app:relaunch'),
    openDataFolder: () => ipcRenderer.send('app:openDataFolder')
  }
});