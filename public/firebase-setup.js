import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js';
import { initializeFirestore, doc, setDoc, getDoc, getDocFromServer, deleteDoc, setLogLevel } from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js';

const firebaseConfig = {
  projectId: "gen-lang-client-0761614487",
  appId: "1:198994308173:web:c17f402de765402a4e4004",
  apiKey: "AIzaSyAYYdWk9e2Ka4bxkmNOuMvsM0NeXgECBoA",
  authDomain: "gen-lang-client-0761614487.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-promptcraftai-ce4b7ff0-1206-4c55-a725-d63b8f12aa2e",
  storageBucket: "gen-lang-client-0761614487.firebasestorage.app",
  messagingSenderId: "198994308173",
  measurementId: "",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
setLogLevel('silent');
const dbFirestore = initializeFirestore(app, { experimentalAutoDetectLongPolling: true }, firebaseConfig.firestoreDatabaseId);

const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

function buildFirestoreErrorInfo(error, operationType, path) {
  return {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
}

function handleFirestoreError(error, operationType, path, shouldThrow = false) {
  const errInfo = buildFirestoreErrorInfo(error, operationType, path);
  console.warn('Firestore Operation Diagnostic:', JSON.stringify(errInfo));
  if (shouldThrow) {
    throw new Error(JSON.stringify(errInfo));
  }
  return errInfo;
}
window.handleFirestoreError = handleFirestoreError;

async function testConnection() {
  try {
    await getDocFromServer(doc(dbFirestore, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration.");
    }
  }
}
testConnection();

function safeStringify(obj, space) {
    const seen = new WeakSet();
    try {
        return JSON.stringify(obj, (key, value) => {
            if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) return undefined;
                seen.add(value);
            }
            return value;
        }, space);
    } catch(e) {
        return '{}';
    }
}

window.isCloudSyncActive = () => !!(auth && auth.currentUser);
window.getCloudUserEmail = () => (auth && auth.currentUser ? (auth.currentUser.email || auth.currentUser.displayName || 'Google') : null);

// الحد الأقصى الآمن لحجم الوثيقة في Firestore لتفادي تجاوز حد 1MB
const MAX_FIRESTORE_DOC_PAYLOAD_SIZE = 600000; // 600KB

/**
 * ضغط السلاسل النصية الكبيرة باستخدام Gzip (مدمج في المتصفحات الحديثة)
 */
async function compressString(str) {
    if (typeof CompressionStream === 'function' && typeof TextEncoder === 'function') {
        try {
            const stream = new Blob([new TextEncoder().encode(str)]).stream().pipeThrough(new CompressionStream('gzip'));
            const buffer = await new Response(stream).arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = '';
            const len = bytes.byteLength;
            for (let i = 0; i < len; i += 8192) {
                binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + 8192, len)));
            }
            return { compressed: true, data: btoa(binary) };
        } catch (e) {
            console.warn('CompressionStream error, falling back to raw:', e);
        }
    }
    return { compressed: false, data: str };
}

/**
 * فك ضغط السلاسل النصية المضغوطة
 */
async function decompressString(str, isCompressed) {
    if (!isCompressed || !str) return str;
    if (typeof DecompressionStream === 'function') {
        try {
            const binary = atob(str);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
            return await new Response(stream).text();
        } catch (e) {
            console.warn('DecompressionStream error:', e);
            throw e;
        }
    }
    return str;
}

/**
 * استرجاع بيانات المستخدم الكاملة من Firestore مع دعم الوثائق المجزأة والمضغوطة
 */
async function fetchFirestoreAppData(user) {
    if (!user || !user.uid) return null;
    const userPath = `users/${user.uid}`;
    let docSnap;
    try {
        docSnap = await getDoc(doc(dbFirestore, "users", user.uid));
    } catch (error) {
        handleFirestoreError(error, OperationType.GET, userPath, false);
        throw error;
    }
    if (!docSnap.exists()) return null;

    const cloudData = docSnap.data();
    if (!cloudData) return null;

    let payloadString = '';
    if (cloudData.isChunked && cloudData.chunksCount > 0) {
        for (let i = 0; i < cloudData.chunksCount; i++) {
            const chunkPath = `users/${user.uid}/chunks/chunk_${i}`;
            try {
                const cSnap = await getDoc(doc(dbFirestore, "users", user.uid, "chunks", `chunk_${i}`));
                if (cSnap.exists()) {
                    payloadString += (cSnap.data().chunk || '');
                }
            } catch (chunkErr) {
                handleFirestoreError(chunkErr, OperationType.GET, chunkPath, false);
                throw chunkErr;
            }
        }
    } else if (cloudData.appData) {
        payloadString = cloudData.appData;
    }

    if (!payloadString) return null;

    const rawString = await decompressString(payloadString, cloudData.isCompressed);
    return {
        rawString: rawString,
        lastUpdated: cloudData.lastUpdated,
        lastSavedTimestamp: cloudData.lastSavedTimestamp,
        chunksCount: cloudData.chunksCount || 0
    };
}
window.fetchFirestoreAppData = fetchFirestoreAppData;

async function executeFirestoreUserWrite(user, payloadString, compressed, rawLength, nowIso) {
    if (payloadString.length <= MAX_FIRESTORE_DOC_PAYLOAD_SIZE) {
        await setDoc(doc(dbFirestore, "users", user.uid), {
            appData: payloadString,
            isCompressed: Boolean(compressed),
            isChunked: false,
            chunksCount: 0,
            totalRawSize: Number(rawLength) || 0,
            compressedSize: Number(payloadString.length) || 0,
            lastUpdated: String(nowIso).slice(0, 64),
            lastSavedTimestamp: Date.now(),
            userEmail: String(user.email || '').slice(0, 256)
        });
    } else {
        const chunks = [];
        for (let i = 0; i < payloadString.length; i += MAX_FIRESTORE_DOC_PAYLOAD_SIZE) {
            chunks.push(payloadString.slice(i, i + MAX_FIRESTORE_DOC_PAYLOAD_SIZE));
        }

        for (let idx = 0; idx < chunks.length; idx++) {
            await setDoc(doc(dbFirestore, "users", user.uid, "chunks", `chunk_${idx}`), {
                chunk: chunks[idx],
                index: idx,
                totalChunks: chunks.length,
                lastUpdated: String(nowIso).slice(0, 64)
            });
        }

        await setDoc(doc(dbFirestore, "users", user.uid), {
            isChunked: true,
            isCompressed: Boolean(compressed),
            chunksCount: chunks.length,
            totalRawSize: Number(rawLength) || 0,
            compressedSize: Number(payloadString.length) || 0,
            lastUpdated: String(nowIso).slice(0, 64),
            lastSavedTimestamp: Date.now(),
            userEmail: String(user.email || '').slice(0, 256)
        });
    }
}

