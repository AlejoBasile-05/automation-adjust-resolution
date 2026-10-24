const path = require('path');

const { app, BrowserWindow, Menu, dialog } = require('electron');

// Disable GPU/hardware acceleration for Linux headless/CI environments.
// Must be called before app.whenReady() or BrowserWindow creation.
if (process.platform === 'linux') {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('ozone-platform', 'x11');
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-software-rasterizer');
  app.commandLine.appendSwitch('disable-dev-shm-usage');
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('disable-gpu-compositing');
}

const { start, resolveConfigPath } = require('../src/server');
const { createElectronPicker } = require('./pickFolder');

const WINDOW_OPTIONS = {
  width: 1180,
  height: 820,
  minWidth: 960,
  minHeight: 640,
  show: false,
  backgroundColor: '#0f1115',
  title: 'Ajuste de resolución',
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
  },
};

let mainWindow = null;
let httpServer = null;
let serverPort = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', focusMainWindow);
  app.whenReady().then(bootstrap).catch(reportStartupFailure);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('before-quit', closeServer);
}

async function bootstrap() {
  const configPath = resolveConfigPath(app.getPath('userData'));
  // When packaged, extraResources are at process.resourcesPath
  // In development, they're at __dirname/../frontend/dist
  const isPackaged = app.isPackaged;
  const staticDir = isPackaged
    ? path.join(process.resourcesPath, 'frontend', 'dist')
    : path.join(__dirname, '..', 'frontend', 'dist');
  const pickFolder = createElectronPicker({
    // Bound through an arrow: a detached native method is not guaranteed to
    // keep its receiver across Electron versions.
    showOpenDialog: (...args) => dialog.showOpenDialog(...args),
    getWindow: () => mainWindow,
  });

  httpServer = await start({ port: 0, configPath, staticDir, pickFolder });
  serverPort = httpServer.address().port;

  createWindow();
  Menu.setApplicationMenu(null);
}

function createWindow() {
  mainWindow = new BrowserWindow(WINDOW_OPTIONS);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.loadURL(`http://127.0.0.1:${serverPort}`).catch(reportStartupFailure);
}

function focusMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function closeServer() {
  if (!httpServer) return;
  httpServer.close();
  httpServer = null;
}

function reportStartupFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  dialog.showErrorBox('No se pudo iniciar la aplicación', message);
  app.exit(1);
}
