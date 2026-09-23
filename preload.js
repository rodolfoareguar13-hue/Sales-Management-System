const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // API expuesta al frontend si es necesario
});

