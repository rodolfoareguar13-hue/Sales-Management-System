const { app, BrowserWindow } = require('electron');
app.disableHardwareAcceleration(); 
const path = require('path');
const express = require('express');
const cors = require('cors');

let mainWindow;
let server;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'icon.ico')
  });

  // Iniciar servidor Express local
  const expressApp = express();
  expressApp.use(cors());
  expressApp.use(express.json());

  // Cargar rutas de la API
  require('./server/routes')(expressApp);

  // Servir frontend después de montar la API para evitar conflictos con /api
  const publicPath = path.join(__dirname, 'public');
  expressApp.use(express.static(publicPath));
  expressApp.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'Ruta API no encontrada' });
    }
    res.sendFile(path.join(publicPath, 'index.html'));
  });

  server = expressApp.listen(3000, () => {
    console.log('Servidor local en puerto 3000');
  });

  mainWindow.loadURL('http://localhost:3000');
  
  // mainWindow.webContents.openDevTools(); // Descomentar para debug

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (server) {
      server.close();
    }
    app.quit();
  }
});

app.on('before-quit', () => {
  if (server) {
    server.close();
  }
});