window.syncToFirebase = async (data, preSerialized) => {
    const user = auth.currentUser;
    if (user && user.uid) {
        const userDocPath = `users/${user.uid}`;
        try {
            const nowIso = new Date().toISOString();
            const rawString = (typeof preSerialized === 'string' && preSerialized.length > 2) ? preSerialized : safeStringify(data);

            // 1. ضغط البيانات لتقليص الحجم بنسبة 80-95%
            const { compressed, data: payloadString } = await compressString(rawString);

            // 2. كتابة البيانات مع إعادة المحاولة تلقائياً بعد تحديث رمز المصادقة إذا لزم الأمر
            try {
                await executeFirestoreUserWrite(user, payloadString, compressed, rawString.length, nowIso);
            } catch (firstErr) {
                const msg = firstErr?.message || String(firstErr);
                if (msg.includes('permission') || firstErr?.code === 'permission-denied') {
                    if (typeof user.getIdToken === 'function') {
                        await user.getIdToken(true);
                    }
                    await executeFirestoreUserWrite(user, payloadString, compressed, rawString.length, nowIso);
                } else {
                    throw firstErr;
                }
            }

            const result = { success: true, cloud: true, timestamp: new Date(), user: user.email || user.displayName };
            window.dispatchEvent(new CustomEvent('cloudSyncResult', { detail: result }));
            return result;
        } catch(e) {
            const errInfo = handleFirestoreError(e, OperationType.WRITE, userDocPath, false);
            const errResult = { success: false, cloud: true, error: errInfo.error, details: errInfo };
            window.dispatchEvent(new CustomEvent('cloudSyncResult', { detail: errResult }));
            return errResult;
        }
    }
    return { success: true, cloud: false, reason: 'no_user' };
};

let _isRestoringFromFirestore = false;
window.restoreFromFirestore = async () => {
    if (_isRestoringFromFirestore) return;
    const user = auth.currentUser;
    if (!user) {
        alert('يرجى تسجيل الدخول أولاً بحساب Google.');
        return;
    }
    if (!confirm('هل تريد استعادة بياناتك من قاعدة بيانات السحابة (Firestore)؟ سيتم استبدال البيانات المحلية الحالية.')) {
        return;
    }
    _isRestoringFromFirestore = true;
    try {
        const fsData = await fetchFirestoreAppData(user);
        if (fsData && fsData.rawString) {
            const currentLocal = localStorage.getItem('absence_massar_v8_manual');
            if (currentLocal) {
                localStorage.setItem('absence_massar_v8_pre_restore_backup', currentLocal);
            }
            localStorage.setItem('absence_massar_v8_manual', fsData.rawString);
            localStorage.setItem('absence_massar_v8_last_saved_time', fsData.lastUpdated || new Date().toISOString());
            alert('تم استرجاع البيانات بنجاح من السحابة! تم حفظ نسخة أمان سابقة تلقائياً.');
            window.location.reload();
            return;
        }
        alert('لم يتم العثور على بيانات سحابية سابقة محفوظة لهذا الحساب.');
    } catch(e) {
        console.error("Restore from Firestore error:", e?.message || String(e));
        alert('حدث خطأ أثناء الاستعادة من السحابة: ' + e.message);
    } finally {
        _isRestoringFromFirestore = false;
    }
};

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
provider.addScope('https://www.googleapis.com/auth/calendar.events');

let cachedAccessToken = null;
let lastUpdateCheckTime = 0;
let lastKnownCloudBackupSummary = null;

// Check persistent session token if valid
try {
  const storedToken = sessionStorage.getItem('gdrive_access_token');
  const storedTime = parseInt(sessionStorage.getItem('gdrive_token_time') || '0', 10);
  if (storedToken && (Date.now() - storedTime < 55 * 60 * 1000)) {
    cachedAccessToken = storedToken;
  }
} catch(e) {}

function updateCachedDriveToken(token) {
  cachedAccessToken = token;
  try {
    if (token) {
      sessionStorage.setItem('gdrive_access_token', token);
      sessionStorage.setItem('gdrive_token_time', Date.now().toString());
    } else {
      sessionStorage.removeItem('gdrive_access_token');
      sessionStorage.removeItem('gdrive_token_time');
    }
  } catch(e) {}
  window.dispatchEvent(new CustomEvent('gdrive-token-changed', {
    detail: { token: cachedAccessToken, user: auth.currentUser }
  }));
  updateDriveSyncHeaderBadge(token ? 'synced' : 'disconnected');
}

window.getGoogleDriveToken = async (interactive = false) => {
  if (!cachedAccessToken) {
    try {
      const stored = sessionStorage.getItem('gdrive_access_token');
      const storedTime = parseInt(sessionStorage.getItem('gdrive_token_time') || '0', 10);
      if (stored && (Date.now() - storedTime < 55 * 60 * 1000)) {
        cachedAccessToken = stored;
      }
    } catch(e) {}
  }
  if (cachedAccessToken) return cachedAccessToken;
  if (interactive) {
    return await window.handleDriveLogin();
  }
  return null;
};

window.getGoogleCurrentUser = () => auth.currentUser;
window.getGoogleCalendarAccessToken = window.getGoogleDriveToken;
window.isGoogleCalendarLinked = () => !!cachedAccessToken;

// Header badge updater
function updateDriveSyncHeaderBadge(state, text = '') {
  const badge = document.getElementById('headerDriveSyncBadge');
  const textEl = document.getElementById('headerDriveSyncText');
  if (!badge) return;

  badge.classList.remove('synced', 'update-available', 'saving');
  if (state === 'synced') {
    badge.classList.add('synced');
    if (textEl) textEl.textContent = text || 'Google Drive: متزامن ✓';
    badge.title = 'حساب Google Drive متصل ومتزامن مع أجهزتك الأخرى';
  } else if (state === 'update-available') {
    badge.classList.add('update-available');
    if (textEl) textEl.textContent = text || '🔔 تحديث جديد في Drive!';
    badge.title = 'تم اكتشاف تحديث أحدث في Google Drive من جهاز آخر. انقر للمزامنة.';
  } else if (state === 'saving') {
    badge.classList.add('saving');
    if (textEl) textEl.textContent = text || 'جاري المزامنة مع Drive...';
    badge.title = 'جاري حفظ التحديث تلقائياً في Google Drive';
  } else {
    if (textEl) textEl.textContent = text || 'مزامنة Drive';
    badge.title = 'انقر لربط حساب Google ومزامنة المنظومة عبر أجهزتك المختلفة';
  }
}

