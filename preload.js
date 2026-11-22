const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  windowMin: () => ipcRenderer.send('window-min'),
  windowMax: () => ipcRenderer.send('window-max'),
  windowClose: () => ipcRenderer.send('window-close'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  getRealPasswords: () => ipcRenderer.invoke('get-real-passwords'),
  chat: (p) => ipcRenderer.invoke('chat', p),
  onChatChunk: (cb) => ipcRenderer.on('chat-chunk', (e, d) => cb(d)),
  onChatDone: (cb) => ipcRenderer.on('chat-done', (e, d) => cb(d))
});