import { useSyncExternalStore } from 'react';
import { appendAuditLog } from './indexedDbEngine.ts';

export interface PedagogicalStudentGrades {
  f1?: number | string;
  f2?: number | string;
  f3?: number | string;
  f4?: number | string;
  act?: number | string;
  [key: string]: unknown;
}

export interface PedagogicalStudent {
  id: string;
  name: string;
  massarCode?: string;
  cne?: string;
  group?: string;
  birthDate?: string;
  phone?: string;
  behaviorStatus?: string;
  behaviorNote?: string;
  grades?: {
    s1?: PedagogicalStudentGrades;
    s2?: PedagogicalStudentGrades;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface PedagogicalClassData {
  students: PedagogicalStudent[];
  absences?: Record<string, unknown>;
  homeworks?: unknown[];
  lessonLog?: unknown[];
  stream?: string;
  coefficient?: number;
  [key: string]: unknown;
}

export interface PedagogicalTeacherProfile {
  name?: string;
  username?: string;
  academy?: string;
  directorate?: string;
  school?: string;
  academicYear?: string;
  city?: string;
  phone?: string;
  [key: string]: unknown;
}

export interface PedagogicalSettings {
  schoolYearStart?: string;
  schoolYearEnd?: string;
  presentationMode?: boolean;
  studentPrintMode?: boolean;
  whatsappAutoReminder?: boolean;
  autoLockTimeout?: number;
  [key: string]: unknown;
}

export interface PedagogicalDatabase {
  classes: Record<string, PedagogicalClassData>;
  currentClass?: string;
  currentSemester?: 's1' | 's2' | string;
  teacherProfile?: PedagogicalTeacherProfile;
  settings?: PedagogicalSettings;
  officialHolidays?: Array<{ name?: string; start: string; end: string }>;
  teacherLeaves?: Array<{ type?: string; startDate: string; endDate: string }>;
  [key: string]: unknown;
}

export interface PedagogicalStoreSnapshot {
  version: number;
  updatedAt: number;
  currentClass: string;
  currentSemester: string;
  classNames: string[];
  totalStudents: number;
  teacherName: string;
  academicYear: string;
  db: PedagogicalDatabase;
}

const listeners = new Set<() => void>();
let storeVersion = 1;
let cachedSnapshot: PedagogicalStoreSnapshot | null = null;
let bridgeInitialized = false;

function readWindowDb(): PedagogicalDatabase {
  if (typeof window === 'undefined') {
    return { classes: {} };
  }
  const win = window as unknown as { db?: PedagogicalDatabase };
  if (win.db && typeof win.db === 'object') {
    if (!win.db.classes || typeof win.db.classes !== 'object') {
      win.db.classes = {};
    }
    return win.db;
  }
  return { classes: {} };
}

function computeSnapshot(): PedagogicalStoreSnapshot {
  const db = readWindowDb();
  const classesObj = db.classes && typeof db.classes === 'object' ? db.classes : {};
  const classNames = Object.keys(classesObj);
  let totalStudents = 0;

  for (let i = 0; i < classNames.length; i++) {
    const cls = classesObj[classNames[i]];
    if (cls && Array.isArray(cls.students)) {
      totalStudents += cls.students.length;
    }
  }

  return {
    version: storeVersion,
    updatedAt: Date.now(),
    currentClass: String(db.currentClass || classNames[0] || ''),
    currentSemester: String(db.currentSemester || 's1'),
    classNames,
    totalStudents,
    teacherName: String(db.teacherProfile?.name || 'الأستاذ(ة)'),
    academicYear: String(db.teacherProfile?.academicYear || '2025/2026'),
    db,
  };
}

export function getPedagogicalSnapshot(): PedagogicalStoreSnapshot {
  if (!cachedSnapshot) {
    cachedSnapshot = computeSnapshot();
  }
  return cachedSnapshot;
}

export function subscribePedagogicalStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyPedagogicalStateChange(): void {
  storeVersion += 1;
  cachedSnapshot = computeSnapshot();
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.warn('PedagogicalStore listener error:', err);
    }
  });
}

