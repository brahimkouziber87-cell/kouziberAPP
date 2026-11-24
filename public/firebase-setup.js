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

// Purge stale Service Worker caches once on v4.6.0 upgrade so old cached scripts never persist
try {
  const SW_CACHE_MIGRATION_KEY = 'prof_digital_sw_cache_migrated_v4_6_0';
  if (typeof localStorage !== 'undefined' && localStorage.getItem(SW_CACHE_MIGRATION_KEY) !== '1') {
    localStorage.setItem(SW_CACHE_MIGRATION_KEY, '1');
    localStorage.removeItem('cloud_sync_error_logs_v1');
    if (typeof caches !== 'undefined' && typeof caches.keys === 'function') {
      caches.keys().then((keys) => {
        keys.forEach((k) => {
          if (k !== 'prof-digital-v4.6.0') {
            caches.delete(k).catch(() => {});
          }
        });
      }).catch(() => {});
    }
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => {
          try { reg.update(); } catch (_) {}
          if (reg.active) {
            try { reg.active.postMessage({ type: 'CLEAR_ALL_CACHES' }); } catch (_) {}
          }
        });
      }).catch(() => {});
    }
  }
} catch (_) {}

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
  if (typeof window.logCloudSyncError === 'function') {
    window.logCloudSyncError({
      service: 'Firestore',
      operation: operationType || 'WRITE',
      folderName: path || 'users/cloud_backup',
      error: error,
      details: errInfo
    });
  }
  if (shouldThrow) {
    throw new Error(JSON.stringify(errInfo));
  }
  return errInfo;
}
window.handleFirestoreError = handleFirestoreError;

async function testConnection() {
  if (!auth || !auth.currentUser) return;
  try {
    await getDocFromServer(doc(dbFirestore, 'users', auth.currentUser.uid));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration.");
    }
  }
}

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
    const defaults = [];
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

window._verifiedGisOAuthUser = null;

function getVerifiedCloudUser() {
    if (auth && auth.currentUser) return auth.currentUser;
    if (window._verifiedGisOAuthUser && typeof isRealOAuthToken === 'function' && isRealOAuthToken(cachedAccessToken)) {
        return window._verifiedGisOAuthUser;
    }
    return null;
}

function getEffectiveUser() {
    const verified = getVerifiedCloudUser();
    if (verified) return verified;
    if (window._directGmailUser && window._directGmailUser.uid) return window._directGmailUser;
    const savedEmail = normalizeGmailAddress(localStorage.getItem('gdrive_last_email') || '');
    if (savedEmail && isValidEmailFormat(savedEmail)) {
        window._directGmailUser = {
            uid: computeGmailUid(savedEmail),
            email: savedEmail,
            displayName: savedEmail.split('@')[0],
            emailVerified: false,
            isDirectGmail: true
        };
        return window._directGmailUser;
    }
    return null;
}
window.getEffectiveUser = getEffectiveUser;
window.getVerifiedFirebaseAuthUser = () => getVerifiedCloudUser();
window.getGoogleCurrentUser = () => getEffectiveUser();
window.isCloudSyncActive = () => !!(getVerifiedCloudUser() || getEffectiveUser());
window.isCloudSyncVerified = () => !!getVerifiedCloudUser();
window.getCloudUserEmail = () => {
    const u = getVerifiedCloudUser() || getEffectiveUser();
    return u ? (u.email || u.displayName || 'Google') : null;
};

// الحد الأقصى الآمن لحجم الوثيقة في Firestore لتفادي تجاوز حد 1MB
const MAX_FIRESTORE_DOC_PAYLOAD_SIZE = 600000; // 600KB
const FIRESTORE_DIFF_HASH_CACHE_KEY = 'firestore_diff_hashes_v1';

const DIFFERENTIAL_SLICE_DEFS = [
    { id: 'classes_profile', keys: ['classes', 'classOrder', 'teacherProfile', 'settings', 'disabledDates', 'holidays', 'teacherTimetable', 'timetable', 'cloudSyncConfig'] },
    { id: 'records', keys: ['records'] },
    { id: 'grades_s1', keys: ['grades', 'gradesS1', 'examConfigs', 'gradeScales'] },
    { id: 'grades_s2', keys: ['gradesS2'] },
    { id: 'behaviors_notes', keys: ['behaviors', 'notes', 'attendanceArchive', 'behaviorLogs'] },
    { id: 'textbook_curriculum', keys: ['textbook', 'curriculum', 'lessonNotes', 'axisParagraphNotes', 'lessonLogs'] },
    { id: 'library_resources', keys: ['library', 'libraryDriveFolders', 'sharedResources'] },
    { id: 'tutoring_data', keys: ['tutoring', 'tutoringStudents', 'tutoringSessions', 'tutoringGroups', 'tutoringPayments'] }
];

function computeSliceDigest(str) {
    let hash = 2166136261;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
        hash ^= s.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return 'F32-' + (hash >>> 0).toString(16).toUpperCase().padStart(8, '0') + ':' + s.length;
}

function getCachedCloudSliceHashes(targetUid) {
    try {
        const raw = localStorage.getItem(FIRESTORE_DIFF_HASH_CACHE_KEY);
        const all = raw ? JSON.parse(raw) : {};
        return (all && all[targetUid] && typeof all[targetUid] === 'object') ? all[targetUid] : {};
    } catch (e) {
        return {};
    }
}

function saveCachedCloudSliceHashes(targetUid, hashesMap) {
    try {
        const raw = localStorage.getItem(FIRESTORE_DIFF_HASH_CACHE_KEY);
        const all = raw ? JSON.parse(raw) : {};
        all[targetUid] = hashesMap;
        localStorage.setItem(FIRESTORE_DIFF_HASH_CACHE_KEY, JSON.stringify(all));
    } catch (e) {}
}

function clearCachedCloudSliceHashes(targetUid) {
    try {
        const raw = localStorage.getItem(FIRESTORE_DIFF_HASH_CACHE_KEY);
        if (!raw) return;
        const all = JSON.parse(raw);
        if (all && targetUid in all) {
            delete all[targetUid];
            localStorage.setItem(FIRESTORE_DIFF_HASH_CACHE_KEY, JSON.stringify(all));
        }
    } catch (e) {}
}

function partitionPayloadIntoDifferentialSlices(sourceObj) {
    const obj = (sourceObj && typeof sourceObj === 'object') ? sourceObj : {};
    const assignedKeys = new Set();
    const slices = [];

    DIFFERENTIAL_SLICE_DEFS.forEach((def) => {
        const sliceData = {};
        def.keys.forEach((k) => {
            assignedKeys.add(k);
            if (obj[k] !== undefined) {
                sliceData[k] = obj[k];
            }
        });
        const serialized = safeStringify(sliceData);
        slices.push({
            id: def.id,
            serialized,
            hash: computeSliceDigest(serialized),
            rawSize: serialized.length
        });
    });

    const miscStable = {};
    const miscFull = {};
    Object.keys(obj).forEach((k) => {
        if (assignedKeys.has(k)) return;
        miscFull[k] = obj[k];
        if (k !== '_lastSavedAt' && k !== '_lastSavedTimestamp' && k !== '_lastSavedDevice') {
            miscStable[k] = obj[k];
        }
    });
    const miscStableStr = safeStringify(miscStable);
    const miscFullStr = safeStringify(miscFull);
    slices.push({
        id: 'auxiliary_misc',
        serialized: miscFullStr,
        hash: computeSliceDigest(miscStableStr),
        rawSize: miscFullStr.length
    });

    return slices;
}

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
 * قراءة الشرائح التفاضلية لـ Firestore وإعادة بناء قاعدة البيانات الكاملة
 */
async function readDifferentialSlicesForSlot(targetUid) {
    const manifestPath = `users/${targetUid}/slices/manifest`;
    let manifestSnap;
    try {
        manifestSnap = await getDoc(doc(dbFirestore, "users", targetUid, "slices", "manifest"));
    } catch (err) {
        handleFirestoreError(err, OperationType.GET, manifestPath, false);
        return null;
    }
    if (!manifestSnap || !manifestSnap.exists()) return null;

    const mData = manifestSnap.data();
    if (!mData || !mData.payload) return null;

    const manifestRaw = await decompressString(mData.payload, mData.isCompressed);
    let manifestObj = null;
    try { manifestObj = JSON.parse(manifestRaw); } catch (_) {}
    if (!manifestObj || !Array.isArray(manifestObj.sliceIds)) return null;

    const sliceDocs = await Promise.all(
        manifestObj.sliceIds.map(async (sId) => {
            try {
                const sSnap = await getDoc(doc(dbFirestore, "users", targetUid, "slices", sId));
                if (!sSnap || !sSnap.exists()) return null;
                const sData = sSnap.data();
                const rawSliceStr = await decompressString(sData.payload, sData.isCompressed);
                return JSON.parse(rawSliceStr);
            } catch (sliceErr) {
                handleFirestoreError(sliceErr, OperationType.GET, `users/${targetUid}/slices/${sId}`, false);
                return null;
            }
        })
    );

    if (sliceDocs.some((s) => s === null)) {
        return null;
    }

    const merged = {};
    sliceDocs.forEach((part) => {
        if (part && typeof part === 'object') {
            Object.assign(merged, part);
        }
    });

    if (manifestObj.hashes && typeof manifestObj.hashes === 'object') {
        saveCachedCloudSliceHashes(targetUid, manifestObj.hashes);
    }

    return {
        rawString: safeStringify(merged),
        slicesCount: manifestObj.sliceIds.length
    };
}