function syncBackupUI(user) {
  const emailText = user ? `تم تسجيل الدخول كـ: ${user.email}` : 'غير مسجل الدخول';
  
  const backupStatus = document.getElementById('backupStatus');
  const backupLoginBtn = document.getElementById('backupLoginBtn');
  const backupLogoutBtn = document.getElementById('backupLogoutBtn');
  const backupActionBtns = document.getElementById('backupActionBtns');

  if (backupStatus) backupStatus.innerText = emailText;
  if (backupLoginBtn) backupLoginBtn.style.display = user ? 'none' : 'flex';
  if (backupLogoutBtn) backupLogoutBtn.style.display = user ? 'inline-block' : 'none';
  if (backupActionBtns) backupActionBtns.style.display = user ? 'flex' : 'none';

  document.querySelectorAll('.backup-status-text').forEach(el => {
      el.innerText = emailText;
      if (user) {
          el.style.color = '#15803d';
          el.style.background = '#dcfce7';
      } else {
          el.style.color = '#475569';
          el.style.background = '#e2e8f0';
      }
  });
  document.querySelectorAll('.backup-login-btn').forEach(el => {
      el.style.display = user ? 'none' : 'flex';
  });
  document.querySelectorAll('.backup-logout-btn').forEach(el => {
      el.style.display = user ? 'inline-flex' : 'none';
  });
  document.querySelectorAll('.backup-actions-container').forEach(el => {
      el.style.display = user ? 'flex' : 'none';
  });

  if (typeof window.syncLibraryDriveUIState === 'function') {
      window.syncLibraryDriveUIState();
  }

  // Update header pill
  if (user && cachedAccessToken) {
    updateDriveSyncHeaderBadge('synced');
  } else if (user) {
    updateDriveSyncHeaderBadge('synced', 'Google: متصل');
  } else {
    updateDriveSyncHeaderBadge('disconnected');
  }

  // Pre-fill email input if available
  const emailInput = document.getElementById('loginDriveEmailInput');
  if (emailInput && !emailInput.value) {
    const savedEmail = user ? user.email : localStorage.getItem('gdrive_last_email');
    if (savedEmail) emailInput.value = savedEmail;
  }
}

window.syncBackupUIState = () => syncBackupUI(auth.currentUser);

// -------------------------------------------------------------
// Metadata & File Helpers for Google Drive & Cloud Backups
// -------------------------------------------------------------

async function getBackupFileMetadata(accessToken) {
  if (!accessToken) return null;
  try {
      const res = await fetch("https://www.googleapis.com/drive/v3/files?q=name='app_backup.json' and trashed=false&fields=files(id,name,modifiedTime,size,description)&orderBy=modifiedTime desc", {
          headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.files && data.files.length > 0) {
          return data.files[0];
      }
      return null;
  } catch (error) {
      console.warn('Error fetching Drive file metadata', error?.message || String(error));
      return null;
  }
}

async function getBackupFileId(accessToken) {
  const meta = await getBackupFileMetadata(accessToken);
  return meta ? meta.id : null;
}

function extractBackupSummary(data, source = 'gdrive', fallbackDate = null) {
  if (!data || typeof data !== 'object') return null;
  const classes = data.classes || {};
  const classNames = Object.keys(classes);
  const totalStudents = classNames.reduce((sum, c) => sum + (Array.isArray(classes[c]) ? classes[c].length : 0), 0);
  const recordsCount = Array.isArray(data.records) ? data.records.length : 0;
  const gradesCount = data.grades ? Object.keys(data.grades).length : 0;
  const teacherName = (data.teacherProfile && (data.teacherProfile.name || data.teacherProfile.username)) || 'الأستاذ(ة)';

  let timestamp = 0;
  if (data._lastSavedTimestamp) {
    timestamp = Number(data._lastSavedTimestamp);
  } else if (data._lastSavedAt) {
    timestamp = new Date(data._lastSavedAt).getTime();
  } else if (fallbackDate) {
    timestamp = new Date(fallbackDate).getTime();
  }

  let dateStr = 'غير محدد';
  if (timestamp > 0) {
    try {
      dateStr = new Intl.DateTimeFormat('ar-MA', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(timestamp));
    } catch (_) {
      dateStr = new Date(timestamp).toLocaleString('ar-MA');
    }
  }

  return {
    source,
    timestamp,
    dateStr,
    teacherName,
    classNames,
    classesCount: classNames.length,
    totalStudents,
    recordsCount,
    gradesCount,
    device: data._lastSavedDevice || 'جهاز آخر',
    data
  };
}

function getLocalSummary() {
  const localRaw = localStorage.getItem('absence_massar_v8_manual');
  let parsed = null;
  try { parsed = JSON.parse(localRaw); } catch(_) {}
  
  const savedTimeStr = localStorage.getItem('absence_massar_v8_last_saved_time') || (parsed && parsed._lastSavedAt);
  return extractBackupSummary(parsed, 'local', savedTimeStr);
}

// -------------------------------------------------------------
// Check for Drive / Cloud Updates Across Devices
// -------------------------------------------------------------

window.checkForDriveUpdates = async (options = {}) => {
  const interactive = !!options.interactive;
  const token = cachedAccessToken || await window.getGoogleDriveToken(false);
  const user = auth.currentUser;

  if (!user && !token) {
    if (interactive) {
      alert('يرجى تسجيل الدخول بحساب Google أولاً للتعرف على آخر تحديث.');
    }
    return null;
  }

  updateDriveSyncHeaderBadge('saving', 'فحص Google Drive...');
  let cloudSummary = null;

  // 1. Check Google Drive if access token available
  if (token) {
    try {
      const fileMeta = await getBackupFileMetadata(token);
      if (fileMeta && fileMeta.id) {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileMeta.id}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const driveData = await res.json();
          if (driveData && (driveData.classes || driveData.teacherProfile)) {
            cloudSummary = extractBackupSummary(driveData, 'Google Drive', fileMeta.modifiedTime);
          }
        }
      }
    } catch (err) {
      console.warn("Drive check failed, checking Firestore fallback:", err);
    }
  }

  // 2. Check Firestore fallback or compare to see which is newer
  if (user) {
    try {
      const fsData = await fetchFirestoreAppData(user);
      if (fsData && fsData.rawString) {
        let parsedFs = null;
        try { parsedFs = JSON.parse(fsData.rawString); } catch(_) {}
        if (parsedFs) {
          const fsSummary = extractBackupSummary(parsedFs, 'Firestore Cloud', fsData.lastUpdated);
          if (!cloudSummary || (fsSummary && fsSummary.timestamp > cloudSummary.timestamp)) {
            cloudSummary = fsSummary;
          }
        }
      }
    } catch (err) {
      console.warn("Firestore backup check error:", err);
    }
  }

  lastKnownCloudBackupSummary = cloudSummary;
  lastUpdateCheckTime = Date.now();

  const localSummary = getLocalSummary();
  const isLocalEmpty = !localSummary || localSummary.classesCount === 0;

  // Case A: Cloud has data and local is completely empty (New device or fresh browser!)
  if (cloudSummary && cloudSummary.classesCount > 0 && isLocalEmpty) {
    updateDriveSyncHeaderBadge('update-available', 'آخر تحديث متوفر!');
    showDriveNewDeviceModal(cloudSummary);
    return { status: 'new_device_ready', cloud: cloudSummary, local: localSummary };
  }

  // Case B: Both have data, but Cloud has a NEWER update than this device!
  if (cloudSummary && localSummary && (cloudSummary.timestamp - localSummary.timestamp > 8000)) {
    updateDriveSyncHeaderBadge('update-available', 'تحديث جديد متوفر!');
    showDriveComparisonModal(localSummary, cloudSummary);
    return { status: 'remote_newer', cloud: cloudSummary, local: localSummary };
  }

  // Case C: Local is NEWER than Cloud
  if (cloudSummary && localSummary && (localSummary.timestamp - cloudSummary.timestamp > 8000)) {
    updateDriveSyncHeaderBadge('synced', 'Google Drive: متزامن ✓');
    if (interactive) {
      if (confirm(`بيانات هذا الجهاز (${localSummary.dateStr}) أحدث من النسخة السحابية (${cloudSummary.dateStr}).\nهل تريد رفع هذا التحديث الآن إلى Google Drive ليكون متاحاً على بقية أجهزتك؟`)) {
        await window.handleBackupToDrive();
      }
    }
    return { status: 'local_newer', cloud: cloudSummary, local: localSummary };
  }

  // Case D: In sync
  if (cloudSummary) {
    updateDriveSyncHeaderBadge('synced', 'Google Drive: متزامن ✓');
    if (interactive) {
      if (typeof showAppToast === 'function') {
        showAppToast('بياناتك على هذا الجهاز متطابقة تماماً مع آخر تحديث في Google Drive.', 'success');
      } else {
        alert('بياناتك على هذا الجهاز متطابقة تماماً مع آخر تحديث في Google Drive.');
      }
    }
    return { status: 'in_sync', cloud: cloudSummary, local: localSummary };
  }

  // Case E: No cloud backup found yet
  updateDriveSyncHeaderBadge('synced', 'Google: متصل');
  if (interactive) {
    if (!isLocalEmpty) {
      if (confirm('تم ربط حسابك بنجاح! لم يتم العثور على نسخة سابقة في Google Drive لهذا الحساب.\nهل تريد حفظ نسخة بيانات هذا الجهاز الآن في Google Drive لتكون متاحة من أجهزتك الأخرى؟')) {
        await window.handleBackupToDrive();
      }
    } else {
      alert('تم الاتصال بحساب Google. لم يتم العثور على أي نسخة احتياطية سابقة لهذا الحساب.');
    }
  }
  return { status: 'no_cloud_backup', local: localSummary };
};

