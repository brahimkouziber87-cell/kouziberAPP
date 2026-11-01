/**
 * ====================================================================
 * تطبيق سطح المكتب - منظومة التدبير التربوي لمادة الرياضيات
 * Desktop Application Main Process (Electron)
 * ====================================================================
 */

const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

function getAppIconPath() {
    const iconPng = path.join(__dirname, '../public/pwa-512x512.png');
    if (fs.existsSync(iconPng)) return iconPng;
    const favicon = path.join(__dirname, '../public/favicon.png');
    if (fs.existsSync(favicon)) return favicon;
    return null;
}

function createWindow() {
    const iconPath = getAppIconPath();

    mainWindow = new BrowserWindow({
        width: 1360,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        title: 'منظومة التدبير التربوي - مادة الرياضيات (تطبيق مكتبي)',
        icon: iconPath,
        backgroundColor: '#0f172a',
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true,
            spellcheck: false
        }
    });

    // Determine target URL: local dev server or production dist/index.html
    const devUrl = 'http://localhost:3000';
    const distIndexPath = path.join(__dirname, '../dist/index.html');
    const rootIndexPath = path.join(__dirname, '../index.html');

    // Determine target URL: instantaneous load of production bundle, or dev server if flag is active
    if (process.env.ELECTRON_DEV === 'true') {
        fetch(devUrl)
            .then(() => mainWindow.loadURL(devUrl))
            .catch(() => {
                if (fs.existsSync(distIndexPath)) mainWindow.loadFile(distIndexPath);
                else mainWindow.loadFile(rootIndexPath);
            });
    } else if (fs.existsSync(distIndexPath)) {
        mainWindow.loadFile(distIndexPath);
    } else if (fs.existsSync(rootIndexPath)) {
        mainWindow.loadFile(rootIndexPath);
    } else {
        mainWindow.loadURL(devUrl);
    }

    // Set custom Arabic Application Menu
    buildAppMenu();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Open external links in default browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http:') || url.startsWith('https:')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });
}

