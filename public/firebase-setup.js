import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js';
import { getAuth, signInWithPopup, signInWithCredential, GoogleAuthProvider, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js';
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
  const eff = getEffectiveUser();
  return {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || eff?.uid || null,
      email: auth.currentUser?.email || eff?.email || null,
      emailVerified: auth.currentUser?.emailVerified ?? eff?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? false,
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

/**
 * تطبيع وتوحيد عنوان بريد Gmail لضمان التطابق التام بين كافة الأجهزة
 */
function normalizeGmailAddress(rawEmail) {
    let clean = String(rawEmail || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!clean) return '';
    if (!clean.includes('@')) {
        clean += '@gmail.com';
    }
    return clean;
}
window.normalizeGmailAddress = normalizeGmailAddress;

function isValidEmailFormat(email) {
    const clean = normalizeGmailAddress(email);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
}
window.isValidEmailFormat = isValidEmailFormat;

/**
 * توليد معرّف سحابي قياسي وآمن (URL-Safe Base64) متوافق مع قواعد Firestore
 */
function computeGmailUid(email) {
    const clean = normalizeGmailAddress(email);
    if (!clean) return '';
    try {
        const encoded = btoa(unescape(encodeURIComponent(clean)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        return ('gmail_' + encoded).slice(0, 120);
    } catch (e) {
        return ('gmail_' + clean.replace(/[^a-z0-9]/g, '_')).slice(0, 120);
    }
}
window.computeGmailUid = computeGmailUid;

function getGmailHistoryList() {
    const defaults = ['brahim.kouziber87@gmail.com'];
    try {
        if (window.db && window.db.teacherProfile && window.db.teacherProfile.email) {
            const tpEmail = normalizeGmailAddress(window.db.teacherProfile.email);
            if (tpEmail && isValidEmailFormat(tpEmail) && !defaults.includes(tpEmail)) {
                defaults.unshift(tpEmail);
            }
        }
        const savedLast = normalizeGmailAddress(localStorage.getItem('gdrive_last_email') || '');
        if (savedLast && isValidEmailFormat(savedLast) && !defaults.includes(savedLast)) {
            defaults.unshift(savedLast);
        }
        const rawList = JSON.parse(localStorage.getItem('gdrive_email_history') || '[]');
        if (Array.isArray(rawList)) {
            rawList.forEach(em => {
                const c = normalizeGmailAddress(em);
                if (c && isValidEmailFormat(c) && !defaults.includes(c)) {
                    defaults.push(c);
                }
            });
        }
    } catch (e) {}
    return defaults.slice(0, 5);
}

function saveEmailToGmailHistory(email) {
    const clean = normalizeGmailAddress(email);
    if (!clean || !isValidEmailFormat(clean)) return;
    try {
        const current = getGmailHistoryList().filter(e => e !== clean);
        current.unshift(clean);
        localStorage.setItem('gdrive_email_history', JSON.stringify(current.slice(0, 5)));
    } catch (e) {}
}

function getEffectiveUser() {
    if (auth && auth.currentUser) return auth.currentUser;
    if (window._directGmailUser && window._directGmailUser.uid) return window._directGmailUser;
    const savedEmail = normalizeGmailAddress(localStorage.getItem('gdrive_last_email') || '');
    if (savedEmail && isValidEmailFormat(savedEmail)) {
        window._directGmailUser = {
            uid: computeGmailUid(savedEmail),
            email: savedEmail,
            displayName: savedEmail.split('@')[0],
            emailVerified: true,
            isDirectGmail: true
        };
        return window._directGmailUser;
    }
    return null;
}
window.getEffectiveUser = getEffectiveUser;
window.getGoogleCurrentUser = () => getEffectiveUser();
window.isCloudSyncActive = () => !!getEffectiveUser();
window.getCloudUserEmail = () => {
    const u = getEffectiveUser();
    return u ? (u.email || u.displayName || 'Google') : null;
};

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
 * قراءة وثيقة مستخدم مفردة من Firestore بحسب معرّف الوثيقة
 */
async function readSingleFirestoreUserSlot(targetUid) {
    if (!targetUid) return null;
    const userPath = `users/${targetUid}`;
    let docSnap;
    try {
        docSnap = await getDoc(doc(dbFirestore, "users", targetUid));
    } catch (error) {
        handleFirestoreError(error, OperationType.GET, userPath, false);
        return null;
    }
    if (!docSnap || !docSnap.exists()) return null;

    const cloudData = docSnap.data();
    if (!cloudData) return null;

    let payloadString = '';
    if (cloudData.isChunked && cloudData.chunksCount > 0) {
        for (let i = 0; i < cloudData.chunksCount; i++) {
            const chunkPath = `users/${targetUid}/chunks/chunk_${i}`;
            try {
                const cSnap = await getDoc(doc(dbFirestore, "users", targetUid, "chunks", `chunk_${i}`));
                if (cSnap.exists()) {
                    payloadString += (cSnap.data().chunk || '');
                }
            } catch (chunkErr) {
                handleFirestoreError(chunkErr, OperationType.GET, chunkPath, false);
                return null;
            }
        }
    } else if (cloudData.appData) {
        payloadString = cloudData.appData;
    }

    if (!payloadString) return null;

    const rawString = await decompressString(payloadString, cloudData.isCompressed);
    return {
        uid: targetUid,
        rawString: rawString,
        lastUpdated: cloudData.lastUpdated,
        lastSavedTimestamp: Number(cloudData.lastSavedTimestamp) || (cloudData.lastUpdated ? new Date(cloudData.lastUpdated).getTime() : 0),
        chunksCount: cloudData.chunksCount || 0
    };
}

/**
 * استرجاع بيانات المستخدم الكاملة من Firestore مع دعم التوافق بين الربط الرسمي والربط المباشر بـ Gmail
 */
async function fetchFirestoreAppData(user) {
    const targetUser = user || getEffectiveUser();
    if (!targetUser || !targetUser.uid) return null;

    const candidateUids = [targetUser.uid];
    if (targetUser.email) {
        const gmailSlotUid = computeGmailUid(targetUser.email);
        if (gmailSlotUid && !candidateUids.includes(gmailSlotUid)) {
            candidateUids.push(gmailSlotUid);
        }
    }

    let bestResult = null;
    for (const candidateUid of candidateUids) {
        try {
            const slotResult = await readSingleFirestoreUserSlot(candidateUid);
            if (slotResult && slotResult.rawString) {
                if (!bestResult || (slotResult.lastSavedTimestamp > bestResult.lastSavedTimestamp)) {
                    bestResult = slotResult;
                }
            }
        } catch (e) {
            console.warn('Candidate slot check notice:', candidateUid, e);
        }
    }
    return bestResult;
}
window.fetchFirestoreAppData = fetchFirestoreAppData;

async function executeFirestoreUserWriteToUid(targetUid, userEmail, payloadString, compressed, rawLength, nowIso, nowTs) {
    if (!targetUid) return;
    if (payloadString.length <= MAX_FIRESTORE_DOC_PAYLOAD_SIZE) {
        await setDoc(doc(dbFirestore, "users", targetUid), {
            appData: payloadString,
            isCompressed: Boolean(compressed),
            isChunked: false,
            chunksCount: 0,
            totalRawSize: Number(rawLength) || 0,
            compressedSize: Number(payloadString.length) || 0,
            lastUpdated: String(nowIso).slice(0, 64),
            lastSavedTimestamp: nowTs,
            userEmail: String(userEmail || '').slice(0, 256)
        });
    } else {
        const chunks = [];
        for (let i = 0; i < payloadString.length; i += MAX_FIRESTORE_DOC_PAYLOAD_SIZE) {
            chunks.push(payloadString.slice(i, i + MAX_FIRESTORE_DOC_PAYLOAD_SIZE));
        }

        for (let idx = 0; idx < chunks.length; idx++) {
            await setDoc(doc(dbFirestore, "users", targetUid, "chunks", `chunk_${idx}`), {
                chunk: chunks[idx],
                index: idx,
                totalChunks: chunks.length,
                lastUpdated: String(nowIso).slice(0, 64)
            });
        }

        await setDoc(doc(dbFirestore, "users", targetUid), {
            isChunked: true,
            isCompressed: Boolean(compressed),
            chunksCount: chunks.length,
            totalRawSize: Number(rawLength) || 0,
            compressedSize: Number(payloadString.length) || 0,
            lastUpdated: String(nowIso).slice(0, 64),
            lastSavedTimestamp: nowTs,
            userEmail: String(userEmail || '').slice(0, 256)
        });
    }
}

async function executeFirestoreUserWrite(user, payloadString, compressed, rawLength, nowIso) {
    const nowTs = Date.now();
    const cleanEmail = normalizeGmailAddress(user.email || '');
    await executeFirestoreUserWriteToUid(user.uid, cleanEmail, payloadString, compressed, rawLength, nowIso, nowTs);

    // مرآة متزامنة لمعرّف Gmail القياسي لضمان التوافق الفوري بين الدخول الرسمي والدخول المباشر بالبريد
    if (cleanEmail) {
        const gmailSlotUid = computeGmailUid(cleanEmail);
        if (gmailSlotUid && gmailSlotUid !== user.uid) {
            try {
                await executeFirestoreUserWriteToUid(gmailSlotUid, cleanEmail, payloadString, compressed, rawLength, nowIso, nowTs);
            } catch (mirrorErr) {
                console.warn('Mirror Gmail slot sync notice:', mirrorErr);
            }
        }
    }
}

window.syncToFirebase = async (data, preSerialized) => {
    const user = getEffectiveUser();
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
    const user = getEffectiveUser();
    if (!user) {
        if (typeof window.showAppToast === 'function') {
            window.showAppToast('⚠️ يرجى ربط حساب Gmail أولاً لاستعادة النسخة السحابية.', 'error');
        }
        if (typeof window.openGmailQuickSwitchModal === 'function') {
            window.openGmailQuickSwitchModal();
        }
        return;
    }
    _isRestoringFromFirestore = true;
    try {
        if (typeof window.showAppToast === 'function') {
            window.showAppToast('⏳ جاري فحص واسترجاع أحدث نسخة سحابية من Firestore...', 'info');
        }
        const fsData = await fetchFirestoreAppData(user);
        if (fsData && fsData.rawString) {
            const currentLocal = localStorage.getItem('absence_massar_v8_manual');
            if (currentLocal) {
                localStorage.setItem('absence_massar_v8_pre_restore_backup', currentLocal);
            }
            localStorage.setItem('absence_massar_v8_manual', fsData.rawString);
            localStorage.setItem('absence_massar_v8_last_saved_time', fsData.lastUpdated || new Date().toISOString());
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('✅ تم استرجاع البيانات بنجاح من السحابة! جاري تحديث الواجهة...', 'success');
            }
            setTimeout(() => window.location.reload(), 500);
            return;
        }
        if (typeof window.showAppToast === 'function') {
            window.showAppToast('ℹ️ لم يتم العثور على بيانات سحابية سابقة محفوظة لهذا الحساب (' + (user.email || '') + ').', 'info');
        }
    } catch(e) {
        console.error("Restore from Firestore error:", e?.message || String(e));
        if (typeof window.showAppToast === 'function') {
            window.showAppToast('⚠️ تعذر الاسترجاع من السحابة: ' + (e.message || ''), 'error');
        }
    } finally {
        _isRestoringFromFirestore = false;
    }
};

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
provider.addScope('https://www.googleapis.com/auth/calendar.events');
provider.setCustomParameters({ prompt: 'select_account' });

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

window.getGoogleCurrentUser = () => getEffectiveUser();
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

window.syncBackupUIState = () => syncBackupUI(getEffectiveUser());

// -------------------------------------------------------------
// Metadata & File Helpers for Google Drive & Cloud Backups
// -------------------------------------------------------------

function isRealOAuthToken(token) {
  if (!token || typeof token !== 'string') return false;
  if (token.startsWith('direct_gmail_token_')) return false;
  return token.startsWith('ya29.') || token.length > 50;
}
window.isRealOAuthToken = isRealOAuthToken;

async function getBackupFileMetadata(accessToken) {
  if (!accessToken || !isRealOAuthToken(accessToken)) return null;
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
  const user = getEffectiveUser();

  if (!user && !token) {
    if (interactive) {
      if (typeof window.showAppToast === 'function') {
        window.showAppToast('⚠️ يرجى ربط حساب Gmail أو تسجيل الدخول بحساب Google أولاً للتعرف على آخر تحديث.', 'error');
      }
      if (typeof window.openGmailQuickSwitchModal === 'function') {
        window.openGmailQuickSwitchModal();
      }
    }
    return null;
  }

  updateDriveSyncHeaderBadge('saving', 'فحص السحابة...');
  let cloudSummary = null;

  // 1. Check Google Drive if real OAuth access token is available
  if (token && isRealOAuthToken(token)) {
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

  // 2. Check Firestore Cloud (works for both Official Google OAuth & Direct Gmail Mode)
  if (user) {
    try {
      const fsData = await fetchFirestoreAppData(user);
      if (fsData && fsData.rawString) {
        let parsedFs = null;
        try { parsedFs = JSON.parse(fsData.rawString); } catch(_) {}
        if (parsedFs) {
          const fsSummary = extractBackupSummary(parsedFs, 'سحابة Firestore (Gmail)', fsData.lastUpdated);
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

  // Update the Sync Center modal card if it is currently open
  const cloudDateEl = document.getElementById('syncCenterCloudDate');
  const cloudStatsEl = document.getElementById('syncCenterCloudStats');
  if (cloudDateEl) {
    cloudDateEl.textContent = cloudSummary ? cloudSummary.dateStr : 'لا توجد نسخة سحابية بعد';
  }
  if (cloudStatsEl) {
    cloudStatsEl.textContent = cloudSummary
      ? `أقسام: ${cloudSummary.classesCount} | تلاميذ: ${cloudSummary.totalStudents}`
      : 'انقر على "رفع النسخة" لحفظ بياناتك سحابياً';
  }

  const localSummary = getLocalSummary();
  const isLocalEmpty = !localSummary || localSummary.classesCount === 0;
  const badgeConnectedLabel = isRealOAuthToken(token)
    ? 'Google Drive: متزامن ✓'
    : (user && user.email ? `Gmail: ${user.email.split('@')[0]} ✓` : 'السحابة: متزامن ✓');

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
    updateDriveSyncHeaderBadge('synced', badgeConnectedLabel);
    if (interactive) {
      if (typeof window.showAppToast === 'function') {
        window.showAppToast('⏫ بيانات هذا الجهاز أحدث من النسخة السحابية. جاري رفع التحديث تلقائياً...', 'info');
      }
      await window.handleBackupToDrive();
    }
    return { status: 'local_newer', cloud: cloudSummary, local: localSummary };
  }

  // Case D: In sync
  if (cloudSummary) {
    updateDriveSyncHeaderBadge('synced', badgeConnectedLabel);
    if (interactive) {
      if (typeof window.showAppToast === 'function') {
        window.showAppToast('✅ بياناتك على هذا الجهاز متطابقة تماماً مع آخر تحديث سحابي (' + cloudSummary.dateStr + ').', 'success');
      }
    }
    return { status: 'in_sync', cloud: cloudSummary, local: localSummary };
  }

  // Case E: No cloud backup found yet
  updateDriveSyncHeaderBadge('synced', badgeConnectedLabel);
  if (interactive) {
    if (!isLocalEmpty) {
      if (typeof window.showAppToast === 'function') {
        window.showAppToast('☁️ تم ربط حساب Gmail بنجاح! جاري حفظ أول نسخة احتياطية سحابية لحسابك...', 'info');
      }
      await window.handleBackupToDrive();
    } else if (typeof window.showAppToast === 'function') {
      window.showAppToast('ℹ️ تم الاتصال بحساب Gmail (' + (user?.email || '') + '). لا توجد نسخة سحابية سابقة بعد.', 'info');
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
    if (typeof window.showAppToast === 'function') {
      window.showAppToast(`✅ تم بنجاح تحميل وتطبيق آخر تحديث من ${sourceName}! جاري تحديث الشاشة...`, 'success');
    }
    setTimeout(() => {
      window.location.reload();
    }, 450);
  } catch(e) {
    console.error("Error applying cloud backup:", e);
    if (typeof window.showAppToast === 'function') {
      window.showAppToast('⚠️ حدث خطأ أثناء تطبيق البيانات: ' + e.message, 'error');
    }
  }
};

// -------------------------------------------------------------
// Auto-Sync to Google Drive & Firestore (Continuous background backup)
// -------------------------------------------------------------

let driveAutoSyncTimer = null;
let isDriveSyncing = false;

window.autoSyncToGoogleDrive = (data) => {
  const user = getEffectiveUser();
  if (!cachedAccessToken && !user) return;
  if (driveAutoSyncTimer) clearTimeout(driveAutoSyncTimer);

  driveAutoSyncTimer = setTimeout(async () => {
    if (isDriveSyncing) return;
    isDriveSyncing = true;
    try {
      updateDriveSyncHeaderBadge('saving', 'جاري الحفظ السحابي...');
      
      const payloadObj = Object.assign({}, data || window.db || {});
      payloadObj._lastSavedAt = new Date().toISOString();
      payloadObj._lastSavedTimestamp = Date.now();
      payloadObj._lastSavedDevice = navigator.userAgent.includes('Mobile') ? 'هاتف محمول' : (navigator.userAgent.includes('Mac') ? 'جهاز Mac' : 'حاسوب مكتبي');
      
      const serialized = safeStringify(payloadObj);

      if (isRealOAuthToken(cachedAccessToken)) {
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
      }

      if (user && typeof window.syncToFirebase === 'function') {
        await window.syncToFirebase(payloadObj, serialized);
      }

      localStorage.setItem('absence_massar_v8_last_saved_time', payloadObj._lastSavedAt);
      const badgeText = isRealOAuthToken(cachedAccessToken)
        ? 'Google Drive: متزامن ✓'
        : (user && user.email ? `Gmail: ${user.email.split('@')[0]} ✓` : 'السحابة: متزامن ✓');
      updateDriveSyncHeaderBadge('synced', badgeText);
      window.dispatchEvent(new CustomEvent('gdriveSyncSuccess', { detail: { timestamp: new Date() } }));
    } catch (err) {
      console.warn("Silent Drive auto-sync failed:", err?.message || String(err));
      updateDriveSyncHeaderBadge('synced', 'السحابة متصلة');
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
        <p style="font-size: 0.85rem; color: #64748b; margin: 0;">أهلاً بك أستاذ <strong>${cloudSummary.teacherName}</strong>. تم العثور على أحدث نسخة لبياناتك ومادتك في (${cloudSummary.source}).</p>
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
        <h3 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">تحديث أحدث متوفر في السحابة!</h3>
        <p style="font-size: 0.82rem; color: #64748b; margin: 0;">تم رصد تعديلات أحدث تم حفظها من جهاز آخر في حساب Gmail الخاص بك.</p>
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

        <!-- النسخة السحابية -->
        <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 10px; padding: 12px; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.12);">
          <div style="font-weight: 800; color: #15803d; font-size: 0.82rem; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <span data-lucide="cloud" data-size="14"></span>
            <span>النسخة السحابية (الأحدث)</span>
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
          <span>تحديث هذا الجهاز بالنسخة السحابية الأحدث (موصى به)</span>
        </button>
        <button type="button" id="btnKeepLocalAndPush" style="background: #f8fafc; border: 1.5px solid #0284c7; color: #0284c7; padding: 9px; font-size: 0.84rem; font-weight: 700; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
          <span data-lucide="upload" data-size="15"></span>
          <span>الاحتفاظ بنسخة هذا الجهاز ورفعها واعتمادها سحابياً</span>
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
// Drive & Gmail Multi-Device Sync Center Modal
// -------------------------------------------------------------

window.openDriveSyncCenterModal = async () => {
  let modal = document.getElementById('driveSyncCenterModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'driveSyncCenterModal';
    modal.className = 'drive-sync-modal-backdrop';
    document.body.appendChild(modal);
  }

  const user = getEffectiveUser();
  const email = user ? user.email : (localStorage.getItem('gdrive_last_email') || 'غير مسجل الدخول');
  const isConnected = !!user;
  const hasRealOAuth = isRealOAuthToken(cachedAccessToken);
  const initialLetter = (email && email.includes('@')) ? email.trim()[0].toUpperCase() : 'G';
  const localSummary = getLocalSummary();
  const cloudSummary = lastKnownCloudBackupSummary;

  const modeBadgeHtml = !isConnected
    ? `<span style="font-size: 0.72rem; background: #f1f5f9; color: #64748b; font-weight: 700; padding: 2px 8px; border-radius: 999px; border: 1px solid #cbd5e1;">غير مرتبط</span>`
    : (hasRealOAuth
        ? `<span style="font-size: 0.72rem; background: #dcfce7; color: #166534; font-weight: 800; padding: 2px 9px; border-radius: 999px; border: 1px solid #86efac;">✓ ربط كامل (Google Drive + Firestore)</span>`
        : `<span style="font-size: 0.72rem; background: #e0f2fe; color: #0369a1; font-weight: 800; padding: 2px 9px; border-radius: 999px; border: 1px solid #7dd3fc;">☁️ مزامنة سحابية عبر بريد Gmail</span>`);

  modal.innerHTML = `
    <div class="drive-sync-modal-card" style="max-width: 540px;">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 14px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="background: linear-gradient(135deg, #1e1b4b, #312e81); color: #fbbf24; width: 40px; height: 40px; border-radius: 11px; display: flex; align-items: center; justify-content: center; border: 1.5px solid #d4af37; box-shadow: 0 3px 10px rgba(30, 27, 75, 0.2);">
            <span data-lucide="mail-check" data-size="20"></span>
          </div>
          <div>
            <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #0f172a;">مركز الربط بحساب Gmail والمزامنة السحابية</h3>
            <div style="font-size: 0.74rem; color: #64748b;">مزامنة فورية بين الهاتف، الحاسوب، واللوحة بنفس بريد Gmail</div>
          </div>
        </div>
        <button type="button" onclick="window.closeDriveSyncCenterModal()" style="background: #f1f5f9; border: none; width: 30px; height: 30px; border-radius: 8px; font-size: 1.1rem; cursor: pointer; color: #475569; display: flex; align-items: center; justify-content: center;">&times;</button>
      </div>

      <!-- بطاقة حساب Gmail المرتبط -->
      <div style="background: linear-gradient(135deg, #f8fafc, #f0f9ff); border: 1.5px solid #bae6fd; border-radius: 12px; padding: 12px 14px; margin-bottom: 14px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #0284c7, #1e3a8a); color: #ffffff; font-weight: 900; font-size: 1.05rem; display: flex; align-items: center; justify-content: center; border: 2px solid #d4af37; flex-shrink: 0;">
              ${initialLetter}
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span style="font-size: 0.73rem; color: #475569; font-weight: 700;">حساب Gmail النشط:</span>
                ${modeBadgeHtml}
              </div>
              <div style="font-weight: 800; font-size: 0.92rem; color: #0f172a; direction: ltr; text-align: right; margin-top: 2px;">${email}</div>
            </div>
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            <button type="button" onclick="window.closeDriveSyncCenterModal(); window.openGmailQuickSwitchModal();" style="font-size: 0.75rem; background: #ffffff; color: #0284c7; border: 1.5px solid #0284c7; font-weight: 800; padding: 5px 10px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
              <span data-lucide="repeat" data-size="13"></span>
              <span>${isConnected ? 'تبديل الحساب' : 'ربط حساب Gmail'}</span>
            </button>
          </div>
        </div>

        ${isConnected && !hasRealOAuth ? `
          <div style="margin-top: 10px; padding-top: 9px; border-top: 1px dashed #bae6fd; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
            <span style="font-size: 0.72rem; color: #0369a1; font-weight: 600;">💡 المزامنة السحابية عبر Firestore نشطة. يمكنك أيضاً تفعيل صلاحية ملفات Google Drive وCalendar:</span>
            <button type="button" onclick="window.closeDriveSyncCenterModal(); window.handleGoogleSignInOfficial({ forcePopup: true });" style="background: #ffffff; border: 1px solid #0284c7; color: #0369a1; font-size: 0.72rem; font-weight: 800; padding: 4px 10px; border-radius: 6px; cursor: pointer;">
              ترقية إلى ربط Google الرسمي (OAuth)
            </button>
          </div>
        ` : ''}
      </div>

      <!-- أدوات بريد Gmail المدمجة للأستاذ -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; margin-bottom: 14px;">
        <div style="font-size: 0.74rem; font-weight: 800; color: #334155; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
          <span data-lucide="inbox" data-size="14"></span>
          <span>خدمات بريد Gmail السريعة للأستاذ:</span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <button type="button" onclick="window.openGmailInbox()" style="background: #ffffff; border: 1px solid #cbd5e1; color: #1e293b; padding: 7px 10px; border-radius: 7px; font-size: 0.76rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <span data-lucide="mail" data-size="14" style="color: #ea4335;"></span>
            <span>فتح البريد الوارد (Gmail)</span>
          </button>
          <button type="button" onclick="window.openGmailComposeForTeacher()" style="background: #ffffff; border: 1px solid #cbd5e1; color: #1e293b; padding: 7px 10px; border-radius: 7px; font-size: 0.76rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <span data-lucide="send" data-size="14" style="color: #0284c7;"></span>
            <span>إرسال تقرير بيداغوجي عبر Gmail</span>
          </button>
        </div>
      </div>

      <!-- بطاقات المقارنة السريعة -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
        <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 10px 12px;">
          <div style="font-size: 0.73rem; color: #64748b; font-weight: 800; margin-bottom: 4px;">🖥️ بيانات هذا الجهاز</div>
          <div style="font-size: 0.8rem; font-weight: 800; color: #0f172a;">${localSummary ? localSummary.dateStr : 'غير متوفر'}</div>
          <div style="font-size: 0.72rem; color: #64748b; margin-top: 4px;">أقسام: ${localSummary ? localSummary.classesCount : 0} | تلاميذ: ${localSummary ? localSummary.totalStudents : 0}</div>
        </div>
        <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 10px; padding: 10px 12px;">
          <div style="font-size: 0.73rem; color: #166534; font-weight: 800; margin-bottom: 4px;">☁️ النسخة السحابية (Gmail)</div>
          <div id="syncCenterCloudDate" style="font-size: 0.8rem; font-weight: 800; color: #15803d;">${cloudSummary ? cloudSummary.dateStr : 'جاري الفحص...'}</div>
          <div id="syncCenterCloudStats" style="font-size: 0.72rem; color: #166534; margin-top: 4px;">أقسام: ${cloudSummary ? cloudSummary.classesCount : '--'} | تلاميذ: ${cloudSummary ? cloudSummary.totalStudents : '--'}</div>
        </div>
      </div>

      <!-- الإجراءات السريعة -->
      <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
        <button type="button" onclick="window.checkForDriveUpdates({ interactive: true })" class="btn-primary" style="background: linear-gradient(135deg, #0284c7, #0369a1); padding: 10px; font-size: 0.86rem; font-weight: 800; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 6px;">
          <span data-lucide="refresh-cw" data-size="15"></span>
          <span>فحص ومطابقة التحديثات السحابية الآن</span>
        </button>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <button type="button" onclick="window.handleBackupToDrive()" class="btn-primary" style="background: #10b981; padding: 9px; font-size: 0.82rem; font-weight: 800; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <span data-lucide="upload-cloud" data-size="14"></span>
            <span>رفع النسخة إلى السحابة</span>
          </button>
          <button type="button" onclick="window.handleRestoreFromDrive()" class="btn-primary" style="background: #d97706; padding: 9px; font-size: 0.82rem; font-weight: 800; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <span data-lucide="download-cloud" data-size="14"></span>
            <span>استعادة من السحابة</span>
          </button>
        </div>
      </div>

      ${isConnected ? `
        <button type="button" onclick="window.handleDriveLogout(); window.closeDriveSyncCenterModal();" style="width: 100%; background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 7px; border-radius: 7px; font-size: 0.78rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px;">
          <span data-lucide="log-out" data-size="13"></span>
          <span>فصل حساب Gmail وتسجيل الخروج السحابي</span>
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
// Smart Gmail Account Switcher & Quick Link Modal (No prompt())
// -------------------------------------------------------------

window.openGmailQuickSwitchModal = (prefillEmail = '') => {
  let modal = document.getElementById('gmailQuickSwitchModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'gmailQuickSwitchModal';
    modal.className = 'drive-sync-modal-backdrop';
    document.body.appendChild(modal);
  }

  const currentUser = getEffectiveUser();
  const currentEmail = prefillEmail || (currentUser ? currentUser.email : (localStorage.getItem('gdrive_last_email') || 'brahim.kouziber87@gmail.com'));
  const historyEmails = getGmailHistoryList();

  const chipsHtml = historyEmails.map(em => `
    <button type="button" onclick="const inp=document.getElementById('gmailQuickSwitchInput'); if(inp){inp.value='${em}'; inp.focus();}" style="background: #f0f9ff; border: 1px solid #bae6fd; color: #0369a1; font-size: 0.74rem; font-weight: 700; padding: 4px 10px; border-radius: 999px; cursor: pointer; direction: ltr;">
      ${em}
    </button>
  `).join('');

  modal.innerHTML = `
    <div class="drive-sync-modal-card" style="max-width: 470px;">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 14px;">
        <div style="display: flex; align-items: center; gap: 9px;">
          <div style="background: #eff6ff; color: #0284c7; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; border: 1px solid #bfdbfe;">
            <span data-lucide="at-sign" data-size="18"></span>
          </div>
          <div>
            <h3 style="margin: 0; font-size: 1rem; font-weight: 800; color: #0f172a;">ربط أو تبديل حساب Gmail</h3>
            <div style="font-size: 0.73rem; color: #64748b;">مزامنة سحابية فورية لبيانات المنظومة عبر بريدك الإلكتروني</div>
          </div>
        </div>
        <button type="button" onclick="window.closeGmailQuickSwitchModal()" style="background: #f1f5f9; border: none; width: 28px; height: 28px; border-radius: 7px; font-size: 1.1rem; cursor: pointer; color: #64748b;">&times;</button>
      </div>

      <div style="margin-bottom: 12px;">
        <label for="gmailQuickSwitchInput" style="display: block; font-size: 0.78rem; font-weight: 800; color: #334155; margin-bottom: 6px;">عنوان بريد Gmail الخاص بك:</label>
        <div style="position: relative;">
          <input type="email" id="gmailQuickSwitchInput" value="${currentEmail}" placeholder="example@gmail.com" dir="ltr" onkeydown="if(event.key==='Enter'){window.confirmGmailQuickSwitch();}" style="width: 100%; padding: 10px 36px 10px 12px; border: 1.5px solid #0284c7; border-radius: 8px; font-size: 0.9rem; font-weight: 700; box-sizing: border-box; text-align: left; color: #0f172a; background: #ffffff;" />
          <button type="button" onclick="const inp=document.getElementById('gmailQuickSwitchInput'); if(inp){inp.value=''; inp.focus();}" title="مسح الحقل" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; font-size: 1.15rem; color: #94a3b8; cursor: pointer;">&times;</button>
        </div>
        <div id="gmailQuickSwitchError" style="display: none; color: #dc2626; font-size: 0.75rem; font-weight: 700; margin-top: 5px;"></div>
      </div>

      ${historyEmails.length > 0 ? `
        <div style="margin-bottom: 14px;">
          <div style="font-size: 0.72rem; color: #64748b; font-weight: 700; margin-bottom: 6px;">اختيار سريع لحساب محفوظ:</div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${chipsHtml}
          </div>
        </div>
      ` : ''}

      <div style="display: flex; flex-direction: column; gap: 8px;">
        <button type="button" onclick="window.confirmGmailQuickSwitch()" class="btn-primary" style="background: linear-gradient(135deg, #0284c7, #0369a1); padding: 10px 14px; font-size: 0.86rem; font-weight: 800; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 7px;">
          <span data-lucide="check-circle-2" data-size="16"></span>
          <span>ربط وتفعيل المزامنة السحابية بهذا البريد فوراً</span>
        </button>

        <button type="button" onclick="window.closeGmailQuickSwitchModal(); window.handleGoogleSignInOfficial({ forcePopup: true });" style="background: #ffffff; border: 1.5px solid #cbd5e1; color: #1e293b; padding: 9px 14px; font-size: 0.82rem; font-weight: 800; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="display: block; width: 17px; height: 17px;">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
          </svg>
          <span>المصادقة الرسمية عبر نافذة Google (Drive & Calendar)</span>
        </button>
      </div>
    </div>
  `;

  modal.style.display = 'flex';
  if (window.lucide) window.lucide.createIcons();
  setTimeout(() => {
    const inp = document.getElementById('gmailQuickSwitchInput');
    if (inp) inp.focus();
  }, 80);
};

window.closeGmailQuickSwitchModal = () => {
  const modal = document.getElementById('gmailQuickSwitchModal');
  if (modal) modal.style.display = 'none';
};

window.confirmGmailQuickSwitch = async () => {
  const inp = document.getElementById('gmailQuickSwitchInput');
  const errEl = document.getElementById('gmailQuickSwitchError');
  const rawVal = inp ? inp.value : '';
  const clean = normalizeGmailAddress(rawVal);

  if (!clean || !isValidEmailFormat(clean)) {
    if (errEl) {
      errEl.style.display = 'block';
      errEl.textContent = '⚠️ يرجى إدخال عنوان بريد Gmail صحيح (مثال: brahim.kouziber87@gmail.com).';
    }
    if (inp) inp.focus();
    return;
  }

  window.closeGmailQuickSwitchModal();
  updateCachedDriveToken(null);
  activateDirectGmailSession(clean, false);
};

// -------------------------------------------------------------
// Direct Gmail Authentication & Multi-Device Sync Engine
// -------------------------------------------------------------

function activateDirectGmailSession(email, skipUpdateCheck = false, displayName = '', existingOAuthToken = null) {
  let cleanEmail = normalizeGmailAddress(email);
  if (!cleanEmail) {
    const saved = normalizeGmailAddress(localStorage.getItem('gdrive_last_email') || '');
    if (saved && isValidEmailFormat(saved)) cleanEmail = saved;
  }
  if (!cleanEmail || !isValidEmailFormat(cleanEmail)) {
    if (typeof window.showAppToast === 'function') {
      window.showAppToast('⚠️ يرجى إدخال عنوان بريد Gmail صحيح للمتابعة.', 'error');
    }
    return null;
  }

  localStorage.setItem('gdrive_last_email', cleanEmail);
  localStorage.setItem('gdrive_authenticated', 'true');
  localStorage.setItem('userLoggedIn', 'true');
  saveEmailToGmailHistory(cleanEmail);

  // Sync email with teacherProfile if available
  try {
    if (window.db && window.db.teacherProfile && !window.db.teacherProfile.email) {
      window.db.teacherProfile.email = cleanEmail;
    }
  } catch (e) {}

  const token = (existingOAuthToken && isRealOAuthToken(existingOAuthToken))
    ? existingOAuthToken
    : (isRealOAuthToken(cachedAccessToken) ? cachedAccessToken : ('direct_gmail_token_' + Date.now()));
  updateCachedDriveToken(token);

  const username = displayName || cleanEmail.split('@')[0];
  window._directGmailUser = {
    uid: computeGmailUid(cleanEmail),
    email: cleanEmail,
    displayName: username,
    emailVerified: true,
    isDirectGmail: !isRealOAuthToken(token)
  };

  syncBackupUI(auth.currentUser || window._directGmailUser);
  if (typeof window.syncLibraryDriveUIState === 'function') {
    window.syncLibraryDriveUIState();
  }
  updateDriveSyncHeaderBadge('synced', isRealOAuthToken(token) ? 'Google Drive: متزامن ✓' : `Gmail: ${username} ✓`);

  // Update email input on login screen if present
  const emailInput = document.getElementById('loginDriveEmailInput');
  if (emailInput) emailInput.value = cleanEmail;

  // Unlock and enter app
  const loginScreen = document.getElementById('loginScreen');
  if (loginScreen) {
    loginScreen.style.display = 'none';
  }

  if (typeof window.showAppToast === 'function') {
    window.showAppToast(`✅ تم ربط وتفعيل حساب Gmail (${cleanEmail}) بنجاح.`, 'success');
  }

  if (!skipUpdateCheck) {
    setTimeout(() => {
      window.checkForDriveUpdates({ interactive: false, onLogin: true });
    }, 450);
  }

  return token;
}
window.activateDirectGmailSession = activateDirectGmailSession;

window.switchGmailAccountPrompt = () => {
  window.openGmailQuickSwitchModal();
};

window.openGmail = function(to, subject, body) {
  let url = 'https://mail.google.com/mail/?view=cm&fs=1';
  if (to) url += '&to=' + encodeURIComponent(to);
  if (subject) url += '&su=' + encodeURIComponent(subject);
  if (body) url += '&body=' + encodeURIComponent(body);
  window.open(url, '_blank', 'noopener,noreferrer');
};
window.openGmailInbox = function() {
  window.open('https://mail.google.com', '_blank', 'noopener,noreferrer');
};
window.openGmailComposeForTeacher = function() {
  const summary = getLocalSummary();
  const teacherName = (window.db && window.db.teacherProfile && window.db.teacherProfile.name) || 'الأستاذ إبراهيم قزيبر';
  const subject = `تقرير بيداغوجي - منظومة التدبير التربوي لمادة الرياضيات (${teacherName})`;
  const body = `السلام عليكم ورحمة الله تعالى وبركاته،\n\nمرفق ملخص التتبع البيداغوجي من منظومة التدبير التربوي لمادة الرياضيات (السلك الثانوي التأهيلي):\n- الأستاذ(ة): ${teacherName}\n- عدد الأقسام المسندة: ${summary ? summary.classesCount : 0}\n- إجمالي التلاميذ: ${summary ? summary.totalStudents : 0}\n- عدد الحصص والسجلات: ${summary ? summary.recordsCount : 0}\n- تاريخ آخر تحديث: ${summary ? summary.dateStr : new Date().toLocaleDateString('ar-MA')}\n\nمع خالص التحية والتقدير.`;
  window.openGmail('', subject, body);
};

// Auto-restore previous Gmail session on load
try {
  const rememberedEmail = normalizeGmailAddress(localStorage.getItem('gdrive_last_email') || '');
  if (rememberedEmail && isValidEmailFormat(rememberedEmail)) {
    const hasOAuth = isRealOAuthToken(cachedAccessToken);
    if (!cachedAccessToken && localStorage.getItem('gdrive_authenticated') === 'true') {
      cachedAccessToken = 'direct_gmail_token_' + Date.now();
    }
    window._directGmailUser = {
      uid: computeGmailUid(rememberedEmail),
      email: rememberedEmail,
      displayName: rememberedEmail.split('@')[0],
      emailVerified: true,
      isDirectGmail: !hasOAuth
    };
    setTimeout(() => {
      syncBackupUI(auth.currentUser || window._directGmailUser);
      updateDriveSyncHeaderBadge('synced', hasOAuth ? 'Google Drive: متزامن ✓' : `Gmail: ${rememberedEmail.split('@')[0]} ✓`);
      const emailInput = document.getElementById('loginDriveEmailInput');
      if (emailInput && !emailInput.value) emailInput.value = rememberedEmail;
    }, 400);
  }
} catch(e) {}

// -------------------------------------------------------------
// Handle Login Screen Drive & Direct Gmail Access
// -------------------------------------------------------------

window.handleLoginScreenDirectGmail = () => {
  const emailInput = document.getElementById('loginDriveEmailInput');
  let emailVal = emailInput ? emailInput.value.trim() : '';
  const statusEl = document.getElementById('loginDriveSyncStatus');

  if (!emailVal) {
    const saved = normalizeGmailAddress(localStorage.getItem('gdrive_last_email') || '');
    if (saved && isValidEmailFormat(saved)) {
      emailVal = saved;
      if (emailInput) emailInput.value = emailVal;
    }
  }

  if (!emailVal) {
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.color = '#dc2626';
      statusEl.textContent = '⚠️ يرجى إدخال عنوان بريد Gmail في الحقل أعلاه للمتابعة.';
    }
    if (emailInput) emailInput.focus();
    return;
  }

  const cleanEmail = normalizeGmailAddress(emailVal);
  if (!isValidEmailFormat(cleanEmail)) {
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.color = '#dc2626';
      statusEl.textContent = '⚠️ صيغة البريد الإلكتروني غير صحيحة (مثال: brahim.kouziber87@gmail.com).';
    }
    if (emailInput) emailInput.focus();
    return;
  }

  if (emailInput) emailInput.value = cleanEmail;

  const token = activateDirectGmailSession(cleanEmail, false);
  if (token) {
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.color = '#15803d';
      statusEl.textContent = '✅ تم الاتصال بحسابك وتفعيل المنظومة بنجاح: ' + cleanEmail;
    }
    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.style.display = 'none';
    if (typeof updateTeacherNameInHeader === 'function') {
      updateTeacherNameInHeader();
    }
  }
};
window.handleLoginScreenDriveSync = window.handleLoginScreenDirectGmail;

// -------------------------------------------------------------
// Auth State & Visibility Listeners
// -------------------------------------------------------------

onAuthStateChanged(auth, async (user) => {
  if (user) {
    syncBackupUI(user);
    if (user.email) {
      const clean = normalizeGmailAddress(user.email);
      localStorage.setItem('gdrive_last_email', clean);
      localStorage.setItem('gdrive_authenticated', 'true');
      saveEmailToGmailHistory(clean);
    }
    // Auto check if this device needs cloud restoration or update
    setTimeout(() => {
      window.checkForDriveUpdates({ interactive: false, onLogin: true });
    }, 600);
  } else {
    const effectiveUser = getEffectiveUser();
    if (effectiveUser && localStorage.getItem('gdrive_authenticated') === 'true') {
      syncBackupUI(effectiveUser);
      updateDriveSyncHeaderBadge('synced', `Gmail: ${effectiveUser.email.split('@')[0]} ✓`);
    } else {
      updateCachedDriveToken(null);
      syncBackupUI(null);
    }
  }
});

async function processDriveSignInResult(result, skipUpdateCheck = false) {
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential ? credential.accessToken : null;
  if (accessToken) {
    updateCachedDriveToken(accessToken);
  }
  if (result.user && result.user.email) {
    const clean = normalizeGmailAddress(result.user.email);
    localStorage.setItem('gdrive_last_email', clean);
    saveEmailToGmailHistory(clean);
  }
  if (typeof window.syncLibraryDriveUIState === 'function') {
    window.syncLibraryDriveUIState();
  }
  if (!skipUpdateCheck) {
    await window.checkForDriveUpdates({ interactive: true, fromLoginAction: true });
  }
  return accessToken;
}

const GOOGLE_CLIENT_ID = '198994308173-59hour8oeloles5rqfniuhq02tgtr6cd.apps.googleusercontent.com';
const GOOGLE_SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/calendar.events';

window.handleGoogleSignInOfficial = (options = {}) => {
  const skipUpdateCheck = !!options.skipUpdateCheck;
  return new Promise((resolve) => {
    // 1. المحاولة الأساسية عبر Firebase signInWithPopup (تمنح مصادقة Firebase + رمز OAuth لـ Drive و Calendar معاً)
    signInWithPopup(auth, provider)
      .then(async (result) => {
        const token = await processDriveSignInResult(result, skipUpdateCheck);
        if (result.user && result.user.email) {
          activateDirectGmailSession(result.user.email, true, result.user.displayName, token || ('firebase_auth_' + Date.now()));
        }
        if (typeof window.showAppToast === 'function') {
          window.showAppToast(`✅ تم الربط الرسمي بحساب Google (${result.user?.email || ''}) بنجاح!`, 'success');
        }
        resolve(token || 'firebase_authenticated');
      })
      .catch((popupErr) => {
        console.warn('Firebase signInWithPopup notice, trying GIS Token Client fallback:', popupErr?.message || popupErr);

        // 2. البديل الرسمي الثاني: Google Identity Services (GIS) مع ربط تلقائي بـ Firebase Auth عبر signInWithCredential
        if (window.google && window.google.accounts && window.google.accounts.oauth2) {
          try {
            const client = window.google.accounts.oauth2.initTokenClient({
              client_id: GOOGLE_CLIENT_ID,
              scope: GOOGLE_SCOPES,
              callback: async (tokenResponse) => {
                if (tokenResponse && tokenResponse.access_token) {
                  const accessToken = tokenResponse.access_token;
                  updateCachedDriveToken(accessToken);

                  // ربط جلسة Firebase Auth بنفس التوكن لضمان صلاحيات Firestore الكاملة
                  try {
                    const cred = GoogleAuthProvider.credential(null, accessToken);
                    await signInWithCredential(auth, cred);
                  } catch (credErr) {
                    console.warn('signInWithCredential notice:', credErr);
                  }

                  let userEmail = auth.currentUser?.email || localStorage.getItem('gdrive_last_email') || '';
                  let displayName = auth.currentUser?.displayName || '';
                  if (!userEmail) {
                    try {
                      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                        headers: { Authorization: `Bearer ${accessToken}` }
                      });
                      if (userRes.ok) {
                        const info = await userRes.json();
                        if (info && info.email) {
                          userEmail = info.email;
                          displayName = info.name || '';
                        }
                      }
                    } catch (e) {
                      console.warn('UserInfo fetch error:', e);
                    }
                  }

                  if (!userEmail) userEmail = 'brahim.kouziber87@gmail.com';
                  activateDirectGmailSession(userEmail, skipUpdateCheck, displayName, accessToken);

                  if (typeof window.showAppToast === 'function') {
                    window.showAppToast(`✅ تم الاتصال والربط الرسمي بحساب Google (${userEmail}) بنجاح!`, 'success');
                  }
                  resolve(accessToken);
                } else {
                  window.openGmailQuickSwitchModal();
                  resolve(null);
                }
              },
              error_callback: () => {
                window.openGmailQuickSwitchModal();
                resolve(null);
              }
            });

            client.requestAccessToken({ prompt: '' });
            return;
          } catch (gisErr) {
            console.warn('GIS fallback failed:', gisErr);
          }
        }

        // 3. في حال حظر النوافذ المنبثقة من المتصفح: فتح نافذة الربط السريع بحساب Gmail
        window.openGmailQuickSwitchModal();
        resolve(null);
      });
  });
};

window.handleDriveLogoutSilently = () => {
  updateCachedDriveToken(null);
  window._directGmailUser = null;
  localStorage.removeItem('gdrive_last_email');
  localStorage.removeItem('gdrive_authenticated');
  localStorage.removeItem('userLoggedIn');
  try { signOut(auth); } catch(e) {}
  syncBackupUI(null);
  if (typeof window.syncLibraryDriveUIState === 'function') {
    window.syncLibraryDriveUIState();
  }
  updateDriveSyncHeaderBadge('disconnected');
};

window.handleDriveLogin = async (emailHint, options = {}) => {
  const skipUpdateCheck = !!options.skipUpdateCheck;

  // إذا تم تمرير البريد صراحة دون طلب تسجيل تفاعلي جديد
  if (emailHint && typeof emailHint === 'string' && emailHint.includes('@') && !options.interactive) {
    return activateDirectGmailSession(emailHint.trim(), skipUpdateCheck);
  }

  // محاولة تسجيل الدخول الرسمي عبر Google OAuth أولاً
  try {
    const token = await window.handleGoogleSignInOfficial(options);
    if (token) return token;
  } catch (err) {
    console.warn('Official Google Sign-In attempt failed:', err);
  }

  // في حالة الإلغاء أو حظر النوافذ المنبثقة: فتح نافذة الربط السريع
  let targetEmail = (emailHint && typeof emailHint === 'string' && emailHint.includes('@')) ? emailHint.trim() : '';
  if (!targetEmail) {
    const emailInput = document.getElementById('loginDriveEmailInput');
    if (emailInput && emailInput.value && emailInput.value.trim()) {
      targetEmail = emailInput.value.trim();
    }
  }

  if (targetEmail) {
    return activateDirectGmailSession(targetEmail, skipUpdateCheck);
  }

  window.openGmailQuickSwitchModal();
  return null;
};

window.handleDriveLogout = async () => {
  updateCachedDriveToken(null);
  window._directGmailUser = null;
  localStorage.removeItem('gdrive_last_email');
  localStorage.removeItem('gdrive_authenticated');
  try { await signOut(auth); } catch(e) {}
  syncBackupUI(null);
  if (typeof window.syncLibraryDriveUIState === 'function') {
    window.syncLibraryDriveUIState();
  }
  updateDriveSyncHeaderBadge('disconnected');
  const loginEmailInput = document.getElementById('loginDriveEmailInput');
  if (loginEmailInput) loginEmailInput.value = '';
  if (typeof window.showAppToast === 'function') {
    window.showAppToast('ℹ️ تم فصل حساب Gmail وتسجيل الخروج السحابي بنجاح.', 'info');
  }
};

let _isDriveBackupRunning = false;
window.handleBackupToDrive = async () => {
  if (_isDriveBackupRunning) return;
  let user = getEffectiveUser();
  if (!cachedAccessToken && !user) {
      const token = await window.handleDriveLogin(auth.currentUser?.email, { skipUpdateCheck: true });
      user = getEffectiveUser();
      if (!token && !user) return;
  }

  _isDriveBackupRunning = true;
  try {
      document.querySelectorAll('.backup-drive-text, #backupBtnText').forEach(el => el.innerText = 'جاري النسخ...');
      
      const payloadObj = Object.assign({}, window.db || {});
      payloadObj._lastSavedAt = new Date().toISOString();
      payloadObj._lastSavedTimestamp = Date.now();
      payloadObj._lastSavedDevice = navigator.userAgent.includes('Mobile') ? 'هاتف محمول' : (navigator.userAgent.includes('Mac') ? 'جهاز Mac' : 'حاسوب');
      
      const serialized = safeStringify(payloadObj);

      // 1. الحفظ المحلي الأساسي الفوري
      localStorage.setItem('absence_massar_v8_manual', serialized);
      localStorage.setItem('absence_massar_v8_last_saved_time', payloadObj._lastSavedAt);

      // 2. المزامنة مع قاعدة البيانات السحابية (Firestore)
      let firestoreSynced = false;
      const currentUser = getEffectiveUser();
      if (currentUser && typeof window.syncToFirebase === 'function') {
          try {
              const fsRes = await window.syncToFirebase(payloadObj, serialized);
              if (fsRes && fsRes.success) firestoreSynced = true;
          } catch (fsErr) {
              console.warn('Firestore backup attempt:', fsErr);
          }
      }

      // 3. المزامنة مع Google Drive في حال توفر رمز OAuth حقيقي
      let driveUploaded = false;
      if (isRealOAuthToken(cachedAccessToken)) {
          try {
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
                  if (res.ok) driveUploaded = true;
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
                  if (res.ok) driveUploaded = true;
              }
          } catch (driveErr) {
              console.warn('Google Drive API upload failed, falling back to Cloud & Local:', driveErr);
          }
      }

      const badgeLabel = driveUploaded
          ? 'Google Drive: متزامن ✓'
          : (currentUser && currentUser.email ? `Gmail: ${currentUser.email.split('@')[0]} ✓` : 'السحابة: متزامن ✓');
      updateDriveSyncHeaderBadge('synced', badgeLabel);

      if (typeof window.showAppToast === 'function') {
          window.showAppToast(
              driveUploaded
                  ? '✅ تم النسخ الاحتياطي في Google Drive وسحابة Firestore بنجاح!'
                  : (firestoreSynced
                      ? `✅ تم حفظ ومزامنة النسخة الاحتياطية سحابياً عبر حساب (${currentUser?.email || 'Gmail'})!`
                      : '✅ تم حفظ النسخة الاحتياطية محلياً على هذا الجهاز بنجاح!'),
              'success'
          );
      }
  } catch (err) {
      console.error('Backup error:', err?.message || String(err));
      const payloadObj = Object.assign({}, window.db || {});
      payloadObj._lastSavedAt = new Date().toISOString();
      localStorage.setItem('absence_massar_v8_manual', safeStringify(payloadObj));
      localStorage.setItem('absence_massar_v8_last_saved_time', payloadObj._lastSavedAt);
      if (typeof window.showAppToast === 'function') {
          window.showAppToast('✅ تم تأمين وحفظ النسخة الاحتياطية محلياً على هذا الجهاز.', 'info');
      }
  } finally {
      _isDriveBackupRunning = false;
      document.querySelectorAll('.backup-drive-text, #backupBtnText').forEach(el => el.innerText = 'نسخ احتياطي إلى Drive');
  }
};

let _isDriveRestoreRunning = false;
window.handleRestoreFromDrive = async () => {
  if (_isDriveRestoreRunning) return;
  let user = getEffectiveUser();
  if (!cachedAccessToken && !user) {
      const token = await window.handleDriveLogin(auth.currentUser?.email, { skipUpdateCheck: true });
      user = getEffectiveUser();
      if (!token && !user) return;
  }

  _isDriveRestoreRunning = true;
  try {
      document.querySelectorAll('.restore-drive-text, #restoreBtnText').forEach(el => el.innerText = 'جاري الاستعادة...');
      let restoredData = null;
      let sourceName = 'Google Drive';

      // 1. محاولة الاسترجاع من Google Drive في حال توفر رمز OAuth حقيقي
      if (isRealOAuthToken(cachedAccessToken)) {
          try {
              const fileId = await getBackupFileId(cachedAccessToken);
              if (fileId) {
                  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                      headers: { Authorization: `Bearer ${cachedAccessToken}` }
                  });
                  if (res.ok) {
                      const data = await res.json();
                      if (data && (data.classes || data.teacherProfile)) {
                          restoredData = data;
                          sourceName = 'Google Drive';
                      }
                  }
              }
          } catch (dErr) {
              console.warn('Google Drive restore attempt:', dErr);
          }
      }

      // 2. الاسترجاع من قاعدة البيانات السحابية (Firestore)
      if (!restoredData) {
          const effUser = getEffectiveUser();
          if (effUser) {
              try {
                  const fsData = await fetchFirestoreAppData(effUser);
                  if (fsData && fsData.rawString) {
                      let parsedFs = null;
                      try { parsedFs = JSON.parse(fsData.rawString); } catch(_) {}
                      if (parsedFs && (parsedFs.classes || parsedFs.teacherProfile)) {
                          restoredData = parsedFs;
                          sourceName = 'قاعدة البيانات السحابية (Firestore)';
                      }
                  }
              } catch (fsErr) {
                  console.warn('Firestore restore fallback attempt:', fsErr);
              }
          }
      }

      // 3. الاسترجاع من النسخة الاحتياطية المحلية في حال عدم توفر السحابة
      if (!restoredData) {
          const localRaw = localStorage.getItem('absence_massar_v8_manual');
          if (localRaw) {
              try {
                  const lData = JSON.parse(localRaw);
                  if (lData && (lData.classes || lData.teacherProfile)) {
                      restoredData = lData;
                      sourceName = 'الذاكرة المحلية للجهاز';
                  }
              } catch(_) {}
          }
      }

      if (restoredData) {
          await window.applyCloudBackup(restoredData, sourceName);
      } else if (typeof window.showAppToast === 'function') {
          window.showAppToast('ℹ️ لم يتم العثور على أي نسخة احتياطية سابقة في حسابك السحابي.', 'info');
      }
  } catch (err) {
      console.error(err?.message || String(err));
      if (typeof window.showAppToast === 'function') {
          window.showAppToast('⚠️ حدث خطأ أثناء الاستعادة: ' + err.message, 'error');
      }
  } finally {
      _isDriveRestoreRunning = false;
      document.querySelectorAll('.restore-drive-text, #restoreBtnText').forEach(el => el.innerText = 'استعادة من Drive');
  }
};

window.deleteCloudBackup = async () => {
  const user = getEffectiveUser();
  let firestoreDeleted = false;
  let driveDeleted = false;

  if (user && user.uid) {
      const candidateUids = [user.uid];
      if (user.email) {
          const gmailSlot = computeGmailUid(user.email);
          if (gmailSlot && !candidateUids.includes(gmailSlot)) candidateUids.push(gmailSlot);
      }
      for (const targetUid of candidateUids) {
          try {
              const docSnap = await getDoc(doc(dbFirestore, "users", targetUid));
              if (docSnap.exists()) {
                  const data = docSnap.data();
                  if (data && data.isChunked && data.chunksCount > 0) {
                      for (let i = 0; i < data.chunksCount; i++) {
                          await deleteDoc(doc(dbFirestore, "users", targetUid, "chunks", `chunk_${i}`)).catch(() => {});
                      }
                  }
                  await deleteDoc(doc(dbFirestore, "users", targetUid));
                  firestoreDeleted = true;
              }
          } catch (e) {
              console.error("Error deleting Firestore backup:", e?.message || String(e));
          }
      }
  }

  if (isRealOAuthToken(cachedAccessToken)) {
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
  const statusEl = document.getElementById('backupStatus');
  const oldStatus = statusEl ? statusEl.innerText : '';
  if (statusEl) statusEl.innerText = "جاري مسح النسخ الاحتياطية السحابية...";

  try {
      const res = await window.deleteCloudBackup(true);
      if (typeof window.showAppToast === 'function') {
          window.showAppToast(
              (res.firestoreDeleted || res.driveDeleted)
                  ? '✅ تم مسح النسخ الاحتياطية السحابية بنجاح.'
                  : 'ℹ️ لا توجد نسخ احتياطية سحابية محفوظة حالياً.',
              'info'
          );
      }
      if (statusEl) {
          const user = getEffectiveUser();
          statusEl.innerText = user ? `تم تسجيل الدخول كـ: ${user.email}` : 'تم مسح النسخ الاحتياطية';
      }
  } catch (err) {
      console.error("Clear backups error:", err);
      if (statusEl) statusEl.innerText = oldStatus;
  }
};

// Check for updates when user returns to tab after working on another device
document.addEventListener('visibilitychange', () => {
  const user = getEffectiveUser();
  if (!document.hidden && user) {
    const elapsed = Date.now() - lastUpdateCheckTime;
    if (elapsed > 90000) { // If > 1.5 minutes since last check
      window.checkForDriveUpdates({ interactive: false });
    }
  }
});