// -------------------------------------------------------------
// Apply Synced Data & Safety Rollback
// -------------------------------------------------------------

window.applyCloudBackup = async (backupData, sourceName = 'Google Drive') => {
  if (!backupData) return;
  try {
    const serialized = typeof backupData === 'string' ? backupData : safeStringify(backupData);
    const currentLocal = localStorage.getItem('absence_massar_v8_manual');
    if (currentLocal) {
      localStorage.setItem('absence_massar_v8_pre_restore_backup', currentLocal);
    }
    localStorage.setItem('absence_massar_v8_manual', serialized);
    localStorage.setItem('absence_massar_v8_last_saved_time', new Date().toISOString());

    // Dismiss login screen if open
    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.style.display = 'none';

    // Show brief toast and reload
    if (typeof showAppToast === 'function') {
      showAppToast(`تم بنجاح تحميل وتطبيق آخر تحديث من ${sourceName}! جاري تحديث الشاشة...`, 'success');
    }
    setTimeout(() => {
      window.location.reload();
    }, 450);
  } catch(e) {
    console.error("Error applying cloud backup:", e);
    alert('حدث خطأ أثناء تطبيق البيانات: ' + e.message);
  }
};

// -------------------------------------------------------------
// Auto-Sync to Google Drive (Continuous background backup)
// -------------------------------------------------------------

let driveAutoSyncTimer = null;
let isDriveSyncing = false;

