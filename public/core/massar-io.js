/**
 * ============================================================================
 * محرك استيراد وتصدير بيانات منظومة مسار (Massar IO & Validation Engine)
 * المسار: /public/core/massar-io.js
 * ============================================================================
 * يوفر:
 * - تحليل صيغ التواريخ في ملفات مسار (parseMassarDate)
 * - التحقق من صيغة رقم مسار القياسي (isMassarCode / normalizeMassarStudentId)
 * - تطبيع خلايا العناوين والأفواج والنقط العددية (cleanCellForMassarMatch, normalizeGroupValue, parseMassarGradeValue)
 * - التدقيق البنيوي لصفوف التلاميذ المستوردة وتوليد ملفات التصدير المتوافقة مع مسار
 * ============================================================================
 */
(function (window) {
    'use strict';

    /**
     * تحليل ذكي لصيغ التواريخ في ملفات مسار (Excel Serial, DD/MM/YYYY, YYYY-MM-DD, Date object)
     */
    function parseMassarDate(rawVal) {
        if (rawVal === undefined || rawVal === null || rawVal === '') {
            return { fullDate: '', birthYear: '' };
        }

        if (rawVal instanceof Date && !isNaN(rawVal.getTime())) {
            const y = rawVal.getFullYear();
            const m = String(rawVal.getMonth() + 1).padStart(2, '0');
            const d = String(rawVal.getDate()).padStart(2, '0');
            return { fullDate: `${d}/${m}/${y}`, birthYear: String(y) };
        }

        if (typeof rawVal === 'number' && rawVal > 10000 && rawVal < 60000) {
            const utcDays = Math.floor(rawVal - 25569);
            const utcValue = utcDays * 86400;
            const dObj = new Date(utcValue * 1000);
            if (!isNaN(dObj.getTime())) {
                const y = dObj.getUTCFullYear();
                const m = String(dObj.getUTCMonth() + 1).padStart(2, '0');
                const d = String(dObj.getUTCDate()).padStart(2, '0');
                return { fullDate: `${d}/${m}/${y}`, birthYear: String(y) };
            }
        }

        const str = String(rawVal).trim();
        if (!str) return { fullDate: '', birthYear: '' };

        if (/^\d{5}$/.test(str)) {
            const num = parseInt(str, 10);
            if (num > 10000 && num < 60000) {
                const utcDays = Math.floor(num - 25569);
                const utcValue = utcDays * 86400;
                const dObj = new Date(utcValue * 1000);
                if (!isNaN(dObj.getTime())) {
                    const y = dObj.getUTCFullYear();
                    const m = String(dObj.getUTCMonth() + 1).padStart(2, '0');
                    const d = String(dObj.getUTCDate()).padStart(2, '0');
                    return { fullDate: `${d}/${m}/${y}`, birthYear: String(y) };
                }
            }
        }

        const matchYMD = str.match(/\b(19\d{2}|20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/);
        if (matchYMD) {
            const y = matchYMD[1];
            const m = String(matchYMD[2]).padStart(2, '0');
            const d = String(matchYMD[3]).padStart(2, '0');
            return { fullDate: `${d}/${m}/${y}`, birthYear: y };
        }

        const matchDMY = str.match(/\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](19\d{2}|20\d{2})\b/);
        if (matchDMY) {
            const d = String(matchDMY[1]).padStart(2, '0');
            const m = String(matchDMY[2]).padStart(2, '0');
            const y = matchDMY[3];
            return { fullDate: `${d}/${m}/${y}`, birthYear: y };
        }

        const yearMatch = str.match(/\b(19\d{2}|20\d{2})\b/);
        return { fullDate: str, birthYear: yearMatch ? yearMatch[1] : (str.length >= 4 ? str.slice(-4) : '') };
    }

    /**
     * فحص صيغة رقم مسار المغربي القياسي (حرف متبوع بأرقام أو صيغ CNE القديمة)
     */
    function isMassarCode(str) {
        if (!str) return false;
        const clean = String(str).replace(/\s+/g, '').toUpperCase();
        return /^[A-Z][0-9]{8,10}$/.test(clean) || /^[A-Z]{1,2}[0-9]{7,10}$/.test(clean) || /^[0-9]{8,10}$/.test(clean);
    }

    /**
     * تطبيع رقم مسار وإزالة الفراغات والرموز غير الصالحة
     */
    function normalizeMassarStudentId(rawId) {
        if (!rawId) return '';
        return String(rawId).replace(/[\s\u00A0\-_]+/g, '').toUpperCase().trim();
    }

    /**
     * تطبيع نص الخلية لمطابقة العناوين بدقة ومنع سقوط الأسماء
     */
    function cleanCellForMassarMatch(s) {
        if (!s) return '';
        return String(s)
            .replace(/[\u00A0\r\n\t]+/g, ' ')
            .toLowerCase()
            .replace(/[إأآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/[\-_/\\:.]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * توحيد وتطبيع قيمة الفوج/المجموعة من الملف
     */
    function normalizeGroupValue(val) {
        if (val === undefined || val === null || val === '') return '';
        const str = String(val).trim().toUpperCase();
        if (str === '1' || str === 'G1' || str === 'GROUPE 1' || str === 'الفوج 1' || str === 'فوج 1' || str === 'المجموعة 1') return 'G1';
        if (str === '2' || str === 'G2' || str === 'GROUPE 2' || str === 'الفوج 2' || str === 'فوج 2' || str === 'المجموعة 2') return 'G2';
        if (str.includes('1') || str.includes('أ') || str.includes('A')) return 'G1';
        if (str.includes('2') || str.includes('ب') || str.includes('B')) return 'G2';
        return '';
    }

    /**
     * تحويل النقط العددية من ملفات مسار (يدعم الفاصلة الفرنسية/المغربية 14,50 والنقطة 14.50)
     */
    function parseMassarGradeValue(val) {
        if (val === undefined || val === null || val === '') return undefined;
        if (typeof val === 'number') {
            return (!isNaN(val) && val >= 0 && val <= 20) ? val : undefined;
        }
        const clean = String(val).trim().replace(',', '.').replace(/[^\d.-]/g, '');
        if (!clean) return undefined;
        const num = parseFloat(clean);
        if (!isNaN(num) && num >= 0 && num <= 20) return num;
        return undefined;
    }

    /**
     * التحقق من سلامة بيانات صف تلميذ مستورد من مسار قبل دمجه في قاعدة البيانات
     */
    function validateMassarImportRow(rowObj) {
        const errors = [];
        if (!rowObj || typeof rowObj !== 'object') {
            return { valid: false, errors: ['سجل فارغ أو غير صالح'] };
        }
        const name = String(rowObj.name || '').trim();
        const massarCode = normalizeMassarStudentId(rowObj.massarCode || rowObj.cne || rowObj.id || '');

        if (!name || name.length < 2) {
            errors.push('اسم التلميذ ناقص أو غير مقروء');
        }
        if (massarCode && !isMassarCode(massarCode)) {
            errors.push('صيغة رقم مسار غير قياسية');
        }

        const gradeFields = ['f1', 'f2', 'f3', 'f4', 'act'];
        for (let i = 0; i < gradeFields.length; i++) {
            const k = gradeFields[i];
            if (rowObj[k] !== undefined && rowObj[k] !== null && rowObj[k] !== '') {
                const parsed = parseMassarGradeValue(rowObj[k]);
                if (parsed === undefined) {
                    errors.push(`النقطة (${k}) خارج المجال المسموح [0..20]`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            normalizedMassarCode: massarCode,
            normalizedName: name,
            normalizedGroup: normalizeGroupValue(rowObj.group),
            errors
        };
    }

    /**
     * بناء محتوى CSV قياسي متوافق مع استيراد وتصدير مسار (UTF-8 BOM)
     */
    function buildMassarCsvExport(students, className, semester) {
        const sem = semester === 's2' ? 's2' : 's1';
        const streamCfg = (window.GradesCalculator && typeof window.GradesCalculator.getStreamOfficialConfig === 'function')
            ? window.GradesCalculator.getStreamOfficialConfig(className || '')
            : null;
        const examCount = (streamCfg && Number(streamCfg.examsPerSemester) >= 2 && Number(streamCfg.examsPerSemester) <= 4)
            ? Number(streamCfg.examsPerSemester)
            : 3;
        const hasThreeExams = examCount >= 3;
        const hasFourExams = examCount >= 4;
        const header = [
            'رقم الترتيب',
            'رقم مسار',
            'الاسم الكامل',
            'الفوج',
            'الفرض 1',
            'الفرض 2',
            ...(hasThreeExams ? ['الفرض 3'] : []),
            ...(hasFourExams ? ['الفرض 4'] : []),
            'الأنشطة المندمجة',
            'المعدل الدوري'
        ];
        const rows = [header.join(';')];
        const list = Array.isArray(students) ? students : (students && Array.isArray(students.students) ? students.students : []);

        list.forEach((st, idx) => {
            const grades = (st && st.grades && st.grades[sem]) ? st.grades[sem] : (st && st.grades ? st.grades : {});
            const f1 = grades.f1 !== undefined && grades.f1 !== null ? String(grades.f1).replace('.', ',') : '';
            const f2 = grades.f2 !== undefined && grades.f2 !== null ? String(grades.f2).replace('.', ',') : '';
            const f3 = grades.f3 !== undefined && grades.f3 !== null ? String(grades.f3).replace('.', ',') : '';
            const f4 = grades.f4 !== undefined && grades.f4 !== null ? String(grades.f4).replace('.', ',') : '';
            const act = grades.act !== undefined && grades.act !== null ? String(grades.act).replace('.', ',') : '';
            let avg = '';
            if (window.GradesCalculator && typeof window.GradesCalculator.calculateStudentSemesterAverage === 'function') {
                const computed = window.GradesCalculator.calculateStudentSemesterAverage(grades, { examCount });
                if (computed !== null) avg = String(computed).replace('.', ',');
            }
            const cells = [
                idx + 1,
                normalizeMassarStudentId(st.massarCode || st.massar || st.cne || ''),
                String(st.name || '').replace(/;/g, ' ').trim(),
                normalizeGroupValue(st.group || ''),
                f1,
                f2,
                ...(hasThreeExams ? [f3] : []),
                ...(hasFourExams ? [f4] : []),
                act,
                avg
            ];
            rows.push(cells.join(';'));
        });

        return '\uFEFF' + rows.join('\r\n');
    }

    const MassarIO = {
        parseMassarDate,
        isMassarCode,
        normalizeMassarStudentId,
        cleanCellForMassarMatch,
        normalizeGroupValue,
        parseMassarGradeValue,
        validateMassarImportRow,
        buildMassarCsvExport
    };

    window.MassarIO = MassarIO;
    window.parseMassarDate = parseMassarDate;
    window.isMassarCode = isMassarCode;
    window.cleanCellForMassarMatch = cleanCellForMassarMatch;
    window.normalizeGroupValue = normalizeGroupValue;
    window.parseMassarGradeValue = parseMassarGradeValue;
})(typeof window !== 'undefined' ? window : globalThis);
