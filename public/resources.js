
        // ضمان توفر كائن قاعدة البيانات المعتمدة في كافة السياقات دون أي أخطاء
        var db = (typeof window !== "undefined" && window.db) ? window.db : ((typeof db !== "undefined") ? db : {});
        if (typeof window !== "undefined" && !window.db) { window.db = db; }

        // ============================================
        // Digital Resources & Local Import Logic (IndexedDB)
        // ============================================
        var ResourceDB = {
            dbName: 'SchoolLibraryLocalFiles',
            version: 1,
            dbInstance: null,
            async init() {
                if (this.dbInstance) return this.dbInstance;
                return new Promise((resolve, reject) => {
                    const req = indexedDB.open(this.dbName, this.version);
                    req.onupgradeneeded = (e) => {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains('files')) {
                            db.createObjectStore('files', { keyPath: 'id' });
                        }
                    };
                    req.onsuccess = (e) => {
                        this.dbInstance = e.target.result;
                        resolve(this.dbInstance);
                    };
                    req.onerror = (e) => reject(e);
                });
            },
            async saveFile(id, file) {
                const db = await this.init();
                return new Promise((resolve, reject) => {
                    const tx = db.transaction('files', 'readwrite');
                    const store = tx.objectStore('files');
                    const record = {
                        id: id,
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        data: file,
                        createdAt: Date.now()
                    };
                    const req = store.put(record);
                    req.onsuccess = () => resolve(true);
                    req.onerror = (e) => reject(e);
                });
            },
            async getFile(id) {
                const db = await this.init();
                return new Promise((resolve, reject) => {
                    const tx = db.transaction('files', 'readonly');
                    const store = tx.objectStore('files');
                    const req = store.get(id);
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = (e) => reject(e);
                });
            },
            async deleteFile(id) {
                try {
                    const db = await this.init();
                    return new Promise((resolve, reject) => {
                        const tx = db.transaction('files', 'readwrite');
                        const store = tx.objectStore('files');
                        const req = store.delete(id);
                        req.onsuccess = () => resolve(true);
                        req.onerror = (e) => reject(e);
                    });
                } catch(err) {
                    console.warn('Error deleting local file from IDB:', err);
                }
            },
            async pruneOrphanedFiles(validIdsSet) {
                try {
                    const dbInst = await this.init();
                    return new Promise((resolve) => {
                        const tx = dbInst.transaction('files', 'readwrite');
                        const store = tx.objectStore('files');
                        const req = store.getAllKeys();
                        req.onsuccess = () => {
                            const keys = req.result || [];
                            let removedCount = 0;
                            keys.forEach((k) => {
                                if (validIdsSet && !validIdsSet.has(k) && !validIdsSet.has(String(k))) {
                                    store.delete(k);
                                    removedCount++;
                                }
                            });
                            resolve(removedCount);
                        };
                        req.onerror = () => resolve(0);
                    });
                } catch (err) {
                    return 0;
                }
            }
        };
        if (typeof window !== 'undefined') {
            window.ResourceDB = ResourceDB;
        }

        var currentLibMode = 'drive';
        var currentSelectedLibFile = null;
        var verifiedDriveFolderData = null;
        var isDriveAutoSyncing = false;
        var lastAutoSyncTimestamp = 0;

        function showLibraryToast(message) {
            const existing = document.querySelector('.lib-toast');
            if (existing) existing.remove();
            const toast = document.createElement('div');
            toast.className = 'lib-toast';
            toast.innerHTML = `<span data-lucide="info" data-size="16"></span><span>${message}</span>`;
            document.body.appendChild(toast);
            if (window.lucide) window.lucide.createIcons();
            setTimeout(() => {
                toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(100%)';
                setTimeout(() => toast.remove(), 400);
            }, 4000);
        }

        async function getLibraryDriveToken(interactive = false) {
            if (typeof window.getGoogleDriveToken === 'function') {
                const token = await window.getGoogleDriveToken(interactive);
                if (token && (typeof window.isRealOAuthToken !== 'function' || window.isRealOAuthToken(token))) {
                    return token;
                }
            }
            return null;
        }

        var GoogleDriveLibrary = {
            extractFolderId(input) {
                if (!input) return null;
                const str = String(input).trim();
                const m1 = str.match(/folders\/([a-zA-Z0-9_-]+)/);
                if (m1) return m1[1];
                const m2 = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                if (m2) return m2[1];
                if (/^[a-zA-Z0-9_-]{15,70}$/.test(str)) return str;
                return null;
            },

            detectResourceType(mimeType, fileName) {
                const ext = (fileName && fileName.includes('.')) ? (fileName.split('.').pop() || '').toLowerCase() : '';
                if (mimeType === 'application/vnd.google-apps.document' ||
                    mimeType === 'application/pdf' ||
                    ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext) ||
                    mimeType === 'application/vnd.google-apps.presentation' ||
                    mimeType === 'application/vnd.google-apps.spreadsheet') {
                    return 'doc';
                }
                if (mimeType.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
                    return 'video';
                }
                return 'doc';
            },

            async fetchFolderInfo(folderId, token) {
                const res = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,webViewLink,trashed`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!res.ok) {
                    if (res.status === 404) throw new Error('لم يتم العثور على المجلد في Google Drive. يرجى التأكد من الرابط أو الصلاحيات.');
                    if (res.status === 401) throw new Error('انتهت صلاحية الاتصال، يرجى تسجيل الدخول مجدداً.');
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error?.message || 'تعذر الوصول إلى المجلد على Google Drive');
                }
                const data = await res.json();
                if (data.trashed) throw new Error('هذا المجلد محذوف في سلة المهملات على Google Drive.');
                if (data.mimeType !== 'application/vnd.google-apps.folder') {
                    throw new Error('الرابط المدخل يشير إلى ملف وليس إلى مجلد.');
                }
                return data;
            },

            async fetchFolderFiles(folderId, token, includeSubfolders = true) {
                let allFiles = [];
                let folderQueue = [folderId];
                let visitedFolders = new Set([folderId]);

                while (folderQueue.length > 0) {
                    const currentId = folderQueue.shift();
                    let pageToken = '';
                    do {
                        const query = `'${currentId}' in parents and trashed = false`;
                        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=nextPageToken,files(id,name,mimeType,size,webContentLink,webViewLink,createdTime,modifiedTime,thumbnailLink,iconLink)&pageSize=100&orderBy=modifiedTime desc${pageToken ? `&pageToken=${pageToken}` : ''}`;

                        const res = await fetch(url, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        if (!res.ok) {
                            const err = await res.json().catch(() => ({}));
                            throw new Error(err.error?.message || 'تعذر جلب ملفات المجلد من Google Drive');
                        }
                        const data = await res.json();
                        if (data.files && data.files.length) {
                            for (const item of data.files) {
                                if (item.mimeType === 'application/vnd.google-apps.folder') {
                                    if (includeSubfolders && !visitedFolders.has(item.id) && folderQueue.length < 30) {
                                        visitedFolders.add(item.id);
                                        folderQueue.push(item.id);
                                    }
                                } else {
                                    allFiles.push(item);
                                }
                            }
                        }
                        pageToken = data.nextPageToken || '';
                    } while (pageToken);

                    if (!includeSubfolders) break;
                }

                return allFiles;
            },

            async listUserFolders(token) {
                const query = `mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
                const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink,modifiedTime)&pageSize=40&orderBy=modifiedTime desc`;
                const res = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('تعذر استعراض مجلدات حسابك.');
                const data = await res.json();
                return data.files || [];
            }
        };

        function syncLibraryDriveUIState() {
            const hasToken = (typeof window.hasActiveDriveToken === 'function') ? window.hasActiveDriveToken() : false;
            const verifiedUser = (typeof window.getVerifiedFirebaseAuthUser === 'function') ? window.getVerifiedFirebaseAuthUser() : null;
            const effectiveUser = (typeof window.getEffectiveUser === 'function') ? window.getEffectiveUser() : null;
            const activeUser = verifiedUser || effectiveUser;
            const connectBox = document.getElementById('libDriveConnectBox');
            const connectedBox = document.getElementById('libDriveConnectedBox');
            const emailSpan = document.getElementById('libDriveUserEmail');

            const isConnected = !!(hasToken || (activeUser && activeUser.email));

            if (connectBox) connectBox.style.display = isConnected ? 'none' : 'block';
            if (connectedBox) connectedBox.style.display = isConnected ? 'block' : 'none';
            if (emailSpan) {
                emailSpan.textContent = (activeUser && activeUser.email) ? activeUser.email : (isConnected ? 'حساب Google متصل' : '-');
            }
            if (window.lucide) window.lucide.createIcons();
        }
        window.syncLibraryDriveUIState = syncLibraryDriveUIState;
        window.addEventListener('gdrive-token-changed', () => syncLibraryDriveUIState());

        async function connectLibraryGoogleDrive() {
            try {
                if (typeof window.handleDriveLogin === 'function') {
                    await window.handleDriveLogin();
                } else if (typeof window.getGoogleDriveToken === 'function') {
                    await window.getGoogleDriveToken(true);
                }
                syncLibraryDriveUIState();
                const activeUser = (typeof window.getEffectiveUser === 'function') ? window.getEffectiveUser() : null;
                if (activeUser || (typeof window.hasActiveDriveToken === 'function' && window.hasActiveDriveToken())) {
                    showLibraryToast('تم ربط حساب Gmail / Google Drive بنجاح!');
                    checkAndAutoSyncDriveFolders(true);
                }
            } catch(e) {
                console.error("Error connecting Google Drive:", e);
            }
        }

        function switchLibMode(mode) {
            currentLibMode = mode;
            const btnDrive = document.getElementById('btnModeDrive');
            const btnLocal = document.getElementById('btnModeLocal');
            const btnLink = document.getElementById('btnModeLink');
            const driveSec = document.getElementById('libDriveSection');
            const localSec = document.getElementById('libLocalSection');
            const urlSec = document.getElementById('libUrlSection');

            if (btnDrive) btnDrive.classList.toggle('active', mode === 'drive');
            if (btnLocal) btnLocal.classList.toggle('active', mode === 'local');
            if (btnLink) btnLink.classList.toggle('active', mode === 'link');

            if (driveSec) driveSec.style.display = mode === 'drive' ? 'block' : 'none';
            if (localSec) localSec.style.display = mode === 'local' ? 'block' : 'none';
            if (urlSec) urlSec.style.display = mode === 'link' ? 'block' : 'none';

            if (mode === 'drive') {
                syncLibraryDriveUIState();
                checkAndAutoSyncDriveFolders(false);
            }
            if (window.lucide) window.lucide.createIcons();
        }

        function onDriveCourseSelectChanged(val) {
            // Deprecated: application is strictly dedicated to Mathematics
        }
        window.onDriveCourseSelectChanged = onDriveCourseSelectChanged;

        function toggleDriveSubfoldersCheckbox() {
            const cb = document.getElementById('libDriveIncludeSubfolders');
            if (cb) cb.checked = !cb.checked;
        }
        window.toggleDriveSubfoldersCheckbox = toggleDriveSubfoldersCheckbox;

        function onDriveFolderInputChanged(val) {
            const preview = document.getElementById('libDriveFolderPreview');
            if (preview && !val.trim()) {
                preview.style.display = 'none';
            }
        }

        async function verifyAndInspectDriveFolder() {
            const input = document.getElementById('libDriveFolderInput');
            const rawVal = input ? input.value.trim() : '';
            const folderId = GoogleDriveLibrary.extractFolderId(rawVal);

            if (!folderId) {
                showLibraryToast('⚠️ يرجى وضع رابط مجلد Google Drive صحيح أو معرّف المجلد (Folder ID).');
                return;
            }

            const verifyBtn = document.getElementById('btnVerifyDriveFolder');
            const statusEl = document.getElementById('libDriveActionStatus');
            const previewBox = document.getElementById('libDriveFolderPreview');
            const nameEl = document.getElementById('libDrivePreviewFolderName');
            const countEl = document.getElementById('libDrivePreviewFileCount');
            const linkEl = document.getElementById('libDrivePreviewFolderLink');
            const topicInput = document.getElementById('libDriveTopic');
            const levelSelect = document.getElementById('libDriveLevel');

            if (verifyBtn) verifyBtn.disabled = true;
            if (statusEl) {
                statusEl.textContent = 'جاري الاتصال بـ Google Drive للتحقق من المجلد...';
                statusEl.style.display = 'inline';
            }

            try {
                const token = await getLibraryDriveToken(false);
                const includeSubfolders = document.getElementById('libDriveIncludeSubfolders') ? document.getElementById('libDriveIncludeSubfolders').checked : true;
                let folderInfo = {
                    id: folderId,
                    name: (topicInput && topicInput.value.trim()) ? topicInput.value.trim() : `مجلد Google Drive (${folderId.slice(0, 8)})`,
                    webViewLink: `https://drive.google.com/drive/folders/${folderId}`
                };
                let files = [];

                if (token) {
                    folderInfo = await GoogleDriveLibrary.fetchFolderInfo(folderId, token);
                    files = await GoogleDriveLibrary.fetchFolderFiles(folderId, token, includeSubfolders);
                }

                verifiedDriveFolderData = {
                    id: folderInfo.id,
                    name: folderInfo.name,
                    webViewLink: folderInfo.webViewLink || `https://drive.google.com/drive/folders/${folderInfo.id}`,
                    filesCount: files.length,
                    files: files
                };

                if (nameEl) nameEl.textContent = folderInfo.name;
                if (countEl) {
                    countEl.textContent = token
                        ? `${files.length} ملفاً قابلاً للمزامنة داخل المجلد${includeSubfolders ? ' (بما فيها المجلدات الفرعية)' : ''}`
                        : 'مجلد Google Drive جاهز للربط المباشر والمزامنة السحابية عبر حساب Gmail';
                }
                if (linkEl) linkEl.href = verifiedDriveFolderData.webViewLink;
                if (previewBox) previewBox.style.display = 'block';

                if (topicInput && !topicInput.value.trim()) {
                    topicInput.value = folderInfo.name;
                }

                // Smart auto-detection of academic level from folder name
                const fnLower = (folderInfo.name || '').toLowerCase();
                if (levelSelect) {
                    if (fnLower.includes('2bac-pc') || fnLower.includes('2bac pc')) levelSelect.value = '2BAC-PC';
                    else if (fnLower.includes('2bac-sm') || fnLower.includes('2bac sm')) levelSelect.value = '2BAC-SM';
                    else if (fnLower.includes('2bac-svt') || fnLower.includes('2bac svt')) levelSelect.value = '2BAC-SVT';
                    else if (fnLower.includes('1bac-exp') || fnLower.includes('1bac se')) levelSelect.value = '1BAC-EXP';
                    else if (fnLower.includes('1bac-sm') || fnLower.includes('1bac sm')) levelSelect.value = '1BAC-SM';
                    else if (fnLower.includes('tc-sc') || fnLower.includes('tcs') || fnLower.includes('جذع مشترك علمي')) levelSelect.value = 'TC-SC';
                    else if (fnLower.includes('tcs') || fnLower.includes('جذع مشترك')) levelSelect.value = 'الجذع المشترك العلمي';
                }

                if (statusEl) {
                    statusEl.textContent = `✓ تم التحقق: المجلد "${folderInfo.name}" جاهز للربط بمكتبة الرياضيات والمزامنة.`;
                }
                if (window.lucide) window.lucide.createIcons();
            } catch(err) {
                console.error("Verification error:", err);
                if (previewBox) previewBox.style.display = 'none';
                if (statusEl) statusEl.textContent = '';
                if (typeof window.logCloudSyncError === 'function') {
                    window.logCloudSyncError({
                        service: 'Google Drive',
                        operation: 'VERIFY_FOLDER',
                        folderId: folderId,
                        folderName: `فحص مجلد (${folderId.slice(0, 10)}...)`,
                        error: err
                    });
                }
                showLibraryToast('⚠️ خطأ أثناء التحقق من المجلد: ' + err.message);
            } finally {
                if (verifyBtn) verifyBtn.disabled = false;
            }
        }

        async function browseUserDriveFolders() {
            const picker = document.getElementById('libDriveFoldersPicker');
            const listEl = document.getElementById('libDriveFoldersList');
            if (!picker || !listEl) return;

            picker.style.display = 'block';
            listEl.innerHTML = '<div style="text-align: center; color: #64748b; padding: 15px; font-size: 0.82rem;">جاري جلب قائمة المجلدات من حسابك...</div>';

            try {
                const token = await getLibraryDriveToken(true);
                if (!token) throw new Error('يرجى تسجيل الدخول بحساب Google.');

                const folders = await GoogleDriveLibrary.listUserFolders(token);
                if (!folders || folders.length === 0) {
                    listEl.innerHTML = '<div style="text-align: center; color: #64748b; padding: 12px; font-size: 0.82rem;">لم يتم العثور على أي مجلدات في جذر حساب Google Drive الخاص بك.</div>';
                    return;
                }

                let html = '';
                folders.forEach(f => {
                    const safeName = (f.name || 'مجلد بدون اسم').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                    html += `
                        <div class="lib-drive-folder-item" onclick="selectDriveFolderFromPicker('${f.id}')">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span data-lucide="folder" data-size="16" style="color: #2563eb;"></span>
                                <strong style="font-size: 0.84rem; color: #1e293b;">${safeName}</strong>
                            </div>
                            <span style="font-size: 0.72rem; color: #2563eb; background: #eff6ff; padding: 2px 6px; border-radius: 4px;">اختيار</span>
                        </div>
                    `;
                });
                listEl.innerHTML = html;
                if (window.lucide) window.lucide.createIcons();
            } catch(err) {
                listEl.innerHTML = `<div style="color: #ef4444; padding: 10px; font-size: 0.82rem;">خطأ: ${err.message}</div>`;
            }
        }

        function closeDriveFoldersPicker() {
            const picker = document.getElementById('libDriveFoldersPicker');
            if (picker) picker.style.display = 'none';
        }

        function selectDriveFolderFromPicker(folderId) {
            const input = document.getElementById('libDriveFolderInput');
            if (input) input.value = `https://drive.google.com/drive/folders/${folderId}`;
            closeDriveFoldersPicker();
            verifyAndInspectDriveFolder();
        }

        function toggleDriveAutoSyncCheckbox() {
            const cb = document.getElementById('libDriveAutoSyncCheck');
            if (cb) cb.checked = !cb.checked;
        }

        async function linkAndSyncDriveFolder() {
            const input = document.getElementById('libDriveFolderInput');
            const rawVal = input ? input.value.trim() : '';
            const folderId = GoogleDriveLibrary.extractFolderId(rawVal);
            const levelSelect = document.getElementById('libDriveLevel');
            const topicInput = document.getElementById('libDriveTopic');
            const autoSyncCheck = document.getElementById('libDriveAutoSyncCheck');
            const subfoldersCheck = document.getElementById('libDriveIncludeSubfolders');
            const actionBtn = document.getElementById('btnLinkDriveFolder');
            const statusEl = document.getElementById('libDriveActionStatus');

            if (!folderId) {
                showLibraryToast('⚠️ يرجى إدخال رابط مجلد Google Drive أو معرّف المجلد.');
                return;
            }

            const targetLevel = levelSelect ? levelSelect.value : 'عام';
            const categorySelect = document.getElementById('libDriveCategory');
            const targetCategory = categorySelect ? categorySelect.value : 'درس';
            const targetTopic = topicInput ? topicInput.value.trim() : '';
            const autoSync = autoSyncCheck ? autoSyncCheck.checked : true;
            const includeSubfolders = subfoldersCheck ? subfoldersCheck.checked : true;

            if (actionBtn) actionBtn.disabled = true;
            if (statusEl) {
                statusEl.textContent = 'جاري ربط المجلد ومزامنة الملفات من Google Drive...';
                statusEl.style.display = 'inline';
            }

            try {
                const token = await getLibraryDriveToken(false);
                let folderInfo = {
                    id: folderId,
                    name: targetTopic || `مجلد الرياضيات (${targetLevel})`,
                    webViewLink: `https://drive.google.com/drive/folders/${folderId}`
                };
                if (token) {
                    try {
                        folderInfo = await GoogleDriveLibrary.fetchFolderInfo(folderId, token);
                    } catch (_) {}
                }

                if (!db.libraryDriveFolders) db.libraryDriveFolders = [];
                let existingFolder = db.libraryDriveFolders.find(f => f.id === folderId);
                const nowFormatted = new Date().toLocaleString('ar-MA', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });

                if (!existingFolder) {
                    existingFolder = {
                        id: folderId,
                        name: folderInfo.name,
                        webViewLink: folderInfo.webViewLink || `https://drive.google.com/drive/folders/${folderId}`,
                        course: 'الرياضيات',
                        category: targetCategory,
                        level: targetLevel,
                        topic: targetTopic || folderInfo.name,
                        autoSync: autoSync,
                        includeSubfolders: includeSubfolders,
                        dateLinked: window.formatLocalDate ? window.formatLocalDate() : new Date().toLocaleDateString('en-CA'),
                        lastSyncTime: Date.now(),
                        lastSyncFormatted: nowFormatted,
                        syncedFilesCount: 0
                    };
                    db.libraryDriveFolders.push(existingFolder);
                } else {
                    existingFolder.name = folderInfo.name;
                    existingFolder.course = 'الرياضيات';
                    existingFolder.category = targetCategory;
                    existingFolder.level = targetLevel;
                    existingFolder.topic = targetTopic || folderInfo.name;
                    existingFolder.autoSync = autoSync;
                    existingFolder.includeSubfolders = includeSubfolders;
                    existingFolder.lastSyncTime = Date.now();
                    existingFolder.lastSyncFormatted = nowFormatted;
                }

                saveDB();

                // Now execute immediate sync of all files (or cloud metadata sync when OAuth popup is unavailable)
                await syncDriveFolder(folderId, false, false);

                if (input) input.value = '';
                if (topicInput) topicInput.value = '';
                const previewBox = document.getElementById('libDriveFolderPreview');
                if (previewBox) previewBox.style.display = 'none';

                if (statusEl) statusEl.textContent = '';
                showLibraryToast(`✓ تم ربط مجلد "${folderInfo.name}" بنجاح!`);

                renderLibrary();
                renderLinkedDriveFolders();
                renderDriveFoldersManagerList();
            } catch(err) {
                console.error("Linking error:", err);
                if (statusEl) statusEl.textContent = '';
                if (typeof window.logCloudSyncError === 'function') {
                    window.logCloudSyncError({
                        service: 'Google Drive',
                        operation: 'LINK_FOLDER',
                        folderId: folderId,
                        folderName: `ربط مجلد (${folderId.slice(0, 10)}...)`,
                        error: err
                    });
                }
                showLibraryToast('⚠️ حدث خطأ أثناء ربط المجلد: ' + err.message);
            } finally {
                if (actionBtn) actionBtn.disabled = false;
            }
        }

        async function syncDriveFolder(folderId, interactive = false, silent = false) {
            if (!db.libraryDriveFolders) db.libraryDriveFolders = [];
            const folder = db.libraryDriveFolders.find(f => f.id === folderId);
            if (!folder) return { newCount: 0, updatedCount: 0 };

            const token = await getLibraryDriveToken(false);
            if (!token) {
                // في وضع الربط السحابي عبر حساب Gmail (بدون توكن OAuth نافذة منبثقة)، نحدّث طابع المزامنة ونحفظ سحابياً في Firestore بدون تسجيل خطأ
                folder.lastSyncTime = Date.now();
                folder.lastSyncFormatted = new Date().toLocaleString('ar-MA', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });
                saveDB();
                if (interactive && typeof window.syncToFirebase === 'function') {
                    try { await window.syncToFirebase(window.db); } catch (_) {}
                }
                if (interactive && !silent) {
                    showLibraryToast(`✓ تمت مزامنة وحفظ إعدادات مجلد "${folder.name}" سحابياً.`);
                }
                return { newCount: 0, updatedCount: 0, totalDriveFiles: folder.syncedFilesCount || 0, cloudSynced: true };
            }

            try {
                const includeSubfolders = folder.includeSubfolders !== false;
                const driveFiles = await GoogleDriveLibrary.fetchFolderFiles(folderId, token, includeSubfolders);
                if (!db.library) db.library = [];

                let newCount = 0;
                let updatedCount = 0;
                const newlyFoundNames = [];

                driveFiles.forEach(file => {
                    const existingIndex = db.library.findIndex(item => item.driveFileId === file.id || item.id === 'gdrive_' + file.id);
                    const resType = GoogleDriveLibrary.detectResourceType(file.mimeType, file.name);
                    const formattedSize = formatLibFileSize(file.size ? parseInt(file.size, 10) : 0);

                    if (existingIndex === -1) {
                        db.library.unshift({
                            id: 'gdrive_' + file.id,
                            driveFileId: file.id,
                            driveFolderId: folder.id,
                            driveFolderName: folder.name,
                            course: folder.course || 'عام',
                            category: folder.category || (typeof inferResourceCategory === 'function' ? inferResourceCategory({title: file.name, fileName: file.name}) : 'درس'),
                            title: file.name,
                            url: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
                            downloadUrl: file.webContentLink || `https://drive.google.com/uc?id=${file.id}&export=download`,
                            thumbnailLink: file.thumbnailLink || '',
                            isLocalFile: false,
                            isDriveFile: true,
                            isNew: true,
                            addedTimestamp: Date.now(),
                            fileName: file.name,
                            fileSize: formattedSize,
                            fileType: file.mimeType,
                            type: resType,
                            topic: folder.topic || '',
                            level: folder.level || 'عام',
                            dateAdded: file.createdTime ? file.createdTime.split('T')[0] : (window.formatLocalDate ? window.formatLocalDate() : new Date().toLocaleDateString('en-CA')),
                            modifiedTime: file.modifiedTime || file.createdTime
                        });
                        newCount++;
                        if (newlyFoundNames.length < 3) newlyFoundNames.push(file.name);
                    } else {
                        const existing = db.library[existingIndex];
                        let changed = false;
                        if (existing.course !== folder.course && folder.course) {
                            existing.course = folder.course;
                            changed = true;
                        }
                        if (existing.modifiedTime !== file.modifiedTime || existing.title !== file.name) {
                            existing.title = file.name;
                            existing.fileName = file.name;
                            existing.fileSize = formattedSize;
                            existing.modifiedTime = file.modifiedTime;
                            existing.url = file.webViewLink || existing.url;
                            existing.downloadUrl = file.webContentLink || existing.downloadUrl;
                            existing.thumbnailLink = file.thumbnailLink || existing.thumbnailLink;
                            changed = true;
                        }
                        if (changed) updatedCount++;
                    }
                });

                folder.lastSyncTime = Date.now();
                folder.lastSyncFormatted = new Date().toLocaleString('ar-MA', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });
                folder.syncedFilesCount = driveFiles.length;

                saveDB();

                if (newCount > 0) {
                    const sample = newlyFoundNames.join('، ');
                    showLibraryToast(`✓ تم العثور على ${newCount} ملف جديد في مجلد "${folder.name}" (${sample}) وإضافتها مباشرة داخل المكتبة!`);
                    renderLibrary();
                    renderLinkedDriveFolders();
                }

                return { newCount, updatedCount, totalDriveFiles: driveFiles.length };
            } catch (err) {
                console.error("Sync error for folder " + folderId, err);
                if (typeof window.logCloudSyncError === 'function') {
                    window.logCloudSyncError({
                        service: 'Google Drive',
                        operation: 'FOLDER_SYNC',
                        folderId: folder.id,
                        folderName: folder.name || folderId,
                        error: err,
                        fixActionType: 'retry_folder'
                    });
                }
                if (!silent) showLibraryToast('⚠️ خطأ أثناء مزامنة المجلد: ' + err.message);
                return { error: err.message };
            }
        }
        window.syncDriveFolder = syncDriveFolder;

        async function syncAllLinkedDriveFolders(interactive = false) {
            if (!db.libraryDriveFolders || db.libraryDriveFolders.length === 0) {
                if (interactive) showLibraryToast('ℹ️ لا توجد مجلدات Google Drive مربوطة حالياً. يمكنك ربط مجلد جديد عبر نموذج الإضافة أعلاه.');
                return;
            }

            const token = await getLibraryDriveToken(interactive);
            if (!token) return;

            const syncBtn = document.getElementById('btnSyncAllDriveNow');
            const syncBadge = document.getElementById('libSyncStatusBadge');
            if (syncBtn) {
                syncBtn.disabled = true;
                syncBtn.innerHTML = '<span class="ui-icon" style="animation: spin 1s linear infinite;"><span data-lucide="loader-2" data-size="13"></span></span> <span>جاري فحص المجلدات...</span>';
            }
            if (syncBadge) {
                syncBadge.textContent = 'جاري فحص مجلدات Google Drive...';
                syncBadge.style.display = 'inline-flex';
            }

            let totalNew = 0;
            let totalUpdated = 0;

            try {
                for (const folder of db.libraryDriveFolders) {
                    const res = await syncDriveFolder(folder.id, false, !interactive);
                    if (res && !res.error) {
                        totalNew += (res.newCount || 0);
                        totalUpdated += (res.updatedCount || 0);
                    }
                }

                if (totalNew > 0 || interactive) {
                    showLibraryToast(`تمت مزامنة مجلدات Google Drive: تم استيراد ${totalNew} ملفاً جديداً، وتحديث ${totalUpdated} ملفاً.`);
                }
                renderLibrary();
                renderLinkedDriveFolders();
                renderDriveFoldersManagerList();
            } catch(e) {
                console.error("Error in syncAllLinkedDriveFolders:", e);
            } finally {
                if (syncBtn) {
                    syncBtn.disabled = false;
                    syncBtn.innerHTML = '<span data-lucide="refresh-cw" data-size="13"></span> <span>فحص واستيراد جديد Drive</span>';
                }
                if (syncBadge) syncBadge.style.display = 'none';
                if (window.lucide) window.lucide.createIcons();
            }
        }
        window.syncAllLinkedDriveFolders = syncAllLinkedDriveFolders;

        async function checkAndAutoSyncDriveFolders(force = false) {
            if (!db.libraryDriveFolders || db.libraryDriveFolders.length === 0) return;
            const autoSyncFolders = db.libraryDriveFolders.filter(f => f.autoSync !== false);
            if (autoSyncFolders.length === 0) return;

            const now = Date.now();
            if (!force && (now - lastAutoSyncTimestamp < 35 * 1000)) return;
            if (isDriveAutoSyncing) return;

            const token = await getLibraryDriveToken(false);
            if (!token) return;

            isDriveAutoSyncing = true;
            lastAutoSyncTimestamp = now;

            const syncBadge = document.getElementById('libSyncStatusBadge');
            if (syncBadge) {
                syncBadge.textContent = 'مزامنة تلقائية حية نشطة...';
                syncBadge.style.display = 'inline-flex';
            }

            let totalNew = 0;
            try {
                for (const folder of autoSyncFolders) {
                    const res = await syncDriveFolder(folder.id, false, true);
                    if (res && !res.error) {
                        totalNew += (res.newCount || 0);
                    }
                }
                if (totalNew > 0) {
                    showLibraryToast(`✓ تم اكتشاف ومزامنة ${totalNew} ملف جديد تلقائياً من مجلدات Google Drive!`);
                    renderLibrary();
                }
            } catch(err) {
                console.warn("Auto-sync background error:", err);
            } finally {
                isDriveAutoSyncing = false;
                if (syncBadge) syncBadge.style.display = 'none';
                renderLinkedDriveFolders();
            }
        }
        window.checkAndAutoSyncDriveFolders = checkAndAutoSyncDriveFolders;

        // Active background poller for connected Google Drive folders
        if (!window._gdriveAutoSyncInterval) {
            window._gdriveAutoSyncInterval = setInterval(() => {
                const currentDb = window.db || (typeof db !== 'undefined' ? db : null);
                if (document.visibilityState === 'visible' && currentDb && currentDb.libraryDriveFolders && currentDb.libraryDriveFolders.length > 0) {
                    checkAndAutoSyncDriveFolders(false);
                }
            }, 45000);
        }

        function renderLinkedDriveFolders() {
            const ribbon = document.getElementById('libLinkedFoldersRibbon');
            const chipsContainer = document.getElementById('libLinkedFoldersChips');
            if (!ribbon || !chipsContainer) return;

            const currentDb = window.db || (typeof db !== 'undefined' ? db : {});
            if (!currentDb.libraryDriveFolders || currentDb.libraryDriveFolders.length === 0) {
                ribbon.style.display = 'none';
                return;
            }

            ribbon.style.display = 'block';
            let html = '';
            (currentDb.libraryDriveFolders || []).forEach(folder => {
                const isAuto = folder.autoSync !== false;
                const statusColor = isAuto ? '#15803d' : '#64748b';
                const statusBg = isAuto ? '#dcfce7' : '#f1f5f9';
                const statusText = isAuto ? 'مزامنة حية 🟢' : 'يدوية ⚪';

                html += `
                    <div class="lib-drive-chip" style="display: inline-flex; align-items: center; gap: 8px; background: #ffffff; border: 1.5px solid #bfdbfe; border-radius: 8px; padding: 6px 12px; box-shadow: 0 1px 3px rgba(37,99,235,0.08);">
                        <span data-lucide="folder" data-size="16" style="color: #2563eb;"></span>
                        <div style="display: flex; flex-direction: column; line-height: 1.3;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <strong style="color: #1e3a8a; font-size: 0.86rem;">📁 ${folder.name}</strong>
                            </div>
                            <div style="font-size: 0.72rem; color: #64748b; display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                                <span>المستوى: <strong>${folder.level || 'عام'}</strong></span>
                                <span>•</span>
                                <span>(${folder.syncedFilesCount || 0} ملفاً)</span>
                                <span>•</span>
                                <span style="background: ${statusBg}; color: ${statusColor}; padding: 1px 6px; border-radius: 9999px; font-weight: 700;">${statusText}</span>
                            </div>
                        </div>
                        <button type="button" class="lib-drive-chip-sync-btn" onclick="syncDriveFolder('${folder.id}', true).then(() => { renderLibrary(); renderLinkedDriveFolders(); })" title="فحص ومزامنة ملفات هذا المجلد الآن" style="background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; border-radius: 6px; padding: 5px 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; font-size: 0.75rem; font-weight: 700; margin-right: 4px;">
                            <span data-lucide="refresh-cw" data-size="12"></span> فحص
                        </button>
                        <a href="${folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`}" target="_blank" rel="noopener noreferrer" style="color: #64748b; padding: 4px; display: inline-flex; align-items: center;" title="فتح المجلد في Google Drive">
                            <span data-lucide="external-link" data-size="12"></span>
                        </a>
                    </div>
                `;
            });
            chipsContainer.innerHTML = html;
            if (window.lucide) window.lucide.createIcons();
        }
        window.renderLinkedDriveFolders = renderLinkedDriveFolders;

        function openDriveFoldersManagerModal() {
            const modal = document.getElementById('driveFoldersManagerModal');
            if (!modal) return;
            renderDriveFoldersManagerList();
            modal.style.display = 'flex';
            if (window.lucide) window.lucide.createIcons();
        }
        window.openDriveFoldersManagerModal = openDriveFoldersManagerModal;

        function closeDriveFoldersManagerModal() {
            const modal = document.getElementById('driveFoldersManagerModal');
            if (modal) modal.style.display = 'none';
        }
        window.closeDriveFoldersManagerModal = closeDriveFoldersManagerModal;

        function editFolderName(folderId) {
            if (!db.libraryDriveFolders) return;
            const folder = db.libraryDriveFolders.find(f => f.id === folderId);
            if (!folder) return;

            const nameBox = document.getElementById('driveFolderNameInline_' + folderId);
            if (nameBox) {
                const safeCurrent = String(folder.name || '').replace(/"/g, '&quot;');
                nameBox.innerHTML = `
                    <input type="text" id="driveFolderNameInput_${folderId}" value="${safeCurrent}" onkeydown="if(event.key==='Enter'){saveInlineFolderName('${folderId}');}" style="padding:3px 8px;border:1.5px solid #2563eb;border-radius:6px;font-size:0.84rem;font-weight:800;color:#0f172a;width:190px;" />
                    <button type="button" onclick="saveInlineFolderName('${folderId}')" style="background:#2563eb;color:#ffffff;border:none;border-radius:5px;padding:3px 8px;font-size:0.72rem;font-weight:800;cursor:pointer;">حفظ</button>
                    <button type="button" onclick="renderDriveFoldersManagerList()" style="background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;border-radius:5px;padding:3px 7px;font-size:0.72rem;cursor:pointer;">إلغاء</button>
                `;
                const inp = document.getElementById('driveFolderNameInput_' + folderId);
                if (inp) { inp.focus(); inp.select(); }
                return;
            }
        }
        window.editFolderName = editFolderName;
        window.editFolderCourse = editFolderName;

        window.saveInlineFolderName = function(folderId) {
            if (!db.libraryDriveFolders) return;
            const folder = db.libraryDriveFolders.find(f => f.id === folderId);
            if (!folder) return;
            const inp = document.getElementById('driveFolderNameInput_' + folderId);
            const newName = inp ? inp.value.trim() : '';
            if (newName) {
                folder.name = newName;
                if (db.library) {
                    db.library.forEach(item => {
                        if (item.driveFolderId === folderId) {
                            item.driveFolderName = folder.name;
                        }
                    });
                }
                saveDB();
                renderDriveFoldersManagerList();
                renderLinkedDriveFolders();
                renderLibrary();
                showLibraryToast(`✓ تم تحديث اسم المجلد إلى "${folder.name}".`);
            }
        };

        function renderDriveFoldersManagerList() {
            const listEl = document.getElementById('driveFoldersManagerList');
            if (!listEl) return;

            const topSyncToolbarHtml = `
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:9px 12px;margin-bottom:10px;">
                    <span style="font-size:0.78rem;color:#0369a1;font-weight:800;">⚙️ هل ترغب في إدارة مزامنة Firestore أو مراجعة سجل أخطاء المزامنة؟</span>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        <button type="button" onclick="closeDriveFoldersManagerModal(); if(window.openAdvancedCloudSyncSettingsModal) window.openAdvancedCloudSyncSettingsModal('modules');" style="background:#0f172a;color:#ffffff;border:none;padding:5px 10px;border-radius:6px;font-size:0.73rem;font-weight:800;cursor:pointer;">
                            🗄️ إعدادات مجلدات Firestore & Drive
                        </button>
                        <button type="button" onclick="closeDriveFoldersManagerModal(); if(window.openAdvancedCloudSyncSettingsModal) window.openAdvancedCloudSyncSettingsModal('errors');" style="background:#fff1f2;color:#be123c;border:1px solid #fecdd3;padding:5px 10px;border-radius:6px;font-size:0.73rem;font-weight:800;cursor:pointer;">
                            🛠️ سجل أخطاء المزامنة (${typeof window.getCloudSyncErrorLogs === 'function' ? window.getCloudSyncErrorLogs().length : 0})
                        </button>
                    </div>
                </div>
            `;

            if (!db.libraryDriveFolders || db.libraryDriveFolders.length === 0) {
                listEl.innerHTML = topSyncToolbarHtml + `
                    <div style="text-align: center; color: #64748b; padding: 25px; border: 1.5px dashed #cbd5e1; border-radius: 10px; background: #f8fafc;">
                        <span data-lucide="folder-x" data-size="32" style="color: #94a3b8; display: block; margin: 0 auto 8px auto;"></span>
                        <div style="font-weight: 700; color: #334155; margin-bottom: 4px;">لا توجد أي مجلدات مربوطة حالياً</div>
                        <div style="font-size: 0.8rem; color: #64748b;">قم بربط أول مجلد Google Drive عبر تبويب المكتبة للبدء في الاستيراد والمزامنة التلقائية أو اليدوية.</div>
                    </div>
                `;
                if (window.lucide) window.lucide.createIcons();
                return;
            }

            let html = topSyncToolbarHtml;
            db.libraryDriveFolders.forEach(folder => {
                const isAuto = folder.autoSync !== false;
                html += `
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 44px; height: 44px; border-radius: 8px; background: #eff6ff; display: flex; align-items: center; justify-content: center; color: #2563eb; flex-shrink: 0;">
                                <span data-lucide="folder" data-size="22"></span>
                            </div>
                            <div>
                                <div id="driveFolderNameInline_${folder.id}" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                    <div style="font-weight: 800; font-size: 0.95rem; color: #1e3a8a;">📁 ${folder.name}</div>
                                    <button type="button" onclick="editFolderName('${folder.id}')" style="background: none; border: none; color: #2563eb; cursor: pointer; padding: 1px 4px; font-size: 0.72rem; text-decoration: underline;" title="تعديل اسم المجلد">تعديل الاسم</button>
                                </div>
                                <div style="font-size: 0.76rem; color: #64748b; display: flex; gap: 8px; flex-wrap: wrap; margin-top: 3px;">
                                    <span>المستوى: <strong>${folder.level || 'عام'}</strong></span>
                                    <span>•</span>
                                    <span>الملفات المزامنة: <strong style="color: #059669;">${folder.syncedFilesCount || 0}</strong></span>
                                    <span>•</span>
                                    <span>آخر فحص: <strong>${folder.lastSyncFormatted || 'لم تتم بعد'}</strong></span>
                                </div>
                            </div>
                        </div>

                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <label style="display: flex; align-items: center; gap: 6px; font-size: 0.78rem; font-weight: 600; color: #334155; cursor: pointer; background: #fff; padding: 5px 8px; border-radius: 6px; border: 1px solid #cbd5e1;">
                                <input type="checkbox" ${isAuto ? 'checked' : ''} onchange="toggleFolderAutoSync('${folder.id}')" style="accent-color: #2563eb;">
                                <span>مزامنة حية</span>
                            </label>
                            <button type="button" onclick="syncDriveFolder('${folder.id}', true).then(() => { renderDriveFoldersManagerList(); renderLinkedDriveFolders(); renderLibrary(); })" style="padding: 6px 10px; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 6px; font-size: 0.78rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                <span data-lucide="refresh-cw" data-size="12"></span> فحص الآن
                            </button>
                            <a href="${folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`}" target="_blank" rel="noopener noreferrer" style="padding: 6px 8px; background: #fff; color: #334155; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.78rem; font-weight: 600; text-decoration: none; display: flex; align-items: center; gap: 4px;" title="فتح المجلد في Google Drive">
                                <span data-lucide="external-link" data-size="12"></span> Drive
                            </a>
                            <button type="button" onclick="unlinkDriveFolder('${folder.id}')" style="padding: 6px 9px; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; font-size: 0.78rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;" title="إلغاء ربط المجلد">
                                <span data-lucide="unlink" data-size="12"></span> إلغاء الربط
                            </button>
                        </div>
                    </div>
                `;
            });
            listEl.innerHTML = html;
            if (window.lucide) window.lucide.createIcons();
        }
        window.renderDriveFoldersManagerList = renderDriveFoldersManagerList;

        function toggleFolderAutoSync(folderId) {
            if (!db.libraryDriveFolders) return;
            const folder = db.libraryDriveFolders.find(f => f.id === folderId);
            if (!folder) return;
            folder.autoSync = !(folder.autoSync !== false);
            saveDB();
            renderLinkedDriveFolders();
            showLibraryToast(folder.autoSync ? `تم تفعيل المزامنة التلقائية لمجلد "${folder.name}".` : `تم إيقاف المزامنة التلقائية لمجلد "${folder.name}".`);
        }

        async function unlinkDriveFolder(folderId) {
            if (!db.libraryDriveFolders) return;
            const folder = db.libraryDriveFolders.find(f => f.id === folderId);
            if (!folder) return;

            let deleteFiles = false;
            if (typeof window.showConfirmDialog === 'function') {
                deleteFiles = await window.showConfirmDialog(
                    `هل تريد حذف كافة الملفات التابعة لمجلد «${folder.name}» من المكتبة الرقمية أيضاً؟\n\n- انقر "حذف الملفات وإلغاء الربط" لحذف الملفات المستوردة من المكتبة.\n- انقر "إلغاء الربط فقط" للإبقاء على الملفات في المكتبة وإلغاء ربط المجلد فقط.`,
                    { title: 'إلغاء ربط مجلد Google Drive', confirmText: 'حذف الملفات وإلغاء الربط', cancelText: 'إلغاء الربط فقط', danger: true }
                );
            }

            if (deleteFiles) {
                if (db.library) {
                    db.library = db.library.filter(item => item.driveFolderId !== folderId);
                }
            }

            db.libraryDriveFolders = db.libraryDriveFolders.filter(f => f.id !== folderId);
            saveDB();
            renderLinkedDriveFolders();
            renderDriveFoldersManagerList();
            renderLibrary();
            showLibraryToast(`تم إلغاء ربط مجلد "${folder.name}".`);
        }

        function previewDriveResource(driveFileId, encodedTitle, webViewLink, downloadUrl, fileType) {
            const title = decodeURIComponent(encodedTitle || 'معاينة ملف Google Drive');
            openInAppFileViewer({
                type: 'drive',
                driveFileId: driveFileId,
                title: title,
                url: webViewLink,
                downloadUrl: downloadUrl,
                fileType: fileType
            });
        }

        function addUrlLibraryItem() {
            const titleInput = document.getElementById('libUrlTitle');
            const urlInput = document.getElementById('libUrl');
            const typeSelect = document.getElementById('libUrlType');
            const levelSelect = document.getElementById('libUrlLevel');
            const topicInput = document.getElementById('libUrlTopic');
            const categorySelect = document.getElementById('libUrlCategory');

            const title = titleInput ? titleInput.value.trim() : '';
            let url = urlInput ? urlInput.value.trim() : '';
            const type = typeSelect ? typeSelect.value : 'link';
            const level = levelSelect ? levelSelect.value : 'عام';
            const topic = topicInput ? topicInput.value.trim() : '';
            const category = categorySelect ? categorySelect.value : (typeof inferResourceCategory === 'function' ? inferResourceCategory({title: title}) : 'درس');

            if (!title || !url) {
                window.notifySafeToast('يرجى إدخال عنوان المورد والرابط.');
                return;
            }
            if (!/^https?:\/\//i.test(url)) {
                url = 'https://' + url;
            }

            if (!db.library) db.library = [];
            db.library.unshift({
                id: Date.now().toString(),
                title: title,
                url: url,
                isLocalFile: false,
                isDriveFile: false,
                category: category,
                type: type,
                topic: topic,
                level: level,
                dateAdded: window.formatLocalDate ? window.formatLocalDate() : new Date().toLocaleDateString('en-CA')
            });

            saveDB();
            if (titleInput) titleInput.value = '';
            if (urlInput) urlInput.value = '';
            if (topicInput) topicInput.value = '';
            renderLibrary();
            showLibraryToast('تم حفظ الرابط في المكتبة الرقمية بنجاح!');
        }

        function formatLibFileSize(bytes) {
            if (!bytes || isNaN(bytes)) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        }

        function handleLibLocalFileSelect(input) {
            const file = input.files && input.files[0];
            if (!file) return;
            setSelectedLibFile(file);
        }

        function setSelectedLibFile(file) {
            currentSelectedLibFile = file;
            const fileBox = document.getElementById('libSelectedFileBox');
            const fileName = document.getElementById('libSelectedFileName');
            const fileSize = document.getElementById('libSelectedFileSize');
            const dropZone = document.getElementById('libDropZone');
            const titleInput = document.getElementById('libTitle');
            const typeSelect = document.getElementById('libType');

            if (fileBox) fileBox.style.display = 'flex';
            if (dropZone) dropZone.style.display = 'none';
            if (fileName) fileName.textContent = file.name;
            if (fileSize) fileSize.textContent = formatLibFileSize(file.size);

            if (titleInput && !titleInput.value.trim()) {
                const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                titleInput.value = nameWithoutExt;
            }

            // Trigger AI classification suggestion automatically
            requestAiResourceClassification('local', false);

            if (typeSelect) {
                const ext = (file.name.split('.').pop() || '').toLowerCase();
                if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) {
                    typeSelect.value = 'doc';
                } else if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
                    typeSelect.value = 'video';
                } else {
                    typeSelect.value = 'doc';
                }
            }
        }

        function clearSelectedLibFile(e) {
            if (e) e.stopPropagation();
            currentSelectedLibFile = null;
            const fileInput = document.getElementById('libLocalFileInput');
            if (fileInput) fileInput.value = '';
            const fileBox = document.getElementById('libSelectedFileBox');
            const dropZone = document.getElementById('libDropZone');
            if (fileBox) fileBox.style.display = 'none';
            if (dropZone) dropZone.style.display = 'flex';
            const suggBox = document.getElementById('libAiLocalSuggestionBox');
            if (suggBox) {
                suggBox.style.display = 'none';
                suggBox.innerHTML = '';
            }
        }

        function initLibDropZone() {
            const dropZone = document.getElementById('libDropZone');
            if (!dropZone || dropZone._initialized) return;
            dropZone._initialized = true;

            ['dragenter', 'dragover'].forEach(eventName => {
                dropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropZone.classList.add('dragover');
                }, false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropZone.classList.remove('dragover');
                }, false);
            });

            dropZone.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                const files = dt.files;
                if (files && files.length > 0) {
                    setSelectedLibFile(files[0]);
                }
            }, false);
        }

        async function addLibraryItem() {
            const titleInput = document.getElementById('libTitle');
            const typeSelect = document.getElementById('libType');
            const topicInput = document.getElementById('libTopic');
            const levelSelect = document.getElementById('libLevel');
            const categorySelect = document.getElementById('libLocalCategory');

            const title = titleInput ? titleInput.value.trim() : '';
            const type = typeSelect ? typeSelect.value : 'doc';
            const topic = topicInput ? topicInput.value.trim() : '';
            const level = levelSelect ? levelSelect.value : 'عام';
            const category = categorySelect ? categorySelect.value : (typeof inferResourceCategory === 'function' ? inferResourceCategory({title: title, fileName: currentSelectedLibFile?.name}) : 'درس');

            if (currentLibMode === 'local') {
                if (!currentSelectedLibFile) {
                    window.notifySafeToast('يرجى اختيار ملف محلي من جهازك أو سحبه وإفلاته أولاً.');
                    return;
                }
                const resourceTitle = title || currentSelectedLibFile.name;
                const resourceId = Date.now().toString();

                try {
                    const btn = document.getElementById('btnSaveLibResource');
                    if (btn) btn.disabled = true;

                    await ResourceDB.saveFile(resourceId, currentSelectedLibFile);

                    if (!db.library) db.library = [];
                    db.library.push({
                        id: resourceId,
                        title: resourceTitle,
                        isLocalFile: true,
                        category: category,
                        fileName: currentSelectedLibFile.name,
                        fileSize: formatLibFileSize(currentSelectedLibFile.size),
                        fileType: currentSelectedLibFile.type || 'application/octet-stream',
                        type: type,
                        topic: topic,
                        level: level,
                        dateAdded: window.formatLocalDate ? window.formatLocalDate() : new Date().toLocaleDateString('en-CA')
                    });

                    saveDB();
                    clearSelectedLibFile();
                    if (titleInput) titleInput.value = '';
                    if (topicInput) topicInput.value = '';

                    window.notifySafeToast('تم حفظ المورد الرقمي في المكتبة بنجاح!');
                    renderLibrary();
                } catch(err) {
                    window.notifySafeToast('حدث خطأ أثناء حفظ الملف محلياً: ' + err.message);
                } finally {
                    const btn = document.getElementById('btnSaveLibResource');
                    if (btn) btn.disabled = false;
                }
            } else {
                let url = document.getElementById('libUrl') ? document.getElementById('libUrl').value.trim() : '';
                if (!title || !url) {
                    window.notifySafeToast('يرجى إدخال عنوان المورد والرابط.');
                    return;
                }
                if (!/^https?:\/\//i.test(url)) {
                    url = 'https://' + url;
                }

                if (!db.library) db.library = [];
                db.library.push({
                    id: Date.now().toString(),
                    title: title,
                    url: url,
                    category: category,
                    isLocalFile: false,
                    type: type,
                    topic: topic,
                    level: level,
                    dateAdded: window.formatLocalDate ? window.formatLocalDate() : new Date().toLocaleDateString('en-CA')
                });

                saveDB();
                if (titleInput) titleInput.value = '';
                if (document.getElementById('libUrl')) document.getElementById('libUrl').value = '';
                if (topicInput) topicInput.value = '';

                renderLibrary();
            }
        }


        // =========================================================================
        // Built-in File Player & Document Viewer (PDF, Video & Media)
        // =========================================================================

        function extractYouTubeId(url) {
            if (!url) return null;
            const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|watch\?.+&v=))([\w-]{11})/i);
            return (match && match[1]) ? match[1] : null;
        }

        function extractDriveFileId(url) {
            if (!url) return null;
            const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
            return (match && match[1]) ? match[1] : null;
        }

        function extractVimeoId(url) {
            if (!url) return null;
            const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
            return (match && match[1]) ? match[1] : null;
        }

        function formatMediaTime(seconds) {
            if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
            const s = Math.floor(seconds % 60);
            const m = Math.floor((seconds / 60) % 60);
            const h = Math.floor(seconds / 3600);
            const sStr = s < 10 ? '0' + s : s;
            if (h > 0) {
                const mStr = m < 10 ? '0' + m : m;
                return `${h}:${mStr}:${sStr}`;
            }
            return `${m}:${sStr}`;
        }

        var currentPreviewBlobUrl = null;
        var currentPreviewVideoEl = null;
        var currentPreviewKeyboardHandler = null;

        var currentPdfState = {
            blob: null,
            blobUrl: null,
            title: '',
            currentPage: 1,
            totalPages: 1,
            zoomScale: 1.0,
            engine: 'native', // 'native' or 'canvas'
            pdfDoc: null
        };

        function togglePreviewModalFullscreen() {
            const dialog = document.getElementById('filePreviewDialog');
            if (!dialog) return;
            const isFull = dialog.classList.toggle('is-fullscreen');
            const btn = document.getElementById('previewFullscreenModalBtn');
            if (btn) {
                btn.innerHTML = isFull ? lucideIcon('minimize', {size: 16}) : lucideIcon('maximize', {size: 16});
                btn.title = isFull ? 'تصغير النافذة' : 'ملء الشاشة';
                if (window.lucide) lucide.createIcons();
            }
        }

        function attachPlayerKeyboardShortcuts() {
            detachPlayerKeyboardShortcuts();
            currentPreviewKeyboardHandler = function(e) {
                const modal = document.getElementById('filePreviewModal');
                if (!modal || modal.style.display === 'none') return;

                if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

                if (e.key === 'Escape') {
                    e.preventDefault();
                    closeFilePreviewModal();
                    return;
                }

                const video = currentPreviewVideoEl || document.getElementById('inAppVideoEl');
                if (video) {
                    if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
                        e.preventDefault();
                        if (video.paused) video.play(); else video.pause();
                    } else if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        video.currentTime = Math.max(0, video.currentTime - 5);
                    } else if (e.key === 'ArrowRight') {
                        e.preventDefault();
                        video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        video.volume = Math.min(1, video.volume + 0.1);
                    } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        video.volume = Math.max(0, video.volume - 0.1);
                    } else if (e.key === 'm' || e.key === 'M') {
                        e.preventDefault();
                        video.muted = !video.muted;
                    } else if (e.key === 'f' || e.key === 'F') {
                        e.preventDefault();
                        togglePreviewModalFullscreen();
                    }
                }
            };
            window.addEventListener('keydown', currentPreviewKeyboardHandler);
        }

        function detachPlayerKeyboardShortcuts() {
            if (currentPreviewKeyboardHandler) {
                window.removeEventListener('keydown', currentPreviewKeyboardHandler);
                currentPreviewKeyboardHandler = null;
            }
        }

        // --- PDF Viewer Toolbar & Engine Handlers ---
        function updatePdfToolbarUI() {
            const currentEl = document.getElementById('pdfCurrentPageNum');
            const totalEl = document.getElementById('pdfTotalPagesCount');
            const zoomEl = document.getElementById('pdfZoomLevelLabel');
            const prevBtn = document.getElementById('pdfPrevPageBtn');
            const nextBtn = document.getElementById('pdfNextPageBtn');
            const engineBtn = document.getElementById('pdfEngineToggleBtn');

            if (currentEl) currentEl.textContent = currentPdfState.currentPage || 1;
            if (totalEl) totalEl.textContent = currentPdfState.totalPages || 1;
            if (zoomEl) zoomEl.textContent = Math.round(currentPdfState.zoomScale * 100) + '%';
            if (prevBtn) prevBtn.disabled = (currentPdfState.currentPage <= 1);
            if (nextBtn) nextBtn.disabled = (currentPdfState.currentPage >= currentPdfState.totalPages);
            if (engineBtn) {
                engineBtn.innerHTML = currentPdfState.engine === 'native'
                    ? '<span>عرض تفاعلي</span>'
                    : '<span>عرض أصلي</span>';
            }
        }

        function onPdfPrevPage() {
            if (currentPdfState.currentPage > 1) {
                currentPdfState.currentPage--;
                updatePdfToolbarUI();
                if (currentPdfState.engine === 'canvas') {
                    renderPdfPageCanvas(currentPdfState.currentPage);
                }
            }
        }

        function onPdfNextPage() {
            if (currentPdfState.currentPage < currentPdfState.totalPages) {
                currentPdfState.currentPage++;
                updatePdfToolbarUI();
                if (currentPdfState.engine === 'canvas') {
                    renderPdfPageCanvas(currentPdfState.currentPage);
                }
            }
        }

        function onPdfZoomIn() {
            currentPdfState.zoomScale = Math.min(2.5, currentPdfState.zoomScale + 0.2);
            updatePdfToolbarUI();
            if (currentPdfState.engine === 'canvas') {
                renderPdfPageCanvas(currentPdfState.currentPage);
            } else {
                const iframe = document.getElementById('inAppPdfNativeIframe');
                if (iframe) {
                    iframe.style.transformOrigin = 'top center';
                    iframe.style.transform = `scale(${currentPdfState.zoomScale})`;
                }
            }
        }

        function onPdfZoomOut() {
            currentPdfState.zoomScale = Math.max(0.6, currentPdfState.zoomScale - 0.2);
            updatePdfToolbarUI();
            if (currentPdfState.engine === 'canvas') {
                renderPdfPageCanvas(currentPdfState.currentPage);
            } else {
                const iframe = document.getElementById('inAppPdfNativeIframe');
                if (iframe) {
                    iframe.style.transformOrigin = 'top center';
                    iframe.style.transform = `scale(${currentPdfState.zoomScale})`;
                }
            }
        }

        function onPdfFitWidth() {
            currentPdfState.zoomScale = 1.0;
            updatePdfToolbarUI();
            if (currentPdfState.engine === 'canvas') {
                renderPdfPageCanvas(currentPdfState.currentPage);
            } else {
                const iframe = document.getElementById('inAppPdfNativeIframe');
                if (iframe) {
                    iframe.style.transform = 'none';
                }
            }
        }

        function onPdfPrint() {
            if (currentPdfState.blobUrl) {
                const iframe = document.getElementById('inAppPdfNativeIframe');
                if (iframe && iframe.contentWindow) {
                    try {
                        iframe.contentWindow.focus();
                        iframe.contentWindow.print();
                        return;
                    } catch (e) {}
                }
                if (typeof window.openSafeExternalUrl === 'function') {
                    window.openSafeExternalUrl(currentPdfState.blobUrl);
                }
            }
        }

        function togglePdfViewerEngine() {
            currentPdfState.engine = (currentPdfState.engine === 'native') ? 'canvas' : 'native';
            updatePdfToolbarUI();
            const container = document.getElementById('previewModalContent');
            if (currentPdfState.engine === 'native') {
                renderPdfNative(container, currentPdfState.blobUrl);
            } else {
                renderPdfCanvas(container, currentPdfState.blob);
            }
        }

        function renderPdfNative(container, blobUrl) {
            container.innerHTML = `
                <iframe id="inAppPdfNativeIframe" src="${blobUrl}#toolbar=1&navpanes=1"
                    style="width: 100%; height: 100%; border: none; background: #334155; transition: transform 0.2s;"
                    allowfullscreen>
                </iframe>
            `;
        }

        async function renderPdfPageCanvas(pageNum) {
            if (!currentPdfState.pdfDoc) return;
            const container = document.getElementById('inAppPdfCanvasWrap');
            if (!container) return;

            try {
                const page = await currentPdfState.pdfDoc.getPage(pageNum);
                const viewport = page.getViewport({ scale: currentPdfState.zoomScale * 1.5 });

                container.querySelectorAll('canvas').forEach(c => { c.width = 0; c.height = 0; });
                container.innerHTML = '';
                const card = document.createElement('div');
                card.className = 'inapp-pdf-page-card';

                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                card.appendChild(canvas);

                const badge = document.createElement('div');
                badge.className = 'inapp-pdf-page-badge';
                badge.textContent = `صفحة ${pageNum} من ${currentPdfState.totalPages}`;
                card.appendChild(badge);

                container.appendChild(card);

                const renderContext = {
                    canvasContext: canvas.getContext('2d'),
                    viewport: viewport
                };
                await page.render(renderContext).promise;
            } catch (err) {
                console.error('PDF Page render error:', err);
            }
        }

        async function renderPdfCanvas(container, blob) {
            container.innerHTML = `
                <div style="color: #cbd5e1; padding: 30px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px;">
                    <div class="loader-spinner" style="width: 34px; height: 34px; border: 3px solid rgba(255,255,255,0.2); border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <span style="font-size: 0.9rem;">جاري معالجة مستند PDF للعرض التفاعلي...</span>
                </div>
            `;

            const loadAndInit = async () => {
                try {
                    if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
                        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                    }
                    if (currentPdfState.pdfDoc && typeof currentPdfState.pdfDoc.destroy === 'function') {
                        try { currentPdfState.pdfDoc.destroy(); } catch (e) {}
                        currentPdfState.pdfDoc = null;
                    }
                    const arrayBuffer = await blob.arrayBuffer();
                    const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
                    const pdfDoc = await loadingTask.promise;

                    currentPdfState.pdfDoc = pdfDoc;
                    currentPdfState.totalPages = pdfDoc.numPages;
                    currentPdfState.currentPage = 1;
                    updatePdfToolbarUI();

                    container.innerHTML = `
                        <div id="inAppPdfScrollBox" class="inapp-pdf-scroll-box">
                            <div id="inAppPdfCanvasWrap" style="display: flex; justify-content: center; width: 100%;"></div>
                        </div>
                    `;
                    renderPdfPageCanvas(1);
                } catch (err) {
                    console.warn('PDF.js interactive failed, switching to native:', err);
                    currentPdfState.engine = 'native';
                    updatePdfToolbarUI();
                    renderPdfNative(container, currentPdfState.blobUrl);
                }
            };

            if (!window.pdfjsLib) {
                if (typeof window.ensurePdfJsLoaded === 'function') {
                    window.ensurePdfJsLoaded().then((lib) => {
                        if (lib) {
                            loadAndInit();
                        } else {
                            currentPdfState.engine = 'native';
                            updatePdfToolbarUI();
                            renderPdfNative(container, currentPdfState.blobUrl);
                        }
                    });
                } else {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
                    script.onload = loadAndInit;
                    script.onerror = () => {
                        currentPdfState.engine = 'native';
                        updatePdfToolbarUI();
                        renderPdfNative(container, currentPdfState.blobUrl);
                    };
                    document.head.appendChild(script);
                }
            } else {
                loadAndInit();
            }
        }

        // --- Custom In-App Video Player Builder ---
        function renderCustomInAppVideoPlayer(videoSrc, title, options = {}) {
            const container = document.getElementById('previewModalContent');
            if (!container) return;

            container.innerHTML = `
                <div id="inAppVideoWrapper" class="inapp-video-wrapper">
                    <video id="inAppVideoEl" class="inapp-video-element" src="${videoSrc}" playsinline preload="metadata">
                        متصفحك لا يدعم تشغيل هذا الفيديو مباشرة.
                    </video>

                    <!-- Big Center Play Overlay -->
                    <div id="inAppVideoCenterPlay" class="inapp-video-center-play" title="تشغيل / إيقاف">
                        <span data-lucide="play" data-size="34"></span>
                    </div>

                    <!-- Speed Menu Dropdown -->
                    <div id="inAppVideoSpeedMenu" class="inapp-speed-menu">
                        <button type="button" class="inapp-speed-opt" onclick="setInAppVideoSpeed(0.5)">0.5x</button>
                        <button type="button" class="inapp-speed-opt" onclick="setInAppVideoSpeed(0.75)">0.75x</button>
                        <button type="button" class="inapp-speed-opt active" onclick="setInAppVideoSpeed(1.0)">1.0x (عادي)</button>
                        <button type="button" class="inapp-speed-opt" onclick="setInAppVideoSpeed(1.25)">1.25x</button>
                        <button type="button" class="inapp-speed-opt" onclick="setInAppVideoSpeed(1.5)">1.5x</button>
                        <button type="button" class="inapp-speed-opt" onclick="setInAppVideoSpeed(2.0)">2.0x</button>
                    </div>

                    <!-- Bottom Controls Bar -->
                    <div id="inAppVideoControlsBar" class="inapp-video-controls-bar">
                        <!-- Seek Track -->
                        <div id="inAppVideoSeekTrack" class="inapp-video-seek-track" title="شريط التقديم">
                            <div id="inAppVideoSeekFill" class="inapp-video-seek-fill"></div>
                        </div>

                        <!-- Buttons Row -->
                        <div class="inapp-video-btn-row">
                            <!-- Left Controls in RTL (Play, Skip, Vol, Time) -->
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <button type="button" id="inAppVideoPlayBtn" class="inapp-vctrl-btn" title="تشغيل / إيقاف (مسافة)">
                                    <span data-lucide="play" data-size="18"></span>
                                </button>
                                <button type="button" id="inAppVideoRewindBtn" class="inapp-vctrl-btn" title="ترجيع 10 ثوانٍ">
                                    <span data-lucide="rotate-ccw" data-size="16"></span>
                                </button>
                                <button type="button" id="inAppVideoForwardBtn" class="inapp-vctrl-btn" title="تقديم 10 ثوانٍ">
                                    <span data-lucide="rotate-cw" data-size="16"></span>
                                </button>

                                <div style="display: flex; align-items: center; gap: 4px; margin-inline-start: 4px;">
                                    <button type="button" id="inAppVideoVolBtn" class="inapp-vctrl-btn" title="كتم / تشغيل الصوت (M)">
                                        <span data-lucide="volume-2" data-size="18"></span>
                                    </button>
                                    <input type="range" id="inAppVideoVolSlider" min="0" max="1" step="0.05" value="1"
                                        style="width: 70px; height: 4px; accent-color: #3b82f6; cursor: pointer;" title="مستوى الصوت">
                                </div>

                                <div id="inAppVideoTime" style="font-size: 0.78rem; font-weight: 600; color: #cbd5e1; direction: ltr; margin-inline-start: 8px;">
                                    0:00 / 0:00
                                </div>
                            </div>

                            <!-- Right Controls in RTL (Speed, PiP, Fullscreen) -->
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <button type="button" id="inAppVideoSpeedBtn" class="inapp-vctrl-btn" style="font-size: 0.75rem; font-weight: 700; padding: 4px 8px;" title="سرعة التشغيل">
                                    1x
                                </button>
                                <button type="button" id="inAppVideoPipBtn" class="inapp-vctrl-btn" title="نافذة عائمة (PiP)">
                                    <span data-lucide="picture-in-picture-2" data-size="16"></span>
                                </button>
                                <button type="button" id="inAppVideoFsBtn" class="inapp-vctrl-btn" title="ملء الشاشة">
                                    <span data-lucide="maximize" data-size="16"></span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            if (window.lucide) lucide.createIcons();

            const video = document.getElementById('inAppVideoEl');
            currentPreviewVideoEl = video;
            const wrapper = document.getElementById('inAppVideoWrapper');
            const playBtn = document.getElementById('inAppVideoPlayBtn');
            const centerPlay = document.getElementById('inAppVideoCenterPlay');
            const seekTrack = document.getElementById('inAppVideoSeekTrack');
            const seekFill = document.getElementById('inAppVideoSeekFill');
            const timeDisplay = document.getElementById('inAppVideoTime');
            const volBtn = document.getElementById('inAppVideoVolBtn');
            const volSlider = document.getElementById('inAppVideoVolSlider');
            const speedBtn = document.getElementById('inAppVideoSpeedBtn');
            const speedMenu = document.getElementById('inAppVideoSpeedMenu');
            const pipBtn = document.getElementById('inAppVideoPipBtn');
            const fsBtn = document.getElementById('inAppVideoFsBtn');
            const rewindBtn = document.getElementById('inAppVideoRewindBtn');
            const forwardBtn = document.getElementById('inAppVideoForwardBtn');

            const togglePlay = () => {
                if (video.paused) {
                    video.play().catch(e => console.warn('Play interrupted:', e));
                } else {
                    video.pause();
                }
            };

            playBtn.addEventListener('click', togglePlay);
            centerPlay.addEventListener('click', togglePlay);
            video.addEventListener('click', togglePlay);

            video.addEventListener('play', () => {
                playBtn.innerHTML = lucideIcon('pause', {size: 18});
                centerPlay.style.display = 'none';
                if (window.lucide) lucide.createIcons();
            });

            video.addEventListener('pause', () => {
                playBtn.innerHTML = lucideIcon('play', {size: 18});
                centerPlay.style.display = 'flex';
                if (window.lucide) lucide.createIcons();
            });

            video.addEventListener('timeupdate', () => {
                if (!video.duration) return;
                const percent = (video.currentTime / video.duration) * 100;
                seekFill.style.width = percent + '%';
                timeDisplay.textContent = `${formatMediaTime(video.currentTime)} / ${formatMediaTime(video.duration)}`;
            });

            video.addEventListener('loadedmetadata', () => {
                timeDisplay.textContent = `${formatMediaTime(video.currentTime)} / ${formatMediaTime(video.duration)}`;
            });

            // Seek functionality
            seekTrack.addEventListener('click', (e) => {
                const rect = seekTrack.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                if (video.duration) {
                    video.currentTime = Math.max(0, Math.min(video.duration, pos * video.duration));
                }
            });

            // Rewind / Forward 10s
            rewindBtn.addEventListener('click', () => {
                video.currentTime = Math.max(0, video.currentTime - 10);
            });
            forwardBtn.addEventListener('click', () => {
                video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
            });

            // Volume controls
            volSlider.addEventListener('input', () => {
                video.volume = parseFloat(volSlider.value);
                video.muted = (video.volume === 0);
                updateVolIcon();
            });

            volBtn.addEventListener('click', () => {
                video.muted = !video.muted;
                updateVolIcon();
            });

            function updateVolIcon() {
                if (video.muted || video.volume === 0) {
                    volBtn.innerHTML = lucideIcon('volume-x', {size: 18});
                } else if (video.volume < 0.5) {
                    volBtn.innerHTML = lucideIcon('volume-1', {size: 18});
                } else {
                    volBtn.innerHTML = lucideIcon('volume-2', {size: 18});
                }
                if (window.lucide) lucide.createIcons();
            }

            // Speed controls
            speedBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                speedMenu.style.display = (speedMenu.style.display === 'flex') ? 'none' : 'flex';
                const rect = speedBtn.getBoundingClientRect();
                const wrapRect = wrapper.getBoundingClientRect();
                speedMenu.style.left = (rect.left - wrapRect.left - 20) + 'px';
            });

            if (_videoSpeedMenuDocClickHandler) {
                document.removeEventListener('click', _videoSpeedMenuDocClickHandler);
            }
            _videoSpeedMenuDocClickHandler = () => {
                if (speedMenu) speedMenu.style.display = 'none';
            };
            document.addEventListener('click', _videoSpeedMenuDocClickHandler);

            window.setInAppVideoSpeed = function(rate) {
                video.playbackRate = rate;
                speedBtn.textContent = rate + 'x';
                const opts = document.querySelectorAll('.inapp-speed-opt');
                opts.forEach(opt => {
                    opt.classList.toggle('active', opt.textContent.startsWith(rate + 'x'));
                });
                if (speedMenu) speedMenu.style.display = 'none';
            };

            // Picture-in-Picture
            if (document.pictureInPictureEnabled && !video.disablePictureInPicture) {
                pipBtn.addEventListener('click', async () => {
                    try {
                        if (document.pictureInPictureElement) {
                            await document.exitPictureInPicture();
                        } else {
                            await video.requestPictureInPicture();
                        }
                    } catch (err) {
                        console.warn('PiP error:', err);
                    }
                });
            } else {
                pipBtn.style.display = 'none';
            }

            // Fullscreen
            fsBtn.addEventListener('click', () => {
                togglePreviewModalFullscreen();
            });

            // Autohide controls on inactivity
            let hideTimeout;
            const resetInactivity = () => {
                wrapper.classList.remove('controls-hidden');
                clearTimeout(hideTimeout);
                if (!video.paused) {
                    hideTimeout = setTimeout(() => {
                        wrapper.classList.add('controls-hidden');
                    }, 3000);
                }
            };
            wrapper.addEventListener('mousemove', resetInactivity);
            wrapper.addEventListener('touchstart', resetInactivity);
            video.addEventListener('play', resetInactivity);

            // Auto-start playback safely
            video.play().catch(e => {
                console.log('Autoplay prevented, awaiting user click:', e);
            });
        }

        // --- Render Embedded Players (YouTube, Drive, Vimeo) ---
        function renderEmbeddedVideoPlayer(url, title, type = 'youtube') {
            const container = document.getElementById('previewModalContent');
            if (!container) return;

            let embedHtml = '';
            if (type === 'youtube') {
                const ytId = extractYouTubeId(url);
                embedHtml = `
                    <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #000;">
                        <iframe src="https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&enablejsapi=1&rel=0"
                            style="width: 100%; height: 100%; max-width: 1200px; border: none;"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowfullscreen>
                        </iframe>
                    </div>
                `;
            } else if (type === 'vimeo') {
                const vimeoId = extractVimeoId(url);
                embedHtml = `
                    <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #000;">
                        <iframe src="https://player.vimeo.com/video/${vimeoId}?autoplay=1"
                            style="width: 100%; height: 100%; max-width: 1200px; border: none;"
                            allow="autoplay; fullscreen; picture-in-picture"
                            allowfullscreen>
                        </iframe>
                    </div>
                `;
            } else if (type === 'drive') {
                const driveId = extractDriveFileId(url) || url;
                embedHtml = `
                    <div style="width: 100%; height: 100%; display: flex; flex-direction: column; background: #020617;">
                        <iframe src="https://drive.google.com/file/d/${driveId}/preview"
                            style="flex: 1; width: 100%; height: 100%; border: none;"
                            allow="autoplay; fullscreen"
                            allowfullscreen>
                        </iframe>
                    </div>
                `;
            }

            container.innerHTML = embedHtml;
        }

        // =========================================================================
        // Main Unified File & Media Viewer Entry Point
        // =========================================================================
        var currentPreviewResourceUrl = '';
        var currentPreviewResourceTitle = '';

        async function openInAppFileViewer(options = {}) {
            const modal = document.getElementById('filePreviewModal');
            const titleEl = document.getElementById('previewModalTitle');
            const badgeEl = document.getElementById('previewModalBadge');
            const iconEl = document.getElementById('previewModalIcon');
            const contentEl = document.getElementById('previewModalContent');
            const pdfToolbar = document.getElementById('previewPdfToolbar');
            const downloadBtn = document.getElementById('previewDownloadBtn');
            const externalLinkBtn = document.getElementById('previewExternalLinkBtn');

            if (!modal || !contentEl) return;

            currentPreviewResourceUrl = options.url || options.downloadUrl || '';
            currentPreviewResourceTitle = options.title ? decodeURIComponent(options.title) : '';

            // Reset view state
            if (pdfToolbar) pdfToolbar.style.display = 'none';
            if (downloadBtn) { downloadBtn.style.display = 'none'; downloadBtn.onclick = null; }
            if (externalLinkBtn) { externalLinkBtn.style.display = 'none'; externalLinkBtn.href = '#'; }
            contentEl.innerHTML = `
                <div style="color: #94a3b8; display: flex; flex-direction: column; align-items: center; gap: 12px;">
                    <div class="loader-spinner" style="width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.2); border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <span>جاري تحميل الملف وتجهيز المشغل...</span>
                </div>
            `;
            modal.style.display = 'flex';
            attachPlayerKeyboardShortcuts();

            try {
                // CASE 1: Local IndexedDB File
                if (options.type === 'local') {
                    const record = await ResourceDB.getFile(options.id);
                    if (!record || !record.data) {
                        window.notifySafeToast('عذراً، لم يتم العثور على الملف المحلي في ذاكرة هذا المتصفح.');
                        closeFilePreviewModal();
                        return;
                    }

                    const title = record.name || options.title || 'ملف محلي';
                    const mimeType = record.data.type || '';
                    if (titleEl) titleEl.textContent = title;

                    // Setup download button
                    if (downloadBtn) {
                        downloadBtn.style.display = 'inline-flex';
                        downloadBtn.title = 'تنزيل الملف المحلي';
                        downloadBtn.onclick = () => openLocalResource(options.id);
                    }

                    if (currentPreviewBlobUrl) URL.revokeObjectURL(currentPreviewBlobUrl);
                    currentPreviewBlobUrl = URL.createObjectURL(record.data);

                    if (mimeType === 'application/pdf' || /\.pdf$/i.test(title)) {
                        // PDF File
                        if (badgeEl) badgeEl.textContent = 'عارض مستندات PDF المدمج';
                        if (iconEl) iconEl.innerHTML = `<span style="color: #ef4444;" data-lucide="file-text"></span>`;
                        if (pdfToolbar) pdfToolbar.style.display = 'flex';

                        currentPdfState.blob = record.data;
                        currentPdfState.blobUrl = currentPreviewBlobUrl;
                        currentPdfState.title = title;
                        currentPdfState.currentPage = 1;
                        currentPdfState.zoomScale = 1.0;
                        currentPdfState.engine = 'native';
                        updatePdfToolbarUI();

                        renderPdfNative(contentEl, currentPreviewBlobUrl);

                    } else if (mimeType.startsWith('video/') || /\.(mp4|webm|mov|ogg|mkv)$/i.test(title)) {
                        // Video File
                        if (badgeEl) badgeEl.textContent = 'مشغل الفيديو المدمج (ملف محلي)';
                        if (iconEl) iconEl.innerHTML = `<span style="color: #3b82f6;" data-lucide="play-circle"></span>`;
                        renderCustomInAppVideoPlayer(currentPreviewBlobUrl, title, { isBlob: true });

                    } else if (mimeType.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(title)) {
                        // Audio File
                        if (badgeEl) badgeEl.textContent = 'مشغل الصوتيات المدمج';
                        if (iconEl) iconEl.innerHTML = `<span style="color: #10b981;" data-lucide="headphones"></span>`;
                        contentEl.innerHTML = `
                            <div style="background: #1e293b; padding: 35px 25px; border-radius: 16px; width: 90%; max-width: 500px; text-align: center; border: 1px solid #334155; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                                <div style="color: #10b981; margin-bottom: 15px;">${lucideIcon('headphones', {size: 48})}</div>
                                <h4 style="color: #ffffff; margin: 0 0 16px 0; font-size: 1.1rem; word-break: break-word;">${title}</h4>
                                <audio src="${currentPreviewBlobUrl}" controls autoplay style="width: 100%; outline: none;"></audio>
                            </div>
                        `;

                    } else if (mimeType.startsWith('image/')) {
                        // Image File
                        if (badgeEl) badgeEl.textContent = 'معاينة الصورة';
                        if (iconEl) iconEl.innerHTML = `<span style="color: #8b5cf6;" data-lucide="image"></span>`;
                        contentEl.innerHTML = `
                            <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 15px;">
                                <img src="${currentPreviewBlobUrl}" alt="${title}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.4);">
                            </div>
                        `;

                    } else if (mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType === 'application/javascript') {
                        // Text Document
                        if (badgeEl) badgeEl.textContent = 'مستند نصي';
                        if (iconEl) iconEl.innerHTML = `<span style="color: #64748b;" data-lucide="file-code"></span>`;
                        const text = await record.data.text();
                        contentEl.innerHTML = `
                            <pre style="width: 100%; height: 100%; margin: 0; padding: 20px; box-sizing: border-box; overflow: auto; text-align: left; direction: ltr; background: #ffffff; color: #0f172a; font-family: monospace; font-size: 0.9rem;">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                        `;

                    } else {
                        // Fallback for unsupported local formats
                        if (badgeEl) badgeEl.textContent = 'ملف مرفق';
                        if (iconEl) iconEl.innerHTML = `<span style="color: #64748b;" data-lucide="file"></span>`;
                        contentEl.innerHTML = `
                            <div style="text-align: center; color: #94a3b8; padding: 30px;">
                                <div style="color: #64748b; margin-bottom: 15px;">${lucideIcon('file', {size: 54})}</div>
                                <h4 style="color: #ffffff; margin: 0 0 8px 0; font-size: 1.1rem;">${title}</h4>
                                <p style="font-size: 0.85rem; color: #94a3b8; margin: 0 0 20px 0;">لا يتوفر مشغل مباشر لهذا النوع من الملفات داخل المتصفح.</p>
                                <button onclick="openLocalResource('${options.id}')" style="background: #059669; color: white; border: none; padding: 9px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;">
                                    <span>${lucideIcon('download', {size: 14})}</span> تنزيل الملف إلى جهازك
                                </button>
                            </div>
                        `;
                    }

                // CASE 2: Google Drive File or Direct Blob PDF
                } else if (options.type === 'drive') {
                    const title = options.title || 'ملف Google Drive';
                    const isBlobUrl = options.url && String(options.url).startsWith('blob:');
                    if (isBlobUrl) {
                        if (currentPreviewBlobUrl && currentPreviewBlobUrl !== options.url) {
                            URL.revokeObjectURL(currentPreviewBlobUrl);
                        }
                        currentPreviewBlobUrl = options.url;
                    }
                    const driveId = isBlobUrl ? '' : (options.driveFileId || extractDriveFileId(options.url));
                    if (titleEl) titleEl.textContent = title;

                    if (externalLinkBtn) {
                        externalLinkBtn.style.display = 'inline-flex';
                        externalLinkBtn.href = options.url || `https://drive.google.com/file/d/${driveId}/view`;
                        externalLinkBtn.title = isBlobUrl ? 'فتح في نافذة جديدة' : 'فتح في Google Drive';
                    }
                    if (downloadBtn && options.downloadUrl) {
                        downloadBtn.style.display = 'inline-flex';
                        downloadBtn.title = 'تنزيل من Drive';
                        downloadBtn.onclick = () => window.openSafeExternalUrl(options.downloadUrl, '_blank');
                    }

                    const isVideo = options.fileType === 'video' || (title && /\.(mp4|webm|mov|mkv)$/i.test(title));
                    const isPdf = options.fileType === 'doc' || (title && /\.pdf$/i.test(title));

                    if (isBlobUrl) {
                        if (badgeEl) badgeEl.textContent = 'عارض مستندات PDF المدمج';
                        if (iconEl) iconEl.innerHTML = `<span style="color: #ef4444;" data-lucide="file-text"></span>`;
                        renderPdfNative(contentEl, options.url);
                    } else if (isVideo) {
                        if (badgeEl) badgeEl.textContent = 'مشغل الفيديو المدمج (Google Drive)';
                        if (iconEl) iconEl.innerHTML = `<span style="color: #3b82f6;" data-lucide="play-circle"></span>`;
                        renderEmbeddedVideoPlayer(driveId, title, 'drive');
                    } else if (isPdf) {
                        if (badgeEl) badgeEl.textContent = 'عارض مستندات PDF (Google Drive)';
                        if (iconEl) iconEl.innerHTML = `<span style="color: #ef4444;" data-lucide="file-text"></span>`;
                        renderEmbeddedVideoPlayer(driveId, title, 'drive');
                    } else {
                        if (badgeEl) badgeEl.textContent = 'معاينة مباشرة من Google Drive';
                        if (iconEl) iconEl.innerHTML = `<span style="color: #2563eb;" data-lucide="cloud"></span>`;
                        renderEmbeddedVideoPlayer(driveId, title, 'drive');
                    }

                // CASE 3: URL / Web Resource
                } else if (options.type === 'url') {
                    const url = options.url;
                    const title = decodeURIComponent(options.title || 'مورد رقمي');
                    if (titleEl) titleEl.textContent = title;

                    if (externalLinkBtn) {
                        externalLinkBtn.style.display = 'inline-flex';
                        externalLinkBtn.href = url;
                        externalLinkBtn.title = 'فتح الرابط الأصلي في علامة تبويب جديدة';
                    }

                    const ytId = extractYouTubeId(url);
                    const vimeoId = extractVimeoId(url);
                    const driveId = extractDriveFileId(url);
                    const isDirectVideo = /\.(mp4|webm|ogg|mov)($|\?)/i.test(url);
                    const isDirectPdf = /\.pdf($|\?)/i.test(url);

                    if (ytId) {
                        // YouTube Video
                        if (badgeEl) badgeEl.textContent = 'مشغل الفيديو المدمج (YouTube)';
                        if (iconEl) iconEl.innerHTML = `<span style="color: #ef4444;" data-lucide="play-circle"></span>`;
                        renderEmbeddedVideoPlayer(url, title, 'youtube');

                    } else if (vimeoId) {
                        // Vimeo Video
                        if (badgeEl) badgeEl.textContent = 'مشغل الفيديو المدمج (Vimeo)';
                        if (iconEl) iconEl.innerHTML = `<span style="color: #0284c7;" data-lucide="play-circle"></span>`;
                        renderEmbeddedVideoPlayer(url, title, 'vimeo');

                    } else if (driveId) {
                        // Google Drive Link
                        if (badgeEl) badgeEl.textContent = 'مشغل وسائط Google Drive';
                        if (iconEl) iconEl.innerHTML = `<span style="color: #2563eb;" data-lucide="cloud"></span>`;
                        renderEmbeddedVideoPlayer(driveId, title, 'drive');

                    } else if (isDirectVideo || options.category === 'video') {
                        // Direct Video URL
                        if (badgeEl) badgeEl.textContent = 'مشغل الفيديو المدمج (رابط مباشر)';
                        if (iconEl) iconEl.innerHTML = `<span style="color: #3b82f6;" data-lucide="play-circle"></span>`;
                        renderCustomInAppVideoPlayer(url, title);

                    } else if (isDirectPdf || options.category === 'doc') {
                        // Direct PDF URL
                        if (badgeEl) badgeEl.textContent = 'عارض مستندات PDF المدمج';
                        if (iconEl) iconEl.innerHTML = `<span style="color: #ef4444;" data-lucide="file-text"></span>`;
                        if (downloadBtn) {
                            downloadBtn.style.display = 'inline-flex';
                            downloadBtn.href = url;
                            downloadBtn.download = `${title.replace(/\s+/g, '_')}.pdf`;
                        }
                        contentEl.innerHTML = `
                            <iframe src="${url}#toolbar=1" style="width: 100%; height: 100%; border: none; background: #334155;" allowfullscreen></iframe>
                        `;

                    } else {
                        // General Web Link inside iframe
                        if (badgeEl) badgeEl.textContent = 'معاينة الموقع / المورد';
                        if (iconEl) iconEl.innerHTML = `<span style="color: #10b981;" data-lucide="globe"></span>`;
                        contentEl.innerHTML = `
                            <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
                                <div style="padding: 6px 14px; background: #1e293b; color: #94a3b8; font-size: 0.76rem; display: flex; justify-content: space-between; align-items: center;">
                                    <span>معاينة داخل التطبيق</span>
                                    <a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: none; font-weight: 600;">
                                        إذا كان الموقع يمنع التضمين، انقر هنا لفتحه مباشرة &larr;
                                    </a>
                                </div>
                                <iframe src="${url}" style="flex: 1; width: 100%; height: 100%; border: none; background: #ffffff;"></iframe>
                            </div>
                        `;
                    }
                }

                if (window.lucide) lucide.createIcons();

            } catch (err) {
                console.error('File preview error:', err);
                contentEl.innerHTML = `
                    <div style="text-align: center; color: #ef4444; padding: 30px;">
                        <p style="font-weight: 700; margin: 0 0 10px 0;">حدث خطأ أثناء معاينة الملف.</p>
                        <p style="font-size: 0.85rem; color: #94a3b8; margin: 0 0 15px 0;">${err.message || String(err)}</p>
                        <button onclick="closeFilePreviewModal()" style="background: #334155; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">إغلاق</button>
                    </div>
                `;
            }
        }

        var _videoSpeedMenuDocClickHandler = null;
        function closeFilePreviewModal() {
            if (_videoSpeedMenuDocClickHandler) {
                document.removeEventListener('click', _videoSpeedMenuDocClickHandler);
                _videoSpeedMenuDocClickHandler = null;
            }
            detachPlayerKeyboardShortcuts();
            const modal = document.getElementById('filePreviewModal');
            if (modal) modal.style.display = 'none';

            // Pause any running video/audio
            const video = document.getElementById('inAppVideoEl') || currentPreviewVideoEl;
            if (video) {
                try { video.pause(); video.src = ''; } catch(e){}
            }
            const audios = document.querySelectorAll('#previewModalContent audio');
            audios.forEach(a => { try { a.pause(); a.src = ''; } catch(e){} });

            // Clear any iframes to stop playback immediately
            const iframes = document.querySelectorAll('#previewModalContent iframe');
            iframes.forEach(f => { try { f.src = 'about:blank'; } catch(e){} });

            const contentEl = document.getElementById('previewModalContent');
            if (contentEl) {
                contentEl.querySelectorAll('canvas').forEach(c => { c.width = 0; c.height = 0; });
                contentEl.innerHTML = '';
            }

            const pdfToolbar = document.getElementById('previewPdfToolbar');
            if (pdfToolbar) pdfToolbar.style.display = 'none';

            const dialog = document.getElementById('filePreviewDialog');
            if (dialog) dialog.classList.remove('is-fullscreen');

            if (currentPreviewBlobUrl) {
                URL.revokeObjectURL(currentPreviewBlobUrl);
                currentPreviewBlobUrl = null;
            }
            currentPreviewVideoEl = null;
            if (currentPdfState.pdfDoc && typeof currentPdfState.pdfDoc.destroy === 'function') {
                try { currentPdfState.pdfDoc.destroy(); } catch (e) {}
            }
            currentPdfState.pdfDoc = null;
            currentPdfState.doc = null;
            currentPdfState.blob = null;
            currentPdfState.blobUrl = null;
            currentPdfState.rawBlob = null;
        }

        async function previewLocalResource(id) {
            openInAppFileViewer({ type: 'local', id: id });
        }

        async function openLocalResource(id) {
            try {
                const record = await ResourceDB.getFile(id);
                if (!record || !record.data) {
                    window.notifySafeToast('عذراً، لم يتم العثور على الملف المحلي في ذاكرة هذا المتصفح. قد يكون تم تنظيف بيانات الموقع أو حفظه من جهاز آخر.');
                    return;
                }
                const blobUrl = URL.createObjectURL(record.data);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = record.name || 'resource';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
            } catch (err) {
                window.notifySafeToast('خطأ أثناء فتح الملف: ' + err.message);
            }
        }

        // دوال نسخ ومشاركة روابط ومواصفات الموارد التعليمية
        function copyResourceLink(url, title = '') {
            if (!url || url === '#' || url.startsWith('javascript:')) {
                if (typeof showAppToast === 'function') showAppToast('لا يتوفر رابط مباشر لهذا المورد للنسخ', 'warning');
                else window.notifySafeToast('لا يتوفر رابط مباشر لهذا المورد للنسخ');
                return;
            }
            const cleanUrl = url.replace(/&quot;/g, '"');
            const toastMsg = 'تم نسخ رابط المورد إلى الحافظة بنجاح 📋';
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(cleanUrl).then(() => {
                    if (typeof showAppToast === 'function') showAppToast(toastMsg, 'success');
                    else window.notifySafeToast(toastMsg);
                }).catch(() => {
                    promptCopyFallback(cleanUrl);
                });
            } else {
                promptCopyFallback(cleanUrl);
            }
        }

        function copyLocalResourceInfo(id, title = '') {
            const item = (db.library || []).find(x => x.id === id);
            const textToCopy = `المورد: ${title || (item ? item.title : 'ملف محلي')}\nالمستوى: ${item?.level || 'عام'}\nالمحور: ${item?.topic || '-'}`;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    if (typeof showAppToast === 'function') showAppToast('تم نسخ بيانات المورد المحلي إلى الحافظة 📋', 'success');
                }).catch(() => promptCopyFallback(textToCopy));
            } else {
                promptCopyFallback(textToCopy);
            }
        }

        function copyCurrentPreviewFileLink() {
            if (currentPreviewResourceUrl && currentPreviewResourceUrl !== '#' && !currentPreviewResourceUrl.startsWith('blob:')) {
                copyResourceLink(currentPreviewResourceUrl, currentPreviewResourceTitle);
            } else if (currentPdfState && currentPdfState.title) {
                const text = `المستند: ${currentPdfState.title}`;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(() => {
                        if (typeof showAppToast === 'function') showAppToast('تم نسخ عنوان المستند إلى الحافظة 📋', 'success');
                    });
                }
            } else {
                if (typeof showAppToast === 'function') showAppToast('هذا الملف مفتوح محلياً من جهازك ولا يتوفر له رابط خارجي', 'info');
            }
        }

        function promptCopyFallback(text) {
            if (typeof window.safeCopyTextToClipboard === 'function') {
                window.safeCopyTextToClipboard(text, 'تم نسخ الرابط إلى الحافظة 📋');
                return;
            }
            const el = document.createElement('textarea');
            el.value = text;
            document.body.appendChild(el);
            el.select();
            try {
                document.execCommand('copy');
                if (typeof showAppToast === 'function') showAppToast('تم نسخ الرابط إلى الحافظة 📋', 'success');
            } catch(e) {
                if (typeof window.notifySafeToast === 'function') window.notifySafeToast(text);
            }
            document.body.removeChild(el);
        }

        window.copyResourceLink = copyResourceLink;
        window.copyLocalResourceInfo = copyLocalResourceInfo;
        window.copyCurrentPreviewFileLink = copyCurrentPreviewFileLink;

        // Attach global player functions to window for onclick handlers
        window.openInAppFileViewer = openInAppFileViewer;
        window.closeFilePreviewModal = closeFilePreviewModal;
        window.togglePreviewModalFullscreen = togglePreviewModalFullscreen;
        window.onPdfPrevPage = onPdfPrevPage;
        window.onPdfNextPage = onPdfNextPage;
        window.onPdfZoomIn = onPdfZoomIn;
        window.onPdfZoomOut = onPdfZoomOut;
        window.onPdfFitWidth = onPdfFitWidth;
        window.onPdfPrint = onPdfPrint;
        window.togglePdfViewerEngine = togglePdfViewerEngine;
        window.previewLocalResource = previewLocalResource;
        window.previewDriveResource = previewDriveResource;
        window.openLocalResource = openLocalResource;

        async function deleteLibraryItem(id) {
            if (typeof window.showConfirmDialog === 'function') {
                const ok = await window.showConfirmDialog('هل أنت متأكد من حذف هذا المورد التعليمي؟');
                if (!ok) return;
            }
            if (!db.library) return;
            const item = db.library.find(x => x.id === id);
            if (item && item.isLocalFile) {
                await ResourceDB.deleteFile(id);
            }
            db.library = db.library.filter(x => x.id !== id);
            saveDB();
            renderLibrary();
        }

        function safeWebUrl(rawUrl) {
            if (!rawUrl) return '#';
            let url = String(rawUrl).trim();
            if (/^(javascript|data|vbscript):/i.test(url)) {
                return '#';
            }
            if (url.startsWith('/') && !url.startsWith('//')) {
                return url.replace(/"/g, '&quot;');
            }
            if (!/^https?:\/\//i.test(url)) {
                url = 'https://' + url;
            }
            return url.replace(/"/g, '&quot;');
        }

        var OFFICIAL_EDUCATIONAL_RESOURCES = [
            {
                id: 'official_massar',
                title: 'بوابة مسار للأساتذة (Massar Enseignant)',
                url: 'https://massarservice.men.gov.ma/enseignant/',
                type: 'link',
                category: 'رابط رسمي',
                topic: 'الإدارة والتقويم المدرسي',
                isLocalFile: false,
                dateAdded: 'رسمي مدمج'
            },
            {
                id: 'official_men',
                title: 'وزارة التربية الوطنية والتعليم الأولي والتكوين المهني والتأهيل',
                url: 'https://www.men.gov.ma',
                type: 'link',
                category: 'رابط رسمي',
                topic: 'المذكرات والمناهج الرسمية',
                isLocalFile: false,
                dateAdded: 'رسمي مدمج'
            },
            {
                id: 'official_circulaires_men',
                title: 'المذكرات والمقررات الوزارية المنظمة - وزارة التربية الوطنية',
                url: 'https://www.men.gov.ma/Ar/Pages/Publication.aspx',
                type: 'doc',
                category: 'مذكرات وزارية',
                topic: 'مذكرات وزارية وقرارات تنظيمية',
                isLocalFile: false,
                dateAdded: 'رسمي مدمج'
            },
            {
                id: 'official_exam_bac_sm',
                title: 'نماذج الامتحانات الوطنية الموحدة للبكالوريا - مادة الرياضيات (شعبة العلوم الرياضية A و B) مع التصحيح وسلم التنقيط',
                url: 'https://telmidtice.men.gov.ma',
                type: 'doc',
                category: 'نماذج امتحانات إشهادية',
                level: '2BAC-SM',
                topic: 'الامتحان الوطني الموحد للبكالوريا (علوم رياضية)',
                isLocalFile: false,
                dateAdded: 'رسمي مدمج'
            },
            {
                id: 'official_exam_bac_pc_svt',
                title: 'نماذج الامتحانات الوطنية الموحدة للبكالوريا - مادة الرياضيات (شعبة العلوم التجريبية PC و SVT) - الدورات العادية والاستدراكية',
                url: 'https://telmidtice.men.gov.ma',
                type: 'doc',
                category: 'نماذج امتحانات إشهادية',
                level: '2BAC-PC',
                topic: 'الامتحان الوطني الموحد للبكالوريا (علوم تجريبية)',
                isLocalFile: false,
                dateAdded: 'رسمي مدمج'
            },
            {
                id: 'official_exam_bac_general',
                title: 'نماذج الامتحانات الوطنية والجهوية الموحدة لنيل شهادة البكالوريا - مادة الرياضيات بالسلك الثانوي التأهيلي مع عناصر الإجابة الرسمية',
                url: 'https://telmidtice.men.gov.ma',
                type: 'doc',
                category: 'نماذج امتحانات إشهادية',
                level: 'الثانية باكالوريا',
                topic: 'الامتحان الوطني الموحد للبكالوريا',
                isLocalFile: false,
                dateAdded: 'رسمي مدمج'
            },
            {
                id: 'official_exam_regional_1bac',
                title: 'نماذج الامتحانات الجهوية الموحدة للسنة الأولى بكالوريا - مادة الرياضيات (شعبة العلوم الاقتصادية والتدبير)',
                url: 'https://telmidtice.men.gov.ma',
                type: 'doc',
                category: 'نماذج امتحانات إشهادية',
                level: '1BAC-ECO',
                topic: 'الامتحان الجهوي الموحد (الأولى بكالوريا)',
                isLocalFile: false,
                dateAdded: 'رسمي مدمج'
            },
            {
                id: 'official_exam_cadres_reference',
                title: 'الأطر المرجعية المحينة للامتحانات الإشهادية (الوطني والجهوي) لمادة الرياضيات - وزارة التربية الوطنية',
                url: 'https://www.men.gov.ma/Ar/Pages/Espace-Enseignant.aspx',
                type: 'doc',
                category: 'نماذج امتحانات إشهادية',
                level: 'عام',
                topic: 'الأطر المرجعية للامتحانات الإشهادية',
                isLocalFile: false,
                dateAdded: 'رسمي مدمج'
            },
            {
                id: 'official_exam_bac_biof',
                title: 'نماذج امتحانات البكالوريا الدولية (خيار فرنسية BIOF) - الرياضيات مع عناصر الإجابة والشرح',
                url: 'https://telmidtice.men.gov.ma',
                type: 'doc',
                category: 'نماذج امتحانات إشهادية',
                level: '2BAC-SM',
                topic: 'Examen National Mathématiques BIOF',
                isLocalFile: false,
                dateAdded: 'رسمي مدمج'
            },
            {
                id: 'official_telmidtice',
                title: 'منصة تلميذ تيس (TelmidTICE) للدروس الرقمية',
                url: 'https://telmidtice.men.gov.ma',
                type: 'video',
                category: 'عرض ووسائط',
                topic: 'الدروس والتمارين المصورة',
                isLocalFile: false,
                dateAdded: 'رسمي مدمج'
            },
            {
                id: 'official_espace_enseignant',
                title: 'فضاء الأستاذ - الأطر المرجعية والتوجيهات التربوية',
                url: 'https://www.men.gov.ma/Ar/Pages/Espace-Enseignant.aspx',
                type: 'doc',
                category: 'مذكرات وزارية',
                topic: 'الديداكتيك والتوجيهات البيداغوجية',
                isLocalFile: false,
                dateAdded: 'رسمي مدمج'
            },
            {
                id: 'official_taalim',
                title: 'بوابة تعليم (Taalim.ma) والخدمات السحابية',
                url: 'https://www.taalim.ma',
                type: 'link',
                category: 'رابط رسمي',
                topic: 'البريد المهني والخدمات السحابية',
                isLocalFile: false,
                dateAdded: 'رسمي مدمج'
            },
            {
                id: 'official_orientations_pedagogiques_math',
                title: 'التوجيهات التربوية والبرامج الخاصة بتدريس مادة الرياضيات بسلك التعليم الثانوي التأهيلي (نونبر 2007 - النسخة الرسمية الكاملة PDF)',
                url: '/assets/aistudio/_____________________________________________________3a655c1c.pdf',
                type: 'doc',
                category: 'مذكرات وزارية',
                level: 'السلك الثانوي التأهيلي',
                topic: 'التوجيهات التربوية والديداكتيكية الرسمية',
                isLocalFile: false,
                dateAdded: 'رسمي مدمج'
            },
            {
                id: 'official_circulaire_142_math',
                title: 'المذكرة الوزارية رقم 142-08 (16 نونبر 2007): التقويم التربوي بالسلك الثانوي التأهيلي لمادة الرياضيات (الجداول الرسمية 1 إلى 12 PDF)',
                url: '/assets/aistudio/n14208_evalped_08_a6af9323.pdf',
                type: 'doc',
                category: 'مذكرات وزارية',
                level: 'السلك الثانوي التأهيلي',
                topic: 'المراقبة المستمرة وبناء الفروض المحروسة والمنزلية',
                isLocalFile: false,
                dateAdded: 'رسمي مدمج'
            },
            {
                id: 'official_circulaire_192_eval',
                title: 'المذكرة الوزارية رقم 192: تأطير وتعميم المراقبة المستمرة بالتعليم الثانوي التأهيلي ومعايير الاستحقاق والاستدراك',
                url: 'https://www.men.gov.ma/Ar/Pages/Publication.aspx',
                type: 'doc',
                category: 'مذكرات وزارية',
                level: 'السلك الثانوي التأهيلي',
                topic: 'تأطير المراقبة المستمرة ورصد النقط',
                isLocalFile: false,
                dateAdded: 'رسمي مدمج'
            },
            {
                id: 'official_circulaire_30_cahier_textes',
                title: 'المذكرة الوزارية رقم 30: تدبير دفاتر النصوص بالتعليم الثانوي التأهيلي وتوثيق إنجاز المنهاج وأنشطة التعلم',
                url: 'https://www.men.gov.ma/Ar/Pages/Publication.aspx',
                type: 'doc',
                category: 'مذكرات وزارية',
                level: 'السلك الثانوي التأهيلي',
                topic: 'دفتر النصوص الرقمي ومراقبة التفتيش',
                isLocalFile: false,
                dateAdded: 'رسمي مدمج'
            },
            {
                id: 'official_decision_school_year_2026_2027',
                title: 'المقرر الوزاري لتنظيم السنة الدراسية 2026-2027: محطات التقويم، الفروض، الامتحانات الإشهادية والعطل المدرسية',
                url: 'https://www.men.gov.ma/Ar/Pages/Publication.aspx',
                type: 'doc',
                category: 'مذكرات وزارية',
                level: 'السلك الثانوي التأهيلي',
                topic: 'تنظيم السنة الدراسية والتقويم السنوي',
                isLocalFile: false,
                dateAdded: 'رسمي مدمج'
            },
            {
                id: 'official_guide_eval_diag_math',
                title: 'دليل تمرير روائز التقويم التشخيصي وشبكات تفييء المتعلمين وخطط المعالجة البيداغوجية لمادة الرياضيات (شتنبر)',
                url: 'https://www.men.gov.ma/Ar/Pages/Espace-Enseignant.aspx',
                type: 'doc',
                category: 'مذكرات وزارية',
                level: 'السلك الثانوي التأهيلي',
                topic: 'التقويم التشخيصي والدعم الاستدراكي',
                isLocalFile: false,
                dateAdded: 'رسمي مدمج'
            },
            {
                id: 'official_lessons_math_secondary',
                title: 'ملخصات ودروس الرياضيات الكاملة للسلك الثانوي التأهيلي (الجذع المشترك، الأولى والثانية بكالوريا) - منصة تلميذ تيس',
                url: 'https://telmidtice.men.gov.ma',
                type: 'doc',
                category: 'درس',
                level: 'عام',
                topic: 'التحليل والهندسة والاحتمالات والجبر',
                isLocalFile: false,
                dateAdded: 'رسمي مدمج'
            },
            {
                id: 'official_exercises_series_math',
                title: 'بنك سلاسل التمارين والمسائل المحلولة المتدرجة في الرياضيات (الدوال، المتتاليات، الأعداد العقدية، الهندسة الفضائية)',
                url: 'https://telmidtice.men.gov.ma',
                type: 'doc',
                category: 'سلسلة تمارين',
                level: 'الثانية باكالوريا',
                topic: 'سلاسل تمارين تطبيقية وتوليفية محلولة',
                isLocalFile: false,
                dateAdded: 'رسمي مدمج'
            },
            {
                id: 'official_homework_models_math',
                title: 'نماذج الفروض المنزلية التكوينية الموحدة في مادة الرياضيات للأسدس الأول والثاني مع التصحيح المفصل',
                url: 'https://telmidtice.men.gov.ma',
                type: 'doc',
                category: 'فرض منزلي',
                level: 'الأولى باكالوريا',
                topic: 'التقويم التكويني والإعداد القبلي للفروض المحروسة',
                isLocalFile: false,
                dateAdded: 'رسمي مدمج'
            },
            {
                id: 'official_supervised_exams_math',
                title: 'بنك الفروض المحروسة للمراقبة المستمرة في مادة الرياضيات وفق المذكرة 142 مع عناصر الإجابة وسلم التنقيط',
                url: 'https://telmidtice.men.gov.ma',
                type: 'doc',
                category: 'فرض محروس',
                level: 'عام',
                topic: 'فروض المراقبة المستمرة للأسدس الأول والثاني',
                isLocalFile: false,
                dateAdded: 'رسمي مدمج'
            },
            {
                id: 'official_fiches_pedagogiques_math',
                title: 'حقيبة الجذاذات والبطاقات التقنية البيداغوجية لدروس الرياضيات بالسلك الثانوي التأهيلي وفق التوجيهات التربوية',
                url: 'https://www.men.gov.ma/Ar/Pages/Espace-Enseignant.aspx',
                type: 'doc',
                category: 'بطاقة تقنية',
                level: 'السلك الثانوي التأهيلي',
                topic: 'التخطيط التربوي والجذاذات النمطية للدروس',
                isLocalFile: false,
                dateAdded: 'رسمي مدمج'
            }
        ];

        function loadOfficialCuratedResources() {
            if (!db.library) db.library = [];
            let count = 0;
            OFFICIAL_EDUCATIONAL_RESOURCES.forEach(res => {
                const exists = db.library.some(item => item.title === res.title || (item.officialId && item.officialId === res.id));
                if (!exists) {
                    db.library.push({
                        ...res,
                        officialId: res.id,
                        id: (Date.now() + Math.random()).toString(),
                        level: res.level || 'عام',
                        category: res.category || (typeof inferResourceCategory === 'function' ? inferResourceCategory(res) : 'درس'),
                        dateAdded: window.formatLocalDate ? window.formatLocalDate() : new Date().toLocaleDateString('en-CA')
                    });
                    count++;
                }
            });
            saveDB();
            renderLibrary();
            if (count > 0) {
                if (typeof showLibraryToast === 'function') {
                    showLibraryToast(`تمت إضافة ${count} من الموارد ونماذج الامتحانات الرسمية المعتمدة إلى المكتبة بنجاح 📚`);
                } else if (typeof showToast === 'function') {
                    showToast(`تمت إضافة ${count} من الموارد الرسمية المعتمدة إلى المكتبة بنجاح 📚`, 'success');
                }
            } else {
                if (typeof showLibraryToast === 'function') {
                    showLibraryToast('جميع الموارد والروابط التربوية الرسمية المعتمدة مضافة بالفعل في مكتبتك ✅');
                }
            }
        }

        var currentLibCategoryFilter = 'all';

        function inferResourceCategory(item) {
            if (!item) return 'درس';
            if (item.isLessonTemplate || item.category === 'قالب درس') return 'قالب درس';
            if (item.category && typeof item.category === 'string' && item.category.trim()) {
                const c = item.category.trim();
                if (c === 'جذاذة') return 'بطاقة تقنية';
                if (c === 'مذكرة ووثيقة' || c === 'مذكرة' || c === 'مذكرات') return 'مذكرات وزارية';
                if (c === 'روابط رسمية') return 'رابط رسمي';
                if (c === 'عروض ووسائط') return 'عرض ووسائط';
                if (/إشهادي|اشهادي|امتحان إشهادي|امتحانات إشهادية|نماذج إشهادية|نماذج امتحانات إشهادية|امتحان وطني|امتحان جهوي|امتحانات وطنية|امتحانات جهوية/i.test(c)) return 'نماذج امتحانات إشهادية';
                return c;
            }
            const text = ((item.title || '') + ' ' + (item.topic || '') + ' ' + (item.fileName || '')).toLowerCase();
            const url = (item.url || '').toLowerCase();
            if (/قالب درس|قوالب دروس|قالب بيداغوجي/i.test(text)) return 'قالب درس';
            if (/مذكرة وزارية|مذكرات وزارية|مقرر وزاري|قرار وزاري|ظهير|مرسوم|دورية وزارية/i.test(text)) return 'مذكرات وزارية';
            // تصنيف نماذج الامتحانات الإشهادية (الوطني، الجهوي، البكالوريا الموحدة)
            if (/إشهادي|اشهادي|امتحان وطني|الامتحان الوطني|امتحان جهوي|الامتحان الجهوي|امتحانات إشهادية|امتحانات اشهادية|نماذج إشهادية|نماذج اشهادية|باكالوريا دورة|بكالوريا دورة|دورة عادية|دورة استدراكية|examen national|examen régional|certificatif|epreuve nationale|baccalauréat|bac|شهادة البكالوريا/i.test(text)) return 'نماذج امتحانات إشهادية';
            if (/سلسلة|تمارين|تمرين|مسائل|أنشطة|exercic/i.test(text)) return 'سلسلة تمارين';
            if (/منزلي|واجب|devoir/i.test(text)) return 'فرض منزلي';
            if (/محروس|امتحان|اختبار|مراقبة مستمرة|contrôle|examen/i.test(text)) return 'فرض محروس';
            if (/بطاقة تقنية|بطاقة|جذاذة|جذاذات|fiche technique|fiche/i.test(text)) return 'بطاقة تقنية';
            if (/مذكرة|أطر مرجعية|توجيهات|منهاج|وثيقة رسمية|circulaire/i.test(text)) return 'مذكرات وزارية';
            if (/بوابة|منصة|مسار|تلميذ تيس|وزارة|taalim|telmid/i.test(text) || /men\.gov\.ma|massarservice|taalim\.ma/i.test(url)) return 'رابط رسمي';
            if (/عرض|تقديم|وسائط|powerpoint|presentation|فيديو/i.test(text) || item.type === 'video') return 'عرض ووسائط';
            return 'درس';
        }
        window.inferResourceCategory = inferResourceCategory;

        function onLibCategoryFilterChange(val) {
            currentLibCategoryFilter = val || 'all';
            const selectEl = document.getElementById('libFilterCategory');
            if (selectEl && selectEl.value !== currentLibCategoryFilter) {
                selectEl.value = currentLibCategoryFilter;
            }
            renderLibrary();
        }
        window.onLibCategoryFilterChange = onLibCategoryFilterChange;

        function setLibraryItemCategory(itemId, newCat) {
            if (!db.library) return;
            const item = db.library.find(i => i.id === itemId);
            if (item) {
                item.category = newCat;
                saveDB();
                renderLibrary();
                if (typeof showLibraryToast === 'function') {
                    showLibraryToast(`تم تعديل تصنيف المورد إلى "${newCat}" بنجاح.`);
                }
            }
        }
        window.setLibraryItemCategory = setLibraryItemCategory;

        function promptChangeItemCategory(itemId, currentCat) {
            const categories = ['درس', 'قالب درس', 'سلسلة تمارين', 'فرض منزلي', 'فرض محروس', 'نماذج امتحانات إشهادية', 'بطاقة تقنية', 'مذكرات وزارية', 'رابط رسمي', 'عرض ووسائط'];
            const nextIdx = (categories.indexOf(currentCat) + 1) % categories.length;
            const nextCat = categories[nextIdx];
            setLibraryItemCategory(itemId, nextCat);
        }
        window.promptChangeItemCategory = promptChangeItemCategory;

        function formatFileSize(bytes) {
            if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        }
        window.formatFileSize = formatFileSize;

        function getResourceFileMeta(item) {
            let ext = '';
            let typeLabel = '';
            let iconName = 'file-text';
            let isVideo = false;
            let isPdf = false;
            let sourceLabel = '';

            const fn = (item.fileName || '').trim();
            const url = (item.url || '').trim();
            const t = (item.type || '').trim().toLowerCase();

            const extMatch = fn.match(/\.([a-z0-9]+)$/i) || url.match(/\.([a-z0-9]+)(?:[?#]|$)/i);
            if (extMatch) {
                ext = extMatch[1].toUpperCase();
            }

            if (t === 'video' || ext === 'MP4' || ext === 'WEBM' || ext === 'MKV' || /youtube\.com|youtu\.be/i.test(url)) {
                isVideo = true;
                typeLabel = 'مقطع فيديو تعليمي' + (ext ? ` (${ext})` : (/youtube/i.test(url) ? ' (YouTube)' : ''));
                iconName = 'video';
                if (!ext) ext = 'MP4';
            } else if (ext === 'PDF' || (t === 'doc' && (!ext || ext === 'PDF'))) {
                isPdf = true;
                typeLabel = 'مستند ووثيقة PDF';
                ext = ext || 'PDF';
                iconName = 'file-text';
            } else if (ext === 'DOC' || ext === 'DOCX') {
                typeLabel = 'مستند وورد (Word Document)';
                iconName = 'file-text';
            } else if (ext === 'XLS' || ext === 'XLSX' || ext === 'CSV') {
                typeLabel = 'جدول بيانات إكسيل (Excel Sheet)';
                iconName = 'sheet';
            } else if (ext === 'PPT' || ext === 'PPTX') {
                typeLabel = 'عرض تقديمي باوربوينت (PowerPoint)';
                iconName = 'presentation';
            } else if (ext === 'ZIP' || ext === 'RAR') {
                typeLabel = 'ملف أرشيف مضغوط (Archive)';
                iconName = 'archive';
            } else if (item.isDriveFile) {
                typeLabel = 'ملف سحابي من Google Drive' + (ext ? ` (${ext})` : '');
                iconName = 'cloud';
                if (!ext) ext = 'DRIVE';
            } else if (item.isLocalFile) {
                typeLabel = 'ملف محلي مخزن بالجهاز' + (ext ? ` (${ext})` : '');
                iconName = 'hard-drive';
                if (!ext) ext = 'FILE';
            } else {
                typeLabel = 'رابط وموقع إلكتروني خارجي';
                iconName = 'globe';
                if (!ext) ext = 'LINK';
            }

            let sizeLabel = '';
            if (item.fileSize) {
                sizeLabel = typeof item.fileSize === 'number' ? formatFileSize(item.fileSize) : String(item.fileSize);
            } else if (item.size) {
                sizeLabel = typeof item.size === 'number' ? formatFileSize(item.size) : String(item.size);
            } else if (item.isDriveFile) {
                sizeLabel = 'سحابي (Google Drive)';
            } else if (item.isLocalFile) {
                sizeLabel = 'ملف محلي';
            } else {
                sizeLabel = 'رابط عبر الويب';
            }

            if (item.isDriveFile) {
                sourceLabel = item.driveFolderName ? `مجلد Drive: ${item.driveFolderName}` : 'Google Drive سحابي';
            } else if (item.isLocalFile) {
                sourceLabel = 'ذاكرة الجهاز المحلية';
            } else {
                sourceLabel = 'شبكة الويب والإنترنت';
            }

            return { ext, typeLabel, sizeLabel, sourceLabel, iconName, isVideo, isPdf };
        }
        window.getResourceFileMeta = getResourceFileMeta;

        function renderLibrary() {
            const container = document.getElementById('libraryContainer');
            if (!container) return;

            initLibDropZone();
            syncLibraryDriveUIState();
            renderLinkedDriveFolders();
            checkAndAutoSyncDriveFolders(false);

            if (window.db) {
                let cleaned = false;
                if ('libraryVirtualFolders' in window.db) { delete window.db.libraryVirtualFolders; cleaned = true; }
                if ('librarySmartFolders' in window.db) { delete window.db.librarySmartFolders; cleaned = true; }
                if (cleaned && typeof saveDB === 'function') {
                    try { saveDB(); } catch (e) {}
                }
            }

            const sidebar = document.getElementById('libSidebarAnalytics');
            if (sidebar && !sidebar.dataset.initDone) {
                sidebar.dataset.initDone = 'true';
                const savedState = localStorage.getItem('lib_sidebar_open');
                const shouldOpen = savedState !== null ? (savedState === 'true') : (window.innerWidth > 992);
                toggleLibrarySidebar(shouldOpen);
            }

            if (!db.library) db.library = [];

            // 1. Calculate real-time category counts
            const catCounts = {
                'all': (db.library || []).length,
                'درس': 0,
                'قالب درس': 0,
                'سلسلة تمارين': 0,
                'فرض منزلي': 0,
                'فرض محروس': 0,
                'نماذج امتحانات إشهادية': 0,
                'بطاقة تقنية': 0,
                'مذكرات وزارية': 0,
                'رابط رسمي': 0,
                'عرض ووسائط': 0
            };
            (db.library || []).forEach(item => {
                const cat = item.isLessonTemplate || item.category === 'قالب درس' ? 'قالب درس' : inferResourceCategory(item);
                if (catCounts[cat] !== undefined) {
                    catCounts[cat]++;
                } else {
                    catCounts['درس']++;
                }
            });

            // 2. Render classification pills ribbon
            const pillsContainer = document.getElementById('libCategoryPillsContainer');
            if (pillsContainer) {
                const pillsData = [
                    { id: 'all', label: 'جميع التصنيفات', icon: '📚', count: catCounts['all'], color: '#2563eb' },
                    { id: 'قالب درس', label: 'قوالب الدروس', icon: '📐', count: catCounts['قالب درس'], color: '#0d9488' },
                    { id: 'درس', label: 'درس', icon: '📖', count: catCounts['درس'], color: '#1d4ed8' },
                    { id: 'سلسلة تمارين', label: 'سلسلة تمارين', icon: '📝', count: catCounts['سلسلة تمارين'], color: '#047857' },
                    { id: 'فرض منزلي', label: 'فرض منزلي', icon: '🏠', count: catCounts['فرض منزلي'], color: '#b45309' },
                    { id: 'فرض محروس', label: 'فرض محروس', icon: '⏱️', count: catCounts['فرض محروس'], color: '#be123c' },
                    { id: 'نماذج امتحانات إشهادية', label: 'نماذج إشهادية', icon: '🎓', count: catCounts['نماذج امتحانات إشهادية'], color: '#9d174d' },
                    { id: 'بطاقة تقنية', label: 'بطاقة / جذاذة', icon: '📋', count: catCounts['بطاقة تقنية'], color: '#6d28d9' },
                    { id: 'مذكرات وزارية', label: 'مذكرات وزارية', icon: '📜', count: catCounts['مذكرات وزارية'], color: '#0284c7' },
                    { id: 'رابط رسمي', label: 'روابط رسمية', icon: '🌐', count: catCounts['رابط رسمي'], color: '#0f766e' },
                    { id: 'عرض ووسائط', label: 'عروض ووسائط', icon: '🎬', count: catCounts['عرض ووسائط'], color: '#a21caf' }
                ];

                pillsContainer.innerHTML = pillsData.map(p => {
                    const isActive = currentLibCategoryFilter === p.id;
                    const activeStyle = isActive
                        ? `background: ${p.color}; color: #ffffff; border-color: ${p.color}; box-shadow: 0 3px 8px ${p.color}40; transform: translateY(-1px);`
                        : `background: #ffffff; color: #334155; border-color: #cbd5e1;`;
                    return `
                        <button type="button" onclick="onLibCategoryFilterChange('${p.id}')" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 9999px; font-size: 0.82rem; font-weight: 700; border: 1.5px solid #cbd5e1; cursor: pointer; transition: all 0.2s; white-space: nowrap; ${activeStyle}">
                            <span>${p.icon}</span>
                            <span>${p.label}</span>
                            <span style="font-size: 0.72rem; padding: 1px 6px; border-radius: 9999px; background: ${isActive ? 'rgba(255,255,255,0.25)' : '#f1f5f9'}; color: ${isActive ? '#ffffff' : '#64748b'};">
                                ${p.count}
                            </span>
                        </button>
                    `;
                }).join('');
            }

            // 3. Sync category dropdown value
            const filterCatSelect = document.getElementById('libFilterCategory');
            if (filterCatSelect) {
                if (filterCatSelect.value !== currentLibCategoryFilter) {
                    filterCatSelect.value = currentLibCategoryFilter;
                }
            }

            // Update registered classes group in drive level selector if present
            const regClassesGroup = document.getElementById('libDriveRegisteredClassesGroup');
            if (regClassesGroup && db.classes) {
                const classNames = Object.keys(db.classes);
                if (classNames.length > 0) {
                    regClassesGroup.innerHTML = classNames.map(c => `<option value="${c}">قسم: ${c}</option>`).join('');
                }
            }

            // Update topic filter dropdown dynamically based on available topics
            const filterTopicSelect = document.getElementById('libFilterTopic');
            if (filterTopicSelect) {
                const currentTopicValue = filterTopicSelect.value;
                const topics = new Set(db.library.map(item => item.topic).filter(t => t && t.trim() !== ''));

                let topicOptions = '<option value="all">كل الدروس والمحاور</option>';
                Array.from(topics).sort().forEach(topic => {
                    topicOptions += `<option value="${topic}">${topic}</option>`;
                });

                filterTopicSelect.innerHTML = topicOptions;
                if (topics.has(currentTopicValue)) {
                    filterTopicSelect.value = currentTopicValue;
                }
            }

            const searchInput = document.getElementById('libSearch');
            const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
            const filterType = document.getElementById('libFilterType') ? document.getElementById('libFilterType').value : 'all';
            const filterLevel = document.getElementById('libFilterLevel') ? document.getElementById('libFilterLevel').value : 'all';
            const filterTopic = document.getElementById('libFilterTopic') ? document.getElementById('libFilterTopic').value : 'all';

            let filtered = db.library;

            // Apply category filter
            if (currentLibCategoryFilter !== 'all') {
                filtered = filtered.filter(item => {
                    const cat = (item.isLessonTemplate || item.category === 'قالب درس') ? 'قالب درس' : inferResourceCategory(item);
                    return cat === currentLibCategoryFilter;
                });
            }

            if (filterType === 'local') {
                filtered = filtered.filter(item => item.isLocalFile);
            } else if (filterType === 'drive') {
                filtered = filtered.filter(item => item.isDriveFile);
            } else if (filterType !== 'all') {
                filtered = filtered.filter(item => item.type === filterType);
            }

            if (filterLevel !== 'all') {
                filtered = filtered.filter(item => item.level === filterLevel);
            }

            if (filterTopic !== 'all') {
                filtered = filtered.filter(item => item.topic === filterTopic);
            }

            if (searchTerm) {
                filtered = filtered.filter(item =>
                    (item.title && item.title.toLowerCase().includes(searchTerm)) ||
                    (item.topic && item.topic.toLowerCase().includes(searchTerm)) ||
                    (item.fileName && item.fileName.toLowerCase().includes(searchTerm)) ||
                    (item.driveFolderName && item.driveFolderName.toLowerCase().includes(searchTerm)) ||
                    (item.templateObjectives && item.templateObjectives.toLowerCase().includes(searchTerm))
                );
            }

            // Render Active Filter Banner above #libraryContainer when filtered
            const activeBannerEl = document.getElementById('libActiveFilterBanner');
            if (activeBannerEl) {
                const hasActiveFilter = (currentLibCategoryFilter !== 'all') || (filterLevel !== 'all') || (filterType !== 'all') || (filterTopic !== 'all') || !!searchTerm;
                if (hasActiveFilter) {
                    const catNames = {
                        'قالب درس': { label: '📐 قوالب الدروس البيداغوجية', color: '#0f766e', bg: '#f0fdfa', border: '#5eead4' },
                        'درس': { label: '📖 الدروس والشروحات', color: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd' },
                        'سلسلة تمارين': { label: '📝 سلاسل التمارين والأنشطة', color: '#047857', bg: '#ecfdf5', border: '#6ee7b7' },
                        'فرض منزلي': { label: '🏠 الفروض المنزلية', color: '#b45309', bg: '#fffbeb', border: '#fcd34d' },
                        'فرض محروس': { label: '⏱️ الفروض المحروسة', color: '#be123c', bg: '#fff1f2', border: '#fda4af' },
                        'نماذج امتحانات إشهادية': { label: '🎓 نماذج الامتحانات الإشهادية (الوطني والجهوي)', color: '#9d174d', bg: '#fdf2f8', border: '#fbcfe8' },
                        'بطاقة تقنية': { label: '📋 البطاقات التقنية والجذاذات', color: '#6d28d9', bg: '#faf5ff', border: '#c4b5fd' },
                        'مذكرات وزارية': { label: '📜 المذكرات والوثائق الوزارية', color: '#0284c7', bg: '#f0f9ff', border: '#7dd3fc' },
                        'رابط رسمي': { label: '🌐 الروابط والمواقع الرسمية', color: '#0f766e', bg: '#f0fdfa', border: '#99f6e4' },
                        'عرض ووسائط': { label: '🎬 العروض التقديمية والوسائط', color: '#a21caf', bg: '#fdf4ff', border: '#f0abfc' }
                    };
                    const activeMeta = catNames[currentLibCategoryFilter]
                        || (filterTopic !== 'all' ? { label: '📖 المحور: ' + filterTopic, color: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd' } : null)
                        || { label: currentLibCategoryFilter === 'all' ? 'تصفية مخصصة للموارد' : currentLibCategoryFilter, color: '#1e3a8a', bg: '#eff6ff', border: '#93c5fd' };
                    activeBannerEl.style.display = 'block';
                    activeBannerEl.innerHTML = `
                        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; padding: 10px 14px; border-radius: 10px; background: ${activeMeta.bg}; border: 1.5px solid ${activeMeta.border}; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <span style="font-size: 0.78rem; font-weight: 800; color: ${activeMeta.color}; display: flex; align-items: center; gap: 5px;">
                                    <span>📂 الموارد المعروضة حالياً:</span>
                                    <span style="background: #ffffff; padding: 2px 10px; border-radius: 9999px; border: 1px solid ${activeMeta.border};">${activeMeta.label}</span>
                                </span>
                                ${filterLevel !== 'all' ? `<span style="font-size: 0.74rem; font-weight: 800; background: #ffffff; color: #047857; padding: 2px 8px; border-radius: 9999px; border: 1px solid #a7f3d0;">المستوى: ${filterLevel}</span>` : ''}
                                <span style="font-size: 0.75rem; font-weight: 800; background: ${activeMeta.color}; color: #ffffff; padding: 2px 9px; border-radius: 9999px;">
                                    ${filtered.length} مورد مطابق
                                </span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                ${currentLibCategoryFilter !== 'all' ? `
                                    <button type="button" onclick="openAddResourceForCategory('${currentLibCategoryFilter}')" style="background: #ffffff; color: ${activeMeta.color}; border: 1px solid ${activeMeta.border}; padding: 4px 10px; border-radius: 7px; font-size: 0.74rem; font-weight: 800; cursor: pointer;">
                                        ➕ إضافة مورد في هذه الفئة
                                    </button>
                                ` : ''}
                                <button type="button" onclick="resetAllLibraryFilters()" style="background: #ef4444; color: #ffffff; border: none; padding: 4px 11px; border-radius: 7px; font-size: 0.74rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                                    <span>✕</span>
                                    <span>عرض جميع الموارد (${(db.library || []).length})</span>
                                </button>
                            </div>
                        </div>
                    `;
                } else {
                    activeBannerEl.style.display = 'none';
                    activeBannerEl.innerHTML = '';
                }
            }

            if (filtered.length === 0) {
                if (!db.library || db.library.length === 0) {
                    container.innerHTML = `
                        <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 35px 20px; background: var(--bg); border-radius: 12px; border: 1px dashed var(--border);">
                            <div style="margin-bottom: 10px; color: var(--text-muted);">${lucideIcon('bookopen', {size: 42})}</div>
                            <h4 style="color: var(--primary); margin: 0 0 8px 0; font-family: 'Cairo', sans-serif;">المكتبة الرقمية فارغة حالياً</h4>
                            <p style="font-size: 0.9rem; margin: 0 0 16px 0; max-width: 520px; margin-inline: auto;">يمكنك رفع ملفات PDF أو روابط فيديوهات توضيحية وربطها بالدروس، أو إدراج قوالب الدروس والروابط التربوية المعتمدة:</p>
                            <div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
                                <button type="button" onclick="seedStarterLessonTemplates()" style="padding: 10px 18px; border-radius: 8px; font-weight: 800; background: #0d9488; color: white; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 2px 6px rgba(13,148,136,0.25);">
                                    <span>📐</span> توليد قوالب الدروس النموذجية
                                </button>
                                <button type="button" onclick="loadOfficialCuratedResources()" style="padding: 10px 18px; border-radius: 8px; font-weight: 700; background: #059669; color: white; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 2px 6px rgba(5,150,105,0.25);">
                                    <span>${lucideIcon('landmark', {size: 13})}</span> إدراج الروابط والمواقع التربوية الرسمية
                                </button>
                            </div>
                        </div>
                    `;
                } else {
                    container.innerHTML = `
                        <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 28px 20px; background: var(--bg); border-radius: 10px; border: 1.5px dashed var(--border);">
                            <div style="font-weight: 800; color: #334155; font-size: 0.92rem; margin-bottom: 6px;">لا توجد موارد مسجلة حالياً ضمن التصفية المحددة.</div>
                            <div style="display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; margin-top: 12px;">
                                <button type="button" onclick="openCreateLessonTemplateModal()" style="padding: 7px 14px; border-radius: 7px; font-weight: 800; font-size: 0.8rem; background: #0d9488; color: #ffffff; border: none; cursor: pointer;">
                                    📐 + إنشاء قالب درس جديد
                                </button>
                                <button type="button" onclick="resetAllLibraryFilters()" style="padding: 7px 14px; border-radius: 7px; font-weight: 800; font-size: 0.8rem; background: #ffffff; color: #334155; border: 1px solid #cbd5e1; cursor: pointer;">
                                    🔄 عرض كافة موارد المكتبة
                                </button>
                            </div>
                        </div>
                    `;
                }
                renderLibraryGrowthAnalytics();
                if (typeof renderBrowseLessonSidePanel === 'function') renderBrowseLessonSidePanel();
                if (currentLibSubTab === 'lesson_resources' && typeof renderLessonLinkedResourcesView === 'function') {
                    renderLessonLinkedResourcesView();
                }
                return;
            }

            container.innerHTML = buildLibraryResourceCardsHtml(filtered);
            if (window.lucide) window.lucide.createIcons();

            // Automatically update library growth analytics & sidebars
            renderLibraryGrowthAnalytics();
            if (typeof renderBrowseLessonSidePanel === 'function') {
                renderBrowseLessonSidePanel();
            }
            if (currentLibSubTab === 'lesson_resources' && typeof renderLessonLinkedResourcesView === 'function') {
                renderLessonLinkedResourcesView();
            }
        }
        window.renderLibrary = renderLibrary;

        function buildLibraryResourceCardsHtml(itemsList) {
            const typeIcons = {
                'video': lucideIcon('video', {size: 18}),
                'doc': lucideIcon('filetext', {size: 18}),
                'link': lucideIcon('link', {size: 18}),
                'other': lucideIcon('archive', {size: 18})
            };

            let html = '';
            (itemsList || []).forEach(item => {
                const isDrive = !!item.isDriveFile;
                const isLocal = !!item.isLocalFile;
                const isTemplate = !!item.isLessonTemplate || item.category === 'قالب درس';
                const meta = getResourceFileMeta(item);
                const icon = isTemplate ? lucideIcon('layout-template', {size: 18}) : (isDrive ? lucideIcon('cloud', {size: 18}) : (typeIcons[item.type] || (isLocal ? lucideIcon('folder', {size: 18}) : lucideIcon('link', {size: 18}))));
                const safeUrl = safeWebUrl(item.url);
                const isNewlyAdded = item.isNew || (item.addedTimestamp && (Date.now() - item.addedTimestamp < 2 * 60 * 60 * 1000));
                const itemCat = isTemplate ? 'قالب درس' : inferResourceCategory(item);
                const linkedLessonsPreview = (typeof findCurriculumLessonsForLibraryItem === 'function') ? findCurriculumLessonsForLibraryItem(item).slice(0, 1) : [];
                const primaryLinkedLesson = linkedLessonsPreview[0] || null;
                const catBadgeMap = {
                    'قالب درس': { label: '📐 قالب درس بيداغوجي', bg: '#f0fdfa', color: '#115e59', border: '#5eead4', accent: '#0d9488' },
                    'درس': { label: '📖 درس', bg: '#eff6ff', color: '#1e3a8a', border: '#93c5fd', accent: '#1d4ed8' },
                    'سلسلة تمارين': { label: '📝 تمارين وأنشطة', bg: '#ecfdf5', color: '#064e3b', border: '#6ee7b7', accent: '#047857' },
                    'فرض منزلي': { label: '🏠 فرض منزلي', bg: '#fffbeb', color: '#78350f', border: '#fcd34d', accent: '#b45309' },
                    'فرض محروس': { label: '⏱️ فرض محروس', bg: '#fff1f2', color: '#881337', border: '#fda4af', accent: '#be123c' },
                    'نماذج امتحانات إشهادية': { label: '🎓 نماذج إشهادية (وطني/جهوي)', bg: '#fdf2f8', color: '#831843', border: '#fbcfe8', accent: '#9d174d' },
                    'امتحانات إشهادية': { label: '🎓 نماذج إشهادية (وطني/جهوي)', bg: '#fdf2f8', color: '#831843', border: '#fbcfe8', accent: '#9d174d' },
                    'امتحان إشهادي': { label: '🎓 نماذج إشهادية (وطني/جهوي)', bg: '#fdf2f8', color: '#831843', border: '#fbcfe8', accent: '#9d174d' },
                    'بطاقة تقنية': { label: '📋 بطاقة تقنية / جذاذة', bg: '#faf5ff', color: '#4c1d95', border: '#c4b5fd', accent: '#6d28d9' },
                    'مذكرات وزارية': { label: '📜 مذكرات وزارية', bg: '#f0f9ff', color: '#0369a1', border: '#7dd3fc', accent: '#0284c7' },
                    'جذاذة': { label: '📋 جذاذة بيداغوجية', bg: '#faf5ff', color: '#4c1d95', border: '#c4b5fd', accent: '#6d28d9' },
                    'مذكرة ووثيقة': { label: '📜 مذكرات وزارية', bg: '#f0f9ff', color: '#0369a1', border: '#7dd3fc', accent: '#0284c7' },
                    'رابط رسمي': { label: '🌐 رابط وموقع رسمي', bg: '#f0fdfa', color: '#134e4a', border: '#99f6e4', accent: '#0f766e' },
                    'عرض ووسائط': { label: '🎬 عرض ووسائط', bg: '#fdf4ff', color: '#701a75', border: '#f0abfc', accent: '#a21caf' }
                };
                const catBadge = catBadgeMap[itemCat] || { label: '📖 ' + itemCat, bg: '#eff6ff', color: '#1e3a8a', border: '#93c5fd', accent: '#1d4ed8' };

                html += `
                    <div class="lib-resource-card" data-cat="${itemCat}" style="--cat-accent: ${catBadge.accent};">
                        <!-- Top Header: Icon, Title, and Action Controls -->
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                                <span class="lib-cat-icon-box" style="font-size: 1.25rem; color: ${catBadge.accent}; display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 9px; background: ${catBadge.bg}; border: 1.5px solid ${catBadge.border}; flex-shrink: 0; transition: all 0.2s ease;" title="${meta.typeLabel}">
                                    ${icon}
                                </span>
                                <div style="min-width: 0; flex: 1;">
                                    <h4 class="lib-card-title" style="margin: 0; color: #0f172a; font-size: 0.96rem; font-weight: 800; word-break: break-word; line-height: 1.35; transition: color 0.2s ease;" title="${item.title}">${item.title}</h4>
                                    ${item.topic ? `<div style="font-size: 0.73rem; color: #64748b; margin-top: 2px;">المحور: <strong style="color: #334155;">${item.topic}</strong></div>` : ''}
                                </div>
                            </div>

                            <div style="display: flex; align-items: center; gap: 5px; flex-shrink: 0;">
                                <!-- Quick Preview Tooltip Trigger Badge -->
                                <div class="lib-preview-tooltip-wrapper">
                                    <span class="lib-file-meta-pill" tabindex="0" title="معاينة نوع وحجم ومواصفات الملف (انقر أو مرر الفأرة)">
                                        <span style="font-size: 0.68rem; font-weight: 900; background: ${catBadge.accent}; color: #ffffff; padding: 2px 6px; border-radius: 5px; letter-spacing: 0.3px;">${isTemplate ? 'TEMPLATE' : meta.ext}</span>
                                        <span>${item.templateDuration ? item.templateDuration + ' س' : meta.sizeLabel}</span>
                                        <span style="font-size: 0.72rem; color: ${catBadge.accent}; font-weight: bold;">ℹ️</span>
                                    </span>

                                    <!-- Floating Tooltip Box on Hover / Focus -->
                                    <div class="lib-card-tooltip" role="tooltip">
                                        <div class="lib-tooltip-title">
                                            <span style="display: flex; align-items: center; gap: 5px;">🔍 معاينة مواصفات المورد</span>
                                            <span style="font-size: 0.7rem; font-weight: 900; background: rgba(56, 189, 248, 0.25); color: #38bdf8; padding: 2px 8px; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.4);">${isTemplate ? 'TEMPLATE' : meta.ext}</span>
                                        </div>
                                        <div class="lib-tooltip-grid">
                                            <div class="lib-tooltip-row">
                                                <span class="label">نوع المورد:</span>
                                                <span class="val" style="direction: rtl; text-align: right; color: #38bdf8; font-weight: 700;">${isTemplate ? 'قالب درس مهيكل' : meta.typeLabel}</span>
                                            </div>
                                            <div class="lib-tooltip-row">
                                                <span class="label">حجم / مدة:</span>
                                                <span class="val" style="color: #4ade80; font-weight: 800;">${item.templateDuration ? item.templateDuration + ' ساعات' : meta.sizeLabel}</span>
                                            </div>
                                            <div class="lib-tooltip-row">
                                                <span class="label">التصنيف البيداغوجي:</span>
                                                <span class="val" style="direction: rtl; text-align: right; color: #ffffff; font-weight: 700;">${catBadge.label}</span>
                                            </div>
                                            ${item.level && item.level !== 'عام' ? `
                                                <div class="lib-tooltip-row">
                                                    <span class="label">المستوى الدراسي:</span>
                                                    <span class="val" style="direction: rtl; text-align: right; color: #f472b6; font-weight: 700;">${item.level}</span>
                                                </div>
                                            ` : ''}
                                        </div>
                                    </div>
                                </div>

                                <button class="hide-in-presentation" onclick="openLinkResourceToLessonModal('', '', '${item.id}')" style="background: none; border: none; color: #0d9488; cursor: pointer; font-size: 0.85rem; padding: 2px 4px; line-height: 1; display: inline-flex; align-items: center;" title="ربط المورد بدرس ومحور دراسي">${lucideIcon('link-2', {size: 13})}</button>
                                <button class="hide-in-presentation" onclick="aiClassifySingleResource('${item.id}')" style="background: none; border: none; color: #7c3aed; cursor: pointer; font-size: 0.85rem; padding: 2px 4px; line-height: 1; display: inline-flex; align-items: center;" title="تصنيف ذكي بالذكاء الاصطناعي">${lucideIcon('sparkles', {size: 13})}</button>
                                <button class="hide-in-presentation" onclick="deleteLibraryItem('${item.id}')" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.85rem; padding: 2px; line-height: 1;" title="حذف المورد">${lucideIcon('trash2', {size: 12})}</button>
                            </div>
                        </div>

                        <!-- Classification Badges & Linked Lesson Strip -->
                        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                            <span class="lib-card-badge" onclick="promptChangeItemCategory('${item.id}', '${itemCat}')" style="background: ${catBadge.bg}; color: ${catBadge.color}; border: 1.5px solid ${catBadge.border}; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);" title="انقر للتبديل السريع بين التصنيفات">
                                <span>${catBadge.label}</span>
                                <span style="font-size: 0.65rem; opacity: 0.8;" title="تبديل التصنيف">↻</span>
                            </span>
                            ${primaryLinkedLesson ? `
                                <span class="lib-card-badge" onclick="openBrowseLessonSidePanel('${primaryLinkedLesson.lesson.id}', '${escapeHtml(primaryLinkedLesson.matchedAxis || '')}')" style="background: #f0fdfa; color: #0f766e; border: 1px solid #5eead4; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="انقر لعرض موارد هذا الدرس في اللوحة الجانبية">
                                    <span>📚 ${escapeHtml(primaryLinkedLesson.lesson.title)}</span>
                                </span>
                            ` : `
                                <button type="button" class="hide-in-presentation" onclick="openLinkResourceToLessonModal('', '', '${item.id}')" style="background: #f0fdfa; color: #0f766e; border: 1px dashed #5eead4; cursor: pointer; border-radius: 5px; padding: 2px 7px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 3px; font-weight: 700;" title="ربط هذا المورد بدرس ومحور دراسي">
                                    🔗 + ربط بدرس
                                </button>
                            `}
                            ${isNewlyAdded ? `
                                <span class="lib-card-badge" style="background: linear-gradient(135deg, #fef08a, #fde047); color: #854d0e; border: 1px solid #facc15; font-weight: 800; box-shadow: 0 1px 3px rgba(234,179,8,0.25);">
                                    ✦ جديد
                                </span>
                            ` : ''}
                            ${item.level && item.level !== 'عام' ? `<span class="lib-card-badge" style="background: #fdf2f8; color: #9d174d; border: 1px solid #fbcfe8; font-weight: 700;">${lucideIcon('graduationcap', {size: 11})} ${item.level}</span>` : ''}
                        </div>

                        ${isTemplate && item.templateObjectives ? `
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-right: 3px solid #0d9488; border-radius: 6px; padding: 7px 9px; font-size: 0.75rem; color: #334155; line-height: 1.45;">
                                <div style="font-weight: 800; color: #0f766e; margin-bottom: 2px;">🎯 الأهداف التربوية للقالب:</div>
                                <div style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${item.templateObjectives}</div>
                            </div>
                        ` : `
                            <!-- Quick File Details Strip (Revealed / Enhanced on Hover) -->
                            <div class="lib-card-hover-strip">
                                <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    <span style="font-weight: 700; color: ${catBadge.accent};">${meta.typeLabel}</span>
                                    ${isDrive && item.driveFolderName ? `
                                        <span style="color: #64748b;">• مجلد: <b style="color: #1e293b;">${item.driveFolderName}</b></span>
                                    ` : (isLocal && item.fileName) ? `
                                        <span style="color: #64748b; direction: ltr;" title="${item.fileName}">• ${item.fileName}</span>
                                    ` : ''}
                                </div>
                                <span style="font-weight: 800; font-size: 0.72rem; color: #0f172a; white-space: nowrap; margin-right: 6px;">
                                    📦 ${meta.sizeLabel}
                                </span>
                            </div>
                        `}

                        <!-- Date Added Tag -->
                        <div style="font-size: 0.74rem; color: #94a3b8; margin-top: auto; padding-top: 2px; display: flex; justify-content: space-between; align-items: center;">
                            <span>أضيف في: ${item.dateAdded || '-'}</span>
                            <span style="font-size: 0.7rem; color: #64748b; font-weight: 600;">${isTemplate ? `⏱️ الحيز الزمني: <b>${item.templateDuration || 4} ساعات</b>` : `صيغة: <b>.${meta.ext.toLowerCase()}</b>`}</span>
                        </div>

                        <!-- Interactive Action Buttons -->
                        ${(() => {
                            if (isTemplate && !item.url && !isLocal && !isDrive) {
                                return `
                                    <div style="display: flex; gap: 6px; margin-top: 4px;">
                                        <button type="button" onclick="openLessonTemplateViewerModal('${item.id}')" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; background: linear-gradient(135deg, #0d9488, #0f766e); color: white; border: none; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 800;">
                                            <span>📐</span>
                                            <span>معاينة وطباعة قالب الدرس</span>
                                        </button>
                                        <button type="button" onclick="openCreateLessonTemplateModal('', '${item.id}')" style="display: flex; align-items: center; justify-content: center; gap: 4px; background: #f8fafc; color: #0f766e; border: 1px solid #99f6e4; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 700;" title="تعديل قالب الدرس">
                                            <span>✏️</span>
                                        </button>
                                    </div>
                                `;
                            }
                            const isPdf = meta.isPdf;
                            const isVideo = meta.isVideo;

                            if (isDrive) {
                                return `
                                    <div style="display: flex; gap: 6px; margin-top: 4px;">
                                        <button type="button" onclick="openInAppFileViewer({ type: 'drive', driveFileId: '${item.driveFileId}', title: '${encodeURIComponent(item.title)}', url: '${safeUrl}', downloadUrl: '${item.downloadUrl || ''}', fileType: '${isVideo ? 'video' : (isPdf ? 'doc' : '')}' })" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; background: ${isVideo ? '#2563eb' : (isPdf ? '#b91c1c' : '#0284c7')}; color: white; border: none; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 700; transition: opacity 0.2s;">
                                            <span>${isVideo ? lucideIcon('play', {size: 13}) : (isPdf ? lucideIcon('file-text', {size: 13}) : lucideIcon('eye', {size: 13}))}</span>
                                            <span>${isVideo ? 'تشغيل الفيديو' : (isPdf ? 'معاينة PDF' : 'معاينة')}</span>
                                        </button>
                                        <button type="button" onclick="copyResourceLink('${safeUrl}', '${escapeHtml(item.title)}')" style="display: flex; align-items: center; justify-content: center; gap: 4px; background: #f8fafc; color: #1e293b; border: 1px solid #cbd5e1; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 600;" title="نسخ رابط المورد">
                                            <span>${lucideIcon('copy', {size: 12})}</span>
                                        </button>
                                        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; justify-content: center; gap: 4px; background: #f8fafc; color: #1e293b; border: 1px solid #cbd5e1; padding: 8px 10px; border-radius: 6px; text-decoration: none; font-size: 0.82rem; font-weight: 600;" title="فتح في Google Drive">
                                            <span>${lucideIcon('externallink', {size: 12})}</span>
                                        </a>
                                        ${item.downloadUrl ? `
                                            <a href="${item.downloadUrl}" target="_blank" rel="noopener noreferrer" download style="display: flex; align-items: center; justify-content: center; gap: 4px; background: #059669; color: white; padding: 8px 10px; border-radius: 6px; text-decoration: none; font-size: 0.82rem; font-weight: 700;" title="تنزيل الملف">
                                                <span>${lucideIcon('download', {size: 12})}</span>
                                            </a>
                                        ` : ''}
                                    </div>
                                `;
                            } else if (isLocal) {
                                return `
                                    <div style="display: flex; gap: 6px; margin-top: 4px;">
                                        <button type="button" onclick="openInAppFileViewer({ type: 'local', id: '${item.id}' })" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; background: ${isVideo ? '#2563eb' : (isPdf ? '#b91c1c' : 'var(--primary)')}; color: white; border: none; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 700; transition: opacity 0.2s;">
                                            <span>${isVideo ? lucideIcon('play', {size: 13}) : (isPdf ? lucideIcon('file-text', {size: 13}) : lucideIcon('eye', {size: 13}))}</span>
                                            <span>${isVideo ? 'تشغيل الفيديو' : (isPdf ? 'معاينة PDF' : 'معاينة')}</span>
                                        </button>
                                        <button type="button" onclick="copyLocalResourceInfo('${item.id}', '${escapeHtml(item.title)}')" style="display: flex; align-items: center; justify-content: center; gap: 4px; background: #f8fafc; color: #1e293b; border: 1px solid #cbd5e1; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 600;" title="نسخ بيانات المورد">
                                            <span>${lucideIcon('copy', {size: 12})}</span>
                                        </button>
                                        <button type="button" onclick="openLocalResource('${item.id}')" style="display: flex; align-items: center; justify-content: center; gap: 4px; background: #059669; color: white; border: none; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 700; transition: background 0.2s;" title="تحميل الملف إلى جهازك">
                                            <span>${lucideIcon('download', {size: 12})}</span>
                                        </button>
                                    </div>
                                `;
                            } else {
                                return `
                                    <div style="display: flex; gap: 6px; margin-top: 4px;">
                                        <button type="button" onclick="openInAppFileViewer({ type: 'url', url: '${safeUrl}', title: '${encodeURIComponent(item.title)}', category: '${isVideo ? 'video' : (isPdf ? 'doc' : 'link')}' })" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; background: ${isVideo ? '#2563eb' : (isPdf ? '#b91c1c' : 'var(--primary)')}; color: white; border: none; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 700; transition: opacity 0.2s;">
                                            <span>${isVideo ? lucideIcon('play', {size: 13}) : (isPdf ? lucideIcon('file-text', {size: 13}) : lucideIcon('eye', {size: 13}))}</span>
                                            <span>${isVideo ? 'تشغيل الفيديو' : (isPdf ? 'معاينة PDF' : 'معاينة')}</span>
                                        </button>
                                        ${isTemplate ? `
                                            <button type="button" onclick="openLessonTemplateViewerModal('${item.id}')" style="display: flex; align-items: center; justify-content: center; gap: 4px; background: #f0fdfa; color: #0f766e; border: 1px solid #5eead4; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 800;" title="بطاقة قالب الدرس">
                                                <span>📐</span>
                                            </button>
                                        ` : ''}
                                        <button type="button" onclick="copyResourceLink('${safeUrl}', '${escapeHtml(item.title)}')" style="display: flex; align-items: center; justify-content: center; gap: 4px; background: #f8fafc; color: #1e293b; border: 1px solid #cbd5e1; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 600;" title="نسخ رابط المورد">
                                            <span>${lucideIcon('copy', {size: 12})}</span>
                                        </button>
                                        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; justify-content: center; gap: 4px; background: #f8fafc; color: #1e293b; border: 1px solid #cbd5e1; padding: 8px 10px; border-radius: 6px; text-decoration: none; font-size: 0.82rem; font-weight: 600;" title="فتح في علامة تبويب جديدة">
                                            <span>${lucideIcon('externallink', {size: 12})}</span>
                                        </a>
                                    </div>
                                `;
                            }
                        })()}
                    </div>
                `;
            });
            return html;
        }
        window.buildLibraryResourceCardsHtml = buildLibraryResourceCardsHtml;

        var libSidebarChartInst = null;
        var libGrowthChartInst = null;
        var libLevelsChartInst = null;
        var currentLibSubTab = 'browse'; // 'browse' or 'analytics'
        var libGrowthVisualType = 'doughnut'; // 'doughnut' or 'bar'
        var libGrowthClickBehavior = 'inline'; // 'inline' (عرض مباشر أسفل المخطط) or 'browse' (الانتقال لتبويب التصفح)
        var currentLibAnalyticsLevelFilter = 'all';

        function toggleLibrarySidebar(forceState) {
            const sidebar = document.getElementById('libSidebarAnalytics');
            const btn = document.getElementById('btnToggleLibSidebar');
            const txt = document.getElementById('txtToggleLibSidebar');
            if (!sidebar) return;

            let isOpen;
            if (typeof forceState === 'boolean') {
                isOpen = forceState;
            } else {
                isOpen = sidebar.style.display === 'none';
            }

            sidebar.style.display = isOpen ? 'flex' : 'none';
            if (btn) {
                btn.style.background = isOpen ? '#eff6ff' : '#ffffff';
                btn.style.borderColor = isOpen ? '#93c5fd' : '#cbd5e1';
                btn.style.color = isOpen ? '#1d4ed8' : '#64748b';
            }
            if (txt) {
                txt.textContent = isOpen ? 'إخفاء اللوحة الجانبية' : 'اللوحة الجانبية';
            }
            try {
                localStorage.setItem('lib_sidebar_open', isOpen ? 'true' : 'false');
            } catch(e) {}

            if (isOpen) {
                setTimeout(() => {
                    if (window.currentBrowseSidebarMode === 'analytics') {
                        renderLibraryGrowthAnalytics();
                    } else if (typeof renderBrowseLessonSidePanel === 'function') {
                        renderBrowseLessonSidePanel();
                    }
                }, 50);
            }
        }
        window.toggleLibrarySidebar = toggleLibrarySidebar;

        function switchLibrarySubTab(tab) {
            currentLibSubTab = tab || 'browse';
            const browsePane = document.getElementById('libBrowseTabPane');
            const lessonResourcesPane = document.getElementById('libLessonResourcesTabPane');
            const curPane = document.getElementById("libCurriculumTabPane");
            const analyticsPane = document.getElementById('libAnalyticsTabPane');

            const btnBrowse = document.getElementById('btnLibTabBrowse');
            const btnLessonRes = document.getElementById('btnLibTabLessonResources');
            const btnCur = document.getElementById("btnLibTabCurriculum");
            const btnAnalytics = document.getElementById('btnLibTabAnalytics');
            const sidebarBtn = document.getElementById('btnToggleLibSidebar');
            const lessonSideBtn = document.getElementById('btnToggleLibLessonSidePanel');

            const setBtnState = (btn, active, activeBg, activeShadow, inactiveColor) => {
                if (!btn) return;
                btn.style.background = active ? activeBg : 'transparent';
                btn.style.color = active ? '#ffffff' : (inactiveColor || '#475569');
                btn.style.boxShadow = active ? activeShadow : 'none';
                btn.style.fontWeight = active ? '800' : '700';
            };

            if (browsePane) browsePane.style.display = (currentLibSubTab === 'browse') ? 'block' : 'none';
            if (lessonResourcesPane) lessonResourcesPane.style.display = (currentLibSubTab === 'lesson_resources') ? 'block' : 'none';
            if (curPane) curPane.style.display = (currentLibSubTab === 'curriculum') ? 'block' : 'none';
            if (analyticsPane) analyticsPane.style.display = (currentLibSubTab === 'analytics') ? 'block' : 'none';

            setBtnState(btnBrowse, currentLibSubTab === 'browse', '#2563eb', '0 2px 6px rgba(37,99,235,0.25)');
            setBtnState(btnLessonRes, currentLibSubTab === 'lesson_resources', '#0d9488', '0 2px 6px rgba(13,148,136,0.28)', '#0f766e');
            setBtnState(btnCur, currentLibSubTab === 'curriculum', '#0284c7', '0 2px 6px rgba(2,132,199,0.25)');
            setBtnState(btnAnalytics, currentLibSubTab === 'analytics', '#2563eb', '0 2px 6px rgba(37,99,235,0.25)');

            if (sidebarBtn) {
                sidebarBtn.style.display = (currentLibSubTab === 'browse') ? 'inline-flex' : 'none';
            }
            if (lessonSideBtn) {
                lessonSideBtn.style.display = (currentLibSubTab === 'browse') ? 'inline-flex' : 'none';
            }

            if (currentLibSubTab === 'curriculum') {
                if (typeof window.renderAnnualCurriculumView === 'function') {
                    window.renderAnnualCurriculumView();
                }
            } else if (currentLibSubTab === 'analytics') {
                renderLibraryGrowthAnalytics();
            } else if (currentLibSubTab === 'lesson_resources') {
                if (typeof renderLessonLinkedResourcesView === 'function') {
                    renderLessonLinkedResourcesView();
                }
            } else {
                renderLibrary();
            }

            if (window.lucide) window.lucide.createIcons();
        }
        window.switchLibrarySubTab = switchLibrarySubTab;

        window.refreshLibraryAnalytics = function() {
            renderLibraryGrowthAnalytics();
            if (typeof showToast === 'function') {
                showToast('تم تحديث مؤشرات نمو المكتبة والمخططات البيانية بنجاح 📊', 'success');
            }
        };

        window.cleanupLibraryCharts = function() {
            let count = 0;
            const checkAndDestroy = (inst) => {
                if (inst && typeof inst.destroy === 'function') {
                    const cvs = inst.canvas;
                    if (!cvs || !document.body.contains(cvs) || cvs.offsetParent === null) {
                        try {
                            inst.destroy();
                            count++;
                            return null;
                        } catch (e) {}
                    }
                }
                return inst;
            };
            libSidebarChartInst = checkAndDestroy(libSidebarChartInst);
            libGrowthChartInst = checkAndDestroy(libGrowthChartInst);
            libLevelsChartInst = checkAndDestroy(libLevelsChartInst);
            return count;
        };

        function resetAllLibraryFilters() {
            currentLibCategoryFilter = 'all';
            currentLibAnalyticsLevelFilter = 'all';
            const catEl = document.getElementById('libFilterCategory');
            if (catEl) catEl.value = 'all';
            const lvlEl = document.getElementById('libFilterLevel');
            if (lvlEl) lvlEl.value = 'all';
            const topEl = document.getElementById('libFilterTopic');
            if (topEl) topEl.value = 'all';
            const typEl = document.getElementById('libFilterType');
            if (typEl) typEl.value = 'all';
            const sEl = document.getElementById('libSearch');
            if (sEl) sEl.value = '';
            renderLibrary();
        }
        window.resetAllLibraryFilters = resetAllLibraryFilters;

        function openAddResourceForCategory(cat) {
            if (currentLibSubTab !== 'browse') {
                switchLibrarySubTab('browse');
            }
            const targetCat = cat && cat !== 'all' ? cat : 'درس';
            ['libDriveCategory', 'libLocalCategory', 'libUrlCategory'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = targetCat;
            });
            const addCard = document.getElementById('btnModeDrive') ? document.getElementById('btnModeDrive').closest('.card') : null;
            if (addCard) {
                addCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                addCard.style.outline = '3px solid #2563eb';
                setTimeout(() => { if (addCard) addCard.style.outline = ''; }, 1800);
            }
        }
        window.openAddResourceForCategory = openAddResourceForCategory;

        function setLibGrowthChartVisualType(type) {
            libGrowthVisualType = (type === 'bar') ? 'bar' : 'doughnut';
            if (libSidebarChartInst) {
                try { libSidebarChartInst.destroy(); } catch (e) {}
                libSidebarChartInst = null;
            }
            if (libGrowthChartInst) {
                try { libGrowthChartInst.destroy(); } catch (e) {}
                libGrowthChartInst = null;
            }
            const updateBtnPair = (doughnutId, barId) => {
                const dBtn = document.getElementById(doughnutId);
                const bBtn = document.getElementById(barId);
                if (dBtn) {
                    dBtn.style.background = libGrowthVisualType === 'doughnut' ? '#2563eb' : 'transparent';
                    dBtn.style.color = libGrowthVisualType === 'doughnut' ? '#ffffff' : '#475569';
                    dBtn.style.fontWeight = libGrowthVisualType === 'doughnut' ? '800' : '700';
                }
                if (bBtn) {
                    bBtn.style.background = libGrowthVisualType === 'bar' ? '#2563eb' : 'transparent';
                    bBtn.style.color = libGrowthVisualType === 'bar' ? '#ffffff' : '#475569';
                    bBtn.style.fontWeight = libGrowthVisualType === 'bar' ? '800' : '700';
                }
            };
            updateBtnPair('btnSidebarChartDoughnut', 'btnSidebarChartBar');
            updateBtnPair('btnAnalyticsChartDoughnut', 'btnAnalyticsChartBar');
            renderLibraryGrowthAnalytics();
        }
        window.setLibGrowthChartVisualType = setLibGrowthChartVisualType;

        function toggleLibGrowthClickBehavior() {
            libGrowthClickBehavior = (libGrowthClickBehavior === 'inline') ? 'browse' : 'inline';
            const btn = document.getElementById('btnLibChartClickBehavior');
            if (btn) {
                if (libGrowthClickBehavior === 'inline') {
                    btn.textContent = '⚡ عرض فوري أسفل المخطط';
                    btn.style.background = '#eff6ff';
                    btn.style.color = '#1d4ed8';
                    btn.style.borderColor = '#bfdbfe';
                } else {
                    btn.textContent = '📂 انتقال تلقائي لشبكة المكتبة';
                    btn.style.background = '#ecfdf5';
                    btn.style.color = '#047857';
                    btn.style.borderColor = '#a7f3d0';
                }
            }
        }
        window.toggleLibGrowthClickBehavior = toggleLibGrowthClickBehavior;

        function selectLibraryCategoryFromGrowthChart(cat, source) {
            const targetCat = cat || 'all';
            currentLibAnalyticsLevelFilter = 'all';

            // Reset restrictive secondary filters if they would hide the category's items
            const lvlEl = document.getElementById('libFilterLevel');
            if (lvlEl && lvlEl.value !== 'all') lvlEl.value = 'all';
            const topEl = document.getElementById('libFilterTopic');
            if (topEl && topEl.value !== 'all') topEl.value = 'all';
            const typEl = document.getElementById('libFilterType');
            if (typEl && typEl.value !== 'all') typEl.value = 'all';
            const sEl = document.getElementById('libSearch');
            if (sEl && sEl.value) sEl.value = '';

            // Toggle back to 'all' if clicking the already-selected category on the sidebar chart
            if (source === 'sidebar_chart' && currentLibCategoryFilter === targetCat && targetCat !== 'all') {
                currentLibCategoryFilter = 'all';
            } else {
                currentLibCategoryFilter = targetCat;
            }

            const selectEl = document.getElementById('libFilterCategory');
            if (selectEl) {
                selectEl.value = currentLibCategoryFilter;
            }

            // If user is in Analytics tab and chose 'browse' click behavior (or clicked from KPI/table browse button)
            if (currentLibSubTab === 'analytics' && (libGrowthClickBehavior === 'browse' || source === 'browse_jump')) {
                switchLibrarySubTab('browse');
            }

            renderLibrary();

            // Visual feedback & smooth scroll to the displayed resources
            if (currentLibSubTab === 'analytics') {
                const directCard = document.getElementById('libAnalyticsDirectResourcesCard');
                if (directCard) {
                    directCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    directCard.style.outline = '3px solid #2563eb';
                    directCard.style.borderRadius = '12px';
                    setTimeout(() => { if (directCard) directCard.style.outline = ''; }, 1600);
                }
            } else {
                const bannerEl = document.getElementById('libActiveFilterBanner') || document.getElementById('libraryContainer');
                const libContainer = document.getElementById('libraryContainer');
                if (bannerEl && source && source.indexOf('sidebar') !== -1) {
                    bannerEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
                if (libContainer) {
                    libContainer.style.outline = '2.5px solid #2563eb';
                    libContainer.style.borderRadius = '12px';
                    setTimeout(() => { if (libContainer) libContainer.style.outline = ''; }, 1400);
                }
            }

            const msg = currentLibCategoryFilter === 'all'
                ? 'تم عرض جميع موارد المكتبة البيداغوجية 📚'
                : `تم عرض الموارد التابعة لفئة «${currentLibCategoryFilter}» مباشرة 📂`;
            if (typeof showLibraryToast === 'function') {
                showLibraryToast(msg);
            } else if (typeof showToast === 'function') {
                showToast(msg, 'info');
            }
        }
        window.selectLibraryCategoryFromGrowthChart = selectLibraryCategoryFromGrowthChart;

        function selectLibraryLevelFromGrowthChart(levelLabel, source) {
            const rawLevel = (!levelLabel || levelLabel === 'عام / مشترك') ? 'عام' : levelLabel;
            currentLibAnalyticsLevelFilter = levelLabel || 'all';
            currentLibCategoryFilter = 'all';

            const catEl = document.getElementById('libFilterCategory');
            if (catEl) catEl.value = 'all';

            const lvlEl = document.getElementById('libFilterLevel');
            if (lvlEl) {
                const hasOpt = Array.from(lvlEl.options).some(o => o.value === rawLevel);
                if (!hasOpt && rawLevel !== 'all') {
                    const opt = document.createElement('option');
                    opt.value = rawLevel;
                    opt.textContent = rawLevel;
                    lvlEl.appendChild(opt);
                }
                lvlEl.value = (levelLabel === 'all') ? 'all' : rawLevel;
            }

            if (currentLibSubTab === 'analytics' && (libGrowthClickBehavior === 'browse' || source === 'browse_jump')) {
                switchLibrarySubTab('browse');
            }

            renderLibrary();

            if (currentLibSubTab === 'analytics') {
                const directCard = document.getElementById('libAnalyticsDirectResourcesCard');
                if (directCard) {
                    directCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    directCard.style.outline = '3px solid #059669';
                    directCard.style.borderRadius = '12px';
                    setTimeout(() => { if (directCard) directCard.style.outline = ''; }, 1600);
                }
            }

            const msg = (!levelLabel || levelLabel === 'all')
                ? 'تم عرض جميع المستويات الدراسية 📚'
                : `تم عرض الموارد التابعة للمستوى الدراسي «${levelLabel}» مباشرة 🎓`;
            if (typeof showLibraryToast === 'function') {
                showLibraryToast(msg);
            } else if (typeof showToast === 'function') {
                showToast(msg, 'info');
            }
        }
        window.selectLibraryLevelFromGrowthChart = selectLibraryLevelFromGrowthChart;

        function selectLibraryStorageTypeFromSidebar(storageType) {
            const typEl = document.getElementById('libFilterType');
            if (!typEl) return;
            typEl.value = (typEl.value === storageType) ? 'all' : storageType;
            renderLibrary();
        }
        window.selectLibraryStorageTypeFromSidebar = selectLibraryStorageTypeFromSidebar;

        function renderLibraryGrowthAnalytics() {
            if (!window.db) window.db = {};
            if (!window.db.library) window.db.library = [];
            const items = window.db.library || [];
            const total = items.length;

            const categoryConfig = {
                'درس': { label: 'درس', icon: '📖', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', targetMin: 5 },
                'سلسلة تمارين': { label: 'سلسلة تمارين', icon: '📝', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', targetMin: 5 },
                'فرض منزلي': { label: 'فرض منزلي', icon: '🏠', color: '#d97706', bg: '#fffbeb', border: '#fde68a', targetMin: 3 },
                'فرض محروس': { label: 'فرض محروس', icon: '⏱️', color: '#e11d48', bg: '#fff1f2', border: '#fecdd3', targetMin: 3 },
                'نماذج امتحانات إشهادية': { label: 'امتحانات إشهادية', icon: '🎓', color: '#9d174d', bg: '#fdf2f8', border: '#fbcfe8', targetMin: 3 },
                'بطاقة تقنية': { label: 'بطاقة تقنية', icon: '📋', color: '#7c3aed', bg: '#faf5ff', border: '#e9d5ff', targetMin: 2 },
                'مذكرات وزارية': { label: 'مذكرات وزارية', icon: '📜', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd', targetMin: 2 },
                'رابط رسمي': { label: 'رابط رسمي', icon: '🌐', color: '#0f766e', bg: '#f0fdfa', border: '#99f6e4', targetMin: 2 },
                'عرض ووسائط': { label: 'عرض ووسائط', icon: '🎬', color: '#a21caf', bg: '#fdf4ff', border: '#f0abfc', targetMin: 2 }
            };

            const allCategories = Object.keys(categoryConfig);

            const catCounts = {};
            allCategories.forEach(c => { catCounts[c] = 0; });

            const sourceCounts = {
                'drive': 0,
                'local': 0,
                'link': 0
            };

            const levelCounts = {};

            items.forEach(item => {
                const cat = inferResourceCategory(item);
                if (catCounts[cat] !== undefined) catCounts[cat]++;
                else catCounts['درس']++;

                if (item.isDriveFile) sourceCounts.drive++;
                else if (item.isLocalFile) sourceCounts.local++;
                else sourceCounts.link++;

                const lvl = item.level && item.level !== 'all' && item.level !== 'عام' ? item.level : 'عام / مشترك';
                levelCounts[lvl] = (levelCounts[lvl] || 0) + 1;
            });

            // 1. Sidebar Total Badge
            const sidebarTotalEl = document.getElementById('sidebarLibTotalBadge');
            if (sidebarTotalEl) {
                sidebarTotalEl.textContent = currentLibCategoryFilter === 'all' ? `${total} مورد (الكل)` : `إلغاء التصفية (${total})`;
                sidebarTotalEl.style.background = currentLibCategoryFilter === 'all' ? '#2563eb' : '#ef4444';
            }

            // 2. Sidebar Mini KPI List (Interactive with active state)
            const sidebarListEl = document.getElementById('libSidebarCategoryList');
            if (sidebarListEl) {
                sidebarListEl.innerHTML = allCategories.map(cat => {
                    const c = categoryConfig[cat];
                    const count = catCounts[cat] || 0;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    const isSelected = currentLibCategoryFilter === cat;
                    return `
                        <div onclick="selectLibraryCategoryFromGrowthChart('${cat}', 'sidebar_list')" style="display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; border-radius: 8px; background: ${isSelected ? c.color : c.bg}; border: ${isSelected ? '2px solid #0f172a' : '1px solid ' + c.border}; cursor: pointer; transition: all 0.15s; box-shadow: ${isSelected ? '0 3px 8px rgba(0,0,0,0.12)' : 'none'};" title="انقر لعرض موارد فئة: ${cat}">
                            <div style="display: flex; align-items: center; gap: 7px;">
                                <span style="font-size: 1rem;">${c.icon}</span>
                                <span style="font-size: 0.79rem; font-weight: 800; color: ${isSelected ? '#ffffff' : '#1e293b'};">${c.label}</span>
                                ${isSelected ? `<span style="font-size: 0.65rem; background: rgba(255,255,255,0.25); color: #fff; padding: 1px 5px; border-radius: 9999px; font-weight: 800;">معروض ✓</span>` : ''}
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="font-size: 0.72rem; color: ${isSelected ? '#e2e8f0' : '#64748b'}; font-weight: 700;">${pct}%</span>
                                <span style="font-size: 0.78rem; font-weight: 800; background: ${isSelected ? '#ffffff' : c.color}; color: ${isSelected ? c.color : '#ffffff'}; padding: 1px 7px; border-radius: 9999px;">
                                    ${count}
                                </span>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            // 3. Sidebar Storage Breakdown (Clickable)
            const storageEl = document.getElementById('libSidebarStorageBreakdown');
            if (storageEl) {
                const currentTypeFilter = document.getElementById('libFilterType') ? document.getElementById('libFilterType').value : 'all';
                storageEl.innerHTML = `
                    <div onclick="selectLibraryStorageTypeFromSidebar('drive')" style="flex: 1; background: ${currentTypeFilter === 'drive' ? '#dbeafe' : '#ffffff'}; padding: 5px 4px; border-radius: 6px; border: ${currentTypeFilter === 'drive' ? '1.5px solid #2563eb' : '1px solid #cbd5e1'}; cursor: pointer;" title="انقر لعرض ملفات Google Drive فقط">
                        <div style="font-weight: 800; color: #2563eb; font-size: 0.82rem;">${sourceCounts.drive}</div>
                        <div style="color: #64748b; font-size: 0.68rem; font-weight: 700;">سحابي Drive</div>
                    </div>
                    <div onclick="selectLibraryStorageTypeFromSidebar('local')" style="flex: 1; background: ${currentTypeFilter === 'local' ? '#dcfce7' : '#ffffff'}; padding: 5px 4px; border-radius: 6px; border: ${currentTypeFilter === 'local' ? '1.5px solid #059669' : '1px solid #cbd5e1'}; cursor: pointer;" title="انقر لعرض الملفات المحلية فقط">
                        <div style="font-weight: 800; color: #059669; font-size: 0.82rem;">${sourceCounts.local}</div>
                        <div style="color: #64748b; font-size: 0.68rem; font-weight: 700;">ملف محلي</div>
                    </div>
                    <div onclick="selectLibraryStorageTypeFromSidebar('link')" style="flex: 1; background: ${currentTypeFilter === 'link' ? '#f3e8ff' : '#ffffff'}; padding: 5px 4px; border-radius: 6px; border: ${currentTypeFilter === 'link' ? '1.5px solid #7c3aed' : '1px solid #cbd5e1'}; cursor: pointer;" title="انقر لعرض الروابط والمواقع فقط">
                        <div style="font-weight: 800; color: #7c3aed; font-size: 0.82rem;">${sourceCounts.link}</div>
                        <div style="color: #64748b; font-size: 0.68rem; font-weight: 700;">روابط ويب</div>
                    </div>
                `;
            }

            // Prepare Chart Data (with minimum visual slice weight in doughnut mode so even 0-count categories remain visible & clickable!)
            const labels = allCategories;
            const realCounts = labels.map(l => catCounts[l] || 0);
            const visualDataVals = (libGrowthVisualType === 'doughnut')
                ? realCounts.map(v => v > 0 ? v : (total > 0 ? Math.max(total * 0.035, 0.35) : 1))
                : realCounts;
            const colors = labels.map(l => {
                const baseColor = categoryConfig[l].color;
                if (currentLibCategoryFilter !== 'all' && currentLibCategoryFilter !== l) {
                    return baseColor + '66'; // dim non-selected slices when a filter is active
                }
                return baseColor;
            });
            const offsets = labels.map(l => (currentLibCategoryFilter === l ? 14 : 0));

            // 4. Sidebar Chart.js (Interactive Doughnut / Bar)
            const sidebarCanvas = document.getElementById('libSidebarCategoryChart');
            if (typeof Chart === 'undefined' && (sidebarCanvas || document.getElementById('libGrowthCategoryChart') || document.getElementById('libGrowthLevelsChart'))) {
                const hostCanvas = sidebarCanvas || document.getElementById('libGrowthCategoryChart') || document.getElementById('libGrowthLevelsChart');
                if (hostCanvas && typeof window.ensureChartJsLoaded === 'function' && !hostCanvas.dataset.chartLoading) {
                    hostCanvas.dataset.chartLoading = '1';
                    window.ensureChartJsLoaded().then(c => { if (c) renderLibraryGrowthAnalytics(); });
                }
            }
            if (sidebarCanvas && typeof Chart !== 'undefined') {
                if (libSidebarChartInst && (libSidebarChartInst.canvas !== sidebarCanvas || libSidebarChartInst.config.type !== libGrowthVisualType)) {
                    try { libSidebarChartInst.destroy(); } catch (e) {}
                    libSidebarChartInst = null;
                }
                const ctx = sidebarCanvas.getContext('2d');
                if (libSidebarChartInst) {
                    libSidebarChartInst.data.labels = labels;
                    libSidebarChartInst.data.datasets[0].data = visualDataVals;
                    libSidebarChartInst.data.datasets[0].realCounts = realCounts;
                    libSidebarChartInst.data.datasets[0].backgroundColor = colors;
                    libSidebarChartInst.data.datasets[0].offset = offsets;
                    libSidebarChartInst.update();
                } else {
                    libSidebarChartInst = new Chart(ctx, {
                        type: libGrowthVisualType,
                        data: {
                            labels: labels,
                            datasets: [{
                                label: 'عدد الموارد',
                                data: visualDataVals,
                                realCounts: realCounts,
                                backgroundColor: colors,
                                borderColor: '#ffffff',
                                borderWidth: libGrowthVisualType === 'doughnut' ? 2 : 1,
                                borderRadius: libGrowthVisualType === 'bar' ? 5 : 0,
                                minBarLength: libGrowthVisualType === 'bar' ? 8 : undefined,
                                offset: offsets,
                                hoverOffset: 8
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            onHover: function(event, chartElement) {
                                if (event && event.native && event.native.target) {
                                    event.native.target.style.cursor = chartElement && chartElement.length ? 'pointer' : 'default';
                                }
                            },
                            onClick: function(event, elements, chart) {
                                let activeEls = elements;
                                if ((!activeEls || activeEls.length === 0) && chart && typeof chart.getElementsAtEventForMode === 'function') {
                                    activeEls = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
                                }
                                if (activeEls && activeEls.length > 0) {
                                    const idx = activeEls[0].index;
                                    const clickedCat = chart.data.labels[idx];
                                    if (clickedCat) {
                                        selectLibraryCategoryFromGrowthChart(clickedCat, 'sidebar_chart');
                                    }
                                }
                            },
                            scales: libGrowthVisualType === 'bar' ? {
                                y: { beginAtZero: true, ticks: { precision: 0, font: { family: 'Cairo, sans-serif', size: 10 } } },
                                x: { ticks: { font: { family: 'Cairo, sans-serif', size: 9, weight: '700' } } }
                            } : undefined,
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    rtl: true,
                                    callbacks: {
                                        label: function(ctx) {
                                            const realArr = ctx.dataset.realCounts || [];
                                            const val = realArr[ctx.dataIndex] !== undefined ? realArr[ctx.dataIndex] : (ctx.raw || 0);
                                            const p = total > 0 ? Math.round((val / total) * 100) : 0;
                                            return ` ${ctx.label}: ${val} مورد (${p}%) — انقر للعرض المباشر`;
                                        }
                                    }
                                }
                            },
                            cutout: libGrowthVisualType === 'doughnut' ? '60%' : undefined
                        }
                    });
                }
            }

            // 5. Full Analytics Tab: KPI Grid (All 9 categories + Total)
            const kpiGrid = document.getElementById('libAnalyticsKpiGrid');
            if (kpiGrid) {
                const kpis = [
                    { title: 'إجمالي الرصيد الرقمي', count: total, pct: '100%', icon: '📚', color: '#1e293b', bg: '#f8fafc', border: '#cbd5e1', filter: 'all' },
                    ...allCategories.map(cat => ({
                        title: categoryConfig[cat].label,
                        count: catCounts[cat] || 0,
                        pct: total ? Math.round(((catCounts[cat] || 0) / total) * 100) + '%' : '0%',
                        icon: categoryConfig[cat].icon,
                        color: categoryConfig[cat].color,
                        bg: categoryConfig[cat].bg,
                        border: categoryConfig[cat].border,
                        filter: cat
                    }))
                ];

                kpiGrid.innerHTML = kpis.map(k => {
                    const isSelected = currentLibCategoryFilter === k.filter;
                    return `
                        <div onclick="selectLibraryCategoryFromGrowthChart('${k.filter}', 'kpi_card');" style="background: ${k.bg}; border: ${isSelected ? '2.5px solid ' + k.color : '1.5px solid ' + k.border}; border-radius: 12px; padding: 12px 14px; cursor: pointer; transition: all 0.2s; box-shadow: ${isSelected ? '0 4px 12px rgba(37,99,235,0.14)' : '0 1px 3px rgba(0,0,0,0.02)'}; transform: ${isSelected ? 'translateY(-2px)' : 'none'};" title="انقر لعرض الموارد التابعة لفئة: ${k.title}">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                                <span style="font-size: 1.3rem;">${k.icon}</span>
                                <span style="font-size: 0.72rem; font-weight: 800; background: ${k.color}18; color: ${k.color}; padding: 2px 7px; border-radius: 9999px;">
                                    ${k.pct}
                                </span>
                            </div>
                            <div style="font-size: 1.45rem; font-weight: 900; color: ${k.color}; line-height: 1.2;">
                                ${k.count}
                            </div>
                            <div style="font-size: 0.78rem; font-weight: 800; color: #334155; margin-top: 4px; display: flex; align-items: center; justify-content: space-between;">
                                <span>${k.title}</span>
                                ${isSelected ? `<span style="font-size: 0.66rem; color: ${k.color};">✓ محدد</span>` : `<span style="font-size: 0.66rem; color: #94a3b8;">عرض ←</span>`}
                            </div>
                        </div>
                    `;
                }).join('');
            }

            // 6. Full Analytics Tab: Chart 1 (Interactive Category Growth Chart)
            const growthCanvas = document.getElementById('libGrowthCategoryChart');
            if (growthCanvas && typeof Chart !== 'undefined') {
                if (libGrowthChartInst && (libGrowthChartInst.canvas !== growthCanvas || libGrowthChartInst.config.type !== libGrowthVisualType)) {
                    try { libGrowthChartInst.destroy(); } catch (e) {}
                    libGrowthChartInst = null;
                }
                const ctx = growthCanvas.getContext('2d');

                if (libGrowthChartInst) {
                    libGrowthChartInst.data.labels = labels;
                    libGrowthChartInst.data.datasets[0].data = visualDataVals;
                    libGrowthChartInst.data.datasets[0].realCounts = realCounts;
                    libGrowthChartInst.data.datasets[0].backgroundColor = colors;
                    libGrowthChartInst.data.datasets[0].offset = offsets;
                    libGrowthChartInst.update();
                } else {
                    libGrowthChartInst = new Chart(ctx, {
                        type: libGrowthVisualType,
                        data: {
                            labels: labels,
                            datasets: [{
                                label: 'عدد الموارد في الفئة',
                                data: visualDataVals,
                                realCounts: realCounts,
                                backgroundColor: colors,
                                borderColor: '#ffffff',
                                borderWidth: libGrowthVisualType === 'doughnut' ? 3 : 1.5,
                                borderRadius: libGrowthVisualType === 'bar' ? 6 : 0,
                                minBarLength: libGrowthVisualType === 'bar' ? 10 : undefined,
                                offset: offsets,
                                hoverOffset: 10
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            onHover: function(event, chartElement) {
                                if (event && event.native && event.native.target) {
                                    event.native.target.style.cursor = chartElement && chartElement.length ? 'pointer' : 'default';
                                }
                            },
                            onClick: function(event, elements, chart) {
                                let activeEls = elements;
                                if ((!activeEls || activeEls.length === 0) && chart && typeof chart.getElementsAtEventForMode === 'function') {
                                    activeEls = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
                                }
                                if (activeEls && activeEls.length > 0) {
                                    const idx = activeEls[0].index;
                                    const clickedCat = chart.data.labels[idx];
                                    if (clickedCat) {
                                        selectLibraryCategoryFromGrowthChart(clickedCat, 'analytics_chart');
                                    }
                                }
                            },
                            scales: libGrowthVisualType === 'bar' ? {
                                y: { beginAtZero: true, ticks: { precision: 0, font: { family: 'Cairo, sans-serif' } } },
                                x: { ticks: { font: { family: 'Cairo, sans-serif', size: 11, weight: '700' } } }
                            } : undefined,
                            plugins: {
                                legend: {
                                    display: libGrowthVisualType === 'doughnut',
                                    position: 'bottom',
                                    rtl: true,
                                    onClick: function(e, legendItem, legend) {
                                        const idx = legendItem.index;
                                        const clickedCat = legend.chart.data.labels[idx];
                                        if (clickedCat) {
                                            selectLibraryCategoryFromGrowthChart(clickedCat, 'analytics_legend');
                                        }
                                    },
                                    labels: {
                                        font: { family: 'Cairo, sans-serif', size: 11, weight: '700' },
                                        padding: 10,
                                        usePointStyle: true,
                                        pointStyle: 'circle'
                                    }
                                },
                                tooltip: {
                                    rtl: true,
                                    callbacks: {
                                        label: function(ctx) {
                                            const realArr = ctx.dataset.realCounts || [];
                                            const val = realArr[ctx.dataIndex] !== undefined ? realArr[ctx.dataIndex] : (ctx.raw || 0);
                                            const p = total > 0 ? Math.round((val / total) * 100) : 0;
                                            return ` ${ctx.label}: ${val} مورد (${p}%) — انقر لعرض موارد الفئة مباشرة`;
                                        }
                                    }
                                }
                            },
                            cutout: libGrowthVisualType === 'doughnut' ? '56%' : undefined
                        }
                    });
                }
            }

            // Interactive Category Chips Strip right below Chart 1
            const catStripEl = document.getElementById('libGrowthChartInteractiveCategories');
            if (catStripEl) {
                catStripEl.innerHTML = `
                    <span style="font-size: 0.72rem; font-weight: 800; color: #64748b; margin-left: 4px;">اختيار سريع للفئة:</span>
                    <button type="button" onclick="selectLibraryCategoryFromGrowthChart('all', 'chart_strip')" style="padding: 4px 10px; border-radius: 9999px; font-size: 0.73rem; font-weight: 800; cursor: pointer; border: 1.5px solid ${currentLibCategoryFilter === 'all' ? '#1e293b' : '#cbd5e1'}; background: ${currentLibCategoryFilter === 'all' ? '#1e293b' : '#ffffff'}; color: ${currentLibCategoryFilter === 'all' ? '#ffffff' : '#334155'};">
                        📚 الكل (${total})
                    </button>
                    ${allCategories.map(cat => {
                        const c = categoryConfig[cat];
                        const count = catCounts[cat] || 0;
                        const isSel = currentLibCategoryFilter === cat;
                        return `
                            <button type="button" onclick="selectLibraryCategoryFromGrowthChart('${cat}', 'chart_strip')" style="padding: 4px 10px; border-radius: 9999px; font-size: 0.73rem; font-weight: 800; cursor: pointer; border: 1.5px solid ${isSel ? c.color : c.border}; background: ${isSel ? c.color : c.bg}; color: ${isSel ? '#ffffff' : '#1e293b'}; display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s;">
                                <span>${c.icon}</span>
                                <span>${c.label}</span>
                                <span style="background: ${isSel ? 'rgba(255,255,255,0.25)' : '#ffffff'}; color: ${isSel ? '#ffffff' : c.color}; padding: 0 5px; border-radius: 9999px; font-size: 0.68rem;">${count}</span>
                            </button>
                        `;
                    }).join('')}
                `;
            }

            // 7. Full Analytics Tab: Chart 2 (Interactive Academic Levels Breakdown Bar Chart)
            const levelsCanvas = document.getElementById('libGrowthLevelsChart');
            const sortedLevels = Object.keys(levelCounts).sort((a,b) => levelCounts[b] - levelCounts[a]);
            const topLevels = sortedLevels.slice(0, 8);
            const levelLabels = topLevels.length > 0 ? topLevels : ['عام / مشترك'];
            const levelDataVals = topLevels.length > 0 ? topLevels.map(l => levelCounts[l]) : [total];
            const levelColors = levelLabels.map(l => (currentLibAnalyticsLevelFilter === l ? '#047857' : 'rgba(5, 150, 105, 0.82)'));

            if (levelsCanvas && typeof Chart !== 'undefined') {
                if (libLevelsChartInst && libLevelsChartInst.canvas !== levelsCanvas) {
                    try { libLevelsChartInst.destroy(); } catch (e) {}
                    libLevelsChartInst = null;
                }
                const ctx = levelsCanvas.getContext('2d');

                if (libLevelsChartInst) {
                    libLevelsChartInst.data.labels = levelLabels;
                    libLevelsChartInst.data.datasets[0].data = levelDataVals;
                    libLevelsChartInst.data.datasets[0].backgroundColor = levelColors;
                    libLevelsChartInst.update();
                } else {
                    libLevelsChartInst = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: levelLabels,
                            datasets: [{
                                label: 'عدد الموارد البيداغوجية',
                                data: levelDataVals,
                                backgroundColor: levelColors,
                                borderColor: '#059669',
                                borderWidth: 1.5,
                                borderRadius: 6,
                                minBarLength: 10
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            onHover: function(event, chartElement) {
                                if (event && event.native && event.native.target) {
                                    event.native.target.style.cursor = chartElement && chartElement.length ? 'pointer' : 'default';
                                }
                            },
                            onClick: function(event, elements, chart) {
                                let activeEls = elements;
                                if ((!activeEls || activeEls.length === 0) && chart && typeof chart.getElementsAtEventForMode === 'function') {
                                    activeEls = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
                                }
                                if (activeEls && activeEls.length > 0) {
                                    const idx = activeEls[0].index;
                                    const clickedLevel = chart.data.labels[idx];
                                    if (clickedLevel) {
                                        selectLibraryLevelFromGrowthChart(clickedLevel, 'levels_chart');
                                    }
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    ticks: { precision: 0, font: { family: 'Cairo, sans-serif' } }
                                },
                                x: {
                                    ticks: { font: { family: 'Cairo, sans-serif', size: 11, weight: '700' } }
                                }
                            },
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    rtl: true,
                                    callbacks: {
                                        label: function(ctx) {
                                            return ` عدد الموارد: ${ctx.raw} ملف/رابط — انقر لعرض موارد هذا المستوى`;
                                        }
                                    }
                                }
                            }
                        }
                    });
                }
            }

            // Interactive Levels Strip right below Chart 2
            const lvlStripEl = document.getElementById('libGrowthChartInteractiveLevels');
            if (lvlStripEl) {
                lvlStripEl.innerHTML = `
                    <span style="font-size: 0.72rem; font-weight: 800; color: #64748b; margin-left: 4px;">تصفية حسب المستوى:</span>
                    <button type="button" onclick="selectLibraryLevelFromGrowthChart('all', 'levels_strip')" style="padding: 4px 10px; border-radius: 9999px; font-size: 0.73rem; font-weight: 800; cursor: pointer; border: 1.5px solid ${currentLibAnalyticsLevelFilter === 'all' ? '#047857' : '#cbd5e1'}; background: ${currentLibAnalyticsLevelFilter === 'all' ? '#047857' : '#ffffff'}; color: ${currentLibAnalyticsLevelFilter === 'all' ? '#ffffff' : '#334155'};">
                        🎓 كل المستويات (${total})
                    </button>
                    ${levelLabels.map(lvl => {
                        const cnt = levelCounts[lvl] || 0;
                        const isSel = currentLibAnalyticsLevelFilter === lvl;
                        return `
                            <button type="button" onclick="selectLibraryLevelFromGrowthChart('${lvl}', 'levels_strip')" style="padding: 4px 10px; border-radius: 9999px; font-size: 0.73rem; font-weight: 800; cursor: pointer; border: 1.5px solid ${isSel ? '#047857' : '#a7f3d0'}; background: ${isSel ? '#059669' : '#ecfdf5'}; color: ${isSel ? '#ffffff' : '#065f46'}; display: inline-flex; align-items: center; gap: 4px;">
                                <span>${lvl}</span>
                                <span style="background: ${isSel ? 'rgba(255,255,255,0.25)' : '#ffffff'}; color: ${isSel ? '#ffffff' : '#047857'}; padding: 0 5px; border-radius: 9999px; font-size: 0.68rem;">${cnt}</span>
                            </button>
                        `;
                    }).join('')}
                `;
            }

            // 8. Direct Interactive Resources Display Panel right below the Growth Charts in #libAnalyticsTabPane
            const directResourcesCard = document.getElementById('libAnalyticsDirectResourcesCard');
            if (directResourcesCard) {
                let matchingResources = items;
                let headerTitle = 'جميع موارد المكتبة الرقمية';
                let headerBadgeColor = '#2563eb';
                let headerBg = '#eff6ff';
                let headerBorder = '#bfdbfe';
                let headerIcon = '📚';

                if (currentLibCategoryFilter !== 'all') {
                    matchingResources = items.filter(it => inferResourceCategory(it) === currentLibCategoryFilter);
                    const cMeta = categoryConfig[currentLibCategoryFilter] || { label: currentLibCategoryFilter, icon: '📂', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' };
                    headerTitle = `الموارد التابعة لفئة: ${cMeta.label}`;
                    headerBadgeColor = cMeta.color;
                    headerBg = cMeta.bg;
                    headerBorder = cMeta.border;
                    headerIcon = cMeta.icon;
                } else if (currentLibAnalyticsLevelFilter !== 'all') {
                    matchingResources = items.filter(it => {
                        const lvl = it.level && it.level !== 'all' && it.level !== 'عام' ? it.level : 'عام / مشترك';
                        return lvl === currentLibAnalyticsLevelFilter;
                    });
                    headerTitle = `الموارد التابعة للمستوى الدراسي: ${currentLibAnalyticsLevelFilter}`;
                    headerBadgeColor = '#059669';
                    headerBg = '#ecfdf5';
                    headerBorder = '#a7f3d0';
                    headerIcon = '🎓';
                }

                directResourcesCard.innerHTML = `
                    <div style="background: #ffffff; border: 2px solid ${headerBorder}; border-radius: 14px; padding: 18px; box-shadow: 0 4px 14px rgba(0,0,0,0.04);">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; padding-bottom: 12px; margin-bottom: 14px; border-bottom: 1.5px solid #f1f5f9;">
                            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                <span style="width: 38px; height: 38px; border-radius: 10px; background: ${headerBg}; border: 1.5px solid ${headerBorder}; display: inline-flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                                    ${headerIcon}
                                </span>
                                <div>
                                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                        <h4 style="margin: 0; font-size: 1rem; font-weight: 900; color: #0f172a;">${headerTitle}</h4>
                                        <span style="background: ${headerBadgeColor}; color: #ffffff; font-size: 0.74rem; font-weight: 800; padding: 2px 10px; border-radius: 9999px;">
                                            ${matchingResources.length} مورد
                                        </span>
                                    </div>
                                    <p style="margin: 2px 0 0 0; font-size: 0.76rem; color: #64748b;">
                                        معاينة تفاعلية مباشرة للموارد المرتبطة بالفئة المحددة من الرسم البياني للنمو (انقر على أي فئة أعلاه للتبديل الفوري)
                                    </p>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                ${currentLibCategoryFilter !== 'all' ? `
                                    <button type="button" onclick="openAddResourceForCategory('${currentLibCategoryFilter}')" style="background: ${headerBg}; color: ${headerBadgeColor}; border: 1.5px solid ${headerBorder}; padding: 6px 12px; border-radius: 8px; font-size: 0.76rem; font-weight: 800; cursor: pointer;">
                                        ➕ إضافة مورد في «${currentLibCategoryFilter}»
                                    </button>
                                ` : ''}
                                ${(currentLibCategoryFilter !== 'all' || currentLibAnalyticsLevelFilter !== 'all') ? `
                                    <button type="button" onclick="selectLibraryCategoryFromGrowthChart('all', 'direct_reset')" style="background: #f8fafc; color: #475569; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 8px; font-size: 0.76rem; font-weight: 800; cursor: pointer;">
                                        🔄 عرض كافة الفئات (${total})
                                    </button>
                                ` : ''}
                                <button type="button" onclick="switchLibrarySubTab('browse')" style="background: #2563eb; color: #ffffff; border: none; padding: 6px 14px; border-radius: 8px; font-size: 0.76rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 2px 6px rgba(37,99,235,0.2);">
                                    <span>فتح في شبكة التصفح الرئيسية</span>
                                    <span>↗</span>
                                </button>
                            </div>
                        </div>

                        ${matchingResources.length > 0 ? `
                            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px;">
                                ${buildLibraryResourceCardsHtml(matchingResources)}
                            </div>
                        ` : `
                            <div style="text-align: center; padding: 24px 16px; background: #f8fafc; border-radius: 10px; border: 1.5px dashed #cbd5e1;">
                                <div style="font-size: 0.9rem; font-weight: 800; color: #334155; margin-bottom: 6px;">
                                    لا توجد موارد مضافة بعد في فئة «${currentLibCategoryFilter === 'all' ? headerTitle : currentLibCategoryFilter}»
                                </div>
                                <div style="font-size: 0.78rem; color: #64748b; margin-bottom: 12px;">
                                    يمكنك إضافة مورد جديد لهذه الفئة أو إدراج حزمة الموارد التربوية الرسمية المعتمدة بضغطة زر
                                </div>
                                <div style="display: flex; justify-content: center; gap: 8px; flex-wrap: wrap;">
                                    ${currentLibCategoryFilter !== 'all' ? `
                                        <button type="button" onclick="openAddResourceForCategory('${currentLibCategoryFilter}')" style="background: #2563eb; color: #ffffff; border: none; padding: 7px 14px; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer;">
                                            ➕ إضافة مورد جديد في «${currentLibCategoryFilter}»
                                        </button>
                                    ` : ''}
                                    <button type="button" onclick="loadOfficialCuratedResources()" style="background: #059669; color: #ffffff; border: none; padding: 7px 14px; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer;">
                                        📚 إدراج حزمة الموارد الرسمية المعتمدة
                                    </button>
                                </div>
                            </div>
                        `}
                    </div>
                `;
                if (window.lucide) window.lucide.createIcons();
            }

            // 9. Full Analytics Tab: Detailed Pedagogical Table (All 9 categories)
            const tableBody = document.getElementById('libAnalyticsTableBody');
            if (tableBody) {
                tableBody.innerHTML = allCategories.map(cat => {
                    const c = categoryConfig[cat];
                    const count = catCounts[cat] || 0;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    const isSelected = currentLibCategoryFilter === cat;

                    let statusLabel = '';
                    let statusBadge = '';
                    if (count >= 10) {
                        statusLabel = 'رصيد غني جداً وممتاز ✅';
                        statusBadge = 'background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;';
                    } else if (count >= 5) {
                        statusLabel = 'تغطية جيدة وكافية 👍';
                        statusBadge = 'background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;';
                    } else if (count > 0) {
                        statusLabel = 'تغطية أولية (يستحسن إغناء الرصيد) ⚠️';
                        statusBadge = 'background: #fffbeb; color: #b45309; border: 1px solid #fde68a;';
                    } else {
                        statusLabel = 'لا توجد موارد بعد (بحاجة لإضافة) ❗';
                        statusBadge = 'background: #fff1f2; color: #be123c; border: 1px solid #fecdd3;';
                    }

                    return `
                        <tr onclick="selectLibraryCategoryFromGrowthChart('${cat}', 'analytics_table')" style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s; cursor: pointer; background: ${isSelected ? c.bg : 'transparent'};" title="انقر لعرض موارد فئة: ${c.label}">
                            <td style="padding: 12px 14px; font-weight: 800; color: #1e293b;">${c.label} ${isSelected ? `<span style="font-size: 0.68rem; color: ${c.color}; font-weight: 900;">(معروض ✓)</span>` : ''}</td>
                            <td style="padding: 12px 14px;"><span style="font-size: 1.2rem;">${c.icon}</span></td>
                            <td style="padding: 12px 14px; font-weight: 900; font-size: 1rem; color: ${c.color};">${count}</td>
                            <td style="padding: 12px 14px; font-weight: 700; color: #475569;">${pct}%</td>
                            <td style="padding: 12px 14px; min-width: 140px;">
                                <div style="background: #e2e8f0; border-radius: 9999px; height: 9px; overflow: hidden; width: 100%;">
                                    <div style="background: ${c.color}; height: 100%; width: ${pct}%; border-radius: 9999px; transition: width 0.3s;"></div>
                                </div>
                            </td>
                            <td style="padding: 12px 14px;">
                                <span style="font-size: 0.74rem; font-weight: 700; padding: 3px 9px; border-radius: 9999px; display: inline-block; ${statusBadge}">
                                    ${statusLabel}
                                </span>
                            </td>
                            <td style="padding: 12px 14px; text-align: center;">
                                <div style="display: inline-flex; gap: 4px;">
                                    <button type="button" onclick="event.stopPropagation(); selectLibraryCategoryFromGrowthChart('${cat}', 'analytics_table');" style="background: ${c.bg}; color: ${c.color}; border: 1px solid ${c.border}; border-radius: 6px; padding: 4px 9px; font-size: 0.74rem; font-weight: 800; cursor: pointer;" title="عرض مباشر للموارد أسفل المخطط">
                                        عرض مباشر
                                    </button>
                                    <button type="button" onclick="event.stopPropagation(); selectLibraryCategoryFromGrowthChart('${cat}', 'browse_jump');" style="background: #ffffff; color: #334155; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 8px; font-size: 0.74rem; font-weight: 700; cursor: pointer;" title="فتح في شبكة التصفح">
                                        ↗
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }
        window.renderLibraryGrowthAnalytics = renderLibraryGrowthAnalytics;

        function exportLibraryResources() {
            if (!db.library || db.library.length === 0) {
                if (typeof showLibraryToast === 'function') {
                    showLibraryToast('لا توجد موارد لتصديرها حالياً.');
                }
                return;
            }
            const exportData = db.library.map(item => ({
                id: item.id,
                title: item.title,
                url: item.url || '',
                type: item.type || 'doc',
                topic: item.topic || '',
                isLocalFile: !!item.isLocalFile,
                fileName: item.fileName || '',
                fileSize: item.fileSize || '',
                dateAdded: item.dateAdded || ''
            }));
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
            const a = document.createElement('a');
            a.setAttribute("href", dataStr);
            const dateStr = window.formatLocalDate ? window.formatLocalDate() : new Date().toLocaleDateString('en-CA');
            a.setAttribute("download", `educational_resources_${dateStr}.json`);
            document.body.appendChild(a);
            a.click();
            a.remove();
        }

        function handleBulkImportResources(input) {
            const file = input.files && input.files[0];
            if (!file) return;

            const isJson = file.name.endsWith('.json');
            const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

            if (!isJson && !isExcel) {
                window.notifySafeToast('يرجى اختيار ملف بصيغة JSON أو Excel (.xlsx / .xls)');
                input.value = '';
                return;
            }

            const reader = new FileReader();

            if (isJson) {
                reader.onload = function(e) {
                    try {
                        const parsed = JSON.parse(e.target.result);
                        const items = Array.isArray(parsed) ? parsed : (parsed.library || parsed.resources || []);
                        if (!Array.isArray(items) || items.length === 0) {
                            window.notifySafeToast('لم يتم العثور على قائمة موارد صالحة في ملف JSON.');
                            return;
                        }
                        let addedCount = 0;
                        if (!db.library) db.library = [];
                        items.forEach(item => {
                            if (item.title) {
                                db.library.push({
                                    id: item.id || (Date.now() + Math.random()).toString(),
                                    title: item.title,
                                    url: item.url || '',
                                    type: item.type || 'doc',
                                    topic: item.topic || '',
                                    isLocalFile: !!item.isLocalFile,
                                    fileName: item.fileName || '',
                                    fileSize: item.fileSize || '',
                                    dateAdded: item.dateAdded || (window.formatLocalDate ? window.formatLocalDate() : new Date().toLocaleDateString('en-CA'))
                                });
                                addedCount++;
                            }
                        });
                        saveDB();
                        renderLibrary();
                        window.notifySafeToast(`تم استيراد ${addedCount} مورد تعليمي بنجاح من ملف JSON.`);
                    } catch(err) {
                        window.notifySafeToast('حدث خطأ أثناء قراءة ملف JSON: ' + err.message);
                    } finally {
                        input.value = '';
                    }
                };
                reader.readAsText(file);
            } else if (isExcel) {
                reader.onload = async function(e) {
                    try {
                        if (typeof XLSX === 'undefined' && typeof window.ensureXlsxLoaded === 'function') {
                            await window.ensureXlsxLoaded();
                        }
                        if (typeof XLSX === 'undefined') {
                            window.notifySafeToast('مكتبة معالجة Excel غير متوفرة حالياً.');
                            return;
                        }
                        const data = new Uint8Array(e.target.result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        const firstSheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[firstSheetName];
                        const rows = XLSX.utils.sheet_to_json(worksheet);

                        if (!rows || rows.length === 0) {
                            window.notifySafeToast('ورقة Excel فارغة.');
                            return;
                        }

                        let addedCount = 0;
                        if (!db.library) db.library = [];

                        rows.forEach(row => {
                            const title = row['العنوان'] || row['عنوان المورد'] || row['Title'] || row['title'] || row['اسم المورد'];
                            const url = row['الرابط'] || row['رابط المورد'] || row['URL'] || row['url'] || row['Link'] || '';
                            const topic = row['المحور'] || row['الدرس'] || row['Topic'] || row['topic'] || '';
                            const typeRaw = (row['النوع'] || row['نوع المورد'] || row['Type'] || row['type'] || 'doc').toString().toLowerCase();

                            let type = 'doc';
                            if (typeRaw.includes('فيديو') || typeRaw.includes('video')) type = 'video';
                            else if (typeRaw.includes('رابط') || typeRaw.includes('link')) type = 'link';
                            else if (typeRaw.includes('أخرى') || typeRaw.includes('other')) type = 'other';

                            if (title) {
                                db.library.push({
                                    id: (Date.now() + Math.random()).toString(),
                                    title: title.toString().trim(),
                                    url: url.toString().trim(),
                                    type: type,
                                    topic: topic.toString().trim(),
                                    isLocalFile: false,
                                    dateAdded: window.formatLocalDate ? window.formatLocalDate() : new Date().toLocaleDateString('en-CA')
                                });
                                addedCount++;
                            }
                        });

                        saveDB();
                        renderLibrary();
                        window.notifySafeToast(`تم استيراد ${addedCount} مورد تعليمي بنجاح من جدول Excel.`);
                    } catch(err) {
                        window.notifySafeToast('حدث خطأ أثناء قراءة ملف Excel: ' + err.message);
                    } finally {
                        input.value = '';
                    }
                };
                reader.readAsArrayBuffer(file);
            }
        }

        // ============================================
        // AI Smart Library Resource Classification Logic
        // ============================================
        var _aiSuggestDebounceTimer = null;
        function debounceAiSuggest(mode) {
            clearTimeout(_aiSuggestDebounceTimer);
            _aiSuggestDebounceTimer = setTimeout(() => {
                const inputId = mode === 'url' ? 'libUrlTitle' : 'libTitle';
                const input = document.getElementById(inputId);
                if (input && input.value.trim().length >= 4) {
                    requestAiResourceClassification(mode, false);
                }
            }, 650);
        }

        async function requestAiResourceClassification(mode, forceManual) {
            const titleInput = document.getElementById(mode === 'url' ? 'libUrlTitle' : 'libTitle');
            const suggBox = document.getElementById(mode === 'url' ? 'libAiUrlSuggestionBox' : 'libAiLocalSuggestionBox');
            const btn = document.getElementById(mode === 'url' ? 'btnAiSuggestUrl' : 'btnAiSuggestLocal');

            if (!titleInput || !suggBox) return;

            const title = titleInput.value.trim();
            const fileName = (mode === 'local' && currentSelectedLibFile) ? currentSelectedLibFile.name : '';
            const url = (mode === 'url') ? (document.getElementById('libUrl')?.value || '') : '';

            if (!title && !fileName) {
                if (forceManual) {
                    window.notifySafeToast('يرجى كتابة عنوان المورد أو اختيار ملف أولاً ليتمكن الذكاء الاصطناعي من تحليله واقتراح المحور المناسب.');
                }
                return;
            }

            suggBox.style.display = 'block';
            suggBox.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px; color: #7c3aed; font-weight: 600;">
                    <span class="ui-icon" style="animation: spin 1.2s linear infinite; display: inline-flex;"><span data-lucide="loader-2" data-size="16"></span></span>
                    <span>جاري تحليل عنوان الملف واقتراح المحور والدرس بالذكاء الاصطناعي...</span>
                </div>
            `;
            if (window.lucide) lucide.createIcons();

            if (btn) {
                btn.disabled = true;
                btn.style.opacity = '0.7';
            }

            try {
                const existingTopics = Array.from(new Set((db.library || []).map(i => i.topic).filter(t => t && t.trim() !== '')));
                const teacherSubject = (db.teacher && db.teacher.subject) || '';

                const response = await fetch('/api/library/suggest-classification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: title || fileName,
                        fileName: fileName,
                        url: url,
                        existingTopics: existingTopics,
                        teacherSubject: teacherSubject
                    })
                });

                if (!response.ok) {
                    throw new Error(`تعذر التحليل (${response.status})`);
                }

                const data = await response.json();
                const res = data.result;

                if (!res || !res.suggestedTopic) {
                    suggBox.innerHTML = `
                        <div style="color: #64748b; font-size: 0.8rem;">لم يتم التوصل إلى اقتراح محدد لهذا العنوان. يمكنك كتابة المحور يدوياً.</div>
                    `;
                    return;
                }

                let altChipsHtml = '';
                if (Array.isArray(res.alternativeTopics) && res.alternativeTopics.length > 0) {
                    altChipsHtml = `
                        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 6px;">
                            <span style="font-size: 0.74rem; color: #6d28d9; font-weight: 700;">محاور بديلة:</span>
                            ${res.alternativeTopics.map(alt => `
                                <button type="button" onclick="applyAiSuggestion('${mode}', '${alt.replace(/'/g, "\\'")}', '', '')" style="background: #ffffff; border: 1px solid #c4b5fd; color: #6d28d9; border-radius: 20px; padding: 2px 10px; font-size: 0.75rem; cursor: pointer; transition: all 0.15s; font-weight: 600;" onmouseover="this.style.background='#f3e8ff'" onmouseout="this.style.background='#ffffff'">
                                    ${alt}
                                </button>
                            `).join('')}
                        </div>
                    `;
                }

                suggBox.innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
                            <div style="display: flex; align-items: center; gap: 6px; color: #5b21b6; font-weight: 800; font-size: 0.88rem; flex-wrap: wrap;">
                                <span style="color: #7c3aed; font-size: 1rem;">✨</span>
                                <span>المحور المقترح:</span>
                                <button type="button" onclick="applyAiSuggestion('${mode}', '${res.suggestedTopic.replace(/'/g, "\\'")}', '', '')" style="background: #ede9fe; color: #6d28d9; padding: 3px 10px; border-radius: 6px; border: 1px solid #c4b5fd; font-size: 0.86rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="انقر لتطبيق هذا المحور">
                                    <span>${res.suggestedTopic}</span>
                                    <span style="font-size: 0.72rem; color: #7c3aed;">(تطبيق)</span>
                                </button>
                                ${res.confidence === 'high' ? '<span style="font-size: 0.7rem; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; border-radius: 4px; padding: 1px 6px; font-weight: 700;">دقة عالية</span>' : ''}
                            </div>
                            <div style="display: flex; gap: 6px; align-items: center;">
                                <button type="button" onclick="applyAiSuggestion('${mode}', '${res.suggestedTopic.replace(/'/g, "\\'")}', '${(res.suggestedLevel || '').replace(/'/g, "\\'")}', '${(res.suggestedType || '').replace(/'/g, "\\'")}', true)" style="background: linear-gradient(135deg, #7c3aed, #6d28d9); color: white; border: none; border-radius: 6px; padding: 4px 12px; font-size: 0.78rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 4px rgba(124, 58, 237, 0.2);">
                                    <span>تطبيق الكل</span>
                                </button>
                                <button type="button" onclick="dismissAiSuggestion('${mode}')" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 1.1rem; line-height: 1; padding: 2px;" title="إخفاء">&times;</button>
                            </div>
                        </div>

                        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center; font-size: 0.78rem; color: #475569; margin-top: 2px;">
                            ${res.suggestedLevel && res.suggestedLevel !== 'عام' ? `
                                <span>المستوى: <strong style="color: #be185d;">${res.suggestedLevel}</strong></span>
                            ` : ''}
                            ${res.suggestedType ? `
                                <span>النوع: <strong>${res.suggestedType === 'doc' ? 'مستند/PDF' : (res.suggestedType === 'video' ? 'فيديو' : res.suggestedType)}</strong></span>
                            ` : ''}
                            ${res.reasoning ? `
                                <span style="color: #64748b;">— ${res.reasoning}</span>
                            ` : ''}
                        </div>

                        ${altChipsHtml}
                    </div>
                `;
                if (window.lucide) lucide.createIcons();

            } catch (err) {
                console.error('Error in requestAiResourceClassification:', err);
                suggBox.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; color: #b91c1c; font-size: 0.8rem;">
                        <span>تعذر إتمام الاقتراح الذكي حالياً: ${err.message}</span>
                        <button type="button" onclick="dismissAiSuggestion('${mode}')" style="background: none; border: none; color: #94a3b8; cursor: pointer;">&times;</button>
                    </div>
                `;
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                }
            }
        }

        function applyAiSuggestion(mode, topic, level, type, applyAll) {
            const topicInput = document.getElementById(mode === 'url' ? 'libUrlTopic' : 'libTopic');
            const levelSelect = document.getElementById(mode === 'url' ? 'libUrlLevel' : 'libLevel');
            const typeSelect = document.getElementById(mode === 'url' ? 'libUrlType' : 'libType');
            const suggBox = document.getElementById(mode === 'url' ? 'libAiUrlSuggestionBox' : 'libAiLocalSuggestionBox');

            if (topic && topicInput) {
                topicInput.value = topic;
                topicInput.style.transition = 'all 0.3s ease';
                topicInput.style.backgroundColor = '#ede9fe';
                setTimeout(() => { topicInput.style.backgroundColor = ''; }, 900);
            }

            if (applyAll) {
                if (level && levelSelect) {
                    for (let opt of levelSelect.options) {
                        if (opt.value === level || opt.text === level) {
                            levelSelect.value = opt.value;
                            break;
                        }
                    }
                }
                if (type && typeSelect) {
                    for (let opt of typeSelect.options) {
                        if (opt.value === type) {
                            typeSelect.value = type;
                            break;
                        }
                    }
                }
            }

            if (suggBox) {
                suggBox.innerHTML = `
                    <div style="color: #059669; font-weight: 700; display: flex; align-items: center; gap: 6px; font-size: 0.84rem;">
                        <span>✓</span>
                        <span>تم اعتماد وتطبيق الاقتراح: "${topic}"</span>
                    </div>
                `;
                setTimeout(() => {
                    suggBox.style.display = 'none';
                    suggBox.innerHTML = '';
                }, 1800);
            }
        }

        function dismissAiSuggestion(mode) {
            const suggBox = document.getElementById(mode === 'url' ? 'libAiUrlSuggestionBox' : 'libAiLocalSuggestionBox');
            if (suggBox) {
                suggBox.style.display = 'none';
                suggBox.innerHTML = '';
            }
        }

        async function aiClassifySingleResource(itemId) {
            if (!db.library) return;
            const item = db.library.find(i => i.id === itemId);
            if (!item) return;

            const existingTopics = Array.from(new Set(db.library.map(i => i.topic).filter(t => t && t.trim() !== '')));
            const teacherSubject = (db.teacher && db.teacher.subject) || '';

            const confirmRun = typeof window.showConfirmDialog === 'function'
                ? await window.showConfirmDialog(`هل ترغب في تحليل المورد:\n"${item.title}"\nواقتراح المحور أو الدرس والمستوى تلقائياً بالذكاء الاصطناعي؟`)
                : true;
            if (!confirmRun) return;

            try {
                const response = await fetch('/api/library/suggest-classification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: item.title,
                        fileName: item.fileName || '',
                        url: item.url || '',
                        existingTopics: existingTopics,
                        teacherSubject: teacherSubject
                    })
                });

                if (!response.ok) throw new Error('تعذر الاتصال بخدمة التحليل الذكي');

                const data = await response.json();
                const res = data.result;

                if (!res || !res.suggestedTopic) {
                    window.notifySafeToast('لم يتم التوصل إلى اقتراح مناسب لهذا المورد.');
                    return;
                }

                const applySuggestedTopic = (userTopic) => {
                    if (userTopic !== null && userTopic !== undefined && String(userTopic).trim() !== '') {
                        item.topic = String(userTopic).trim();
                        if (res.suggestedLevel && res.suggestedLevel !== 'عام' && (!item.level || item.level === 'عام')) {
                            item.level = res.suggestedLevel;
                        }
                        saveDB();
                        renderLibrary();
                        window.notifySafeToast(`✓ تم تحديث تصنيف المورد بنجاح: "${item.topic}"`);
                    }
                };
                const msg = `✨ نتيجة التحليل الذكي للمورد:\n"${item.title}"\n\nالمحور المقترح: ${res.suggestedTopic}\nالمستوى المقترح: ${res.suggestedLevel || 'عام'}\n\nيمكنك تأكيد المحور أو كتابة محور بديل:`;
                if (typeof window.showInputDialog === 'function') {
                    window.showInputDialog(msg, res.suggestedTopic, applySuggestedTopic, { title: 'تأكيد التصنيف الذكي للمورد' });
                } else {
                    applySuggestedTopic(res.suggestedTopic);
                }
            } catch (err) {
                console.error(err);
                window.notifySafeToast('حدث خطأ أثناء التصنيف الذكي: ' + err.message);
            }
        }

        // ============================================
        // Batch AI Classification Modal Logic
        // ============================================
        var _batchAiResults = {};

        function openBatchAiClassificationModal() {
            const modal = document.getElementById('batchAiClassificationModal');
            if (!modal) return;
            modal.style.display = 'flex';
            _batchAiResults = {};
            updateBatchAiItemsList();
            if (window.lucide) lucide.createIcons();
        }

        function closeBatchAiClassificationModal() {
            const modal = document.getElementById('batchAiClassificationModal');
            if (modal) modal.style.display = 'none';
        }

        function getFilteredBatchAiItems() {
            if (!db.library) db.library = [];
            const scope = document.getElementById('batchAiScope')?.value || 'unclassified';
            let items = [];

            if (scope === 'unclassified') {
                items = db.library.filter(i => !i.topic || i.topic.trim() === '');
            } else if (scope === 'drive') {
                items = db.library.filter(i => !!i.isDriveFile);
            } else if (scope === 'local') {
                items = db.library.filter(i => !!i.isLocalFile);
            } else {
                items = [...db.library];
            }
            return items;
        }

        function updateBatchAiItemsList() {
            const tbody = document.getElementById('batchAiItemsTbody');
            const summary = document.getElementById('batchAiSelectionSummary');
            const btnApply = document.getElementById('btnApplyBatchAiClassifications');
            const statusBox = document.getElementById('batchAiStatusBox');
            if (!tbody) return;

            if (statusBox) statusBox.style.display = 'none';
            if (btnApply) {
                btnApply.disabled = true;
                btnApply.style.opacity = '0.5';
            }

            const items = getFilteredBatchAiItems();

            if (items.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 30px; color: #64748b;">
                            لا توجد موارد تطابق هذا النطاق حالياً.
                        </td>
                    </tr>
                `;
                if (summary) summary.textContent = 'لا توجد عناصر للمعالجة';
                return;
            }

            let html = '';
            items.forEach((item) => {
                const res = _batchAiResults[item.id];
                const currentTopic = item.topic || '';
                const suggestedTopic = res ? res.suggestedTopic : '';
                const suggestedLevel = res ? res.suggestedLevel : (item.level || 'عام');

                html += `
                    <tr style="border-bottom: 1px solid #f1f5f9;" id="batch_ai_row_${item.id}">
                        <td style="padding: 10px; text-align: center;">
                            <input type="checkbox" class="batch-ai-checkbox" data-id="${item.id}" checked onchange="updateBatchAiSelectionSummary()">
                        </td>
                        <td style="padding: 10px;">
                            <div style="font-weight: 700; color: #1e293b; font-size: 0.86rem; word-break: break-word;">${item.title}</div>
                            <div style="font-size: 0.74rem; color: #64748b; margin-top: 2px;">
                                ${item.fileName ? `ملف: ${item.fileName} | ` : ''}
                                ${item.topic ? `المحور الحالي: <span style="color: #475569;">${item.topic}</span>` : '<span style="color: #dc2626; font-weight: 600;">(بدون محور)</span>'}
                            </div>
                        </td>
                        <td style="padding: 10px;">
                            <input type="text" id="batch_ai_topic_${item.id}" value="${suggestedTopic || currentTopic}" placeholder="المحور المقترح بالذكاء الاصطناعي..." style="width: 100%; padding: 5px 8px; border-radius: 6px; border: 1px solid ${res ? '#a855f7' : '#cbd5e1'}; font-size: 0.82rem; background: ${res ? '#faf5ff' : '#ffffff'}; font-weight: 600;">
                        </td>
                        <td style="padding: 10px;">
                            <select id="batch_ai_level_${item.id}" style="width: 100%; padding: 5px 6px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 0.8rem; background: #fff;">
                                <option value="عام" ${suggestedLevel === 'عام' ? 'selected' : ''}>عام / مشترك</option>
                                <option value="الجذع المشترك العلمي" ${suggestedLevel === 'الجذع المشترك العلمي' ? 'selected' : ''}>الجذع المشترك العلمي والتكنولوجي</option>
                                <option value="الجذع المشترك للآداب" ${suggestedLevel === 'الجذع المشترك للآداب' ? 'selected' : ''}>الجذع المشترك للآداب والعلوم الإنسانية</option>
                                <option value="الأولى باك علوم رياضية" ${suggestedLevel === 'الأولى باك علوم رياضية' ? 'selected' : ''}>الأولى باك علوم رياضية (SM)</option>
                                <option value="الأولى باك علوم تجريبية" ${suggestedLevel === 'الأولى باك علوم تجريبية' ? 'selected' : ''}>الأولى باك علوم تجريبية وتكنولوجيات</option>
                                <option value="الأولى باك آداب واقتصاد" ${suggestedLevel === 'الأولى باك آداب واقتصاد' ? 'selected' : ''}>الأولى باك آداب / اقتصاد</option>
                                <option value="الثانية باك علوم رياضية" ${suggestedLevel === 'الثانية باك علوم رياضية' ? 'selected' : ''}>الثانية باك علوم رياضية (SM-A / SM-B)</option>
                                <option value="الثانية باك علوم تجريبية" ${suggestedLevel === 'الثانية باك علوم تجريبية' ? 'selected' : ''}>الثانية باك علوم تجريبية (PC / SVT)</option>
                                <option value="الثانية باك علوم اقتصادية وتدبير" ${suggestedLevel === 'الثانية باك علوم اقتصادية وتدبير' ? 'selected' : ''}>الثانية باك علوم اقتصادية وتدبير</option>
                            </select>
                        </td>
                        <td style="padding: 10px;">
                            <span style="font-size: 0.76rem; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: #475569;">
                                ${item.type === 'doc' ? 'وثيقة/PDF' : (item.type === 'video' ? 'فيديو' : (item.type === 'link' ? 'رابط' : 'أخرى'))}
                            </span>
                        </td>
                        <td style="padding: 10px; text-align: center;" id="batch_ai_status_${item.id}">
                            ${res ? '<span style="color: #059669; font-weight: 700; font-size: 0.78rem;">✓ تم الاقتراح</span>' : '<span style="color: #94a3b8; font-size: 0.76rem;">معلق</span>'}
                        </td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;
            updateBatchAiSelectionSummary();
        }

        function toggleBatchAiSelectAll(checked) {
            const checkboxes = document.querySelectorAll('.batch-ai-checkbox');
            checkboxes.forEach(cb => cb.checked = checked);
            updateBatchAiSelectionSummary();
        }

        function updateBatchAiSelectionSummary() {
            const checkboxes = document.querySelectorAll('.batch-ai-checkbox');
            const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
            const summary = document.getElementById('batchAiSelectionSummary');
            if (summary) {
                summary.textContent = `تم تحديد ${checkedCount} من أصل ${checkboxes.length} مورد`;
            }
        }

        async function startBatchAiAnalysis() {
            const checkboxes = document.querySelectorAll('.batch-ai-checkbox:checked');
            const selectedIds = Array.from(checkboxes).map(cb => cb.getAttribute('data-id'));

            if (selectedIds.length === 0) {
                window.notifySafeToast('يرجى تحديد مورد واحد على الأقل من الجدول لبدء التحليل والتصنيف.');
                return;
            }

            const itemsToAnalyze = db.library.filter(i => selectedIds.includes(i.id));
            const statusBox = document.getElementById('batchAiStatusBox');
            const btnStart = document.getElementById('btnStartBatchAiAnalysis');
            const btnApply = document.getElementById('btnApplyBatchAiClassifications');

            if (statusBox) {
                statusBox.style.display = 'flex';
                statusBox.style.background = '#faf5ff';
                statusBox.style.border = '1px solid #d8b4fe';
                statusBox.style.color = '#6d28d9';
                statusBox.innerHTML = `
                    <span class="ui-icon" style="animation: spin 1.2s linear infinite; display: inline-flex;"><span data-lucide="loader-2" data-size="16"></span></span>
                    <span>جاري تحليل ${itemsToAnalyze.length} مورد بالذكاء الاصطناعي واقتراح المحاور والدروس...</span>
                `;
                if (window.lucide) lucide.createIcons();
            }

            if (btnStart) {
                btnStart.disabled = true;
                btnStart.style.opacity = '0.6';
            }

            const existingTopics = Array.from(new Set(db.library.map(i => i.topic).filter(t => t && t.trim() !== '')));
            const teacherSubject = (db.teacher && db.teacher.subject) || '';

            // Chunk in batches of 15
            const chunkSize = 15;
            let successCount = 0;

            for (let i = 0; i < itemsToAnalyze.length; i += chunkSize) {
                const chunk = itemsToAnalyze.slice(i, i + chunkSize);
                try {
                    const response = await fetch('/api/library/suggest-classification', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            items: chunk.map(c => ({
                                id: c.id,
                                title: c.title,
                                fileName: c.fileName || '',
                                url: c.url || ''
                            })),
                            existingTopics: existingTopics,
                            teacherSubject: teacherSubject
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const results = data.results || [];
                        results.forEach(res => {
                            if (res && res.id) {
                                _batchAiResults[res.id] = res;
                                successCount++;

                                // Update row UI
                                const topicInput = document.getElementById(`batch_ai_topic_${res.id}`);
                                const levelSelect = document.getElementById(`batch_ai_level_${res.id}`);
                                const statusCell = document.getElementById(`batch_ai_status_${res.id}`);

                                if (topicInput && res.suggestedTopic) {
                                    topicInput.value = res.suggestedTopic;
                                    topicInput.style.background = '#f5f3ff';
                                    topicInput.style.borderColor = '#8b5cf6';
                                }

                                if (levelSelect && res.suggestedLevel && res.suggestedLevel !== 'عام') {
                                    for (let opt of levelSelect.options) {
                                        if (opt.value === res.suggestedLevel) {
                                            levelSelect.value = res.suggestedLevel;
                                            break;
                                        }
                                    }
                                }

                                if (statusCell) {
                                    statusCell.innerHTML = `<span style="color: #059669; font-weight: 700; font-size: 0.78rem;">✨ تم الاقتراح</span>`;
                                }
                            }
                        });
                    }
                } catch (err) {
                    console.error('Error analyzing chunk:', err);
                }
            }

            if (statusBox) {
                statusBox.style.background = '#ecfdf5';
                statusBox.style.border = '1px solid #a7f3d0';
                statusBox.style.color = '#047857';
                statusBox.innerHTML = `
                    <span>✓ تم بنجاح تحليل واقتراح التصنيفات لـ ${successCount} مورد! يمكنك مراجعة وتعديل أي اقتراح أدناه ثم الضغط على "اعتماد وحفظ التصنيفات".</span>
                `;
            }

            if (btnStart) {
                btnStart.disabled = false;
                btnStart.style.opacity = '1';
            }

            if (btnApply) {
                btnApply.disabled = false;
                btnApply.style.opacity = '1';
            }
        }

        function applyBatchAiClassifications() {
            const checkboxes = document.querySelectorAll('.batch-ai-checkbox:checked');
            let updatedCount = 0;

            checkboxes.forEach(cb => {
                const id = cb.getAttribute('data-id');
                const item = db.library.find(i => i.id === id);
                if (!item) return;

                const topicInput = document.getElementById(`batch_ai_topic_${id}`);
                const levelSelect = document.getElementById(`batch_ai_level_${id}`);

                if (topicInput && topicInput.value.trim()) {
                    item.topic = topicInput.value.trim();
                    updatedCount++;
                }

                if (levelSelect && levelSelect.value) {
                    item.level = levelSelect.value;
                }
            });

            if (updatedCount > 0) {
                saveDB();
                renderLibrary();
                closeBatchAiClassificationModal();
                window.notifySafeToast(`✓ تم بنجاح اعتماد وتطبيق التصنيف الذكي لـ ${updatedCount} مورد في المكتبة!`);
            } else {
                window.notifySafeToast('لم يتم تحديد أي تصنيفات لحفظها.');
            }
        }

        // Calendar Logic
        var currentMonth = new Date().getMonth();
        var currentYear = new Date().getFullYear();

        // ============================================
        // Private Tutoring Logic
        // ============================================
        function initTutoring() {
            if (!db.tutoring) db.tutoring = { students: [] };
            const today = new Date();
            const currentMonth = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
            const monthInput = document.getElementById('tutoringMonth');
            if (monthInput && !monthInput.value) monthInput.value = currentMonth;

            try {
                const savedMode = localStorage.getItem('tutoring_display_mode');
                if (savedMode && savedMode !== currentTutoringDisplayMode) {
                    setTutoringDisplayMode(savedMode);
                }
            } catch(e) {}
        }

        // Helper functions for Tutoring View mode and sorting
        var currentTutoringDisplayMode = 'auto';

        function setTutoringDisplayMode(mode) {
            currentTutoringDisplayMode = mode;
            const view = document.getElementById('tutoringView');
            const btnAuto = document.getElementById('tutoringViewBtnAuto');
            const btnCards = document.getElementById('tutoringViewBtnCards');
            const btnTable = document.getElementById('tutoringViewBtnTable');
            if (!view) return;

            view.classList.remove('tutoring-force-cards', 'tutoring-force-table');

            [btnAuto, btnCards, btnTable].forEach(b => {
                if (b) {
                    b.style.background = 'transparent';
                    b.style.color = '#64748b';
                    b.style.boxShadow = 'none';
                }
            });

            if (mode === 'cards') {
                view.classList.add('tutoring-force-cards');
                if (btnCards) {
                    btnCards.style.background = '#fff';
                    btnCards.style.color = '#0f172a';
                    btnCards.style.boxShadow = '0 1px 2px rgba(0,0,0,0.06)';
                }
            } else if (mode === 'table') {
                view.classList.add('tutoring-force-table');
                if (btnTable) {
                    btnTable.style.background = '#fff';
                    btnTable.style.color = '#0f172a';
                    btnTable.style.boxShadow = '0 1px 2px rgba(0,0,0,0.06)';
                }
            } else {
                if (btnAuto) {
                    btnAuto.style.background = '#fff';
                    btnAuto.style.color = '#0f172a';
                    btnAuto.style.boxShadow = '0 1px 2px rgba(0,0,0,0.06)';
                }
            }
            try {
                localStorage.setItem('tutoring_display_mode', mode);
            } catch(e) {}
            if (window.renderLucide) window.renderLucide();
            setTimeout(() => { if (window.renderLucide) window.renderLucide(); }, 50);
        }

        function setTutoringPaymentFilter(val) {
            const sel = document.getElementById('tutoringPaymentFilter');
            if (sel) {
                sel.value = val;
            }
            renderTutoringStudents();
        }

        function toggleTutoringSort(type) {
            const sel = document.getElementById('tutoringSortFilter');
            if (!sel) return;
            const current = sel.value;
            if (type === 'remaining') {
                sel.value = (current === 'remaining_desc') ? 'unpaid_first' : 'remaining_desc';
            } else if (type === 'progress') {
                sel.value = (current === 'progress_asc') ? 'progress_desc' : 'progress_asc';
            } else if (type === 'status') {
                sel.value = (current === 'unpaid_first') ? 'paid_first' : 'unpaid_first';
            } else if (type === 'name') {
                sel.value = (current === 'name_asc') ? 'name_desc' : 'name_asc';
            } else if (type === 'amount') {
                sel.value = (current === 'amount_desc') ? 'amount_asc' : 'amount_desc';
            } else if (type === 'hours') {
                sel.value = (current === 'hours_desc') ? 'name_asc' : 'hours_desc';
            }
            renderTutoringStudents();
        }

        window.getStudentActiveMonthsSet = function(std, fallbackMonth) {
            const months = new Set();
            if (!std) return months;
            (std.sessions || []).forEach(s => {
                if (s && s.date && typeof s.date === 'string' && s.date.length >= 7) {
                    months.add(s.date.slice(0, 7));
                }
            });
            if (std.payments && typeof std.payments === 'object' && !Array.isArray(std.payments)) {
                Object.keys(std.payments).forEach(m => {
                    if (/^\d{4}-\d{2}$/.test(m)) months.add(m);
                });
            }
            if (std.paymentRecords && typeof std.paymentRecords === 'object' && !Array.isArray(std.paymentRecords)) {
                Object.keys(std.paymentRecords).forEach(m => {
                    if (/^\d{4}-\d{2}$/.test(m)) months.add(m);
                });
            }
            if (Array.isArray(std.paidMonths)) {
                std.paidMonths.forEach(m => {
                    if (typeof m === 'string' && /^\d{4}-\d{2}$/.test(m)) months.add(m);
                });
            } else if (std.paidMonths && typeof std.paidMonths === 'object') {
                Object.keys(std.paidMonths).forEach(m => {
                    if (std.paidMonths[m] && /^\d{4}-\d{2}$/.test(m)) months.add(m);
                });
            }
            if (Array.isArray(std.paymentHistory)) {
                std.paymentHistory.forEach(p => {
                    if (p && p.month && /^\d{4}-\d{2}$/.test(p.month)) months.add(p.month);
                });
            }
            if (months.size === 0 && (std.billingMode === 'monthly_fixed' || std.billingType === 'monthly_fixed') && fallbackMonth && /^\d{4}-\d{2}$/.test(fallbackMonth)) {
                months.add(fallbackMonth);
            }
            return months;
        };

        window.getStudentPackStatus = function(std, refMonth) {
            if (!std || (std.billingMode || std.billingType) !== 'session_pack') return null;
            const packSize = Math.max(1, parseInt(std.packSessions, 10) || 4);
            const packPrice = parseFloat(std.packPrice) || ((parseFloat(std.fee) || 0) * packSize);
            const targetMonth = refMonth || (document.getElementById('tutoringMonth') ? document.getElementById('tutoringMonth').value : (window.formatLocalMonth ? window.formatLocalMonth() : new Date().toISOString().slice(0, 7)));
            const cutoffEnd = targetMonth ? (targetMonth + '-31') : '9999-12-31';
            const cutoffPrev = targetMonth ? (targetMonth + '-01') : '0000-01-01';
            const startDate = (std.packStartDate && /^\d{4}-\d{2}-\d{2}$/.test(std.packStartDate)) ? std.packStartDate : '';
            const archivedSet = new Set(Array.isArray(std.packArchivedIds) ? std.packArchivedIds : []);

            const allValidSessions = (std.sessions || [])
                .filter(s => s && s.date && s.attendance !== 'absent' && !archivedSet.has(s.id) && (!startDate || s.date >= startDate))
                .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''));

            const upToMonth = allValidSessions.filter(s => s.date <= cutoffEnd);
            const beforeMonth = allValidSessions.filter(s => s.date < cutoffPrev);

            const cumAttended = upToMonth.length;
            const prevAttended = beforeMonth.length;
            const cumCycles = cumAttended > 0 ? Math.ceil(cumAttended / packSize) : 0;
            const prevCycles = prevAttended > 0 ? Math.ceil(prevAttended / packSize) : 0;
            const cyclesStartedInMonth = Math.max(0, cumCycles - prevCycles);

            const usedInCurrentPack = cumAttended === 0 ? 0 : (((cumAttended - 1) % packSize) + 1);
            const remaining = cumAttended === 0 ? packSize : Math.max(0, packSize - usedInCurrentPack);
            const currentCycle = Math.max(1, cumCycles || 1);

            return {
                packSize,
                packPrice,
                startDate,
                cumAttended,
                usedInCurrentPack,
                remaining,
                currentCycle,
                cyclesStartedInMonth,
                isLow: remaining <= 1,
                isDepleted: cumAttended > 0 && remaining === 0
            };
        };

        window.renewStudentSessionPack = function(studentId, openPaymentAfter = false) {
            if (!db || !db.tutoring || !Array.isArray(db.tutoring.students)) return;
            const std = db.tutoring.students.find(s => s.id === studentId);
            if (!std) return;
            const todayStr = window.formatLocalDate ? window.formatLocalDate() : new Date().toISOString().slice(0, 10);
            const archived = new Set(Array.isArray(std.packArchivedIds) ? std.packArchivedIds : []);
            (std.sessions || []).forEach(s => {
                if (s && s.id && s.date && s.date <= todayStr) {
                    archived.add(s.id);
                }
            });
            std.packArchivedIds = Array.from(archived);
            std.packStartDate = todayStr;
            std.packRenewedAt = new Date().toISOString();
            if (typeof saveDB === 'function') saveDB();
            if (typeof renderTutoringStudents === 'function') renderTutoringStudents();
            const profileModal = document.getElementById('tutoringStudentProfileModal');
            if (profileModal && profileModal.style.display !== 'none' && window.currentViewingStudentId === studentId && typeof window.openTutoringStudentProfileModal === 'function') {
                window.openTutoringStudentProfileModal(studentId);
            }
            if (typeof window.notifySafeToast === 'function') {
                window.notifySafeToast(`📦 تم تجديد باقة الحصص للتلميذ(ة) ${std.name} (${std.packSessions || 4} حصص جديدة اعتباراً من ${todayStr})`);
            }
            if (openPaymentAfter && typeof window.openTutoringPaymentModal === 'function') {
                const curMonth = (document.getElementById('tutoringMonth') && document.getElementById('tutoringMonth').value) || todayStr.slice(0, 7);
                window.openTutoringPaymentModal(studentId, curMonth);
            }
        };

        window.computeTutoringStudentMonthDue = function(std, month) {
            if (!std || !month) return 0;
            const sessions = (std.sessions || []).filter(s => s && s.date && s.date.startsWith(month) && s.attendance !== 'absent');
            const monthHours = sessions.reduce((sum, s) => sum + (parseFloat(s.hours) || 0), 0);
            const attendedSessionsCount = sessions.length;

            const mode = std.billingMode || std.billingType || 'hourly';
            const discountPercent = Math.min(100, Math.max(0, parseFloat(std.discountPercent) || 0));
            const flatDiscount = Math.max(0, parseFloat(std.discount) || 0);

            let hasPayRecord = false;
            if (std.payments && !Array.isArray(std.payments) && std.payments[month]) hasPayRecord = true;
            if (std.paymentRecords && std.paymentRecords[month]) hasPayRecord = true;
            if (Array.isArray(std.paidMonths) && std.paidMonths.includes(month)) hasPayRecord = true;
            if (std.paidMonths && !Array.isArray(std.paidMonths) && std.paidMonths[month]) hasPayRecord = true;

            let baseDue = 0;
            if (mode === 'monthly_fixed') {
                baseDue = parseFloat(std.monthlyFixedFee) || parseFloat(std.fee) || 0;
            } else if (mode === 'session_pack') {
                const packSize = Math.max(1, parseInt(std.packSessions, 10) || 4);
                const basePack = parseFloat(std.packPrice) || ((parseFloat(std.fee) || 0) * packSize);
                const packStatus = window.getStudentPackStatus(std, month);
                const startDate = (std.packStartDate && /^\d{4}-\d{2}-\d{2}$/.test(std.packStartDate)) ? std.packStartDate : '';
                if (startDate && (month + '-31') < startDate) {
                    const historicalPacks = attendedSessionsCount > 0 ? Math.ceil(attendedSessionsCount / packSize) : (hasPayRecord ? 1 : 0);
                    baseDue = basePack * historicalPacks;
                } else if (packStatus) {
                    const packsCount = packStatus.cyclesStartedInMonth > 0
                        ? packStatus.cyclesStartedInMonth
                        : (hasPayRecord && packStatus.cumAttended === 0 ? 1 : 0);
                    baseDue = basePack * packsCount;
                } else {
                    const packsCount = attendedSessionsCount > 0 ? Math.ceil(attendedSessionsCount / packSize) : (hasPayRecord ? 1 : 0);
                    baseDue = basePack * packsCount;
                }
            } else {
                baseDue = monthHours * (parseFloat(std.fee) || 0);
            }

            const afterPercent = baseDue * (1 - discountPercent / 100);
            const finalDue = Math.max(0, Math.round((afterPercent - flatDiscount) * 100) / 100);
            return finalDue;
        };

        window.getTutoringPaymentInfo = function(std, month, explicitTotalDue) {
            if (!std) {
                return {
                    totalDue: 0, effectiveDue: 0, paidAmount: 0, paid: 0, remaining: 0,
                    progressPercent: 0, status: 'unpaid', isPaid: false, isPartial: false, isUnpaid: true,
                    history: [], installments: [], note: '', billingMode: 'hourly', discountPercent: 0,
                    attendedSessionsCount: 0, monthHours: 0
                };
            }

            const sessions = (std.sessions || []).filter(s => s && s.date && month && s.date.startsWith(month) && s.attendance !== 'absent');
            const monthHours = sessions.reduce((sum, s) => sum + (parseFloat(s.hours) || 0), 0);
            const attendedSessionsCount = sessions.length;
            const mode = std.billingMode || std.billingType || 'hourly';
            const discountPercent = Math.min(100, Math.max(0, parseFloat(std.discountPercent) || 0));

            let totalDue = window.computeTutoringStudentMonthDue(std, month);
            if ((totalDue === 0 && explicitTotalDue !== undefined && explicitTotalDue !== null) && mode === 'hourly' && discountPercent === 0 && !(parseFloat(std.discount) > 0)) {
                totalDue = parseFloat(explicitTotalDue) || 0;
            }

            if (Array.isArray(std.payments)) {
                const fixedObj = {};
                std.payments.forEach(item => {
                    if (item && item.month) fixedObj[item.month] = item;
                });
                std.payments = fixedObj;
            }

            const payVal = (std.payments && typeof std.payments === 'object') ? std.payments[month] : undefined;
            const legacyRec = (std.paymentRecords && typeof std.paymentRecords === 'object') ? std.paymentRecords[month] : undefined;
            const isPaidInMonthsList = Array.isArray(std.paidMonths)
                ? std.paidMonths.includes(month)
                : !!(std.paidMonths && typeof std.paidMonths === 'object' && std.paidMonths[month]);
            const historyFromLog = Array.isArray(std.paymentHistory)
                ? std.paymentHistory.filter(p => p && p.month === month)
                : [];

            let paidAmount = 0;
            let history = [];
            let note = '';

            if (payVal !== undefined && payVal !== null) {
                if (payVal === true) {
                    paidAmount = totalDue;
                } else if (payVal === false) {
                    paidAmount = 0;
                } else if (typeof payVal === 'number') {
                    paidAmount = Math.max(0, payVal);
                } else if (typeof payVal === 'object') {
                    const rawHist = Array.isArray(payVal.history)
                        ? payVal.history
                        : (Array.isArray(payVal.installments) ? payVal.installments : []);
                    history = rawHist.map(h => ({ ...h, month: h.month || month }));
                    if (history.length > 0) {
                        paidAmount = history.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
                    } else if (payVal.amount !== undefined) {
                        paidAmount = parseFloat(payVal.amount) || 0;
                    } else if (payVal.paid === true) {
                        paidAmount = totalDue;
                    }
                    note = payVal.note || '';
                }
            } else if (legacyRec && typeof legacyRec === 'object') {
                if (Array.isArray(legacyRec.installments) && legacyRec.installments.length > 0) {
                    history = legacyRec.installments.map(h => ({ ...h, month: h.month || month }));
                    paidAmount = history.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
                } else if (legacyRec.paid) {
                    paidAmount = parseFloat(legacyRec.amount) || totalDue;
                }
                note = legacyRec.note || '';
            } else if (historyFromLog.length > 0) {
                history = historyFromLog.map(h => ({ ...h, month: h.month || month }));
                paidAmount = history.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
            } else if (isPaidInMonthsList) {
                paidAmount = totalDue;
            }

            if (isPaidInMonthsList && paidAmount === 0 && totalDue > 0 && payVal === undefined) {
                paidAmount = totalDue;
            }

            paidAmount = Math.round(paidAmount * 100) / 100;
            totalDue = Math.round(totalDue * 100) / 100;
            let remaining = Math.max(0, Math.round((totalDue - paidAmount) * 100) / 100);

            let progressPercent = 0;
            if (totalDue > 0) {
                progressPercent = Math.min(100, Math.round((paidAmount / totalDue) * 100));
            } else {
                progressPercent = 100;
            }

            let status = 'unpaid';
            if (totalDue <= 0) {
                status = 'paid';
                remaining = 0;
                progressPercent = 100;
            } else if (paidAmount >= totalDue) {
                status = 'paid';
                remaining = 0;
                progressPercent = 100;
            } else if (paidAmount > 0) {
                status = 'partial';
            } else {
                status = 'unpaid';
                progressPercent = 0;
            }

            const result = {
                totalDue: totalDue,
                effectiveDue: totalDue,
                paidAmount: paidAmount,
                paid: paidAmount,
                remaining: remaining,
                progressPercent: progressPercent,
                status: status,
                isPaid: status === 'paid',
                isPartial: status === 'partial',
                isUnpaid: status === 'unpaid',
                history: history,
                installments: history,
                note: note,
                billingMode: mode,
                discountPercent: discountPercent,
                attendedSessionsCount: attendedSessionsCount,
                monthHours: monthHours
            };

            if (mode === 'session_pack') {
                const packStatus = window.getStudentPackStatus(std, month);
                result.packSize = packStatus ? packStatus.packSize : Math.max(1, parseInt(std.packSessions, 10) || 4);
                result.packRemaining = packStatus ? packStatus.remaining : Math.max(0, result.packSize - attendedSessionsCount);
                result.packUsed = packStatus ? packStatus.usedInCurrentPack : attendedSessionsCount;
                result.packCycle = packStatus ? packStatus.currentCycle : 1;
                result.packIsLow = packStatus ? packStatus.isLow : (result.packRemaining <= 1);
            }

            return result;
        };

        window.computeTutoringNetProfitSummary = function(selectedMonth) {
            const monthEl = document.getElementById('tutoringMonth');
            const month = selectedMonth || (monthEl && monthEl.value) || (window.formatLocalMonth ? window.formatLocalMonth() : new Date().toISOString().slice(0, 7));
            const students = (db && db.tutoring && Array.isArray(db.tutoring.students)) ? db.tutoring.students : [];
            const allExpenses = (db && db.tutoring && Array.isArray(db.tutoring.expenses)) ? db.tutoring.expenses : [];

            let monthGrossDue = 0;
            let monthCollected = 0;
            let monthRemaining = 0;
            let monthHours = 0;

            let allTimeGrossDue = 0;
            let allTimeCollected = 0;
            let allTimeRemaining = 0;
            let allTimeHours = 0;

            students.forEach(std => {
                const pMonth = window.getTutoringPaymentInfo(std, month);
                monthGrossDue += pMonth.totalDue;
                monthCollected += pMonth.paidAmount;
                monthRemaining += pMonth.remaining;
                monthHours += pMonth.monthHours || 0;

                const studentMonths = window.getStudentActiveMonthsSet(std, month);
                studentMonths.forEach(mKey => {
                    const p = window.getTutoringPaymentInfo(std, mKey);
                    allTimeGrossDue += p.totalDue;
                    allTimeCollected += p.paidAmount;
                    allTimeRemaining += p.remaining;
                    allTimeHours += p.monthHours || 0;
                });
            });

            const monthExpensesList = allExpenses.filter(e => e && e.month === month);
            const monthExpenses = Math.round(monthExpensesList.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0) * 100) / 100;
            const allTimeExpenses = Math.round(allExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0) * 100) / 100;

            monthGrossDue = Math.round(monthGrossDue * 100) / 100;
            monthCollected = Math.round(monthCollected * 100) / 100;
            monthRemaining = Math.round(monthRemaining * 100) / 100;
            monthHours = Math.round(monthHours * 100) / 100;

            allTimeGrossDue = Math.round(allTimeGrossDue * 100) / 100;
            allTimeCollected = Math.round(allTimeCollected * 100) / 100;
            allTimeRemaining = Math.round(allTimeRemaining * 100) / 100;
            allTimeHours = Math.round(allTimeHours * 100) / 100;

            const monthNetProfitActual = Math.round((monthCollected - monthExpenses) * 100) / 100;
            const monthNetProfitExpected = Math.round((monthGrossDue - monthExpenses) * 100) / 100;
            const allTimeNetProfitActual = Math.round((allTimeCollected - allTimeExpenses) * 100) / 100;
            const allTimeNetProfitExpected = Math.round((allTimeGrossDue - allTimeExpenses) * 100) / 100;

            const monthHourlyNetYield = monthHours > 0 ? Math.round((monthNetProfitActual / monthHours) * 10) / 10 : 0;

            return {
                month,
                monthGrossDue,
                monthCollected,
                monthRemaining,
                monthExpenses,
                monthExpensesCount: monthExpensesList.length,
                monthNetProfitActual,
                monthNetProfitExpected,
                monthHours,
                monthHourlyNetYield,
                allTimeGrossDue,
                allTimeCollected,
                allTimeRemaining,
                allTimeExpenses,
                allTimeExpensesCount: allExpenses.length,
                allTimeNetProfitActual,
                allTimeNetProfitExpected,
                allTimeHours
            };
        };

        /**
         * دالة موحدة لتوليد إعدادات الأيقونات الملونة والشارات البصرية لحالة الأداء المالي
         * (مؤدى [paid], جزئي [partial], غير مؤدى [unpaid])
         */
        window.getTutoringStatusVisualConfig = function(status, payInfo) {
            payInfo = payInfo || {};
            const remaining = payInfo.remaining !== undefined ? payInfo.remaining : 0;
            const paidAmount = payInfo.paidAmount !== undefined ? payInfo.paidAmount : 0;
            const progressPercent = payInfo.progressPercent !== undefined ? payInfo.progressPercent : 0;

            if (status === 'paid') {
                return {
                    key: 'paid',
                    status: 'paid',
                    label: 'مؤدى',
                    longLabel: 'مؤدى بالكامل',
                    icon: 'check-circle',
                    subIcon: 'check',
                    color: '#15803d',
                    bgColor: '#dcfce7',
                    borderColor: '#86efac',
                    accentColor: '#16a34a',
                    badgeGradient: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                    shadow: '0 2px 5px rgba(22, 163, 74, 0.15)',
                    avatarBg: '#dcfce7',
                    avatarColor: '#15803d',
                    tooltip: `تم الأداء بالكامل (${paidAmount} د.م)`,
                    summaryText: `خالص (${paidAmount} د.م)`
                };
            } else if (status === 'partial') {
                return {
                    key: 'partial',
                    status: 'partial',
                    label: 'جزئي',
                    longLabel: 'أداء جزئي',
                    icon: 'pie-chart',
                    subIcon: 'pie-chart',
                    color: '#b45309',
                    bgColor: '#fef3c7',
                    borderColor: '#fde68a',
                    accentColor: '#f59e0b',
                    badgeGradient: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                    shadow: '0 2px 5px rgba(245, 158, 11, 0.18)',
                    avatarBg: '#fef3c7',
                    avatarColor: '#b45309',
                    tooltip: `أداء جزئي: باقٍ ${remaining} د.م (أُدّي ${paidAmount} د.م - ${progressPercent}%)`,
                    summaryText: `متبقي: ${remaining} د.م`
                };
            } else {
                return {
                    key: 'unpaid',
                    status: 'unpaid',
                    label: 'غير مؤدى',
                    longLabel: 'غير مؤدى',
                    icon: 'alert-circle',
                    subIcon: 'x',
                    color: '#b91c1c',
                    bgColor: '#fee2e2',
                    borderColor: '#fca5a5',
                    accentColor: '#ef4444',
                    badgeGradient: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                    shadow: '0 2px 5px rgba(239, 68, 68, 0.18)',
                    avatarBg: '#fee2e2',
                    avatarColor: '#b91c1c',
                    tooltip: `غير مؤدى: مستحق كاملاً ${remaining} د.م`,
                    summaryText: `مستحق: ${remaining} د.م`
                };
            }
        };

        function renderTutoringStudents() {
            initTutoring();
            const tbody = document.getElementById('tutoringTableBody');
            if (!tbody) return;
            tbody.innerHTML = '';

            const month = document.getElementById('tutoringMonth').value;
            const filterGroupSelect = document.getElementById('tutoringGroupFilter');
            const groupDatalist = document.getElementById('tutoringGroupDatalist');
            const groups = new Set((db.tutoring.students || []).map(item => item.group).filter(t => t && t.trim() !== ''));
            if (db.tutoring.groups) {
                db.tutoring.groups.forEach(g => { if (g.name) groups.add(g.name); });
            }

            if (filterGroupSelect) {
                const currentGroupValue = filterGroupSelect.value;
                let groupOptions = '<option value="all">كل المجموعات</option>';
                Array.from(groups).sort().forEach(grp => {
                    const safeGrp = escapeTutoringHtml(grp);
                    groupOptions += `<option value="${safeGrp}">${safeGrp}</option>`;
                });

                filterGroupSelect.innerHTML = groupOptions;
                if (groups.has(currentGroupValue)) {
                    filterGroupSelect.value = currentGroupValue;
                }
            }
            if (groupDatalist) {
                groupDatalist.innerHTML = Array.from(groups).sort().map(grp => `<option value="${escapeTutoringHtml(grp)}">`).join('');
            }

            const searchInput = document.getElementById('tutoringSearchInput');
            const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';

            let grandTotal = 0;
            let collectedTotal = 0;
            let unpaidTotal = 0;
            let totalStudentsCount = 0;
            let totalHoursAll = 0;
            let pendingStudentsCount = 0;

            const revenueElement = document.getElementById('tutoringTotalRevenue');
            const collectedRevenueElement = document.getElementById('tutoringCollectedRevenue');
            const unpaidRevenueElement = document.getElementById('tutoringUnpaidRevenue');
            const unpaidCountBadge = document.getElementById('tutoringUnpaidCountBadge');
            const totalStudentsElement = document.getElementById('tutoringTotalStudents');
            const totalHoursElement = document.getElementById('tutoringTotalHours');
            const collectionRateLabel = document.getElementById('tutoringCollectionRateLabel');
            const progressBarFill = document.getElementById('tutoringProgressBarFill');

            let allStudentsInScope = db.tutoring.students || [];

            const groupFilter = document.getElementById('tutoringGroupFilter') ? document.getElementById('tutoringGroupFilter').value : 'all';
            if (groupFilter !== 'all') {
                allStudentsInScope = allStudentsInScope.filter(s => s.group === groupFilter);
            }

            // Calculate overall counts and global KPIs for Group+Month scope (unaffected by search/payment filters)
            let totalGroupCount = allStudentsInScope.length;
            let unpaidGroupCount = 0;
            let partialGroupCount = 0;
            let paidGroupCount = 0;

            allStudentsInScope.forEach(s => {
                const pInfo = window.getTutoringPaymentInfo(s, month);
                if (pInfo.status === 'paid') paidGroupCount++;
                else if (pInfo.status === 'partial') partialGroupCount++;
                else unpaidGroupCount++;

                grandTotal += pInfo.totalDue || 0;
                collectedTotal += pInfo.paidAmount || 0;
                unpaidTotal += pInfo.remaining || 0;
                totalStudentsCount++;
                totalHoursAll += pInfo.monthHours || 0;
                if (pInfo.remaining > 0) pendingStudentsCount++;
            });

            grandTotal = Math.round(grandTotal * 100) / 100;
            collectedTotal = Math.round(collectedTotal * 100) / 100;
            unpaidTotal = Math.round(unpaidTotal * 100) / 100;
            totalHoursAll = Math.round(totalHoursAll * 100) / 100;

            // Update Quick Filter Count Badges
            const pillCountAll = document.getElementById('tutoringPillCountAll');
            const pillCountUnpaid = document.getElementById('tutoringPillCountUnpaid');
            const pillCountPartial = document.getElementById('tutoringPillCountPartial');
            const pillCountPaid = document.getElementById('tutoringPillCountPaid');
            if (pillCountAll) pillCountAll.textContent = totalGroupCount;
            if (pillCountUnpaid) pillCountUnpaid.textContent = unpaidGroupCount;
            if (pillCountPartial) pillCountPartial.textContent = partialGroupCount;
            if (pillCountPaid) pillCountPaid.textContent = paidGroupCount;

            // Update active pill button styling
            const paymentFilter = document.getElementById('tutoringPaymentFilter') ? document.getElementById('tutoringPaymentFilter').value : 'all';
            const pillAll = document.getElementById('tutoringPillAll');
            const pillUnpaid = document.getElementById('tutoringPillUnpaid');
            const pillPartial = document.getElementById('tutoringPillPartial');
            const pillPaid = document.getElementById('tutoringPillPaid');

            [pillAll, pillUnpaid, pillPartial, pillPaid].forEach(p => {
                if (p) {
                    p.style.background = 'transparent';
                    p.style.boxShadow = 'none';
                }
            });

            if (paymentFilter === 'unpaid' && pillUnpaid) {
                pillUnpaid.style.background = '#fff';
                pillUnpaid.style.boxShadow = '0 1px 3px rgba(220,38,38,0.15)';
            } else if (paymentFilter === 'partial' && pillPartial) {
                pillPartial.style.background = '#fff';
                pillPartial.style.boxShadow = '0 1px 3px rgba(245,158,11,0.2)';
            } else if (paymentFilter === 'paid' && pillPaid) {
                pillPaid.style.background = '#fff';
                pillPaid.style.boxShadow = '0 1px 3px rgba(22,163,74,0.15)';
            } else if (pillAll) {
                pillAll.style.background = '#fff';
                pillAll.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
            }

            let filteredStudents = allStudentsInScope;

            if (searchVal) {
                filteredStudents = filteredStudents.filter(s =>
                    (s.name && s.name.toLowerCase().includes(searchVal)) ||
                    (s.group && s.group.toLowerCase().includes(searchVal)) ||
                    (s.phone && s.phone.includes(searchVal))
                );
            }

            if (paymentFilter !== 'all') {
                filteredStudents = filteredStudents.filter(s => {
                    const pInfo = window.getTutoringPaymentInfo(s, month);
                    if (paymentFilter === 'paid') return pInfo.status === 'paid';
                    if (paymentFilter === 'partial') return pInfo.status === 'partial';
                    if (paymentFilter === 'unpaid') return pInfo.status === 'unpaid';
                    if (paymentFilter === 'unpaid_and_partial') return pInfo.remaining > 0;
                    return true;
                });
            }

            // Compute student-specific figures for sorting and statistics
            const studentStats = filteredStudents.map(std => {
                const sessions = std.sessions || [];
                let hours = 0;
                let absentCount = 0;
                sessions.forEach(s => {
                    if (s.date && s.date.startsWith(month)) {
                        if (s.attendance === 'absent') {
                            absentCount++;
                            return;
                        }
                        hours += parseFloat(s.hours) || 0;
                    }
                });
                const rate = parseFloat(std.fee) || 0;
                const payInfo = window.getTutoringPaymentInfo(std, month);
                const due = payInfo.totalDue;

                return {
                    student: std,
                    hours: hours,
                    absentCount: absentCount,
                    rate: rate,
                    due: due,
                    payInfo: payInfo
                };
            });

            // Sorting by status / name / amount / hours / progress / remaining
            const sortFilter = document.getElementById('tutoringSortFilter') ? document.getElementById('tutoringSortFilter').value : 'unpaid_first';
            if (sortFilter === 'unpaid_first') {
                // Priority: unpaid (highest remaining) -> partial (highest remaining) -> paid
                studentStats.sort((a, b) => {
                    const rankA = a.payInfo.status === 'unpaid' ? 0 : (a.payInfo.status === 'partial' ? 1 : 2);
                    const rankB = b.payInfo.status === 'unpaid' ? 0 : (b.payInfo.status === 'partial' ? 1 : 2);
                    if (rankA !== rankB) return rankA - rankB;
                    return b.payInfo.remaining - a.payInfo.remaining || b.due - a.due;
                });
            } else if (sortFilter === 'remaining_desc') {
                studentStats.sort((a, b) => b.payInfo.remaining - a.payInfo.remaining || b.due - a.due);
            } else if (sortFilter === 'progress_asc') {
                studentStats.sort((a, b) => a.payInfo.progressPercent - b.payInfo.progressPercent || b.payInfo.remaining - a.payInfo.remaining);
            } else if (sortFilter === 'progress_desc') {
                studentStats.sort((a, b) => b.payInfo.progressPercent - a.payInfo.progressPercent || a.payInfo.remaining - b.payInfo.remaining);
            } else if (sortFilter === 'paid_first') {
                studentStats.sort((a, b) => {
                    const rankA = a.payInfo.status === 'paid' ? 0 : (a.payInfo.status === 'partial' ? 1 : 2);
                    const rankB = b.payInfo.status === 'paid' ? 0 : (b.payInfo.status === 'partial' ? 1 : 2);
                    if (rankA !== rankB) return rankA - rankB;
                    return b.due - a.due;
                });
            } else if (sortFilter === 'name_asc') {
                studentStats.sort((a, b) => (a.student.name || '').localeCompare(b.student.name || '', 'ar'));
            } else if (sortFilter === 'name_desc') {
                studentStats.sort((a, b) => (b.student.name || '').localeCompare(a.student.name || '', 'ar'));
            } else if (sortFilter === 'amount_desc') {
                studentStats.sort((a, b) => b.due - a.due);
            } else if (sortFilter === 'amount_asc') {
                studentStats.sort((a, b) => a.due - b.due);
            } else if (sortFilter === 'hours_desc') {
                studentStats.sort((a, b) => b.hours - a.hours);
            }

            // Update Sort Indicators on Table Headers
            const sortIconName = document.getElementById('sortIconName');
            const sortIconHours = document.getElementById('sortIconHours');
            const sortIconAmount = document.getElementById('sortIconAmount');
            const sortIconProgress = document.getElementById('sortIconProgress');
            const sortIconRemaining = document.getElementById('sortIconRemaining');

            [sortIconName, sortIconHours, sortIconAmount, sortIconProgress, sortIconRemaining].forEach(icon => {
                if (icon) {
                    icon.style.opacity = '0.35';
                    icon.style.color = 'inherit';
                }
            });

            if (sortFilter.startsWith('name') && sortIconName) {
                sortIconName.style.opacity = '1';
                sortIconName.style.color = '#2563eb';
            } else if (sortFilter === 'hours_desc' && sortIconHours) {
                sortIconHours.style.opacity = '1';
                sortIconHours.style.color = '#2563eb';
            } else if (sortFilter.startsWith('amount') && sortIconAmount) {
                sortIconAmount.style.opacity = '1';
                sortIconAmount.style.color = '#2563eb';
            } else if (sortFilter.startsWith('progress') && sortIconProgress) {
                sortIconProgress.style.opacity = '1';
                sortIconProgress.style.color = '#2563eb';
            } else if ((sortFilter.startsWith('remaining') || sortFilter === 'unpaid_first' || sortFilter === 'paid_first') && sortIconRemaining) {
                sortIconRemaining.style.opacity = '1';
                sortIconRemaining.style.color = (sortFilter === 'paid_first') ? '#10b981' : '#ef4444';
            }

            const cardsContainer = document.getElementById('tutoringCardsContainer');
            if (cardsContainer) cardsContainer.innerHTML = '';

            const filteredStrip = document.getElementById('tutoringFilteredSummaryStrip');
            const isNarrowFilterActive = Boolean(searchVal || paymentFilter !== 'all');
            if (filteredStrip) {
                if (isNarrowFilterActive) {
                    const filtDue = Math.round(studentStats.reduce((s, it) => s + (it.due || 0), 0) * 100) / 100;
                    const filtPaid = Math.round(studentStats.reduce((s, it) => s + (it.payInfo.paidAmount || 0), 0) * 100) / 100;
                    const filtRem = Math.round(studentStats.reduce((s, it) => s + (it.payInfo.remaining || 0), 0) * 100) / 100;
                    const filtHours = Math.round(studentStats.reduce((s, it) => s + (it.hours || 0), 0) * 100) / 100;
                    filteredStrip.style.display = 'flex';
                    filteredStrip.innerHTML = `
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                            <span style="font-weight:900; color:#1d4ed8;">🔍 نتائج التصفية الحالية: <b>${studentStats.length}</b> من أصل ${totalGroupCount} تلميذ</span>
                            <span style="color:#64748b;">•</span>
                            <span>الساعات: <b>${filtHours} س</b></span>
                            <span style="color:#64748b;">•</span>
                            <span>المستحق: <b>${filtDue} د.م</b></span>
                            <span style="color:#64748b;">•</span>
                            <span style="color:#15803d;">المؤدى: <b>${filtPaid} د.م</b></span>
                            <span style="color:#64748b;">•</span>
                            <span style="color:#b91c1c;">المتبقي: <b>${filtRem} د.م</b></span>
                        </div>
                        <button type="button" onclick="const si=document.getElementById('tutoringSearchInput'); if(si) si.value=''; const pf=document.getElementById('tutoringPaymentFilter'); if(pf) pf.value='all'; renderTutoringStudents();" style="background:#fff; border:1px solid #93c5fd; color:#1d4ed8; padding:3px 10px; border-radius:6px; font-size:0.75rem; font-weight:800; cursor:pointer;">✕ مسح التصفية</button>
                    `;
                } else {
                    filteredStrip.style.display = 'none';
                    filteredStrip.innerHTML = '';
                }
            }

            if (studentStats.length === 0) {
                tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:45px 20px; color:#64748b; font-size:1.05rem;"><span class="ui-icon" style="margin-bottom:10px; opacity:0.5;"><span data-lucide="inbox" data-size="36"></span></span><br>لا يوجد أي تلميذ مطابق للمعايير المحددة لهذا الشهر.</td></tr>`;
                if (cardsContainer) cardsContainer.innerHTML = `<div style="text-align:center; padding:45px 20px; color:#64748b; font-size:1.05rem; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0;"><span class="ui-icon" style="margin-bottom:10px; opacity:0.5;"><span data-lucide="inbox" data-size="36"></span></span><br>لا يوجد أي تلميذ مطابق للمعايير المحددة لهذا الشهر.</div>`;

                const collectionRateEmpty = grandTotal > 0 ? Math.round((collectedTotal / grandTotal) * 100) : 0;
                if (revenueElement) revenueElement.textContent = grandTotal;
                if (collectedRevenueElement) collectedRevenueElement.textContent = collectedTotal;
                if (unpaidRevenueElement) unpaidRevenueElement.textContent = unpaidTotal;
                if (unpaidCountBadge) unpaidCountBadge.textContent = '(' + pendingStudentsCount + ' تلميذ)';
                if (totalStudentsElement) totalStudentsElement.textContent = totalStudentsCount;
                if (totalHoursElement) totalHoursElement.textContent = totalHoursAll;
                if (collectionRateLabel) collectionRateLabel.textContent = collectionRateEmpty + '%';
                if (progressBarFill) progressBarFill.style.width = collectionRateEmpty + '%';

                const allTimeRevenueElement = document.getElementById('tutoringAllTimeCollectedRevenue');
                if (allTimeRevenueElement) {
                    const summary = window.computeTutoringNetProfitSummary ? window.computeTutoringNetProfitSummary(month) : { allTimeCollected: 0 };
                    allTimeRevenueElement.textContent = summary.allTimeCollected;
                }

                const alertBanner = document.getElementById('tutoringOutstandingAlertBanner');
                const alertText = document.getElementById('tutoringOutstandingAlertText');
                if (alertBanner && alertText) {
                    if (unpaidTotal > 0) {
                        alertBanner.style.display = 'flex';
                        alertText.textContent = `توجد مبالغ مستحقة ومتبقية بذمة ${pendingStudentsCount} تلاميذ بمجموع ${unpaidTotal} درهم لهذا الشهر (${month}) لم يتم استخلاصها بعد.`;
                    } else {
                        alertBanner.style.display = 'none';
                    }
                }

                if (typeof window.updateTutoringBatchBar === 'function') {
                    window.updateTutoringBatchBar();
                }

                setTimeout(() => { if (window.renderLucide) window.renderLucide(); }, 50);
                return;
            }

            studentStats.forEach((item, i) => {
                const std = item.student;
                const totalHours = item.hours;
                const absentCount = item.absentCount;
                const hourlyRate = item.rate;
                const totalDue = item.due;
                const payInfo = item.payInfo;

                const safeName = escapeTutoringHtml(std.name || '');
                const safeGroup = escapeTutoringHtml(std.group || '-');
                const safePhone = escapeTutoringHtml(std.phone || '');
                const monthResourcesCount = (std.sessions || [])
                    .filter(s => s && s.date && s.date.startsWith(month) && Array.isArray(s.attachedResources))
                    .reduce((cnt, s) => cnt + s.attachedResources.length, 0);
                const lastNotifiedChip = std.lastNotifiedAt
                    ? `<span style="background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; padding:1px 6px; border-radius:99px; font-size:0.66rem; font-weight:700;" title="آخر إشعار واتساب بتاريخ ${escapeTutoringHtml(String(std.lastNotifiedAt).slice(0, 10))}">📲 أُشعر ${escapeTutoringHtml(String(std.lastNotifiedAt).slice(5, 10))}</span>`
                    : '';
                const renewPackChip = (payInfo.billingMode === 'session_pack' && payInfo.packIsLow)
                    ? `<button type="button" onclick="event.stopPropagation(); if(window.renewStudentSessionPack) window.renewStudentSessionPack('${std.id}');" style="background:#fef2f2; color:#dc2626; border:1px solid #fca5a5; padding:1px 7px; border-radius:99px; font-size:0.67rem; font-weight:800; cursor:pointer;" title="تجديد باقة الحصص وبدء دورة جديدة من اليوم">🔄 تجديد الباقة</button>`
                    : '';
                const resChip = monthResourcesCount > 0
                    ? `<span style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; padding:1px 6px; border-radius:99px; font-size:0.66rem; font-weight:800;" title="موارد رقمية مرفقة بحصص هذا الشهر">📚 ${monthResourcesCount} مورد</span>`
                    : '';

                // Table row
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #e2e8f0';
                tr.style.backgroundColor = i % 2 === 0 ? '#fff' : '#f8fafc';
                tr.style.transition = 'background-color 0.15s ease';
                tr.onmouseover = () => tr.style.backgroundColor = '#f1f5f9';
                tr.onmouseout = () => tr.style.backgroundColor = i % 2 === 0 ? '#fff' : '#f8fafc';

                // Payment status & remaining badge with colored icons
                const statusCfg = window.getTutoringStatusVisualConfig(payInfo.status, payInfo);
                let paymentBadge = '';
                if (payInfo.status === 'paid') {
                    paymentBadge = `
                        <button type="button" class="btn-action tutoring-status-badge-btn" onclick="openTutoringPaymentModal('${std.id}', '${month}')" style="background:${statusCfg.badgeGradient}; color:${statusCfg.color}; padding:6px 14px; border-radius:24px; font-size:0.82rem; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all 0.2s; border:1.5px solid ${statusCfg.borderColor}; box-shadow:${statusCfg.shadow};" title="تم الأداء بالكامل (${payInfo.paidAmount} د.م) - انقر لعرض التفاصيل أو التعديل">
                            <span class="ui-icon" style="margin:0; background:${statusCfg.accentColor}; color:#fff; border-radius:50%; width:20px; height:20px; display:inline-flex; align-items:center; justify-content:center;"><span data-lucide="check" data-size="12"></span></span>
                            <span>مؤدى بالكامل</span>
                            <span style="font-size:0.72rem; font-weight:800; color:#166534; background:#bbf7d0; padding:1px 7px; border-radius:10px;">${payInfo.paidAmount} د.م</span>
                        </button>
                    `;
                } else if (payInfo.status === 'partial') {
                    paymentBadge = `
                        <div style="display:inline-flex; flex-direction:column; align-items:center; gap:3px;">
                            <button type="button" class="btn-action tutoring-status-badge-btn" onclick="openTutoringPaymentModal('${std.id}', '${month}')" style="background:${statusCfg.badgeGradient}; color:${statusCfg.color}; padding:6px 13px; border-radius:20px; font-size:0.82rem; font-weight:900; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all 0.2s; border:1.5px solid ${statusCfg.borderColor}; box-shadow:${statusCfg.shadow};" title="أداء جزئي: باقٍ ${payInfo.remaining} د.م - انقر لتسجيل دفعة جديدة">
                                <span class="ui-icon" style="margin:0; background:${statusCfg.accentColor}; color:#fff; border-radius:50%; width:20px; height:20px; display:inline-flex; align-items:center; justify-content:center;"><span data-lucide="pie-chart" data-size="12"></span></span>
                                <span>أداء جزئي: متبقي ${payInfo.remaining} د.م</span>
                            </button>
                            <span style="font-size:0.71rem; color:#b45309; font-weight:700;">أُدّي ${payInfo.paidAmount} د.م من ${payInfo.totalDue} د.م (${payInfo.progressPercent}%)</span>
                        </div>
                    `;
                } else {
                    paymentBadge = `
                        <div style="display:inline-flex; flex-direction:column; align-items:center; gap:3px;">
                            <button type="button" class="btn-action tutoring-status-badge-btn" onclick="openTutoringPaymentModal('${std.id}', '${month}')" style="background:${statusCfg.badgeGradient}; color:${statusCfg.color}; padding:6px 13px; border-radius:20px; font-size:0.82rem; font-weight:900; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all 0.2s; border:1.5px solid ${statusCfg.borderColor}; box-shadow:${statusCfg.shadow};" title="غير مؤدى: مستحق كاملاً ${payInfo.totalDue} د.م - انقر لتسجيل الأداء">
                                <span class="ui-icon" style="margin:0; background:${statusCfg.accentColor}; color:#fff; border-radius:50%; width:20px; height:20px; display:inline-flex; align-items:center; justify-content:center;"><span data-lucide="alert-circle" data-size="12"></span></span>
                                <span>غير مؤدى: مستحق ${payInfo.remaining} د.م</span>
                            </button>
                            <span style="font-size:0.71rem; color:#dc2626; font-weight:700;">مستحق بالكامل (لم تُؤدَّ أي دفعة)</span>
                        </div>
                    `;
                }

                // Progress Bar Cell
                const progressBarColor = payInfo.progressPercent === 100 ? '#10b981' : (payInfo.progressPercent > 0 ? '#f59e0b' : '#cbd5e1');
                const progressCell = `
                    <div style="min-width: 140px; display: flex; flex-direction: column; gap: 3px;">
                        <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 0.78rem;">
                            <span style="font-weight: 900; color: ${payInfo.paidAmount > 0 ? '#15803d' : '#64748b'};">${payInfo.paidAmount} د.م</span>
                            <span style="font-weight: 800; font-family: monospace; font-size: 0.8rem; color: ${payInfo.progressPercent === 100 ? '#15803d' : (payInfo.progressPercent > 0 ? '#d97706' : '#94a3b8')};">${payInfo.progressPercent}%</span>
                        </div>
                        <div style="background: #e2e8f0; border-radius: 9999px; height: 7px; overflow: hidden;">
                            <div style="width: ${payInfo.progressPercent}%; height: 100%; background: ${progressBarColor}; border-radius: 9999px; transition: width 0.3s ease;"></div>
                        </div>
                        <div style="font-size: 0.69rem; color: #64748b; display: flex; justify-content: space-between;">
                            <span>من أصل ${totalDue} د.م</span>
                            <span style="font-weight: 600;">${payInfo.history.length > 0 ? `${payInfo.history.length} دفعة` : (payInfo.status === 'paid' ? 'دفعة كاملة' : '0 دفعة')}</span>
                        </div>
                    </div>
                `;

                let waActionBtn = '';
                if (payInfo.remaining > 0) {
                    waActionBtn = `<button type="button" class="btn-action" onclick="openTutoringWhatsAppModal('${std.id}', 'unpaid')" style="padding: 7px 10px; border:none; background:#dcfce7; color:#16a34a; border-radius:6px; font-weight:bold; font-size:0.8rem; display:inline-flex; align-items:center; gap:4px;" title="إرسال تذكير بالأداء أو المتبقي (${payInfo.remaining} د.م) عبر واتساب"><span class="ui-icon" style="margin:0"><span data-lucide="message-circle" data-size="15"></span></span> تذكير</button>`;
                } else {
                    waActionBtn = `<button type="button" class="btn-action" onclick="openTutoringWhatsAppModal('${std.id}', 'upcoming')" style="padding: 7px 10px; border:none; background:#f0fdf4; color:#16a34a; border-radius:6px; font-weight:bold; font-size:0.8rem; display:inline-flex; align-items:center; gap:4px;" title="إرسال تذكير بموعد الحصة عبر واتساب"><span class="ui-icon" style="margin:0"><span data-lucide="message-circle" data-size="15"></span></span> واتساب</button>`;
                }

                const isSelected = window.selectedTutoringStudentIds && window.selectedTutoringStudentIds.has(std.id);

                tr.innerHTML = `
                    <td style="padding: 12px 8px; text-align: center;">
                        <input type="checkbox" class="tutoring-row-checkbox" value="${std.id}" ${isSelected ? 'checked' : ''} onchange="onTutoringStudentCheckboxChange('${std.id}', this.checked)" style="cursor: pointer; width: 16px; height: 16px; accent-color: #4f46e5;">
                    </td>
                    <td style="padding: 12px 14px; font-weight: bold; color:#1e293b;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <div style="position:relative; width:40px; height:40px; flex-shrink:0;">
                                <div style="width:100%; height:100%; border-radius:50%; background:${statusCfg.avatarBg}; color:${statusCfg.avatarColor}; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:1.15rem; border:2px solid ${statusCfg.borderColor}; box-shadow:0 1px 3px rgba(0,0,0,0.06);">
                                    ${escapeTutoringHtml((std.name || 'ت').charAt(0))}
                                </div>
                                <span style="position:absolute; bottom:-3px; left:-3px; width:18px; height:18px; border-radius:50%; background:${statusCfg.accentColor}; color:#ffffff; display:flex; align-items:center; justify-content:center; box-shadow:0 1px 3px rgba(0,0,0,0.25); border:2px solid #ffffff;" title="حالة الأداء المالي: ${statusCfg.longLabel}">
                                    <span class="ui-icon" style="margin:0; color:#ffffff;"><span data-lucide="${statusCfg.subIcon}" data-size="10"></span></span>
                                </span>
                            </div>
                            <div style="min-width:0;">
                                <div style="display:flex; align-items:center; gap:7px; flex-wrap:wrap;">
                                    <a href="#" onclick="event.preventDefault(); openTutoringStudentProfileModal('${std.id}')" style="font-weight:800; font-size:0.96rem; color:#1e293b; text-decoration:none;" onmouseover="this.style.color='#2563eb'" onmouseout="this.style.color='#1e293b'">${safeName}</a>
                                    <span class="tutoring-status-tag ${statusCfg.key}" style="display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:20px; font-size:0.72rem; font-weight:800; background:${statusCfg.bgColor}; color:${statusCfg.color}; border:1px solid ${statusCfg.borderColor}; white-space:nowrap;" title="حالة الأداء المالي لشهر ${month}: ${statusCfg.longLabel}">
                                        <span class="ui-icon" style="margin:0; color:${statusCfg.accentColor};"><span data-lucide="${statusCfg.icon}" data-size="12"></span></span>
                                        <span>${statusCfg.label}</span>
                                        ${statusCfg.key === 'partial' ? `<span style="font-size:0.68rem; opacity:0.9; font-family:monospace;">${payInfo.progressPercent}%</span>` : ''}
                                    </span>
                                    ${lastNotifiedChip}
                                    ${resChip}
                                    ${renewPackChip}
                                </div>
                                <div style="font-size:0.75rem; color:#64748b; margin-top:2px;" dir="ltr">${safePhone}</div>
                            </div>
                        </div>
                    </td>
                    <td style="padding: 12px 14px; color:#475569;">
                        <span class="tutoring-chip" style="background: #f1f5f9; color:#334155; font-size: 0.85rem;">${safeGroup}</span>
                    </td>
                    <td style="padding: 12px 14px; text-align: center; color:#475569; font-family:monospace; font-size:0.92rem;" dir="ltr">${safePhone || '-'}</td>
                    <td style="padding: 12px 14px; text-align: center; font-weight:bold; color:#0f172a;">${hourlyRate} د.م</td>
                    <td style="padding: 12px 14px; text-align: center; font-weight:bold; color:#3b82f6;">
                        <span style="background: #eff6ff; padding: 4px 10px; border-radius: 20px; font-size:0.85rem;">${totalHours} س</span>
                        ${absentCount > 0 ? `<div style="font-size:0.7rem; color:#ef4444; margin-top:4px;">${absentCount} غياب</div>` : ''}
                    </td>
                    <td style="padding: 12px 14px; text-align: center; font-weight:900; color:#0f172a; font-size:1.05rem;">
                        ${totalDue} د.م
                    </td>
                    <td style="padding: 12px 14px;">${progressCell}</td>
                    <td style="padding: 12px 14px; text-align: center;">${paymentBadge}</td>
                    <td style="padding: 12px 14px; text-align: center; display:flex; justify-content:center; gap:5px; align-items:center;">
                        <button class="btn-action" onclick="openTutoringStudentProfileModal('${std.id}')" style="padding: 7px; border:none; background:#f1f5f9; color:#475569; border-radius:6px;" title="ملف التلميذ الشامل (Dossier)"><span class="ui-icon" style="margin:0"><span data-lucide="user" data-size="16"></span></span></button>
                        ${waActionBtn}
                        <button class="btn-action" onclick="openTutoringScheduleSlotModal('', 1, 'individual', '${std.id}')" style="padding: 7px; border:none; background:#fef3c7; color:#b45309; border-radius:6px;" title="برمجة موعد أسبوعي قار في جدول الحصص (دعم فردي 1-à-1)"><span class="ui-icon" style="margin:0"><span data-lucide="calendar" data-size="16"></span></span></button>
                        <button class="btn-action" onclick="openTutoringSessionModal('${std.id}')" style="padding: 7px; border:none; background:#fef08a; color:#854d0e; border-radius:6px;" title="تسجيل حصة دعم"><span class="ui-icon" style="margin:0"><span data-lucide="clock" data-size="16"></span></span></button>
                        <button class="btn-action" onclick="openTutoringStatementModal('${std.id}', '${month}')" style="padding: 7px; border:none; background:#eff6ff; color:#1d4ed8; border-radius:6px;" title="كشف حساب شهري PDF (تفاصيل الدفعات والمتبقي)"><span class="ui-icon" style="margin:0"><span data-lucide="file-text" data-size="16"></span></span></button>
                        <button class="btn-action" onclick="printTutoringReceipt('${std.id}', '${month}', ${totalDue}, ${totalHours})" style="padding: 7px; border:none; background:#ecfdf5; color:#059669; border-radius:6px;" title="طباعة الوصل"><span class="ui-icon" style="margin:0"><span data-lucide="receipt" data-size="16"></span></span></button>
                        <button class="btn-action hide-in-presentation" onclick="editTutoringStudent('${std.id}')" style="padding: 7px; border:none; background:#e0f2fe; color:#0284c7; border-radius:6px;" title="تعديل"><span class="ui-icon" style="margin:0"><span data-lucide="edit" data-size="16"></span></span></button>
                        <button class="btn-action hide-in-presentation" onclick="deleteTutoringStudent('${std.id}')" style="padding: 7px; border:none; background:#fee2e2; color:#ef4444; border-radius:6px;" title="حذف"><span class="ui-icon" style="margin:0"><span data-lucide="trash-2" data-size="16"></span></span></button>
                    </td>
                `;
                tbody.appendChild(tr);

                // Responsive mobile card
                if (cardsContainer) {
                    const card = document.createElement('div');
                    const cardStatusClass = payInfo.status === 'paid' ? 'paid-card' : (payInfo.status === 'partial' ? 'partial-card' : 'unpaid-card');
                    card.className = `tutoring-student-card ${cardStatusClass}`;
                    card.style.borderRight = `5px solid ${statusCfg.accentColor}`;

                    let cardPhoneDisplay = '';
                    if (std.phone) {
                        let cleanP = std.phone.replace(/[^0-9]/g, '');
                        if (cleanP.startsWith('0')) cleanP = '212' + cleanP.substring(1);
                        cardPhoneDisplay = `
                            <a href="tel:${safePhone}" style="color: #64748b; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; font-size: 0.8rem;" dir="ltr">
                                <span class="ui-icon" style="color: #3b82f6;"><span data-lucide="phone" data-size="12"></span></span>
                                ${safePhone}
                            </a>
                        `;
                    }

                    let cardStatusBtn = '';
                    if (payInfo.status === 'paid') {
                        cardStatusBtn = `<button type="button" class="tutoring-status-toggle-btn paid" onclick="openTutoringPaymentModal('${std.id}', '${month}')" title="انقر لتعديل الدفعات">
                            <span class="ui-icon" style="margin:0; background:#16a34a; color:#fff; border-radius:50%; width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center;"><span data-lucide="check" data-size="13"></span></span>
                            <span>تم الأداء بالكامل (${payInfo.paidAmount} د.م) • انقر للتعديل</span>
                           </button>`;
                    } else if (payInfo.status === 'partial') {
                        cardStatusBtn = `<button type="button" class="tutoring-status-toggle-btn partial" onclick="openTutoringPaymentModal('${std.id}', '${month}')" style="background:#fffbeb; color:#92400e; border:1.5px solid #fde68a;" title="انقر لتسجيل دفعة جديدة">
                            <span class="ui-icon" style="margin:0; background:#f59e0b; color:#fff; border-radius:50%; width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center;"><span data-lucide="pie-chart" data-size="13"></span></span>
                            <span>أداء جزئي: باقٍ ${payInfo.remaining} د.م • أُدّي ${payInfo.paidAmount} د.م (${payInfo.progressPercent}%)</span>
                           </button>`;
                    } else {
                        cardStatusBtn = `<button type="button" class="tutoring-status-toggle-btn unpaid" onclick="openTutoringPaymentModal('${std.id}', '${month}')" style="background:#fef2f2; color:#991b1b; border:1.5px solid #fca5a5;" title="انقر لتسجيل الأداء">
                            <span class="ui-icon" style="margin:0; background:#ef4444; color:#fff; border-radius:50%; width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center;"><span data-lucide="alert-circle" data-size="13"></span></span>
                            <span>غير مؤدى (مستحق كاملاً: ${payInfo.remaining} د.م) • تسجيل دفعة</span>
                           </button>`;
                    }

                    let cardWaReminderBtn = '';
                    if (payInfo.remaining > 0) {
                        cardWaReminderBtn = `
                            <button type="button" class="btn-action" onclick="openTutoringWhatsAppModal('${std.id}', 'unpaid')" style="background: #25D366; color: #fff; padding: 8px 12px; border-radius: 8px; font-weight: bold; font-size: 0.82rem; border: none; display: inline-flex; align-items: center; gap: 6px;" title="إرسال تذكير بالأداء أو المتبقي عبر واتساب">
                                <span class="ui-icon" style="margin:0"><span data-lucide="message-circle" data-size="15"></span></span>
                                <span>تذكير (${payInfo.remaining} د.م)</span>
                            </button>
                        `;
                    } else {
                        cardWaReminderBtn = `
                            <button type="button" class="btn-action" onclick="openTutoringWhatsAppModal('${std.id}', 'upcoming')" style="background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; padding: 8px 12px; border-radius: 8px; font-weight: bold; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 6px;" title="إرسال تذكير بموعد الحصة القادمة عبر واتساب">
                                <span class="ui-icon" style="margin:0"><span data-lucide="message-circle" data-size="15"></span></span>
                                <span>تذكير الموعد</span>
                            </button>
                        `;
                    }

                    let dueColor = payInfo.status === 'paid' ? '#15803d' : (payInfo.status === 'partial' ? '#b45309' : '#b91c1c');
                    let dueBoxBg = payInfo.status === 'paid' ? '#f0fdf4' : (payInfo.status === 'partial' ? '#fef3c7' : '#fef2f2');
                    let dueBoxBorder = payInfo.status === 'paid' ? '#bbf7d0' : (payInfo.status === 'partial' ? '#fde68a' : '#fecaca');

                    card.innerHTML = `
                        <div class="tutoring-card-header">
                            <div style="position: relative; width: 44px; height: 44px; flex-shrink: 0;">
                                <div style="width: 100%; height: 100%; border-radius: 50%; background: ${statusCfg.avatarBg}; color: ${statusCfg.avatarColor}; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.25rem; border: 2px solid ${statusCfg.borderColor}; box-shadow: 0 2px 4px rgba(0,0,0,0.06);">
                                    ${escapeTutoringHtml((std.name || 'ت').charAt(0))}
                                </div>
                                <span style="position: absolute; bottom: -3px; left: -3px; width: 20px; height: 20px; border-radius: 50%; background: ${statusCfg.accentColor}; color: #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.25); border: 2px solid #ffffff;" title="حالة الأداء: ${statusCfg.longLabel}">
                                    <span class="ui-icon" style="margin: 0; color: #ffffff;"><span data-lucide="${statusCfg.subIcon}" data-size="11"></span></span>
                                </span>
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 6px;">
                                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                        <a href="#" onclick="event.preventDefault(); openTutoringStudentProfileModal('${std.id}')" style="font-weight: 800; color: #0f172a; font-size: 1.05rem; text-decoration: none;">${safeName}</a>
                                        <span class="tutoring-status-tag ${statusCfg.key}" style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 20px; font-size: 0.72rem; font-weight: 800; background: ${statusCfg.bgColor}; color: ${statusCfg.color}; border: 1px solid ${statusCfg.borderColor};" title="حالة الأداء المالي: ${statusCfg.longLabel}">
                                            <span class="ui-icon" style="margin: 0; color: ${statusCfg.accentColor};"><span data-lucide="${statusCfg.icon}" data-size="12"></span></span>
                                            <span>${statusCfg.label}</span>
                                            ${statusCfg.key === 'partial' ? `<span style="font-size: 0.68rem; opacity: 0.9; font-family: monospace;">(${payInfo.progressPercent}%)</span>` : ''}
                                        </span>
                                        ${lastNotifiedChip}
                                        ${resChip}
                                        ${renewPackChip}
                                    </div>
                                    <span class="tutoring-chip" style="background: #f1f5f9; color: #334155; font-size: 0.78rem; padding: 2px 8px; border-radius: 6px; font-weight: 700; flex-shrink: 0;">${escapeTutoringHtml(std.group || 'عام')}</span>
                                </div>
                                <div style="margin-top: 3px;">
                                    ${cardPhoneDisplay}
                                </div>
                            </div>
                        </div>

                        <div class="tutoring-card-metrics">
                            <div class="tutoring-metric-box">
                                <span class="tutoring-metric-label">الساعات</span>
                                <span class="tutoring-metric-val" style="color: #2563eb;">${totalHours} س</span>
                            </div>
                            <div class="tutoring-metric-box">
                                <span class="tutoring-metric-label">واجب الساعة</span>
                                <span class="tutoring-metric-val">${hourlyRate} د.م</span>
                            </div>
                            <div class="tutoring-metric-box" style="background: ${dueBoxBg}; border-color: ${dueBoxBorder};">
                                <span class="tutoring-metric-label" style="color: ${dueColor};">المستحق / المؤدى</span>
                                <span class="tutoring-metric-val" style="color: ${dueColor}; font-size: 0.95rem;">
                                    ${payInfo.status === 'partial' ? `${payInfo.paidAmount} / ${payInfo.totalDue}` : `${totalDue}`} د.م
                                </span>
                            </div>
                        </div>

                        <!-- Card Progress Bar -->
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; margin-bottom: 4px;">
                                <span style="font-weight: 800; color: #334155;">نسبة الاستخلاص:</span>
                                <span style="font-weight: 900; color: ${progressBarColor}; font-family: monospace;">${payInfo.progressPercent}% (${payInfo.paidAmount} د.م)</span>
                            </div>
                            <div style="background: #e2e8f0; border-radius: 9999px; height: 6px; overflow: hidden;">
                                <div style="width: ${payInfo.progressPercent}%; height: 100%; background: ${progressBarColor}; border-radius: 9999px;"></div>
                            </div>
                            ${payInfo.remaining > 0 ? `<div style="font-size: 0.72rem; color: #b91c1c; font-weight: 800; margin-top: 4px; text-align: left;" dir="rtl">⚠️ المبلغ المتبقي: ${payInfo.remaining} د.م</div>` : ''}
                        </div>

                        ${cardStatusBtn}

                        <div style="display: flex; gap: 6px; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 10px; flex-wrap: wrap;">
                            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                                ${cardWaReminderBtn}
                                <button type="button" class="btn-action" onclick="openTutoringScheduleSlotModal('', 1, 'individual', '${std.id}')" style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a; padding: 7px 11px; border-radius: 7px; font-weight: 800; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 4px;" title="برمجة موعد أسبوعي قار بالجدول">
                                    <span class="ui-icon" style="margin:0"><span data-lucide="calendar" data-size="14"></span></span>
                                    <span>جدول الحصص</span>
                                </button>
                                <button type="button" class="btn-action" onclick="openTutoringSessionModal('${std.id}')" style="background: #fef08a; color: #854d0e; padding: 7px 11px; border-radius: 7px; font-weight: 800; font-size: 0.8rem; border: none; display: inline-flex; align-items: center; gap: 4px;" title="إضافة حصة للتلميذ">
                                    <span class="ui-icon" style="margin:0"><span data-lucide="clock" data-size="14"></span></span>
                                    <span>+ حصة</span>
                                </button>
                                <button type="button" class="btn-action" onclick="openTutoringStatementModal('${std.id}', '${month}')" style="background: #eff6ff; color: #1d4ed8; padding: 7px 11px; border-radius: 7px; font-weight: 800; font-size: 0.8rem; border: 1px solid #bfdbfe; display: inline-flex; align-items: center; gap: 4px;" title="كشف حساب شهري PDF">
                                    <span class="ui-icon" style="margin:0"><span data-lucide="file-text" data-size="14"></span></span>
                                    <span>كشف PDF</span>
                                </button>
                                <button type="button" class="btn-action" onclick="printTutoringReceipt('${std.id}', '${month}', ${totalDue}, ${totalHours})" style="background: #ecfdf5; color: #059669; padding: 7px 11px; border-radius: 7px; font-weight: 800; font-size: 0.8rem; border: none; display: inline-flex; align-items: center; gap: 4px;" title="طباعة وصل الأداء">
                                    <span class="ui-icon" style="margin:0"><span data-lucide="receipt" data-size="14"></span></span>
                                    <span>وصل</span>
                                </button>
                            </div>
                            <div style="display: flex; gap: 6px; align-items: center; margin-right: auto;">
                                <button type="button" class="btn-action" onclick="if(typeof openTutoringStudentProfileModal==='function') openTutoringStudentProfileModal('${std.id}');" style="background: #f1f5f9; color: #334155; width: 34px; height: 34px; border-radius: 7px; border: 1px solid #cbd5e1;" title="الملف الشامل للتلميذ">
                                    <span class="ui-icon" style="margin:0"><span data-lucide="user" data-size="15"></span></span>
                                </button>
                                <button type="button" class="btn-action" onclick="editTutoringStudent('${std.id}')" style="background: #e0f2fe; color: #0284c7; width: 34px; height: 34px; border-radius: 7px; border: none;" title="تعديل بيانات التلميذ">
                                    <span class="ui-icon" style="margin:0"><span data-lucide="edit" data-size="15"></span></span>
                                </button>
                                <button type="button" class="btn-action hide-in-presentation" onclick="deleteTutoringStudent('${std.id}')" style="background: #fee2e2; color: #ef4444; width: 34px; height: 34px; border-radius: 7px; border: none;" title="حذف التلميذ">
                                    <span class="ui-icon" style="margin:0"><span data-lucide="trash-2" data-size="15"></span></span>
                                </button>
                            </div>
                        </div>
                    `;
                    cardsContainer.appendChild(card);
                }
            });

            const collectionRate = grandTotal > 0 ? Math.round((collectedTotal / grandTotal) * 100) : 0;

            if (revenueElement) revenueElement.textContent = grandTotal;
            if (collectedRevenueElement) collectedRevenueElement.textContent = collectedTotal;
            if (unpaidRevenueElement) unpaidRevenueElement.textContent = unpaidTotal;
            if (unpaidCountBadge) unpaidCountBadge.textContent = '(' + pendingStudentsCount + ' تلميذ)';
            if (totalStudentsElement) totalStudentsElement.textContent = totalStudentsCount;
            if (totalHoursElement) totalHoursElement.textContent = totalHoursAll;
            if (collectionRateLabel) collectionRateLabel.textContent = collectionRate + '%';
            if (progressBarFill) progressBarFill.style.width = collectionRate + '%';

            // Calculate and display all-time total collected revenue across all months (including std.payments, paymentRecords, paidMonths, paymentHistory)
            const allTimeRevenueElement = document.getElementById('tutoringAllTimeCollectedRevenue');
            if (allTimeRevenueElement) {
                const summary = window.computeTutoringNetProfitSummary ? window.computeTutoringNetProfitSummary(month) : { allTimeCollected: 0 };
                allTimeRevenueElement.textContent = summary.allTimeCollected;
            }

            // Outstanding balance banner alert
            const alertBanner = document.getElementById('tutoringOutstandingAlertBanner');
            const alertText = document.getElementById('tutoringOutstandingAlertText');
            if (alertBanner && alertText) {
                if (unpaidTotal > 0) {
                    alertBanner.style.display = 'flex';
                    alertText.textContent = `توجد مبالغ مستحقة ومتبقية بذمة ${pendingStudentsCount} تلاميذ بمجموع ${unpaidTotal} درهم لهذا الشهر (${month}) لم يتم استخلاصها بعد.`;
                } else {
                    alertBanner.style.display = 'none';
                }
            }

            if (typeof window.updateTutoringBatchBar === 'function') {
                window.updateTutoringBatchBar();
            }

            setTimeout(() => { if (window.renderLucide) window.renderLucide(); }, 50);
        }

        // Global State for Tutoring Payment Modal
        var currentPayStudentId = null;
        var currentPayMonth = null;

        function openTutoringPaymentModal(studentId, month) {
            currentPayStudentId = studentId;
            currentPayMonth = month || (document.getElementById('tutoringMonth') ? document.getElementById('tutoringMonth').value : '');

            const std = (db.tutoring.students || []).find(s => s.id === studentId);
            if (!std) return;

            const modal = document.getElementById('tutoringPaymentModal');
            if (!modal) return;

            // Reset edit mode if any was active
            const editIdInput = document.getElementById('payInputEditId');
            if (editIdInput) editIdInput.value = '';
            const editIndicator = document.getElementById('payModalEditIndicator');
            if (editIndicator) editIndicator.style.display = 'none';
            const cancelEditBtn = document.getElementById('payCancelEditBtn');
            if (cancelEditBtn) cancelEditBtn.style.display = 'none';
            const submitBtnText = document.getElementById('paySubmitBtnText');
            if (submitBtnText) submitBtnText.textContent = 'تسجيل الدفعة وتحديث الحساب';

            let hours = 0;
            let absentCount = 0;
            (std.sessions || []).forEach(s => {
                if (s.date && s.date.startsWith(currentPayMonth)) {
                    if (s.attendance === 'absent') {
                        absentCount++;
                        return;
                    }
                    hours += parseFloat(s.hours) || 0;
                }
            });
            const rate = parseFloat(std.fee) || 0;
            const payInfo = window.getTutoringPaymentInfo(std, currentPayMonth);

            // Populate banner
            const banner = document.getElementById('payModalStudentBanner');
            if (banner) {
                let avatarBg = payInfo.status === 'paid' ? '#dcfce7' : (payInfo.status === 'partial' ? '#fef3c7' : '#fee2e2');
                let avatarColor = payInfo.status === 'paid' ? '#15803d' : (payInfo.status === 'partial' ? '#b45309' : '#b91c1c');

                banner.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width: 38px; height: 38px; border-radius: 50%; background: ${avatarBg}; color: ${avatarColor}; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem; flex-shrink: 0;">
                                ${std.name.charAt(0)}
                            </div>
                            <div>
                                <div style="font-weight: 800; color: #0f172a; font-size: 1rem;">${std.name}</div>
                                <div style="font-size: 0.76rem; color: #64748b; display: flex; align-items: center; gap: 6px;">
                                    <span>${std.group || 'عام'}</span>
                                    •
                                    <span dir="ltr" style="font-family: monospace;">${std.phone || 'بدون هاتف'}</span>
                                </div>
                            </div>
                        </div>
                        <div style="background: #fff; padding: 4px 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 0.82rem; color: #334155;">
                            شهر: <span dir="ltr" style="color: #2563eb; font-weight: 800;">${currentPayMonth}</span>
                        </div>
                    </div>
                `;
            }

            // Populate Metrics
            const totalDueEl = document.getElementById('payModalTotalDue');
            const hoursRateEl = document.getElementById('payModalHoursRate');
            const paidAmountEl = document.getElementById('payModalPaidAmount');
            const paidPercentEl = document.getElementById('payModalPaidPercent');
            const remainingEl = document.getElementById('payModalRemaining');
            const statusBadgeEl = document.getElementById('payModalStatusBadge');
            const remainingBox = document.getElementById('payModalRemainingBox');
            const progressBar = document.getElementById('payModalProgressBar');

            if (totalDueEl) totalDueEl.textContent = payInfo.totalDue + ' د.م';
            if (hoursRateEl) {
                const bMode = std.billingMode || std.billingType || 'hourly';
                const discStr = (parseFloat(std.discountPercent) > 0) ? ` (-${std.discountPercent}%)` : '';
                if (bMode === 'monthly_fixed') {
                    hoursRateEl.textContent = `باقة شهرية قارة (${hours} س)${discStr}`;
                } else if (bMode === 'session_pack') {
                    hoursRateEl.textContent = `باقة ${std.packSessions || 4} حصص (${ payInfo.attendedSessionsCount || 0 } ح)${discStr}`;
                } else {
                    hoursRateEl.textContent = `${hours} س × ${rate} د.م${discStr}`;
                }
            }
            if (paidAmountEl) paidAmountEl.textContent = payInfo.paidAmount + ' د.م';

            const percent = payInfo.progressPercent;
            if (paidPercentEl) paidPercentEl.textContent = percent + '% مُستخلَص';
            if (progressBar) {
                progressBar.style.width = percent + '%';
                progressBar.style.background = percent === 100 ? '#10b981' : (percent > 0 ? '#f59e0b' : '#cbd5e1');
            }

            if (remainingEl) remainingEl.textContent = payInfo.remaining + ' د.م';

            if (statusBadgeEl && remainingBox) {
                if (payInfo.status === 'paid') {
                    statusBadgeEl.textContent = '✓ تم الأداء بالكامل';
                    statusBadgeEl.style.color = '#15803d';
                    remainingBox.style.background = '#f0fdf4';
                    remainingBox.style.borderColor = '#bbf7d0';
                } else if (payInfo.status === 'partial') {
                    statusBadgeEl.textContent = '⚠️ أداء جزئي (متبقي ' + payInfo.remaining + ' د.م)';
                    statusBadgeEl.style.color = '#be123c';
                    remainingBox.style.background = '#fff1f2';
                    remainingBox.style.borderColor = '#fecdd3';
                } else {
                    statusBadgeEl.textContent = 'غير مؤدى (مستحق كاملاً)';
                    statusBadgeEl.style.color = '#b91c1c';
                    remainingBox.style.background = '#fef2f2';
                    remainingBox.style.borderColor = '#fecaca';
                }
            }

            // Populate form default values
            const amountInput = document.getElementById('payInputAmount');
            const dateInput = document.getElementById('payInputDate');
            const methodInput = document.getElementById('payInputMethod');
            const noteInput = document.getElementById('payInputNote');

            if (amountInput) {
                amountInput.value = payInfo.remaining > 0 ? payInfo.remaining : '';
            }
            if (dateInput) {
                dateInput.value = window.formatLocalDate ? window.formatLocalDate() : new Date().toLocaleDateString('en-CA');
            }
            if (methodInput) {
                methodInput.value = 'نقداً (كاش)';
            }
            if (noteInput) {
                noteInput.value = '';
            }

            renderPayModalHistory(payInfo.history);
            updatePayModalLiveCalc();

            modal.style.display = 'flex';
            if (window.renderLucide) window.renderLucide();
        }

        function closeTutoringPaymentModal() {
            const modal = document.getElementById('tutoringPaymentModal');
            if (modal) modal.style.display = 'none';
            currentPayStudentId = null;
            currentPayMonth = null;
        }

        function updatePayModalLiveCalc() {
            if (!currentPayStudentId || !currentPayMonth) return;
            const std = (db.tutoring.students || []).find(s => s.id === currentPayStudentId);
            if (!std) return;

            const liveCalcBox = document.getElementById('payModalLiveCalc');
            const liveCalcText = document.getElementById('payModalLiveCalcText');
            if (!liveCalcBox || !liveCalcText) return;

            const amountInput = document.getElementById('payInputAmount');
            const enteredAmount = parseFloat(amountInput ? amountInput.value : 0) || 0;

            const editIdInput = document.getElementById('payInputEditId');
            const editId = editIdInput ? editIdInput.value : '';

            const payInfo = window.getTutoringPaymentInfo(std, currentPayMonth);
            let basePaid = payInfo.paidAmount;

            if (editId && payInfo.history) {
                const oldInst = payInfo.history.find(h => h.id === editId);
                if (oldInst) {
                    basePaid -= (parseFloat(oldInst.amount) || 0);
                }
            }

            if (enteredAmount <= 0) {
                liveCalcBox.style.display = 'none';
                return;
            }

            const projectedPaid = Math.round((basePaid + enteredAmount) * 100) / 100;
            const projectedRemaining = Math.max(0, Math.round((payInfo.totalDue - projectedPaid) * 100) / 100);
            const projectedPercent = payInfo.totalDue > 0 ? Math.min(100, Math.round((projectedPaid / payInfo.totalDue) * 100)) : 100;

            liveCalcBox.style.display = 'block';
            if (projectedRemaining === 0) {
                liveCalcText.innerHTML = `بعد تسجيل هذا المبلغ: سيتم <strong>استيفاء كامل المستحق</strong> (${projectedPaid} د.م بنسبة 100%) ويكون الحساب مؤدى بالكامل! 🎉`;
            } else {
                liveCalcText.innerHTML = `بعد هذه الدفعة: سيصبح مجموع المؤدى <strong style="color: #15803d;">${projectedPaid} د.م (${projectedPercent}%)</strong>، والمتبقي بذمة التلميذ: <strong style="color: #b91c1c;">${projectedRemaining} د.م</strong>.`;
            }
        }

        function setPayModalPreset(type) {
            if (!currentPayStudentId || !currentPayMonth) return;
            const std = (db.tutoring.students || []).find(s => s.id === currentPayStudentId);
            if (!std) return;

            const payInfo = window.getTutoringPaymentInfo(std, currentPayMonth);
            const amountInput = document.getElementById('payInputAmount');
            if (!amountInput) return;

            if (type === 'half') {
                amountInput.value = Math.max(1, Math.round((payInfo.remaining / 2) * 100) / 100);
            } else if (type === 'all') {
                amountInput.value = payInfo.remaining;
            } else if (type === '+20') {
                const cur = parseFloat(amountInput.value) || 0;
                amountInput.value = cur + 20;
            } else if (type === '+50') {
                const cur = parseFloat(amountInput.value) || 0;
                amountInput.value = cur + 50;
            } else if (type === '+100') {
                const cur = parseFloat(amountInput.value) || 0;
                amountInput.value = cur + 100;
            } else if (type === '+200') {
                const cur = parseFloat(amountInput.value) || 0;
                amountInput.value = cur + 200;
            }
            updatePayModalLiveCalc();
        }

        function editTutoringPaymentInstallment(installmentId) {
            if (!currentPayStudentId || !currentPayMonth) return;
            const std = (db.tutoring.students || []).find(s => s.id === currentPayStudentId);
            if (!std || !std.payments || typeof std.payments[currentPayMonth] !== 'object') return;

            const history = std.payments[currentPayMonth].history || [];
            const inst = history.find(h => h.id === installmentId);
            if (!inst) return;

            const editIdInput = document.getElementById('payInputEditId');
            if (editIdInput) editIdInput.value = installmentId;

            const amountInput = document.getElementById('payInputAmount');
            if (amountInput) amountInput.value = inst.amount || '';

            const dateInput = document.getElementById('payInputDate');
            if (dateInput) dateInput.value = inst.date || '';

            const methodInput = document.getElementById('payInputMethod');
            if (methodInput) methodInput.value = inst.method || 'نقداً (كاش)';

            const noteInput = document.getElementById('payInputNote');
            if (noteInput) noteInput.value = inst.note || '';

            const editIndicator = document.getElementById('payModalEditIndicator');
            if (editIndicator) editIndicator.style.display = 'inline-block';

            const cancelEditBtn = document.getElementById('payCancelEditBtn');
            if (cancelEditBtn) cancelEditBtn.style.display = 'inline-flex';

            const submitBtnText = document.getElementById('paySubmitBtnText');
            if (submitBtnText) submitBtnText.textContent = 'حفظ تعديلات هذه الدفعة';

            updatePayModalLiveCalc();
            if (amountInput) amountInput.focus();
        }

        function cancelTutoringEditInstallment() {
            const editIdInput = document.getElementById('payInputEditId');
            if (editIdInput) editIdInput.value = '';

            const editIndicator = document.getElementById('payModalEditIndicator');
            if (editIndicator) editIndicator.style.display = 'none';

            const cancelEditBtn = document.getElementById('payCancelEditBtn');
            if (cancelEditBtn) cancelEditBtn.style.display = 'none';

            const submitBtnText = document.getElementById('paySubmitBtnText');
            if (submitBtnText) submitBtnText.textContent = 'تسجيل الدفعة وتحديث الحساب';

            if (currentPayStudentId && currentPayMonth) {
                const std = (db.tutoring.students || []).find(s => s.id === currentPayStudentId);
                if (std) {
                    const payInfo = window.getTutoringPaymentInfo(std, currentPayMonth);
                    const amountInput = document.getElementById('payInputAmount');
                    if (amountInput) amountInput.value = payInfo.remaining > 0 ? payInfo.remaining : '';
                }
            }
            updatePayModalLiveCalc();
        }

        function renderPayModalHistory(history) {
            const historyList = document.getElementById('payModalHistoryList');
            const countBadge = document.getElementById('payModalInstallmentCount');
            if (!historyList) return;

            if (!history || history.length === 0) {
                if (countBadge) countBadge.textContent = '0 دفعة';
                historyList.innerHTML = '<div style="text-align: center; color: #94a3b8; font-size: 0.8rem; padding: 14px; background: #fff; border-radius: 8px; border: 1px dashed #cbd5e1;">لا توجد دفعات مفصلة مسجلة بعد لهذا الشهر. استخدم النموذج أعلاه لتسجيل أول دفعة.</div>';
                return;
            }

            if (countBadge) countBadge.textContent = history.length + ' دفعة';
            let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
            history.forEach((item, idx) => {
                const methodBadge = item.method ? `<span style="color: #0369a1; background: #e0f2fe; padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 700;">${escapeTutoringHtml(item.method)}</span>` : '';
                const noteBadge = item.note ? `<span style="color: #475569; background: #f1f5f9; padding: 2px 7px; border-radius: 4px; font-size: 0.72rem;">${escapeTutoringHtml(item.note)}</span>` : '';

                html += `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; font-size: 0.82rem; box-shadow: 0 1px 2px rgba(0,0,0,0.02); transition: all 0.2s;">
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span style="background: #f0fdf4; color: #166534; font-weight: 800; padding: 2px 7px; border-radius: 4px; border: 1px solid #bbf7d0; font-size: 0.72rem;">دفعة #${idx + 1}</span>
                            <span style="font-weight: 900; color: #0f172a; font-size: 0.92rem;">${item.amount} د.م</span>
                            <span style="color: #64748b; font-size: 0.76rem;" dir="ltr">${item.date || ''}</span>
                            ${methodBadge}
                            ${noteBadge}
                        </div>
                        <div style="display: flex; gap: 5px; align-items: center;">
                            <button type="button" onclick="editTutoringPaymentInstallment('${item.id}')" style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #334155; border-radius: 6px; padding: 3px 8px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; font-size: 0.74rem; font-weight: 700;" title="تعديل بيانات هذه الدفعة">
                                ✏️ تعديل
                            </button>
                            <button type="button" onclick="deleteTutoringPaymentInstallment('${item.id}')" style="background: #fee2e2; border: 1px solid #fecaca; color: #b91c1c; border-radius: 6px; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.8rem;" title="حذف هذه الدفعة">
                                ✕
                            </button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            historyList.innerHTML = html;
        }

        var _isSubmittingTutoringPayment = false;
        function submitTutoringPartialPayment() {
            if (_isSubmittingTutoringPayment) return;
            if (!currentPayStudentId || !currentPayMonth) return;
            const std = (db.tutoring.students || []).find(s => s.id === currentPayStudentId);
            if (!std) return;

            const amountInput = document.getElementById('payInputAmount');
            const dateInput = document.getElementById('payInputDate');
            const methodInput = document.getElementById('payInputMethod');
            const noteInput = document.getElementById('payInputNote');
            const editIdInput = document.getElementById('payInputEditId');

            const enteredAmount = parseFloat(amountInput ? amountInput.value : 0) || 0;
            if (enteredAmount <= 0) {
                window.notifySafeToast('يرجى إدخال مبلغ صحيح أكبر من الصفر');
                return;
            }

            _isSubmittingTutoringPayment = true;
            const unlock = () => { setTimeout(() => { _isSubmittingTutoringPayment = false; }, 400); };

            const payDate = dateInput && dateInput.value ? dateInput.value : (window.formatLocalDate ? window.formatLocalDate() : new Date().toLocaleDateString('en-CA'));
            const payMethod = methodInput ? methodInput.value : 'نقداً (كاش)';
            const payNote = noteInput ? noteInput.value.trim() : '';
            const editId = editIdInput ? editIdInput.value : '';

            if (!std.payments) std.payments = {};
            const payInfo = window.getTutoringPaymentInfo(std, currentPayMonth);

            let history = [];
            if (typeof std.payments[currentPayMonth] === 'object' && Array.isArray(std.payments[currentPayMonth].history)) {
                history = [...std.payments[currentPayMonth].history];
            } else if (payInfo.paidAmount > 0) {
                history = [{
                    id: 'inst_init_' + Date.now(),
                    amount: payInfo.paidAmount,
                    date: payDate,
                    method: 'نقداً (كاش)',
                    note: 'دفعة سابقة مسجلة'
                }];
            }

            if (editId) {
                // Edit existing installment
                const editIdx = history.findIndex(h => h.id === editId);
                if (editIdx >= 0) {
                    history[editIdx] = {
                        ...history[editIdx],
                        amount: enteredAmount,
                        date: payDate,
                        method: payMethod,
                        note: payNote
                    };
                }
            } else {
                // Add new installment
                history.push({
                    id: 'inst_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                    amount: enteredAmount,
                    date: payDate,
                    method: payMethod,
                    note: payNote || 'دفعة جزئية'
                });
            }

            let newTotal = 0;
            history.forEach(item => newTotal += (parseFloat(item.amount) || 0));
            newTotal = Math.round(newTotal * 100) / 100;

            std.payments[currentPayMonth] = {
                amount: newTotal,
                status: (newTotal >= payInfo.totalDue && payInfo.totalDue > 0) ? 'paid' : (newTotal > 0 ? 'partial' : 'unpaid'),
                history: history,
                note: payNote
            };

            saveDB();
            renderTutoringStudents();
            openTutoringPaymentModal(currentPayStudentId, currentPayMonth);
            unlock();
        }

        function submitTutoringFullPayment() {
            if (_isSubmittingTutoringPayment) return;
            if (!currentPayStudentId || !currentPayMonth) return;
            const std = (db.tutoring.students || []).find(s => s.id === currentPayStudentId);
            if (!std) return;

            _isSubmittingTutoringPayment = true;
            const unlock = () => { setTimeout(() => { _isSubmittingTutoringPayment = false; }, 400); };

            if (!std.payments) std.payments = {};
            const payInfo = window.getTutoringPaymentInfo(std, currentPayMonth);

            let history = [];
            if (typeof std.payments[currentPayMonth] === 'object' && Array.isArray(std.payments[currentPayMonth].history)) {
                history = [...std.payments[currentPayMonth].history];
            }

            const remaining = payInfo.remaining;
            if (remaining > 0) {
                history.push({
                    id: 'inst_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                    amount: remaining,
                    date: window.formatLocalDate ? window.formatLocalDate() : new Date().toLocaleDateString('en-CA'),
                    method: 'نقداً (كاش)',
                    note: 'استكمال الأداء بالكامل'
                });
            }

            std.payments[currentPayMonth] = {
                amount: payInfo.totalDue,
                status: 'paid',
                history: history,
                note: 'تم الأداء بالكامل'
            };

            saveDB();
            renderTutoringStudents();
            openTutoringPaymentModal(currentPayStudentId, currentPayMonth);
            unlock();
        }

        async function submitTutoringResetPayment() {
            if (!currentPayStudentId || !currentPayMonth) return;
            if (typeof window.showConfirmDialog === 'function') {
                const ok = await window.showConfirmDialog('هل أنت متأكد من رغبتك في إلغاء وتصفير جميع الدفعات لهذا الشهر وإعادة الحالة إلى غير مؤدى؟');
                if (!ok) return;
            }

            const std = (db.tutoring.students || []).find(s => s.id === currentPayStudentId);
            if (!std) return;

            if (!std.payments) std.payments = {};
            std.payments[currentPayMonth] = {
                amount: 0,
                status: 'unpaid',
                history: [],
                note: ''
            };

            saveDB();
            renderTutoringStudents();
            openTutoringPaymentModal(currentPayStudentId, currentPayMonth);
        }

        async function deleteTutoringPaymentInstallment(installmentId) {
            if (!currentPayStudentId || !currentPayMonth) return;
            if (typeof window.showConfirmDialog === 'function') {
                const ok = await window.showConfirmDialog('هل أنت متأكد من حذف هذه الدفعة؟');
                if (!ok) return;
            }

            const std = (db.tutoring.students || []).find(s => s.id === currentPayStudentId);
            if (!std || !std.payments || typeof std.payments[currentPayMonth] !== 'object') return;

            const history = std.payments[currentPayMonth].history || [];
            const newHistory = history.filter(item => item.id !== installmentId);
            let newTotal = 0;
            newHistory.forEach(item => newTotal += (parseFloat(item.amount) || 0));
            newTotal = Math.round(newTotal * 100) / 100;

            const payInfo = window.getTutoringPaymentInfo(std, currentPayMonth);
            std.payments[currentPayMonth].history = newHistory;
            std.payments[currentPayMonth].amount = newTotal;
            std.payments[currentPayMonth].status = (newTotal >= payInfo.totalDue && payInfo.totalDue > 0) ? 'paid' : (newTotal > 0 ? 'partial' : 'unpaid');

            saveDB();
            renderTutoringStudents();
            openTutoringPaymentModal(currentPayStudentId, currentPayMonth);
        }

        function printReceiptFromModal() {
            if (!currentPayStudentId || !currentPayMonth) return;
            const std = (db.tutoring.students || []).find(s => s.id === currentPayStudentId);
            if (!std) return;

            let hours = 0;
            (std.sessions || []).forEach(s => {
                if (s.date && s.date.startsWith(currentPayMonth)) {
                    if (s.attendance !== 'absent') hours += parseFloat(s.hours) || 0;
                }
            });
            const payInfo = window.getTutoringPaymentInfo(std, currentPayMonth);
            const totalDue = payInfo.totalDue;

            printTutoringReceipt(currentPayStudentId, currentPayMonth, totalDue, hours);
        }

        // Export modal functions to window for onclick handlers
        window.openTutoringPaymentModal = openTutoringPaymentModal;
        window.closeTutoringPaymentModal = closeTutoringPaymentModal;
        window.updatePayModalLiveCalc = updatePayModalLiveCalc;
        window.setPayModalPreset = setPayModalPreset;
        window.editTutoringPaymentInstallment = editTutoringPaymentInstallment;
        window.cancelTutoringEditInstallment = cancelTutoringEditInstallment;
        window.submitTutoringPartialPayment = submitTutoringPartialPayment;
        window.submitTutoringFullPayment = submitTutoringFullPayment;
        window.submitTutoringResetPayment = submitTutoringResetPayment;
        window.deleteTutoringPaymentInstallment = deleteTutoringPaymentInstallment;
        window.printReceiptFromModal = printReceiptFromModal;

        function toggleTutoringPayment(studentId, month) {
            openTutoringPaymentModal(studentId, month);
        }

        function escapeTutoringHtml(str) {
            if (str === undefined || str === null) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }
        window.escapeTutoringHtml = escapeTutoringHtml;

        // Digital Library Resource Linker for Tutoring Sessions
        window.renderTutoringLibraryLinker = function(containerId, preselectedResources, levelHint, searchTerm) {
            const container = document.getElementById(containerId);
            if (!container) return;

            const currentDb = window.db || (typeof db !== 'undefined' ? db : null);
            const libItems = (currentDb && Array.isArray(currentDb.library)) ? currentDb.library : [];
            const selectedMap = new Map();
            (Array.isArray(preselectedResources) ? preselectedResources : []).forEach(r => {
                if (r && r.id) selectedMap.set(r.id, r);
            });

            // Preserve any currently checked items if re-rendering on search
            container.querySelectorAll('input.tut-lib-res-cb:checked').forEach(cb => {
                const id = cb.value;
                if (!selectedMap.has(id)) {
                    selectedMap.set(id, {
                        id,
                        title: cb.getAttribute('data-title') || '',
                        url: cb.getAttribute('data-url') || '',
                        category: cb.getAttribute('data-category') || 'مورد'
                    });
                }
            });

            const q = (searchTerm || '').trim().toLowerCase();
            const lvl = (levelHint || '').trim().toLowerCase();
            let filtered = libItems.filter(item => item && (item.title || item.fileName));
            if (q) {
                filtered = filtered.filter(item =>
                    ((item.title || '') + ' ' + (item.course || '') + ' ' + (item.category || '') + ' ' + (item.level || '')).toLowerCase().includes(q)
                );
            } else if (lvl) {
                // Prioritize matching level first
                filtered = [...filtered].sort((a, b) => {
                    const aMatch = (a.level || '').toLowerCase().includes(lvl) || (a.course || '').toLowerCase().includes(lvl) ? 0 : 1;
                    const bMatch = (b.level || '').toLowerCase().includes(lvl) || (b.course || '').toLowerCase().includes(lvl) ? 0 : 1;
                    return aMatch - bMatch;
                });
            }

            const visibleItems = filtered.slice(0, 24);
            const selectedArr = Array.from(selectedMap.values());

            container.innerHTML = `
                <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
                        <div style="font-size: 0.82rem; font-weight: 800; color: #1e3a8a; display: flex; align-items: center; gap: 6px;">
                            <span>📚 ربط موارد من المكتبة الرقمية (${selectedArr.length} محدد):</span>
                        </div>
                        <input type="text" placeholder="🔍 بحث في المكتبة (سلسلة، درس، ملخص...)" value="${escapeTutoringHtml(searchTerm || '')}"
                            oninput="window.renderTutoringLibraryLinker('${containerId}', window.getSelectedTutoringLibraryResources('${containerId}'), '${escapeTutoringHtml(levelHint || '')}', this.value)"
                            style="margin: 0; padding: 4px 10px; font-size: 0.76rem; border: 1px solid #cbd5e1; border-radius: 6px; min-width: 210px; background: #fff;">
                    </div>
                    ${selectedArr.length > 0 ? `
                        <div style="display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 8px;">
                            ${selectedArr.map(r => `<span style="background: #dbeafe; color: #1e40af; border: 1px solid #93c5fd; padding: 2px 8px; border-radius: 99px; font-size: 0.72rem; font-weight: 800;">📎 ${escapeTutoringHtml(r.title)}</span>`).join('')}
                        </div>
                    ` : ''}
                    ${visibleItems.length === 0 ? `
                        <div style="font-size: 0.76rem; color: #64748b; text-align: center; padding: 8px;">
                            ${libItems.length === 0 ? 'المكتبة الرقمية فارغة حالياً — أضف ملفات أو روابط من تبويب المكتبة الرقمية.' : 'لا توجد موارد مطابقة للبحث.'}
                        </div>
                    ` : `
                        <div style="max-height: 125px; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 6px; padding-left: 2px;">
                            ${visibleItems.map(item => {
                                const isChecked = selectedMap.has(item.id);
                                const title = item.title || item.fileName || 'مورد بدون عنوان';
                                const url = item.url || item.downloadUrl || '';
                                const cat = item.category || item.type || 'مورد';
                                return `
                                    <label style="display: flex; align-items: center; gap: 6px; background: ${isChecked ? '#eff6ff' : '#fff'}; border: 1px solid ${isChecked ? '#60a5fa' : '#e2e8f0'}; padding: 5px 8px; border-radius: 7px; cursor: pointer; font-size: 0.75rem; margin: 0;">
                                        <input type="checkbox" class="tut-lib-res-cb" value="${escapeTutoringHtml(item.id)}"
                                            data-title="${escapeTutoringHtml(title)}"
                                            data-url="${escapeTutoringHtml(url)}"
                                            data-category="${escapeTutoringHtml(cat)}"
                                            ${isChecked ? 'checked' : ''}
                                            onchange="const box=this.closest('label'); if(box){ box.style.background=this.checked?'#eff6ff':'#fff'; box.style.borderColor=this.checked?'#60a5fa':'#e2e8f0'; }"
                                            style="width: 14px; height: 14px; accent-color: #2563eb; flex-shrink: 0;">
                                        <span style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; color: #1e293b;" title="${escapeTutoringHtml(title)}">${escapeTutoringHtml(title)}</span>
                                        <span style="font-size: 0.66rem; background: #f1f5f9; color: #475569; padding: 1px 5px; border-radius: 4px; flex-shrink: 0;">${escapeTutoringHtml(cat)}</span>
                                    </label>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
            `;
        };

        window.getSelectedTutoringLibraryResources = function(containerId) {
            const container = document.getElementById(containerId);
            if (!container) return [];
            const res = [];
            container.querySelectorAll('input.tut-lib-res-cb:checked').forEach(cb => {
                res.push({
                    id: cb.value,
                    title: cb.getAttribute('data-title') || '',
                    url: cb.getAttribute('data-url') || '',
                    category: cb.getAttribute('data-category') || 'مورد'
                });
            });
            return res;
        };

        function setSessionHours(val) {
            const input = document.getElementById('sessionHours');
            if (input) {
                input.value = val;
                updateSessionLiveCalc();
            }
        }

        function setSessionTopicPreset(topicText) {
            const input = document.getElementById('sessionTopic');
            if (input) {
                input.value = topicText;
                input.focus();
            }
        }

        function setSessionDatePreset(preset) {
            const dateInput = document.getElementById('sessionDate');
            if (!dateInput) return;
            const now = new Date();
            if (preset === 'today') {
                dateInput.value = window.formatLocalDate ? window.formatLocalDate() : now.toLocaleDateString('en-CA');
            } else if (preset === 'yesterday') {
                const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                dateInput.value = window.formatLocalDate ? window.formatLocalDate(yest) : yest.toLocaleDateString('en-CA');
            }
            updateSessionLiveCalc();
        }

        function updateSessionLiveCalc() {
            const select = document.getElementById('sessionStudentSelect');
            const hiddenId = document.getElementById('sessionStudentId');
            const modeInput = document.getElementById('sessionStudentMode');
            const isNewMode = modeInput && modeInput.value === 'new';

            const studentId = (select && select.value) || (hiddenId && hiddenId.value);
            const hoursInput = document.getElementById('sessionHours');
            const attSelect = document.getElementById('sessionAttendance');
            const previewEl = document.getElementById('sessionLiveDuePreview');
            if (!previewEl) return;

            const att = attSelect ? attSelect.value : 'present';
            const hours = hoursInput ? (parseFloat(hoursInput.value) || 0) : 0;

            let rate = 0;
            if (isNewMode) {
                const newFeeInput = document.getElementById('sessionNewStudentFee');
                rate = newFeeInput ? (parseFloat(newFeeInput.value) || 150) : 150;
            } else {
                const std = (db.tutoring.students || []).find(s => s.id === studentId);
                rate = std ? (parseFloat(std.fee) || 0) : 0;
            }

            if (att === 'absent' || att === 'excused') {
                previewEl.textContent = 'واجب الحصة: 0 د.م (تلميذ غائب - لا يُحتسب)';
                previewEl.style.background = '#fef2f2';
                previewEl.style.borderColor = '#fecaca';
                previewEl.style.color = '#dc2626';
            } else {
                const sessionCost = Math.round(hours * rate * 100) / 100;
                previewEl.textContent = 'واجب الحصة: ' + sessionCost + ' د.م (' + rate + ' د.م/س)';
                previewEl.style.background = '#ecfdf5';
                previewEl.style.borderColor = '#a7f3d0';
                previewEl.style.color = '#059669';
            }
        }

        window.setSessionStudentMode = function(mode) {
            const modeInput = document.getElementById('sessionStudentMode');
            if (modeInput) modeInput.value = mode;

            const btnExist = document.getElementById('sessionStudentModeBtnExisting');
            const btnNew = document.getElementById('sessionStudentModeBtnNew');
            const boxExist = document.getElementById('sessionStudentExistingContainer');
            const boxNew = document.getElementById('sessionStudentNewContainer');

            if (mode === 'new') {
                if (btnExist) {
                    btnExist.style.background = 'transparent';
                    btnExist.style.color = '#475569';
                    btnExist.style.boxShadow = 'none';
                }
                if (btnNew) {
                    btnNew.style.background = '#fff';
                    btnNew.style.color = '#b45309';
                    btnNew.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                }
                if (boxExist) boxExist.style.display = 'none';
                if (boxNew) boxNew.style.display = 'block';
                const nameInp = document.getElementById('sessionNewStudentName');
                if (nameInp) setTimeout(() => nameInp.focus(), 60);
            } else {
                if (btnExist) {
                    btnExist.style.background = '#fff';
                    btnExist.style.color = '#0f172a';
                    btnExist.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                }
                if (btnNew) {
                    btnNew.style.background = 'transparent';
                    btnNew.style.color = '#475569';
                    btnNew.style.boxShadow = 'none';
                }
                if (boxExist) boxExist.style.display = 'block';
                if (boxNew) boxNew.style.display = 'none';
            }
            updateSessionLiveCalc();
        };

        function onIndividualSessionAttendanceChange() {
            const attSelect = document.getElementById('sessionAttendance');
            if (!attSelect) return;
            const val = attSelect.value;
            if (val === 'present') {
                attSelect.style.backgroundColor = '#ecfdf5';
                attSelect.style.borderColor = '#a7f3d0';
                attSelect.style.color = '#059669';
            } else if (val === 'absent') {
                attSelect.style.backgroundColor = '#fef2f2';
                attSelect.style.borderColor = '#fecaca';
                attSelect.style.color = '#dc2626';
            } else if (val === 'excused') {
                attSelect.style.backgroundColor = '#fefce8';
                attSelect.style.borderColor = '#fef08a';
                attSelect.style.color = '#ca8a04';
            } else if (val === 'late') {
                attSelect.style.backgroundColor = '#fff7ed';
                attSelect.style.borderColor = '#fed7aa';
                attSelect.style.color = '#ea580c';
            }
            updateSessionLiveCalc();
        }

        function filterSessionStudentOptions(selectedGroup) {
            const select = document.getElementById('sessionStudentSelect');
            if (!select) return;
            const students = db.tutoring.students || [];
            const sorted = [...students].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));

            const filtered = (!selectedGroup || selectedGroup === 'all')
                ? sorted
                : sorted.filter(s => s.group === selectedGroup);

            let options = '';
            filtered.forEach(std => {
                const grp = std.group ? ` (${escapeTutoringHtml(std.group)})` : '';
                options += `<option value="${escapeTutoringHtml(std.id)}">${escapeTutoringHtml(std.name)}${grp}</option>`;
            });

            if (filtered.length === 0) {
                options = '<option value="">لا يوجد تلاميذ في هذه المجموعة</option>';
            }

            select.innerHTML = options;
            if (filtered.length > 0) {
                select.value = filtered[0].id;
            }
            onTutoringSessionStudentChange();
        }

        function openAddIndividualTutoringSessionModal(studentId) {
            openTutoringSessionModal(studentId);
        }

        function editTutoringSingleSession(studentId, sessionId) {
            const std = (db.tutoring.students || []).find(s => s.id === studentId);
            if (!std || !std.sessions) return;
            const sess = std.sessions.find(s => s.id === sessionId);
            if (!sess) return;

            openTutoringSessionModal(studentId, sess);
        }

        function openTutoringSessionModal(studentId, sessionToEdit) {
            initTutoring();
            const modal = document.getElementById('tutoringSessionModal');
            const select = document.getElementById('sessionStudentSelect');
            const hiddenId = document.getElementById('sessionStudentId');
            const editHiddenId = document.getElementById('editingSessionId');
            const modalTitle = document.getElementById('tutoringSessionModalTitle');
            const groupFilter = document.getElementById('sessionModalGroupFilter');
            if (!modal) return;

            const students = db.tutoring.students || [];

            if (editHiddenId) {
                editHiddenId.value = (sessionToEdit && sessionToEdit.id) ? sessionToEdit.id : '';
            }

            if (modalTitle) {
                if (sessionToEdit && sessionToEdit.id) {
                    modalTitle.innerHTML = '<span class="ui-icon" style="color: #3b82f6;"><span data-lucide="edit-3" data-size="20"></span></span> تعديل بيانات حصة الدعم الفردية';
                } else {
                    modalTitle.innerHTML = '<span class="ui-icon" style="color: #f59e0b;"><span data-lucide="clock" data-size="20"></span></span> تسجيل حصة دعم فردية مباشرة (مستقلة)';
                }
            }

            // Decide default mode: if no students registered, auto-switch to new independent student mode
            if (!students || students.length === 0) {
                window.setSessionStudentMode('new');
            } else {
                window.setSessionStudentMode('existing');
            }

            // Reset new student direct inputs
            const newNameInput = document.getElementById('sessionNewStudentName');
            const newPhoneInput = document.getElementById('sessionNewStudentPhone');
            const newFeeInput = document.getElementById('sessionNewStudentFee');
            if (newNameInput) newNameInput.value = '';
            if (newPhoneInput) newPhoneInput.value = '';
            if (newFeeInput) newFeeInput.value = '150';

            // Populate group filter dropdown
            if (groupFilter) {
                const groups = new Set();
                students.forEach(s => { if (s.group) groups.add(s.group); });
                let grpHtml = '<option value="all">كل المجموعات (' + students.length + ')</option>';
                Array.from(groups).sort().forEach(g => {
                    const count = students.filter(s => s.group === g).length;
                    grpHtml += `<option value="${escapeTutoringHtml(g)}">${escapeTutoringHtml(g)} (${count})</option>`;
                });
                groupFilter.innerHTML = grpHtml;
                groupFilter.value = 'all';
            }

            // Populate student dropdown
            if (select) {
                let options = '';
                const sorted = [...students].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
                sorted.forEach(std => {
                    const grp = std.group ? ` (${escapeTutoringHtml(std.group)})` : '';
                    options += `<option value="${escapeTutoringHtml(std.id)}">${escapeTutoringHtml(std.name)}${grp}</option>`;
                });
                select.innerHTML = options;

                if (studentId) {
                    select.value = studentId;
                } else if (sorted.length > 0) {
                    select.value = sorted[0].id;
                }
            }

            const chosenStudentId = studentId || (select ? select.value : '');
            if (hiddenId) hiddenId.value = chosenStudentId;

            // Reset/init inputs
            const dateInput = document.getElementById('sessionDate');
            if (dateInput) {
                dateInput.value = sessionToEdit ? (sessionToEdit.date || '') : (window.formatLocalDate ? window.formatLocalDate() : new Date().toLocaleDateString('en-CA'));
            }
            const timeInput = document.getElementById('sessionTime');
            if (timeInput) {
                timeInput.value = sessionToEdit ? (sessionToEdit.time || '18:00') : '18:00';
            }
            const hoursInput = document.getElementById('sessionHours');
            if (hoursInput) {
                hoursInput.value = sessionToEdit ? (sessionToEdit.hours || 2) : '2';
            }
            const topicInput = document.getElementById('sessionTopic');
            if (topicInput) {
                topicInput.value = sessionToEdit ? (sessionToEdit.topic || '') : '';
            }

            // Pedagogical tracking fields
            const attSelect = document.getElementById('sessionAttendance');
            if (attSelect) {
                attSelect.value = sessionToEdit ? (sessionToEdit.attendance || 'present') : 'present';
            }
            const homeworkInput = document.getElementById('sessionHomework');
            if (homeworkInput) {
                homeworkInput.value = sessionToEdit ? (sessionToEdit.homework || '') : '';
            }
            const evalSelect = document.getElementById('sessionEvaluation');
            if (evalSelect) {
                evalSelect.value = sessionToEdit ? (sessionToEdit.evaluation || 'good') : 'good';
            }
            const evalNotesInput = document.getElementById('sessionEvaluationNotes');
            if (evalNotesInput) {
                evalNotesInput.value = sessionToEdit ? (sessionToEdit.evaluationNotes || '') : '';
            }

            modal.style.display = 'flex';
            onIndividualSessionAttendanceChange();
            onTutoringSessionStudentChange();
            const chosenStdObj = students.find(s => s.id === chosenStudentId);
            if (typeof window.renderTutoringLibraryLinker === 'function') {
                window.renderTutoringLibraryLinker(
                    'sessionLibraryLinkerContainer',
                    (sessionToEdit && Array.isArray(sessionToEdit.attachedResources)) ? sessionToEdit.attachedResources : [],
                    chosenStdObj ? (chosenStdObj.level || '') : ''
                );
            }
            updateSessionLiveCalc();
            if (window.renderLucide) window.renderLucide();
        }

        function onTutoringSessionStudentChange() {
            const select = document.getElementById('sessionStudentSelect');
            const hiddenId = document.getElementById('sessionStudentId');
            const badge = document.getElementById('sessionStudentInfoBadge');
            if (!select) return;

            const studentId = select.value;
            if (hiddenId) hiddenId.value = studentId;

            const std = (db.tutoring.students || []).find(s => s.id === studentId);
            if (!std) {
                if (badge) badge.style.display = 'none';
                renderStudentSessionsList(null);
                updateSessionLiveCalc();
                return;
            }

            // Calculate current month hours for this student
            const monthInput = document.getElementById('tutoringMonth');
            const curMonth = (monthInput && monthInput.value) ? monthInput.value : (window.formatLocalMonth ? window.formatLocalMonth() : (window.formatLocalDate ? window.formatLocalDate().slice(0, 7) : new Date().toISOString().slice(0, 7)));
            let monthHours = 0;
            (std.sessions || []).forEach(s => {
                if (s.date && s.date.startsWith(curMonth)) {
                    if (s.attendance === 'absent') return;
                    monthHours += parseFloat(s.hours) || 0;
                }
            });
            const rate = parseFloat(std.fee) || 0;
            const payInfo = window.getTutoringPaymentInfo ? window.getTutoringPaymentInfo(std, curMonth) : { totalDue: monthHours * rate, paidAmount: 0, remaining: monthHours * rate };
            const due = payInfo.totalDue;

            if (badge) {
                badge.style.display = 'flex';
                badge.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span style="font-weight: 800;">المجموعة: <span style="color: #1e293b;">${escapeTutoringHtml(std.group || 'عام')}</span></span>
                        <span>•</span>
                        <span style="font-weight: 800;">سعر الساعة: <span style="color: #059669;">${rate} د.م</span></span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span>إنجاز (${curMonth}): <b>${monthHours} س</b> (${due} د.م)</span>
                        <span style="background: ${payInfo.remaining > 0 ? '#fef2f2' : '#ecfdf5'}; color: ${payInfo.remaining > 0 ? '#b91c1c' : '#15803d'}; font-weight: 800; padding: 2px 8px; border-radius: 6px; font-size: 0.76rem; border: 1px solid ${payInfo.remaining > 0 ? '#fecaca' : '#a7f3d0'};">
                            ${payInfo.remaining > 0 ? 'متبقي: ' + payInfo.remaining + ' د.م' : 'تم الأداء بالكامل'}
                        </span>
                    </div>
                `;
            }

            const editHidden = document.getElementById('editingSessionId');
            if ((!editHidden || !editHidden.value) && typeof window.renderTutoringLibraryLinker === 'function') {
                const currentlySelected = window.getSelectedTutoringLibraryResources ? window.getSelectedTutoringLibraryResources('sessionLibraryLinkerContainer') : [];
                window.renderTutoringLibraryLinker('sessionLibraryLinkerContainer', currentlySelected, std.level || '');
            }

            renderStudentSessionsList(studentId);
            updateSessionLiveCalc();
        }

        function closeTutoringSessionModal() {
            const modal = document.getElementById('tutoringSessionModal');
            const editHiddenId = document.getElementById('editingSessionId');
            if (editHiddenId) editHiddenId.value = '';
            if (modal) modal.style.display = 'none';
        }

        function renderStudentSessionsList(studentId) {
            const listDiv = document.getElementById('studentSessionsList');
            if (!listDiv) return;
            if (!studentId) {
                listDiv.innerHTML = '';
                return;
            }

            const std = (db.tutoring.students || []).find(s => s.id === studentId);
            if (!std || !std.sessions || std.sessions.length === 0) {
                listDiv.innerHTML = '<div style="text-align:center; color:#64748b; font-size:0.83rem; padding:12px; background:#f8fafc; border-radius:8px; border:1px dashed #cbd5e1;">لا توجد حصص سابقة مسجلة لهذا التلميذ حتى الآن. سيتم احتساب أول حصة عند الحفظ.</div>';
                return;
            }

            const sortedSessions = [...std.sessions].sort((a, b) => new Date(b.date) - new Date(a.date));
            const totalAllHours = sortedSessions.reduce((sum, s) => sum + (parseFloat(s.hours) || 0), 0);

            let html = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <h4 style="font-size:0.88rem; color:#334155; margin:0; font-family:'Cairo', sans-serif; display:flex; align-items:center; gap:6px; font-weight: 800;">
                        <span class="ui-icon" style="color:#3b82f6;"><span data-lucide="calendar" data-size="15"></span></span>
                        <span>سجل الحصص السابقة للتلميذ (${sortedSessions.length} حصة):</span>
                    </h4>
                    <span style="font-size:0.78rem; background:#eff6ff; color:#1d4ed8; font-weight:800; padding:3px 9px; border-radius:6px; border: 1px solid #bfdbfe;">مجموع الساعات: ${totalAllHours} س</span>
                </div>
                <div style="display:flex; flex-direction:column; gap:6px; max-height:180px; overflow-y:auto; padding-left:4px;">
            `;

            sortedSessions.forEach(s => {
                let dayName = '';
                let dateFormatted = s.date;
                try {
                    const dateObj = new Date(s.date + 'T00:00:00');
                    dayName = dateObj.toLocaleDateString('ar-MA', { weekday: 'long' });
                    dateFormatted = dateObj.toLocaleDateString('ar-MA', { year: 'numeric', month: '2-digit', day: '2-digit' });
                } catch(e) {
                    dayName = '';
                }

                // Attendance badge
                let attBadge = '';
                if (s.attendance === 'absent') {
                    attBadge = '<span style="background:#fee2e2; color:#b91c1c; font-size:0.72rem; font-weight:800; padding:2px 7px; border-radius:4px; border:1px solid #fca5a5;">❌ غائب (0 س)</span>';
                } else if (s.attendance === 'excused') {
                    attBadge = '<span style="background:#fef3c7; color:#b45309; font-size:0.72rem; font-weight:800; padding:2px 7px; border-radius:4px; border:1px solid #fde68a;">⚠️ غياب بعذر</span>';
                } else if (s.attendance === 'late') {
                    attBadge = `<span style="background:#fff7ed; color:#c2410c; font-size:0.72rem; font-weight:800; padding:2px 7px; border-radius:4px; border:1px solid #fed7aa;">⏱️ متأخر (${s.hours} س)</span>`;
                } else {
                    attBadge = `<span style="background:#eff6ff; color:#1d4ed8; font-size:0.72rem; font-weight:800; padding:2px 7px; border-radius:4px; border:1px solid #bfdbfe;">✓ حاضر (${s.hours} س)</span>`;
                }

                // Evaluation badge
                let evalBadge = '';
                if (s.evaluation === 'excellent') {
                    evalBadge = '<span style="background:#ecfdf5; color:#059669; font-size:0.7rem; font-weight:bold; padding:1px 6px; border-radius:4px; border:1px solid #a7f3d0;">⭐⭐⭐ استيعاب ممتاز</span>';
                } else if (s.evaluation === 'very_good') {
                    evalBadge = '<span style="background:#eff6ff; color:#2563eb; font-size:0.7rem; font-weight:bold; padding:1px 6px; border-radius:4px; border:1px solid #bfdbfe;">⭐⭐ جيد جداً</span>';
                } else if (s.evaluation === 'good') {
                    evalBadge = '<span style="background:#f8fafc; color:#475569; font-size:0.7rem; font-weight:bold; padding:1px 6px; border-radius:4px; border:1px solid #cbd5e1;">⭐ حسن</span>';
                } else if (s.evaluation === 'needs_support') {
                    evalBadge = '<span style="background:#fef2f2; color:#dc2626; font-size:0.7rem; font-weight:bold; padding:1px 6px; border-radius:4px; border:1px solid #fca5a5;">⚠️ يحتاج دعماً وتركيزاً</span>';
                }

                html += `
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; background:#f8fafc; padding:10px 12px; border-radius:8px; border:1px solid #e2e8f0; font-size:0.83rem; gap:10px;">
                        <div style="display:flex; flex-direction:column; flex:1; gap:3px;">
                            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                <strong style="color:#1e293b;">${dayName ? dayName + '، ' : ''}${dateFormatted}</strong>
                                ${attBadge}
                                ${evalBadge}
                                ${s.time ? `<span style="color:#64748b; font-size:0.75rem;" dir="ltr"><span class="ui-icon" style="margin:0"><span data-lucide="clock" data-size="12"></span></span> ${s.time}</span>` : ''}
                            </div>
                            ${s.topic ? `
                                <div style="color:#0369a1; font-weight:600; font-size:0.78rem; display:flex; align-items:center; gap:4px; margin-top:2px;">
                                    <span class="ui-icon" style="margin:0"><span data-lucide="book-open" data-size="12"></span></span>
                                    <span>${escapeTutoringHtml(s.topic)}</span>
                                </div>
                            ` : '<div style="color:#94a3b8; font-size:0.75rem;">حصة دعم خصوصي</div>'}
                            ${s.homework ? `
                                <div style="color:#ca8a04; font-size:0.75rem; font-weight:bold; display:flex; align-items:center; gap:4px; background:#fefce8; padding:2px 6px; border-radius:4px; border:1px solid #fef08a; width:fit-content; margin-top:2px;">
                                    <span>📝 الواجب:</span>
                                    <span style="color:#854d0e;">${escapeTutoringHtml(s.homework)}</span>
                                </div>
                            ` : ''}
                            ${Array.isArray(s.attachedResources) && s.attachedResources.length > 0 ? `
                                <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:3px;">
                                    ${s.attachedResources.map(r => r.url
                                        ? `<a href="${escapeTutoringHtml(r.url)}" target="_blank" rel="noopener" style="background:#eef2ff; color:#4338ca; border:1px solid #c7d2fe; border-radius:4px; padding:1px 6px; font-size:0.71rem; font-weight:bold; text-decoration:none;">📎 ${escapeTutoringHtml(r.title)}</a>`
                                        : `<span style="background:#eef2ff; color:#4338ca; border:1px solid #c7d2fe; border-radius:4px; padding:1px 6px; font-size:0.71rem; font-weight:bold;">📎 ${escapeTutoringHtml(r.title)}</span>`
                                    ).join('')}
                                </div>
                            ` : ''}
                        </div>
                        <div style="display:flex; align-items:center; gap:5px; flex-shrink:0;">
                            <button type="button" class="btn-action" onclick="shareTutoringSessionWhatsApp('${studentId}', '${s.id}')" style="background:#25D366; color:#fff; border:none; padding:4px 8px; border-radius:6px; font-size:0.73rem; font-weight:bold; display:inline-flex; align-items:center; gap:3px; cursor:pointer;" title="إرسال تقرير وملخص الحصة لولي الأمر عبر واتساب">
                                <span class="ui-icon" style="margin:0;"><span data-lucide="message-circle" data-size="12"></span></span>
                                <span>واتساب</span>
                            </button>
                            <button type="button" class="hide-in-presentation" onclick="editTutoringSingleSession('${studentId}', '${s.id}')" style="background:#f0fdf4; border:1px solid #bbf7d0; color:#15803d; cursor:pointer; padding:4px 8px; border-radius:6px; font-size:0.74rem; font-weight:800;" title="تعديل الحصة">
                                تعديل
                            </button>
                            <button type="button" class="hide-in-presentation" onclick="deleteTutoringSession('${studentId}', '${s.id}')" style="background:#fee2e2; border:1px solid #fecaca; color:#ef4444; cursor:pointer; padding:4px 7px; border-radius:6px;" title="حذف الحصة">
                                <span class="ui-icon" style="margin:0"><span data-lucide="trash-2" data-size="14"></span></span>
                            </button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            listDiv.innerHTML = html;
            if (window.renderLucide) window.renderLucide();
        }

        async function deleteTutoringSession(studentId, sessionId) {
            const ok = typeof window.showConfirmDialog === 'function'
                ? await window.showConfirmDialog('هل أنت متأكد من حذف هذه الحصة؟ سيتم خصم ساعاتها تلقائياً من حسابات ومستحقات التلميذ.')
                : true;
            if (ok) {
                const std = db.tutoring.students.find(s => s.id === studentId);
                if (std && std.sessions) {
                    std.sessions = std.sessions.filter(s => s.id !== sessionId);
                    saveDB();
                    renderStudentSessionsList(studentId);
                    onTutoringSessionStudentChange();
                    renderTutoringStudents();

                    // Refresh all sessions modal if open
                    const allSessModal = document.getElementById('tutoringAllSessionsModal');
                    if (allSessModal && allSessModal.style.display !== 'none') {
                        if (typeof openTutoringAllSessionsModal === 'function') openTutoringAllSessionsModal();
                    }

                    // Refresh student profile modal if open
                    const profileModal = document.getElementById('tutoringStudentProfileModal');
                    if (profileModal && profileModal.style.display !== 'none' && window.currentViewingStudentId === studentId) {
                        if (typeof openTutoringStudentProfileModal === 'function') openTutoringStudentProfileModal(studentId);
                    }
                }
            }
        }

        var _isSavingTutoringSession = false;
        function saveTutoringSession(keepOpen = false) {
            if (_isSavingTutoringSession) return;
            _isSavingTutoringSession = true;
            const unlock = () => { setTimeout(() => { _isSavingTutoringSession = false; }, 450); };

            const modeInput = document.getElementById('sessionStudentMode');
            const isNewMode = modeInput && modeInput.value === 'new';

            const select = document.getElementById('sessionStudentSelect');
            const hiddenId = document.getElementById('sessionStudentId');
            const editHiddenId = document.getElementById('editingSessionId');
            let studentId = (select && select.value) || (hiddenId && hiddenId.value);
            const editingId = editHiddenId ? editHiddenId.value : '';
            const dateInput = document.getElementById('sessionDate');
            const timeInput = document.getElementById('sessionTime');
            const hoursInput = document.getElementById('sessionHours');
            const topicInput = document.getElementById('sessionTopic');

            // Pedagogical fields
            const attSelect = document.getElementById('sessionAttendance');
            const homeworkInput = document.getElementById('sessionHomework');
            const evalSelect = document.getElementById('sessionEvaluation');
            const evalNotesInput = document.getElementById('sessionEvaluationNotes');

            const date = dateInput ? dateInput.value : '';
            const time = timeInput ? timeInput.value : '18:00';
            const hours = hoursInput ? parseFloat(hoursInput.value) : 2;
            const topic = topicInput ? topicInput.value.trim() : '';
            const attendance = attSelect ? attSelect.value : 'present';
            const homework = homeworkInput ? homeworkInput.value.trim() : '';
            const evaluation = evalSelect ? evalSelect.value : 'good';
            const evaluationNotes = evalNotesInput ? evalNotesInput.value.trim() : '';

            let std = null;
            if (isNewMode) {
                const newNameInput = document.getElementById('sessionNewStudentName');
                const newPhoneInput = document.getElementById('sessionNewStudentPhone');
                const newFeeInput = document.getElementById('sessionNewStudentFee');
                const newName = newNameInput ? newNameInput.value.trim() : '';
                if (!newName) {
                    window.notifySafeToast('يرجى كتابة اسم التلميذ(ة) للدعم الفردي');
                    unlock();
                    return;
                }
                const newPhone = newPhoneInput ? newPhoneInput.value.trim() : '';
                const newFee = newFeeInput ? (parseFloat(newFeeInput.value) || 150) : 150;

                if (!db.tutoring.students) db.tutoring.students = [];
                let existingStd = db.tutoring.students.find(s => (s.name || '').trim().toLowerCase() === newName.toLowerCase());
                if (!existingStd) {
                    existingStd = {
                        id: 'tstd_' + Date.now(),
                        name: newName,
                        phone: newPhone,
                        fee: newFee,
                        group: 'دعم خصوصي فردي',
                        level: '',
                        sessions: [],
                        payments: {}
                    };
                    db.tutoring.students.push(existingStd);
                } else {
                    if (newPhone && !existingStd.phone) existingStd.phone = newPhone;
                    if (newFee && !existingStd.fee) existingStd.fee = newFee;
                }
                std = existingStd;
                studentId = std.id;
            } else {
                if (!studentId) {
                    window.notifySafeToast('يرجى اختيار التلميذ أولاً');
                    unlock();
                    return;
                }
                std = db.tutoring.students.find(s => s.id === studentId);
            }

            if (!date) {
                window.notifySafeToast('يرجى تحديد تاريخ الحصة');
                unlock();
                return;
            }
            if (isNaN(hours) || hours <= 0) {
                window.notifySafeToast('يرجى إدخال عدد ساعات صحيح أكبر من 0');
                unlock();
                return;
            }

            if (!std) {
                window.notifySafeToast('لم يتم العثور على التلميذ المحدد');
                unlock();
                return;
            }

            if (!std.sessions) std.sessions = [];
            const attachedResources = (typeof window.getSelectedTutoringLibraryResources === 'function')
                ? window.getSelectedTutoringLibraryResources('sessionLibraryLinkerContainer')
                : [];

            if (editingId) {
                const sessIndex = std.sessions.findIndex(s => s.id === editingId);
                if (sessIndex !== -1) {
                    std.sessions[sessIndex].date = date;
                    std.sessions[sessIndex].time = time || '18:00';
                    std.sessions[sessIndex].hours = hours;
                    std.sessions[sessIndex].topic = topic;
                    std.sessions[sessIndex].attendance = attendance;
                    std.sessions[sessIndex].homework = homework;
                    std.sessions[sessIndex].evaluation = evaluation;
                    std.sessions[sessIndex].evaluationNotes = evaluationNotes;
                    std.sessions[sessIndex].attachedResources = attachedResources;
                } else {
                    std.sessions.push({
                        id: editingId,
                        date: date,
                        time: time || '18:00',
                        hours: hours,
                        topic: topic,
                        attendance: attendance,
                        homework: homework,
                        evaluation: evaluation,
                        evaluationNotes: evaluationNotes,
                        attachedResources: attachedResources
                    });
                }
                if (editHiddenId) editHiddenId.value = '';
            } else {
                std.sessions.push({
                    id: 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    date: date,
                    time: time || '18:00',
                    hours: hours,
                    topic: topic,
                    attendance: attendance,
                    homework: homework,
                    evaluation: evaluation,
                    evaluationNotes: evaluationNotes,
                    attachedResources: attachedResources
                });
            }

            saveDB();

            // Clear inputs for next entry if needed
            if (topicInput) topicInput.value = '';
            if (homeworkInput) homeworkInput.value = '';
            if (evalNotesInput) evalNotesInput.value = '';
            if (keepOpen && typeof window.renderTutoringLibraryLinker === 'function') {
                window.renderTutoringLibraryLinker('sessionLibraryLinkerContainer', [], std.level || '');
            }

            renderStudentSessionsList(studentId);
            onTutoringSessionStudentChange();
            renderTutoringStudents();

            // Refresh all sessions modal if currently open
            const allSessModal = document.getElementById('tutoringAllSessionsModal');
            if (allSessModal && allSessModal.style.display !== 'none') {
                if (typeof openTutoringAllSessionsModal === 'function') openTutoringAllSessionsModal();
            }

            // Refresh student profile modal if currently open for this student
            const profileModal = document.getElementById('tutoringStudentProfileModal');
            if (profileModal && profileModal.style.display !== 'none' && window.currentViewingStudentId === studentId) {
                if (typeof openTutoringStudentProfileModal === 'function') openTutoringStudentProfileModal(studentId);
            }

            if (!keepOpen) {
                closeTutoringSessionModal();
            }

            // Toast alert
            const toast = document.createElement('div');
            toast.style.cssText = 'position:fixed;bottom:25px;left:50%;transform:translateX(-50%);background:#059669;color:white;padding:12px 24px;border-radius:25px;z-index:99999;font-family:"Cairo",sans-serif;font-weight:bold;box-shadow:0 4px 12px rgba(0,0,0,0.2);display:flex;align-items:center;gap:8px;';
            toast.innerHTML = editingId
                ? '✓ تم تعديل الحصة بنجاح للتلميذ ' + std.name + ' (' + (attendance === 'absent' ? 'مسجل كغائب' : hours + ' س') + ')'
                : '✓ تم تسجيل الحصة بنجاح للتلميذ ' + std.name + ' (' + (attendance === 'absent' ? 'مسجل كغائب' : '+' + hours + ' س') + ')';
            document.body.appendChild(toast);
            setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 3000);
            unlock();
        }

        // WhatsApp Session Report Sharers
        var _lastWaSessionShareTime = 0;
        function shareTutoringSessionWhatsApp(studentId, sessionId) {
            const now = Date.now();
            if (now - _lastWaSessionShareTime < 800) return;
            _lastWaSessionShareTime = now;

            const std = (db.tutoring.students || []).find(s => s.id === studentId);
            if (!std) return;
            const sess = (std.sessions || []).find(s => s.id === sessionId);
            if (!sess) return;

            let phone = (std.phone || '').trim().replace(/[^0-9]/g, '');
            if (phone.startsWith('0')) phone = '212' + phone.substring(1);

            let attText = 'حاضر ✓';
            if (sess.attendance === 'absent') attText = 'غائب(ة) ❌';
            else if (sess.attendance === 'excused') attText = 'غائب(ة) بعذر مبرر ⚠️';
            else if (sess.attendance === 'late') attText = 'حاضر(ة) مع تأخر ⏱️';

            let evalText = '';
            if (sess.evaluation === 'excellent') evalText = 'استيعاب ممتاز وتفاعل نشط ⭐⭐⭐';
            else if (sess.evaluation === 'very_good') evalText = 'جيد جداً واستيعاب سليم ⭐⭐';
            else if (sess.evaluation === 'good') evalText = 'حسن، مع بعض الملاحظات ⭐';
            else if (sess.evaluation === 'needs_support') evalText = 'يحتاج دعماً وتركيزاً إضافياً ⚠️';

            const resList = Array.isArray(sess.attachedResources) ? sess.attachedResources : [];
            const resText = resList.length > 0
                ? `\n📚 *الموارد والتمارين المرفقة:*\n` + resList.map(r => `  - ${r.title}${r.url ? ' (' + r.url + ')' : ''}`).join('\n') + '\n'
                : '';

            let msg = `السلام عليكم ورحمة الله ولي أمر التلميذ(ة) *${std.name}*،\n\n` +
                      `نوافيكم بتقرير حصة الدعم والتقوية المنعقدة بتاريخ *${sess.date}*:\n` +
                      `• *التوقيت والمدة:* ${sess.time || '18:00'} (${sess.hours} س)\n` +
                      `• *حالة الحضور:* ${attText}\n` +
                      (sess.topic ? `• *موضوع الحصة والأنشطة:* ${sess.topic}\n` : '') +
                      (evalText ? `• *تقييم الاستيعاب والتفاعل:* ${evalText}\n` : '') +
                      (sess.evaluationNotes ? `• *ملاحظة الأستاذ:* ${sess.evaluationNotes}\n` : '') +
                      (sess.homework ? `• *الواجب المنزلي والتكليف:* ${sess.homework}\n` : '') +
                      resText +
                      `\nشكراً لحرصكم ومتابعتكم المستمرة لما فيه مصلحة التلميذ(ة).`;

            const encoded = encodeURIComponent(msg);
            if (phone) {
                window.openSafeExternalUrl(`https://wa.me/${phone}?text=${encoded}`, '_blank');
            } else {
                navigator.clipboard.writeText(msg).then(() => {
                    window.notifySafeToast('تم نسخ تقرير الحصة للحافظة بنجاح، يمكنك لصقه في واتساب ولي الأمر (لم يتم تسجيل رقم الهاتف في بيانات التلميذ).');
                }).catch(() => {
                    window.notifySafeToast('يرجى تسجيل رقم هاتف التلميذ لإرسال التقرير مباشرة عبر واتساب.');
                });
            }
        }

        function shareCurrentSessionViaWhatsApp() {
            const select = document.getElementById('sessionStudentSelect');
            const studentId = select ? select.value : '';
            if (!studentId) {
                window.notifySafeToast('يرجى اختيار التلميذ أولاً');
                return;
            }
            const std = (db.tutoring.students || []).find(s => s.id === studentId);
            if (!std) return;

            const date = document.getElementById('sessionDate') ? document.getElementById('sessionDate').value : '';
            const time = document.getElementById('sessionTime') ? document.getElementById('sessionTime').value : '18:00';
            const hours = document.getElementById('sessionHours') ? document.getElementById('sessionHours').value : '2';
            const topic = document.getElementById('sessionTopic') ? document.getElementById('sessionTopic').value.trim() : '';
            const att = document.getElementById('sessionAttendance') ? document.getElementById('sessionAttendance').value : 'present';
            const homework = document.getElementById('sessionHomework') ? document.getElementById('sessionHomework').value.trim() : '';
            const evalVal = document.getElementById('sessionEvaluation') ? document.getElementById('sessionEvaluation').value : 'good';
            const evalNotes = document.getElementById('sessionEvaluationNotes') ? document.getElementById('sessionEvaluationNotes').value.trim() : '';

            let attText = 'حاضر ✓';
            if (att === 'absent') attText = 'غائب(ة) ❌';
            else if (att === 'excused') attText = 'غائب(ة) بعذر مبرر ⚠️';
            else if (att === 'late') attText = 'حاضر(ة) مع تأخر ⏱️';

            let evalText = '';
            if (evalVal === 'excellent') evalText = 'استيعاب ممتاز وتفاعل نشط ⭐⭐⭐';
            else if (evalVal === 'very_good') evalText = 'جيد جداً واستيعاب سليم ⭐⭐';
            else if (evalVal === 'good') evalText = 'حسن، مع بعض الملاحظات ⭐';
            else if (evalVal === 'needs_support') evalText = 'يحتاج دعماً وتركيزاً إضافياً ⚠️';

            const resList = (typeof window.getSelectedTutoringLibraryResources === 'function')
                ? window.getSelectedTutoringLibraryResources('sessionLibraryLinkerContainer')
                : [];
            const resText = resList.length > 0
                ? `\n📚 *الموارد والتمارين المرفقة:*\n` + resList.map(r => `  - ${r.title}${r.url ? ' (' + r.url + ')' : ''}`).join('\n') + '\n'
                : '';

            let msg = `السلام عليكم ورحمة الله ولي أمر التلميذ(ة) *${std.name}*،\n\n` +
                      `نوافيكم بتقرير حصة الدعم والتقوية المنعقدة بتاريخ *${date}*:\n` +
                      `• *التوقيت والمدة:* ${time} (${hours} س)\n` +
                      `• *حالة الحضور:* ${attText}\n` +
                      (topic ? `• *موضوع الحصة والأنشطة:* ${topic}\n` : '') +
                      (evalText ? `• *تقييم الاستيعاب والتفاعل:* ${evalText}\n` : '') +
                      (evalNotes ? `• *ملاحظة الأستاذ:* ${evalNotes}\n` : '') +
                      (homework ? `• *الواجب المنزلي والتكليف:* ${homework}\n` : '') +
                      resText +
                      `\nشكراً لحرصكم ومتابعتكم المستمرة.`;

            let phone = (std.phone || '').trim().replace(/[^0-9]/g, '');
            if (phone.startsWith('0')) phone = '212' + phone.substring(1);

            const encoded = encodeURIComponent(msg);
            if (phone) {
                window.openSafeExternalUrl(`https://wa.me/${phone}?text=${encoded}`, '_blank');
            } else {
                navigator.clipboard.writeText(msg).then(() => {
                    window.notifySafeToast('تم نسخ تقرير الحصة للحافظة بنجاح، يمكنك لصقه في واتساب ولي الأمر (لم يتم تسجيل رقم الهاتف في بيانات التلميذ).');
                }).catch(() => {
                    window.notifySafeToast('يرجى تسجيل رقم هاتف التلميذ لإرسال التقرير مباشرة عبر واتساب.');
                });
            }
        }

        window.shareTutoringSessionWhatsApp = shareTutoringSessionWhatsApp;
        window.shareCurrentSessionViaWhatsApp = shareCurrentSessionViaWhatsApp;
        window.onIndividualSessionAttendanceChange = onIndividualSessionAttendanceChange;

        // Export tutoring functions to window
        window.openTutoringSessionModal = openTutoringSessionModal;
        window.closeTutoringSessionModal = closeTutoringSessionModal;
        window.saveTutoringSession = saveTutoringSession;
        window.editTutoringSingleSession = editTutoringSingleSession;
        window.deleteTutoringSession = deleteTutoringSession;
        window.openAddIndividualTutoringSessionModal = openAddIndividualTutoringSessionModal;
        window.renderStudentSessionsList = renderStudentSessionsList;
        window.onTutoringSessionStudentChange = onTutoringSessionStudentChange;
        window.setSessionHours = setSessionHours;
        window.setSessionTopicPreset = setSessionTopicPreset;
        window.setSessionDatePreset = setSessionDatePreset;
        window.updateSessionLiveCalc = updateSessionLiveCalc;
        window.filterSessionStudentOptions = filterSessionStudentOptions;
        window.renderTutoringStudents = renderTutoringStudents;


        function getFilteredTutoringStudentsForExport() {
            const groupFilter = document.getElementById('tutoringGroupFilter')?.value || 'all';
            const paymentFilter = document.getElementById('tutoringPaymentFilter')?.value || 'all';
            const searchVal = (document.getElementById('tutoringSearchInput')?.value || '').trim().toLowerCase();
            const month = document.getElementById('tutoringMonth')?.value || '';
            return (db.tutoring.students || []).filter(std => {
                if (groupFilter !== 'all' && std.group !== groupFilter) return false;
                if (searchVal) {
                    const nMatch = (std.name || '').toLowerCase().includes(searchVal);
                    const pMatch = (std.phone || '').toLowerCase().includes(searchVal);
                    const gMatch = (std.group || '').toLowerCase().includes(searchVal);
                    if (!nMatch && !pMatch && !gMatch) return false;
                }
                if (paymentFilter !== 'all') {
                    const payInfo = window.getTutoringPaymentInfo(std, month);
                    if (paymentFilter === 'paid' && payInfo.status !== 'paid') return false;
                    if (paymentFilter === 'unpaid' && payInfo.status === 'paid') return false;
                    if (paymentFilter === 'partial' && payInfo.status !== 'partial') return false;
                }
                return true;
            });
        }

        function exportTutoringCSV() {
            const month = document.getElementById('tutoringMonth')?.value || (window.formatLocalMonth ? window.formatLocalMonth() : new Date().toISOString().slice(0, 7));
            const csvEsc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
            const rows = [
                ['الاسم', 'المجموعة', 'المستوى', 'الهاتف', 'نمط الفوترة', 'الثمن المرجعي (درهم)', 'التخفيض (%)', 'ساعات الشهر', 'حالة الباقة', 'المبلغ المستحق', 'المبلغ المؤدى', 'المبلغ المتبقي', 'الحالة']
            ];

            const filteredStudents = getFilteredTutoringStudentsForExport();
            filteredStudents.forEach(std => {
                const sessions = std.sessions || [];
                let totalHours = 0;
                sessions.forEach(s => {
                    if (s.date && s.date.startsWith(month)) {
                        if (s.attendance === 'absent') return;
                        totalHours += parseFloat(s.hours) || 0;
                    }
                });

                const mode = std.billingMode || 'hourly';
                const modeLabel = mode === 'monthly_fixed' ? 'شهري ثابت' : (mode === 'session_pack' ? 'باقة حصص' : 'بالساعة');
                const refPrice = mode === 'monthly_fixed' ? (parseFloat(std.monthlyFixedFee) || 0) : (mode === 'session_pack' ? (parseFloat(std.packPrice) || 0) : (parseFloat(std.fee) || 0));
                const discount = parseFloat(std.discountPercent) || 0;
                const packInfo = (mode === 'session_pack' && typeof window.getStudentPackStatus === 'function')
                    ? window.getStudentPackStatus(std, month)
                    : null;
                const packLabel = packInfo ? `${packInfo.usedInCycle}/${packInfo.totalSessions} (باقٍ ${packInfo.remainingSessions})` : '—';

                const payInfo = window.getTutoringPaymentInfo(std, month);
                let statusStr = "غير مؤدى";
                if (payInfo.status === 'paid') statusStr = "تم الأداء بالكامل";
                else if (payInfo.status === 'partial') statusStr = `أداء جزئي (باقٍ ${payInfo.remaining} د.م)`;

                rows.push([
                    std.name || '',
                    std.group || '',
                    std.level || '',
                    std.phone || '',
                    modeLabel,
                    refPrice,
                    discount,
                    totalHours,
                    packLabel,
                    payInfo.totalDue,
                    payInfo.paidAmount,
                    payInfo.remaining,
                    statusStr
                ]);
            });

            const csvBody = '\uFEFF' + rows.map(r => r.map(csvEsc).join(',')).join('\r\n');
            const blob = new Blob([csvBody], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `تقرير_الدعم_الخصوصي_${month}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
        window.exportTutoringCSV = exportTutoringCSV;

        window.exportTutoringExcel = async function() {
            const month = document.getElementById('tutoringMonth')?.value || (window.formatLocalMonth ? window.formatLocalMonth() : new Date().toISOString().slice(0, 7));
            if (typeof XLSX === 'undefined' && typeof window.ensureXlsxLoaded === 'function') {
                await window.ensureXlsxLoaded();
            }
            if (typeof XLSX === 'undefined') {
                window.notifySafeToast('تعذر تحميل مكتبة Excel، تم تصدير ملف CSV كبديل.');
                exportTutoringCSV();
                return;
            }

            const filteredStudents = getFilteredTutoringStudentsForExport();
            const studentRows = filteredStudents.map((std, i) => {
                let totalHours = 0;
                (std.sessions || []).forEach(s => {
                    if (s.date && s.date.startsWith(month) && s.attendance !== 'absent') {
                        totalHours += parseFloat(s.hours) || 0;
                    }
                });
                const mode = std.billingMode || 'hourly';
                const modeLabel = mode === 'monthly_fixed' ? 'شهري ثابت' : (mode === 'session_pack' ? 'باقة حصص' : 'بالساعة');
                const refPrice = mode === 'monthly_fixed' ? (parseFloat(std.monthlyFixedFee) || 0) : (mode === 'session_pack' ? (parseFloat(std.packPrice) || 0) : (parseFloat(std.fee) || 0));
                const packInfo = (mode === 'session_pack' && typeof window.getStudentPackStatus === 'function')
                    ? window.getStudentPackStatus(std, month)
                    : null;
                const payInfo = window.getTutoringPaymentInfo(std, month);
                const statusStr = payInfo.status === 'paid' ? 'مؤدى بالكامل' : (payInfo.status === 'partial' ? 'أداء جزئي' : 'غير مؤدى');
                return {
                    '#': i + 1,
                    'الاسم الكامل': std.name || '',
                    'المجموعة': std.group || 'عام',
                    'المستوى': std.level || '',
                    'الهاتف': std.phone || '',
                    'نمط الفوترة': modeLabel,
                    'التعريفة (د.م)': refPrice,
                    'التخفيض (%)': parseFloat(std.discountPercent) || 0,
                    'ساعات الشهر': totalHours,
                    'حالة الباقة': packInfo ? `${packInfo.usedInCycle}/${packInfo.totalSessions}` : '—',
                    'المستحق (د.م)': payInfo.totalDue,
                    'المؤدى (د.م)': payInfo.paidAmount,
                    'المتبقي (د.م)': payInfo.remaining,
                    'الحالة': statusStr
                };
            });

            const grpMap = new Map();
            (db.tutoring.students || []).forEach(std => {
                const gName = (std.group || 'عام').trim() || 'عام';
                if (!grpMap.has(gName)) grpMap.set(gName, { 'المجموعة': gName, 'عدد التلاميذ': 0, 'الساعات': 0, 'المستحق (د.م)': 0, 'المؤدى (د.م)': 0, 'المتبقي (د.م)': 0, 'مصاريف المجموعة (د.م)': 0 });
                const g = grpMap.get(gName);
                g['عدد التلاميذ'] += 1;
                (std.sessions || []).forEach(s => {
                    if (s.date && s.date.startsWith(month) && s.attendance !== 'absent') g['الساعات'] += parseFloat(s.hours) || 0;
                });
                const pi = window.getTutoringPaymentInfo(std, month);
                g['المستحق (د.م)'] += pi.totalDue;
                g['المؤدى (د.م)'] += pi.paidAmount;
                g['المتبقي (د.م)'] += pi.remaining;
            });
            ((db.tutoring && db.tutoring.expenses) || []).forEach(e => {
                if (e.month === month && e.group && grpMap.has(e.group)) {
                    grpMap.get(e.group)['مصاريف المجموعة (د.م)'] += parseFloat(e.amount) || 0;
                }
            });
            const groupRows = Array.from(grpMap.values()).map(g => ({
                ...g,
                'صافي الربح المحصل (د.م)': Math.max(0, g['المؤدى (د.م)'] - g['مصاريف المجموعة (د.م)'])
            }));

            const wb = XLSX.utils.book_new();
            wb.Workbook = { Views: [{ RTL: true }] };
            const ws1 = XLSX.utils.json_to_sheet(studentRows.length ? studentRows : [{ 'تنبيه': 'لا توجد بيانات مطابقة' }]);
            const ws2 = XLSX.utils.json_to_sheet(groupRows.length ? groupRows : [{ 'تنبيه': 'لا توجد مجموعات' }]);
            XLSX.utils.book_append_sheet(wb, ws1, 'ملخص التلاميذ');
            XLSX.utils.book_append_sheet(wb, ws2, 'ملخص المجموعات');
            XLSX.writeFile(wb, `تقرير_الدعم_الخصوصي_${month}.xlsx`);
            window.notifySafeToast('✓ تم تصدير ملف Excel بنجاح');
        };

        function printTutoringReport() {
            const month = document.getElementById('tutoringMonth')?.value || '';
            const origTable = document.getElementById('tutoringTable');
            let tableHtml = '';
            if (origTable) {
                const clonedTable = origTable.cloneNode(true);
                clonedTable.querySelectorAll('tr').forEach(tr => {
                    const cells = tr.children;
                    if (cells.length > 0 && (cells[0].querySelector('input[type="checkbox"]') || cells[0].querySelector('#tutoringMasterSelectCb'))) {
                        cells[0].remove();
                    }
                    if (tr.children.length > 0) {
                        const lastCell = tr.children[tr.children.length - 1];
                        if (lastCell && (lastCell.textContent.trim() === 'إجراءات' || lastCell.querySelector('button'))) {
                            lastCell.remove();
                        }
                    }
                });
                tableHtml = clonedTable.outerHTML;
            }

            const unpaidText = document.getElementById('tutoringUnpaidCountBadge')?.textContent || document.getElementById('tutoringUnpaidCount')?.textContent || '(0 تلميذ)';
            const teacherName = escapeTutoringHtml((db.teacherProfile && db.teacherProfile.name) || 'الأستاذ(ة)');
            const subjectName = escapeTutoringHtml((db.teacherProfile && db.teacherProfile.subject) || '');

            const html = `
            <${'html'} dir="rtl" lang="ar">
            <${'head'}>
                <meta charset="UTF-8">
                <title>تقرير الدعم الخصوصي - ${escapeTutoringHtml(month)}</title>
                <style>
                    body { font-family: 'Cairo', sans-serif; padding: 20px; color: #0f172a; direction: rtl; }
                    h2 { text-align: center; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 16px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.86rem; }
                    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: center; }
                    th { background-color: #f1f5f9; font-weight: bold; }
                    .stats { display: flex; justify-content: space-around; flex-wrap: wrap; gap: 10px; background: #f8fafc; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; font-weight: bold; }
                </style>
            <${'/head'}>
            <${'body'}>
                <h2>تقرير الدعم الخصوصي - شهر ${escapeTutoringHtml(month)}</h2>
                <div style="text-align:center; color:#475569; font-size:0.85rem; margin-bottom:12px;">الأستاذ(ة): ${teacherName}${subjectName ? ' | المادة: ' + subjectName : ''}</div>
                <div class="stats">
                    <div>إجمالي التلاميذ: ${escapeTutoringHtml(document.getElementById('tutoringTotalStudents')?.textContent || '0')}</div>
                    <div>الأرباح المتوقعة: ${escapeTutoringHtml(document.getElementById('tutoringTotalRevenue')?.textContent || '0')} درهم</div>
                    <div>مجموع الساعات: ${escapeTutoringHtml(document.getElementById('tutoringTotalHours')?.textContent || '0')} س</div>
                    <div style="color: #ef4444;">المتبقي غير المؤدى: ${escapeTutoringHtml(unpaidText)}</div>
                </div>
                ${tableHtml}
                <div style="text-align:left; margin-top:30px; font-size:0.9rem; color:#64748b;">طبع بتاريخ: ${new Date().toLocaleDateString('ar-MA')}</div>
            <${'/body'}>
            <${'/html'}>
            `;
            if (typeof window.printDocumentDirectly === 'function') {
                window.printDocumentDirectly(html, 'تقرير الدعم الخصوصي - ' + month, 'portrait');
            }
        }

        function printTutoringReceipt(studentId, month, totalDue, totalHours) {
            const std = (db.tutoring.students || []).find(s => s.id === studentId);
            if (!std) return;

            const pTeacherName = (db.teacherProfile && db.teacherProfile.name) || 'الأستاذ(ة)';
            const pSchool = (db.teacherProfile && db.teacherProfile.school) || '';
            const receiptNumber = 'REC-' + month.replace('-', '') + '-' + (std.id.replace(/[^0-9]/g, '').slice(-4) || '001');
            const issueDate = new Date().toLocaleDateString('ar-MA', { year: 'numeric', month: 'long', day: 'numeric' });
            const hourlyRate = parseFloat(std.fee) || 0;
            const payInfo = window.getTutoringPaymentInfo(std, month, totalDue);

            // Detailed sessions
            const sessions = (std.sessions || []).filter(s => s.date && s.date.startsWith(month));
            const history = payInfo.history || [];

            let stampHtml = '';
            if (payInfo.status === 'paid') {
                stampHtml = '<div class="stamp" style="border-color: #10b981; color: #10b981;">✓ مؤدى بالكامل</div>';
            } else if (payInfo.status === 'partial') {
                stampHtml = `<div class="stamp" style="border-color: #d97706; color: #d97706; font-size: 0.95rem;">⚠ أداء جزئي<br><span style="font-size:0.75rem;">باقٍ: ${payInfo.remaining} د.م</span></div>`;
            } else {
                stampHtml = '<div class="stamp stamp-unpaid">! غير مؤدى</div>';
            }

            let receiptHtml = `<!DOCTYPE html>
            <${'html'} dir="rtl" lang="ar">
            <${'head'}>
                <meta charset="UTF-8">
                <title>وصل أداء الدعم الخصوصي - ${escapeTutoringHtml(std.name)}</title>
                <style>
                    body { font-family: 'Cairo', 'Tajawal', sans-serif; padding: 25px; color: #0f172a; max-width: 600px; margin: 0 auto; direction: rtl; }
                    .receipt { border: 2px dashed #64748b; padding: 25px; border-radius: 12px; position: relative; background: #fff; }
                    .header { text-align: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #e2e8f0; }
                    .header h2 { margin: 0 0 4px 0; color: #0f172a; font-size: 1.3rem; }
                    .header p { margin: 2px 0; color: #64748b; font-size: 0.85rem; }
                    .meta-bar { display: flex; justify-content: space-between; font-size: 0.82rem; color: #475569; margin-bottom: 15px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 8px; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px; font-size: 0.92rem; }
                    .info-item { background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
                    .info-label { color: #64748b; font-size: 0.78rem; font-weight: bold; margin-bottom: 2px; }
                    .info-val { font-weight: bold; color: #0f172a; }

                    table.sessions-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 0.82rem; }
                    table.sessions-table th, table.sessions-table td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; }
                    table.sessions-table th { background: #f1f5f9; font-weight: bold; }

                    .financial-breakdown { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-top: 15px; text-align: center; }
                    .fin-box { display: flex; flex-direction: column; gap: 3px; }
                    .fin-lbl { font-size: 0.75rem; font-weight: bold; color: #64748b; }
                    .fin-val { font-size: 1.15rem; font-weight: 900; }

                    .stamp { position: absolute; bottom: 25px; left: 25px; border: 2.5px solid #10b981; color: #10b981; border-radius: 8px; padding: 6px 14px; font-size: 1.1rem; font-weight: bold; transform: rotate(-12deg); opacity: 0.88; text-align: center; }
                    .stamp-unpaid { border-color: #ef4444; color: #ef4444; }

                    .footer-sig { display: flex; justify-content: space-between; margin-top: 35px; font-size: 0.85rem; padding-top: 15px; border-top: 1px dashed #cbd5e1; }
                </style>
            <${'/head'}>
            <${'body'}>
                <div class="receipt">
                    <div class="header">
                        <h2>وصل أداء الدعم والدروس الخصوصية</h2>
                        <p>${pTeacherName ? 'الأستاذ(ة): ' + escapeTutoringHtml(pTeacherName) : ''} ${pSchool ? ' - ' + escapeTutoringHtml(pSchool) : ''}</p>
                    </div>

                    <div class="meta-bar">
                        <span><strong>رقم الوصل:</strong> ${escapeTutoringHtml(receiptNumber)}</span>
                        <span><strong>تاريخ الإصدار:</strong> ${escapeTutoringHtml(issueDate)}</span>
                    </div>

                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">اسم التلميذ(ة):</div>
                            <div class="info-val">${escapeTutoringHtml(std.name)}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">المجموعة / المستوى:</div>
                            <div class="info-val">${escapeTutoringHtml(std.group || 'غير محدد')}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">عن شهر:</div>
                            <div class="info-val" dir="ltr">${escapeTutoringHtml(month)}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">واجب الساعة:</div>
                            <div class="info-val">${hourlyRate} درهم / ساعة</div>
                        </div>
                    </div>

                    ${sessions.length > 0 ? `
                    <table class="sessions-table">
                        <thead>
                            <tr>
                                <th>تاريخ الحصة</th>
                                <th>التوقيت</th>
                                <th>المدة</th>
                                <th>النشاط / الموضوع</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sessions.map(s => `
                                <tr>
                                    <td dir="ltr">${escapeTutoringHtml(s.date)}</td>
                                    <td dir="ltr">${escapeTutoringHtml(s.time || '-')}</td>
                                    <td>${s.hours} س</td>
                                    <td>${escapeTutoringHtml(s.topic || 'حصة دعم ومراجعة')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    ` : ''}

                    <div class="financial-breakdown">
                        <div class="fin-box">
                            <span class="fin-lbl">إجمالي المستحق (${totalHours} س)</span>
                            <span class="fin-val" style="color: #0f172a;">${payInfo.totalDue} درهم</span>
                        </div>
                        <div class="fin-box" style="background: #f0fdf4; border-radius: 6px; padding: 4px;">
                            <span class="fin-lbl" style="color: #166534;">المؤدى</span>
                            <span class="fin-val" style="color: #15803d;">${payInfo.paidAmount} درهم</span>
                        </div>
                        <div class="fin-box" style="background: ${payInfo.remaining > 0 ? '#fef2f2' : '#f8fafc'}; border-radius: 6px; padding: 4px;">
                            <span class="fin-lbl" style="color: ${payInfo.remaining > 0 ? '#991b1b' : '#64748b'};">المبلغ المتبقي</span>
                            <span class="fin-val" style="color: ${payInfo.remaining > 0 ? '#b91c1c' : '#059669'};">${payInfo.remaining} درهم</span>
                        </div>
                    </div>

                    ${history.length > 0 ? `
                    <div style="margin-top: 14px;">
                        <div style="font-size: 0.78rem; font-weight: bold; color: #475569; margin-bottom: 5px;">تفاصيل الدفعات المسجلة:</div>
                        <table class="sessions-table">
                            <thead>
                                <tr>
                                    <th>الدفعة</th>
                                    <th>المبلغ</th>
                                    <th>التاريخ</th>
                                    <th>ملاحظات</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${history.map((inst, idx) => `
                                    <tr>
                                        <td>دفعة #${idx + 1}</td>
                                        <td style="font-weight: bold; color: #15803d;">${inst.amount} درهم</td>
                                        <td dir="ltr">${escapeTutoringHtml(inst.date || '-')}</td>
                                        <td>${escapeTutoringHtml(inst.note || '-')}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    ` : ''}

                    ${stampHtml}

                    <div class="footer-sig">
                        <div><strong>توقيع ولي الأمر:</strong></div>
                        <div><strong>توقيع الأستاذ(ة):</strong> ${escapeTutoringHtml(pTeacherName)}</div>
                    </div>
                </div>
            <${'/body'}>
            <${'/html'}>`;

            let iframe = document.getElementById('receiptPrintFrame');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'receiptPrintFrame';
                iframe.style.position = 'fixed';
                iframe.style.right = '0';
                iframe.style.bottom = '0';
                iframe.style.width = '0';
                iframe.style.height = '0';
                iframe.style.border = '0';
                document.body.appendChild(iframe);
            }
            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(receiptHtml);
            doc.close();
            iframe.contentWindow.focus();
            setTimeout(() => {
                try {
                    iframe.contentWindow.print();
                } catch(e) {
                    window.print();
                }
            }, 400);
        }

        // Consolidated Group Monthly Performance Report lives in public/tutoring-advanced.js

        function applyGroupDefaultsToStudentModal(groupName, onlyIfEmpty) {
            const name = (groupName || '').trim();
            if (!name || !db.tutoring || !Array.isArray(db.tutoring.groups)) return;
            const grpObj = db.tutoring.groups.find(g => g.name === name);
            if (!grpObj) return;

            const modeEl = document.getElementById('tutoringBillingMode');
            const feeEl = document.getElementById('tutoringFee');
            const monthlyEl = document.getElementById('tutoringMonthlyFixedFee');
            const packSessEl = document.getElementById('tutoringPackSessions');
            const packPriceEl = document.getElementById('tutoringPackPrice');
            const levelEl = document.getElementById('tutoringLevel');

            if (grpObj.level && levelEl && (!onlyIfEmpty || !levelEl.value)) {
                levelEl.value = grpObj.level;
            }
            const gMode = grpObj.billingMode || 'hourly';
            if (modeEl && (!onlyIfEmpty || modeEl.dataset.userChanged !== '1')) {
                modeEl.value = gMode;
                if (typeof window.toggleTutoringBillingModeFields === 'function') {
                    window.toggleTutoringBillingModeFields(gMode);
                }
            }
            if (feeEl && grpObj.defaultFee != null && grpObj.defaultFee !== '') {
                if (!onlyIfEmpty || !feeEl.value || feeEl.value === '100') feeEl.value = grpObj.defaultFee;
            }
            if (monthlyEl && grpObj.monthlyFixedFee != null && grpObj.monthlyFixedFee !== '') {
                if (!onlyIfEmpty || !monthlyEl.value) monthlyEl.value = grpObj.monthlyFixedFee;
            }
            if (packSessEl && grpObj.packSessions) {
                if (!onlyIfEmpty || !packSessEl.value || packSessEl.value === '4') packSessEl.value = grpObj.packSessions;
            }
            if (packPriceEl && grpObj.packPrice != null && grpObj.packPrice !== '') {
                if (!onlyIfEmpty || !packPriceEl.value) packPriceEl.value = grpObj.packPrice;
            }
        }
        window.applyGroupDefaultsToStudentModal = applyGroupDefaultsToStudentModal;

        function openAddTutoringStudentModal() {
            initTutoring();
            const modal = document.getElementById('tutoringModal');
            if (!modal) return;
            const title = document.getElementById('tutoringModalTitle');
            if (title) title.innerHTML = '<span class="ui-icon" style="color: #10b981; margin:0;"><span data-lucide="user-plus" data-size="18"></span></span> إضافة تلميذ (دروس خصوصية ودعم مستقل)';
            const idInput = document.getElementById('tutoringStudentId');
            if (idInput) idInput.value = '';
            const nameInput = document.getElementById('tutoringName');
            if (nameInput) nameInput.value = '';
            const groupInput = document.getElementById('tutoringGroup');
            if (groupInput) {
                const curFilter = document.getElementById('tutoringGroupFilter');
                groupInput.value = (curFilter && curFilter.value !== 'all') ? curFilter.value : '';
                if (!groupInput.dataset.defaultsBound) {
                    groupInput.dataset.defaultsBound = '1';
                    groupInput.addEventListener('change', () => {
                        const isNew = !(document.getElementById('tutoringStudentId')?.value);
                        if (isNew) applyGroupDefaultsToStudentModal(groupInput.value, true);
                    });
                }
            }
            const phoneInput = document.getElementById('tutoringPhone');
            if (phoneInput) phoneInput.value = '';
            const feeInput = document.getElementById('tutoringFee');
            if (feeInput) feeInput.value = '100';
            const levelInput = document.getElementById('tutoringLevel');
            if (levelInput) levelInput.value = '';
            const notesInput = document.getElementById('tutoringNotes');
            if (notesInput) notesInput.value = '';

            // Reset Axis 1 (Billing) & Axis 2 (ROI) fields natively
            const modeEl = document.getElementById('tutoringBillingMode');
            if (modeEl) {
                modeEl.value = 'hourly';
                delete modeEl.dataset.userChanged;
                if (!modeEl.dataset.changeBound) {
                    modeEl.dataset.changeBound = '1';
                    modeEl.addEventListener('change', () => { modeEl.dataset.userChanged = '1'; });
                }
            }
            if (typeof window.toggleTutoringBillingModeFields === 'function') {
                window.toggleTutoringBillingModeFields('hourly');
            }
            const todayStr = window.formatLocalDate ? window.formatLocalDate() : new Date().toISOString().slice(0, 10);
            const setVal = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val; };
            setVal('tutoringMonthlyFixedFee', '');
            setVal('tutoringPackSessions', '4');
            setVal('tutoringPackPrice', '');
            setVal('tutoringPackStartDate', todayStr);
            setVal('tutoringDiscountPercent', '0');
            setVal('tutoringGradeBefore', '');
            setVal('tutoringGradeAfter', '');
            setVal('tutoringNextExamDate', '');
            setVal('tutoringNextExamTopic', '');

            if (groupInput && groupInput.value) {
                applyGroupDefaultsToStudentModal(groupInput.value, true);
            }

            // Populate tutoring group datalist with independent groups
            const dl = document.getElementById('tutoringGroupDatalist');
            if (dl) {
                const grpSet = new Set();
                (db.tutoring.groups || []).forEach(g => { if (g.name) grpSet.add(g.name); });
                (db.tutoring.students || []).forEach(s => { if (s.group) grpSet.add(s.group); });
                dl.innerHTML = Array.from(grpSet).sort().map(g => `<option value="${escapeTutoringHtml(g)}"></option>`).join('');
            }

            modal.style.display = 'flex';
            setTimeout(() => {
                if (nameInput) nameInput.focus();
            }, 100);
        }

        function editTutoringStudent(studentId) {
            const std = (db.tutoring.students || []).find(s => s.id === studentId);
            if (!std) return;
            document.getElementById('tutoringModalTitle').textContent = 'تعديل بيانات التلميذ';
            document.getElementById('tutoringStudentId').value = std.id;
            document.getElementById('tutoringName').value = std.name || '';
            document.getElementById('tutoringGroup').value = std.group || '';
            document.getElementById('tutoringPhone').value = std.phone || '';
            document.getElementById('tutoringFee').value = std.fee || '';
            if (document.getElementById('tutoringLevel')) document.getElementById('tutoringLevel').value = std.level || '';
            if (document.getElementById('tutoringNotes')) document.getElementById('tutoringNotes').value = std.notes || '';

            const mode = std.billingMode || 'hourly';
            const modeEl = document.getElementById('tutoringBillingMode');
            if (modeEl) {
                modeEl.value = mode;
                modeEl.dataset.userChanged = '1';
            }
            if (typeof window.toggleTutoringBillingModeFields === 'function') {
                window.toggleTutoringBillingModeFields(mode);
            }
            const setVal = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val; };
            setVal('tutoringMonthlyFixedFee', std.monthlyFixedFee ?? '');
            setVal('tutoringPackSessions', std.packSessions || 4);
            setVal('tutoringPackPrice', std.packPrice ?? '');
            setVal('tutoringPackStartDate', std.packStartDate || '');
            setVal('tutoringDiscountPercent', std.discountPercent ?? 0);
            setVal('tutoringGradeBefore', std.gradeBefore ?? '');
            setVal('tutoringGradeAfter', std.gradeAfter ?? '');
            setVal('tutoringNextExamDate', std.nextExamDate || '');
            setVal('tutoringNextExamTopic', std.nextExamTopic || '');

            const importBox = document.getElementById('tutoringQuickClassImportBox');
            if (importBox) importBox.style.display = 'none';

            document.getElementById('tutoringModal').style.display = 'flex';
        }

        function closeTutoringModal() {
            document.getElementById('tutoringModal').style.display = 'none';
        }

        var _isSavingTutoringStudent = false;
        function saveTutoringStudent() {
            if (_isSavingTutoringStudent) return;
            _isSavingTutoringStudent = true;
            const unlock = () => { setTimeout(() => { _isSavingTutoringStudent = false; }, 450); };

            const id = document.getElementById('tutoringStudentId').value;
            const name = document.getElementById('tutoringName').value.trim();
            const group = document.getElementById('tutoringGroup').value.trim();
            const phone = document.getElementById('tutoringPhone').value.trim();
            let fee = document.getElementById('tutoringFee').value.trim();
            const level = document.getElementById('tutoringLevel') ? document.getElementById('tutoringLevel').value : '';
            const notes = document.getElementById('tutoringNotes') ? document.getElementById('tutoringNotes').value.trim() : '';

            const billingMode = document.getElementById('tutoringBillingMode')?.value || 'hourly';
            const monthlyFixedFee = parseFloat(document.getElementById('tutoringMonthlyFixedFee')?.value) || 0;
            const packSessions = Math.max(1, parseInt(document.getElementById('tutoringPackSessions')?.value, 10) || 4);
            const packPrice = parseFloat(document.getElementById('tutoringPackPrice')?.value) || 0;
            const packStartDate = document.getElementById('tutoringPackStartDate')?.value || '';
            const discountPercent = Math.max(0, Math.min(100, parseFloat(document.getElementById('tutoringDiscountPercent')?.value) || 0));
            const gradeBeforeRaw = document.getElementById('tutoringGradeBefore')?.value;
            const gradeAfterRaw = document.getElementById('tutoringGradeAfter')?.value;
            const gradeBefore = (gradeBeforeRaw !== undefined && gradeBeforeRaw !== '') ? parseFloat(gradeBeforeRaw) : '';
            const gradeAfter = (gradeAfterRaw !== undefined && gradeAfterRaw !== '') ? parseFloat(gradeAfterRaw) : '';
            const nextExamDate = document.getElementById('tutoringNextExamDate')?.value || '';
            const nextExamTopic = (document.getElementById('tutoringNextExamTopic')?.value || '').trim();

            if (!fee || parseFloat(fee) === 0) {
                if (billingMode === 'monthly_fixed' && monthlyFixedFee > 0) fee = String(monthlyFixedFee);
                else if (billingMode === 'session_pack' && packPrice > 0) fee = String(Math.round(packPrice / packSessions));
            }

            if (!name) {
                window.notifySafeToast('يرجى إدخال اسم التلميذ');
                unlock();
                return;
            }

            if (!db.tutoring) db.tutoring = { students: [], groups: [], expenses: [] };
            if (!Array.isArray(db.tutoring.students)) db.tutoring.students = [];

            if (id) {
                const std = db.tutoring.students.find(s => s.id === id);
                if (std) {
                    std.name = name;
                    std.group = group;
                    std.phone = phone;
                    std.fee = fee;
                    std.level = level;
                    std.notes = notes;
                    std.billingMode = billingMode;
                    std.monthlyFixedFee = monthlyFixedFee;
                    std.packSessions = packSessions;
                    std.packPrice = packPrice;
                    std.packStartDate = packStartDate || std.packStartDate || '';
                    std.discountPercent = discountPercent;
                    std.gradeBefore = gradeBefore;
                    std.gradeAfter = gradeAfter;
                    std.nextExamDate = nextExamDate;
                    std.nextExamTopic = nextExamTopic;
                }
            } else {
                // منع التكرار في مجموعات الدعم
                const cleanName = name.trim().toLowerCase();
                const cleanGroup = (group || '').trim().toLowerCase();
                const dup = db.tutoring.students.find(s =>
                    s.name && s.name.trim().toLowerCase() === cleanName &&
                    ((s.group || '').trim().toLowerCase() === cleanGroup)
                );
                if (dup) {
                    window.notifySafeToast(`تنبيه لمنع التكرار: التلميذ(ة) "${name}" مسجل(ة) بالفعل في مجموعة "${group || 'العامة'}"! تم إلغاء الإضافة.`);
                    unlock();
                    return;
                }

                db.tutoring.students.push({
                    id: 'tut_' + Date.now(),
                    name: name,
                    group: group,
                    phone: phone,
                    fee: fee,
                    level: level,
                    notes: notes,
                    billingMode: billingMode,
                    monthlyFixedFee: monthlyFixedFee,
                    packSessions: packSessions,
                    packPrice: packPrice,
                    packStartDate: packStartDate || (window.formatLocalDate ? window.formatLocalDate() : new Date().toISOString().slice(0, 10)),
                    packArchivedIds: [],
                    discountPercent: discountPercent,
                    gradeBefore: gradeBefore,
                    gradeAfter: gradeAfter,
                    nextExamDate: nextExamDate,
                    nextExamTopic: nextExamTopic,
                    sessions: [],
                    payments: {}
                });
            }

            saveDB();
            closeTutoringModal();
            renderTutoringStudents();
            unlock();
        }

        async function deleteTutoringStudent(studentId) {
            const ok = typeof window.showConfirmDialog === 'function'
                ? await window.showConfirmDialog('هل أنت متأكد من حذف هذا التلميذ من لائحة الدعم الخصوصي؟')
                : true;
            if (ok) {
                db.tutoring.students = db.tutoring.students.filter(s => s.id !== studentId);
                saveDB();
                renderTutoringStudents();
            }
        }

        // --- Unified ICS Import Engine (Synchronized with Annual, Monthly, Roadmap & Google Calendar) ---
        async function handleIcsImport(event) {
            const file = event && event.target && event.target.files ? event.target.files[0] : null;
            if (!file) return;

            try {
                const text = await file.text();
                const lines = String(text || '').split(/\r\n|\n|\r/);
                const events = [];
                let inEvent = false;
                let currentEvent = {};

                for (let i = 0; i < lines.length; i++) {
                    let line = lines[i];
                    while (i + 1 < lines.length && (lines[i+1].startsWith(' ') || lines[i+1].startsWith('\t'))) {
                        i++;
                        line += lines[i].substring(1);
                    }

                    line = line.trim();

                    if (line === 'BEGIN:VEVENT') {
                        inEvent = true;
                        currentEvent = {};
                    } else if (line === 'END:VEVENT') {
                        inEvent = false;
                        if (currentEvent.start) {
                            events.push({
                                title: currentEvent.summary || 'حدث مستورد',
                                description: currentEvent.description || '',
                                date: currentEvent.start,
                                endDate: currentEvent.end || currentEvent.start
                            });
                        }
                    } else if (inEvent) {
                        if (line.startsWith('SUMMARY:')) {
                            currentEvent.summary = line.substring(8).replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, ' ').trim();
                        } else if (line.match(/^SUMMARY(?:;[^:]+)?:(.*)$/)) {
                            const m = line.match(/^SUMMARY(?:;[^:]+)?:(.*)$/);
                            if (m) currentEvent.summary = m[1].replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, ' ').trim();
                        } else if (line.match(/^DESCRIPTION(?:;[^:]+)?:(.*)$/)) {
                            const m = line.match(/^DESCRIPTION(?:;[^:]+)?:(.*)$/);
                            if (m) {
                                currentEvent.description = m[1].replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, ' ').trim();
                                if (!currentEvent.summary) currentEvent.summary = currentEvent.description;
                            }
                        } else if (line.startsWith('DTSTART')) {
                            const match = line.match(/DTSTART[^:]*:(\d{4})-?(\d{2})-?(\d{2})/);
                            if (match) {
                                currentEvent.start = `${match[1]}-${match[2]}-${match[3]}`;
                            }
                        } else if (line.startsWith('DTEND')) {
                            const match = line.match(/DTEND[^:]*:(\d{4})-?(\d{2})-?(\d{2})/);
                            if (match) {
                                currentEvent.end = `${match[1]}-${match[2]}-${match[3]}`;
                            }
                        }
                    }
                }

                if (events.length === 0) {
                    if (typeof showAppToast === 'function') {
                        showAppToast('لم يتم العثور على أي أحداث صالحة في ملف ICS المحدد.', 'warning');
                    }
                    event.target.value = '';
                    return;
                }

                if (!window.db.academicMilestones) window.db.academicMilestones = [];

                let added = 0;
                events.forEach((evt, idx) => {
                    if (evt.title && evt.date) {
                        const exists = window.db.academicMilestones.some(ms => ms.startDate === evt.date && ms.title === evt.title);
                        if (!exists) {
                            const tLower = evt.title.toLowerCase();
                            let category = 'assessment';
                            let color = '#2563eb';
                            if (tLower.includes('امتحان') || tLower.includes('فرض') || tLower.includes('اختبار') || tLower.includes('exam') || tLower.includes('contrôle')) {
                                category = 'exam';
                                color = '#dc2626';
                            } else if (tLower.includes('اجتماع') || tLower.includes('مجلس') || tLower.includes('لقاء') || tLower.includes('meeting')) {
                                category = 'council';
                                color = '#7c3aed';
                            }
                            const dObj = new Date(evt.date);
                            const mNum = !isNaN(dObj.getTime()) ? (dObj.getMonth() + 1) : 9;
                            const sem = (mNum >= 9 || mNum === 1) ? 's1' : 's2';

                            window.db.academicMilestones.push({
                                id: 'ms_ics_' + Date.now().toString() + '_' + idx,
                                title: evt.title,
                                startDate: evt.date,
                                endDate: evt.endDate && evt.endDate >= evt.date ? evt.endDate : evt.date,
                                category: category,
                                categoryLabel: category === 'exam' ? 'فروض وامتحانات' : (category === 'council' ? 'مجالس واجتماعات' : 'محطة بيداغوجية'),
                                semester: sem,
                                semesterLabel: sem === 's2' ? 'الأسدوس الثاني' : 'الأسدوس الأول',
                                targetLevels: 'جميع المستويات',
                                description: evt.description || 'مستورد من ملف التقويم (.ics)',
                                color: color,
                                isCustom: true,
                                importedFromIcs: true
                            });
                            added++;
                        }
                    }
                });

                if (typeof window.syncAllCalendarUnits === 'function') {
                    window.syncAllCalendarUnits(false);
                } else {
                    saveDB();
                    if (typeof window.renderCalendar === 'function') window.renderCalendar();
                }

                if (events.length > 0 && events[0].date && typeof window.setMonthlyCalendarDate === 'function') {
                    const firstDate = events[0].date.split('-');
                    if (firstDate.length === 3) {
                        window.setMonthlyCalendarDate(parseInt(firstDate[0], 10), parseInt(firstDate[1], 10) - 1);
                    }
                }

                if (typeof showAppToast === 'function') {
                    showAppToast(`تم استيراد ${added} حدث/محطة ومزامنتها مع التقويم السنوي والشهري والمسار البيداغوجي بنجاح! 📅`, 'success');
                }
                if (window.renderLucide) window.renderLucide();
            } catch (error) {
                console.error("Error importing ICS:", error?.message || String(error));
                if (typeof showAppToast === 'function') {
                    showAppToast('حدث خطأ أثناء استيراد الملف. تأكد من أنه ملف بصيغة .ics صالح.', 'error');
                }
            }

            event.target.value = '';
        }
        window.handleIcsImport = handleIcsImport;

        // Countdown Timer Logic
        let countdownInterval;
        var lastTimerState = '';
        var timerInitialized = false;

        function toggleAudioAlerts() {
            const currentDb = window.db || (typeof db !== 'undefined' ? db : {});
            if (!currentDb.settings) currentDb.settings = {};
            currentDb.settings.audioAlertsEnabled = !(currentDb.settings.audioAlertsEnabled !== false);
            if (typeof window.saveDB === 'function') window.saveDB();
            else if (typeof saveDB === 'function') saveDB();
            updateAudioAlertsIcon();
            if (currentDb.settings.audioAlertsEnabled) {
                // Play a test sound when enabling
                playAlertSound('test');
            }
        }

        function updateAudioAlertsIcon() {
            const iconWrapper = document.getElementById('audioToggleIcon');
            if (iconWrapper) {
                const currentDb = window.db || (typeof db !== 'undefined' ? db : {});
                const isEnabled = !currentDb.settings || currentDb.settings.audioAlertsEnabled !== false;
                iconWrapper.innerHTML = `<span data-lucide="${isEnabled ? 'volume-2' : 'volume-x'}" data-size="18"></span>`;
                if (window.renderLucide) window.renderLucide();

                const btn = document.getElementById('audioAlertToggleBtn');
                if (btn) {
                    btn.style.opacity = isEnabled ? '1' : '0.5';
                }
            }
        }

        var _userHasInteracted = false;
        if (typeof window !== 'undefined') {
            const markInteracted = () => {
                _userHasInteracted = true;
                window.removeEventListener('click', markInteracted);
                window.removeEventListener('keydown', markInteracted);
                window.removeEventListener('touchstart', markInteracted);
            };
            window.addEventListener('click', markInteracted, { passive: true });
            window.addEventListener('keydown', markInteracted, { passive: true });
            window.addEventListener('touchstart', markInteracted, { passive: true });
        }

        function playAlertSound(type) {
            if (!_userHasInteracted) return;
            const currentDb = window.db || (typeof db !== 'undefined' ? db : {});
            if (currentDb && currentDb.settings && currentDb.settings.audioAlertsEnabled === false) return;

            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) return;
                const audioCtx = new AudioContext();
                if (audioCtx.state === 'suspended') {
                    audioCtx.resume().catch(() => {});
                }
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);

                if (type === 'test') {
                    oscillator.type = 'sine';
                    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
                    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
                    gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.05);
                    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
                    oscillator.start(audioCtx.currentTime);
                    oscillator.stop(audioCtx.currentTime + 0.2);
                } else if (type === 'active') { // Class started
                    oscillator.type = 'sine';
                    oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
                    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
                    gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.1);
                    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
                    oscillator.start(audioCtx.currentTime);
                    oscillator.stop(audioCtx.currentTime + 0.5);
                } else if (type === 'warning') { // 15 mins left
                    oscillator.type = 'triangle';
                    oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
                    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
                    gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.1);
                    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
                    oscillator.start(audioCtx.currentTime);
                    oscillator.stop(audioCtx.currentTime + 0.3);

                    setTimeout(() => {
                        const osc2 = audioCtx.createOscillator();
                        const gain2 = audioCtx.createGain();
                        osc2.type = 'triangle';
                        osc2.frequency.setValueAtTime(440, audioCtx.currentTime);
                        osc2.connect(gain2);
                        gain2.connect(audioCtx.destination);
                        gain2.gain.setValueAtTime(0, audioCtx.currentTime);
                        gain2.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.1);
                        gain2.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
                        osc2.start();
                        osc2.stop(audioCtx.currentTime + 0.3);
                    }, 400);
                } else if (type === 'ended') {
                    oscillator.type = 'square';
                    oscillator.frequency.setValueAtTime(349.23, audioCtx.currentTime); // F4
                    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
                    gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.1);
                    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.8);
                    oscillator.start(audioCtx.currentTime);
                    oscillator.stop(audioCtx.currentTime + 0.8);
                }
            } catch(e) { console.error('Audio play failed', e?.message || String(e)); }
        }

        function startCountdownTimer() {
            clearInterval(countdownInterval);
            const timerContainer = document.getElementById('countdownTimerContainer');
            const timerText = document.getElementById('countdownTimerText');
            const iconWrapper = document.getElementById('timerIconWrapper');

            updateAudioAlertsIcon();

            if (!timerContainer || !timerText) return;

            countdownInterval = setInterval(() => {
                if (typeof document !== 'undefined' && document.hidden) return;
                const tabAbsenceEl = document.getElementById('tabAbsence');
                const absenceTabActive = tabAbsenceEl && tabAbsenceEl.classList.contains('active');
                if (!absenceTabActive) {
                    if (timerContainer.style.display !== 'none') timerContainer.style.display = 'none';
                    return;
                }

                const classSelectEl = document.getElementById('classSelect');
                const datePickerEl = document.getElementById('datePicker');
                const sessionSelectEl = document.getElementById('sessionSelect');
                const className = classSelectEl ? classSelectEl.value : '';
                const selectedDate = datePickerEl ? datePickerEl.value : '';
                const sessionStr = sessionSelectEl ? sessionSelectEl.value : '';

                if (!className || !selectedDate || !sessionStr) {
                    if (timerContainer.style.display !== 'none') timerContainer.style.display = 'none';
                    return;
                }

                const today = window.formatLocalDate ? window.formatLocalDate() : new Date().toLocaleDateString('en-CA');
                if (selectedDate !== today) {
                    if (timerContainer.style.display !== 'none') timerContainer.style.display = 'none';
                    return;
                }

                const match = sessionStr.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
                if (!match) {
                    if (timerContainer.style.display !== 'none') timerContainer.style.display = 'none';
                    return;
                }

                const startTimeStr = match[1];
                const endTimeStr = match[2];

                const now = new Date();
                const startParts = startTimeStr.split(':');
                const endParts = endTimeStr.split(':');

                const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(startParts[0]), parseInt(startParts[1]), 0);
                const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(endParts[0]), parseInt(endParts[1]), 0);

                let currentState = '';

                if (now > endTime) {
                    timerContainer.style.display = 'flex';
                    timerContainer.style.background = '#fef2f2';
                    timerContainer.style.color = '#b91c1c';
                    timerContainer.style.borderColor = '#fecaca';
                    timerText.textContent = "انتهت الحصة";
                    currentState = 'ended';
                } else if (now >= startTime && now <= endTime) {
                    timerContainer.style.display = 'flex';

                    const msLeft = endTime - now;
                    const minutesLeft = Math.floor(msLeft / 60000);

                    if (minutesLeft <= 15) {
                        timerContainer.style.background = '#fffbeb';
                        timerContainer.style.color = '#b45309';
                        timerContainer.style.borderColor = '#fde68a';
                        currentState = 'warning';
                    } else {
                        timerContainer.style.background = '#e0f2fe';
                        timerContainer.style.color = '#0369a1';
                        timerContainer.style.borderColor = '#bae6fd';
                        currentState = 'active';
                    }

                    const h = Math.floor(msLeft / 3600000);
                    const m = Math.floor((msLeft % 3600000) / 60000);
                    const s = Math.floor((msLeft % 60000) / 1000);

                    timerText.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                } else if (now < startTime) {
                    timerContainer.style.display = 'flex';
                    timerContainer.style.background = '#f8fafc';
                    timerContainer.style.color = '#475569';
                    timerContainer.style.borderColor = '#e2e8f0';
                    currentState = 'upcoming';

                    const msLeft = startTime - now;
                    const h = Math.floor(msLeft / 3600000);
                    const m = Math.floor((msLeft % 3600000) / 60000);
                    const s = Math.floor((msLeft % 60000) / 1000);

                    timerText.textContent = `تبدأ الحصة بعد ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                }

                if (currentState !== lastTimerState) {
                    if (timerInitialized && lastTimerState !== '') {
                        playAlertSound(currentState);
                    }
                    lastTimerState = currentState;
                    timerInitialized = true;
                    let iconName = 'clock';
                    if (currentState === 'ended') iconName = 'check-circle';
                    else if (currentState === 'warning') iconName = 'alert-triangle';
                    else if (currentState === 'upcoming') iconName = 'hourglass';

                    if (iconWrapper) {
                        iconWrapper.innerHTML = `<span data-lucide="${iconName}" data-size="18"></span>`;
                        if (window.renderLucide) window.renderLucide(iconWrapper);
                    }
                }
            }, 1000);
        }

        startCountdownTimer();

        function shareDayWhatsApp(dayName) {
            const currentDb = window.db || (typeof db !== 'undefined' ? db : {});
            const data = (currentDb.timetable && currentDb.timetable[dayName]) ? currentDb.timetable[dayName] : null;
            if (!data) {
                window.notifySafeToast('لا توجد بيانات لهذا اليوم.');
                return;
            }

            let text = `*جدول حصص يوم ${dayName}* 📅\n\n`;

            let hasClasses = false;

            const formatSlot = (time, cls, hrs, note, type, prefix) => {
                if (cls) {
                    hasClasses = true;
                    text += `${prefix} [${time}] - ${cls}`;
                    if (type) text += ` (${type})`;
                    text += ` - ${hrs} س\n`;
                    if (note) text += `   📝 ${note}\n`;
                }
            };

            text += `*الفترة الصباحية (08:00 إلى 13:00):* ☀️\n`;
            let cBefore = hasClasses;
            formatSlot(data.m1_time || '08:00', data.m1_class, data.m1_hrs || 2, data.m1_note, data.m1_type, '🔸');
            formatSlot(data.m2_time || '10:00', data.m2_class, data.m2_hrs || 2, data.m2_note, data.m2_type, '🔸');
            formatSlot(data.m3_time || '12:00', data.m3_class, data.m3_hrs || 1, data.m3_note, data.m3_type, '🔸');
            if (cBefore === hasClasses) text += `   لا توجد حصص مسجلة\n`;

            text += `\n*الفترة المسائية (13:00 إلى 18:00):* 🌙\n`;
            cBefore = hasClasses;
            formatSlot(data.e1_time || '13:00', data.e1_class, data.e1_hrs || 2, data.e1_note, data.e1_type, '🔹');
            formatSlot(data.e2_time || '15:00', data.e2_class, data.e2_hrs || 2, data.e2_note, data.e2_type, '🔹');
            formatSlot(data.e3_time || '17:00', data.e3_class, data.e3_hrs || 1, data.e3_note, data.e3_type, '🔹');
            if (!hasClasses) {
                text += `   لا توجد حصص مسجلة\n`;
            }

            text += `\n🎓 *منظومة التدبير التربوي*`;

            const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
            window.openSafeExternalUrl(url, '_blank');
        }

        async function exportDayCard(cardElement, dayName) {
            let actionsDiv = null;
            let originalDisplay = '';
            let wasExpanded = false;
            let originalBoxShadow = '';
            let originalTransform = '';

            try {
                const h2c = await ensureHtml2Canvas();

                // إضافة كلاس للتصدير لإخفاء الأزرار مؤقتاً
                actionsDiv = cardElement.querySelector('.timetable-day-header > div:nth-child(2)');
                originalDisplay = actionsDiv ? actionsDiv.style.display : '';
                if (actionsDiv) actionsDiv.style.display = 'none';

                // التأكد من طي البطاقة أثناء التصدير لكي لا تظهر عناصر الإدخال
                wasExpanded = cardElement.classList.contains('expanded');
                if (wasExpanded) {
                    cardElement.classList.remove('expanded');
                    // ننتظر قليلاً حتى تكتمل حركة الطي
                    await new Promise(r => setTimeout(r, 250));
                }

                // حفظ الحواف الظلالية لاستعادتها
                originalBoxShadow = cardElement.style.boxShadow;
                originalTransform = cardElement.style.transform;
                cardElement.style.boxShadow = 'none';
                cardElement.style.transform = 'none';

                const canvas = await h2c(cardElement, {
                    scale: 2, // دقة عالية
                    backgroundColor: '#ffffff',
                    useCORS: true,
                    logging: false
                });

                // استعادة الأزرار والتنسيقات
                if (actionsDiv) actionsDiv.style.display = originalDisplay;
                cardElement.style.boxShadow = originalBoxShadow;
                cardElement.style.transform = originalTransform;
                if (wasExpanded) cardElement.classList.add('expanded');

                const imgData = canvas.toDataURL('image/png');
                const a = document.createElement('a');
                a.href = imgData;
                a.download = `جدول_يوم_${dayName}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                if (typeof showToast === 'function') {
                    showToast(`تم تصدير جدول يوم ${dayName} كصورة PNG بنجاح!`, 'success');
                }
            } catch (err) {
                // استعادة الأزرار والتنسيقات في حالة الخطأ
                if (actionsDiv) actionsDiv.style.display = originalDisplay;
                if (cardElement) {
                    cardElement.style.boxShadow = originalBoxShadow;
                    cardElement.style.transform = originalTransform;
                    if (wasExpanded) cardElement.classList.add('expanded');
                }
                console.error('Error exporting day card image:', err?.message || String(err));
                window.notifySafeToast('حدث خطأ أثناء تصدير الصورة: ' + (err.message || err));
            }
        }

        /* ==========================================================================
           ملحقات وربط دوال مجموعات الدعم وكشوفات الحساب الشهرية (Tutoring Statement)
           ========================================================================== */

        window.openBatchMoveTutoringGroupModal = function() {
            if (typeof window.batchMoveTutoringGroup === 'function') {
                window.batchMoveTutoringGroup();
            }
        };

        window.exportSelectedTutoringBatchReport = function() {
            if (typeof window.openTutoringGroupBatchPerformanceReportModal === 'function') {
                window.openTutoringGroupBatchPerformanceReportModal();
            }
        };

        window.clearTutoringSelection = function() {
            if (typeof window.clearTutoringBatchSelection === 'function') {
                window.clearTutoringBatchSelection();
            }
        };

        window.openAddTutoringGroupModal = function() {
            if (typeof window.openTutoringGroupManageModal === 'function') {
                window.openTutoringGroupManageModal(null);
            }
        };

        window.printTutoringAnalyticsReport = function() {
            const content = document.getElementById('tutoringAnalyticsContent');
            if (!content) {
                window.print();
                return;
            }
            const htmlDoc = `
                <!DOCTYPE html>
                <html dir="rtl" lang="ar">
                <head>
                    <meta charset="UTF-8">
                    <title>التقرير التحليلي لمجموعات الدعم والتقوية</title>
                    <style>
                        body { font-family: 'Cairo', sans-serif; padding: 20px; direction: rtl; }
                        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                        th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: right; }
                        th { background-color: #f1f5f9; }
                        @media print { body { padding: 0; } }
                    </style>
                </head>
                <body>
                    <h2 style="text-align:center; color:#1e293b;">تقرير التحليلات والمؤشرات المالية ونسب المواظبة</h2>
                    ${content.innerHTML}
                </body>
                </html>
            `;
            if (typeof window.printDocumentDirectly === 'function') {
                window.printDocumentDirectly(htmlDoc, 'التقرير التحليلي لمجموعات الدعم والتقوية', 'portrait');
            }
        };

        var currentActiveStatementStudent = null;
        var currentActiveStatementMonth = null;

        window.openTutoringStatementModal = function(studentId, month) {
            const currentDb = window.db || (typeof db !== 'undefined' ? db : {});
            if (!currentDb || !currentDb.tutoring || !currentDb.tutoring.students) return;
            const std = db.tutoring.students.find(s => s.id === studentId);
            if (!std) return;

            const activeMonth = month || (document.getElementById('tutoringMonth') ? document.getElementById('tutoringMonth').value : (new Date().toISOString().slice(0, 7)));
            currentActiveStatementStudent = std;
            currentActiveStatementMonth = activeMonth;

            const modal = document.getElementById('tutoringStatementModal');
            const docContainer = document.getElementById('tutoringStatementDocument');
            const subtitle = document.getElementById('stmtModalSubtitle');
            if (!modal || !docContainer) return;

            if (subtitle) {
                subtitle.textContent = `معاينة وتصدير كشف الحساب للتلميذ(ة): ${std.name} - لشهر: ${activeMonth}`;
            }

            let hours = 0;
            let attendedSessions = [];
            (std.sessions || []).forEach(s => {
                if (s.date && s.date.startsWith(activeMonth)) {
                    if (s.attendance !== 'absent') {
                        hours += parseFloat(s.hours) || 0;
                    }
                    attendedSessions.push(s);
                }
            });

            const rate = parseFloat(std.fee) || 0;
            const payInfo = (typeof window.getTutoringPaymentInfo === 'function')
                ? window.getTutoringPaymentInfo(std, activeMonth)
                : { totalDue: hours * rate, status: 'unpaid', paidAmount: 0, remaining: hours * rate, history: [], installments: [] };
            const totalDue = payInfo.totalDue;

            const installments = Array.isArray(payInfo.history) && payInfo.history.length > 0
                ? payInfo.history
                : ((std.payments && std.payments[activeMonth] && Array.isArray(std.payments[activeMonth].installments))
                    ? std.payments[activeMonth].installments
                    : []);

            const teacher = (db.teacherProfile && db.teacherProfile.name) || (db.teacher && db.teacher.name) || 'الأستاذ(ة)';
            const school = (db.teacherProfile && db.teacherProfile.school) || (db.teacher && db.teacher.school) || '';
            const groupName = std.group || 'عام';

            let statusText = 'غير مؤدى';
            let statusColor = '#dc2626';
            let statusBg = '#fee2e2';
            if (payInfo.status === 'paid') {
                statusText = 'مؤدى بالكامل ✓';
                statusColor = '#16a34a';
                statusBg = '#dcfce7';
            } else if (payInfo.status === 'partial') {
                statusText = 'أداء جزئي';
                statusColor = '#d97706';
                statusBg = '#fef3c7';
            }

            let sessionsRows = '';
            if (attendedSessions.length === 0) {
                sessionsRows = `<tr><td colspan="5" style="text-align:center; padding:12px; color:#64748b;">لا توجد حصص مسجلة في هذا الشهر</td></tr>`;
            } else {
                attendedSessions.forEach((s, idx) => {
                    const isAttended = s.attendance !== 'absent';
                    sessionsRows += `
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 7px 10px; text-align: center;">${idx + 1}</td>
                            <td style="padding: 7px 10px;">${escapeTutoringHtml(s.date || '—')}</td>
                            <td style="padding: 7px 10px;">${escapeTutoringHtml(s.title || s.topic || 'حصة دعم وتقوية')}</td>
                            <td style="padding: 7px 10px; text-align: center;">${s.hours || 1} س</td>
                            <td style="padding: 7px 10px; text-align: center; font-weight: bold; color: ${isAttended ? '#16a34a' : '#dc2626'};">
                                ${isAttended ? 'حاضر(ة)' : 'غائب(ة)'}
                            </td>
                        </tr>
                    `;
                });
            }

            let installmentsRows = '';
            if (installments.length === 0) {
                installmentsRows = `<tr><td colspan="5" style="text-align:center; padding:12px; color:#64748b;">لم يتم تسجيل أي دفعات مالية بعد لهذا الشهر</td></tr>`;
            } else {
                installments.forEach((inst, idx) => {
                    installmentsRows += `
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 7px 10px; text-align: center;">${idx + 1}</td>
                            <td style="padding: 7px 10px;">${escapeTutoringHtml(inst.date || '—')}</td>
                            <td style="padding: 7px 10px; font-weight: bold; color: #15803d;">${inst.amount || 0} د.م</td>
                            <td style="padding: 7px 10px;">${escapeTutoringHtml(inst.method || 'نقداً')}</td>
                            <td style="padding: 7px 10px; color: #64748b;">${escapeTutoringHtml(inst.note || '—')}</td>
                        </tr>
                    `;
                });
            }

            docContainer.innerHTML = `
                <div style="border: 2px solid #2563eb; border-radius: 8px; padding: 24px; background: #ffffff;">
                    <!-- Header -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 14px; margin-bottom: 18px;">
                        <div>
                            <h2 style="margin: 0; color: #1e3a8a; font-size: 1.35rem; font-weight: 800;">المملكة المغربية</h2>
                            <h3 style="margin: 3px 0 0 0; color: #3b82f6; font-size: 1.05rem; font-weight: 700;">كشف حساب شهري - دروس الدعم والتقوية</h3>
                            <div style="margin-top: 4px; font-size: 0.8rem; color: #64748b;">
                                المؤسسة / المركز: ${escapeTutoringHtml(school || 'مركز الدعم والتقوية')} | الأستاذ(ة): ${escapeTutoringHtml(teacher)}
                            </div>
                        </div>
                        <div style="text-align: left; direction: ltr;">
                            <span style="display: inline-block; padding: 4px 12px; border-radius: 6px; font-weight: 800; font-size: 0.84rem; background: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusColor};">
                                ${statusText}
                            </span>
                            <div style="font-size: 0.74rem; color: #64748b; margin-top: 5px;">تاريخ الكشف: ${new Date().toLocaleDateString('ar-MA')}</div>
                        </div>
                    </div>

                    <!-- Student Info Card -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; margin-bottom: 18px; font-size: 0.84rem;">
                        <div><span style="color:#64748b;">اسم التلميذ(ة):</span> <strong>${escapeTutoringHtml(std.name)}</strong></div>
                        <div><span style="color:#64748b;">المجموعة:</span> <strong>${escapeTutoringHtml(groupName)}</strong></div>
                        <div><span style="color:#64748b;">شهر الأداء:</span> <strong>${escapeTutoringHtml(activeMonth)}</strong></div>
                        <div><span style="color:#64748b;">الهاتف:</span> <span dir="ltr">${escapeTutoringHtml(std.phone || '—')}</span></div>
                    </div>

                    <!-- Financial Summary Box -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; text-align: center;">
                        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px;">
                            <div style="font-size: 0.75rem; color: #1e40af; font-weight: 700;">إجمالي الساعات والمستحق</div>
                            <div style="font-size: 1.25rem; font-weight: 900; color: #1e3a8a; margin-top: 2px;">${totalDue} د.م</div>
                            <div style="font-size: 0.72rem; color: #3b82f6;">(${hours} س × ${rate} د.م)</div>
                        </div>
                        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px;">
                            <div style="font-size: 0.75rem; color: #166534; font-weight: 700;">المؤدى الفعلي</div>
                            <div style="font-size: 1.25rem; font-weight: 900; color: #15803d; margin-top: 2px;">${payInfo.paidAmount || 0} د.م</div>
                            <div style="font-size: 0.72rem; color: #16a34a;">(نسبة الأداء: ${Math.round(((payInfo.paidAmount || 0) / (totalDue || 1)) * 100)}%)</div>
                        </div>
                        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px;">
                            <div style="font-size: 0.75rem; color: #991b1b; font-weight: 700;">المبلغ المتبقي ذمة</div>
                            <div style="font-size: 1.25rem; font-weight: 900; color: #b91c1c; margin-top: 2px;">${payInfo.remaining || 0} د.م</div>
                            <div style="font-size: 0.72rem; color: #dc2626;">(مستحق الدفع)</div>
                        </div>
                    </div>

                    <!-- Installments Table -->
                    <div style="margin-bottom: 20px;">
                        <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 0.9rem; font-weight: 800;">سجل الدفعات المستخلصة لهذا الشهر:</h4>
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; border: 1px solid #e2e8f0;">
                            <thead>
                                <tr style="background: #f8fafc; border-bottom: 1.5px solid #cbd5e1; color: #475569;">
                                    <th style="padding: 7px 10px; width: 40px; text-align: center;">#</th>
                                    <th style="padding: 7px 10px; text-align: right;">تاريخ الدفعة</th>
                                    <th style="padding: 7px 10px; text-align: right;">المبلغ</th>
                                    <th style="padding: 7px 10px; text-align: right;">طريقة الأداء</th>
                                    <th style="padding: 7px 10px; text-align: right;">البيان والملاحظات</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${installmentsRows}
                            </tbody>
                        </table>
                    </div>

                    <!-- Sessions Table -->
                    <div style="margin-bottom: 24px;">
                        <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 0.9rem; font-weight: 800;">بيان الحصص المنجزة والمواظبة:</h4>
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; border: 1px solid #e2e8f0;">
                            <thead>
                                <tr style="background: #f8fafc; border-bottom: 1.5px solid #cbd5e1; color: #475569;">
                                    <th style="padding: 7px 10px; width: 40px; text-align: center;">#</th>
                                    <th style="padding: 7px 10px; text-align: right;">تاريخ الحصة</th>
                                    <th style="padding: 7px 10px; text-align: right;">موضوع / محتوى الحصة</th>
                                    <th style="padding: 7px 10px; text-align: center;">المدة</th>
                                    <th style="padding: 7px 10px; text-align: center;">المواظبة</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${sessionsRows}
                            </tbody>
                        </table>
                    </div>

                    <!-- Signature & Seal -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 14px; border-top: 1px dashed #cbd5e1; font-size: 0.82rem; color: #475569;">
                        <div>توقيع ولي الأمر: ............................</div>
                        <div style="text-align: center;">
                            <div>خاتم وتوقيع الأستاذ(ة) المشرف(ة)</div>
                            <div style="height: 48px;"></div>
                        </div>
                    </div>
                </div>
            `;

            modal.style.display = 'flex';
            if (window.renderLucide) window.renderLucide();
        };

        window.downloadStatementFromModal = function() {
            if (currentPayStudentId) {
                window.openTutoringStatementModal(currentPayStudentId, currentPayMonth);
            } else {
                window.openTutoringStatementSelectorModal();
            }
        };

        window.closeTutoringStatementModal = function() {
            const modal = document.getElementById('tutoringStatementModal');
            if (modal) modal.style.display = 'none';
        };

        window.closeTutoringStatementSelectorModal = function() {
            const modal = document.getElementById('tutoringStatementSelectorModal');
            if (modal) modal.style.display = 'none';
        };

        window.openTutoringStatementSelectorModal = function() {
            const modal = document.getElementById('tutoringStatementSelectorModal');
            const select = document.getElementById('stmtSelectStudent');
            const monthInput = document.getElementById('stmtSelectMonth');
            if (!modal || !select) return;

            select.innerHTML = '';
            const currentDb = window.db || (typeof db !== 'undefined' ? db : null);
            const students = (currentDb && currentDb.tutoring && currentDb.tutoring.students) ? currentDb.tutoring.students : [];
            if (students.length === 0) {
                select.innerHTML = '<option value="">لا يوجد تلاميذ مسجلون في الدعم</option>';
            } else {
                students.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    opt.textContent = `${s.name} (${s.group || 'بدون مجموعة'})`;
                    select.appendChild(opt);
                });
            }

            if (monthInput) {
                monthInput.value = (document.getElementById('tutoringMonth') ? document.getElementById('tutoringMonth').value : new Date().toISOString().slice(0, 7));
            }

            modal.style.display = 'flex';
        };

        window.submitTutoringStatementSelector = function() {
            const select = document.getElementById('stmtSelectStudent');
            const monthInput = document.getElementById('stmtSelectMonth');
            const studentId = select ? select.value : '';
            const month = monthInput ? monthInput.value : '';

            if (!studentId) {
                window.notifySafeToast('يرجى اختيار تلميذ أولاً');
                return;
            }

            window.closeTutoringStatementSelectorModal();
            window.openTutoringStatementModal(studentId, month);
        };

        window.downloadActiveStatementPDF = async function() {
            const element = document.getElementById('tutoringStatementDocument');
            if (!element) return;
            const stdName = (currentActiveStatementStudent && currentActiveStatementStudent.name) ? currentActiveStatementStudent.name.replace(/\s+/g, '_') : 'تلميذ';
            const month = currentActiveStatementMonth || 'شهر';
            const filename = `كشف_حساب_${stdName}_${month}.pdf`;

            if (typeof html2pdf === 'undefined' && typeof window.ensureHtml2PdfLoaded === 'function') {
                await window.ensureHtml2PdfLoaded();
            }
            if (typeof html2pdf !== 'undefined') {
                const opt = {
                    margin: [8, 8, 8, 8],
                    filename: filename,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };
                html2pdf().set(opt).from(element).save();
            } else {
                window.print();
            }
        };

        window.printActiveStatement = function() {
            const element = document.getElementById('tutoringStatementDocument');
            if (!element) return;
            const htmlDoc = `
                <!DOCTYPE html>
                <html dir="rtl" lang="ar">
                <head>
                    <meta charset="UTF-8">
                    <title>كشف حساب شهري</title>
                    <style>
                        body { font-family: 'Cairo', sans-serif; padding: 15px; direction: rtl; }
                        table { width: 100%; border-collapse: collapse; }
                        @media print { body { padding: 0; } }
                    </style>
                </head>
                <body>
                    ${element.innerHTML}
                </body>
                </html>
            `;
            if (typeof window.printDocumentDirectly === 'function') {
                window.printDocumentDirectly(htmlDoc, 'كشف حساب شهري', 'portrait');
            }
        };

        // =========================================================================
        // Pedagogical Lesson Templates (Direct by Level & Academic Axis)
        // =========================================================================
        function _libEscHtml(val) {
            if (typeof escapeHtml === 'function') return escapeHtml(val);
            return String(val == null ? '' : val)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function _libDecodeAxis(encoded) {
            if (!encoded || encoded === 'all') return encoded || 'all';
            try { return decodeURIComponent(encoded); } catch (e) { return encoded; }
        }

        function openCreateLessonTemplateModal(defaultTopic, editItemId) {
            const existingItem = editItemId && window.db && Array.isArray(window.db.library)
                ? window.db.library.find(i => i.id === editItemId)
                : null;

            let modal = document.getElementById('libLessonTemplateModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'libLessonTemplateModal';
                modal.className = 'modal-overlay';
                modal.style.cssText = 'display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65); z-index: 9999; align-items: center; justify-content: center; padding: 16px; overflow-y: auto;';
                document.body.appendChild(modal);
            }

            const currentLevel = existingItem ? (existingItem.level || 'عام') : '2BAC-PC';
            const currentTopic = existingItem ? (existingItem.topic || '') : (defaultTopic || '');

            const levelOptions = [
                { val: 'عام', label: 'عام / مشترك لجميع المستويات' },
                { val: 'TC-SC', label: 'الجذع المشترك العلمي (TCS)' },
                { val: 'TC-TECH', label: 'الجذع المشترك التكنولوجي (TCT)' },
                { val: 'TC-LSH', label: 'الجذع المشترك للآداب والعلوم الإنسانية' },
                { val: '1BAC-SM', label: 'الأولى باك علوم رياضية (1BAC SM)' },
                { val: '1BAC-EXP', label: 'الأولى باك علوم تجريبية (1BAC SE)' },
                { val: '1BAC-ECO', label: 'الأولى باك علوم اقتصادية' },
                { val: '1BAC-LSH', label: 'الأولى باك آداب وعلوم إنسانية' },
                { val: '2BAC-SM', label: 'الثانية باك علوم رياضية (2BAC SM)' },
                { val: '2BAC-PC', label: 'الثانية باك علوم فيزيائية / ح أ (PC/SVT)' },
                { val: '2BAC-ECO', label: 'الثانية باك علوم اقتصادية' },
                { val: '2BAC-LSH', label: 'الثانية باك آداب وعلوم إنسانية' }
            ];

            modal.innerHTML = `
                <div style="background: #ffffff; width: 100%; max-width: 640px; border-radius: 14px; padding: 22px; box-shadow: 0 20px 45px rgba(0,0,0,0.25); border: 1.5px solid #5eead4; direction: rtl; text-align: right; font-family: 'Cairo', sans-serif; max-height: 92vh; overflow-y: auto;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 14px;">
                        <h3 style="margin: 0; font-size: 1.08rem; font-weight: 900; color: #0f766e;">📐 ${existingItem ? 'تعديل قالب الدرس البيداغوجي' : 'إنشاء قالب درس بيداغوجي جديد'}</h3>
                        <button type="button" onclick="document.getElementById('libLessonTemplateModal').style.display='none'" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #64748b;">✕</button>
                    </div>
                    <input type="hidden" id="tplEditItemId" value="${existingItem ? existingItem.id : ''}">
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <div style="flex: 1.3; min-width: 210px;">
                                <label style="font-size: 0.82rem; font-weight: 800; color: #0f766e;">🎓 المستوى الدراسي والشعبة:</label>
                                <select id="tplLevelSelect" style="width: 100%; padding: 9px 10px; border-radius: 8px; border: 1.5px solid #2dd4bf; background: #f0fdfa; font-weight: 800; color: #115e59; margin-top: 4px;">
                                    ${levelOptions.map(o => `<option value="${o.val}" ${o.val === currentLevel ? 'selected' : ''}>${o.label}</option>`).join('')}
                                </select>
                            </div>
                            <div style="flex: 1; min-width: 150px;">
                                <label style="font-size: 0.82rem; font-weight: 800; color: #334155;">⏱️ الغلاف الزمني (ساعات):</label>
                                <input type="number" id="tplDurationHours" min="1" max="30" value="${existingItem && existingItem.templateDuration ? existingItem.templateDuration : 6}" style="width: 100%; padding: 9px 10px; border-radius: 8px; border: 1px solid #cbd5e1; margin-top: 4px;">
                            </div>
                        </div>

                        <div>
                            <label style="font-size: 0.82rem; font-weight: 800; color: #334155;">📚 المحور الدراسي المرتبط:</label>
                            <input type="text" id="tplLessonTopic" value="${_libEscHtml(currentTopic)}" placeholder="مثال: الاتصال ومبرهنة القيم الوسيطية / الأعداد العقدية" style="width: 100%; padding: 9px 12px; border-radius: 8px; border: 1px solid #cbd5e1; margin-top: 4px;">
                        </div>

                        <div>
                            <label style="font-size: 0.82rem; font-weight: 800; color: #334155;">عنوان قالب الدرس:</label>
                            <input type="text" id="tplLessonTitle" value="${existingItem ? _libEscHtml(existingItem.title) : ''}" placeholder="مثال: قالب درس: الاتصال ومبرهنة القيم الوسيطية" style="width: 100%; padding: 9px 12px; border-radius: 8px; border: 1px solid #cbd5e1; margin-top: 4px;">
                        </div>

                        <div>
                            <label style="font-size: 0.82rem; font-weight: 800; color: #334155;">🎯 القدرات المنتظرة والأهداف البيداغوجية:</label>
                            <textarea id="tplObjectives" rows="2" placeholder="مثال: دراسة اتصال دالة عددية في نقطة وعلى مجال، وتوظيف مبرهنة القيم الوسيطية..." style="width: 100%; padding: 9px 12px; border-radius: 8px; border: 1px solid #cbd5e1; margin-top: 4px; font-family: inherit;">${existingItem && existingItem.templateObjectives ? _libEscHtml(existingItem.templateObjectives) : ''}</textarea>
                        </div>

                        <div>
                            <label style="font-size: 0.82rem; font-weight: 800; color: #334155;">🔗 المكتسبات القبلية اللازمة:</label>
                            <input type="text" id="tplPrerequisites" value="${existingItem && existingItem.templatePrerequisites ? _libEscHtml(existingItem.templatePrerequisites) : ''}" placeholder="مثال: نهايات الدوال العددية، الترتيب في IR" style="width: 100%; padding: 9px 12px; border-radius: 8px; border: 1px solid #cbd5e1; margin-top: 4px;">
                        </div>

                        <div>
                            <label style="font-size: 0.82rem; font-weight: 800; color: #334155;">📋 هيكلة فقرات الدرس والسيناريو البيداغوجي:</label>
                            <textarea id="tplStructurePlan" rows="4" placeholder="1. نشاط بنائي تمهيدي&#10;2. الفقرة الأولى: تعاريف وخاصيات أساسية&#10;3. أمثلة وتطبيقات&#10;4. تمارين الدعم والتقويم" style="width: 100%; padding: 9px 12px; border-radius: 8px; border: 1px solid #cbd5e1; margin-top: 4px; font-family: inherit;">${existingItem && existingItem.templatePlan ? _libEscHtml(existingItem.templatePlan) : ''}</textarea>
                        </div>

                        <div>
                            <label style="font-size: 0.82rem; font-weight: 800; color: #334155;">🌐 رابط ملف PDF أو فيديو مرفق (اختياري):</label>
                            <input type="url" id="tplExternalUrl" dir="ltr" value="${existingItem && existingItem.url ? _libEscHtml(existingItem.url) : ''}" placeholder="https://..." style="width: 100%; padding: 9px 12px; border-radius: 8px; border: 1px solid #cbd5e1; margin-top: 4px;">
                        </div>

                        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px;">
                            <button type="button" onclick="document.getElementById('libLessonTemplateModal').style.display='none'" style="padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; color: #334155; font-weight: 700; cursor: pointer;">إلغاء</button>
                            <button type="button" onclick="saveLibraryLessonTemplate()" style="padding: 8px 20px; border-radius: 8px; border: none; background: linear-gradient(135deg, #0d9488, #0f766e); color: #ffffff; font-weight: 800; cursor: pointer;">💾 حفظ قالب الدرس</button>
                        </div>
                    </div>
                </div>
            `;
            modal.style.display = 'flex';
        }
        window.openCreateLessonTemplateModal = openCreateLessonTemplateModal;

        function saveLibraryLessonTemplate() {
            const editId = document.getElementById('tplEditItemId') ? document.getElementById('tplEditItemId').value.trim() : '';
            const resolvedLevel = document.getElementById('tplLevelSelect') ? document.getElementById('tplLevelSelect').value : 'عام';
            const resolvedTopic = document.getElementById('tplLessonTopic') ? document.getElementById('tplLessonTopic').value.trim() : '';
            const title = document.getElementById('tplLessonTitle') ? document.getElementById('tplLessonTitle').value.trim() : '';
            const duration = document.getElementById('tplDurationHours') ? parseInt(document.getElementById('tplDurationHours').value, 10) || 4 : 4;
            const objectives = document.getElementById('tplObjectives') ? document.getElementById('tplObjectives').value.trim() : '';
            const prerequisites = document.getElementById('tplPrerequisites') ? document.getElementById('tplPrerequisites').value.trim() : '';
            const plan = document.getElementById('tplStructurePlan') ? document.getElementById('tplStructurePlan').value.trim() : '';
            const extUrl = document.getElementById('tplExternalUrl') ? document.getElementById('tplExternalUrl').value.trim() : '';

            if (!title) {
                window.notifySafeToast('يرجى إدخال عنوان قالب الدرس.');
                return;
            }

            if (!window.db.library) window.db.library = [];

            if (editId) {
                const existing = window.db.library.find(i => i.id === editId);
                if (existing) {
                    existing.title = title;
                    existing.level = resolvedLevel;
                    existing.topic = resolvedTopic;
                    existing.category = 'قالب درس';
                    existing.isLessonTemplate = true;
                    existing.templateDuration = duration;
                    existing.templateObjectives = objectives;
                    existing.templatePrerequisites = prerequisites;
                    existing.templatePlan = plan;
                    if (extUrl) existing.url = extUrl;
                }
            } else {
                window.db.library.unshift({
                    id: 'tpl_' + Date.now(),
                    title: title,
                    url: extUrl || '',
                    isLocalFile: false,
                    isDriveFile: false,
                    isLessonTemplate: true,
                    category: 'قالب درس',
                    type: extUrl ? 'link' : 'doc',
                    topic: resolvedTopic || title,
                    level: resolvedLevel,
                    templateDuration: duration,
                    templateObjectives: objectives,
                    templatePrerequisites: prerequisites,
                    templatePlan: plan,
                    isNew: true,
                    addedTimestamp: Date.now(),
                    dateAdded: window.formatLocalDate ? window.formatLocalDate() : new Date().toLocaleDateString('en-CA')
                });
            }

            if (typeof saveDB === 'function') saveDB();
            const modal = document.getElementById('libLessonTemplateModal');
            if (modal) modal.style.display = 'none';

            renderLibrary();
            if (typeof showLibraryToast === 'function') {
                showLibraryToast(`✓ تم حفظ قالب الدرس «${title}» بنجاح!`);
            }
        }
        window.saveLibraryLessonTemplate = saveLibraryLessonTemplate;

        function openLessonTemplateViewerModal(itemId) {
            const item = (window.db && Array.isArray(window.db.library)) ? window.db.library.find(i => i.id === itemId) : null;
            if (!item) return;

            let modal = document.getElementById('libLessonTemplateViewerModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'libLessonTemplateViewerModal';
                modal.className = 'modal-overlay';
                modal.style.cssText = 'display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65); z-index: 9999; align-items: center; justify-content: center; padding: 16px; overflow-y: auto;';
                document.body.appendChild(modal);
            }

            modal.innerHTML = `
                <div style="background: #ffffff; width: 100%; max-width: 680px; border-radius: 14px; padding: 24px; box-shadow: 0 20px 45px rgba(0,0,0,0.25); border: 2px solid #0d9488; direction: rtl; text-align: right; font-family: 'Cairo', sans-serif; max-height: 92vh; overflow-y: auto;">
                    <div id="printableLessonTemplateCard">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0d9488; padding-bottom: 12px; margin-bottom: 16px;">
                            <div>
                                <div style="font-size: 0.76rem; font-weight: 800; color: #0f766e;">📐 بطاقة قالب درس بيداغوجي مهيكل • مادة الرياضيات</div>
                                <h3 style="margin: 4px 0 0 0; font-size: 1.2rem; font-weight: 900; color: #0f172a;">${_libEscHtml(item.title)}</h3>
                            </div>
                            <span style="background: #f0fdfa; color: #0f766e; border: 1px solid #5eead4; padding: 4px 10px; border-radius: 8px; font-size: 0.78rem; font-weight: 800;">
                                ${_libEscHtml(item.topic || item.level || 'عام')}
                            </span>
                        </div>

                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin-bottom: 14px;">
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 9px 12px;">
                                <div style="font-size: 0.72rem; color: #64748b; font-weight: 700;">المستوى الدراسي</div>
                                <div style="font-size: 0.9rem; font-weight: 800; color: #0f172a;">${_libEscHtml(item.level || 'عام')}</div>
                            </div>
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 9px 12px;">
                                <div style="font-size: 0.72rem; color: #64748b; font-weight: 700;">الغلاف الزمني المقدر</div>
                                <div style="font-size: 0.9rem; font-weight: 800; color: #0f766e;">${item.templateDuration || 6} ساعات تدريسية</div>
                            </div>
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 9px 12px;">
                                <div style="font-size: 0.72rem; color: #64748b; font-weight: 700;">تاريخ الإعداد</div>
                                <div style="font-size: 0.9rem; font-weight: 800; color: #334155;">${_libEscHtml(item.dateAdded || '-')}</div>
                            </div>
                        </div>

                        <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 10px; padding: 12px 14px; margin-bottom: 12px;">
                            <div style="font-weight: 900; color: #115e59; font-size: 0.86rem; margin-bottom: 4px;">🎯 القدرات المنتظرة والأهداف البيداغوجية:</div>
                            <div style="font-size: 0.85rem; color: #134e4a; line-height: 1.6; white-space: pre-line;">${_libEscHtml(item.templateObjectives || 'تحقيق الكفايات المنهجية والتواصلية المرتبطة بمحور الدرس وفق التوجيهات التربوية الرسمية.')}</div>
                        </div>

                        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 12px 14px; margin-bottom: 12px;">
                            <div style="font-weight: 900; color: #1e3a8a; font-size: 0.86rem; margin-bottom: 4px;">🔗 المكتسبات القبلية اللازمة:</div>
                            <div style="font-size: 0.85rem; color: #1e40af; line-height: 1.6;">${_libEscHtml(item.templatePrerequisites || 'المفاهيم والخاصيات الأساسية المدروسة في الوحدات السابقة.')}</div>
                        </div>

                        <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px 14px;">
                            <div style="font-weight: 900; color: #0f172a; font-size: 0.86rem; margin-bottom: 6px;">📋 هيكلة فقرات الدرس والسيناريو البيداغوجي:</div>
                            <div style="font-size: 0.85rem; color: #334155; line-height: 1.7; white-space: pre-line;">${_libEscHtml(item.templatePlan || '1. نشاط تشخيصي وبنائي\n2. صياغة التعاريف والخاصيات الأساسية\n3. أمثلة وتمارين تطبيقية مرحلية\n4. تقويم تكويني ودعم وقائي')}</div>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
                        <button type="button" onclick="document.getElementById('libLessonTemplateViewerModal').style.display='none'" style="padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; color: #334155; font-weight: 700; cursor: pointer;">إغلاق</button>
                        <button type="button" onclick="document.getElementById('libLessonTemplateViewerModal').style.display='none'; openCreateLessonTemplateModal('', '${item.id}')" style="padding: 8px 16px; border-radius: 8px; border: 1px solid #5eead4; background: #f0fdfa; color: #0f766e; font-weight: 800; cursor: pointer;">✏️ تعديل القالب</button>
                        <button type="button" onclick="printLessonTemplateCard()" style="padding: 8px 18px; border-radius: 8px; border: none; background: #0d9488; color: #ffffff; font-weight: 800; cursor: pointer;">🖨️ طباعة بطاقة القالب</button>
                    </div>
                </div>
            `;
            modal.style.display = 'flex';
        }
        window.openLessonTemplateViewerModal = openLessonTemplateViewerModal;

        function printLessonTemplateCard() {
            const cardEl = document.getElementById('printableLessonTemplateCard');
            if (!cardEl) return;
            const htmlDoc = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>بطاقة قالب درس بيداغوجي</title><style>body{font-family:'Cairo',sans-serif;padding:24px;direction:rtl;color:#0f172a;}</style></head><body>${cardEl.innerHTML}</body></html>`;
            if (typeof window.printDocumentDirectly === 'function') {
                window.printDocumentDirectly(htmlDoc, 'بطاقة قالب درس بيداغوجي', 'portrait');
            }
        }
        window.printLessonTemplateCard = printLessonTemplateCard;

        function seedStarterLessonTemplates() {
            if (!window.db.library) window.db.library = [];

            const starterTemplates = [
                {
                    id: 'tpl_starter_tc_1',
                    title: 'قالب درس: المجموعات IR و Q و D والترتيب في المجموعة IR',
                    level: 'TC-SC',
                    topic: 'الترتيب في IR والمجموعات',
                    templateDuration: 7,
                    templateObjectives: 'التمييز بين مجموعات الأعداد، التمكن من قواعد الترتيب والعمليات في IR، تأطير تعابير جبرية واستعمال القيمة المطلقة والمجالات.',
                    templatePrerequisites: 'العمليات الأربع في Q، القوى والجذور المربعة بالسلك الإعدادي.',
                    templatePlan: '1. نشاط تمهيدي لتصنيف الأعداد وبناء مجموعات الأعداد\n2. الترتيب في IR والعمليات والتأطير\n3. المجالات والقيمة المطلقة والمسافة بين عددين\n4. تمارين تطبيقية وتوليفية للدعم'
                },
                {
                    id: 'tpl_starter_tc_2',
                    title: 'قالب درس: الحساب المتجهي والمستقيم في المستوى',
                    level: 'TC-SC',
                    topic: 'الحساب المتجهي والمستقيم في المستوى',
                    templateDuration: 8,
                    templateObjectives: 'التحكم في علاقة شال، استقامية متجهتين، تحديد معادلة ديكارتية وتمثيل بارامتري لمستقيم في معلم.',
                    templatePrerequisites: 'الإزاحة والمتجهات ومعادلة مستقيم بالسنة الثالثة إعدادي.',
                    templatePlan: '1. تذكير بعلاقة شال وضرب متجهة في عدد حقيقي\n2. المعلم في المستوى وإحداثيات متجهة\n3. التمثيل البارامتري والمعادلة الديكارتية لمستقيم\n4. الأوضاع النسبية لمستقيمين'
                },
                {
                    id: 'tpl_starter_1bac_1',
                    title: 'قالب درس: مبادئ في المنطق الرياضي وأنماط الاستدلال',
                    level: '1BAC-EXP',
                    topic: 'مبادئ في المنطق',
                    templateDuration: 6,
                    templateObjectives: 'التعرف على العبارات والروابط المنطقية والمكممات، وتوظيف الاستدلال بالخلف، بفصل الحالات، وبالترجع في براهين رياضية.',
                    templatePrerequisites: 'الحساب العددي، المعادلات والمتراجحات، قابلية القسمة في IN.',
                    templatePlan: '1. العبارة والدالة العبارية والمكممات الكونية والوجودية\n2. الروابط المنطقية (النفي، العطف، الفصل، الاستلزام، التكافؤ)\n3. طرق الاستدلال الرياضي (المباشر، المضاد للعكس، الخلف، الترجع)\n4. تمارين نموذجية للفروض المحروسة'
                },
                {
                    id: 'tpl_starter_1bac_2',
                    title: 'قالب درس: المتتاليات العددية (الحسابية والهندسية)',
                    level: '1BAC-EXP',
                    topic: 'المتتاليات العددية',
                    templateDuration: 7,
                    templateObjectives: 'دراسة رتابة متتالية عددية، التعرف على المتتالية الحسابية والهندسية، وحساب الحد العام ومجموع حدود متتابعة.',
                    templatePrerequisites: 'عموميات حول الدوال، الاستدلال بالترجع، الحساب العددي.',
                    templatePlan: '1. تعريف متتالية عددية وطرق توليدها (صيغة صريحة / ترجعية)\n2. المتتالية المكبورة والمصغورة ورتابة متتالية\n3. المتتاليات الحسابية (الحد العام والمجموع)\n4. المتتاليات الهندسية وتطبيقاتها'
                },
                {
                    id: 'tpl_starter_2bac_1',
                    title: 'قالب درس: الاتصال والاشتقاق ودراسة الدوال العددية',
                    level: '2BAC-PC',
                    topic: 'الاتصال ومبرهنة القيم الوسيطية',
                    templateDuration: 10,
                    templateObjectives: 'دراسة اتصال دالة على مجال، تطبيق مبرهنة القيم الوسيطية، قابلية الاشتقاق ودراسة الدالة العكسية ومشتقتها.',
                    templatePrerequisites: 'النهايات والاشتقاق بالسنة الأولى باكالوريا.',
                    templatePlan: '1. الاتصال في نقطة وعلى مجال وصورة مجال بدالة متصلة\n2. مبرهنة القيم الوسيطية وطريقة التفرع الثنائي\n3. الدالة العكسية لدالة متصلة ورتيبة قطعا\n4. اشتقاق دالة مركبة واشتقاق الدالة العكسية ودراسة الفروع اللانهائية'
                },
                {
                    id: 'tpl_starter_2bac_2',
                    title: 'قالب درس: الأعداد العقدية وتطبيقاتها الهندسية',
                    level: '2BAC-PC',
                    topic: 'الأعداد العقدية',
                    templateDuration: 9,
                    templateObjectives: 'التحكم في الشكل الجبري والمثلثي والأسي لعدد عقدي، حل معادلات من الدرجة الثانية في C، وتأويل الإزاحة والتحاكي والدوران عقدياً.',
                    templatePrerequisites: 'الحساب المثلثي، المتجهات والتحويلات الهندسية في المستوى.',
                    templatePlan: '1. المجموعة C والشكل الجبري والمرافق والمعيار\n2. الشكل المثلثي والعمدة والترميز الأسي وصيغة موافر وأولير\n3. التأويل الهندسي (المسافة، قياس الزوايا، استقامية وتداور النقط)\n4. التمثيل العقدي للإزاحة والتحاكي والدوران (تمارين الامتحان الوطني)'
                }
            ];

            let addedCount = 0;
            starterTemplates.forEach(tpl => {
                if (!window.db.library.some(i => i.id === tpl.id || i.title === tpl.title)) {
                    window.db.library.unshift(Object.assign({}, tpl, {
                        url: '',
                        isLocalFile: false,
                        isDriveFile: false,
                        isLessonTemplate: true,
                        category: 'قالب درس',
                        type: 'doc',
                        isNew: true,
                        addedTimestamp: Date.now(),
                        dateAdded: window.formatLocalDate ? window.formatLocalDate() : new Date().toLocaleDateString('en-CA')
                    }));
                    addedCount++;
                }
            });

            if (typeof saveDB === 'function') saveDB();
            renderLibrary();
            if (typeof showLibraryToast === 'function') {
                if (addedCount > 0) {
                    showLibraryToast(`✓ تم إدراج ${addedCount} قوالب دروس نموذجية بنجاح!`);
                } else {
                    showLibraryToast('ℹ️ قوالب الدروس النموذجية مدرجة وموجودة بالفعل في مكتبتك.');
                }
            }
        }
        window.seedStarterLessonTemplates = seedStarterLessonTemplates;

        // =========================================================================
        // Lesson-Linked Resources Engine (الموارد المرتبطة بالدروس: PDF وفيديوهات توضيحية)
        // ربط كل درس بملفات PDF وفيديوهات توضيحية من المكتبة بناءً على المحور الدراسي المرتبط
        // مع عرضها في لوحة جانبية داخل تبويب المكتبة وتبويب الموارد المرتبطة بالدروس
        // =========================================================================
        window.currentBrowseSidebarMode = window.currentBrowseSidebarMode || 'lessons'; // 'lessons' | 'analytics'
        window.currentSelectedLessonForResources = window.currentSelectedLessonForResources || '';
        window.currentSelectedAxisFilter = window.currentSelectedAxisFilter || 'all';
        window.currentBrowseSideLevelId = window.currentBrowseSideLevelId || 'TCS';
        window.currentBrowseSideLessonId = window.currentBrowseSideLessonId || '';
        window.currentBrowseSideAxisFilter = window.currentBrowseSideAxisFilter || 'all';

        const MATH_STOPWORDS_SET = new Set([
            'في', 'من', 'على', 'الى', 'إلى', 'عن', 'مع', 'حول', 'بين', 'او', 'أو', 'ثم', 'بعد', 'قبل',
            'الدرس', 'درس', 'محور', 'المحور', 'تمارين', 'سلسله', 'سلسلة', 'ملخص', 'فيديو', 'شرح', 'ملف',
            'داله', 'دالة', 'دوال', 'العدديه', 'العددية', 'تطبيقات', 'تطبيقاتها', 'مفهوم', 'تعريف', 'خاصيات',
            'حساب', 'دراسه', 'دراسة', 'مبادئ', 'اساسيه', 'أساسية', 'عامه', 'عامة', 'الجزء', 'الاول', 'الثاني',
            'pdf', 'doc', 'docx', 'mp4', 'video', 'youtube', 'drive', 'dans', 'les', 'des', 'sur', 'pour', 'avec', 'une'
        ]);

        function normalizeMathAxisText(str) {
            if (!str) return '';
            return String(str)
                .toLowerCase()
                .replace(/[\u064B-\u065F\u0670]/g, '')
                .replace(/[أإآ]/g, 'ا')
                .replace(/ة/g, 'ه')
                .replace(/ى/g, 'ي')
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }
        window.normalizeMathAxisText = normalizeMathAxisText;

        function tokenizeMathAxisKeywords(str) {
            const norm = normalizeMathAxisText(str);
            if (!norm) return [];
            return Array.from(new Set(
                norm.split(' ').filter(w => w.length >= 3 && !MATH_STOPWORDS_SET.has(w))
            ));
        }

        function isLibraryItemVideo(item) {
            if (!item) return false;
            if (typeof getResourceFileMeta === 'function') {
                const meta = getResourceFileMeta(item);
                if (meta && meta.isVideo) return true;
            }
            const t = (item.type || '').toLowerCase();
            const fn = (item.fileName || '').toLowerCase();
            const url = (item.url || '').toLowerCase();
            const cat = (item.category || '').toLowerCase();
            return t === 'video'
                || /\.(mp4|webm|mov|mkv|avi)(?:$|\?)/i.test(fn)
                || /\.(mp4|webm|mov|mkv|avi)(?:$|\?)/i.test(url)
                || /youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com/i.test(url)
                || (cat === 'عرض ووسائط' && /فيديو|شريط|مرئي|video/i.test(`${item.title || ''} ${url}`));
        }

        function isLibraryItemPdfOrDoc(item) {
            if (!item) return false;
            if (isLibraryItemVideo(item)) return false;
            if (typeof getResourceFileMeta === 'function') {
                const meta = getResourceFileMeta(item);
                if (meta && meta.isPdf) return true;
                if (meta && ['PDF', 'DOC', 'DOCX', 'PPT', 'PPTX'].includes(meta.ext)) return true;
            }
            const t = (item.type || '').toLowerCase();
            const fn = (item.fileName || '').toLowerCase();
            const url = (item.url || '').toLowerCase();
            if (/\.pdf(?:$|\?)/i.test(fn) || /\.pdf(?:$|\?)/i.test(url)) return true;
            if (t === 'doc' && (item.isLocalFile || item.isDriveFile || item.url)) return true;
            if (item.isDriveFile && /pdf|doc|word|ppt|slide|document/i.test(item.fileType || '')) return true;
            return false;
        }

        function normalizeCurriculumLevelId(lvlId) {
            if (!lvlId || lvlId === 'all') return 'all';
            const map = {
                'TCLSH': 'TCL',
                '1BACSM': '1BAC_SM',
                '1BACSE': '1BAC_EXP',
                '1BACECO': '1BAC_ECO',
                '1BACLSH': '1BAC_LSH',
                '2BACSM': '2BAC_SM',
                '2BACPC': '2BAC_EXP',
                '2BACECO': '2BAC_ECO',
                '2BACLSH': '2BAC_LSH'
            };
            return map[lvlId] || lvlId;
        }

        function getCurriculumLevelGroupCode(lvlStr) {
            const s = String(lvlStr || '').toUpperCase();
            if (!s || s === 'عام' || s === 'ALL') return 'GENERAL';
            if (s.includes('2BAC') || s.includes('الثانية باك') || s.includes('2 باك')) return '2BAC';
            if (s.includes('1BAC') || s.includes('الأولى باك') || s.includes('1 باك')) return '1BAC';
            if (s.includes('TC') || s.includes('جذع')) return 'TC';
            return 'GENERAL';
        }

        function isItemLevelCompatibleWithLesson(itemLevel, lessonLevelId) {
            const itemGrp = getCurriculumLevelGroupCode(itemLevel);
            if (itemGrp === 'GENERAL') return true;
            const lessonGrp = getCurriculumLevelGroupCode(lessonLevelId);
            if (lessonGrp === 'GENERAL') return true;
            return itemGrp === lessonGrp;
        }

        function getAllCurriculumLessonsList(levelFilter, semesterFilter, searchTerm) {
            const cur = window.MOROCCAN_SECONDARY_MATH_CURRICULUM || {};
            const normLvl = normalizeCurriculumLevelId(levelFilter || 'all');
            const normSem = semesterFilter || 'all';
            const normSearch = normalizeMathAxisText(searchTerm || '');
            const lessonsList = [];

            Object.keys(cur).forEach(lvlId => {
                if (normLvl !== 'all' && lvlId !== normLvl) return;
                const lvlObj = cur[lvlId];
                if (!lvlObj || !lvlObj.semesters) return;

                Object.keys(lvlObj.semesters).forEach(semKey => {
                    if (normSem !== 'all' && semKey !== normSem) return;
                    const semObj = lvlObj.semesters[semKey];
                    if (!semObj || !Array.isArray(semObj.lessons)) return;

                    semObj.lessons.forEach(lesson => {
                        const wrapped = {
                            id: lesson.id,
                            order: lesson.order || 0,
                            title: lesson.title || '',
                            frenchTitle: lesson.frenchTitle || '',
                            hours: lesson.hours || lesson.plannedHours || 0,
                            competency: lesson.competency || '',
                            examTarget: lesson.examTarget || '',
                            axes: Array.isArray(lesson.axes) ? lesson.axes : [],
                            levelId: lvlId,
                            levelName: lvlObj.shortName || lvlObj.name || lvlId,
                            semesterId: semKey,
                            semesterName: semObj.name || (semKey === 's1' ? 'الأسدوس 1' : 'الأسدوس 2')
                        };

                        if (normSearch) {
                            const hay = normalizeMathAxisText(
                                `${wrapped.title} ${wrapped.frenchTitle} ${wrapped.levelName} ` +
                                wrapped.axes.map(a => `${a.title || ''} ${a.desc || ''}`).join(' ')
                            );
                            if (!hay.includes(normSearch)) return;
                        }
                        lessonsList.push(wrapped);
                    });
                });
            });

            return lessonsList;
        }
        window.getAllCurriculumLessonsList = getAllCurriculumLessonsList;

        function matchLibraryItemToLessonWithAxis(item, lesson) {
            if (!item || !lesson) return null;

            // 1. Explicit manual link saved on the item
            const isManualLinked = Array.isArray(item.linkedLessonIds) && item.linkedLessonIds.includes(lesson.id);
            const manualAxis = (item.linkedAxisByLesson && item.linkedAxisByLesson[lesson.id]) ? item.linkedAxisByLesson[lesson.id] : '';

            const itemTextNorm = normalizeMathAxisText(
                `${item.title || ''} ${item.topic || ''} ${item.fileName || ''} ${item.templateObjectives || ''}`
            );

            // Find best matching axis among lesson.axes
            let bestAxisTitle = manualAxis || '';
            let bestAxisScore = 0;

            (lesson.axes || []).forEach(ax => {
                const axTitle = ax.title || '';
                const axTitleNorm = normalizeMathAxisText(axTitle);
                const axDescNorm = normalizeMathAxisText(ax.desc || '');
                const axTokens = tokenizeMathAxisKeywords(`${axTitle} ${ax.desc || ''}`);

                let score = 0;
                if (axTitleNorm && itemTextNorm.includes(axTitleNorm)) {
                    score += 12;
                }
                if (item.topic) {
                    const topicNorm = normalizeMathAxisText(item.topic);
                    if (topicNorm && (axTitleNorm.includes(topicNorm) || axDescNorm.includes(topicNorm))) {
                        score += 6;
                    }
                }
                let tokenHits = 0;
                axTokens.forEach(tok => {
                    if (itemTextNorm.includes(tok)) {
                        tokenHits++;
                    }
                });
                score += tokenHits * 2.5;

                if (score > bestAxisScore) {
                    bestAxisScore = score;
                    if (!manualAxis) bestAxisTitle = axTitle;
                }
            });

            if (isManualLinked) {
                return {
                    item,
                    lesson,
                    isManual: true,
                    matchedAxis: bestAxisTitle || ((lesson.axes && lesson.axes[0]) ? lesson.axes[0].title : lesson.title),
                    score: 100 + bestAxisScore
                };
            }

            // 2. Automatic matching by associated academic axis & level compatibility
            if (!isItemLevelCompatibleWithLesson(item.level, lesson.levelId)) {
                return null;
            }

            const lessonTitleClean = (lesson.title || '').replace(/\([^)]*\)/g, '');
            const lessonTitleNorm = normalizeMathAxisText(lessonTitleClean);
            const frenchTitleNorm = normalizeMathAxisText(lesson.frenchTitle || '');
            const lessonTokens = tokenizeMathAxisKeywords(`${lessonTitleClean} ${lesson.frenchTitle || ''}`);

            let lessonScore = 0;
            if (lessonTitleNorm && lessonTitleNorm.length >= 4 && itemTextNorm.includes(lessonTitleNorm)) {
                lessonScore += 14;
            }
            if (frenchTitleNorm && frenchTitleNorm.length >= 4 && itemTextNorm.includes(frenchTitleNorm)) {
                lessonScore += 12;
            }
            if (item.topic) {
                const topicNorm = normalizeMathAxisText(item.topic);
                if (topicNorm && topicNorm.length >= 4 && (lessonTitleNorm.includes(topicNorm) || topicNorm.includes(lessonTitleNorm))) {
                    lessonScore += 8;
                }
            }

            let lessonTokenHits = 0;
            lessonTokens.forEach(tok => {
                if (itemTextNorm.includes(tok)) {
                    lessonTokenHits++;
                }
            });
            lessonScore += lessonTokenHits * 3;

            const totalScore = bestAxisScore + lessonScore;

            if (totalScore >= 5 && (bestAxisScore >= 5 || lessonScore >= 5 || (lessonTokenHits + (bestAxisScore / 2.5)) >= 2)) {
                return {
                    item,
                    lesson,
                    isManual: false,
                    matchedAxis: bestAxisTitle || ((lesson.axes && lesson.axes[0]) ? lesson.axes[0].title : lesson.title),
                    score: totalScore
                };
            }

            return null;
        }

        function getResourcesLinkedToLesson(lesson, axisFilterTitle) {
            const emptyRes = { pdfs: [], videos: [], others: [], all: [], totalBeforeAxisFilter: 0, axisCounts: {} };
            if (!lesson) return emptyRes;

            const items = (window.db && Array.isArray(window.db.library)) ? window.db.library : [];
            const matched = [];

            items.forEach(item => {
                const m = matchLibraryItemToLessonWithAxis(item, lesson);
                if (m) matched.push(m);
            });

            matched.sort((a, b) => (b.score - a.score));

            const axisCounts = {};
            (lesson.axes || []).forEach(ax => { axisCounts[ax.title] = 0; });
            matched.forEach(m => {
                if (m.matchedAxis && axisCounts[m.matchedAxis] !== undefined) {
                    axisCounts[m.matchedAxis]++;
                }
            });

            const activeAxis = (axisFilterTitle && axisFilterTitle !== 'all') ? axisFilterTitle : 'all';
            const filteredMatches = activeAxis === 'all'
                ? matched
                : matched.filter(m => m.matchedAxis === activeAxis);

            const pdfs = [];
            const videos = [];
            const others = [];

            filteredMatches.forEach(m => {
                if (isLibraryItemVideo(m.item)) {
                    videos.push(m);
                } else if (isLibraryItemPdfOrDoc(m.item)) {
                    pdfs.push(m);
                } else {
                    others.push(m);
                }
            });

            return {
                pdfs,
                videos,
                others,
                all: filteredMatches,
                totalBeforeAxisFilter: matched.length,
                axisCounts
            };
        }
        window.getResourcesLinkedToLesson = getResourcesLinkedToLesson;

        function findCurriculumLessonsForLibraryItem(item) {
            if (!item) return [];
            const lessons = getAllCurriculumLessonsList('all', 'all', '');
            const hits = [];
            lessons.forEach(lesson => {
                const m = matchLibraryItemToLessonWithAxis(item, lesson);
                if (m) hits.push(m);
            });
            hits.sort((a, b) => b.score - a.score);
            return hits;
        }
        window.findCurriculumLessonsForLibraryItem = findCurriculumLessonsForLibraryItem;

        function buildSingleLinkedResourceSideCardHtml(matchObj, kind, lessonId) {
            const item = matchObj.item;
            const safeUrl = typeof safeWebUrl === 'function' ? safeWebUrl(item.url) : (item.url || '#');
            const isVideo = kind === 'video';
            const isPdf = !isVideo && isLibraryItemPdfOrDoc(item);
            const isDrive = !!item.isDriveFile;
            const isLocal = !!item.isLocalFile;
            const meta = typeof getResourceFileMeta === 'function' ? getResourceFileMeta(item) : { ext: isVideo ? 'VIDEO' : 'PDF', sizeLabel: '' };

            let playClick = '';
            if (isDrive) {
                playClick = `openInAppFileViewer({ type: 'drive', driveFileId: '${item.driveFileId}', title: '${encodeURIComponent(item.title || '')}', url: '${safeUrl}', downloadUrl: '${item.downloadUrl || ''}', fileType: '${isVideo ? 'video' : 'doc'}' })`;
            } else if (isLocal) {
                playClick = `openInAppFileViewer({ type: 'local', id: '${item.id}' })`;
            } else if (item.isLessonTemplate && !item.url) {
                playClick = `openLessonTemplateViewerModal('${item.id}')`;
            } else {
                playClick = `openInAppFileViewer({ type: 'url', url: '${safeUrl}', title: '${encodeURIComponent(item.title || '')}', category: '${isVideo ? 'video' : (isPdf ? 'doc' : 'link')}' })`;
            }

            const borderColor = isVideo ? '#bfdbfe' : '#fecaca';
            const badgeBg = isVideo ? '#eff6ff' : '#fef2f2';
            const badgeColor = isVideo ? '#1d4ed8' : '#b91c1c';
            const btnBg = isVideo ? '#2563eb' : '#dc2626';

            return `
                <div style="background: #ffffff; border: 1.5px solid ${borderColor}; border-radius: 9px; padding: 9px 10px; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 6px;">
                        <div style="min-width: 0; flex: 1;">
                            <div style="font-size: 0.81rem; font-weight: 800; color: #0f172a; line-height: 1.35; word-break: break-word;">${_libEscHtml(item.title)}</div>
                            <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; align-items: center;">
                                <span style="font-size: 0.66rem; font-weight: 800; background: ${badgeBg}; color: ${badgeColor}; padding: 1px 6px; border-radius: 5px;">${meta.ext}</span>
                                ${matchObj.matchedAxis ? `<span style="font-size: 0.67rem; font-weight: 700; background: #f0fdfa; color: #0f766e; border: 1px solid #99f6e4; padding: 1px 6px; border-radius: 5px; max-width: 210px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${_libEscHtml(matchObj.matchedAxis)}">📌 ${_libEscHtml(matchObj.matchedAxis)}</span>` : ''}
                                ${matchObj.isManual ? `<span style="font-size: 0.65rem; font-weight: 800; background: #f5f3ff; color: #6d28d9; padding: 1px 5px; border-radius: 5px;">ربط يدوي</span>` : ''}
                            </div>
                        </div>
                        ${matchObj.isManual ? `
                            <button type="button" onclick="unlinkResourceFromLesson('${item.id}', '${lessonId}')" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 0.78rem; padding: 2px 4px;" title="فك الارتباط اليدوي عن هذا الدرس">✕</button>
                        ` : ''}
                    </div>
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <button type="button" onclick="${playClick}" style="flex: 1; background: ${btnBg}; color: #ffffff; border: none; border-radius: 6px; padding: 5px 8px; font-size: 0.74rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px;">
                            <span>${isVideo ? '▶ تشغيل الفيديو' : '📄 معاينة PDF'}</span>
                        </button>
                        ${!isLocal && safeUrl && safeUrl !== '#' ? `
                            <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="background: #f8fafc; color: #334155; border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 8px; font-size: 0.72rem; font-weight: 700; text-decoration: none;" title="فتح خارجياً">↗</a>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        function buildLessonSidePanelInnerHtml(lesson, axisFilter, contextMode) {
            if (!lesson) {
                return `
                    <div style="text-align: center; padding: 24px 12px; color: #64748b; background: #f8fafc; border-radius: 10px; border: 1px dashed #cbd5e1;">
                        <div style="font-size: 1.5rem; margin-bottom: 6px;">📚🎬</div>
                        <div style="font-weight: 800; font-size: 0.85rem; color: #334155;">اختر درساً لعرض موارده المرتبطة</div>
                        <div style="font-size: 0.74rem; margin-top: 4px;">ستظهر هنا ملفات PDF والفيديوهات التوضيحية المرتبطة بالمحور الدراسي.</div>
                    </div>
                `;
            }

            const activeAxis = axisFilter || 'all';
            const res = getResourcesLinkedToLesson(lesson, activeAxis);
            const axes = lesson.axes || [];
            const selectAxisFn = contextMode === 'browse' ? 'selectBrowseSideAxisFilter' : 'selectLessonSideAxisFilter';
            const encodedActiveAxis = encodeURIComponent(activeAxis === 'all' ? '' : activeAxis);

            return `
                <div style="background: linear-gradient(135deg, #f0fdfa, #ecfdf5); border: 1.5px solid #5eead4; border-radius: 10px; padding: 11px 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 4px;">
                        <span style="font-size: 0.7rem; font-weight: 800; background: #0d9488; color: #ffffff; padding: 2px 8px; border-radius: 9999px;">${_libEscHtml(lesson.levelName)}</span>
                        <span style="font-size: 0.7rem; font-weight: 800; color: #0f766e;">${_libEscHtml(lesson.semesterName)} • ${lesson.hours || 0} س</span>
                    </div>
                    <h4 style="margin: 2px 0 3px 0; font-size: 0.94rem; font-weight: 900; color: #0f172a; line-height: 1.35;">${_libEscHtml(lesson.title)}</h4>
                    ${lesson.frenchTitle ? `<div style="font-size: 0.72rem; color: #475569; direction: ltr; text-align: right;">${_libEscHtml(lesson.frenchTitle)}</div>` : ''}
                    ${lesson.competency ? `<p style="margin: 6px 0 0 0; font-size: 0.73rem; color: #134e4a; line-height: 1.45;">🎯 ${_libEscHtml(lesson.competency)}</p>` : ''}
                </div>

                ${axes.length > 0 ? `
                    <div>
                        <div style="font-size: 0.74rem; font-weight: 800; color: #334155; margin-bottom: 5px; display: flex; align-items: center; justify-content: space-between;">
                            <span>📌 المحور الدراسي المرتبط:</span>
                            <span style="font-size: 0.69rem; color: #64748b;">(${res.totalBeforeAxisFilter} مورد إجمالاً)</span>
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                            <button type="button" onclick="${selectAxisFn}('all')" style="padding: 4px 9px; border-radius: 9999px; font-size: 0.71rem; font-weight: 800; cursor: pointer; border: 1px solid ${activeAxis === 'all' ? '#0d9488' : '#cbd5e1'}; background: ${activeAxis === 'all' ? '#0d9488' : '#ffffff'}; color: ${activeAxis === 'all' ? '#ffffff' : '#334155'};">
                                الكل (${res.totalBeforeAxisFilter})
                            </button>
                            ${axes.map(ax => {
                                const isSel = activeAxis === ax.title;
                                const cnt = res.axisCounts[ax.title] || 0;
                                const encAx = encodeURIComponent(ax.title);
                                return `
                                    <button type="button" onclick="${selectAxisFn}('${encAx}')" style="padding: 4px 9px; border-radius: 9999px; font-size: 0.71rem; font-weight: 800; cursor: pointer; border: 1px solid ${isSel ? '#0d9488' : '#99f6e4'}; background: ${isSel ? '#0d9488' : '#f0fdfa'}; color: ${isSel ? '#ffffff' : '#0f766e'}; text-align: right;" title="${_libEscHtml(ax.desc || ax.title)}">
                                        ${_libEscHtml(ax.title)} (${cnt})
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- PDF Files Section -->
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 0.8rem; font-weight: 900; color: #991b1b;">📄 ملفات PDF والوثائق (${res.pdfs.length})</span>
                        <button type="button" onclick="openAddNewResourceForLesson('${lesson.id}', '${encodedActiveAxis}', 'doc')" style="background: #ffffff; color: #b91c1c; border: 1px solid #fca5a5; border-radius: 6px; padding: 2px 7px; font-size: 0.69rem; font-weight: 800; cursor: pointer;">+ رفع PDF</button>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 7px; max-height: 220px; overflow-y: auto;">
                        ${res.pdfs.length > 0
                            ? res.pdfs.map(m => buildSingleLinkedResourceSideCardHtml(m, 'pdf', lesson.id)).join('')
                            : `<div style="font-size: 0.74rem; color: #7f1d1d; background: rgba(255,255,255,0.75); border-radius: 7px; padding: 8px; text-align: center;">لا توجد ملفات PDF مرتبطة بهذا المحور حالياً.</div>`
                        }
                    </div>
                </div>

                <!-- Explanatory Videos Section -->
                <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 0.8rem; font-weight: 900; color: #1e3a8a;">🎬 الفيديوهات التوضيحية (${res.videos.length})</span>
                        <button type="button" onclick="openAddNewResourceForLesson('${lesson.id}', '${encodedActiveAxis}', 'video')" style="background: #ffffff; color: #1d4ed8; border: 1px solid #93c5fd; border-radius: 6px; padding: 2px 7px; font-size: 0.69rem; font-weight: 800; cursor: pointer;">+ إضافة فيديو</button>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 7px; max-height: 220px; overflow-y: auto;">
                        ${res.videos.length > 0
                            ? res.videos.map(m => buildSingleLinkedResourceSideCardHtml(m, 'video', lesson.id)).join('')
                            : `<div style="font-size: 0.74rem; color: #1e40af; background: rgba(255,255,255,0.75); border-radius: 7px; padding: 8px; text-align: center;">لا توجد فيديوهات توضيحية مرتبطة بهذا المحور حالياً.</div>`
                        }
                    </div>
                </div>

                ${res.others.length > 0 ? `
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px;">
                        <div style="font-size: 0.78rem; font-weight: 900; color: #334155; margin-bottom: 7px;">🔗 موارد وروابط وقوالب إضافية (${res.others.length})</div>
                        <div style="display: flex; flex-direction: column; gap: 6px; max-height: 160px; overflow-y: auto;">
                            ${res.others.map(m => buildSingleLinkedResourceSideCardHtml(m, 'other', lesson.id)).join('')}
                        </div>
                    </div>
                ` : ''}

                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    <button type="button" onclick="openLinkResourceToLessonModal('${lesson.id}', '${encodedActiveAxis}', '')" style="flex: 1; background: linear-gradient(135deg, #0d9488, #0f766e); color: #ffffff; border: none; border-radius: 8px; padding: 8px 10px; font-size: 0.76rem; font-weight: 800; cursor: pointer;">
                        🔗 ربط ملفات أو فيديوهات من المكتبة
                    </button>
                </div>
            `;
        }

        // Dedicated Tab: الموارد المرتبطة بالدروس (#libLessonResourcesTabPane)
        function selectLessonForResourcesPanel(lessonId, axisTitleEncoded) {
            window.currentSelectedLessonForResources = lessonId || '';
            window.currentSelectedAxisFilter = _libDecodeAxis(axisTitleEncoded || 'all');
            renderLessonLinkedResourcesView();
        }
        window.selectLessonForResourcesPanel = selectLessonForResourcesPanel;

        function selectLessonSideAxisFilter(axisTitleEncoded) {
            window.currentSelectedAxisFilter = _libDecodeAxis(axisTitleEncoded || 'all');
            renderLessonResourcesSidePanel();
        }
        window.selectLessonSideAxisFilter = selectLessonSideAxisFilter;

        function renderLessonResourcesSidePanel() {
            const panel = document.getElementById('libLessonResourcesSidePanel');
            if (!panel) return;
            const allLessons = getAllCurriculumLessonsList('all', 'all', '');
            const selectedLesson = allLessons.find(l => l.id === window.currentSelectedLessonForResources) || allLessons[0] || null;
            if (selectedLesson && !window.currentSelectedLessonForResources) {
                window.currentSelectedLessonForResources = selectedLesson.id;
            }
            panel.innerHTML = buildLessonSidePanelInnerHtml(selectedLesson, window.currentSelectedAxisFilter || 'all', 'tab');
        }
        window.renderLessonResourcesSidePanel = renderLessonResourcesSidePanel;

        function renderLessonLinkedResourcesView() {
            const gridEl = document.getElementById('libLessonResourcesGrid');
            const summaryEl = document.getElementById('libLessonResourcesSummaryBar');
            if (!gridEl) return;

            const lvlSel = document.getElementById('libLrLevelSelect');
            const semSel = document.getElementById('libLrSemesterSelect');
            const searchIn = document.getElementById('libLrSearchInput');

            const levelVal = lvlSel ? lvlSel.value : 'all';
            const semVal = semSel ? semSel.value : 'all';
            const searchVal = searchIn ? searchIn.value : '';

            const lessons = getAllCurriculumLessonsList(levelVal, semVal, searchVal);

            let selectedLesson = lessons.find(l => l.id === window.currentSelectedLessonForResources);
            if (!selectedLesson && lessons.length > 0) {
                selectedLesson = lessons[0];
                window.currentSelectedLessonForResources = selectedLesson.id;
                window.currentSelectedAxisFilter = 'all';
            }

            let totalPdfs = 0;
            let totalVideos = 0;
            let coveredLessons = 0;

            const cardsData = lessons.map(lesson => {
                const res = getResourcesLinkedToLesson(lesson, 'all');
                if (res.pdfs.length > 0 || res.videos.length > 0 || res.others.length > 0) coveredLessons++;
                totalPdfs += res.pdfs.length;
                totalVideos += res.videos.length;
                return { lesson, res };
            });

            if (summaryEl) {
                summaryEl.innerHTML = `
                    <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center; justify-content: space-between; background: #ffffff; border: 1px solid #ccfbf1; border-radius: 10px; padding: 10px 14px;">
                        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                            <span style="font-size: 0.78rem; font-weight: 900; color: #134e4a; background: #f0fdfa; padding: 3px 10px; border-radius: 9999px; border: 1px solid #99f6e4;">📚 ${lessons.length} درساً</span>
                            <span style="font-size: 0.78rem; font-weight: 800; color: #047857; background: #ecfdf5; padding: 3px 10px; border-radius: 9999px; border: 1px solid #a7f3d0;">✅ ${coveredLessons} درس مزود بموارد</span>
                            <span style="font-size: 0.78rem; font-weight: 800; color: #b91c1c; background: #fef2f2; padding: 3px 10px; border-radius: 9999px; border: 1px solid #fecaca;">📄 ${totalPdfs} ملف PDF</span>
                            <span style="font-size: 0.78rem; font-weight: 800; color: #1d4ed8; background: #eff6ff; padding: 3px 10px; border-radius: 9999px; border: 1px solid #bfdbfe;">🎬 ${totalVideos} فيديو توضيحي</span>
                        </div>
                        <span style="font-size: 0.74rem; color: #475569; font-weight: 700;">انقر على أي درس أو محور لعرض ملفات PDF والفيديوهات في اللوحة الجانبية ⬅️</span>
                    </div>
                `;
            }

            if (lessons.length === 0) {
                gridEl.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 32px 16px; background: #ffffff; border-radius: 12px; border: 1.5px dashed #cbd5e1; color: #64748b;">
                        <div style="font-weight: 800; color: #334155; font-size: 0.94rem;">لم يتم العثور على دروس مطابقة للبحث الحالي.</div>
                    </div>
                `;
                renderLessonResourcesSidePanel();
                return;
            }

            gridEl.innerHTML = cardsData.map(({ lesson, res }) => {
                const isSelected = window.currentSelectedLessonForResources === lesson.id;
                const totalCount = res.pdfs.length + res.videos.length + res.others.length;

                return `
                    <div onclick="selectLessonForResourcesPanel('${lesson.id}', 'all')" style="cursor: pointer; background: ${isSelected ? '#f0fdfa' : '#ffffff'}; border: ${isSelected ? '2px solid #0d9488' : '1.5px solid #e2e8f0'}; border-radius: 12px; padding: 13px 14px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; transition: all 0.18s; box-shadow: ${isSelected ? '0 4px 14px rgba(13,148,136,0.14)' : '0 1px 3px rgba(0,0,0,0.03)'};">
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 6px;">
                                <span style="font-size: 0.69rem; font-weight: 800; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 2px 8px; border-radius: 9999px;">${_libEscHtml(lesson.levelName)}</span>
                                <span style="font-size: 0.7rem; font-weight: 700; color: #64748b;">${_libEscHtml(lesson.semesterName)} • ${lesson.hours || 0} س</span>
                            </div>
                            <h4 style="margin: 0 0 3px 0; font-size: 0.93rem; font-weight: 900; color: #0f172a; line-height: 1.35;">${_libEscHtml(lesson.title)}</h4>
                            ${lesson.frenchTitle ? `<div style="font-size: 0.71rem; color: #64748b; direction: ltr; text-align: right; margin-bottom: 6px;">${_libEscHtml(lesson.frenchTitle)}</div>` : ''}

                            ${(lesson.axes && lesson.axes.length > 0) ? `
                                <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;">
                                    ${lesson.axes.slice(0, 4).map(ax => {
                                        const axCount = res.axisCounts[ax.title] || 0;
                                        const encAx = encodeURIComponent(ax.title);
                                        return `
                                            <button type="button" onclick="event.stopPropagation(); selectLessonForResourcesPanel('${lesson.id}', '${encAx}')" style="font-size: 0.68rem; font-weight: 700; padding: 2px 7px; border-radius: 6px; border: 1px solid ${axCount > 0 ? '#5eead4' : '#e2e8f0'}; background: ${axCount > 0 ? '#ccfbf1' : '#f8fafc'}; color: ${axCount > 0 ? '#115e59' : '#475569'}; cursor: pointer; text-align: right;" title="عرض موارد هذا المحور في اللوحة الجانبية">
                                                📌 ${_libEscHtml(ax.title)}${axCount > 0 ? ` (${axCount})` : ''}
                                            </button>
                                        `;
                                    }).join('')}
                                </div>
                            ` : ''}
                        </div>

                        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #e2e8f0; padding-top: 8px; gap: 6px; flex-wrap: wrap;">
                            <div style="display: flex; gap: 5px; align-items: center;">
                                <span style="font-size: 0.71rem; font-weight: 800; background: ${res.pdfs.length > 0 ? '#fef2f2' : '#f8fafc'}; color: ${res.pdfs.length > 0 ? '#b91c1c' : '#94a3b8'}; border: 1px solid ${res.pdfs.length > 0 ? '#fecaca' : '#e2e8f0'}; padding: 2px 7px; border-radius: 6px;">📄 ${res.pdfs.length} PDF</span>
                                <span style="font-size: 0.71rem; font-weight: 800; background: ${res.videos.length > 0 ? '#eff6ff' : '#f8fafc'}; color: ${res.videos.length > 0 ? '#1d4ed8' : '#94a3b8'}; border: 1px solid ${res.videos.length > 0 ? '#bfdbfe' : '#e2e8f0'}; padding: 2px 7px; border-radius: 6px;">🎬 ${res.videos.length} فيديو</span>
                            </div>
                            <div style="display: flex; gap: 4px;">
                                <button type="button" onclick="event.stopPropagation(); openLinkResourceToLessonModal('${lesson.id}', '', '')" style="background: #f8fafc; color: #0f766e; border: 1px solid #99f6e4; border-radius: 6px; padding: 3px 8px; font-size: 0.7rem; font-weight: 800; cursor: pointer;" title="ربط ملف PDF أو فيديو من المكتبة">
                                    🔗 ربط
                                </button>
                                <span style="font-size: 0.71rem; font-weight: 800; color: ${isSelected ? '#ffffff' : '#0d9488'}; background: ${isSelected ? '#0d9488' : '#f0fdfa'}; border: 1px solid #5eead4; padding: 3px 8px; border-radius: 6px;">
                                    ${totalCount > 0 ? 'عرض الجانبي ⬅️' : 'فتح اللوحة'}
                                </span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            renderLessonResourcesSidePanel();
            if (window.lucide) window.lucide.createIcons();
        }
        window.renderLessonLinkedResourcesView = renderLessonLinkedResourcesView;

        // =========================================================================
        // Browse Tab Sticky Side Panel (لوحة موارد الدروس الجانبية داخل تبويب المكتبة)
        // =========================================================================
        function switchBrowseSidebarMode(mode) {
            window.currentBrowseSidebarMode = (mode === 'analytics') ? 'analytics' : 'lessons';
            const lessonsBox = document.getElementById('libBrowseSideLessonResourcesBox');
            const analyticsBox = document.getElementById('libBrowseSideAnalyticsBox');
            const btnLessons = document.getElementById('btnSideModeLessonResources');
            const btnAnalytics = document.getElementById('btnSideModeAnalytics');

            const isLessons = window.currentBrowseSidebarMode === 'lessons';
            if (lessonsBox) lessonsBox.style.display = isLessons ? 'flex' : 'none';
            if (analyticsBox) analyticsBox.style.display = isLessons ? 'none' : 'flex';

            if (btnLessons) {
                btnLessons.style.background = isLessons ? '#0d9488' : 'transparent';
                btnLessons.style.color = isLessons ? '#ffffff' : '#475569';
                btnLessons.style.fontWeight = isLessons ? '800' : '700';
            }
            if (btnAnalytics) {
                btnAnalytics.style.background = !isLessons ? '#2563eb' : 'transparent';
                btnAnalytics.style.color = !isLessons ? '#ffffff' : '#475569';
                btnAnalytics.style.fontWeight = !isLessons ? '800' : '700';
            }

            if (isLessons) {
                renderBrowseLessonSidePanel();
            } else if (typeof renderLibraryGrowthAnalytics === 'function') {
                renderLibraryGrowthAnalytics();
            }
        }
        window.switchBrowseSidebarMode = switchBrowseSidebarMode;

        function openBrowseLessonSidePanel(lessonId, axisTitleEncoded) {
            if (typeof currentLibSubTab !== 'undefined' && currentLibSubTab !== 'browse') {
                switchLibrarySubTab('browse');
            }
            if (lessonId) {
                const allLessons = getAllCurriculumLessonsList('all', 'all', '');
                const found = allLessons.find(l => l.id === lessonId);
                if (found) {
                    window.currentBrowseSideLevelId = found.levelId;
                    window.currentBrowseSideLessonId = found.id;
                }
            }
            window.currentBrowseSideAxisFilter = _libDecodeAxis(axisTitleEncoded || 'all');
            toggleLibrarySidebar(true);
            switchBrowseSidebarMode('lessons');
            const sidebarEl = document.getElementById('libSidebarAnalytics');
            if (sidebarEl && window.innerWidth <= 992) {
                sidebarEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
        window.openBrowseLessonSidePanel = openBrowseLessonSidePanel;

        function onBrowseSideLevelChanged(lvlId) {
            window.currentBrowseSideLevelId = lvlId || 'TCS';
            window.currentBrowseSideLessonId = '';
            window.currentBrowseSideAxisFilter = 'all';
            renderBrowseLessonSidePanel();
        }
        window.onBrowseSideLevelChanged = onBrowseSideLevelChanged;

        function onBrowseSideLessonChanged(lessonId) {
            window.currentBrowseSideLessonId = lessonId || '';
            window.currentBrowseSideAxisFilter = 'all';
            renderBrowseLessonSidePanel();
        }
        window.onBrowseSideLessonChanged = onBrowseSideLessonChanged;

        function selectBrowseSideAxisFilter(axisTitleEncoded) {
            window.currentBrowseSideAxisFilter = _libDecodeAxis(axisTitleEncoded || 'all');
            renderBrowseLessonSidePanel();
        }
        window.selectBrowseSideAxisFilter = selectBrowseSideAxisFilter;

        function renderBrowseLessonSidePanel() {
            const box = document.getElementById('libBrowseSideLessonResourcesBox');
            if (!box) return;

            const cur = window.MOROCCAN_SECONDARY_MATH_CURRICULUM || {};
            const levelKeys = Object.keys(cur);
            if (!levelKeys.length) {
                box.innerHTML = `<div style="font-size: 0.78rem; color: #64748b; padding: 12px; text-align: center;">جاري تحميل بيانات المقرر...</div>`;
                return;
            }

            if (!cur[window.currentBrowseSideLevelId]) {
                window.currentBrowseSideLevelId = levelKeys[0];
            }

            const levelLessons = getAllCurriculumLessonsList(window.currentBrowseSideLevelId, 'all', '');
            let selectedLesson = levelLessons.find(l => l.id === window.currentBrowseSideLessonId) || levelLessons[0] || null;
            if (selectedLesson) {
                window.currentBrowseSideLessonId = selectedLesson.id;
            }

            box.innerHTML = `
                <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 9px; padding: 9px; display: flex; flex-direction: column; gap: 7px;">
                    <div>
                        <label style="display: block; font-size: 0.71rem; font-weight: 800; color: #0f766e; margin-bottom: 3px;">🎓 المستوى الدراسي:</label>
                        <select onchange="onBrowseSideLevelChanged(this.value)" style="width: 100%; padding: 6px 8px; border-radius: 7px; border: 1px solid #5eead4; background: #ffffff; font-size: 0.78rem; font-weight: 800; color: #115e59; margin-bottom: 0;">
                            ${levelKeys.map(k => `<option value="${k}" ${k === window.currentBrowseSideLevelId ? 'selected' : ''}>${_libEscHtml(cur[k].shortName || cur[k].name || k)}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.71rem; font-weight: 800; color: #334155; margin-bottom: 3px;">📖 الدرس والمحور الدراسي:</label>
                        <select onchange="onBrowseSideLessonChanged(this.value)" style="width: 100%; padding: 6px 8px; border-radius: 7px; border: 1px solid #cbd5e1; background: #ffffff; font-size: 0.78rem; font-weight: 700; color: #0f172a; margin-bottom: 0;">
                            ${levelLessons.map(l => {
                                const c = getResourcesLinkedToLesson(l, 'all');
                                const total = c.pdfs.length + c.videos.length + c.others.length;
                                return `<option value="${l.id}" ${selectedLesson && l.id === selectedLesson.id ? 'selected' : ''}>${_libEscHtml(l.title)} ${total > 0 ? `(${total})` : ''}</option>`;
                            }).join('')}
                        </select>
                    </div>
                </div>

                ${buildLessonSidePanelInnerHtml(selectedLesson, window.currentBrowseSideAxisFilter || 'all', 'browse')}

                <button type="button" onclick="selectLessonForResourcesPanel('${selectedLesson ? selectedLesson.id : ''}', 'all'); switchLibrarySubTab('lesson_resources');" style="background: #f0fdfa; color: #0f766e; border: 1.5px solid #5eead4; border-radius: 8px; padding: 7px 10px; font-size: 0.76rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px;">
                    <span>📚 فتح عرض «الموارد المرتبطة بالدروس» الكامل</span>
                </button>
            `;
        }
        window.renderBrowseLessonSidePanel = renderBrowseLessonSidePanel;

        // =========================================================================
        // Quick Add & Manual Link / Unlink Between Library Resources & Lessons
        // =========================================================================
        function openAddNewResourceForLesson(lessonId, axisTitleEncoded, kind) {
            const axisTitle = _libDecodeAxis(axisTitleEncoded || '');
            const allLessons = getAllCurriculumLessonsList('all', 'all', '');
            const lesson = allLessons.find(l => l.id === lessonId);
            if (!lesson) return;

            if (typeof currentLibSubTab !== 'undefined' && currentLibSubTab !== 'browse') {
                switchLibrarySubTab('browse');
            }

            const levelMap = {
                'TCS': 'TC-SC',
                'TCL': 'TC-LSH',
                '1BAC_SM': '1BAC-SM',
                '1BAC_EXP': '1BAC-EXP',
                '1BAC_ECO': '1BAC-ECO',
                '1BAC_LSH': '1BAC-LSH',
                '2BAC_SM': '2BAC-SM',
                '2BAC_EXP': '2BAC-PC',
                '2BAC_ECO': '2BAC-ECO',
                '2BAC_LSH': '2BAC-LSH'
            };
            const mappedLevel = levelMap[lesson.levelId] || 'عام';
            const prefillTopic = axisTitle || lesson.title;

            if (kind === 'video') {
                if (typeof switchLibMode === 'function') switchLibMode('link');
                const urlLvl = document.getElementById('libUrlLevel');
                const urlTopic = document.getElementById('libUrlTopic');
                const urlType = document.getElementById('libUrlType');
                const urlCat = document.getElementById('libUrlCategory');
                const urlTitle = document.getElementById('libUrlTitle');
                if (urlLvl) urlLvl.value = mappedLevel;
                if (urlTopic) urlTopic.value = prefillTopic;
                if (urlType) urlType.value = 'video';
                if (urlCat) urlCat.value = 'عرض ووسائط';
                if (urlTitle && !urlTitle.value) urlTitle.value = `فيديو توضيحي: ${prefillTopic}`;
            } else {
                if (typeof switchLibMode === 'function') switchLibMode('local');
                const locLvl = document.getElementById('libLevel');
                const locTopic = document.getElementById('libTopic');
                const locType = document.getElementById('libType');
                const locCat = document.getElementById('libLocalCategory');
                if (locLvl) locLvl.value = mappedLevel;
                if (locTopic) locTopic.value = prefillTopic;
                if (locType) locType.value = 'doc';
                if (locCat) locCat.value = 'درس';
            }

            const addBox = document.getElementById('libDriveSection')?.closest('.card');
            if (addBox) {
                addBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
                addBox.style.outline = '3px solid #0d9488';
                setTimeout(() => { if (addBox) addBox.style.outline = ''; }, 1800);
            }
        }
        window.openAddNewResourceForLesson = openAddNewResourceForLesson;

        function unlinkResourceFromLesson(itemId, lessonId) {
            const item = (window.db && Array.isArray(window.db.library)) ? window.db.library.find(i => i.id === itemId) : null;
            if (!item) return;
            if (Array.isArray(item.linkedLessonIds)) {
                item.linkedLessonIds = item.linkedLessonIds.filter(id => id !== lessonId);
            }
            if (item.linkedAxisByLesson && item.linkedAxisByLesson[lessonId]) {
                delete item.linkedAxisByLesson[lessonId];
            }
            if (typeof saveDB === 'function') saveDB();
            renderLibrary();
            if (typeof showLibraryToast === 'function') {
                showLibraryToast('تم فك الارتباط اليدوي للمورد عن الدرس.');
            }
        }
        window.unlinkResourceFromLesson = unlinkResourceFromLesson;

        function openLinkResourceToLessonModal(lessonId, axisTitleEncoded, preselectedItemId) {
            const axisTitle = _libDecodeAxis(axisTitleEncoded || '');
            let modal = document.getElementById('libLinkResourceToLessonModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'libLinkResourceToLessonModal';
                modal.className = 'modal-overlay';
                modal.style.cssText = 'display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65); z-index: 9999; align-items: center; justify-content: center; padding: 16px; overflow-y: auto;';
                document.body.appendChild(modal);
            }

            const allLessons = getAllCurriculumLessonsList('all', 'all', '');
            const items = (window.db && Array.isArray(window.db.library)) ? window.db.library : [];

            if (preselectedItemId) {
                const item = items.find(i => i.id === preselectedItemId);
                if (!item) return;
                const firstLesson = allLessons.find(l => Array.isArray(item.linkedLessonIds) && item.linkedLessonIds.includes(l.id))
                    || findCurriculumLessonsForLibraryItem(item)[0]?.lesson
                    || allLessons[0];

                modal.innerHTML = `
                    <div style="background: #ffffff; width: 100%; max-width: 520px; border-radius: 14px; padding: 22px; box-shadow: 0 20px 45px rgba(0,0,0,0.25); border: 1.5px solid #5eead4; direction: rtl; text-align: right; font-family: 'Cairo', sans-serif;">
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 10px; margin-bottom: 12px;">
                            <h3 style="margin: 0; font-size: 1rem; font-weight: 900; color: #0f766e;">🔗 ربط المورد بدرس ومحور دراسي</h3>
                            <button type="button" onclick="document.getElementById('libLinkResourceToLessonModal').style.display='none'" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #64748b;">✕</button>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 9px 12px; margin-bottom: 12px; font-size: 0.84rem; font-weight: 800; color: #0f172a;">
                            المورد: ${_libEscHtml(item.title)}
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <div>
                                <label style="font-size: 0.8rem; font-weight: 800; color: #334155;">📖 اختر الدرس من المنهاج:</label>
                                <select id="linkModalLessonSelect" onchange="updateLinkModalAxisOptions(this.value)" style="width: 100%; padding: 9px; border-radius: 8px; border: 1.5px solid #2dd4bf; background: #f0fdfa; font-weight: 700; margin-top: 4px;">
                                    ${allLessons.map(l => `<option value="${l.id}" ${firstLesson && l.id === firstLesson.id ? 'selected' : ''}>[${_libEscHtml(l.levelName)}] ${_libEscHtml(l.title)}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label style="font-size: 0.8rem; font-weight: 800; color: #334155;">📌 المحور الدراسي المرتبط:</label>
                                <select id="linkModalAxisSelect" style="width: 100%; padding: 9px; border-radius: 8px; border: 1px solid #cbd5e1; margin-top: 4px; font-weight: 700;">
                                </select>
                            </div>
                            <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
                                <button type="button" onclick="document.getElementById('libLinkResourceToLessonModal').style.display='none'" style="padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; color: #334155; font-weight: 700; cursor: pointer;">إلغاء</button>
                                <button type="button" onclick="confirmSingleItemLinkToLesson('${item.id}')" style="padding: 8px 18px; border-radius: 8px; border: none; background: #0d9488; color: #ffffff; font-weight: 800; cursor: pointer;">✓ حفظ الربط بالدرس</button>
                            </div>
                        </div>
                    </div>
                `;
                modal.style.display = 'flex';
                if (firstLesson) updateLinkModalAxisOptions(firstLesson.id, (item.linkedAxisByLesson && item.linkedAxisByLesson[firstLesson.id]) || '');
                return;
            }

            const targetLesson = allLessons.find(l => l.id === lessonId) || allLessons[0];
            if (!targetLesson) return;

            const targetAxes = targetLesson.axes || [];
            const selectedAxis = (axisTitle && axisTitle !== 'all') ? axisTitle : (targetAxes[0] ? targetAxes[0].title : '');
            const pdfAndVideoItems = items.filter(it => isLibraryItemVideo(it) || isLibraryItemPdfOrDoc(it) || !!it.url);

            modal.innerHTML = `
                <div style="background: #ffffff; width: 100%; max-width: 620px; border-radius: 14px; padding: 22px; box-shadow: 0 20px 45px rgba(0,0,0,0.25); border: 1.5px solid #5eead4; direction: rtl; text-align: right; font-family: 'Cairo', sans-serif; max-height: 90vh; display: flex; flex-direction: column; gap: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 10px;">
                        <div>
                            <h3 style="margin: 0; font-size: 1rem; font-weight: 900; color: #0f766e;">🔗 ربط ملفات PDF وفيديوهات من المكتبة بالدرس</h3>
                            <div style="font-size: 0.78rem; color: #475569; margin-top: 2px;">${_libEscHtml(targetLesson.title)} (${_libEscHtml(targetLesson.levelName)})</div>
                        </div>
                        <button type="button" onclick="document.getElementById('libLinkResourceToLessonModal').style.display='none'" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #64748b;">✕</button>
                    </div>

                    ${targetAxes.length > 0 ? `
                        <div>
                            <label style="font-size: 0.78rem; font-weight: 800; color: #334155;">📌 المحور الدراسي المراد الربط به:</label>
                            <select id="batchLinkAxisSelect" style="width: 100%; padding: 8px 10px; border-radius: 8px; border: 1.5px solid #2dd4bf; background: #f0fdfa; font-weight: 700; margin-top: 4px;">
                                ${targetAxes.map(ax => `<option value="${_libEscHtml(ax.title)}" ${ax.title === selectedAxis ? 'selected' : ''}>${_libEscHtml(ax.title)}</option>`).join('')}
                            </select>
                        </div>
                    ` : ''}

                    <input type="text" id="batchLinkSearchInput" oninput="filterBatchLinkModalItems(this.value)" placeholder="ابحث داخل ملفات PDF وفيديوهات المكتبة..." style="width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid #cbd5e1; margin-bottom: 0;">

                    <div id="batchLinkItemsList" style="max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding: 4px;">
                        ${pdfAndVideoItems.length === 0 ? `
                            <div style="text-align: center; padding: 20px; color: #64748b; font-size: 0.82rem;">لا توجد ملفات PDF أو فيديوهات في المكتبة حالياً.</div>
                        ` : pdfAndVideoItems.map(it => {
                            const isVid = isLibraryItemVideo(it);
                            const checked = Array.isArray(it.linkedLessonIds) && it.linkedLessonIds.includes(targetLesson.id);
                            return `
                                <label class="batch-link-item-row" data-search="${_libEscHtml(normalizeMathAxisText((it.title || '') + ' ' + (it.topic || '') + ' ' + (it.fileName || '')))}" style="display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; border: 1px solid ${checked ? '#0d9488' : '#e2e8f0'}; background: ${checked ? '#f0fdfa' : '#ffffff'}; cursor: pointer;">
                                    <input type="checkbox" class="batch-link-checkbox" value="${it.id}" ${checked ? 'checked' : ''} style="width: 17px; height: 17px; accent-color: #0d9488;">
                                    <span style="font-size: 0.72rem; font-weight: 800; padding: 2px 7px; border-radius: 5px; background: ${isVid ? '#eff6ff' : '#fef2f2'}; color: ${isVid ? '#1d4ed8' : '#b91c1c'};">${isVid ? '🎬 فيديو' : '📄 PDF'}</span>
                                    <div style="min-width: 0; flex: 1;">
                                        <div style="font-size: 0.82rem; font-weight: 800; color: #0f172a;">${_libEscHtml(it.title)}</div>
                                        ${it.topic ? `<div style="font-size: 0.7rem; color: #64748b;">المحور: ${_libEscHtml(it.topic)}</div>` : ''}
                                    </div>
                                </label>
                            `;
                        }).join('')}
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid #f1f5f9; padding-top: 10px;">
                        <button type="button" onclick="document.getElementById('libLinkResourceToLessonModal').style.display='none'" style="padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; color: #334155; font-weight: 700; cursor: pointer;">إلغاء</button>
                        <button type="button" onclick="saveBatchLessonResourceLinks('${targetLesson.id}')" style="padding: 8px 20px; border-radius: 8px; border: none; background: #0d9488; color: #ffffff; font-weight: 800; cursor: pointer;">✓ حفظ الموارد المرتبطة</button>
                    </div>
                </div>
            `;
            modal.style.display = 'flex';
        }
        window.openLinkResourceToLessonModal = openLinkResourceToLessonModal;

        function updateLinkModalAxisOptions(lessonId, preferredAxis) {
            const sel = document.getElementById('linkModalAxisSelect');
            if (!sel) return;
            const allLessons = getAllCurriculumLessonsList('all', 'all', '');
            const lesson = allLessons.find(l => l.id === lessonId);
            const axes = lesson && Array.isArray(lesson.axes) ? lesson.axes : [];
            if (axes.length === 0) {
                sel.innerHTML = `<option value="${_libEscHtml(lesson ? lesson.title : '')}">${_libEscHtml(lesson ? lesson.title : 'المحور العام')}</option>`;
            } else {
                sel.innerHTML = axes.map(ax => `<option value="${_libEscHtml(ax.title)}" ${preferredAxis === ax.title ? 'selected' : ''}>${_libEscHtml(ax.title)}</option>`).join('');
            }
        }
        window.updateLinkModalAxisOptions = updateLinkModalAxisOptions;

        function confirmSingleItemLinkToLesson(itemId) {
            const item = (window.db && Array.isArray(window.db.library)) ? window.db.library.find(i => i.id === itemId) : null;
            const lSel = document.getElementById('linkModalLessonSelect');
            const aSel = document.getElementById('linkModalAxisSelect');
            if (!item || !lSel) return;

            const lessonId = lSel.value;
            const axisTitle = aSel ? aSel.value : '';

            if (!Array.isArray(item.linkedLessonIds)) item.linkedLessonIds = [];
            if (!item.linkedLessonIds.includes(lessonId)) item.linkedLessonIds.push(lessonId);
            if (!item.linkedAxisByLesson) item.linkedAxisByLesson = {};
            if (axisTitle) item.linkedAxisByLesson[lessonId] = axisTitle;
            if (!item.topic && axisTitle) item.topic = axisTitle;

            if (typeof saveDB === 'function') saveDB();
            const modal = document.getElementById('libLinkResourceToLessonModal');
            if (modal) modal.style.display = 'none';

            window.currentBrowseSideLessonId = lessonId;
            window.currentSelectedLessonForResources = lessonId;
            renderLibrary();
            if (typeof showLibraryToast === 'function') {
                showLibraryToast('✓ تم ربط المورد بالدرس والمحور الدراسي بنجاح!');
            }
        }
        window.confirmSingleItemLinkToLesson = confirmSingleItemLinkToLesson;

        function filterBatchLinkModalItems(q) {
            const norm = normalizeMathAxisText(q || '');
            document.querySelectorAll('#batchLinkItemsList .batch-link-item-row').forEach(row => {
                const hay = row.getAttribute('data-search') || '';
                row.style.display = (!norm || hay.includes(norm)) ? 'flex' : 'none';
            });
        }
        window.filterBatchLinkModalItems = filterBatchLinkModalItems;

        function saveBatchLessonResourceLinks(lessonId) {
            const items = (window.db && Array.isArray(window.db.library)) ? window.db.library : [];
            const axisSel = document.getElementById('batchLinkAxisSelect');
            const chosenAxis = axisSel ? axisSel.value : '';
            const checkboxes = Array.from(document.querySelectorAll('#batchLinkItemsList .batch-link-checkbox'));
            const checkedIds = new Set(checkboxes.filter(c => c.checked).map(c => c.value));

            items.forEach(item => {
                if (checkedIds.has(item.id)) {
                    if (!Array.isArray(item.linkedLessonIds)) item.linkedLessonIds = [];
                    if (!item.linkedLessonIds.includes(lessonId)) item.linkedLessonIds.push(lessonId);
                    if (!item.linkedAxisByLesson) item.linkedAxisByLesson = {};
                    if (chosenAxis) item.linkedAxisByLesson[lessonId] = chosenAxis;
                } else if (Array.isArray(item.linkedLessonIds) && item.linkedLessonIds.includes(lessonId)) {
                    item.linkedLessonIds = item.linkedLessonIds.filter(id => id !== lessonId);
                    if (item.linkedAxisByLesson) delete item.linkedAxisByLesson[lessonId];
                }
            });

            if (typeof saveDB === 'function') saveDB();
            const modal = document.getElementById('libLinkResourceToLessonModal');
            if (modal) modal.style.display = 'none';

            renderLibrary();
            if (typeof showLibraryToast === 'function') {
                showLibraryToast('✓ تم تحديث الموارد المرتبطة بالدرس في المكتبة واللوحة الجانبية!');
            }
        }
        window.saveBatchLessonResourceLinks = saveBatchLessonResourceLinks;