window.autoSyncToGoogleDrive = (data) => {
  if (!cachedAccessToken) return;
  if (driveAutoSyncTimer) clearTimeout(driveAutoSyncTimer);

  driveAutoSyncTimer = setTimeout(async () => {
    if (isDriveSyncing) return;
    isDriveSyncing = true;
    try {
      updateDriveSyncHeaderBadge('saving', 'جاري الحفظ في Drive...');
      
      const payloadObj = Object.assign({}, data || window.db || {});
      payloadObj._lastSavedAt = new Date().toISOString();
      payloadObj._lastSavedTimestamp = Date.now();
      payloadObj._lastSavedDevice = navigator.userAgent.includes('Mobile') ? 'هاتف محمول' : (navigator.userAgent.includes('Mac') ? 'جهاز Mac' : 'حاسوب مكتبي');
      
      const serialized = safeStringify(payloadObj);
      const fileId = await getBackupFileId(cachedAccessToken);

      if (fileId) {
        await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
          method: 'PATCH',
          headers: { 
            Authorization: `Bearer ${cachedAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: serialized
        });
      } else {
        const metadata = { name: 'app_backup.json', mimeType: 'application/json' };
        const formData = new FormData();
        formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        formData.append('file', new Blob([serialized], { type: 'application/json' }));

        await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: { Authorization: `Bearer ${cachedAccessToken}` },
          body: formData
        });
      }

      localStorage.setItem('absence_massar_v8_last_saved_time', payloadObj._lastSavedAt);
      updateDriveSyncHeaderBadge('synced', 'Google Drive: متزامن ✓');
      window.dispatchEvent(new CustomEvent('gdriveSyncSuccess', { detail: { timestamp: new Date() } }));
    } catch (err) {
      console.warn("Silent Drive auto-sync failed:", err?.message || String(err));
      updateDriveSyncHeaderBadge('synced', 'Google Drive متصل');
    } finally {
      isDriveSyncing = false;
    }
  }, 1600);
};

// -------------------------------------------------------------
// Interactive UI Modals for Multi-Device Sync
// -------------------------------------------------------------

function showDriveNewDeviceModal(cloudSummary) {
  let modal = document.getElementById('driveNewDeviceDetectedModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'driveNewDeviceDetectedModal';
    modal.className = 'drive-sync-modal-backdrop';
    document.body.appendChild(modal);
  }

  const classListText = (cloudSummary.classNames || []).slice(0, 5).join('، ') + (cloudSummary.classNames.length > 5 ? ' ...' : '');

  modal.innerHTML = `
    <div class="drive-sync-modal-card">
      <div style="text-align: center; margin-bottom: 16px;">
        <div style="width: 56px; height: 56px; border-radius: 50%; background: #dbeafe; color: #0284c7; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px auto; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.25);">
          <span class="ui-icon"><span data-lucide="cloud-download" data-size="30"></span></span>
        </div>
        <h3 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">تم التعرف على آخر تحديث سحابي!</h3>
        <p style="font-size: 0.85rem; color: #64748b; margin: 0;">أهلاً بك أستاذ <strong>${cloudSummary.teacherName}</strong>. تم العثور على أحدث نسخة لبياناتك ومادتك في Google Drive.</p>
      </div>

      <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin-bottom: 18px; font-size: 0.84rem;">
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #cbd5e1;">
          <span style="color: #64748b;">📅 آخر حفظ وتحديث:</span>
          <strong style="color: #0284c7;">${cloudSummary.dateStr}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #cbd5e1;">
          <span style="color: #64748b;">📚 الأقسام الدراسية (${cloudSummary.classesCount}):</span>
          <strong style="color: #0f172a;">${classListText || 'لا توجد'}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #cbd5e1;">
          <span style="color: #64748b;">👥 إجمالي التلاميذ:</span>
          <strong style="color: #10b981;">${cloudSummary.totalStudents} تلميذ</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 6px 0;">
          <span style="color: #64748b;">📝 الحصص والغياب والنقط:</span>
          <strong style="color: #475569;">${cloudSummary.recordsCount} حصة مسجلة</strong>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button type="button" id="btnAcceptDriveUpdate" class="btn-primary" style="background: linear-gradient(135deg, #0284c7, #0369a1); padding: 12px; font-size: 0.95rem; font-weight: 800; border-radius: 10px; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);">
          <span class="ui-icon"><span data-lucide="check-check" data-size="18"></span></span>
          <span>تحميل وتفعيل آخر تحديث فوراً على هذا الجهاز</span>
        </button>
        <button type="button" onclick="window.dismissDriveNewDeviceModal()" style="background: #ffffff; border: 1px solid #cbd5e1; color: #64748b; padding: 9px; font-size: 0.84rem; border-radius: 8px; cursor: pointer;">
          البدء بدون استرجاع (حساب فارغ جديد)
        </button>
      </div>
    </div>
  `;

  modal.style.display = 'flex';
  if (window.lucide) window.lucide.createIcons();

  document.getElementById('btnAcceptDriveUpdate').onclick = () => {
    window.applyCloudBackup(cloudSummary.data, cloudSummary.source);
  };
}

window.dismissDriveNewDeviceModal = () => {
  const modal = document.getElementById('driveNewDeviceDetectedModal');
  if (modal) modal.style.display = 'none';
};

function showDriveComparisonModal(localSummary, cloudSummary) {
  let modal = document.getElementById('driveUpdateComparisonModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'driveUpdateComparisonModal';
    modal.className = 'drive-sync-modal-backdrop';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="drive-sync-modal-card" style="max-width: 520px;">
      <div style="text-align: center; margin-bottom: 16px;">
        <div style="width: 50px; height: 50px; border-radius: 50%; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px auto;">
          <span class="ui-icon"><span data-lucide="refresh-cw" data-size="26"></span></span>
        </div>
        <h3 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">تحديث أحدث متوفر في Google Drive!</h3>
        <p style="font-size: 0.82rem; color: #64748b; margin: 0;">تم رصد تعديلات أحدث تم حفظها من جهاز آخر في حسابك.</p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px;">
        <!-- النسخة المحلية -->
        <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px;">
          <div style="font-weight: 700; color: #475569; font-size: 0.82rem; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <span data-lucide="laptop" data-size="14"></span>
            <span>هذا الجهاز (الحالي)</span>
          </div>
          <div style="font-size: 0.74rem; color: #64748b; margin-bottom: 4px;">آخر تعديل:</div>
          <div style="font-size: 0.8rem; font-weight: 700; color: #0f172a; margin-bottom: 8px;">${localSummary ? localSummary.dateStr : 'غير محدد'}</div>
          <div style="font-size: 0.75rem; color: #475569;">الأقسام: <strong>${localSummary ? localSummary.classesCount : 0}</strong></div>
          <div style="font-size: 0.75rem; color: #475569;">التلاميذ: <strong>${localSummary ? localSummary.totalStudents : 0}</strong></div>
        </div>

        <!-- نسخة Google Drive السحابية -->
        <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 10px; padding: 12px; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.12);">
          <div style="font-weight: 800; color: #15803d; font-size: 0.82rem; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <span data-lucide="cloud" data-size="14"></span>
            <span>Google Drive (الأحدث)</span>
          </div>
          <div style="font-size: 0.74rem; color: #166534; margin-bottom: 4px;">آخر تعديل سحابي:</div>
          <div style="font-size: 0.8rem; font-weight: 800; color: #15803d; margin-bottom: 8px;">${cloudSummary.dateStr}</div>
          <div style="font-size: 0.75rem; color: #166534;">الأقسام: <strong>${cloudSummary.classesCount}</strong></div>
          <div style="font-size: 0.75rem; color: #166534;">التلاميذ: <strong>${cloudSummary.totalStudents}</strong></div>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px;">
        <button type="button" id="btnUpdateFromDrive" class="btn-primary" style="background: linear-gradient(135deg, #10b981, #059669); padding: 11px; font-size: 0.9rem; font-weight: 800; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <span data-lucide="download" data-size="16"></span>
          <span>تحديث هذا الجهاز بنسخة Google Drive الأحدث (موصى به)</span>
        </button>
        <button type="button" id="btnKeepLocalAndPush" style="background: #f8fafc; border: 1.5px solid #0284c7; color: #0284c7; padding: 9px; font-size: 0.84rem; font-weight: 700; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
          <span data-lucide="upload" data-size="15"></span>
          <span>الاحتفاظ بنسخة هذا الجهاز ورفعها واعتمادها في Drive</span>
        </button>
        <button type="button" onclick="window.dismissDriveComparisonModal()" style="background: transparent; border: none; color: #94a3b8; font-size: 0.8rem; cursor: pointer; padding: 6px;">
          إلغاء والاحتفاظ بالبيانات الحالية مؤقتاً
        </button>
      </div>
    </div>
  `;

  modal.style.display = 'flex';
  if (window.lucide) window.lucide.createIcons();

  document.getElementById('btnUpdateFromDrive').onclick = () => {
    window.applyCloudBackup(cloudSummary.data, cloudSummary.source);
  };
  document.getElementById('btnKeepLocalAndPush').onclick = async () => {
    window.dismissDriveComparisonModal();
    await window.handleBackupToDrive();
  };
}

window.dismissDriveComparisonModal = () => {
  const modal = document.getElementById('driveUpdateComparisonModal');
  if (modal) modal.style.display = 'none';
};

// -------------------------------------------------------------
// Drive Multi-Device Sync Center Modal (Dashboard for Drive)
// -------------------------------------------------------------

window.openDriveSyncCenterModal = async () => {
  let modal = document.getElementById('driveSyncCenterModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'driveSyncCenterModal';
    modal.className = 'drive-sync-modal-backdrop';
    document.body.appendChild(modal);
  }

  const user = auth.currentUser;
  const email = user ? user.email : (localStorage.getItem('gdrive_last_email') || 'غير مسجل الدخول');
  const isConnected = !!user;
  const localSummary = getLocalSummary();
  const cloudSummary = lastKnownCloudBackupSummary;

  modal.innerHTML = `
    <div class="drive-sync-modal-card" style="max-width: 500px;">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 14px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="background: #e0f2fe; color: #0284c7; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
            <span data-lucide="cloud" data-size="20"></span>
          </div>
          <div>
            <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #0f172a;">مركز المزامنة السحابية وتعدد الأجهزة</h3>
            <div style="font-size: 0.74rem; color: #64748b;">استخدام المنظومة بسلاسة من الهاتف، الحاسوب، واللوحة</div>
          </div>
        </div>
        <button type="button" onclick="window.closeDriveSyncCenterModal()" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #94a3b8; padding: 4px;">&times;</button>
      </div>

      <!-- حساب المستخدم الحالي -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;">
        <div>
          <div style="font-size: 0.74rem; color: #64748b;">حساب Google المرتبط:</div>
          <div style="font-weight: 700; font-size: 0.88rem; color: #0f172a; direction: ltr; text-align: right;">${email}</div>
        </div>
        <div>
          ${isConnected 
            ? `<span style="font-size: 0.75rem; background: #dcfce7; color: #166534; font-weight: 700; padding: 3px 8px; border-radius: 6px; border: 1px solid #bbf7d0;">متصل</span>`
            : `<button type="button" onclick="window.handleDriveLogin(); window.closeDriveSyncCenterModal();" class="btn-primary" style="font-size: 0.75rem; padding: 4px 10px; border-radius: 6px;">تسجيل الدخول</button>`}
        </div>
      </div>

      <!-- بطاقات المقارنة السريعة -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
        <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 10px;">
          <div style="font-size: 0.72rem; color: #64748b; font-weight: 700; margin-bottom: 4px;">🖥️ هذا الجهاز</div>
          <div style="font-size: 0.78rem; font-weight: 700; color: #0f172a;">${localSummary ? localSummary.dateStr : 'غير متوفر'}</div>
          <div style="font-size: 0.72rem; color: #64748b; margin-top: 4px;">أقسام: ${localSummary ? localSummary.classesCount : 0} | تلاميذ: ${localSummary ? localSummary.totalStudents : 0}</div>
        </div>
        <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 8px; padding: 10px;">
          <div style="font-size: 0.72rem; color: #166534; font-weight: 700; margin-bottom: 4px;">☁️ سحابة Google Drive</div>
          <div style="font-size: 0.78rem; font-weight: 700; color: #15803d;">${cloudSummary ? cloudSummary.dateStr : 'جاري الفحص...'}</div>
          <div style="font-size: 0.72rem; color: #166534; margin-top: 4px;">أقسام: ${cloudSummary ? cloudSummary.classesCount : '--'} | تلاميذ: ${cloudSummary ? cloudSummary.totalStudents : '--'}</div>
        </div>
      </div>

      <!-- الإجراءات السريعة -->
      <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
        <button type="button" onclick="window.checkForDriveUpdates({ interactive: true })" class="btn-primary" style="background: #0284c7; padding: 10px; font-size: 0.86rem; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 6px;">
          <span data-lucide="refresh-cw" data-size="15"></span>
          <span>فحص التحديثات الآن (Check for Updates)</span>
        </button>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <button type="button" onclick="window.handleBackupToDrive()" class="btn-primary" style="background: #10b981; padding: 9px; font-size: 0.82rem; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <span data-lucide="upload-cloud" data-size="14"></span>
            <span>رفع إلى Drive</span>
          </button>
          <button type="button" onclick="window.handleRestoreFromDrive()" class="btn-primary" style="background: #d97706; padding: 9px; font-size: 0.82rem; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <span data-lucide="download-cloud" data-size="14"></span>
            <span>استعادة من Drive</span>
          </button>
        </div>
      </div>

      ${isConnected ? `
        <button type="button" onclick="window.handleDriveLogout(); window.closeDriveSyncCenterModal();" style="width: 100%; background: #f8fafc; border: 1px solid #cbd5e1; color: #64748b; padding: 7px; border-radius: 6px; font-size: 0.78rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px;">
          <span data-lucide="log-out" data-size="13"></span>
          <span>تسجيل الخروج من حساب Google</span>
        </button>
      ` : ''}
    </div>
  `;

  modal.style.display = 'flex';
  if (window.lucide) window.lucide.createIcons();

  // Trigger silent check to populate latest cloudSummary
  window.checkForDriveUpdates({ interactive: false });
};

window.closeDriveSyncCenterModal = () => {
  const modal = document.getElementById('driveSyncCenterModal');
  if (modal) modal.style.display = 'none';
};

// -------------------------------------------------------------
// Handle Login Screen Drive Sync
// -------------------------------------------------------------

window.handleLoginScreenDriveSync = async () => {
  const emailInput = document.getElementById('loginDriveEmailInput');
  const emailVal = emailInput ? emailInput.value.trim() : '';
  const statusEl = document.getElementById('loginDriveSyncStatus');
  const btnText = document.getElementById('loginDriveBtnText');

  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.textContent = 'جاري الاتصال بـ Google والتعرف على آخر تحديث...';
  }
  if (btnText) btnText.textContent = 'جاري المزامنة والتعرف...';

  try {
    const token = await window.handleDriveLogin(emailVal);
    if (!token) {
      if (statusEl) statusEl.textContent = 'تم إلغاء تسجيل الدخول أو تعذر الاتصال.';
      return;
    }
  } catch(e) {
    console.error("Login screen sync error:", e);
    if (statusEl) statusEl.textContent = 'حدث خطأ: ' + e.message;
  } finally {
    if (btnText) btnText.textContent = 'دخول ومزامنة آخر تحديث من Google Drive';
  }
};

// -------------------------------------------------------------
// Auth State & Visibility Listeners
// -------------------------------------------------------------

onAuthStateChanged(auth, async (user) => {
  syncBackupUI(user);

  if (user) {
    if (user.email) {
      localStorage.setItem('gdrive_last_email', user.email);
    }
    // Auto check if this device needs cloud restoration or update
    setTimeout(() => {
      window.checkForDriveUpdates({ interactive: false, onLogin: true });
    }, 600);
  } else {
    updateCachedDriveToken(null);
  }
});

let _pendingDriveLoginPromise = null;

async function processDriveSignInResult(result, skipUpdateCheck = false) {
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential ? credential.accessToken : null;
  updateCachedDriveToken(accessToken);
  if (result.user && result.user.email) {
    localStorage.setItem('gdrive_last_email', result.user.email);
  }
  if (typeof window.syncLibraryDriveUIState === 'function') {
    window.syncLibraryDriveUIState();
  }
  if (!skipUpdateCheck) {
    await window.checkForDriveUpdates({ interactive: true, fromLoginAction: true });
  }
  return accessToken;
}

function showDrivePopupRetryModal(emailHint, skipUpdateCheck = false) {
  return new Promise((resolve) => {
    let modal = document.getElementById('drivePopupRetryModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'drivePopupRetryModal';
      modal.className = 'drive-sync-modal-backdrop';
      modal.style.zIndex = '99999';
      document.body.appendChild(modal);
    }

    const hintEmail = (emailHint && typeof emailHint === 'string' && emailHint.trim().includes('@'))
      ? emailHint.trim()
      : (auth.currentUser?.email || localStorage.getItem('gdrive_last_email') || '');

    modal.innerHTML = `
      <div class="drive-sync-modal-card" style="max-width: 440px; text-align: center;">
        <div style="width: 52px; height: 52px; border-radius: 50%; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px auto;">
          <span data-lucide="shield-check" data-size="26"></span>
        </div>
        <h3 style="font-size: 1.1rem; font-weight: 800; color: #0f172a; margin: 0 0 8px 0;">تأكيد فتح نافذة حساب Google</h3>
        <p id="drivePopupModalDesc" style="font-size: 0.84rem; color: #475569; margin: 0 0 16px 0; line-height: 1.6;">
          لتنشيط الاتصال السحابي مع <strong>Google Drive</strong> بأمان، يرجى النقر على الزر أدناه لفتح نافذة تسجيل الدخول المعتمدة من Google.
        </p>
        <div id="drivePopupBlockedNotice" style="display: none; background: #fffbeb; border: 1px solid #fde68a; color: #92400e; padding: 10px 12px; border-radius: 8px; font-size: 0.78rem; margin-bottom: 14px; text-align: right; line-height: 1.5;">
          ⚠️ <strong>ملاحظة:</strong> قام المتصفح بحظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة (Pop-ups) لهذا الموقع من أيقونة شريط العنوان أعلى المتصفح ثم الضغط مجدداً.
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <button type="button" id="btnConfirmDrivePopupOpen" class="btn-primary" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 11px 16px; font-size: 0.9rem; font-weight: 800; border-radius: 9px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer;">
            <span data-lucide="external-link" data-size="16"></span>
            <span>متابعة تسجيل الدخول بحساب Google</span>
          </button>
          <button type="button" id="btnCancelDrivePopupOpen" style="background: #f8fafc; border: 1px solid #cbd5e1; color: #64748b; padding: 8px 14px; font-size: 0.82rem; border-radius: 8px; cursor: pointer;">
            إلغاء
          </button>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
    if (window.lucide) window.lucide.createIcons();

    const confirmBtn = document.getElementById('btnConfirmDrivePopupOpen');
    const cancelBtn = document.getElementById('btnCancelDrivePopupOpen');
    const blockedNotice = document.getElementById('drivePopupBlockedNotice');

    const cleanup = () => {
      modal.style.display = 'none';
    };

    if (cancelBtn) {
      cancelBtn.onclick = () => {
        cleanup();
        resolve(null);
      };
    }

    if (confirmBtn) {
      confirmBtn.onclick = async () => {
        const customParams = { prompt: 'select_account' };
        if (hintEmail) customParams.login_hint = hintEmail;
        provider.setCustomParameters(customParams);

        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.75';

        try {
          const result = await signInWithPopup(auth, provider);
          cleanup();
          const token = await processDriveSignInResult(result, skipUpdateCheck);
          resolve(token);
        } catch (err) {
          confirmBtn.disabled = false;
          confirmBtn.style.opacity = '1';
          const code = err?.code || '';
          const msg = err?.message || String(err);
          if (code === 'auth/popup-blocked' || msg.includes('popup-blocked')) {
            if (blockedNotice) blockedNotice.style.display = 'block';
          } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
            cleanup();
            resolve(null);
          } else {
            cleanup();
            if (typeof window.showAppToast === 'function') {
              window.showAppToast('تعذر تسجيل الدخول بحساب Google: ' + msg, 'warning');
            }
            resolve(null);
          }
        }
      };
    }
  });
}

window.handleDriveLogin = async (emailHint, options = {}) => {
  if (_pendingDriveLoginPromise) {
    return _pendingDriveLoginPromise;
  }

  const skipUpdateCheck = !!options.skipUpdateCheck;

  _pendingDriveLoginPromise = (async () => {
    try {
      const customParams = { prompt: 'select_account' };
      const hint = (emailHint && typeof emailHint === 'string' && emailHint.trim().includes('@'))
        ? emailHint.trim()
        : (auth.currentUser?.email || '');
      if (hint) {
        customParams.login_hint = hint;
      }
      provider.setCustomParameters(customParams);

      // If browser reports no active transient user gesture (e.g. called after async await),
      // immediately open the one-click confirmation modal to avoid auth/popup-blocked
      if (typeof navigator !== 'undefined' && navigator.userActivation && !navigator.userActivation.isActive) {
        return await showDrivePopupRetryModal(hint, skipUpdateCheck);
      }

      const result = await signInWithPopup(auth, provider);
      return await processDriveSignInResult(result, skipUpdateCheck);
    } catch (err) {
      const code = err?.code || '';
      const msg = err?.message || String(err);

      if (code === 'auth/popup-blocked' || msg.includes('popup-blocked')) {
        return await showDrivePopupRetryModal(emailHint, skipUpdateCheck);
      }
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return null;
      }

      console.warn("Google Sign-In warning:", msg);
      if (typeof window.showAppToast === 'function') {
        window.showAppToast('تعذر الاتصال بحساب Google: ' + msg, 'warning');
      }
      return null;
    } finally {
      _pendingDriveLoginPromise = null;
    }
  })();

  return _pendingDriveLoginPromise;
};

window.handleDriveLogout = async () => {
  if (!confirm('هل تريد تسجيل الخروج؟')) return;
  updateCachedDriveToken(null);
  await signOut(auth);
  if (typeof window.syncLibraryDriveUIState === 'function') {
    window.syncLibraryDriveUIState();
  }
  updateDriveSyncHeaderBadge('disconnected');
};

let _isDriveBackupRunning = false;
window.handleBackupToDrive = async () => {
  if (_isDriveBackupRunning) return;
  if (!cachedAccessToken) {
      const token = await window.handleDriveLogin(auth.currentUser?.email, { skipUpdateCheck: true });
      if (!token) return;
  }

  _isDriveBackupRunning = true;
  try {
      document.querySelectorAll('.backup-drive-text, #backupBtnText').forEach(el => el.innerText = 'جاري النسخ...');
      
      const payloadObj = Object.assign({}, window.db || {});
      payloadObj._lastSavedAt = new Date().toISOString();
      payloadObj._lastSavedTimestamp = Date.now();
      payloadObj._lastSavedDevice = navigator.userAgent.includes('Mobile') ? 'هاتف محمول' : (navigator.userAgent.includes('Mac') ? 'جهاز Mac' : 'حاسوب');
      
      const serialized = safeStringify(payloadObj);
      const fileId = await getBackupFileId(cachedAccessToken);
      
      if (fileId) {
          const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
              method: 'PATCH',
              headers: { 
                  Authorization: `Bearer ${cachedAccessToken}`,
                  'Content-Type': 'application/json'
              },
              body: serialized
          });
          if (!res.ok) throw new Error('فشل تحديث الملف');
      } else {
          const metadata = { name: 'app_backup.json', mimeType: 'application/json' };
          const formData = new FormData();
          formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
          formData.append('file', new Blob([serialized], { type: 'application/json' }));

          const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
              method: 'POST',
              headers: { Authorization: `Bearer ${cachedAccessToken}` },
              body: formData
          });
          if (!res.ok) throw new Error('فشل إنشاء الملف');
      }
      
      localStorage.setItem('absence_massar_v8_manual', serialized);
      localStorage.setItem('absence_massar_v8_last_saved_time', payloadObj._lastSavedAt);
      updateDriveSyncHeaderBadge('synced', 'Google Drive: متزامن ✓');

      alert('تم النسخ الاحتياطي وحفظ آخر تحديث في Google Drive بنجاح!\nيمكنك الآن فتح نفس النسخة المحدثة من أي جهاز آخر فور تسجيل الدخول.');
  } catch (err) {
      console.error(err?.message || String(err));
      alert('حدث خطأ أثناء النسخ الاحتياطي: ' + err.message);
  } finally {
      _isDriveBackupRunning = false;
      document.querySelectorAll('.backup-drive-text, #backupBtnText').forEach(el => el.innerText = 'نسخ احتياطي إلى Drive');
  }
};

let _isDriveRestoreRunning = false;
window.handleRestoreFromDrive = async () => {
  if (_isDriveRestoreRunning) return;
  if (!cachedAccessToken) {
      const token = await window.handleDriveLogin(auth.currentUser?.email, { skipUpdateCheck: true });
      if (!token) return;
  }
  
  if (!confirm('هل أنت متأكد أنك تريد استعادة البيانات من Google Drive؟ سيتم استبدال البيانات الحالية على هذا الجهاز بنسخة Google Drive.')) {
      return;
  }

  _isDriveRestoreRunning = true;
  try {
      document.querySelectorAll('.restore-drive-text, #restoreBtnText').forEach(el => el.innerText = 'جاري الاستعادة...');
      const fileId = await getBackupFileId(cachedAccessToken);
      if (!fileId) {
          alert('لم يتم العثور على أي نسخة احتياطية سابقة (app_backup.json) في حسابك على Google Drive.');
          return;
      }

      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { Authorization: `Bearer ${cachedAccessToken}` }
      });
      
      if (!res.ok) throw new Error('فشل تحميل الملف من Google Drive');
      
      const data = await res.json();
      if (data && (data.classes || data.teacherProfile)) {
          await window.applyCloudBackup(data, 'Google Drive');
      } else {
          alert('الملف المسترجع غير صالح أو فارغ.');
      }
  } catch (err) {
      console.error(err?.message || String(err));
      alert('حدث خطأ أثناء الاستعادة: ' + err.message);
  } finally {
      _isDriveRestoreRunning = false;
      document.querySelectorAll('.restore-drive-text, #restoreBtnText').forEach(el => el.innerText = 'استعادة من Drive');
  }
};

window.deleteCloudBackup = async (silent = false) => {
  const user = auth.currentUser;
  let firestoreDeleted = false;
  let driveDeleted = false;

  if (user) {
      try {
          const docSnap = await getDoc(doc(dbFirestore, "users", user.uid));
          if (docSnap.exists()) {
              const data = docSnap.data();
              if (data && data.isChunked && data.chunksCount > 0) {
                  for (let i = 0; i < data.chunksCount; i++) {
                      await deleteDoc(doc(dbFirestore, "users", user.uid, "chunks", `chunk_${i}`)).catch(() => {});
                  }
              }
          }
          await deleteDoc(doc(dbFirestore, "users", user.uid));
          firestoreDeleted = true;
      } catch (e) {
          console.error("Error deleting Firestore backup:", e?.message || String(e));
      }
  }

  if (cachedAccessToken) {
      try {
          const fileId = await getBackupFileId(cachedAccessToken);
          if (fileId) {
              const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${cachedAccessToken}` }
              });
              if (res.ok) driveDeleted = true;
          }
      } catch (e) {
          console.error("Error deleting Drive backup:", e?.message || String(e));
      }
  }

  return { firestoreDeleted, driveDeleted, userLogged: !!user, driveConnected: !!cachedAccessToken };
};

