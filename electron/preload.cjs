/**
 * Electron Preload Script for منظومة التدبير التربوي - مادة الرياضيات
 * Secure Context Isolation Bridge
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopBridge', {
    isDesktop: true,
    platform: process.platform,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node,

    // Desktop window actions
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    toggleFullscreen: () => ipcRenderer.send('window-fullscreen'),

    // Native file system integration
    saveBackupFile: (data, defaultFilename) => ipcRenderer.invoke('save-backup-file', { data, defaultFilename }),
    loadBackupFile: () => ipcRenderer.invoke('load-backup-file'),
    printPage: () => ipcRenderer.send('print-page'),

    // Event listener for menu triggers
    onMenuCommand: (callback) => {
        ipcRenderer.on('menu-command', (_event, command) => {
            if (typeof callback === 'function') callback(command);
        });
    }
});
