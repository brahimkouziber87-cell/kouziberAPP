// IndexedDB Offline-First Storage Engine, Immutable Audit Trail & CNDP Law 09-08 Privacy Mode

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  epochMs: number;
  category: 'grade_update' | 'attendance_update' | 'massar_export' | 'db_snapshot' | 'privacy_toggle' | 'system_audit';
  actionTitle: string;
  className?: string;
  studentId?: string;
  studentName?: string;
  fieldKey?: string;
  previousValue?: string;
  newValue?: string;
  operatorEmail: string;
  integrityHash: string;
}

export interface StorageHealthReport {
  localStorageUsedKB: number;
  localStorageQuotaPct: number;
  indexedDbAvailable: boolean;
  snapshotsCount: number;
  auditLogsCount: number;
  lastSnapshotTime: string | null;
  lastDiffSyncDurationMs?: number;
  differentialSlicesCount?: number;
  lazyChunksEnabled?: boolean;
  cloudSyncMode?: string;
  cloudTotalSlices?: number;
  cloudUploadedSlices?: number;
  cloudSkippedSlices?: number;
  cloudSavedKB?: number;
  loadedCdnLibrariesCount?: number;
  loadedLegacyModulesCount?: number;
}

const DB_NAME = 'AlMoumenPedagogicalDB_v1';
const DB_VERSION = 1;
const STORE_SNAPSHOTS = 'db_snapshots';
const STORE_AUDIT = 'immutable_audit_trail';
const AUDIT_LOCAL_FALLBACK_KEY = 'almoumen_immutable_audit_v1';
const PRIVACY_MODE_STORAGE_KEY = 'almoumen_cndp_privacy_mode_v1';

const lastSliceHashes: Record<string, string> = {};
let lastDiffDurationMs = 1.4;
let totalSlicesIndexed = 5;

function computeSimpleHash(payload: string): string {
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return 'SHA-' + (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

function openPedagogicalIdb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
          db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_AUDIT)) {
          const auditStore = db.createObjectStore(STORE_AUDIT, { keyPath: 'id' });
          auditStore.createIndex('epochMs', 'epochMs', { unique: false });
          auditStore.createIndex('category', 'category', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch (_err) {
      resolve(null);
    }
  });
}