window.handleClearAllBackups = async () => {
  const confirmMsg = "هل أنت متأكد من رغبتك في مسح كافة النسخ الاحتياطية السحابية (Firestore وGoogle Drive)؟\n\nلن يتمكن النظام من استرجاع أي بيانات تجريبية سابقة بعد هذا الإجراء.";
  if (!confirm(confirmMsg)) return;

  const statusEl = document.getElementById('backupStatus');
  const oldStatus = statusEl ? statusEl.innerText : '';
  if (statusEl) statusEl.innerText = "جاري مسح النسخ الاحتياطية السحابية...";

  try {
      const res = await window.deleteCloudBackup(true);
      const msgs = [];
      if (res.firestoreDeleted) msgs.push("✓ تم مسح النسخة الاحتياطية من السحابة (Firestore).");
      if (res.driveDeleted) msgs.push("✓ تم مسح النسخة الاحتياطية من Google Drive.");

      if (!res.userLogged && !res.driveConnected) {
          msgs.push("ℹ️ لم يتم العثور على حساب Google مسجل حالياً. تم مسح أي سجلات نسخ مؤقتة محلياً.");
      } else if (!res.firestoreDeleted && !res.driveDeleted) {
          msgs.push("✓ تم التحقق: لا توجد أي نسخ احتياطية محفوظة حالياً في السحابة.");
      }

      alert("تم مسح جميع النسخ الاحتياطية بنجاح!\n\n" + msgs.join("\n"));
      if (statusEl) {
          const user = auth.currentUser;
          statusEl.innerText = user ? `تم تسجيل الدخول كـ: ${user.email}` : 'تم مسح النسخ الاحتياطية';
      }
  } catch (err) {
      console.error("Clear backups error:", err);
      alert("حدث خطأ أثناء مسح النسخ الاحتياطية: " + err.message);
      if (statusEl) statusEl.innerText = oldStatus;
  }
};

// Check for updates when user returns to tab after working on another device
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && auth.currentUser) {
    const elapsed = Date.now() - lastUpdateCheckTime;
    if (elapsed > 90000) { // If > 1.5 minutes since last check
      window.checkForDriveUpdates({ interactive: false });
    }
  }
});