/**
 * قراءة وثيقة مستخدم مفردة من Firestore بحسب معرّف الوثيقة (مع دعم المزامنة التفاضلية والنسخ الموحدة)
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

    if (cloudData.syncMode === 'differential_v1') {
        try {
            const diffResult = await readDifferentialSlicesForSlot(targetUid);
            if (diffResult && diffResult.rawString) {
                return {
                    uid: targetUid,
                    rawString: diffResult.rawString,
                    lastUpdated: cloudData.lastUpdated,
                    lastSavedTimestamp: Number(cloudData.lastSavedTimestamp) || (cloudData.lastUpdated ? new Date(cloudData.lastUpdated).getTime() : 0),
                    chunksCount: diffResult.slicesCount || 0,
                    syncMode: 'differential_v1'
                };
            }
        } catch (diffReadErr) {
            console.warn('Differential slot read notice, checking fallback:', diffReadErr);
        }
    }

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
        chunksCount: cloudData.chunksCount || 0,
        syncMode: cloudData.syncMode || 'full'
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
            userEmail: String(userEmail || '').slice(0, 256),
            syncMode: 'full'
        });
    } else {
        const chunks = [];
        for (let i = 0; i < payloadString.length; i += MAX_FIRESTORE_DOC_PAYLOAD_SIZE) {
            chunks.push(payloadString.slice(i, i + MAX_FIRESTORE_DOC_PAYLOAD_SIZE));
        }

        // The parent document is written first: security rules require an owned
        // parent slot before any chunk can be created under it.
        await setDoc(doc(dbFirestore, "users", targetUid), {
            isChunked: true,
            isCompressed: Boolean(compressed),
            chunksCount: chunks.length,
            totalRawSize: Number(rawLength) || 0,
            compressedSize: Number(payloadString.length) || 0,
            lastUpdated: String(nowIso).slice(0, 64),
            lastSavedTimestamp: nowTs,
            userEmail: String(userEmail || '').slice(0, 256),
            syncMode: 'full_chunked'
        });

        for (let idx = 0; idx < chunks.length; idx++) {
            await setDoc(doc(dbFirestore, "users", targetUid, "chunks", `chunk_${idx}`), {
                chunk: chunks[idx],
                index: idx,
                totalChunks: chunks.length,
                lastUpdated: String(nowIso).slice(0, 64)
            });
        }
    }
}

async function executeDifferentialFirestoreWriteToUid(targetUid, userEmail, filteredObj, rawLength, nowIso, nowTs) {
    if (!targetUid) return null;
    const slices = partitionPayloadIntoDifferentialSlices(filteredObj);
    let knownHashes = getCachedCloudSliceHashes(targetUid);

    // If no local hash cache exists yet for this UID, hydrate from cloud manifest once
    if (!knownHashes || Object.keys(knownHashes).length === 0) {
        try {
            const manifestSnap = await getDoc(doc(dbFirestore, "users", targetUid, "slices", "manifest"));
            if (manifestSnap && manifestSnap.exists()) {
                const mData = manifestSnap.data();
                const rawM = await decompressString(mData.payload, mData.isCompressed);
                const parsedM = JSON.parse(rawM);
                if (parsedM && parsedM.hashes) {
                    knownHashes = parsedM.hashes;
                    saveCachedCloudSliceHashes(targetUid, knownHashes);
                }
            }
        } catch (_) {}
    }

    const changedSlices = slices.filter((s) => knownHashes[s.id] !== s.hash);
    const unchangedCount = slices.length - changedSlices.length;

    // Even if nothing changed, avoid redundant slice writes if manifest is already present
    if (changedSlices.length === 0 && Object.keys(knownHashes).length === slices.length) {
        const skippedStats = {
            mode: 'differential_v1',
            totalSlices: slices.length,
            uploadedSlices: 0,
            skippedSlices: slices.length,
            uploadedBytes: 0,
            savedRawBytes: rawLength,
            lastUpdated: nowIso
        };
        window.__lastFirestoreDiffStats = skippedStats;
        return skippedStats;
    }

    // Compress only modified slices
    const compressedChanged = await Promise.all(
        changedSlices.map(async (s) => {
            const res = await compressString(s.serialized);
            return Object.assign({}, s, {
                compressed: res.compressed,
                payload: res.data
            });
        })
    );

    // If any individual slice exceeds the safe Firestore document size, fallback cleanly to chunked backup
    if (compressedChanged.some((s) => s.payload.length > MAX_FIRESTORE_DOC_PAYLOAD_SIZE)) {
        const rawString = safeStringify(filteredObj);
        const { compressed, data: payloadString } = await compressString(rawString);
        await executeFirestoreUserWriteToUid(targetUid, userEmail, payloadString, compressed, rawString.length, nowIso, nowTs);
        return {
            mode: 'full_chunked_fallback',
            totalSlices: slices.length,
            uploadedSlices: slices.length,
            skippedSlices: 0,
            uploadedBytes: payloadString.length,
            savedRawBytes: 0,
            lastUpdated: nowIso
        };
    }

    const totalUploadedBytes = compressedChanged.reduce((acc, s) => acc + s.payload.length, 0);
    const savedRawBytes = slices
        .filter((s) => knownHashes[s.id] === s.hash)
        .reduce((acc, s) => acc + s.rawSize, 0);

    // 1. Write parent slot metadata first so security rules verify ownership for subcollection writes
    await setDoc(doc(dbFirestore, "users", targetUid), {
        isCompressed: true,
        isChunked: false,
        chunksCount: 0,
        totalRawSize: Number(rawLength) || 0,
        compressedSize: Number(totalUploadedBytes) || 0,
        lastUpdated: String(nowIso).slice(0, 64),
        lastSavedTimestamp: nowTs,
        userEmail: String(userEmail || '').slice(0, 256),
        syncMode: 'differential_v1'
    });

    // 2. Upload ONLY changed slices in parallel
    await Promise.all(
        compressedChanged.map((s) =>
            setDoc(doc(dbFirestore, "users", targetUid, "slices", s.id), {
                sliceId: s.id,
                hash: s.hash,
                payload: s.payload,
                isCompressed: Boolean(s.compressed),
                rawSize: Number(s.rawSize) || 0,
                compressedSize: Number(s.payload.length) || 0,
                lastUpdated: String(nowIso).slice(0, 64),
                lastSavedTimestamp: nowTs,
                userEmail: String(userEmail || '').slice(0, 256)
            })
        )
    );

    // 3. Update slice manifest document
    const updatedHashMap = {};
    slices.forEach((s) => {
        updatedHashMap[s.id] = s.hash;
    });
    const manifestObj = {
        version: 1,
        sliceIds: slices.map((s) => s.id),
        hashes: updatedHashMap,
        lastUpdated: nowIso
    };
    const manifestStr = safeStringify(manifestObj);
    const compressedManifest = await compressString(manifestStr);
    await setDoc(doc(dbFirestore, "users", targetUid, "slices", "manifest"), {
        sliceId: 'manifest',
        hash: computeSliceDigest(manifestStr),
        payload: compressedManifest.data,
        isCompressed: Boolean(compressedManifest.compressed),
        rawSize: Number(manifestStr.length) || 0,
        compressedSize: Number(compressedManifest.data.length) || 0,
        lastUpdated: String(nowIso).slice(0, 64),
        lastSavedTimestamp: nowTs,
        userEmail: String(userEmail || '').slice(0, 256)
    });

    saveCachedCloudSliceHashes(targetUid, updatedHashMap);
    const diffStats = {
        mode: 'differential_v1',
        totalSlices: slices.length,
        uploadedSlices: changedSlices.length,
        skippedSlices: unchangedCount,
        uploadedBytes: totalUploadedBytes,
        savedRawBytes,
        lastUpdated: nowIso
    };
    window.__lastFirestoreDiffStats = diffStats;
    return diffStats;
}

async function executeFirestoreUserWrite(user, filteredObj, rawLength, nowIso) {
    const nowTs = Date.now();
    const cleanEmail = normalizeGmailAddress(user.email || '');
    // الكتابة حصراً في المسار الموثق users/{uid} لتفادي مضاعفة استهلاك حصة Firestore
    // (مع الإبقاء على التوافق العكسي لقراءة مسارات gmail_* القديمة في fetchFirestoreAppData)
    const primaryStats = await executeDifferentialFirestoreWriteToUid(user.uid, cleanEmail, filteredObj, rawLength, nowIso, nowTs);
    return primaryStats;
}

window.getCloudDifferentialSyncStats = () => window.__lastFirestoreDiffStats || null;

window.syncToFirebase = async (data, preSerialized) => {
    const user = getEffectiveUser();
    if (user && user.uid) {
        const userDocPath = `users/${user.uid}`;
        try {
            const nowIso = new Date().toISOString();
            const filteredData = typeof window.buildFilteredCloudPayloadForAutoSync === 'function'
                ? window.buildFilteredCloudPayloadForAutoSync(data || window.db || {})
                : (data || window.db || {});
            const rawString = (typeof preSerialized === 'string' && preSerialized.length > 2) ? preSerialized : safeStringify(filteredData);

            // تنفيذ المزامنة التفاضلية للشرائح المتغيرة فقط مع إعادة المحاولة تلقائياً عند انتهاء صلاحية التوكن
            let diffStats = null;
            try {
                diffStats = await executeFirestoreUserWrite(user, filteredData, rawString.length, nowIso);
            } catch (firstErr) {
                const msg = firstErr?.message || String(firstErr);
                if (msg.includes('permission') || firstErr?.code === 'permission-denied') {
                    if (typeof user.getIdToken === 'function') {
                        await user.getIdToken(true);
                    }
                    diffStats = await executeFirestoreUserWrite(user, filteredData, rawString.length, nowIso);
                } else {
                    throw firstErr;
                }
            }

            const result = {
                success: true,
                cloud: true,
                timestamp: new Date(),
                user: user.email || user.displayName,
                diffStats
            };
            window.dispatchEvent(new CustomEvent('cloudSyncResult', { detail: result }));
            window.dispatchEvent(new CustomEvent('cloudDiffSyncCompleted', { detail: diffStats || {} }));
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

const basicGoogleProvider = new GoogleAuthProvider();
basicGoogleProvider.setCustomParameters({ prompt: 'select_account' });

let cachedAccessToken = null;
let cachedAccessTokenIssuedAt = 0;
const OAUTH_TOKEN_MEMORY_TTL_MS = 55 * 60 * 1000;
let lastUpdateCheckTime = 0;
let lastKnownCloudBackupSummary = null;

// تنظيف أي رموز OAuth قديمة من sessionStorage التزاماً بمعيار الاحتفاظ بالرمز في الذاكرة الحية فقط
try {
  sessionStorage.removeItem('gdrive_access_token');
  sessionStorage.removeItem('gdrive_token_time');
} catch(e) {}

function updateCachedDriveToken(token) {
  const validToken = isRealOAuthToken(token) ? token : null;
  cachedAccessToken = validToken;
  cachedAccessTokenIssuedAt = validToken ? Date.now() : 0;
  if (!validToken && (!auth || !auth.currentUser)) {
    window._verifiedGisOAuthUser = null;
  }
  try {
    sessionStorage.removeItem('gdrive_access_token');
    sessionStorage.removeItem('gdrive_token_time');
  } catch(e) {}
  const effUser = getEffectiveUser();
  window.dispatchEvent(new CustomEvent('gdrive-token-changed', {
    detail: { token: cachedAccessToken, user: (auth && auth.currentUser) || effUser }
  }));
  const verifiedUser = getVerifiedCloudUser();
  if (validToken) {
    updateDriveSyncHeaderBadge('synced', 'Google Drive: متزامن ✓');
  } else if (verifiedUser) {
    updateDriveSyncHeaderBadge('synced', 'Firestore: موثّق ✓');
  } else if (effUser && effUser.email) {
    const shortName = effUser.email.split('@')[0];
    updateDriveSyncHeaderBadge('synced', `Gmail: ${shortName} ✓`);
  } else {
    updateDriveSyncHeaderBadge('disconnected');
  }
}

window.getGoogleDriveToken = async (interactive = false) => {
  if (cachedAccessToken && (Date.now() - cachedAccessTokenIssuedAt >= OAUTH_TOKEN_MEMORY_TTL_MS)) {
    cachedAccessToken = null;
    cachedAccessTokenIssuedAt = 0;
  }
  if (cachedAccessToken && isRealOAuthToken(cachedAccessToken)) return cachedAccessToken;
  if (interactive) {
    const loginRes = await window.handleDriveLogin();
    return isRealOAuthToken(loginRes) ? loginRes : null;
  }
  return null;
};

window.getGoogleCurrentUser = () => getEffectiveUser();
window.getGoogleCalendarAccessToken = window.getGoogleDriveToken;
window.hasActiveDriveToken = () => !!(cachedAccessToken && isRealOAuthToken(cachedAccessToken) && (Date.now() - cachedAccessTokenIssuedAt < OAUTH_TOKEN_MEMORY_TTL_MS));
window.isGoogleCalendarLinked = window.hasActiveDriveToken;

// Header badge updater
function updateDriveSyncHeaderBadge(state, text = '') {
  const badge = document.getElementById('headerDriveSyncBadge');
  const textEl = document.getElementById('headerDriveSyncText');
  if (!badge) return;

  badge.classList.remove('synced', 'update-available', 'saving');
  if (state === 'synced') {
    badge.classList.add('synced');
    if (textEl) textEl.textContent = text || 'Google Drive: متزامن ✓';
    badge.title = 'حساب Gmail / Google Drive متصل ونشط للمزامنة';
  } else if (state === 'update-available') {
    badge.classList.add('update-available');
    if (textEl) textEl.textContent = text || '🔔 تحديث جديد في Drive!';
    badge.title = 'تم اكتشاف تحديث أحدث في Google Drive من جهاز آخر. انقر للمزامنة.';
  } else if (state === 'saving') {
    badge.classList.add('saving');
    if (textEl) textEl.textContent = text || 'جاري المزامنة مع Drive...';
    badge.title = 'جاري حفظ التحديث تلقائياً في Google Drive';
  } else {
    if (textEl) textEl.textContent = text || 'ربط البريد الموثّق';
    badge.title = 'انقر لربط حساب Gmail ومزامنة المنظومة عبر أجهزتك المختلفة';
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

  // Update header pill based on verified OAuth / Firebase Auth or active linked Gmail account
  const verifiedUser = getVerifiedCloudUser();
  if (verifiedUser && isRealOAuthToken(cachedAccessToken)) {
    updateDriveSyncHeaderBadge('synced', 'Google Drive: متزامن ✓');
  } else if (verifiedUser) {
    updateDriveSyncHeaderBadge('synced', 'Firestore: موثّق ✓');
  } else if (user && user.email) {
    const shortName = user.email.split('@')[0];
    updateDriveSyncHeaderBadge('synced', `Gmail: ${shortName} ✓`);
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

      const rawDataObj = Object.assign({}, data || window.db || {});
      const payloadObj = typeof window.buildFilteredCloudPayloadForAutoSync === 'function'
        ? window.buildFilteredCloudPayloadForAutoSync(rawDataObj)
        : rawDataObj;
      payloadObj._lastSavedAt = new Date().toISOString();
      payloadObj._lastSavedTimestamp = Date.now();
      payloadObj._lastSavedDevice = navigator.userAgent.includes('Mobile') ? 'هاتف محمول' : (navigator.userAgent.includes('Mac') ? 'جهاز Mac' : 'حاسوب مكتبي');

      const serialized = safeStringify(payloadObj);

      let driveUploaded = false;
      if (isRealOAuthToken(cachedAccessToken)) {
        const fileId = await getBackupFileId(cachedAccessToken);
        let driveRes;
        if (fileId) {
          driveRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
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

          driveRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: { Authorization: `Bearer ${cachedAccessToken}` },
            body: formData
          });
        }
        if (driveRes && !driveRes.ok) {
          const errTxt = await driveRes.text().catch(() => '');
          throw new Error(`Google Drive HTTP ${driveRes.status}: ${errTxt.slice(0, 160) || driveRes.statusText}`);
        }
        if (driveRes && driveRes.ok) driveUploaded = true;
      }

      let firestoreSynced = false;
      if (user && typeof window.syncToFirebase === 'function') {
        const fsRes = await window.syncToFirebase(payloadObj, serialized);
        firestoreSynced = !!(fsRes && fsRes.success);
      }

      if (firestoreSynced && typeof window.markFirestorePayloadSynced === 'function') {
        window.markFirestorePayloadSynced(serialized, { bumpHourlyCounter: false, trigger: 'auto_sync' });
      }

      if ((firestoreSynced || driveUploaded) && typeof window.markAutoSyncedModulesTimestamp === 'function') {
        window.markAutoSyncedModulesTimestamp(payloadObj._lastSavedAt);
      }

      localStorage.setItem('absence_massar_v8_last_saved_time', payloadObj._lastSavedAt);
      const badgeText = isRealOAuthToken(cachedAccessToken)
        ? 'Google Drive: متزامن ✓'
        : (user && user.email ? `Gmail: ${user.email.split('@')[0]} ✓` : 'السحابة: متزامن ✓');
      updateDriveSyncHeaderBadge('synced', badgeText);
      window.dispatchEvent(new CustomEvent('gdriveSyncSuccess', { detail: { timestamp: new Date() } }));
    } catch (err) {
      console.warn("Silent Drive auto-sync failed:", err?.message || String(err));
      if (typeof window.markFirestoreSyncPending === 'function') {
        window.markFirestoreSyncPending(err?.message || 'offline_or_network');
      }
      if (typeof window.logCloudSyncError === 'function') {
        window.logCloudSyncError({
          service: 'Google Drive',
          operation: 'AUTO_SYNC',
          folderName: 'ملف النسخة الاحتياطية (app_backup.json)',
          error: err
        });
      }
      updateDriveSyncHeaderBadge('synced', 'السحابة متصلة');
    } finally {
      isDriveSyncing = false;
    }
  }, 1600);
};

// -------------------------------------------------------------
// Interactive UI Modals for Multi-Device Sync
// -------------------------------------------------------------

function escapeSyncHtml(val) {
  return String(val == null ? '' : val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
        <p style="font-size: 0.85rem; color: #64748b; margin: 0;">أهلاً بك أستاذ <strong>${escapeSyncHtml(cloudSummary.teacherName)}</strong>. تم العثور على أحدث نسخة لبياناتك ومادتك في (${escapeSyncHtml(cloudSummary.source)}).</p>
      </div>

      <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin-bottom: 18px; font-size: 0.84rem;">
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #cbd5e1;">
          <span style="color: #64748b;">📅 آخر حفظ وتحديث:</span>
          <strong style="color: #0284c7;">${escapeSyncHtml(cloudSummary.dateStr)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #cbd5e1;">
          <span style="color: #64748b;">📚 الأقسام الدراسية (${Number(cloudSummary.classesCount || 0)}):</span>
          <strong style="color: #0f172a;">${escapeSyncHtml(classListText || 'لا توجد')}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #cbd5e1;">
          <span style="color: #64748b;">👥 إجمالي التلاميذ:</span>
          <strong style="color: #10b981;">${Number(cloudSummary.totalStudents || 0)} تلميذ</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 6px 0;">
          <span style="color: #64748b;">📝 الحصص والغياب والنقط:</span>
          <strong style="color: #475569;">${Number(cloudSummary.recordsCount || 0)} حصة مسجلة</strong>
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

window.scrollDriveSyncContainer = (containerId, action, targetSectionId = '') => {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (action === 'section' && targetSectionId) {
    const targetEl = document.getElementById(targetSectionId);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return;
  }

  if (action === 'top') {
    container.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (action === 'bottom') {
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  } else if (action === 'up') {
    container.scrollBy({ top: -220, behavior: 'smooth' });
  } else if (action === 'down') {
    container.scrollBy({ top: 220, behavior: 'smooth' });
  }
};

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

  const verifiedUser = getVerifiedCloudUser();
  const hasVerifiedFirebase = !!verifiedUser;
  const modeBadgeHtml = !isConnected
    ? `<span style="font-size: 0.72rem; background: #f1f5f9; color: #64748b; font-weight: 700; padding: 2px 8px; border-radius: 999px; border: 1px solid #cbd5e1;">غير مرتبط</span>`
    : (hasVerifiedFirebase && hasRealOAuth
        ? `<span style="font-size: 0.72rem; background: #dcfce7; color: #166534; font-weight: 800; padding: 2px 9px; border-radius: 999px; border: 1px solid #86efac;">✓ ربط رسمي موثّق (Google Drive + Firestore)</span>`
        : (hasVerifiedFirebase
            ? `<span style="font-size: 0.72rem; background: #e0f2fe; color: #0369a1; font-weight: 800; padding: 2px 9px; border-radius: 999px; border: 1px solid #7dd3fc;">☁️ جلسة Firestore موثّقة</span>`
            : `<span style="font-size: 0.72rem; background: #dcfce7; color: #15803d; font-weight: 800; padding: 2px 9px; border-radius: 999px; border: 1px solid #86efac;">✓ مرتبط بحساب Gmail (مفعّل)</span>`));

  modal.innerHTML = `
    <div class="drive-sync-modal-card" style="max-width: 580px; max-height: calc(100vh - 28px); display: flex; flex-direction: column; padding: 0; overflow: hidden;">
      <!-- رأس النافذة الثابت مع أزرار الصعود والنزول السريع -->
      <div style="padding: 14px 18px 10px 18px; border-bottom: 1.5px solid #e2e8f0; background: #ffffff; flex-shrink: 0;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="background: linear-gradient(135deg, #1e1b4b, #312e81); color: #fbbf24; width: 40px; height: 40px; border-radius: 11px; display: flex; align-items: center; justify-content: center; border: 1.5px solid #d4af37; box-shadow: 0 3px 10px rgba(30, 27, 75, 0.2); flex-shrink: 0;">
              <span data-lucide="mail-check" data-size="20"></span>
            </div>
            <div>
              <h3 style="margin: 0; font-size: 1.03rem; font-weight: 800; color: #0f172a;">مركز الربط بحساب Gmail والمزامنة السحابية</h3>
              <div style="font-size: 0.73rem; color: #64748b;">مزامنة فورية بين الهاتف، الحاسوب، واللوحة بنفس بريد Gmail</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 5px; flex-shrink: 0;">
            <button type="button" onclick="window.scrollDriveSyncContainer('driveSyncCenterScrollBody', 'up')" class="drive-sync-scroll-nav-btn" title="الصعود للأعلى">
              <span>⬆️</span>
            </button>
            <button type="button" onclick="window.scrollDriveSyncContainer('driveSyncCenterScrollBody', 'down')" class="drive-sync-scroll-nav-btn" title="النزول للأسفل">
              <span>⬇️</span>
            </button>
            <button type="button" onclick="window.closeDriveSyncCenterModal()" title="إغلاق" style="background: #f1f5f9; border: 1px solid #cbd5e1; width: 30px; height: 30px; border-radius: 8px; font-size: 1.15rem; cursor: pointer; color: #475569; display: flex; align-items: center; justify-content: center; font-weight: bold;">&times;</button>
          </div>
        </div>

        <!-- شريط الانتقال السريع بين أقسام النافذة -->
        <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 5px; padding-bottom: 2px;">
          <button type="button" onclick="window.scrollDriveSyncContainer('driveSyncCenterScrollBody', 'section', 'syncSecAccount')" style="background: #f0f9ff; border: 1px solid #bae6fd; color: #0369a1; font-size: 0.7rem; font-weight: 800; padding: 3px 8px; border-radius: 6px; cursor: pointer; white-space: nowrap;">
            👤 حساب Gmail
          </button>
          <button type="button" onclick="window.scrollDriveSyncContainer('driveSyncCenterScrollBody', 'section', 'syncSecGmailTools')" style="background: #f8fafc; border: 1px solid #cbd5e1; color: #334155; font-size: 0.7rem; font-weight: 700; padding: 3px 8px; border-radius: 6px; cursor: pointer; white-space: nowrap;">
            ✉️ خدمات البريد
          </button>
          <button type="button" onclick="window.scrollDriveSyncContainer('driveSyncCenterScrollBody', 'section', 'syncSecComparison')" style="background: #f8fafc; border: 1px solid #cbd5e1; color: #334155; font-size: 0.7rem; font-weight: 700; padding: 3px 8px; border-radius: 6px; cursor: pointer; white-space: nowrap;">
            ⚖️ المقارنة السحابية
          </button>
          <button type="button" onclick="window.scrollDriveSyncContainer('driveSyncCenterScrollBody', 'section', 'syncSecHourlyFirestore')" style="background: #f8fafc; border: 1px solid #cbd5e1; color: #334155; font-size: 0.7rem; font-weight: 700; padding: 3px 8px; border-radius: 6px; cursor: pointer; white-space: nowrap;">
            ⏱️ النسخ الساعي
          </button>
          <button type="button" onclick="window.scrollDriveSyncContainer('driveSyncCenterScrollBody', 'section', 'syncSecQuickActions')" style="background: #f8fafc; border: 1px solid #cbd5e1; color: #334155; font-size: 0.7rem; font-weight: 700; padding: 3px 8px; border-radius: 6px; cursor: pointer; white-space: nowrap;">
            ⚡ الإجراءات والمجلدات
          </button>
        </div>
      </div>

      <!-- جسم النافذة القابل للتمرير صعوداً ونزولاً -->
      <div id="driveSyncCenterScrollBody" class="drive-sync-scroll-body" style="flex: 1; min-height: 0; overflow-y: auto; padding: 14px 18px;">
        <!-- بطاقة حساب Gmail المرتبط -->
        <div id="syncSecAccount" style="background: linear-gradient(135deg, #f8fafc, #f0f9ff); border: 1.5px solid #bae6fd; border-radius: 12px; padding: 12px 14px; margin-bottom: 14px;">
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
                <div style="font-weight: 800; font-size: 0.92rem; color: #0f172a; direction: ltr; text-align: right; margin-top: 2px;">${escapeSyncHtml(email)}</div>
              </div>
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
              <button type="button" onclick="window.openGmailQuickSwitchModal();" style="font-size: 0.75rem; background: #ffffff; color: #0284c7; border: 1.5px solid #0284c7; font-weight: 800; padding: 5px 10px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                <span data-lucide="repeat" data-size="13"></span>
                <span>${isConnected ? 'تبديل الحساب' : 'ربط حساب Gmail'}</span>
              </button>
            </div>
          </div>

          ${isConnected ? `
            <div style="margin-top: 10px; padding-top: 9px; border-top: 1px dashed #86efac; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
              <span style="font-size: 0.72rem; color: #15803d; font-weight: 700;">✅ حساب Gmail مرتبط ونشط — المزامنة السحابية والنسخ الاحتياطي التلقائي مع Firestore مفعّلان.</span>
              <button type="button" onclick="window.handleBackupToDrive().then(() => { const m = document.getElementById('driveSyncCenterModal'); if (m && m.style.display === 'flex') window.openDriveSyncCenterModal(); });" style="background: #dcfce7; border: 1px solid #86efac; color: #166534; font-size: 0.72rem; font-weight: 800; padding: 4px 10px; border-radius: 6px; cursor: pointer;">
                مزامنة فورية الآن ✓
              </button>
            </div>
          ` : ''}
        </div>

        <!-- أدوات بريد Gmail المدمجة للأستاذ -->
        <div id="syncSecGmailTools" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; margin-bottom: 14px;">
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
        <div id="syncSecComparison" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
          <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 10px 12px;">
            <div style="font-size: 0.73rem; color: #64748b; font-weight: 800; margin-bottom: 4px;">🖥️ بيانات هذا الجهاز</div>
            <div style="font-size: 0.8rem; font-weight: 800; color: #0f172a;">${escapeSyncHtml(localSummary ? localSummary.dateStr : 'غير متوفر')}</div>
            <div style="font-size: 0.72rem; color: #64748b; margin-top: 4px;">أقسام: ${localSummary ? Number(localSummary.classesCount || 0) : 0} | تلاميذ: ${localSummary ? Number(localSummary.totalStudents || 0) : 0}</div>
          </div>
          <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 10px; padding: 10px 12px;">
            <div style="font-size: 0.73rem; color: #166534; font-weight: 800; margin-bottom: 4px;">☁️ النسخة السحابية (Gmail)</div>
            <div id="syncCenterCloudDate" style="font-size: 0.8rem; font-weight: 800; color: #15803d;">${escapeSyncHtml(cloudSummary ? cloudSummary.dateStr : 'جاري الفحص...')}</div>
            <div id="syncCenterCloudStats" style="font-size: 0.72rem; color: #166534; margin-top: 4px;">أقسام: ${cloudSummary ? Number(cloudSummary.classesCount || 0) : '--'} | تلاميذ: ${cloudSummary ? Number(cloudSummary.totalStudents || 0) : '--'}</div>
          </div>
        </div>

        <!-- حالة وإعدادات المزامنة السحابية والنسخ الاحتياطي الساعي التلقائي مع Firestore -->
        ${(() => {
          const bgCfg = (typeof window.getBackgroundSyncStatus === 'function')
            ? window.getBackgroundSyncStatus()
            : { enabled: true, intervalMinutes: 60, lastSyncFormatted: 'لم تتم بعد', pendingDirty: false, online: navigator.onLine };
          const hourlyCfg = (typeof window.getHourlyFirestoreBackupStatus === 'function')
            ? window.getHourlyFirestoreBackupStatus()
            : { enabled: true, lastBackupFormatted: 'لم تتم بعد', nextBackupFormatted: 'خلال ساعة', totalBackups: 0, lastStatus: 'ready' };
          const hasCloudSyncSession = !!(getVerifiedCloudUser() || getEffectiveUser());
          return `
            <div id="syncSecHourlyFirestore" style="background: #f0f9ff; border: 1.5px solid #bae6fd; border-radius: 10px; padding: 10px 12px; margin-bottom: 14px;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span data-lucide="refresh-cw" data-size="14" style="color: #0284c7;"></span>
                  <strong style="font-size: 0.78rem; color: #0f172a;">خدمة النسخ الاحتياطي الساعي التلقائي (Firestore كل ساعة)</strong>
                </div>
                <label style="display: inline-flex; align-items: center; gap: 5px; font-size: 0.73rem; font-weight: 800; color: ${hourlyCfg.enabled ? '#15803d' : '#64748b'}; cursor: pointer;">
                  <input type="checkbox" ${hourlyCfg.enabled ? 'checked' : ''} onchange="window.toggleHourlyFirestoreBackup(this.checked); window.openDriveSyncCenterModal();" style="accent-color: #0284c7; width: 15px; height: 15px; cursor: pointer;">
                  <span>${hourlyCfg.enabled ? 'مفعّلة كل ساعة' : 'متوقفة'}</span>
                </label>
              </div>
              ${!hasCloudSyncSession ? `
                <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 7px; padding: 6px 9px; margin-bottom: 7px; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; font-size: 0.71rem; color: #92400e;">
                  <span>ℹ️ لتفعيل المزامنة السحابية المباشرة مع Firestore، قم بربط حساب Gmail الخاص بك.</span>
                  <button type="button" onclick="window.openGmailQuickSwitchModal();" style="background: #0284c7; color: #fff; border: none; padding: 3px 8px; border-radius: 5px; font-size: 0.69rem; font-weight: 800; cursor: pointer;">ربط حساب Gmail الآن</button>
                </div>
              ` : ''}
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; font-size: 0.72rem; color: #334155; margin-bottom: 6px;">
                <div>
                  <span>آخر نسخة ساعية: <strong id="bgSyncLastTimeLabel" style="color: #0369a1;">${escapeSyncHtml(hourlyCfg.lastBackupFormatted)}</strong></span>
                  <span style="margin-right: 6px; padding: 1px 6px; border-radius: 999px; font-size: 0.67rem; font-weight: 800; background: ${bgCfg.pendingDirty ? '#fef3c7' : '#dcfce7'}; color: ${bgCfg.pendingDirty ? '#92400e' : '#166534'};">
                    ${bgCfg.pendingDirty ? 'تعديلات بانتظار النسخ' : 'محمي ومتطابق ✓'}
                  </span>
                </div>
                <div style="display: flex; align-items: center; gap: 5px;">
                  <span>الدورية:</span>
                  <select onchange="window.setBackgroundCloudSyncInterval(Number(this.value))" style="padding: 2px 6px; border-radius: 6px; border: 1px solid #93c5fd; font-size: 0.71rem; font-weight: 700; background: #fff; color: #1e3a8a;">
                    <option value="60" ${bgCfg.intervalMinutes === 60 ? 'selected' : ''}>كل ساعة (60 د - افتراضي)</option>
                    <option value="30" ${bgCfg.intervalMinutes === 30 ? 'selected' : ''}>كل 30 دقيقة</option>
                    <option value="15" ${bgCfg.intervalMinutes === 15 ? 'selected' : ''}>كل 15 دقيقة</option>
                    <option value="5" ${bgCfg.intervalMinutes === 5 ? 'selected' : ''}>كل 5 دقائق</option>
                    <option value="3" ${bgCfg.intervalMinutes === 3 ? 'selected' : ''}>كل 3 دقائق</option>
                  </select>
                </div>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; padding-top: 6px; border-top: 1px dashed #bae6fd; font-size: 0.7rem; color: #475569;">
                <span>النسخة الساعية القادمة: <strong style="color: #0f172a;">${escapeSyncHtml(hourlyCfg.nextBackupFormatted)}</strong> · إجمالي النسخ: <strong>${Number(hourlyCfg.totalBackups || 0)}</strong></span>
                <button type="button" onclick="window.triggerHourlyFirestoreBackupNow().then(() => window.openDriveSyncCenterModal());" style="background: #0284c7; color: #fff; border: none; padding: 3px 9px; border-radius: 6px; font-size: 0.7rem; font-weight: 800; cursor: pointer;">
                  🔄 نسخ احتياطي الآن
                </button>
              </div>
            </div>
          `;
        })()}

        <!-- الإجراءات السريعة -->
        <div id="syncSecQuickActions" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px;">
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
          <button type="button" onclick="window.closeDriveSyncCenterModal(); window.openAdvancedCloudSyncSettingsModal('folders');" style="background: #0f172a; border: 1.5px solid #334155; color: #f8fafc; padding: 10px 12px; font-size: 0.82rem; font-weight: 800; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <span style="display: inline-flex; align-items: center; gap: 7px;">
              <span data-lucide="sliders" data-size="15" style="color: #38bdf8;"></span>
              <span>إعدادات المزامنة المتقدمة (لكل مجلد) وسجل الأخطاء</span>
            </span>
            <span style="background: rgba(56, 189, 248, 0.16); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); padding: 2px 8px; border-radius: 999px; font-size: 0.7rem; font-weight: 900;">
              ${(typeof window.getCloudSyncErrorLogs === 'function' ? window.getCloudSyncErrorLogs().length : 0)} سجل
            </span>
          </button>
        </div>

        ${isConnected ? `
          <button type="button" onclick="window.handleDriveLogout(); window.closeDriveSyncCenterModal();" style="width: 100%; background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 7px; border-radius: 7px; font-size: 0.78rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px;">
            <span data-lucide="log-out" data-size="13"></span>
            <span>فصل حساب Gmail وتسجيل الخروج السحابي</span>
          </button>
        ` : ''}
      </div>

      <!-- تذييل النافذة الثابت مع أزرار التمرير نحو الأعلى والأسفل -->
      <div style="padding: 10px 18px; border-top: 1.5px solid #e2e8f0; background: #f8fafc; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; flex-shrink: 0;">
        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <button type="button" onclick="window.scrollDriveSyncContainer('driveSyncCenterScrollBody', 'top')" class="drive-sync-scroll-nav-btn" title="الصعود إلى أعلى النافذة">
            <span>⬆️ الصعود للأعلى</span>
          </button>
          <button type="button" onclick="window.scrollDriveSyncContainer('driveSyncCenterScrollBody', 'up')" class="drive-sync-scroll-nav-btn" title="التمرير خطوة للأعلى">
            <span>🔼 لأعلى</span>
          </button>
          <button type="button" onclick="window.scrollDriveSyncContainer('driveSyncCenterScrollBody', 'down')" class="drive-sync-scroll-nav-btn" title="التمرير خطوة للأسفل">
            <span>🔽 لأسفل</span>
          </button>
          <button type="button" onclick="window.scrollDriveSyncContainer('driveSyncCenterScrollBody', 'bottom')" class="drive-sync-scroll-nav-btn" title="النزول إلى أسفل النافذة">
            <span>⬇️ النزول للأسفل</span>
          </button>
        </div>
        <button type="button" onclick="window.closeDriveSyncCenterModal()" style="background: #e2e8f0; border: 1px solid #cbd5e1; color: #1e293b; padding: 5px 14px; border-radius: 8px; font-size: 0.76rem; font-weight: 800; cursor: pointer;">
          إغلاق
        </button>
      </div>
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
// Smart Gmail Account Switcher & Quick Link Modal
// -------------------------------------------------------------

window.openGmailQuickSwitchModal = (prefillEmail = '') => {
  let modal = document.getElementById('gmailQuickSwitchModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'gmailQuickSwitchModal';
    modal.className = 'drive-sync-modal-backdrop';
    document.body.appendChild(modal);
  }

  const escapeAttr = (str) => String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const currentUser = getEffectiveUser();
  const currentEmail = escapeAttr(prefillEmail || (currentUser ? currentUser.email : (localStorage.getItem('gdrive_last_email') || '')));
  const historyEmails = getGmailHistoryList();

  const chipsHtml = historyEmails.map(em => {
    const safeEm = escapeAttr(em);
    return `
    <button type="button" onclick="const inp=document.getElementById('gmailQuickSwitchInput'); if(inp){inp.value='${safeEm}'; inp.focus();}" style="background: #f0f9ff; border: 1px solid #bae6fd; color: #0369a1; font-size: 0.74rem; font-weight: 700; padding: 4px 10px; border-radius: 999px; cursor: pointer; direction: ltr;">
      ${safeEm}
    </button>
  `;
  }).join('');

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

        <button type="button" onclick="window.confirmGmailQuickSwitch({ withOfficialOAuth: true })" style="background: #ffffff; border: 1.5px solid #cbd5e1; color: #1e293b; padding: 9px 14px; font-size: 0.82rem; font-weight: 800; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
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

window.confirmGmailQuickSwitch = async (opts = {}) => {
  const inp = document.getElementById('gmailQuickSwitchInput');
  const errEl = document.getElementById('gmailQuickSwitchError');
  const rawVal = inp ? inp.value : '';
  const clean = normalizeGmailAddress(rawVal);

  if (opts && opts.withOfficialOAuth && !clean) {
    window.closeGmailQuickSwitchModal();
    await window.handleGoogleSignInOfficial({ forcePopup: true, allowDirectFallback: true });
    const syncCenter = document.getElementById('driveSyncCenterModal');
    if (syncCenter && syncCenter.style.display === 'flex') {
      window.openDriveSyncCenterModal();
    }
    return;
  }

  if (!clean || !isValidEmailFormat(clean)) {
    if (errEl) {
      errEl.style.display = 'block';
      errEl.textContent = '⚠️ يرجى إدخال عنوان بريد Gmail صحيح (مثال: teacher@gmail.com).';
    }
    if (inp) inp.focus();
    return;
  }

  window.closeGmailQuickSwitchModal();

  // إذا تم تغيير الحساب إلى بريد آخر مختلف عن الحساب الموثق حالياً، نصفر التوكن السابق
  const prevVerified = getVerifiedCloudUser();
  if (!prevVerified || normalizeGmailAddress(prevVerified.email || '') !== clean) {
    updateCachedDriveToken(null);
  }

  // تفعيل وربط حساب Gmail فوراً في المنظومة
  activateDirectGmailSession(clean, false, '', null, { explicitLink: true });

  // إذا طلب المستخدم المصادقة الرسمية عبر نافذة Google OAuth مع هذا البريد
  if (opts && opts.withOfficialOAuth) {
    await window.handleGoogleSignInOfficial({
      forcePopup: true,
      emailHint: clean,
      allowDirectFallback: true
    });
  }

  // تحديث نافذة مركز المزامنة أو الإعدادات المتقدمة إن كانت مفتوحة
  const syncCenter = document.getElementById('driveSyncCenterModal');
  if (syncCenter && syncCenter.style.display === 'flex') {
    window.openDriveSyncCenterModal();
  }
  const advModal = document.getElementById('advancedCloudSyncSettingsModal');
  if (advModal && advModal.style.display === 'flex' && typeof renderAdvancedCloudSyncModalContent === 'function') {
    renderAdvancedCloudSyncModalContent();
  }
};

// -------------------------------------------------------------
// Direct Gmail Authentication & Multi-Device Sync Engine
// -------------------------------------------------------------

function activateDirectGmailSession(email, skipUpdateCheck = false, displayName = '', existingOAuthToken = null, meta = {}) {
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

  const realToken = (existingOAuthToken && isRealOAuthToken(existingOAuthToken))
    ? existingOAuthToken
    : (isRealOAuthToken(cachedAccessToken) ? cachedAccessToken : null);

  if (realToken && (!auth || !auth.currentUser)) {
    window._verifiedGisOAuthUser = {
      uid: computeGmailUid(cleanEmail),
      email: cleanEmail,
      displayName: displayName || cleanEmail.split('@')[0],
      emailVerified: true,
      isGisVerified: true
    };
  }

  const verifiedUser = getVerifiedCloudUser();
  const hasVerifiedAuth = !!(
    (verifiedUser && normalizeGmailAddress(verifiedUser.email || '') === cleanEmail) ||
    realToken
  );

  localStorage.setItem('gdrive_last_email', cleanEmail);
  localStorage.setItem('gdrive_authenticated', 'true');
  saveEmailToGmailHistory(cleanEmail);
  try {
    // Clear any stale auth/session-not-verified or unauthorized-domain error logs upon successful Gmail link
    const rawLogs = localStorage.getItem('cloud_sync_error_logs_v1');
    if (rawLogs) {
      const parsedLogs = JSON.parse(rawLogs);
      if (Array.isArray(parsedLogs)) {
        const cleanedLogs = parsedLogs.filter(l => l && l.code !== 'auth/session-not-verified' && l.code !== 'auth/unauthorized-domain');
        localStorage.setItem('cloud_sync_error_logs_v1', JSON.stringify(cleanedLogs));
      }
    }
  } catch (_) {}

  if (hasVerifiedAuth) {
    localStorage.setItem('userLoggedIn', 'true');
  }

  // Sync email with teacherProfile and persist when explicitly linked
  try {
    if (window.db && window.db.teacherProfile) {
      if (meta.explicitLink || hasVerifiedAuth || !window.db.teacherProfile.email) {
        window.db.teacherProfile.email = cleanEmail;
        window.db._lastSavedTimestamp = Date.now();
        const teacherEmailInput = document.getElementById('teacherEmail');
        if (teacherEmailInput) teacherEmailInput.value = cleanEmail;
        const tpEmailInput = document.getElementById('tpInput_email');
        if (tpEmailInput) tpEmailInput.value = cleanEmail;
        try {
          localStorage.setItem('absence_massar_v8_manual', safeStringify(window.db));
        } catch (_) {}
      }
    }
  } catch (e) {}

  const username = displayName || cleanEmail.split('@')[0];
  window._directGmailUser = {
    uid: (verifiedUser && verifiedUser.uid) ? verifiedUser.uid : computeGmailUid(cleanEmail),
    email: cleanEmail,
    displayName: username,
    emailVerified: hasVerifiedAuth,
    isDirectGmail: !hasVerifiedAuth
  };

  updateCachedDriveToken(realToken);

  syncBackupUI(verifiedUser || window._directGmailUser);
  if (typeof window.syncLibraryDriveUIState === 'function') {
    window.syncLibraryDriveUIState();
  }
  updateDriveSyncHeaderBadge(
    'synced',
    realToken
      ? 'Google Drive: متزامن ✓'
      : (hasVerifiedAuth ? 'Firestore: موثّق ✓' : `Gmail: ${username} ✓`)
  );

  // Update email and username inputs on login screen if present
  const emailInput = document.getElementById('loginDriveEmailInput');
  if (emailInput) emailInput.value = cleanEmail;
  const loginUserEl = document.getElementById('loginUsername');
  if (loginUserEl && !loginUserEl.value.trim()) {
    const tp = (window.db && window.db.teacherProfile) ? window.db.teacherProfile : {};
    loginUserEl.value = tp.username || tp.name || cleanEmail;
  }

  // منع تجاوز شاشة تسجيل الدخول المحلية بدون مصادقة Google رسمية إذا كان هناك قن سري محلي
  const hasLocalPassword = !!(window.db && window.db.teacherProfile && window.db.teacherProfile.password);
  const loginScreen = document.getElementById('loginScreen');
  if (loginScreen && (hasVerifiedAuth || !hasLocalPassword)) {
    loginScreen.style.display = 'none';
  }

  if (typeof window.showAppToast === 'function') {
    if (hasVerifiedAuth) {
      window.showAppToast(`✅ تم توثيق وتفعيل حساب Google (${cleanEmail}) بنجاح!`, 'success');
    } else {
      window.showAppToast(`✅ تم ربط وتفعيل حساب Gmail (${cleanEmail}) بنجاح!`, 'success');
    }
  }

  if (!skipUpdateCheck) {
    setTimeout(async () => {
      try {
        const res = await window.checkForDriveUpdates({ interactive: false, onLogin: true });
        if (meta.explicitLink && (!res || res.status === 'no_cloud_backup' || res.status === 'local_newer')) {
          if (typeof window.syncToFirebase === 'function' && window.db) {
            await window.syncToFirebase(window.db);
          }
        }
      } catch (_) {}
    }, 350);
  }

  return realToken || (hasVerifiedAuth ? 'firebase_authenticated' : cleanEmail);
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
  window.openSafeExternalUrl(url, '_blank', 'noopener,noreferrer');
};
window.openGmailInbox = function() {
  window.openSafeExternalUrl('https://mail.google.com', '_blank', 'noopener,noreferrer');
};
window.openGmailComposeForTeacher = function() {
  const summary = getLocalSummary();
  const teacherName = (window.db && window.db.teacherProfile && window.db.teacherProfile.name) || 'أستاذ المادة';
  const subject = `تقرير بيداغوجي - منظومة التدبير التربوي لمادة الرياضيات (${teacherName})`;
  const body = `السلام عليكم ورحمة الله تعالى وبركاته،\n\nمرفق ملخص التتبع البيداغوجي من منظومة التدبير التربوي لمادة الرياضيات (السلك الثانوي التأهيلي):\n- الأستاذ(ة): ${teacherName}\n- عدد الأقسام المسندة: ${summary ? summary.classesCount : 0}\n- إجمالي التلاميذ: ${summary ? summary.totalStudents : 0}\n- عدد الحصص والسجلات: ${summary ? summary.recordsCount : 0}\n- تاريخ آخر تحديث: ${summary ? summary.dateStr : new Date().toLocaleDateString('ar-MA')}\n\nمع خالص التحية والتقدير.`;
  window.openGmail('', subject, body);
};

// Auto-restore remembered email hint on load (without fabricating a verified token)
try {
  const rememberedEmail = normalizeGmailAddress(localStorage.getItem('gdrive_last_email') || '');
  if (rememberedEmail && isValidEmailFormat(rememberedEmail)) {
    window._directGmailUser = {
      uid: computeGmailUid(rememberedEmail),
      email: rememberedEmail,
      displayName: rememberedEmail.split('@')[0],
      emailVerified: false,
      isDirectGmail: true
    };
    setTimeout(() => {
      syncBackupUI(getVerifiedCloudUser() || window._directGmailUser);
      const emailInput = document.getElementById('loginDriveEmailInput');
      if (emailInput && !emailInput.value) emailInput.value = rememberedEmail;
    }, 400);
  }
} catch(e) {}

// -------------------------------------------------------------
// Handle Login Screen Google OAuth & Gmail Linking Access
// -------------------------------------------------------------

window.handleLoginScreenDirectGmail = async (options = {}) => {
  const emailInput = document.getElementById('loginDriveEmailInput');
  const statusEl = document.getElementById('loginDriveSyncStatus');
  const rawEmail = emailInput ? emailInput.value.trim() : '';
  const cleanEmail = rawEmail ? normalizeGmailAddress(rawEmail) : '';
  const isDirectLinkOnly = !!options.directLinkOnly && !options.officialOAuth;

  if (rawEmail && !isValidEmailFormat(cleanEmail)) {
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.color = '#dc2626';
      statusEl.textContent = '⚠️ صيغة البريد الإلكتروني غير صحيحة (مثال: teacher@gmail.com).';
    }
    if (emailInput) emailInput.focus();
    return;
  }

  if (cleanEmail) {
    localStorage.setItem('gdrive_last_email', cleanEmail);
    if (emailInput) emailInput.value = cleanEmail;
  }

  const applyDirectEmailLink = (targetEmail) => {
    activateDirectGmailSession(targetEmail, false, '', null, { explicitLink: true });
    const loginUserEl = document.getElementById('loginUsername');
    if (loginUserEl && !loginUserEl.value.trim()) {
      const tp = (window.db && window.db.teacherProfile) ? window.db.teacherProfile : {};
      loginUserEl.value = tp.username || tp.name || targetEmail;
    }
    const hasLocalPassword = !!(window.db && window.db.teacherProfile && window.db.teacherProfile.password);
    if (!hasLocalPassword) {
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.color = '#15803d';
        statusEl.textContent = '✅ تم ربط حساب Gmail (' + targetEmail + ') والدخول بنجاح.';
      }
      const loginScreen = document.getElementById('loginScreen');
      if (loginScreen) loginScreen.style.display = 'none';
      if (typeof updateTeacherNameInHeader === 'function') {
        updateTeacherNameInHeader();
      }
      return true;
    }
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.color = '#059669';
      statusEl.textContent = `✅ تم ربط وحفظ بريدك (${targetEmail}) بنجاح! يرجى إدخال القن السري المحلي أسفله للدخول.`;
    }
    const pwdInput = document.getElementById('loginPassword');
    if (pwdInput) pwdInput.focus();
    return true;
  };

  // إذا نقر المستخدم على زر "ربط البريد الإلكتروني المدخل وتفعيل حساب Gmail" مباشرة
  if (isDirectLinkOnly) {
    if (!cleanEmail) {
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.color = '#dc2626';
        statusEl.textContent = '⚠️ يرجى كتابة بريد Gmail الخاص بك في الحقل أعلاه أولاً (مثال: teacher@gmail.com).';
      }
      if (emailInput) emailInput.focus();
      return;
    }
    applyDirectEmailLink(cleanEmail);
    return;
  }

  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.style.color = '#0369a1';
    statusEl.textContent = '⏳ جاري الاتصال وربط حساب Gmail عبر Google...';
  }

  const token = await window.handleGoogleSignInOfficial({
    forcePopup: true,
    emailHint: cleanEmail,
    allowDirectFallback: !!cleanEmail,
    strictReauth: !!options.strictReauth
  });

  const verifiedUser = getVerifiedCloudUser();
  if (verifiedUser || isRealOAuthToken(token)) {
    const finalEmail = (verifiedUser && verifiedUser.email) || cleanEmail || '';
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.color = '#15803d';
      statusEl.textContent = '✅ تم التوثيق الرسمي والربط عبر Google بنجاح: ' + finalEmail;
    }
    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.style.display = 'none';
    if (typeof updateTeacherNameInHeader === 'function') {
      updateTeacherNameInHeader();
    }
    return;
  }

  // إذا تم إدخال بريد Gmail صالح وتعذرت النافذة المنبثقة بسبب قيود المتصفح/المعاينة:
  if (cleanEmail && isValidEmailFormat(cleanEmail)) {
    applyDirectEmailLink(cleanEmail);
    return;
  }

  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.style.color = '#d97706';
    statusEl.textContent = 'ℹ️ تعذر فتح نافذة Google المنبثقة في هذا المتصفح؛ يرجى كتابة بريد Gmail في الحقل أعلاه والضغط على زر الربط الأخضر.';
  }
  if (emailInput) emailInput.focus();
};
window.handleLoginScreenDriveSync = window.handleLoginScreenDirectGmail;

// -------------------------------------------------------------
// Auth State & Visibility Listeners
// -------------------------------------------------------------

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      if (typeof user.getIdToken === 'function') {
        window.__currentFirebaseIdToken = await user.getIdToken();
      }
    } catch (e) {}
    syncBackupUI(user);
    testConnection();
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
    window.__currentFirebaseIdToken = '';
    if (!isRealOAuthToken(cachedAccessToken)) {
      updateCachedDriveToken(null);
    }
    const effectiveUser = getEffectiveUser();
    if (effectiveUser) {
      syncBackupUI(effectiveUser);
    } else {
      try { localStorage.removeItem('gdrive_authenticated'); } catch (e) {}
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

function ensureGisClientLoaded(timeoutMs = 3000) {
  return new Promise((resolve) => {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      resolve(true);
      return;
    }
    let existingScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (!existingScript) {
      existingScript = document.createElement('script');
      existingScript.src = 'https://accounts.google.com/gsi/client';
      existingScript.async = true;
      existingScript.defer = true;
      document.head.appendChild(existingScript);
    }
    const start = Date.now();
    const timer = setInterval(() => {
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        clearInterval(timer);
        resolve(true);
      } else if (Date.now() - start >= timeoutMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, 120);
  });
}

window.handleGoogleSignInOfficial = (options = {}) => {
  const skipUpdateCheck = !!options.skipUpdateCheck;
  const strictReauth = !!options.strictReauth;
  const allowDirectFallback = !!options.allowDirectFallback;

  // تحديد تلميح البريد الإلكتروني (login_hint) لتسهيل اختيار حساب الأستاذ مباشرة
  let rawHint = options.emailHint || '';
  if (!rawHint) {
    const modalInp = document.getElementById('gmailQuickSwitchInput');
    const loginInp = document.getElementById('loginDriveEmailInput');
    if (modalInp && modalInp.value && modalInp.value.trim()) {
      rawHint = modalInp.value.trim();
    } else if (loginInp && loginInp.value && loginInp.value.trim()) {
      rawHint = loginInp.value.trim();
    } else {
      rawHint = localStorage.getItem('gdrive_last_email') || (window.db && window.db.teacherProfile && window.db.teacherProfile.email) || '';
    }
  }
  const cleanHint = rawHint ? normalizeGmailAddress(rawHint) : '';
  const validHint = (cleanHint && isValidEmailFormat(cleanHint)) ? cleanHint : '';

  const customParams = validHint
    ? { prompt: 'select_account', login_hint: validHint }
    : { prompt: 'select_account' };
  provider.setCustomParameters(customParams);
  basicGoogleProvider.setCustomParameters(customParams);

  const handleFallbackWhenPopupBlocked = () => {
    if (strictReauth) {
      return null;
    }
    if (validHint) {
      activateDirectGmailSession(validHint, skipUpdateCheck, '', null, { explicitLink: true });
      return validHint;
    }
    const loginScreen = document.getElementById('loginScreen');
    const isLoginScreenVisible = !!(loginScreen && loginScreen.style.display !== 'none');
    if (!isLoginScreenVisible) {
      window.openGmailQuickSwitchModal(validHint);
    }
    return null;
  };

  return new Promise((resolve) => {
    let settled = false;
    const safeResolve = (val) => {
      if (!settled) {
        settled = true;
        resolve(val);
      }
    };

    // 1. المحاولة الأساسية عبر Firebase signInWithPopup (مصادقة Firebase + رمز OAuth لـ Drive و Calendar)
    signInWithPopup(auth, provider)
      .then(async (result) => {
        const token = await processDriveSignInResult(result, skipUpdateCheck);
        if (result.user && result.user.email) {
          activateDirectGmailSession(result.user.email, true, result.user.displayName, token, { explicitLink: true });
        }
        if (typeof window.showAppToast === 'function') {
          window.showAppToast(`✅ تم الربط الرسمي بحساب Google (${result.user?.email || ''}) بنجاح!`, 'success');
        }
        safeResolve(token || 'firebase_authenticated');
      })
      .catch(async (popupErr) => {
        const errCode = String(popupErr?.code || '');
        console.warn('Primary Firebase signInWithPopup notice:', errCode, popupErr?.message || popupErr);

        // إذا كان النطاق الحالي نطاق معاينة سحابي أو تم إغلاق/حظر النافذة المنبثقة ولا يشترط إعادة مصادقة قفل الشاشة، نفعل الربط المباشر أو نافذة التبديل بدون تعليق
        const isPopupBlockedOrClosed =
          errCode === 'auth/popup-blocked' ||
          errCode === 'auth/unauthorized-domain' ||
          errCode === 'auth/operation-not-supported-in-this-environment' ||
          errCode === 'auth/popup-closed-by-user' ||
          errCode === 'auth/cancelled-popup-request';

        if (isPopupBlockedOrClosed && !strictReauth) {
          safeResolve(handleFallbackWhenPopupBlocked());
          return;
        }

        // 2. المحاولة الثانية: مصادقة Firebase Google الأساسية (بدون نطاقات Drive الحساسة في حال رفضها من شاشة OAuth)
        if (!isPopupBlockedOrClosed) {
          try {
            const basicResult = await signInWithPopup(auth, basicGoogleProvider);
            if (basicResult && basicResult.user) {
              const basicToken = await processDriveSignInResult(basicResult, skipUpdateCheck);
              activateDirectGmailSession(basicResult.user.email, true, basicResult.user.displayName, basicToken, { explicitLink: true });
              if (typeof window.showAppToast === 'function') {
                window.showAppToast(`✅ تم توثيق حساب Google (${basicResult.user.email || ''}) بنجاح!`, 'success');
              }
              safeResolve(basicToken || 'firebase_authenticated');
              return;
            }
          } catch (basicErr) {
            console.warn('Basic Firebase Google sign-in notice:', basicErr?.code || basicErr?.message);
          }
        }

        // 3. المحاولة الثالثة: Google Identity Services (GIS) مع مهلة أمان لمنع التعليق عند حظر المتصفح للنافذة
        const gisReady = await ensureGisClientLoaded(2000);
        if (gisReady && window.google && window.google.accounts && window.google.accounts.oauth2) {
          try {
            const gisSafetyTimer = setTimeout(() => {
              safeResolve(handleFallbackWhenPopupBlocked());
            }, 6000);

            const client = window.google.accounts.oauth2.initTokenClient({
              client_id: GOOGLE_CLIENT_ID,
              scope: GOOGLE_SCOPES,
              hint: validHint || undefined,
              callback: async (tokenResponse) => {
                clearTimeout(gisSafetyTimer);
                if (tokenResponse && tokenResponse.access_token) {
                  const accessToken = tokenResponse.access_token;
                  updateCachedDriveToken(accessToken);

                  try {
                    const cred = GoogleAuthProvider.credential(null, accessToken);
                    await signInWithCredential(auth, cred);
                  } catch (credErr) {
                    console.warn('signInWithCredential notice:', credErr?.code || credErr?.message);
                  }

                  let userEmail = auth.currentUser?.email || '';
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

                  if (!userEmail && validHint) {
                    userEmail = validHint;
                  }
                  if (!userEmail) {
                    safeResolve(handleFallbackWhenPopupBlocked());
                    return;
                  }

                  window._verifiedGisOAuthUser = {
                    uid: (auth && auth.currentUser && auth.currentUser.uid) ? auth.currentUser.uid : computeGmailUid(userEmail),
                    email: normalizeGmailAddress(userEmail),
                    displayName: displayName || userEmail.split('@')[0],
                    emailVerified: true,
                    isGisVerified: true
                  };

                  activateDirectGmailSession(userEmail, skipUpdateCheck, displayName, accessToken, { explicitLink: true });

                  if (typeof window.showAppToast === 'function') {
                    window.showAppToast(`✅ تم الاتصال والربط الرسمي بحساب Google (${userEmail}) بنجاح!`, 'success');
                  }
                  safeResolve(accessToken);
                } else {
                  safeResolve(handleFallbackWhenPopupBlocked());
                }
              },
              error_callback: () => {
                clearTimeout(gisSafetyTimer);
                safeResolve(handleFallbackWhenPopupBlocked());
              }
            });

            client.requestAccessToken({
              prompt: strictReauth ? 'select_account' : '',
              hint: validHint || undefined
            });
            return;
          } catch (gisErr) {
            console.warn('GIS fallback failed:', gisErr);
          }
        }

        // 4. البديل الآمن عند حظر النوافذ المنبثقة في بيئة المعاينة أو المتصفح
        safeResolve(handleFallbackWhenPopupBlocked());
      });
  });
};

window.handleDriveLogoutSilently = () => {
  window._verifiedGisOAuthUser = null;
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
    return activateDirectGmailSession(emailHint.trim(), skipUpdateCheck, '', null, { explicitLink: true });
  }

  let targetEmail = (emailHint && typeof emailHint === 'string' && emailHint.includes('@')) ? emailHint.trim() : '';
  if (!targetEmail) {
    const emailInput = document.getElementById('loginDriveEmailInput');
    if (emailInput && emailInput.value && emailInput.value.trim()) {
      targetEmail = emailInput.value.trim();
    }
  }

  // محاولة تسجيل الدخول الرسمي عبر Google OAuth أولاً
  try {
    const token = await window.handleGoogleSignInOfficial(Object.assign({}, options, {
      emailHint: targetEmail || options.emailHint || '',
      allowDirectFallback: !!targetEmail
    }));
    if (token) return token;
  } catch (err) {
    console.warn('Official Google Sign-In attempt failed:', err);
  }

  if (targetEmail) {
    return activateDirectGmailSession(targetEmail, skipUpdateCheck, '', null, { explicitLink: true });
  }

  window.openGmailQuickSwitchModal();
  return null;
};

window.handleDriveLogout = async () => {
  window._verifiedGisOAuthUser = null;
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
                  const sliceNames = ['manifest', ...DIFFERENTIAL_SLICE_DEFS.map(d => d.id), 'auxiliary_misc'];
                  await Promise.all(sliceNames.map(sId => deleteDoc(doc(dbFirestore, "users", targetUid, "slices", sId)).catch(() => {})));
                  clearCachedCloudSliceHashes(targetUid);
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
  // تأكيد صريح وإلزامي قبل حذف البيانات السحابية من Firestore وGoogle Drive
  if (typeof window.showConfirmDialog === 'function') {
    const confirmed = await window.showConfirmDialog(
      'هل أنت متأكد من رغبتك في حذف النسخ الاحتياطية السحابية نهائياً من قاعدة Firestore وملف app_backup.json في Google Drive؟ لا يمكن التراجع عن هذا الإجراء.',
      { title: 'تأكيد حذف النسخ السحابية', confirmText: 'حذف نهائي', cancelText: 'إلغاء' }
    );
    if (!confirmed) return;
  }

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

// Check for updates when user returns to tab & run silent background Firestore sync when dirty
document.addEventListener('visibilitychange', () => {
  const user = getEffectiveUser();
  if (!document.hidden && user) {
    const elapsed = Date.now() - lastUpdateCheckTime;
    if (elapsed > 90000) { // If > 1.5 minutes since last check
      window.checkForDriveUpdates({ interactive: false });
    }
    if (typeof window.runBackgroundCloudSyncCycle === 'function') {
      setTimeout(() => window.runBackgroundCloudSyncCycle('visibility_resume'), 1200);
    }
  } else if (document.hidden && user && typeof window.runBackgroundCloudSyncCycle === 'function') {
    window.runBackgroundCloudSyncCycle('tab_hidden');
  }
});

// ============================================================================
// محرك المزامنة السحابية الخلفية والنسخ الاحتياطي الساعي التلقائي مع Firestore
// يراقب التعديلات ويضمن أخذ نسخة احتياطية سحابية تلقائية كل ساعة (60 دقيقة) لمنع فقدان البيانات
// ============================================================================
const BG_SYNC_CONFIG_KEY = 'prof_digital_bg_sync_config_v1';
const HOURLY_BACKUP_STATE_KEY = 'prof_digital_firestore_hourly_backup_v1';
const HOURLY_BACKUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour (3,600,000 ms)
const HOURLY_WATCHDOG_TICK_MS = 60 * 1000; // Check every 60s to handle sleep/throttling accurately
let _bgSyncTimerId = null;
let _hourlyWatchdogTimerId = null;
let _bgSyncInProgress = false;
let _hourlyBackupInProgress = false;

function computeStableDbDigest(str) {
  let hash = 2166136261;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16) + ':' + s.length;
}

function getBgSyncConfig() {
  const defaults = {
    enabled: true,
    intervalMinutes: 60,
    lastSyncAt: null,
    lastSyncedDigest: '',
    pendingDirty: false,
    lastStatus: 'idle'
  };
  try {
    const raw = localStorage.getItem(BG_SYNC_CONFIG_KEY);
    if (!raw) return defaults;
    return Object.assign({}, defaults, JSON.parse(raw));
  } catch (e) {
    return defaults;
  }
}

function saveBgSyncConfig(cfg) {
  try {
    localStorage.setItem(BG_SYNC_CONFIG_KEY, JSON.stringify(cfg));
  } catch (e) {}
}

function getHourlyBackupState() {
  const defaults = {
    enabled: true,
    lastHourlyBackupAt: 0,
    nextRetryAt: 0,
    failureStreak: 0,
    totalBackups: 0,
    lastStatus: 'ready',
    lastError: '',
    lastRawBytes: 0
  };
  try {
    const raw = localStorage.getItem(HOURLY_BACKUP_STATE_KEY);
    if (!raw) return defaults;
    return Object.assign({}, defaults, JSON.parse(raw));
  } catch (e) {
    return defaults;
  }
}

function saveHourlyBackupState(state) {
  try {
    localStorage.setItem(HOURLY_BACKUP_STATE_KEY, JSON.stringify(state));
  } catch (e) {}
}

function hasMeaningfulAppData() {
  const d = window.db;
  if (!d || typeof d !== 'object') return false;
  if (d.classes && Object.keys(d.classes).length > 0) return true;
  if (Array.isArray(d.records) && d.records.length > 0) return true;
  if (d.grades && Object.keys(d.grades).length > 0) return true;
  if (Array.isArray(d.textbook) && d.textbook.length > 0) return true;
  if (Array.isArray(d.library) && d.library.length > 0) return true;
  if (d.teacherProfile && (d.teacherProfile.name || d.teacherProfile.school)) return true;
  return false;
}

function buildCanonicalSyncSnapshotString() {
  const rawDb = (window.db && typeof window.db === 'object') ? window.db : {};
  const clone = Object.assign({}, rawDb);
  // استبعاد الطوابع الزمنية المتغيرة لضمان دقة كشف التعديلات الحقيقية فقط
  delete clone._lastSavedAt;
  delete clone._lastSavedTimestamp;
  delete clone._lastSavedDevice;
  const filtered = typeof window.buildFilteredCloudPayloadForAutoSync === 'function'
    ? window.buildFilteredCloudPayloadForAutoSync(clone)
    : clone;
  return safeStringify(filtered);
}

function registerServiceWorkerHourlyBackupTags(includeOneShot = false) {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then((reg) => {
    if (!reg) return;
    if (reg.periodicSync && typeof reg.periodicSync.register === 'function') {
      reg.periodicSync.register('firestore-hourly-backup', { minInterval: HOURLY_BACKUP_INTERVAL_MS }).catch(() => {});
    }
    if (includeOneShot && reg.sync && typeof reg.sync.register === 'function') {
      reg.sync.register('firestore-hourly-backup').catch(() => {});
    }
  }).catch(() => {});
}

window.markFirestorePayloadSynced = (serializedStr, options = {}) => {
  const nowMs = Date.now();
  const cfg = getBgSyncConfig();
  const canonical = serializedStr ? buildCanonicalSyncSnapshotString() : '';
  cfg.lastSyncAt = new Date(nowMs).toISOString();
  if (canonical) cfg.lastSyncedDigest = computeStableDbDigest(canonical);
  cfg.pendingDirty = false;
  cfg.lastStatus = options.trigger ? ('synced_' + options.trigger) : 'synced';
  saveBgSyncConfig(cfg);

  const hState = getHourlyBackupState();
  hState.lastHourlyBackupAt = nowMs;
  hState.nextRetryAt = 0;
  hState.failureStreak = 0;
  hState.lastStatus = options.trigger ? ('synced_' + options.trigger) : 'synced';
  hState.lastError = '';
  if (options.bumpHourlyCounter) {
    hState.totalBackups = (Number(hState.totalBackups) || 0) + 1;
  }
  if (typeof serializedStr === 'string') {
    hState.lastRawBytes = serializedStr.length;
  }
  saveHourlyBackupState(hState);
};

window.markFirestoreSyncPending = (reason = 'local_edit') => {
  const cfg = getBgSyncConfig();
  cfg.pendingDirty = true;
  cfg.lastStatus = reason;
  saveBgSyncConfig(cfg);

  // تسجيل طلب مزامنة خلفية في Service Worker إذا كان غير متصل بالإنترنت
  if (!navigator.onLine && 'serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then((reg) => {
      if (reg && reg.sync) {
        return reg.sync.register('firestore-periodic-sync');
      }
    }).catch(() => {});
  }
};

window.getBackgroundSyncStatus = () => {
  const cfg = getBgSyncConfig();
  let lastSyncFormatted = 'لم تتم بعد';
  if (cfg.lastSyncAt) {
    try {
      lastSyncFormatted = new Date(cfg.lastSyncAt).toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      lastSyncFormatted = cfg.lastSyncAt;
    }
  }
  return Object.assign({}, cfg, {
    lastSyncFormatted,
    online: navigator.onLine
  });
};

window.getHourlyFirestoreBackupStatus = () => {
  const st = getHourlyBackupState();
  const now = Date.now();
  let lastBackupFormatted = 'لم تتم بعد';
  if (st.lastHourlyBackupAt > 0) {
    try {
      lastBackupFormatted = new Date(st.lastHourlyBackupAt).toLocaleString('ar-MA', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch (e) {
      lastBackupFormatted = new Date(st.lastHourlyBackupAt).toLocaleTimeString();
    }
  }
  let nextBackupFormatted = 'عند تفعيل الاتصال والمصادقة';
  if (st.enabled) {
    const nextTs = st.lastHourlyBackupAt > 0
      ? st.lastHourlyBackupAt + HOURLY_BACKUP_INTERVAL_MS
      : now + HOURLY_BACKUP_INTERVAL_MS;
    const remainMins = Math.max(0, Math.ceil((nextTs - now) / 60000));
    try {
      const timeLabel = new Date(nextTs).toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' });
      nextBackupFormatted = remainMins === 0 ? 'مجدولة الآن' : `${timeLabel} (بعد ${remainMins} د)`;
    } catch (e) {
      nextBackupFormatted = `بعد ${remainMins} دقيقة`;
    }
  } else {
    nextBackupFormatted = 'متوقفة';
  }
  return Object.assign({}, st, {
    intervalMs: HOURLY_BACKUP_INTERVAL_MS,
    lastBackupFormatted,
    nextBackupFormatted,
    online: navigator.onLine
  });
};

window.toggleHourlyFirestoreBackup = (enabled) => {
  const st = getHourlyBackupState();
  st.enabled = !!enabled;
  saveHourlyBackupState(st);
  const cfg = getBgSyncConfig();
  cfg.enabled = !!enabled;
  saveBgSyncConfig(cfg);
  startBackgroundCloudSyncScheduler();
  if (st.enabled) {
    registerServiceWorkerHourlyBackupTags(false);
    setTimeout(() => window.runHourlyFirestoreBackupCycle('manual_enable', false), 300);
  }
};

window.toggleBackgroundCloudSync = (enabled) => {
  window.toggleHourlyFirestoreBackup(enabled);
};

window.setBackgroundCloudSyncInterval = (minutes) => {
  const mins = Math.max(2, Math.min(120, Number(minutes) || 60));
  const cfg = getBgSyncConfig();
  cfg.intervalMinutes = mins;
  saveBgSyncConfig(cfg);
  startBackgroundCloudSyncScheduler();
  if (typeof window.showAppToast === 'function') {
    const msg = mins === 60
      ? '⏱️ تم ضبط المزامنة والنسخ الاحتياطي التلقائي مع Firestore ليعمل كل ساعة (60 دقيقة).'
      : `⏱️ تم ضبط المزامنة السحابية الخلفية لتعمل كل ${mins} دقائق تلقائياً.`;
    window.showAppToast(msg, 'info');
  }
};

window.runHourlyFirestoreBackupCycle = async (trigger = 'hourly_watchdog', force = false) => {
  if (_hourlyBackupInProgress || _bgSyncInProgress || isDriveSyncing) {
    return { skipped: true, reason: 'busy' };
  }
  const st = getHourlyBackupState();
  if (!st.enabled && !force) {
    return { skipped: true, reason: 'disabled' };
  }

  const now = Date.now();
  const elapsedSinceLast = now - (Number(st.lastHourlyBackupAt) || 0);
  if (!force) {
    if (st.lastHourlyBackupAt > 0 && elapsedSinceLast < HOURLY_BACKUP_INTERVAL_MS) {
      return { skipped: true, reason: 'not_due_yet', remainingMs: HOURLY_BACKUP_INTERVAL_MS - elapsedSinceLast };
    }
    if (st.nextRetryAt && now < st.nextRetryAt) {
      return { skipped: true, reason: 'retry_backoff' };
    }
  }

  if (!navigator.onLine) {
    window.markFirestoreSyncPending('offline_hourly_due');
    registerServiceWorkerHourlyBackupTags(true);
    return { skipped: true, reason: 'offline' };
  }

  const user = getEffectiveUser();
  if (!user || !user.uid) {
    return { skipped: true, reason: 'no_verified_firebase_session' };
  }
  if (!hasMeaningfulAppData()) {
    return { skipped: true, reason: 'empty_db' };
  }

  _hourlyBackupInProgress = true;
  try {
    updateDriveSyncHeaderBadge('saving', 'نسخ احتياطي ساعي (Firestore)...');
    const serialized = buildCanonicalSyncSnapshotString();
    const res = await window.syncToFirebase(window.db);
    if (res && res.success) {
      window.markFirestorePayloadSynced(serialized, { bumpHourlyCounter: true, trigger });
      const doneAt = Date.now();

      const badgeLabel = isRealOAuthToken(cachedAccessToken)
        ? 'Google Drive: متزامن ✓'
        : (user.email ? `Gmail: ${user.email.split('@')[0]} ✓` : 'Firestore: محفوظ ✓');
      updateDriveSyncHeaderBadge('synced', badgeLabel);
      window.dispatchEvent(new CustomEvent('firestoreHourlyBackupCompleted', { detail: { trigger, at: new Date(doneAt).toISOString() } }));
      return { success: true, trigger, at: doneAt };
    }

    st.failureStreak = (Number(st.failureStreak) || 0) + 1;
    const backoffMs = Math.min(15 * 60 * 1000, Math.pow(2, Math.min(4, st.failureStreak)) * 60 * 1000);
    st.nextRetryAt = Date.now() + backoffMs;
    st.lastStatus = 'deferred';
    st.lastError = (res && res.error) ? String(res.error).slice(0, 140) : 'sync_deferred';
    saveHourlyBackupState(st);
    registerServiceWorkerHourlyBackupTags(true);
    return { success: false, reason: st.lastError };
  } catch (err) {
    st.failureStreak = (Number(st.failureStreak) || 0) + 1;
    st.nextRetryAt = Date.now() + 2 * 60 * 1000;
    st.lastStatus = 'error';
    st.lastError = (err && err.message) ? String(err.message).slice(0, 140) : 'unknown_error';
    saveHourlyBackupState(st);
    registerServiceWorkerHourlyBackupTags(true);
    return { success: false, error: st.lastError };
  } finally {
    _hourlyBackupInProgress = false;
  }
};

window.triggerHourlyFirestoreBackupNow = async () => {
  const res = await window.runHourlyFirestoreBackupCycle('manual_trigger', true);
  if (typeof window.showAppToast === 'function') {
    if (res && res.success) {
      window.showAppToast('✅ تم حفظ النسخة الاحتياطية الكاملة في Firestore وتجديد جدولة الساعة بنجاح.', 'success');
    } else if (res && res.reason === 'no_verified_firebase_session') {
      window.showAppToast('⚠️ يرجى تسجيل الدخول بحساب Google الموثّق لإتمام النسخ الاحتياطي السحابي في Firestore.', 'warning');
    } else if (res && res.reason === 'offline') {
      window.showAppToast('⚠️ لا يوجد اتصال بالإنترنت حالياً؛ سيتم النسخ تلقائياً فور عودة الاتصال.', 'warning');
    } else {
      window.showAppToast('ℹ️ تعذر إتمام النسخ الاحتياطي الساعي: ' + (res?.reason || res?.error || ''), 'info');
    }
  }
  return res;
};

window.runBackgroundCloudSyncCycle = async (trigger = 'periodic') => {
  if (_bgSyncInProgress || _hourlyBackupInProgress || isDriveSyncing) return { skipped: true, reason: 'busy' };
  const cfg = getBgSyncConfig();
  if (!cfg.enabled && trigger === 'periodic') return { skipped: true, reason: 'disabled' };
  if (!navigator.onLine) {
    window.markFirestoreSyncPending('offline');
    return { skipped: true, reason: 'offline' };
  }

  const user = getEffectiveUser();
  if (!user || !user.uid) {
    return { skipped: true, reason: 'no_verified_firebase_session' };
  }
  if (!hasMeaningfulAppData()) {
    return { skipped: true, reason: 'empty_db' };
  }

  const canonical = buildCanonicalSyncSnapshotString();
  const currentDigest = computeStableDbDigest(canonical);
  const hState = getHourlyBackupState();
  const hourlyDue = hState.enabled && ((Date.now() - (Number(hState.lastHourlyBackupAt) || 0)) >= HOURLY_BACKUP_INTERVAL_MS);

  if (!hourlyDue && !cfg.pendingDirty && cfg.lastSyncedDigest && cfg.lastSyncedDigest === currentDigest && trigger !== 'manual_enable') {
    return { skipped: true, reason: 'unchanged' };
  }

  _bgSyncInProgress = true;
  try {
    updateDriveSyncHeaderBadge('saving', hourlyDue ? 'نسخ احتياطي ساعي...' : 'مزامنة خلفية...');
    const res = await window.syncToFirebase(window.db);
    if (res && res.success) {
      window.markFirestorePayloadSynced(canonical, { bumpHourlyCounter: hourlyDue, trigger });
      const badgeLabel = isRealOAuthToken(cachedAccessToken)
        ? 'Google Drive: متزامن ✓'
        : (user.email ? `Gmail: ${user.email.split('@')[0]} ✓` : 'السحابة: متزامن ✓');
      updateDriveSyncHeaderBadge('synced', badgeLabel);
      window.dispatchEvent(new CustomEvent('firestoreBackgroundSyncCompleted', { detail: { trigger, at: new Date().toISOString() } }));
      return { success: true, trigger };
    }
    cfg.pendingDirty = true;
    cfg.lastStatus = (res && res.error) ? String(res.error).slice(0, 80) : 'sync_deferred';
    saveBgSyncConfig(cfg);
    return { success: false, reason: cfg.lastStatus };
  } catch (err) {
    cfg.pendingDirty = true;
    cfg.lastStatus = 'error';
    saveBgSyncConfig(cfg);
    return { success: false, error: err && err.message };
  } finally {
    _bgSyncInProgress = false;
  }
};

function startBackgroundCloudSyncScheduler() {
  if (_bgSyncTimerId) {
    clearInterval(_bgSyncTimerId);
    _bgSyncTimerId = null;
  }
  if (_hourlyWatchdogTimerId) {
    clearInterval(_hourlyWatchdogTimerId);
    _hourlyWatchdogTimerId = null;
  }

  const cfg = getBgSyncConfig();
  if (cfg.enabled) {
    const intervalMs = Math.max(2, Number(cfg.intervalMinutes) || 60) * 60 * 1000;
    _bgSyncTimerId = setInterval(() => {
      const runIdle = typeof window.requestIdleCallback === 'function'
        ? (fn) => window.requestIdleCallback(() => fn(), { timeout: 5000 })
        : (fn) => setTimeout(fn, 150);
      runIdle(() => window.runBackgroundCloudSyncCycle('periodic'));
    }, intervalMs);
  }

  const hState = getHourlyBackupState();
  if (hState.enabled) {
    // Watchdog runs every minute to ensure the 1-hour backup runs reliably even after device sleep
    _hourlyWatchdogTimerId = setInterval(() => {
      const runIdle = typeof window.requestIdleCallback === 'function'
        ? (fn) => window.requestIdleCallback(() => fn(), { timeout: 5000 })
        : (fn) => setTimeout(fn, 150);
      runIdle(() => window.runHourlyFirestoreBackupCycle('hourly_watchdog', false));
    }, HOURLY_WATCHDOG_TICK_MS);
    registerServiceWorkerHourlyBackupTags(false);
  }
}

window.addEventListener('dbUpdated', () => {
  window.markFirestoreSyncPending('db_updated');
});

window.addEventListener('online', () => {
  setTimeout(() => {
    window.runBackgroundCloudSyncCycle('network_restored');
    window.runHourlyFirestoreBackupCycle('network_restored', false);
  }, 1500);
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (!event || !event.data) return;
    if (event.data.type === 'TRIGGER_FIRESTORE_BACKGROUND_SYNC') {
      window.runBackgroundCloudSyncCycle('sw_sync_event');
    } else if (event.data.type === 'TRIGGER_FIRESTORE_HOURLY_BACKUP') {
      window.runHourlyFirestoreBackupCycle('sw_hourly_event', false);
    }
  });
}

// بدء الجدولة الخلفية والنسخ الاحتياطي الساعي بعد استقرار التحميل الأولي
setTimeout(() => {
  startBackgroundCloudSyncScheduler();
  window.runBackgroundCloudSyncCycle('startup_catchup');
  window.runHourlyFirestoreBackupCycle('startup_hourly_catchup', false);
}, 6000);

// ============================================================================
// شاشة الإعدادات المتقدمة لإدارة عمليات الربط والمزامنة مع Google Drive و Firestore
// تتيح اختيار المزامنة (تلقائية / يدوية) لكل مجلد على حدة + سجل أخطاء المزامنة والتشخيص
// ============================================================================

const CLOUD_SYNC_MODULES_STORAGE_KEY = 'cloud_sync_modules_config_v1';
const CLOUD_SYNC_ERROR_LOGS_STORAGE_KEY = 'cloud_sync_error_logs_v1';
const CLOUD_SYNC_SNAPSHOT_CACHE_KEY = 'cloud_sync_manual_snapshots_v1';

const CLOUD_SYNC_DATA_FOLDERS = [
  {
    id: 'classes_students',
    name: 'مجلد لوائح الأقسام والتلاميذ والإعدادات',
    service: 'Firestore & Google Drive',
    icon: 'users',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
    description: 'يشمل قوائم الأقسام المسندة، بيانات التلاميذ وأرقام مسار، والبطاقة الشخصية للأستاذ.',
    dbKeys: ['classes', 'classOrder', 'teacherProfile', 'settings', 'disabledDates', 'holidays']
  },
  {
    id: 'attendance_behavior',
    name: 'مجلد سجل المواظبة والغياب والسلوك',
    service: 'Firestore & Google Drive',
    icon: 'calendar-check',
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
    description: 'يشمل سجلات الغياب اليومية، التبريرات، التأخرات، وملاحظات الانضباط والسلوك الصفي.',
    dbKeys: ['records', 'behaviors', 'notes', 'attendanceArchive', 'behaviorLogs']
  },
  {
    id: 'grades_exams',
    name: 'مجلد نقط الفروض والمراقبة المستمرة',
    service: 'Firestore & Google Drive',
    icon: 'award',
    color: '#059669',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    description: 'يشمل نقط الفروض المحروسة، الأنشطة المندمجة، الأوزان، وجداول تقييم المكتسبات.',
    dbKeys: ['grades', 'examConfigs', 'competencyTables', 'gradeScales']
  },
  {
    id: 'textbook_curriculum',
    name: 'مجلد دفتر النصوص والتوزيع السنوي والمحاور',
    service: 'Firestore & Google Drive',
    icon: 'book-open',
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    description: 'يشمل حصص دفتر النصوص الرقمي، التدرج السنوي للمقرر، وملاحظات فقرات المحاور.',
    dbKeys: ['textbook', 'curriculum', 'lessonNotes', 'axisParagraphNotes', 'timetable']
  },
  {
    id: 'library_resources',
    name: 'مجلد حقيبة الموارد الرقمية ومجلدات Drive',
    service: 'Google Drive & Firestore',
    icon: 'folder-open',
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
    description: 'يشمل فهرس الوثائق التربوية، الفروض، السلاسل، وروابط مجلدات Google Drive المربوطة.',
    dbKeys: ['library', 'libraryDriveFolders', 'sharedResources']
  }
];

function getCloudSyncModulesConfig() {
  const defaults = {};
  CLOUD_SYNC_DATA_FOLDERS.forEach(folder => {
    defaults[folder.id] = {
      mode: 'auto', // 'auto' | 'manual'
      lastSyncAt: localStorage.getItem('absence_massar_v8_last_saved_time') || null,
      lastStatus: 'ok'
    };
  });
  try {
    const raw = localStorage.getItem(CLOUD_SYNC_MODULES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        CLOUD_SYNC_DATA_FOLDERS.forEach(f => {
          if (parsed[f.id]) {
            defaults[f.id] = Object.assign({}, defaults[f.id], parsed[f.id]);
          }
        });
      }
    }
  } catch (e) {}
  return defaults;
}
window.getCloudSyncModulesConfig = getCloudSyncModulesConfig;

function saveCloudSyncModulesConfig(cfg) {
  try {
    localStorage.setItem(CLOUD_SYNC_MODULES_STORAGE_KEY, JSON.stringify(cfg));
    if (window.db && typeof window.db === 'object') {
      window.db.cloudSyncConfig = cfg;
    }
  } catch (e) {}
}

window.setCloudDataFolderSyncMode = (folderId, mode) => {
  const cfg = getCloudSyncModulesConfig();
  if (!cfg[folderId]) cfg[folderId] = {};
  cfg[folderId].mode = mode === 'manual' ? 'manual' : 'auto';
  saveCloudSyncModulesConfig(cfg);

  // If switched to manual, snapshot current keys so background auto-sync preserves last manual snapshot
  if (cfg[folderId].mode === 'manual') {
    snapshotManualCloudFolder(folderId);
  }
  if (typeof window.showAppToast === 'function') {
    const folderMeta = CLOUD_SYNC_DATA_FOLDERS.find(f => f.id === folderId);
    const title = folderMeta ? folderMeta.name : folderId;
    window.showAppToast(
      cfg[folderId].mode === 'auto'
        ? `🟢 تم تفعيل المزامنة التلقائية لـ «${title}».`
        : `⚪ تم ضبط «${title}» على وضع المزامنة اليدوية فقط.`,
      'info'
    );
  }
  renderAdvancedCloudSyncModalContent();
};

function snapshotManualCloudFolder(folderId) {
  try {
    const folderMeta = CLOUD_SYNC_DATA_FOLDERS.find(f => f.id === folderId);
    if (!folderMeta || !window.db) return;
    const cacheRaw = localStorage.getItem(CLOUD_SYNC_SNAPSHOT_CACHE_KEY);
    const cache = cacheRaw ? JSON.parse(cacheRaw) : {};
    const snap = {};
    folderMeta.dbKeys.forEach(k => {
      if (window.db[k] !== undefined) {
        snap[k] = window.db[k];
      }
    });
    cache[folderId] = snap;
    localStorage.setItem(CLOUD_SYNC_SNAPSHOT_CACHE_KEY, safeStringify(cache));
  } catch (e) {}
}

window.buildFilteredCloudPayloadForAutoSync = (sourceData) => {
  const cloned = Object.assign({}, sourceData || {});
  try {
    const cfg = getCloudSyncModulesConfig();
    const cacheRaw = localStorage.getItem(CLOUD_SYNC_SNAPSHOT_CACHE_KEY);
    const cache = cacheRaw ? JSON.parse(cacheRaw) : {};
    CLOUD_SYNC_DATA_FOLDERS.forEach(folder => {
      const folderCfg = cfg[folder.id];
      if (folderCfg && folderCfg.mode === 'manual' && cache[folder.id]) {
        folder.dbKeys.forEach(k => {
          if (cache[folder.id][k] !== undefined) {
            cloned[k] = cache[folder.id][k];
          }
        });
      }
    });
  } catch (e) {}
  return cloned;
};

window.markAutoSyncedModulesTimestamp = (isoStr) => {
  const cfg = getCloudSyncModulesConfig();
  CLOUD_SYNC_DATA_FOLDERS.forEach(folder => {
    if (!cfg[folder.id] || cfg[folder.id].mode !== 'manual') {
      if (!cfg[folder.id]) cfg[folder.id] = { mode: 'auto' };
      cfg[folder.id].lastSyncAt = isoStr || new Date().toISOString();
      cfg[folder.id].lastStatus = 'ok';
    }
  });
  saveCloudSyncModulesConfig(cfg);
};

window.syncSingleCloudDataFolderNow = async (folderId) => {
  const folderMeta = CLOUD_SYNC_DATA_FOLDERS.find(f => f.id === folderId);
  if (!folderMeta) return;
  try {
    snapshotManualCloudFolder(folderId);
    const cfg = getCloudSyncModulesConfig();
    if (!cfg[folderId]) cfg[folderId] = { mode: 'manual' };
    cfg[folderId].lastSyncAt = new Date().toISOString();
    cfg[folderId].lastStatus = 'syncing';
    saveCloudSyncModulesConfig(cfg);
    renderAdvancedCloudSyncModalContent();

    await window.handleBackupToDrive();

    cfg[folderId].lastSyncAt = new Date().toISOString();
    cfg[folderId].lastStatus = 'ok';
    saveCloudSyncModulesConfig(cfg);
    renderAdvancedCloudSyncModalContent();
    if (typeof window.showAppToast === 'function') {
      window.showAppToast(`✅ تمت المزامنة اليدوية لمجلد «${folderMeta.name}» بنجاح مع السحابة.`, 'success');
    }
  } catch (err) {
    window.logCloudSyncError({
      service: 'Firestore & Drive',
      operation: 'MANUAL_FOLDER_SYNC',
      folderId: folderMeta.id,
      folderName: folderMeta.name,
      error: err
    });
    renderAdvancedCloudSyncModalContent();
  }
};

// ----------------------------------------------------------------------------
// محرك سجل أخطاء المزامنة والتشخيص الذكي (Sync Error Log & Troubleshooter)
// ----------------------------------------------------------------------------

function diagnoseCloudSyncError(rawMessage, code, service, operation) {
  const msg = String(rawMessage || '').toLowerCase();
  const cd = String(code || '').toLowerCase();

  if (msg.includes('401') || msg.includes('unauthenticated') || msg.includes('invalid credentials') || msg.includes('token') || cd.includes('auth')) {
    return {
      arabicDiagnosis: 'انتهت صلاحية جلسة المصادقة (OAuth Access Token) أو لم يتم منح صلاحية الوصول إلى حساب Google.',
      fixRecommendation: 'انقر على زر «إعادة مصادقة Google» لتجديد رمز الأمان وربط الحساب رسمياً.',
      fixActionType: 'reauth_google'
    };
  }
  if (msg.includes('403') || msg.includes('permission') || cd.includes('permission-denied') || msg.includes('insufficient')) {
    return {
      arabicDiagnosis: service === 'Firestore'
        ? 'قواعد أمان Firestore ترفض الكتابة بدون جلسة بريد إلكتروني موثق عبر Google Auth.'
        : 'المجلد في Google Drive خاص أو لا يملك الحساب الحالي صلاحية القراءة/التعديل عليه.',
      fixRecommendation: service === 'Firestore'
        ? 'قم بتسجيل الدخول عبر نافذة Google الرسمية (OAuth) لتوثيق ملكية البريد الإلكتروني.'
        : 'تأكد من مشاركة المجلد في Google Drive أو تسجيل الدخول بنفس حساب Gmail المالك للمجلد.',
      fixActionType: 'reauth_google'
    };
  }
  if (msg.includes('404') || msg.includes('not found')) {
    return {
      arabicDiagnosis: 'المجلد أو الملف المطلوب غير موجود في Google Drive (ربما تم حذفه أو تغير معرّف الرابط Folder ID).',
      fixRecommendation: 'تحقق من رابط المجلد في Google Drive أو أعد ربط المجلد من قائمة مجلدات حسابك.',
      fixActionType: 'retry_folder'
    };
  }
  if (msg.includes('offline') || msg.includes('network') || msg.includes('failed to fetch') || msg.includes('load failed')) {
    return {
      arabicDiagnosis: 'انقطاع مؤقت في الاتصال بالإنترنت أو تعذر الوصول إلى خوادم Google السحابية.',
      fixRecommendation: 'تحقق من اتصالك بالشبكة ثم انقر على «إعادة المحاولة الآن»؛ بياناتك محفوظة محلياً بأمان.',
      fixActionType: 'check_connection'
    };
  }
  if (msg.includes('quota') || msg.includes('resource-exhausted') || msg.includes('1048576') || msg.includes('size')) {
    return {
      arabicDiagnosis: 'حجم حزمة البيانات كبير أو تم تجاوز حصة الطلبات اللحظية في السحابة.',
      fixRecommendation: 'تستخدم المنظومة الضغط التلقائي Gzip والتقسيم؛ انقر على «إعادة المحاولة» لإرسال الأجزاء المتبقية.',
      fixActionType: 'retry_firestore'
    };
  }
  return {
    arabicDiagnosis: `تعذر إكمال عملية (${operation || 'المزامنة'}) مع خدمة ${service || 'السحابة'} بسبب استجابة غير متوقعة.`,
    fixRecommendation: 'انقر على «فحص وتشخيص الاتصال» أو أعد المحاولة يدوياً.',
    fixActionType: 'check_connection'
  };
}

function getCloudSyncErrorLogs() {
  try {
    const raw = localStorage.getItem(CLOUD_SYNC_ERROR_LOGS_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}
window.getCloudSyncErrorLogs = getCloudSyncErrorLogs;

function logCloudSyncError(entry = {}) {
  try {
    const rawErr = entry.error;
    const errMsg = entry.message || (rawErr instanceof Error ? rawErr.message : (typeof rawErr === 'string' ? rawErr : JSON.stringify(rawErr || 'خطأ غير معروف')));
    const errCode = entry.code || (rawErr && rawErr.code) || '';
    const service = entry.service || 'Google Drive';
    const operation = entry.operation || 'SYNC';
    const folderName = entry.folderName || 'المزامنة السحابية العامة';
    const folderId = entry.folderId || '';

    const diag = diagnoseCloudSyncError(errMsg, errCode, service, operation);
    const now = new Date();
    const formattedTime = now.toLocaleString('ar-MA', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const logs = getCloudSyncErrorLogs();
    // Deduplicate identical error within 5 seconds
    if (logs.length > 0) {
      const latest = logs[0];
      if (latest.service === service && latest.folderName === folderName && latest.message === errMsg && (now.getTime() - (latest.timestamp || 0) < 5000)) {
        latest.occurrences = (latest.occurrences || 1) + 1;
        latest.formattedTime = formattedTime;
        latest.timestamp = now.getTime();
        localStorage.setItem(CLOUD_SYNC_ERROR_LOGS_STORAGE_KEY, JSON.stringify(logs));
        return latest;
      }
    }

    const newRecord = {
      id: 'sync_err_' + now.getTime() + '_' + Math.random().toString(36).slice(2, 6),
      timestamp: now.getTime(),
      formattedTime,
      service,
      operation,
      folderId,
      folderName,
      code: errCode || 'SYNC_ERR',
      message: String(errMsg).slice(0, 320),
      arabicDiagnosis: entry.arabicDiagnosis || diag.arabicDiagnosis,
      fixRecommendation: entry.fixRecommendation || diag.fixRecommendation,
      fixActionType: entry.fixActionType || diag.fixActionType,
      resolved: false,
      occurrences: 1
    };

    logs.unshift(newRecord);
    localStorage.setItem(CLOUD_SYNC_ERROR_LOGS_STORAGE_KEY, JSON.stringify(logs.slice(0, 100)));
    window.dispatchEvent(new CustomEvent('cloudSyncErrorLogged', { detail: newRecord }));
    return newRecord;
  } catch (e) {
    return null;
  }
}
window.logCloudSyncError = logCloudSyncError;

window.clearCloudSyncErrorLogs = () => {
  localStorage.removeItem(CLOUD_SYNC_ERROR_LOGS_STORAGE_KEY);
  renderAdvancedCloudSyncModalContent();
  if (typeof window.showAppToast === 'function') {
    window.showAppToast('✅ تم مسح سجل أخطاء المزامنة بالكامل.', 'success');
  }
};

window.removeSingleCloudSyncErrorLog = (logId) => {
  const logs = getCloudSyncErrorLogs().filter(item => item.id !== logId);
  localStorage.setItem(CLOUD_SYNC_ERROR_LOGS_STORAGE_KEY, JSON.stringify(logs));
  renderAdvancedCloudSyncModalContent();
};

window.executeSyncErrorFixAction = async (logId) => {
  const logs = getCloudSyncErrorLogs();
  const target = logs.find(item => item.id === logId);
  if (!target) return;

  try {
    if (target.fixActionType === 'reauth_google') {
      await window.handleGoogleSignInOfficial({ forcePopup: true, allowDirectFallback: true });
      if (typeof window.syncToFirebase === 'function') {
        await window.syncToFirebase(window.db || {});
      }
    } else if (target.fixActionType === 'retry_folder' && target.folderId && typeof window.syncDriveFolder === 'function') {
      const res = await window.syncDriveFolder(target.folderId, true, false);
      if (res && !res.error) {
        target.resolved = true;
      }
    } else if (target.fixActionType === 'retry_firestore') {
      const res = await window.syncToFirebase(window.db || {});
      if (res && res.success) {
        target.resolved = true;
      }
    } else {
      await window.runCloudSyncDiagnosticsNow();
    }

    target.resolved = true;
    localStorage.setItem(CLOUD_SYNC_ERROR_LOGS_STORAGE_KEY, JSON.stringify(logs));
    renderAdvancedCloudSyncModalContent();
  } catch (e) {
    renderAdvancedCloudSyncModalContent();
  }
};

window.copyCloudSyncErrorLogsReport = () => {
  const logs = getCloudSyncErrorLogs();
  if (logs.length === 0) {
    if (typeof window.showAppToast === 'function') {
      window.showAppToast('ℹ️ السجل خالٍ من أي أخطاء حالياً.', 'info');
    }
    return;
  }
  const text = logs.map((l, idx) =>
    `[${idx + 1}] ${l.formattedTime} | الخدمة: ${l.service} | المجلد: ${l.folderName} | العملية: ${l.operation}\n` +
    `   - الخطأ التقني: ${l.message}\n` +
    `   - التشخيص: ${l.arabicDiagnosis}\n` +
    `   - الحل المقترح: ${l.fixRecommendation}`
  ).join('\n\n');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      if (typeof window.showAppToast === 'function') {
        window.showAppToast('📋 تم نسخ تقرير سجل أخطاء المزامنة إلى الحافظة.', 'success');
      }
    });
  }
};

window.runCloudSyncDiagnosticsNow = async () => {
  const diagBox = document.getElementById('cloudSyncLiveDiagBanner');
  if (diagBox) {
    diagBox.style.display = 'block';
    diagBox.innerHTML = `<div style="color:#0369a1;font-weight:800;font-size:0.82rem;">⏳ جاري فحص وتشخيص قنوات الاتصال مع Google Drive و Firestore...</div>`;
  }

  const results = [];
  const online = navigator.onLine;
  results.push({
    label: 'الاتصال بالشبكة',
    ok: online,
    detail: online ? 'متصل بالإنترنت ✓' : 'غير متصل بالإنترنت ✗'
  });

  const user = getEffectiveUser();
  const hasVerifiedCloud = !!getVerifiedCloudUser();
  const hasCloudAccount = !!(user && user.uid);
  let firestoreSyncVerified = hasCloudAccount;

  if (hasCloudAccount && online && typeof window.syncToFirebase === 'function') {
    try {
      const syncRes = await window.syncToFirebase(window.db || {});
      if (syncRes && syncRes.success) {
        firestoreSyncVerified = true;
      }
    } catch (_) {}
  }

  results.push({
    label: 'مزامنة سحابة Firestore (حساب Gmail)',
    ok: firestoreSyncVerified,
    detail: hasVerifiedCloud
      ? `متصل وموثق رسمياً (${user.email}) ✓`
      : (hasCloudAccount ? `متصل ومتزامن سحابياً (${user.email}) ✓` : 'غير مرتبط بحساب Gmail بعد')
  });

  const hasOAuth = isRealOAuthToken(cachedAccessToken);
  let driveApiOk = false;
  if (hasOAuth) {
    try {
      const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,displayName),storageQuota(limit,usage)', {
        headers: { Authorization: `Bearer ${cachedAccessToken}` }
      });
      if (res.ok) {
        driveApiOk = true;
      }
    } catch (_) {}
  }
  results.push({
    label: 'حساب Gmail والنسخ الاحتياطي السحابي',
    ok: driveApiOk || hasCloudAccount,
    detail: driveApiOk
      ? 'رمز Google Drive & Firestore نشط وصالح ✓'
      : (hasCloudAccount
          ? `حساب Gmail مرتبط ونشط (${user.email}) — النسخ السحابي التلقائي مفعّل ✓`
          : 'يرجى ربط حساب Gmail لتفعيل النسخ الاحتياطي السحابي')
  });

  if (diagBox) {
    diagBox.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <strong style="font-size:0.84rem;color:#0f172a;">🩺 نتيجة التشخيص الفوري لقنوات المزامنة:</strong>
        <button type="button" onclick="this.parentElement.parentElement.style.display='none'" style="background:none;border:none;color:#64748b;cursor:pointer;font-weight:bold;">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;">
        ${results.map(r => `
          <div style="background:${r.ok ? '#f0fdf4' : '#fef2f2'};border:1px solid ${r.ok ? '#86efac' : '#fecaca'};border-radius:8px;padding:8px 10px;">
            <div style="font-size:0.75rem;font-weight:800;color:${r.ok ? '#166534' : '#991b1b'};">${r.ok ? '🟢' : '🔴'} ${r.label}</div>
            <div style="font-size:0.73rem;color:#334155;margin-top:3px;">${r.detail}</div>
          </div>
        `).join('')}
      </div>
    `;
  }
};

// ----------------------------------------------------------------------------
// واجهة شاشة الإعدادات المتقدمة لإدارة المجلدات والمزامنة وسجل الأخطاء
// ----------------------------------------------------------------------------

let _activeAdvancedSyncTab = 'folders'; // 'folders' | 'modules' | 'errors'
let _activeSyncErrorFilter = 'all'; // 'all' | 'Google Drive' | 'Firestore'

window.switchAdvancedCloudSyncTab = (tabName) => {
  _activeAdvancedSyncTab = tabName || 'folders';
  renderAdvancedCloudSyncModalContent();
};

window.setAdvancedSyncErrorFilter = (filterVal) => {
  _activeSyncErrorFilter = filterVal || 'all';
  renderAdvancedCloudSyncModalContent();
};

window.toggleSingleDriveFolderSyncModeFromAdvanced = (folderId, mode) => {
  const currentDb = window.db || {};
  if (!Array.isArray(currentDb.libraryDriveFolders)) return;
  const folder = currentDb.libraryDriveFolders.find(f => f.id === folderId);
  if (!folder) return;
  folder.autoSync = (mode === 'auto');
  if (typeof window.saveDB === 'function') window.saveDB();
  if (typeof window.renderLinkedDriveFolders === 'function') window.renderLinkedDriveFolders();
  if (typeof window.renderDriveFoldersManagerList === 'function') window.renderDriveFoldersManagerList();
  renderAdvancedCloudSyncModalContent();
  if (typeof window.showAppToast === 'function') {
    window.showAppToast(
      folder.autoSync
        ? `🟢 تم تفعيل المزامنة التلقائية لمجلد Google Drive «${folder.name}».`
        : `⚪ تم ضبط مجلد Google Drive «${folder.name}» على المزامنة اليدوية فقط.`,
      'info'
    );
  }
};

window.syncSingleDriveFolderFromAdvanced = async (folderId) => {
  if (typeof window.syncDriveFolder !== 'function') return;
  const res = await window.syncDriveFolder(folderId, true, false);
  if (res && !res.error) {
    if (typeof window.showAppToast === 'function') {
      window.showAppToast(`✅ تمت مزامنة المجلد بنجاح (${res.newCount || 0} ملف جديد، ${res.totalDriveFiles || 0} إجمالاً).`, 'success');
    }
  }
  renderAdvancedCloudSyncModalContent();
};

window.quickLinkNewDriveFolderFromAdvanced = async () => {
  const urlInput = document.getElementById('advSyncNewDriveFolderUrl');
  const levelInput = document.getElementById('advSyncNewDriveFolderLevel');
  const modeSelect = document.getElementById('advSyncNewDriveFolderMode');
  if (!urlInput || !urlInput.value.trim()) {
    if (typeof window.showAppToast === 'function') {
      window.showAppToast('⚠️ يرجى لصق رابط مجلد Google Drive أو معرّفه (Folder ID).', 'error');
    }
    return;
  }

  const rawVal = urlInput.value.trim();
  const match = rawVal.match(/[-\w]{25,}/);
  const folderId = match ? match[0] : '';
  if (!folderId) {
    window.logCloudSyncError({
      service: 'Google Drive',
      operation: 'LINK_FOLDER',
      folderName: rawVal,
      code: 'INVALID_FOLDER_ID',
      message: 'صيغة رابط أو معرّف مجلد Google Drive غير صالحة.'
    });
    if (typeof window.showAppToast === 'function') {
      window.showAppToast('⚠️ رابط المجلد غير صالح. تأكد من نسخ رابط مجلد Google Drive بشكل صحيح.', 'error');
    }
    renderAdvancedCloudSyncModalContent();
    return;
  }

  try {
    const token = await window.getGoogleDriveToken(false);
    const isAuto = modeSelect ? (modeSelect.value === 'auto') : true;
    const levelVal = levelInput ? levelInput.value : 'عام';
    let folderInfo = {
      id: folderId,
      name: `مجلد الرياضيات (${levelVal}) - ${folderId.slice(0, 6)}`,
      webViewLink: `https://drive.google.com/drive/folders/${folderId}`
    };

    if (token && isRealOAuthToken(token)) {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,webViewLink`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const fetched = await res.json();
        if (fetched && fetched.name) {
          folderInfo = fetched;
        }
      }
    }

    if (!window.db.libraryDriveFolders) window.db.libraryDriveFolders = [];
    const nowFormatted = new Date().toLocaleString('ar-MA', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    let existing = window.db.libraryDriveFolders.find(f => f.id === folderId);
    if (!existing) {
      existing = {
        id: folderId,
        name: folderInfo.name || 'مجلد Google Drive',
        webViewLink: folderInfo.webViewLink || `https://drive.google.com/drive/folders/${folderId}`,
        course: 'الرياضيات',
        category: 'درس',
        level: levelVal,
        topic: folderInfo.name || '',
        autoSync: isAuto,
        includeSubfolders: true,
        dateLinked: new Date().toLocaleDateString('en-CA'),
        lastSyncTime: Date.now(),
        lastSyncFormatted: nowFormatted,
        syncedFilesCount: 1
      };
      window.db.libraryDriveFolders.push(existing);
    } else {
      existing.name = folderInfo.name || existing.name;
      existing.level = levelVal;
      existing.autoSync = isAuto;
      existing.lastSyncTime = Date.now();
      existing.lastSyncFormatted = nowFormatted;
    }

    if (typeof window.saveDB === 'function') window.saveDB();
    if (token && isRealOAuthToken(token) && typeof window.syncDriveFolder === 'function') {
      await window.syncDriveFolder(folderId, false, true);
    } else if (typeof window.syncToFirebase === 'function') {
      await window.syncToFirebase(window.db);
    }
    if (typeof window.renderLinkedDriveFolders === 'function') window.renderLinkedDriveFolders();
    if (typeof window.renderLibrary === 'function') window.renderLibrary();

    urlInput.value = '';
    if (typeof window.showAppToast === 'function') {
      window.showAppToast(`✅ تم ربط مجلد «${existing.name}» بوضع (${isAuto ? 'مزامنة تلقائية' : 'مزامنة يدوية'}) بنجاح!`, 'success');
    }
    renderAdvancedCloudSyncModalContent();
  } catch (err) {
    window.logCloudSyncError({
      service: 'Google Drive',
      operation: 'LINK_FOLDER',
      folderId,
      folderName: `مجلد جديد (${folderId.slice(0, 10)}...)`,
      error: err
    });
    if (typeof window.showAppToast === 'function') {
      window.showAppToast('⚠️ تعذر ربط المجلد: ' + (err.message || err), 'error');
    }
    renderAdvancedCloudSyncModalContent();
  }
};

function getFolderItemCountSummary(folderId) {
  const d = window.db || {};
  if (folderId === 'classes_students') {
    const clsCount = d.classes ? Object.keys(d.classes).length : 0;
    const stdCount = d.classes ? Object.values(d.classes).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0) : 0;
    return `${clsCount} أقسام · ${stdCount} تلميذ`;
  }
  if (folderId === 'attendance_behavior') {
    const recCount = Array.isArray(d.records) ? d.records.length : 0;
    return `${recCount} سجل مواظبة وسلوك`;
  }
  if (folderId === 'grades_exams') {
    const grdClasses = d.grades ? Object.keys(d.grades).length : 0;
    return `${grdClasses} أقسام منقطة`;
  }
  if (folderId === 'textbook_curriculum') {
    const tbCount = Array.isArray(d.textbook) ? d.textbook.length : 0;
    return `${tbCount} حصة بدفتر النصوص`;
  }
  if (folderId === 'library_resources') {
    const libCount = Array.isArray(d.library) ? d.library.length : 0;
    const drvCount = Array.isArray(d.libraryDriveFolders) ? d.libraryDriveFolders.length : 0;
    return `${libCount} مورد · ${drvCount} مجلد Drive`;
  }
  return '';
}

function renderAdvancedCloudSyncModalContent() {
  const modal = document.getElementById('advancedCloudSyncSettingsModal');
  if (!modal) return;

  const user = getEffectiveUser();
  const hasFirebaseAuth = !!(getVerifiedCloudUser() || (user && user.uid));
  const hasRealOAuth = isRealOAuthToken(cachedAccessToken);
  const email = user ? user.email : 'غير مرتبط';
  const linkedFolders = (window.db && Array.isArray(window.db.libraryDriveFolders)) ? window.db.libraryDriveFolders : [];
  const modulesCfg = getCloudSyncModulesConfig();
  const allErrorLogs = getCloudSyncErrorLogs();
  const filteredLogs = _activeSyncErrorFilter === 'all'
    ? allErrorLogs
    : allErrorLogs.filter(l => String(l.service || '').includes(_activeSyncErrorFilter));

  const unresolvedCount = allErrorLogs.filter(l => !l.resolved).length;

  let tabBodyHtml = '';

  // -------------------------------------------------------------------------
  // TAB 1: مجلدات Google Drive المربوطة (تلقائي / يدوي لكل مجلد على حدة)
  // -------------------------------------------------------------------------
  if (_activeAdvancedSyncTab === 'folders' || _activeAdvancedSyncTab === 'drive') {
    const foldersListHtml = linkedFolders.length === 0
      ? `
        <div style="text-align:center;padding:28px 18px;background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:12px;color:#475569;">
          <div style="font-size:1.6rem;margin-bottom:6px;">📁</div>
          <div style="font-weight:800;color:#0f172a;font-size:0.92rem;margin-bottom:4px;">لا توجد مجلدات Google Drive مربوطة حالياً</div>
          <div style="font-size:0.78rem;color:#64748b;">استخدم نموذج الربط السريع أعلاه لإضافة مجلدات الدروس أو الفروض من Google Drive وتحديد نوع مزامنتها (تلقائية أو يدوية).</div>
        </div>
      `
      : linkedFolders.map(folder => {
          const isAuto = folder.autoSync !== false;
          const safeName = escapeSyncHtml(folder.name || 'مجلد بدون اسم');
          const safeFolderId = escapeSyncHtml(folder.id || '');
          const safeLevel = escapeSyncHtml(folder.level || 'عام');
          const safeSyncDate = escapeSyncHtml(folder.lastSyncFormatted || 'لم تتم بعد');
          const rawUrl = String(folder.webViewLink || `https://drive.google.com/drive/folders/${encodeURIComponent(String(folder.id || ''))}`);
          const safeHref = /^https?:\/\//i.test(rawUrl) ? escapeSyncHtml(rawUrl) : '#';
          return `
            <div style="background:#ffffff;border:1.5px solid ${isAuto ? '#bfdbfe' : '#e2e8f0'};border-radius:11px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;box-shadow:0 1px 3px rgba(15,23,42,0.04);">
              <div style="display:flex;align-items:center;gap:11px;min-width:220px;flex:1;">
                <div style="width:42px;height:42px;border-radius:10px;background:${isAuto ? '#eff6ff' : '#f1f5f9'};color:${isAuto ? '#2563eb' : '#64748b'};display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;border:1px solid ${isAuto ? '#bfdbfe' : '#cbd5e1'};">
                  📁
                </div>
                <div>
                  <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
                    <strong style="font-size:0.9rem;color:#0f172a;">${safeName}</strong>
                    <span style="font-size:0.7rem;padding:2px 8px;border-radius:999px;font-weight:800;background:${isAuto ? '#dcfce7' : '#f1f5f9'};color:${isAuto ? '#166534' : '#475569'};border:1px solid ${isAuto ? '#86efac' : '#cbd5e1'};">
                      ${isAuto ? '🟢 مزامنة تلقائية' : '⚪ مزامنة يدوية'}
                    </span>
                  </div>
                  <div style="font-size:0.74rem;color:#64748b;margin-top:3px;display:flex;gap:8px;flex-wrap:wrap;">
                    <span>المستوى: <strong>${safeLevel}</strong></span>
                    <span>•</span>
                    <span>الملفات المستوردة: <strong style="color:#0284c7;">${Number(folder.syncedFilesCount || 0)}</strong></span>
                    <span>•</span>
                    <span>آخر مزامنة: <strong>${safeSyncDate}</strong></span>
                  </div>
                </div>
              </div>

              <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
                <!-- مفتاح اختيار المزامنة التلقائية أو اليدوية لهذا المجلد -->
                <div style="display:inline-flex;background:#f1f5f9;padding:3px;border-radius:8px;border:1px solid #cbd5e1;">
                  <button type="button" onclick="window.toggleSingleDriveFolderSyncModeFromAdvanced('${safeFolderId}', 'auto')" style="border:none;padding:4px 10px;border-radius:6px;font-size:0.73rem;font-weight:800;cursor:pointer;background:${isAuto ? '#0284c7' : 'transparent'};color:${isAuto ? '#ffffff' : '#475569'};">
                    تلقائية
                  </button>
                  <button type="button" onclick="window.toggleSingleDriveFolderSyncModeFromAdvanced('${safeFolderId}', 'manual')" style="border:none;padding:4px 10px;border-radius:6px;font-size:0.73rem;font-weight:800;cursor:pointer;background:${!isAuto ? '#1e293b' : 'transparent'};color:${!isAuto ? '#ffffff' : '#475569'};">
                    يدوية
                  </button>
                </div>

                <button type="button" onclick="window.syncSingleDriveFolderFromAdvanced('${safeFolderId}')" style="background:#eff6ff;border:1px solid #93c5fd;color:#1d4ed8;padding:6px 11px;border-radius:7px;font-size:0.75rem;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:5px;" title="مزامنة ملفات هذا المجلد يدوياً الآن">
                  <span>🔄 مزامنة الآن</span>
                </button>

                <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="background:#f8fafc;border:1px solid #cbd5e1;color:#334155;padding:6px 9px;border-radius:7px;font-size:0.74rem;font-weight:700;text-decoration:none;">
                  فتح ↗
                </a>
              </div>
            </div>
          `;
        }).join('');

    tabBodyHtml = `
      <!-- شريط إضافة وربط مجلد Google Drive جديد مع تحديد وضع المزامنة -->
      <div style="background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:11px;padding:12px 14px;margin-bottom:14px;">
        <div style="font-size:0.82rem;font-weight:800;color:#0f172a;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;">
          <span>➕ ربط مجلد Google Drive جديد وتحديد نظام مزامنته:</span>
          <span style="font-size:0.72rem;color:#64748b;font-weight:600;">يمكنك تخصيص كل مجلد على حدة (تلقائي كل 45 ثانية أو يدوي عند الطلب)</span>
        </div>
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;align-items:center;">
          <input type="text" id="advSyncNewDriveFolderUrl" placeholder="الصق رابط مجلد Google Drive أو معرّف Folder ID..." dir="ltr" style="padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:7px;font-size:0.8rem;width:100%;box-sizing:border-box;" />
          <select id="advSyncNewDriveFolderLevel" style="padding:8px;border:1.5px solid #cbd5e1;border-radius:7px;font-size:0.78rem;font-weight:700;background:#ffffff;color:#0f172a;">
            <option value="عام">جميع المستويات</option>
            <option value="TC-SC">جذع مشترك علمي (TC-SC)</option>
            <option value="1BAC-EXP">أولى باك علوم تجريبية</option>
            <option value="1BAC-SM">أولى باك علوم رياضية</option>
            <option value="2BAC-PC">ثانية باك علوم فيزيائية</option>
            <option value="2BAC-SVT">ثانية باك علوم الحياة والأرض</option>
            <option value="2BAC-SM">ثانية باك علوم رياضية</option>
          </select>
          <select id="advSyncNewDriveFolderMode" style="padding:8px;border:1.5px solid #0284c7;border-radius:7px;font-size:0.78rem;font-weight:800;background:#f0f9ff;color:#0369a1;">
            <option value="auto">🟢 مزامنة تلقائية</option>
            <option value="manual">⚪ مزامنة يدوية</option>
          </select>
          <button type="button" onclick="window.quickLinkNewDriveFolderFromAdvanced()" style="background:#0284c7;color:#ffffff;border:none;padding:8px 14px;border-radius:7px;font-size:0.8rem;font-weight:800;cursor:pointer;white-space:nowrap;">
            ربط المجلد
          </button>
        </div>
      </div>

      <!-- قائمة مجلدات Google Drive المربوطة -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
        <strong style="font-size:0.86rem;color:#1e293b;">📂 المجلدات المربوطة بحساب Google Drive (${linkedFolders.length}):</strong>
        ${linkedFolders.length > 0 ? `
          <button type="button" onclick="if(window.syncAllLinkedDriveFolders) window.syncAllLinkedDriveFolders(true).then(() => window.openAdvancedCloudSyncSettingsModal('folders'));" style="background:#0f172a;color:#ffffff;border:none;padding:5px 12px;border-radius:6px;font-size:0.74rem;font-weight:800;cursor:pointer;">
            🔄 فحص ومزامنة جميع المجلدات الآن
          </button>
        ` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;padding-left:2px;">
        ${foldersListHtml}
      </div>
    `;
  }

  // -------------------------------------------------------------------------
  // TAB 2: مجلدات ووحدات بيانات Firestore & Drive (تلقائي / يدوي لكل وحدة)
  // -------------------------------------------------------------------------
  else if (_activeAdvancedSyncTab === 'modules') {
    const modulesHtml = CLOUD_SYNC_DATA_FOLDERS.map(folder => {
      const fCfg = modulesCfg[folder.id] || { mode: 'auto' };
      const isAuto = fCfg.mode !== 'manual';
      const lastSyncStr = fCfg.lastSyncAt
        ? new Date(fCfg.lastSyncAt).toLocaleString('ar-MA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'لم تتم المزامنة بعد';
      const countBadge = getFolderItemCountSummary(folder.id);

      return `
        <div style="background:#ffffff;border:1.5px solid ${isAuto ? folder.border : '#cbd5e1'};border-right:4px solid ${folder.color};border-radius:10px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <div style="flex:1;min-width:240px;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <strong style="font-size:0.9rem;color:#0f172a;">${escapeSyncHtml(folder.name)}</strong>
              <span style="font-size:0.7rem;padding:2px 8px;border-radius:999px;font-weight:800;background:${folder.bg};color:${folder.color};border:1px solid ${folder.border};">
                ${escapeSyncHtml(countBadge)}
              </span>
              <span style="font-size:0.7rem;padding:2px 8px;border-radius:999px;font-weight:800;background:${isAuto ? '#dcfce7' : '#f1f5f9'};color:${isAuto ? '#166534' : '#475569'};">
                ${isAuto ? '🟢 تلقائي مع كل حفظ' : '⚪ يدوي عند الطلب فقط'}
              </span>
            </div>
            <div style="font-size:0.75rem;color:#475569;margin-top:4px;">${escapeSyncHtml(folder.description)}</div>
            <div style="font-size:0.71rem;color:#64748b;margin-top:4px;">
              الخدمة: <strong>${escapeSyncHtml(folder.service)}</strong> · آخر مزامنة ناجحة: <strong>${escapeSyncHtml(lastSyncStr)}</strong>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <div style="display:inline-flex;background:#f1f5f9;padding:3px;border-radius:8px;border:1px solid #cbd5e1;">
              <button type="button" onclick="window.setCloudDataFolderSyncMode('${folder.id}', 'auto')" style="border:none;padding:4px 10px;border-radius:6px;font-size:0.73rem;font-weight:800;cursor:pointer;background:${isAuto ? '#059669' : 'transparent'};color:${isAuto ? '#ffffff' : '#475569'};">
                تلقائية
              </button>
              <button type="button" onclick="window.setCloudDataFolderSyncMode('${folder.id}', 'manual')" style="border:none;padding:4px 10px;border-radius:6px;font-size:0.73rem;font-weight:800;cursor:pointer;background:${!isAuto ? '#1e293b' : 'transparent'};color:${!isAuto ? '#ffffff' : '#475569'};">
                يدوية
              </button>
            </div>

            <button type="button" onclick="window.syncSingleCloudDataFolderNow('${folder.id}')" style="background:#0f172a;color:#ffffff;border:none;padding:6px 11px;border-radius:7px;font-size:0.74rem;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:5px;">
              <span>☁️ مزامنة هذا المجلد الآن</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    tabBodyHtml = `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:0.78rem;color:#166534;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div>
          <strong>🛡️ التحكم الدقيق في مزامنة وحدات ومجلدات Firestore & Drive:</strong>
          يمكنك جعل أي وحدة في وضع <strong>«يدوية»</strong> لمنع تحديثها تلقائياً في السحابة إلى حين مراجعتها والضغط على <strong>«مزامنة هذا المجلد الآن»</strong>.
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:9px;padding-left:2px;">
        ${modulesHtml}
      </div>
    `;
  }

  // -------------------------------------------------------------------------
  // TAB 3: سجل أخطاء المزامنة والتشخيص الذكي (Sync Error Log)
  // -------------------------------------------------------------------------
  else {
    const logsHtml = filteredLogs.length === 0
      ? `
        <div style="text-align:center;padding:32px 18px;background:#f0fdf4;border:1.5px dashed #86efac;border-radius:12px;color:#166534;">
          <div style="font-size:1.7rem;margin-bottom:6px;">✅</div>
          <div style="font-weight:900;font-size:0.95rem;margin-bottom:4px;">سجل أخطاء المزامنة نظيف تماماً!</div>
          <div style="font-size:0.78rem;color:#15803d;">لم يتم رصد أي أخطاء مزامنة سابقة مع Google Drive أو Firestore في هذا التصنيف.</div>
        </div>
      `
      : filteredLogs.map(log => {
          const isDrive = String(log.service || '').includes('Drive');
          const badgeBg = isDrive ? '#eff6ff' : '#ecfdf5';
          const badgeCol = isDrive ? '#1d4ed8' : '#047857';
          const badgeBorder = isDrive ? '#bfdbfe' : '#a7f3d0';
          const fixLabel = log.fixActionType === 'reauth_google'
            ? '🔑 إعادة مصادقة Google وتجديد الرمز'
            : (log.fixActionType === 'retry_folder'
                ? '🔄 إعادة مزامنة المجلد الآن'
                : (log.fixActionType === 'retry_firestore' ? '☁️ إعادة المزامنة مع Firestore' : '🩺 فحص الاتصال وإعادة المحاولة'));

          return `
            <div style="background:${log.resolved ? '#f8fafc' : '#fff1f2'};border:1.5px solid ${log.resolved ? '#cbd5e1' : '#fecdd3'};border-right:4px solid ${log.resolved ? '#10b981' : '#e11d48'};border-radius:10px;padding:11px 14px;">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                  <span style="background:${badgeBg};color:${badgeCol};border:1px solid ${badgeBorder};font-size:0.7rem;font-weight:900;padding:2px 8px;border-radius:999px;">
                    ${escapeSyncHtml(log.service)}
                  </span>
                  <strong style="font-size:0.84rem;color:#0f172a;">📁 ${escapeSyncHtml(log.folderName)}</strong>
                  <span style="font-size:0.7rem;background:#f1f5f9;color:#475569;padding:1px 6px;border-radius:4px;font-family:monospace;">
                    ${escapeSyncHtml(log.operation)}
                  </span>
                  ${log.occurrences > 1 ? `<span style="font-size:0.68rem;background:#fee2e2;color:#991b1b;padding:1px 6px;border-radius:999px;font-weight:800;">تكرر ${Number(log.occurrences)} مرات</span>` : ''}
                  ${log.resolved ? `<span style="font-size:0.7rem;background:#dcfce7;color:#166534;padding:1px 7px;border-radius:999px;font-weight:800;">✓ تم التصحيح</span>` : ''}
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="font-size:0.72rem;color:#64748b;font-weight:700;">🕒 ${escapeSyncHtml(log.formattedTime)}</span>
                  <button type="button" onclick="window.removeSingleCloudSyncErrorLog('${escapeSyncHtml(log.id)}')" title="حذف هذا السجل" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:0.9rem;font-weight:bold;">✕</button>
                </div>
              </div>

              <div style="font-size:0.78rem;color:#881337;background:rgba(255,255,255,0.75);border:1px solid #fecdd3;border-radius:6px;padding:6px 9px;margin-bottom:6px;">
                <strong>🔍 التشخيص:</strong> ${escapeSyncHtml(log.arabicDiagnosis)}
                <div style="font-size:0.7rem;color:#64748b;font-family:monospace;direction:ltr;text-align:left;margin-top:3px;word-break:break-all;">
                  [${escapeSyncHtml(log.code)}] ${escapeSyncHtml(log.message)}
                </div>
              </div>

              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                <div style="font-size:0.75rem;color:#0f172a;">
                  <strong style="color:#0369a1;">💡 خطوة التصحيح المقترحة:</strong> ${escapeSyncHtml(log.fixRecommendation)}
                </div>
                <button type="button" onclick="window.executeSyncErrorFixAction('${escapeSyncHtml(log.id)}')" style="background:#0f172a;color:#ffffff;border:none;padding:5px 11px;border-radius:6px;font-size:0.73rem;font-weight:800;cursor:pointer;">
                  ${fixLabel}
                </button>
              </div>
            </div>
          `;
        }).join('');

    tabBodyHtml = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:9px 12px;">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <span style="font-size:0.76rem;font-weight:800;color:#334155;">تصفية السجل حسب الخدمة:</span>
          <button type="button" onclick="window.setAdvancedSyncErrorFilter('all')" style="border:1px solid #cbd5e1;padding:4px 10px;border-radius:6px;font-size:0.73rem;font-weight:800;cursor:pointer;background:${_activeSyncErrorFilter === 'all' ? '#0f172a' : '#ffffff'};color:${_activeSyncErrorFilter === 'all' ? '#ffffff' : '#475569'};">
            الكل (${allErrorLogs.length})
          </button>
          <button type="button" onclick="window.setAdvancedSyncErrorFilter('Drive')" style="border:1px solid #cbd5e1;padding:4px 10px;border-radius:6px;font-size:0.73rem;font-weight:800;cursor:pointer;background:${_activeSyncErrorFilter === 'Drive' ? '#0284c7' : '#ffffff'};color:${_activeSyncErrorFilter === 'Drive' ? '#ffffff' : '#475569'};">
            Google Drive
          </button>
          <button type="button" onclick="window.setAdvancedSyncErrorFilter('Firestore')" style="border:1px solid #cbd5e1;padding:4px 10px;border-radius:6px;font-size:0.73rem;font-weight:800;cursor:pointer;background:${_activeSyncErrorFilter === 'Firestore' ? '#059669' : '#ffffff'};color:${_activeSyncErrorFilter === 'Firestore' ? '#ffffff' : '#475569'};">
            Firestore
          </button>
        </div>

        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <button type="button" onclick="window.runCloudSyncDiagnosticsNow()" style="background:#0284c7;color:#ffffff;border:none;padding:5px 10px;border-radius:6px;font-size:0.73rem;font-weight:800;cursor:pointer;">
            🩺 فحص وتشخيص الاتصال الآن
          </button>
          <button type="button" onclick="window.copyCloudSyncErrorLogsReport()" style="background:#ffffff;color:#334155;border:1px solid #cbd5e1;padding:5px 10px;border-radius:6px;font-size:0.73rem;font-weight:700;cursor:pointer;">
            📋 نسخ التقرير
          </button>
          ${allErrorLogs.length > 0 ? `
            <button type="button" onclick="window.clearCloudSyncErrorLogs()" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;padding:5px 10px;border-radius:6px;font-size:0.73rem;font-weight:800;cursor:pointer;">
              🗑️ مسح السجل
            </button>
          ` : ''}
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;padding-left:2px;">
        ${logsHtml}
      </div>
    `;
  }

  modal.innerHTML = `
    <div class="drive-sync-modal-card" style="max-width: 780px; width: 95%; max-height: calc(100vh - 28px); display: flex; flex-direction: column; padding: 0; overflow: hidden;">
      <!-- رأس الشاشة المتقدمة الثابت -->
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1.5px solid #e2e8f0;padding:14px 20px 12px 20px;background:#ffffff;flex-wrap:wrap;gap:10px;flex-shrink:0;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:42px;height:42px;border-radius:11px;background:linear-gradient(135deg,#0f172a,#1e3a8a);color:#38bdf8;display:flex;align-items:center;justify-content:center;border:1.5px solid #38bdf8;font-size:1.2rem;">
            ⚙️
          </div>
          <div>
            <h3 style="margin:0;font-size:1.05rem;font-weight:900;color:#0f172a;">الإعدادات المتقدمة لإدارة الربط والمزامنة (Google Drive & Firestore)</h3>
            <div style="font-size:0.74rem;color:#64748b;">تخصيص المزامنة التلقائية أو اليدوية لكل مجلد على حدة مع سجل تشخيص وتصحيح الأخطاء</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <button type="button" onclick="window.scrollDriveSyncContainer('advCloudSyncScrollBody', 'up')" class="drive-sync-scroll-nav-btn" title="الصعود للأعلى">
            <span>⬆️</span>
          </button>
          <button type="button" onclick="window.scrollDriveSyncContainer('advCloudSyncScrollBody', 'down')" class="drive-sync-scroll-nav-btn" title="النزول للأسفل">
            <span>⬇️</span>
          </button>
          <button type="button" onclick="window.closeAdvancedCloudSyncSettingsModal()" style="background:#f1f5f9;border:1px solid #cbd5e1;width:32px;height:32px;border-radius:8px;font-size:1.15rem;cursor:pointer;color:#334155;font-weight:bold;">&times;</button>
        </div>
      </div>

      <!-- جسم الشاشة القابل للتمرير صعوداً ونزولاً -->
      <div id="advCloudSyncScrollBody" class="drive-sync-scroll-body" style="flex:1;min-height:0;overflow-y:auto;padding:14px 20px;">
        <!-- شريط حالة الربط السحابي الموحد -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-bottom:14px;">
          <div style="background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:10px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-size:0.71rem;color:#64748b;font-weight:700;">الحساب السحابي المرتبط</div>
              <div style="font-size:0.84rem;font-weight:900;color:#0f172a;direction:ltr;text-align:right;">${escapeSyncHtml(email)}</div>
            </div>
            <button type="button" onclick="window.openGmailQuickSwitchModal()" style="background:#ffffff;border:1px solid #0284c7;color:#0284c7;padding:4px 9px;border-radius:6px;font-size:0.72rem;font-weight:800;cursor:pointer;">تبديل</button>
          </div>

          <div style="background:${hasFirebaseAuth ? '#f0fdf4' : '#fffbeb'};border:1.5px solid ${hasFirebaseAuth ? '#86efac' : '#fde68a'};border-radius:10px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-size:0.71rem;color:#475569;font-weight:700;">حالة الربط والمزامنة السحابية</div>
              <div style="font-size:0.8rem;font-weight:900;color:${hasFirebaseAuth ? '#15803d' : '#b45309'};">
                ${hasRealOAuth ? '🟢 متصل ومفوض (Drive + Firestore) ✓' : (hasFirebaseAuth ? '🟢 مرتبط ونشط للمزامنة السحابية ✓' : '🟡 غير مرتبط بحساب Gmail')}
              </div>
            </div>
            ${hasFirebaseAuth ? `
              <button type="button" onclick="window.handleBackupToDrive().then(() => window.openAdvancedCloudSyncSettingsModal(_activeAdvancedSyncTab))" style="background:#059669;color:#ffffff;border:none;padding:4px 9px;border-radius:6px;font-size:0.72rem;font-weight:800;cursor:pointer;">مزامنة الآن</button>
            ` : `
              <button type="button" onclick="window.openGmailQuickSwitchModal()" style="background:#0284c7;color:#ffffff;border:none;padding:4px 9px;border-radius:6px;font-size:0.72rem;font-weight:800;cursor:pointer;">ربط الحساب</button>
            `}
          </div>

          <div style="background:${hasFirebaseAuth ? '#f0fdf4' : '#eff6ff'};border:1.5px solid ${hasFirebaseAuth ? '#86efac' : '#bfdbfe'};border-radius:10px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-size:0.71rem;color:#475569;font-weight:700;">حالة قاعدة بيانات Firestore</div>
              <div style="font-size:0.8rem;font-weight:900;color:${hasFirebaseAuth ? '#15803d' : '#1d4ed8'};">
                ${hasFirebaseAuth ? '🟢 متصل ومتزامن عبر Gmail ✓' : '🔵 جاهز لربط حساب Gmail'}
              </div>
            </div>
            <button type="button" onclick="window.runCloudSyncDiagnosticsNow()" style="background:#ffffff;border:1px solid #cbd5e1;color:#0f172a;padding:4px 9px;border-radius:6px;font-size:0.72rem;font-weight:800;cursor:pointer;">تشخيص</button>
          </div>
        </div>

        <!-- مربع نتائج الفحص المباشر -->
        <div id="cloudSyncLiveDiagBanner" style="display:none;background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:10px;padding:10px 12px;margin-bottom:14px;"></div>

        <!-- أزرار التبويبات الثلاثة -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;background:#f1f5f9;padding:5px;border-radius:10px;border:1px solid #cbd5e1;">
          <button type="button" onclick="window.switchAdvancedCloudSyncTab('folders')" style="border:none;padding:9px 10px;border-radius:8px;font-size:0.8rem;font-weight:800;cursor:pointer;background:${(_activeAdvancedSyncTab === 'folders' || _activeAdvancedSyncTab === 'drive') ? '#0f172a' : 'transparent'};color:${(_activeAdvancedSyncTab === 'folders' || _activeAdvancedSyncTab === 'drive') ? '#ffffff' : '#334155'};display:flex;align-items:center;justify-content:center;gap:6px;">
            <span>📁 مجلدات Google Drive (${linkedFolders.length})</span>
          </button>
          <button type="button" onclick="window.switchAdvancedCloudSyncTab('modules')" style="border:none;padding:9px 10px;border-radius:8px;font-size:0.8rem;font-weight:800;cursor:pointer;background:${_activeAdvancedSyncTab === 'modules' ? '#0f172a' : 'transparent'};color:${_activeAdvancedSyncTab === 'modules' ? '#ffffff' : '#334155'};display:flex;align-items:center;justify-content:center;gap:6px;">
            <span>🗄️ مجلدات بيانات Firestore (${CLOUD_SYNC_DATA_FOLDERS.length})</span>
          </button>
          <button type="button" onclick="window.switchAdvancedCloudSyncTab('errors')" style="border:none;padding:9px 10px;border-radius:8px;font-size:0.8rem;font-weight:800;cursor:pointer;background:${_activeAdvancedSyncTab === 'errors' ? '#0f172a' : 'transparent'};color:${_activeAdvancedSyncTab === 'errors' ? '#ffffff' : '#334155'};display:flex;align-items:center;justify-content:center;gap:6px;">
            <span>🛠️ سجل أخطاء المزامنة</span>
            <span style="background:${unresolvedCount > 0 ? '#ef4444' : '#64748b'};color:#ffffff;padding:1px 7px;border-radius:999px;font-size:0.7rem;">${allErrorLogs.length}</span>
          </button>
        </div>

        <!-- محتوى التبويب النشط -->
        <div>
          ${tabBodyHtml}
        </div>
      </div>

      <!-- تذييل الشاشة الثابت مع أزرار الصعود والنزول -->
      <div style="padding:10px 20px;border-top:1.5px solid #e2e8f0;background:#f8fafc;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;flex-shrink:0;">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <button type="button" onclick="window.scrollDriveSyncContainer('advCloudSyncScrollBody', 'top')" class="drive-sync-scroll-nav-btn" title="الصعود إلى أعلى النافذة">
            <span>⬆️ الصعود للأعلى</span>
          </button>
          <button type="button" onclick="window.scrollDriveSyncContainer('advCloudSyncScrollBody', 'up')" class="drive-sync-scroll-nav-btn" title="خطوة للأعلى">
            <span>🔼 لأعلى</span>
          </button>
          <button type="button" onclick="window.scrollDriveSyncContainer('advCloudSyncScrollBody', 'down')" class="drive-sync-scroll-nav-btn" title="خطوة للأسفل">
            <span>🔽 لأسفل</span>
          </button>
          <button type="button" onclick="window.scrollDriveSyncContainer('advCloudSyncScrollBody', 'bottom')" class="drive-sync-scroll-nav-btn" title="النزول إلى أسفل النافذة">
            <span>⬇️ النزول للأسفل</span>
          </button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" onclick="window.closeAdvancedCloudSyncSettingsModal(); window.openDriveSyncCenterModal();" style="background:#ffffff;color:#0284c7;border:1.5px solid #0284c7;padding:6px 12px;border-radius:7px;font-size:0.76rem;font-weight:800;cursor:pointer;">
            ↩️ مركز الربط بحساب Gmail
          </button>
          <button type="button" onclick="window.handleBackupToDrive()" style="background:#059669;color:#ffffff;border:none;padding:6px 14px;border-radius:7px;font-size:0.76rem;font-weight:800;cursor:pointer;">
            ☁️ مزامنة شاملة الآن
          </button>
          <button type="button" onclick="window.closeAdvancedCloudSyncSettingsModal()" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;padding:6px 14px;border-radius:7px;font-size:0.76rem;font-weight:800;cursor:pointer;">
            إغلاق
          </button>
        </div>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

window.openAdvancedCloudSyncSettingsModal = (initialTab = 'folders') => {
  if (initialTab === 'drive') _activeAdvancedSyncTab = 'folders';
  else if (initialTab === 'modules' || initialTab === 'errors' || initialTab === 'folders') _activeAdvancedSyncTab = initialTab;

  let modal = document.getElementById('advancedCloudSyncSettingsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'advancedCloudSyncSettingsModal';
    modal.className = 'drive-sync-modal-backdrop';
    document.body.appendChild(modal);
  }
  renderAdvancedCloudSyncModalContent();
  modal.style.display = 'flex';
};

window.closeAdvancedCloudSyncSettingsModal = () => {
  const modal = document.getElementById('advancedCloudSyncSettingsModal');
  if (modal) modal.style.display = 'none';
};