function buildAppMenu() {
    const template = [
        {
            label: 'ملف (Fichier)',
            submenu: [
                {
                    label: '💾 حفظ نسخة احتياطية محلية',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => mainWindow && mainWindow.webContents.send('menu-command', 'save-backup')
                },
                {
                    label: '📂 استرجاع بيانات من ملف',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => mainWindow && mainWindow.webContents.send('menu-command', 'load-backup')
                },
                { type: 'separator' },
                {
                    label: '🖨️ طباعة الصفحة أو التقرير',
                    accelerator: 'CmdOrCtrl+P',
                    click: () => mainWindow && mainWindow.webContents.print()
                },
                { type: 'separator' },
                {
                    label: 'خروج من التطبيق',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
                    click: () => app.quit()
                }
            ]
        },
        {
            label: 'تحرير (Édition)',
            submenu: [
                { role: 'undo', label: 'تراجع (Annuler)' },
                { role: 'redo', label: 'إعادة (Rétablir)' },
                { type: 'separator' },
                { role: 'cut', label: 'قص (Couper)' },
                { role: 'copy', label: 'نسخ (Copier)' },
                { role: 'paste', label: 'لصق (Coller)' },
                { role: 'selectAll', label: 'تحديد الكل (Sélectionner tout)' }
            ]
        },
        {
            label: 'أقسام المنظومة (Modules)',
            submenu: [
                {
                    label: '🏠 لوحة القيادة والصفحة الرئيسية',
                    accelerator: 'CmdOrCtrl+1',
                    click: () => mainWindow && mainWindow.webContents.send('menu-command', 'nav-home')
                },
                {
                    label: '👥 لائحة التلاميذ والحصص',
                    accelerator: 'CmdOrCtrl+2',
                    click: () => mainWindow && mainWindow.webContents.send('menu-command', 'nav-students')
                },
                {
                    label: '📅 جدول الحصص والأنشطة',
                    accelerator: 'CmdOrCtrl+3',
                    click: () => mainWindow && mainWindow.webContents.send('menu-command', 'nav-timetable')
                },
                {
                    label: '📐 السبورة التفاعلية لمادة الرياضيات',
                    accelerator: 'CmdOrCtrl+4',
                    click: () => mainWindow && mainWindow.webContents.send('menu-command', 'nav-whiteboard')
                },
                {
                    label: '📖 دفتر النصوص الرقمي الرسمي',
                    accelerator: 'CmdOrCtrl+5',
                    click: () => mainWindow && mainWindow.webContents.send('menu-command', 'nav-logbook')
                },
                {
                    label: '🗓️ التوزيع السنوي والتقويم المغربي',
                    accelerator: 'CmdOrCtrl+6',
                    click: () => mainWindow && mainWindow.webContents.send('menu-command', 'nav-annual')
                }
            ]
        },
        {
            label: 'السبورة التفاعلية (Tableau Math)',
            submenu: [
                {
                    label: '🖊️ قلم الكتابة والحل',
                    click: () => mainWindow && mainWindow.webContents.send('menu-command', 'wb-pen')
                },
                {
                    label: '🧹 ممحاة ذكية',
                    click: () => mainWindow && mainWindow.webContents.send('menu-command', 'wb-eraser')
                },
                {
                    label: '📏 إظهار/إخفاء المسطرة التفاعلية',
                    click: () => mainWindow && mainWindow.webContents.send('menu-command', 'wb-ruler')
                },
                {
                    label: '📐 إظهار/إخفاء الكوس الهندسي 90°',
                    click: () => mainWindow && mainWindow.webContents.send('menu-command', 'wb-setsquare')
                },
                {
                    label: '📐 إظهار/إخفاء المنقلة المدرجة',
                    click: () => mainWindow && mainWindow.webContents.send('menu-command', 'wb-protractor')
                },
                { type: 'separator' },
                {
                    label: '🌐 حاسبة ورسم جيوجبرا GeoGebra',
                    click: () => mainWindow && mainWindow.webContents.send('menu-command', 'wb-geogebra')
                },
                {
                    label: '⏺️ تسجيل برهان رياضي حركي',
                    click: () => mainWindow && mainWindow.webContents.send('menu-command', 'wb-proof')
                },
                {
                    label: '📝 فضاء تصحيح الفروض المنزلية',
                    click: () => mainWindow && mainWindow.webContents.send('menu-command', 'wb-hw-correct')
                },
                {
                    label: '👥 دعوة تلميذ للصعود للسبورة',
                    click: () => mainWindow && mainWindow.webContents.send('menu-command', 'wb-student-call')
                }
            ]
        },
        {
            label: 'عرض (Affichage)',
            submenu: [
                {
                    label: 'ملء الشاشة للسبورة والعرض',
                    accelerator: 'F11',
                    click: () => {
                        if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
                    }
                },
                { type: 'separator' },
                { role: 'resetZoom', label: 'الحجم الطبيعي 100%' },
                { role: 'zoomIn', label: 'تكبير الواجهة' },
                { role: 'zoomOut', label: 'تصغير الواجهة' },
                { type: 'separator' },
                { role: 'reload', label: 'إعادة تحميل التطبيق' },
                { role: 'forceReload', label: 'إعادة تحميل قسرية' }
            ]
        },
        {
            label: 'مساعدة (Aide)',
            submenu: [
                {
                    label: 'حول منظومة أستاذ الرياضيات',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'حول التطبيق المكتبي',
                            message: 'منظومة التدبير التربوي - مادة الرياضيات بالسلك الثانوي التأهيلي',
                            detail: 'تطبيق مكتبي متكامل للأستاذ: تدبير الغياب، الفروض، المراقبة المستمرة، السبورة الرياضية التفاعلية مع جيوجبرا وتصحيح الفروض، ودفتر النصوص الرسمي.\nيعمل التطبيق بشكل مستقل دون الحاجة لاتصال بالإنترنت.',
                            buttons: ['حسناً']
                        });
                    }
                },
                {
                    label: 'دليل اختصارات لوحة المفاتيح',
                    click: () => mainWindow && mainWindow.webContents.send('menu-command', 'show-shortcuts')
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// IPC Handlers for Native File Operations
ipcMain.handle('save-backup-file', async (_event, { data, defaultFilename }) => {
    if (!mainWindow) return { success: false, error: 'No active window' };

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'حفظ نسخة احتياطية لقاعدة البيانات',
        defaultPath: defaultFilename || `نسخة_احتياطية_منظومة_الرياضيات_${new Date().toISOString().slice(0, 10)}.json`,
        filters: [
            { name: 'JSON Backup Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (canceled || !filePath) return { success: false, canceled: true };

    try {
        await fs.promises.writeFile(filePath, typeof data === 'string' ? data : JSON.stringify(data, null, 2), 'utf-8');
        return { success: true, filePath };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('load-backup-file', async () => {
    if (!mainWindow) return { success: false, error: 'No active window' };

    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'استرجاع نسخة احتياطية',
        filters: [
            { name: 'JSON Backup Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
    });

    if (canceled || !filePaths || filePaths.length === 0) return { success: false, canceled: true };

    try {
        const content = await fs.promises.readFile(filePaths[0], 'utf-8');
        return { success: true, data: content, filePath: filePaths[0] };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        else mainWindow.maximize();
    }
});

ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
});

ipcMain.on('window-fullscreen', () => {
    if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
});

ipcMain.on('print-page', () => {
    if (mainWindow) mainWindow.webContents.print();
});

// Lifecycle Events
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
