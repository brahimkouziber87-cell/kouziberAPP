/**
 * ============================================================================
 * محرك إزالة التكرار الذكي وتدقيق أرشيف المواسم (Archive & Deduplication Engine)
 * المسار: /public/core/archive-dedup-engine.js
 * ============================================================================
 * يوفر:
 * - تطبيع الأسماء العربية للتلاميذ لمطابقة السجلات المكررة (normalizeArabicStudentName)
 * - كشف التلاميذ المكررين داخل نفس القسم بناءً على رقم مسار أو تطابق الاسم الكامل (detectDuplicateStudentsInClass)
 * - دمج سجلين مكررين لتلميذ واحد دون ضياع أي نقطة أو غياب (mergeDuplicateStudentRecords)
 * - التحقق من سلامة حزمة أرشيف الموسم الدراسي (validateSeasonArchiveSnapshot)
 * ============================================================================
 */
(function (window) {
    'use strict';

    /**
     * تطبيع الاسم العربي للتلميذ (توحيد الهمزات والتاء المربوطة والألف المقصورة والمسافات)
     */
    function normalizeArabicStudentName(rawName) {
        if (!rawName) return '';
        return String(rawName)
            .replace(/[\u064B-\u065F\u0670]/g, '') // إزالة التشكيل
            .replace(/[إأآٱ]/g, 'ا')
            .replace(/ى/g, 'ي')
            .replace(/ة/g, 'ه')
            .replace(/ؤ/g, 'و')
            .replace(/ئ/g, 'ي')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    /**
     * كشف التلاميذ المكررين داخل لائحة قسم معين
     */
    function detectDuplicateStudentsInClass(students) {
        const list = Array.isArray(students) ? students : [];
        const byMassar = new Map();
        const byName = new Map();
        const duplicateGroups = [];

        list.forEach((st, idx) => {
            if (!st) return;
            const code = String(st.massarCode || st.cne || '').replace(/\s+/g, '').toUpperCase();
            const normName = normalizeArabicStudentName(st.name);

            if (code && code.length >= 6) {
                if (byMassar.has(code)) {
                    duplicateGroups.push({
                        reason: 'massar_code',
                        key: code,
                        primaryIndex: byMassar.get(code).index,
                        duplicateIndex: idx,
                        primaryStudent: byMassar.get(code).student,
                        duplicateStudent: st
                    });
                    return;
                }
                byMassar.set(code, { index: idx, student: st });
            }

            if (normName && normName.length >= 5) {
                if (byName.has(normName)) {
                    duplicateGroups.push({
                        reason: 'normalized_name',
                        key: normName,
                        primaryIndex: byName.get(normName).index,
                        duplicateIndex: idx,
                        primaryStudent: byName.get(normName).student,
                        duplicateStudent: st
                    });
                    return;
                }
                byName.set(normName, { index: idx, student: st });
            }
        });

        return {
            hasDuplicates: duplicateGroups.length > 0,
            duplicateCount: duplicateGroups.length,
            duplicateGroups
        };
    }

    /**
     * دمج سجل تلميذ مكرر في السجل الأساسي مع الحفاظ على كافة النقط والمعطيات غير الفارغة
     */
    function mergeDuplicateStudentRecords(primary, duplicate) {
        const base = Object.assign({}, duplicate || {}, primary || {});
        if (!base.massarCode && duplicate && duplicate.massarCode) base.massarCode = duplicate.massarCode;
        if (!base.phone && duplicate && duplicate.phone) base.phone = duplicate.phone;
        if (!base.birthDate && duplicate && duplicate.birthDate) base.birthDate = duplicate.birthDate;
        if (!base.group && duplicate && duplicate.group) base.group = duplicate.group;

        const pGrades = (primary && primary.grades) || {};
        const dGrades = (duplicate && duplicate.grades) || {};
        base.grades = {
            s1: Object.assign({}, dGrades.s1 || {}, pGrades.s1 || {}),
            s2: Object.assign({}, dGrades.s2 || {}, pGrades.s2 || {})
        };

        return base;
    }

    /**
     * التحقق من سلامة بنية أرشيف موسم دراسي
     */
    function validateSeasonArchiveSnapshot(archiveObj) {
        if (!archiveObj || typeof archiveObj !== 'object') {
            return { valid: false, reason: 'بنية الأرشيف فارغة أو غير صالحة' };
        }
        const classes = archiveObj.classes || (archiveObj.data && archiveObj.data.classes) || {};
        const classNames = Object.keys(classes);
        let totalStudents = 0;
        classNames.forEach(c => {
            const arr = Array.isArray(classes[c]) ? classes[c] : (classes[c] && Array.isArray(classes[c].students) ? classes[c].students : []);
            totalStudents += arr.length;
        });

        return {
            valid: classNames.length > 0,
            academicYear: archiveObj.academicYear || archiveObj.season || 'غير محدد',
            classesCount: classNames.length,
            totalStudents
        };
    }

    const ArchiveDedupEngine = {
        normalizeArabicStudentName,
        detectDuplicateStudentsInClass,
        mergeDuplicateStudentRecords,
        validateSeasonArchiveSnapshot
    };

    window.ArchiveDedupEngine = ArchiveDedupEngine;
})(typeof window !== 'undefined' ? window : globalThis);
