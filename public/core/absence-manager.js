/**
 * ============================================================================
 * محرك تدبير الغياب والمواظبة والتنبيهات الإدارية (Absence Manager Engine)
 * المسار: /public/core/absence-manager.js
 * ============================================================================
 * يوفر:
 * - فحص إعفاء التواريخ من الغياب بسبب العطل الرسمية أو الرخص الإدارية (isDateExemptFromAbsence)
 * - حساب حصيلة الغياب (مبرر / غير مبرر / تأخر) وتصنيف درجة الخطورة (calculateStudentAbsenceSummary)
 * - توليد صيغ إشعارات أولياء الأمور عبر واتساب بصياغة تربوية رسمية (formatParentWhatsAppAbsenceNotice)
 * ============================================================================
 */
(function (window) {
    'use strict';

    /**
     * التحقق مما إذا كان تاريخ معين (YYYY-MM-DD) يصادف عطلة رسمية أو رخصة إدارية/طبية للأستاذ
     */
    function isDateExemptFromAbsence(dateStr, holidaysList, leavesList) {
        if (!dateStr || typeof dateStr !== 'string') return { exempt: false, reason: '' };
        const cleanDate = dateStr.trim().slice(0, 10);

        const holidays = Array.isArray(holidaysList)
            ? holidaysList
            : (window.db && Array.isArray(window.db.officialHolidays) ? window.db.officialHolidays : []);

        for (let i = 0; i < holidays.length; i++) {
            const h = holidays[i];
            if (!h) continue;
            const start = String(h.start || h.startDate || '').slice(0, 10);
            const end = String(h.end || h.endDate || start).slice(0, 10);
            if (start && cleanDate >= start && cleanDate <= end) {
                return { exempt: true, type: 'holiday', reason: h.name || h.title || 'عطلة مدرسية رسمية' };
            }
        }

        const leaves = Array.isArray(leavesList)
            ? leavesList
            : (window.db && Array.isArray(window.db.teacherLeaves) ? window.db.teacherLeaves : []);

        for (let j = 0; j < leaves.length; j++) {
            const lv = leaves[j];
            if (!lv) continue;
            const start = String(lv.startDate || lv.start || '').slice(0, 10);
            const end = String(lv.endDate || lv.end || start).slice(0, 10);
            if (start && cleanDate >= start && cleanDate <= end) {
                return { exempt: true, type: 'leave', reason: lv.type || lv.reason || 'رخصة إدارية/طبية' };
            }
        }

        return { exempt: false, reason: '' };
    }

    /**
     * تصنيف مستوى خطورة الغياب وفق الضوابط الإدارية المدرسية
     */
    function classifyAttendanceRiskLevel(unjustifiedHours, totalHours) {
        const unj = Number(unjustifiedHours) || 0;
        const tot = Number(totalHours) || 0;

        if (unj >= 10 || tot >= 16) {
            return {
                level: 'critical',
                badge: 'إنذار إداري / استدعاء ولي الأمر',
                color: '#991b1b',
                bg: '#fef2f2',
                border: '#f87171'
            };
        }
        if (unj >= 4 || tot >= 8) {
            return {
                level: 'warning',
                badge: 'تنبيه مواظبة أولي',
                color: '#9a3412',
                bg: '#fff7ed',
                border: '#fb923c'
            };
        }
        if (tot > 0) {
            return {
                level: 'notice',
                badge: 'غياب مسجل',
                color: '#854d0e',
                bg: '#fefce8',
                border: '#facc15'
            };
        }
        return {
            level: 'exemplary',
            badge: 'مواظبة منتظمة',
            color: '#065f46',
            bg: '#ecfdf5',
            border: '#34d399'
        };
    }

    /**
     * حساب ملخص الغياب والتأخر لتلميذ معين مع استثناء أيام العطل والرخص
     */
    function calculateStudentAbsenceSummary(records, options) {
        const opts = options || {};
        const list = Array.isArray(records) ? records : [];
        let justifiedHours = 0;
        let unjustifiedHours = 0;
        let lateCount = 0;
        let exemptedCount = 0;

        for (let i = 0; i < list.length; i++) {
            const rec = list[i];
            if (!rec) continue;
            const dateStr = rec.date || rec.day || '';
            if (opts.excludeHolidaysAndLeaves !== false && dateStr) {
                const ex = isDateExemptFromAbsence(dateStr, opts.holidays, opts.leaves);
                if (ex.exempt) {
                    exemptedCount++;
                    continue;
                }
            }

            if (rec.type === 'late' || rec.isLate) {
                lateCount++;
                continue;
            }

            const hours = Number(rec.hours || rec.duration || 1) || 1;
            if (rec.justified || rec.status === 'justified' || rec.type === 'justified') {
                justifiedHours += hours;
            } else {
                unjustifiedHours += hours;
            }
        }

        const totalHours = justifiedHours + unjustifiedHours;
        const risk = classifyAttendanceRiskLevel(unjustifiedHours, totalHours);

        return {
            totalHours,
            justifiedHours,
            unjustifiedHours,
            lateCount,
            exemptedCount,
            risk
        };
    }

    /**
     * توليد رسالة إشعار رسمية لولي الأمر عبر واتساب بخصوص غياب التلميذ
     */
    function formatParentWhatsAppAbsenceNotice(params) {
        const p = params || {};
        const studentName = p.studentName || 'التلميذ(ة)';
        const className = p.className || 'القسم';
        const teacherName = p.teacherName || (window.db && window.db.settings && window.db.settings.teacherName) || 'أستاذ مادة الرياضيات';
        const schoolName = p.schoolName || (window.db && window.db.settings && window.db.settings.schoolName) || 'المؤسسة التعليمية';
        const totalHours = Number(p.totalHours) || 0;
        const unjustifiedHours = Number(p.unjustifiedHours) || 0;
        const lastDate = p.lastDate || new Date().toISOString().slice(0, 10);

        return [
            `السلام عليكم ورحمة الله تعالى وبركاته،`,
            `تحية طيبة لولي أمر التلميذ(ة): *${studentName}* (${className})`,
            `المؤسسة: ${schoolName}`,
            `────────────────────`,
            `نود إخباركم بتسجيل غياب في حصة مادة الرياضيات بتاريخ: ${lastDate}.`,
            `• مجموع ساعات الغياب المسجلة: *${totalHours} س* (منها *${unjustifiedHours} س* غير مبررة).`,
            `نرجو منكم التواصل مع الإدارة التربوية أو الحرص على تبرير الغياب وتتبع مواظبة التلميذ(ة) لما فيه مصلحته(ها) الدراسية.`,
            `────────────────────`,
            `مع خالص التقدير — ${teacherName}`
        ].join('\n');
    }

    const AbsenceManager = {
        isDateExemptFromAbsence,
        classifyAttendanceRiskLevel,
        calculateStudentAbsenceSummary,
        formatParentWhatsAppAbsenceNotice
    };

    window.AbsenceManager = AbsenceManager;
})(typeof window !== 'undefined' ? window : globalThis);