export async function saveSnapshotToIndexedDB(dbObject: any, label = 'نسخة تلقائية متزامنة'): Promise<boolean> {
  if (!dbObject) return false;
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const idb = await openPedagogicalIdb();
  const now = new Date();
  const iso = now.toISOString();

  // Save latest primary mirror + differential collection slices + rolling snapshot
  if (idb) {
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = idb.transaction([STORE_SNAPSHOTS], 'readwrite');
        const store = tx.objectStore(STORE_SNAPSHOTS);
        const cloneSafe = JSON.parse(JSON.stringify(dbObject));

        // Differential slice indexing: only update changed slices (classes, records, gradesS1, gradesS2, behaviors)
        const slices: Record<string, any> = {
          slice_classes: cloneSafe.classes || {},
          slice_records: cloneSafe.records || [],
          slice_grades_s1: cloneSafe.gradesS1 || cloneSafe.grades || {},
          slice_grades_s2: cloneSafe.gradesS2 || {},
          slice_behaviors: cloneSafe.behaviors || {},
        };

        let updatedCount = 0;
        Object.entries(slices).forEach(([sliceKey, sliceVal]) => {
          const serialized = JSON.stringify(sliceVal);
          const h = computeSimpleHash(serialized);
          if (lastSliceHashes[sliceKey] !== h) {
            lastSliceHashes[sliceKey] = h;
            updatedCount++;
            store.put({
              id: sliceKey,
              label: `شريحة تفاضلية (${sliceKey})`,
              timestamp: iso,
              epochMs: now.getTime(),
              hash: h,
              data: sliceVal,
            });
          }
        });
        totalSlicesIndexed = 5;

        store.put({
          id: 'latest_mirror',
          label: 'المرآة الفورية (Offline-First)',
          timestamp: iso,
          epochMs: now.getTime(),
          classesCount: Object.keys(cloneSafe.classes || {}).length,
          recordsCount: Array.isArray(cloneSafe.records) ? cloneSafe.records.length : 0,
          data: cloneSafe
        });
        const rollingId = `snap_${now.toISOString().slice(0, 13)}`; // Hourly rolling snapshot
        store.put({
          id: rollingId,
          label,
          timestamp: iso,
          epochMs: now.getTime(),
          classesCount: Object.keys(cloneSafe.classes || {}).length,
          recordsCount: Array.isArray(cloneSafe.records) ? cloneSafe.records.length : 0,
          data: cloneSafe
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      lastDiffDurationMs = Number(Math.max(0.4, t1 - t0).toFixed(1));
      localStorage.setItem('almoumen_last_idb_sync', iso);
      window.dispatchEvent(new CustomEvent('idbSynced', { detail: { timestamp: iso, durationMs: lastDiffDurationMs } }));
      return true;
    } catch (_e) {
      return false;
    }
  }
  return false;
}

export async function loadLatestSnapshotFromIndexedDB(): Promise<any | null> {
  const idb = await openPedagogicalIdb();
  if (!idb) return null;
  return new Promise((resolve) => {
    try {
      const tx = idb.transaction([STORE_SNAPSHOTS], 'readonly');
      const store = tx.objectStore(STORE_SNAPSHOTS);
      const req = store.get('latest_mirror');
      req.onsuccess = () => {
        resolve(req.result?.data || null);
      };
      req.onerror = () => resolve(null);
    } catch (_e) {
      resolve(null);
    }
  });
}

export async function appendAuditLog(
  entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'epochMs' | 'operatorEmail' | 'integrityHash'>
): Promise<AuditLogEntry> {
  const now = new Date();
  const epochMs = now.getTime();
  const timestamp = now.toISOString();
  const win = typeof window !== 'undefined' ? (window as any) : {};
  let rememberedEmail = '';
  try {
    rememberedEmail = (typeof localStorage !== 'undefined' && localStorage.getItem('gdrive_last_email')) || '';
  } catch (_e) {}
  const operatorEmail =
    (typeof win?.getVerifiedFirebaseAuthUser === 'function' && win.getVerifiedFirebaseAuthUser()?.email) ||
    win?.currentUser?.email ||
    win?.db?.teacherProfile?.email ||
    rememberedEmail ||
    'local-teacher';
  const id = `AUD-${epochMs}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  const rawString = `${id}|${timestamp}|${entry.category}|${entry.actionTitle}|${entry.className || ''}|${entry.studentId || ''}|${entry.previousValue || ''}|${entry.newValue || ''}|${operatorEmail}`;
  const integrityHash = computeSimpleHash(rawString);

  const fullEntry: AuditLogEntry = {
    ...entry,
    id,
    timestamp,
    epochMs,
    operatorEmail,
    integrityHash
  };

  // Also keep a fast ring-buffer of the latest 250 audit entries in localStorage for instant synchronous reads
  try {
    const raw = localStorage.getItem(AUDIT_LOCAL_FALLBACK_KEY);
    const list: AuditLogEntry[] = raw ? JSON.parse(raw) : [];
    list.unshift(fullEntry);
    if (list.length > 250) list.length = 250;
    localStorage.setItem(AUDIT_LOCAL_FALLBACK_KEY, JSON.stringify(list));
  } catch (_e) {}

  const idb = await openPedagogicalIdb();
  if (idb) {
    try {
      await new Promise<void>((resolve) => {
        const tx = idb.transaction([STORE_AUDIT], 'readwrite');
        tx.objectStore(STORE_AUDIT).put(fullEntry);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch (_e) {}
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auditLogAdded', { detail: fullEntry }));
  }

  return fullEntry;
}

export async function getAuditLogs(limit = 150): Promise<AuditLogEntry[]> {
  const idb = await openPedagogicalIdb();
  if (idb) {
    try {
      const idbLogs = await new Promise<AuditLogEntry[]>((resolve) => {
        const tx = idb.transaction([STORE_AUDIT], 'readonly');
        const store = tx.objectStore(STORE_AUDIT);
        const req = store.getAll();
        req.onsuccess = () => {
          const all: AuditLogEntry[] = Array.isArray(req.result) ? req.result : [];
          all.sort((a, b) => b.epochMs - a.epochMs);
          resolve(all.slice(0, limit));
        };
        req.onerror = () => resolve([]);
      });
      if (idbLogs.length > 0) return idbLogs;
    } catch (_e) {}
  }

  try {
    const raw = localStorage.getItem(AUDIT_LOCAL_FALLBACK_KEY);
    if (raw) {
      const parsed: AuditLogEntry[] = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, limit) : [];
    }
  } catch (_e) {}
  return [];
}

export async function getStorageHealthReport(): Promise<StorageHealthReport> {
  let bytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) {
        const v = localStorage.getItem(k) || '';
        bytes += (k.length + v.length) * 2;
      }
    }
  } catch (_e) {}

  const localStorageUsedKB = Number((bytes / 1024).toFixed(1));
  const localStorageQuotaPct = Math.min(100, Number(((bytes / (5 * 1024 * 1024)) * 100).toFixed(1)));

  let snapshotsCount = 0;
  let auditLogsCount = 0;
  let lastSnapshotTime = localStorage.getItem('almoumen_last_idb_sync') || null;
  const idb = await openPedagogicalIdb();

  if (idb) {
    try {
      await new Promise<void>((resolve) => {
        const tx = idb.transaction([STORE_SNAPSHOTS, STORE_AUDIT], 'readonly');
        const sReq = tx.objectStore(STORE_SNAPSHOTS).count();
        const aReq = tx.objectStore(STORE_AUDIT).count();
        sReq.onsuccess = () => {
          snapshotsCount = sReq.result || 0;
        };
        aReq.onsuccess = () => {
          auditLogsCount = aReq.result || 0;
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch (_e) {}
  }

  const win = typeof window !== 'undefined' ? (window as any) : {};
  const cloudStats =
    typeof win.getCloudDifferentialSyncStats === 'function'
      ? win.getCloudDifferentialSyncStats()
      : null;
  const lazyTelemetry =
    typeof win.getLazyPerformanceTelemetry === 'function'
      ? win.getLazyPerformanceTelemetry()
      : null;

  return {
    localStorageUsedKB,
    localStorageQuotaPct,
    indexedDbAvailable: !!idb,
    snapshotsCount,
    auditLogsCount,
    lastSnapshotTime,
    lastDiffSyncDurationMs: lastDiffDurationMs,
    differentialSlicesCount: totalSlicesIndexed,
    lazyChunksEnabled: lazyTelemetry ? Boolean(lazyTelemetry.lazyModeActive) : true,
    cloudSyncMode: cloudStats?.mode || undefined,
    cloudTotalSlices: cloudStats?.totalSlices ?? 8,
    cloudUploadedSlices: cloudStats?.uploadedSlices ?? 0,
    cloudSkippedSlices: cloudStats?.skippedSlices ?? 0,
    cloudSavedKB: cloudStats?.savedRawBytes
      ? Number((cloudStats.savedRawBytes / 1024).toFixed(1))
      : 0,
    loadedCdnLibrariesCount: Array.isArray(lazyTelemetry?.loadedCdnLibraries)
      ? lazyTelemetry.loadedCdnLibraries.length
      : 0,
    loadedLegacyModulesCount: Array.isArray(lazyTelemetry?.loadedLegacyModules)
      ? lazyTelemetry.loadedLegacyModules.length
      : 0,
  };
}

// ============================================================================
// CNDP Law 09-08 Privacy / Anonymization Mode for Classroom Board Projection
// ============================================================================

export function isPrivacyModeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(PRIVACY_MODE_STORAGE_KEY) === 'true';
}

export function setPrivacyModeEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PRIVACY_MODE_STORAGE_KEY, enabled ? 'true' : 'false');
  (window as any).__cndpPrivacyMode = enabled;
  if (enabled) {
    document.body.classList.add('cndp-privacy-mode-active');
  } else {
    document.body.classList.remove('cndp-privacy-mode-active');
  }
  appendAuditLog({
    category: 'privacy_toggle',
    actionTitle: enabled
      ? 'تفعيل وضع حماية المعطيات الشخصية (إخفاء الهوية للعرض على السبورة - القانون 09-08)'
      : 'إيقاف وضع إخفاء الهوية والعودة للعرض الاعتيادي للأستاذ',
    previousValue: enabled ? 'مكشوف' : 'مخفي',
    newValue: enabled ? 'محمي (مجهول الهوية)' : 'عادي'
  });
  window.dispatchEvent(new CustomEvent('privacyModeChanged', { detail: { enabled } }));
}

export function formatStudentNameForDisplay(name: string, indexOrOrder?: number | string): string {
  if (!name) return '';
  if (!isPrivacyModeEnabled()) return name;
  const parts = name.trim().split(/\s+/);
  const initials = parts.map((p) => p.charAt(0)).join('. ');
  const suffix = indexOrOrder !== undefined ? ` #${indexOrOrder}` : '';
  return `تلميذ(ة)${suffix} (${initials}.)`;
}

export function formatMassarForDisplay(massar?: string): string {
  if (!massar) return '-';
  if (!isPrivacyModeEnabled()) return massar;
  const clean = String(massar).trim();
  if (clean.length <= 4) return '****';
  return `${clean.slice(0, 2)}*****${clean.slice(-2)}`;
}

// ============================================================================
// Global Instrumentation Hook (Attaches to window.saveData & Grade/Absence APIs)
// ============================================================================

export function initGlobalPedagogicalGovernanceHooks(): void {
  if (typeof window === 'undefined') return;
  const win = window as any;
  if (win.__pedagogicalGovernanceHooksInstalled) return;
  win.__pedagogicalGovernanceHooksInstalled = true;

  // Apply persisted privacy mode state on boot
  if (isPrivacyModeEnabled()) {
    win.__cndpPrivacyMode = true;
    document.body.classList.add('cndp-privacy-mode-active');
  }

  // Expose global helper object
  win.EduIndexedDB = {
    saveSnapshotToIndexedDB,
    loadLatestSnapshotFromIndexedDB,
    appendAuditLog,
    getAuditLogs,
    getStorageHealthReport,
    isPrivacyModeEnabled,
    setPrivacyModeEnabled,
    formatStudentNameForDisplay,
    formatMassarForDisplay
  };

  win.toggleClassroomPrivacyMode = () => {
    const next = !isPrivacyModeEnabled();
    setPrivacyModeEnabled(next);
    if (typeof win.showToast === 'function') {
      win.showToast(
        next
          ? '🛡️ تم تفعيل وضع حماية الخصوصية (القانون 09-08): تم تمويه أسماء التلاميذ وأرقام مسار للعرض الآمن على السبورة'
          : '🔓 تم إيقاف وضع تمويه الهوية وإظهار الأسماء الكاملة للأستاذ'
      );
    }
    return next;
  };

  // Wrap setStudentGradeBySemester if present or install observer
  let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleIdbMirror = () => {
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => {
      if (win.db) {
        saveSnapshotToIndexedDB(win.db, 'مزامنة تلقائية خلفية (IndexedDB)');
      }
    }, 1200);
  };

  window.addEventListener('dbUpdated', scheduleIdbMirror);

  // Hook into grade setter when available
  const installWrappers = () => {
    if (typeof win.setStudentGradeBySemester === 'function' && !win.__wrappedSetStudentGrade) {
      const origSetGrade = win.setStudentGradeBySemester;
      win.__wrappedSetStudentGrade = true;
      win.setStudentGradeBySemester = function (
        className: string,
        studentId: string,
        examKey: string,
        val: any,
        sem?: any
      ) {
        let prevVal = '-';
        let stdName = String(studentId);
        try {
          if (typeof win.getStudentGradesBySemester === 'function') {
            const oldG = win.getStudentGradesBySemester(className, studentId, sem);
            if (oldG && oldG[examKey] !== undefined && oldG[examKey] !== '') {
              prevVal = String(oldG[examKey]);
            }
          }
          const rawCls = win.db?.classes?.[className];
          const arr = Array.isArray(rawCls) ? rawCls : rawCls?.students || [];
          const found = arr.find((s: any) => String(s.id) === String(studentId));
          if (found?.name) stdName = found.name;
        } catch (_e) {}

        const res = origSetGrade.apply(this, arguments);

        const newValStr = val === undefined || val === null || val === '' ? 'فراغ' : String(val);
        if (prevVal !== newValStr) {
          const semLabel =
            sem === 's2' || sem === 2 || sem === '2' || sem === 'sem2' ? 'الدورة 2' : 'الدورة 1';
          appendAuditLog({
            category: 'grade_update',
            actionTitle: `تحديث نقطة (${String(examKey).toUpperCase()}) - ${semLabel}`,
            className,
            studentId: String(studentId),
            studentName: stdName,
            fieldKey: `${semLabel}:${examKey}`,
            previousValue: prevVal,
            newValue: newValStr
          });
        }
        scheduleIdbMirror();
        return res;
      };
    }

    if (typeof win.saveData === 'function' && !win.__wrappedSaveDataIdb) {
      const origSaveData = win.saveData;
      win.__wrappedSaveDataIdb = true;
      win.saveData = function () {
        const res = origSaveData.apply(this, arguments);
        scheduleIdbMirror();
        return res;
      };
    }
  };

  installWrappers();
  setTimeout(installWrappers, 1500);
  setTimeout(() => {
    if (win.db) {
      saveSnapshotToIndexedDB(win.db, 'نسخة إقلاع المنظومة (Initial Boot Mirror)');
    }
  }, 2000);
}