export function updatePedagogicalState(
  mutator: (db: PedagogicalDatabase) => void,
  actionLabel = 'تحديث حالة المنظومة البيداغوجية',
): PedagogicalDatabase {
  const db = readWindowDb();
  mutator(db);

  if (typeof window !== 'undefined') {
    const win = window as unknown as {
      db?: PedagogicalDatabase;
      saveDB?: () => void;
    };
    win.db = db;
    if (typeof win.saveDB === 'function') {
      win.saveDB();
    } else {
      notifyPedagogicalStateChange();
      window.dispatchEvent(new CustomEvent('dbUpdated'));
    }
  } else {
    notifyPedagogicalStateChange();
  }

  appendAuditLog({
    category: 'system_audit',
    actionTitle: actionLabel,
    newValue: `v${storeVersion}`,
  }).catch(() => {});
  return db;
}

export function usePedagogicalStore<T = PedagogicalStoreSnapshot>(
  selector?: (snapshot: PedagogicalStoreSnapshot) => T,
): T {
  const snapshot = useSyncExternalStore(
    subscribePedagogicalStore,
    getPedagogicalSnapshot,
    getPedagogicalSnapshot,
  );
  return selector ? selector(snapshot) : (snapshot as unknown as T);
}

export function getClientAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const win = window as unknown as {
    __clientSessionToken?: string;
    __currentFirebaseIdToken?: string;
  };
  const headers: Record<string, string> = {};
  if (win.__clientSessionToken) {
    headers['X-Client-Session'] = win.__clientSessionToken;
  }
  if (win.__currentFirebaseIdToken) {
    headers['Authorization'] = `Bearer ${win.__currentFirebaseIdToken}`;
  }
  return headers;
}

export function authenticatedApiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers || {});
  const authHeaders = getClientAuthHeaders();
  Object.entries(authHeaders).forEach(([k, v]) => {
    if (!headers.has(k)) headers.set(k, v);
  });
  return window.fetch(input, { ...(init || {}), headers });
}

export interface PrecomputedStudentMetrics {
  id: string;
  name: string;
  massarCode: string;
  group: string;
  s1Average: number | null;
  s2Average: number | null;
  annualAverage: number | null;
  category: string;
}

export interface PrecomputedClassAnalytics {
  className: string;
  version: number;
  studentCount: number;
  evaluatedCount: number;
  classMean: number;
  passCount: number;
  passRate: number;
  strugglingCount: number;
  excellentCount: number;
  studentsMap: Record<string, PrecomputedStudentMetrics>;
}

const precomputedClassCache = new Map<string, PrecomputedClassAnalytics>();

function computeAvgFromGradesObj(gradesObj: PedagogicalStudentGrades | undefined): number | null {
  if (!gradesObj || typeof gradesObj !== 'object') return null;
  const keys = ['f1', 'f2', 'f3', 'exam1', 'exam2', 'exam3'];
  const vals: number[] = [];
  for (let i = 0; i < keys.length; i++) {
    const raw = gradesObj[keys[i]];
    if (raw !== undefined && raw !== null && raw !== '') {
      const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
      if (!Number.isNaN(n) && n >= 0 && n <= 20) vals.push(n);
    }
  }
  if (vals.length === 0) return null;
  const examAvg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const rawAct = gradesObj.act ?? gradesObj.activity;
  if (rawAct !== undefined && rawAct !== null && rawAct !== '') {
    const actN = typeof rawAct === 'number' ? rawAct : parseFloat(String(rawAct).replace(',', '.'));
    if (!Number.isNaN(actN) && actN >= 0 && actN <= 20) {
      return Number((examAvg * 0.75 + actN * 0.25).toFixed(2));
    }
  }
  return Number(examAvg.toFixed(2));
}

/**
 * فهرس حسابي مسبق (Memoized Pre-Index) لمعدلات وإحصائيات القسم لمنع إعادة الحساب المكلف في اللوائح الكبرى
 */
