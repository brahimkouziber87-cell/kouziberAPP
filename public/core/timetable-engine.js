/**
 * ============================================================================
 * محرك جدول الحصص والحمل التدريسي وكشف التعارضات (Timetable & Teaching Load Engine)
 * المسار: /public/core/timetable-engine.js
 * ============================================================================
 * يوفر:
 * - تطبيع مفاتيح أيام الأسبوع بين الصيغ العربية والإنجليزية والفرنسية (normalizeDayKeyToArabic)
 * - استخراج اسم القسم الصافي من خانة الحصة (extractClassNameFromSlot)
 * - حساب الغلاف الزمني الأسبوعي الرسمي للأستاذ وتوزيعه حسب الأقسام (calculateWeeklyTeachingHours)
 * - كشف التعارضات الزمنية بين الحصص الرسمية وحصص الدعم المبرمجة (detectTimetableConflicts)
 * ============================================================================
 */
(function (window) {
    'use strict';

    const DAY_KEY_MAP = {
        'monday': 'الإثنين',
        'mon': 'الإثنين',
        'lundi': 'الإثنين',
        'الاثنين': 'الإثنين',
        'الإثنين': 'الإثنين',
        'tuesday': 'الثلاثاء',
        'tue': 'الثلاثاء',
        'mardi': 'الثلاثاء',
        'الثلاثاء': 'الثلاثاء',
        'wednesday': 'الأربعاء',
        'wed': 'الأربعاء',
        'mercredi': 'الأربعاء',
        'الاربعاء': 'الأربعاء',
        'الأربعاء': 'الأربعاء',
        'thursday': 'الخميس',
        'thu': 'الخميس',
        'jeudi': 'الخميس',
        'الخميس': 'الخميس',
        'friday': 'الجمعة',
        'fri': 'الجمعة',
        'vendredi': 'الجمعة',
        'الجمعة': 'الجمعة',
        'saturday': 'السبت',
        'sat': 'السبت',
        'samedi': 'السبت',
        'السبت': 'السبت'
    };

    const OFFICIAL_MOROCCAN_SCHOOL_DAYS = ['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    /**
     * تحويل مفتاح اليوم إلى الاسم العربي المعتمد
     */
    function normalizeDayKeyToArabic(rawDay) {
        if (!rawDay) return '';
        const cleaned = String(rawDay).trim().toLowerCase();
        return DAY_KEY_MAP[cleaned] || String(rawDay).trim();
    }

    /**
     * استخراج اسم القسم الصافي من نص الحصة (مثال: "2BAC-PC-1 - رياضيات (القاعة 12)" -> "2BAC-PC-1")
     */
    function extractClassNameFromSlot(slotValue) {
        if (!slotValue) return '';
        if (typeof slotValue === 'object') {
            return String(slotValue.className || slotValue.class || slotValue.cls || '').trim();
        }
        const raw = String(slotValue).trim();
        if (!raw || raw === '-' || raw === 'فارغ') return '';
        const parts = raw.split(/\s+-\s+|\s*\|\s*/);
        return parts[0].replace(/\(.*?\)/g, '').trim();
    }

    /**
     * حساب الغلاف الزمني الأسبوعي للأستاذ وتفصيله حسب كل قسم ويوم
     */
    function calculateWeeklyTeachingHours(timetableObj, hoursPerSlot) {
        const slotDuration = Number(hoursPerSlot) > 0 ? Number(hoursPerSlot) : 1;
        const tt = (timetableObj && typeof timetableObj === 'object')
            ? timetableObj
            : (window.db && window.db.timetable ? window.db.timetable : {});

        const byClass = {};
        const byDay = {};
        OFFICIAL_MOROCCAN_SCHOOL_DAYS.forEach(d => { byDay[d] = 0; });
        let totalWeeklySlots = 0;

        Object.keys(tt).forEach(rawDay => {
            const arDay = normalizeDayKeyToArabic(rawDay);
            const daySlots = tt[rawDay];
            if (!daySlots || typeof daySlots !== 'object') return;

            Object.keys(daySlots).forEach(slotKey => {
                const clsName = extractClassNameFromSlot(daySlots[slotKey]);
                if (!clsName) return;
                totalWeeklySlots += 1;
                byClass[clsName] = (byClass[clsName] || 0) + slotDuration;
                byDay[arDay] = (byDay[arDay] || 0) + slotDuration;
            });
        });

        const totalWeeklyHours = Number((totalWeeklySlots * slotDuration).toFixed(1));
        return {
            totalWeeklySlots,
            totalWeeklyHours,
            byClass,
            byDay
        };
    }

    /**
     * كشف التعارضات الزمنية بين الحصص الرسمية وحصص الدعم أو الأنشطة الموازية
     */
    function detectTimetableConflicts(timetableObj, extraSessions) {
        const tt = (timetableObj && typeof timetableObj === 'object') ? timetableObj : {};
        const occupied = new Map();
        const conflicts = [];

        Object.keys(tt).forEach(rawDay => {
            const arDay = normalizeDayKeyToArabic(rawDay);
            const daySlots = tt[rawDay];
            if (!daySlots || typeof daySlots !== 'object') return;
            Object.keys(daySlots).forEach(slotKey => {
                const cls = extractClassNameFromSlot(daySlots[slotKey]);
                if (!cls) return;
                const key = `${arDay}::${String(slotKey).toLowerCase()}`;
                occupied.set(key, cls);
            });
        });

        const extras = Array.isArray(extraSessions) ? extraSessions : [];
        extras.forEach((sess, idx) => {
            if (!sess) return;
            const arDay = normalizeDayKeyToArabic(sess.day || sess.dayOfWeek || '');
            const slotKey = String(sess.slot || sess.period || '').toLowerCase();
            if (!arDay || !slotKey) return;
            const key = `${arDay}::${slotKey}`;
            if (occupied.has(key)) {
                conflicts.push({
                    index: idx,
                    day: arDay,
                    slot: slotKey,
                    officialClass: occupied.get(key),
                    conflictingClass: sess.className || sess.title || 'حصة إضافية'
                });
            }
        });

        return {
            hasConflicts: conflicts.length > 0,
            conflictCount: conflicts.length,
            conflicts
        };
    }

    const TimetableEngine = {
        OFFICIAL_MOROCCAN_SCHOOL_DAYS,
        normalizeDayKeyToArabic,
        extractClassNameFromSlot,
        calculateWeeklyTeachingHours,
        detectTimetableConflicts
    };

    window.TimetableEngine = TimetableEngine;
})(typeof window !== 'undefined' ? window : globalThis);