export function getPrecomputedClassIndex(className?: string): PrecomputedClassAnalytics {
  const snap = getPedagogicalSnapshot();
  const targetClass = className || snap.currentClass || snap.classNames[0] || '';
  const cached = precomputedClassCache.get(targetClass);
  if (cached && cached.version === snap.version) {
    return cached;
  }

  const clsData = snap.db.classes?.[targetClass];
  const rawStudents = Array.isArray(clsData)
    ? (clsData as unknown as PedagogicalStudent[])
    : Array.isArray(clsData?.students)
      ? clsData.students
      : [];

  const studentsMap: Record<string, PrecomputedStudentMetrics> = {};
  const activeAverages: number[] = [];
  const isS2 = snap.currentSemester === 's2';

  for (let i = 0; i < rawStudents.length; i++) {
    const st = rawStudents[i];
    if (!st) continue;
    const sid = String(st.id || st.massarCode || `idx_${i}`);
    const s1Avg = computeAvgFromGradesObj(st.grades?.s1);
    const s2Avg = computeAvgFromGradesObj(st.grades?.s2);
    const annualAvg =
      s1Avg !== null && s2Avg !== null
        ? Number(((s1Avg + s2Avg) / 2).toFixed(2))
        : (s1Avg ?? s2Avg);
    const activeAvg = isS2 ? (s2Avg ?? s1Avg) : (s1Avg ?? s2Avg);
    if (activeAvg !== null) activeAverages.push(activeAvg);

    const category =
      activeAvg === null
        ? 'empty'
        : activeAvg >= 14
          ? 'excellent'
          : activeAvg >= 12
            ? 'good'
            : activeAvg >= 10
              ? 'medium'
              : activeAvg >= 8
                ? 'warning'
                : 'struggling';

    studentsMap[sid] = {
      id: sid,
      name: String(st.name || ''),
      massarCode: String(st.massarCode || st.cne || ''),
      group: String(st.group || ''),
      s1Average: s1Avg,
      s2Average: s2Avg,
      annualAverage: annualAvg,
      category,
    };
  }

  const evaluatedCount = activeAverages.length;
  const sum = activeAverages.reduce((a, b) => a + b, 0);
  const classMean = evaluatedCount > 0 ? Number((sum / evaluatedCount).toFixed(2)) : 0;
  const passCount = activeAverages.filter((v) => v >= 10).length;
  const passRate = evaluatedCount > 0 ? Number(((passCount / evaluatedCount) * 100).toFixed(1)) : 0;
  const strugglingCount = activeAverages.filter((v) => v < 8).length;
  const excellentCount = activeAverages.filter((v) => v >= 14).length;

  const computed: PrecomputedClassAnalytics = {
    className: targetClass,
    version: snap.version,
    studentCount: rawStudents.length,
    evaluatedCount,
    classMean,
    passCount,
    passRate,
    strugglingCount,
    excellentCount,
    studentsMap,
  };

  precomputedClassCache.set(targetClass, computed);
  return computed;
}

export function getAllPrecomputedClassesIndex(): Record<string, PrecomputedClassAnalytics> {
  const snap = getPedagogicalSnapshot();
  const result: Record<string, PrecomputedClassAnalytics> = {};
  for (let i = 0; i < snap.classNames.length; i++) {
    const cName = snap.classNames[i];
    result[cName] = getPrecomputedClassIndex(cName);
  }
  return result;
}

/**
 * Synchronizes `window.db` / `window.saveDB` with the typed React store
 * and exposes `window.PedagogicalStore` and `window.authenticatedApiFetch`.
 */
export function initPedagogicalStoreBridge(): void {
  if (typeof window === 'undefined' || bridgeInitialized) return;
  bridgeInitialized = true;

  const win = window as unknown as {
    PedagogicalStore?: Record<string, unknown>;
    authenticatedApiFetch?: typeof authenticatedApiFetch;
    getClientAuthHeaders?: typeof getClientAuthHeaders;
    __clientSessionToken?: string;
    __currentFirebaseIdToken?: string;
  };

  if (!win.__clientSessionToken) {
    try {
      const existing = sessionStorage.getItem('prof_digital_client_session_v1');
      if (existing) {
        win.__clientSessionToken = existing;
      } else {
        const generated = `pd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
        sessionStorage.setItem('prof_digital_client_session_v1', generated);
        win.__clientSessionToken = generated;
      }
    } catch {
      win.__clientSessionToken = `pd_${Date.now().toString(36)}`;
    }
  }

  window.addEventListener('dbUpdated', () => {
    notifyPedagogicalStateChange();
  });

  window.addEventListener('storage', (ev) => {
    if (!ev.key || ev.key.includes('math_') || ev.key.includes('db')) {
      notifyPedagogicalStateChange();
    }
  });

  win.getClientAuthHeaders = getClientAuthHeaders;
  win.authenticatedApiFetch = authenticatedApiFetch;
  win.PedagogicalStore = {
    getSnapshot: getPedagogicalSnapshot,
    subscribe: subscribePedagogicalStore,
    updateState: updatePedagogicalState,
    notifyChange: notifyPedagogicalStateChange,
    getClientAuthHeaders,
    authenticatedApiFetch,
    getPrecomputedClassIndex,
    getAllPrecomputedClassesIndex,
  };
}
