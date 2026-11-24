/**
 * ============================================================================
 * محرك حساب النقط والتنسيق الشرطي والمعاملات الوزارية (Grades Calculator Engine)
 * المسار: /public/core/grades-calculator.js
 * ============================================================================
 * يوفر:
 * - التنسيق الشرطي الموحد للمعدلات وفق العتبات البيداغوجية المغربية (getGradeConditionalStyle)
 * - جدول المعاملات وعدد الفروض المحروسة الرسمية حسب الشعب والمسالك (getStreamOfficialConfig)
 * - حساب المعدل الدوري للتلميذ (الفروض المحروسة + أنشطة المراقبة المستمرة/الواجبات)
 * - حساب المؤشرات الإحصائية للقسم (المتوسط، الوسيط، الانحراف المعياري، نسبة النجاح، المتعثرون)
 * ============================================================================
 */
(function (window) {
    'use strict';

    /**
     * جدول المعاملات الرسمية لمادة الرياضيات بسلك التعليم الثانوي التأهيلي (المذكرات الوزارية - مسالك عام ودولي BIOF)
     */
    const MOROCCAN_MATH_STREAM_CONFIGS = [
        { pattern: /جذع مشترك علمي|مشترك علمي|جذع مشترك تكنولوجي|مشترك تكنولوجي|ج\.م\.ع|ج\.م\.ت|\btcs\b|\btcsf\b|\btct\b|\btc[\s\-_]*sc|\btc[\s\-_]*tech/i, code: 'TCS', label: 'الجذع المشترك العلمي والتكنولوجي (عام ودولي)', coefficient: 4, examsPerSemester: 3, examDurationHours: 2, weeklyHours: 5, annualHours: 170, homeworkPerSemester: 3, continuousWeight: 0.25 },
        { pattern: /جذع مشترك آداب|جذع مشترك اداب|مشترك آداب|مشترك اداب|جذع أدبي|جذع ادبي|جذع مشترك أصيل|مشترك أصيل|ج\.م\.آ|\btcl\b|\btclsh\b|\btco\b|\btc[\s\-_]*l/i, code: 'LIT', label: 'الجذع المشترك للآداب والعلوم الإنسانية والتعليم الأصيل', coefficient: 2, examsPerSemester: 2, examDurationHours: 1, weeklyHours: 2, annualHours: 68, homeworkPerSemester: 2, continuousWeight: 0.25 },
        { pattern: /علوم رياضية|العلوم الرياضية|ع\.?\s*رياضية|س\.ر|\b[12]?b?sm[ab]?\b|\bsm-[ab]\b|sc\.?\s*math/i, code: 'SM', label: 'شعبة العلوم الرياضية (أ / ب - عام ودولي)', coefficient: 9, examsPerSemester: 4, examDurationHours: 2, weeklyHours: 7, annualHours: 238, homeworkPerSemester: 4, continuousWeight: 0.25 },
        { pattern: /علوم فيزيائية|العلوم الفيزيائية|فيزيائية|س\.ف|\b[12]?b?pc\b|\b[12]?b?sp\b|\bspc\b|phys/i, code: 'PC', label: 'مسلك العلوم الفيزيائية (عام ودولي)', coefficient: 7, examsPerSemester: 3, examDurationHours: 2, weeklyHours: 5, annualHours: 170, homeworkPerSemester: 3, continuousWeight: 0.25 },
        { pattern: /علوم الحياة والأرض|علوم الحياة والارض|حياة وأرض|ح\.أ|\b[12]?b?svt\b/i, code: 'SVT', label: 'مسلك علوم الحياة والأرض (عام ودولي)', coefficient: 7, examsPerSemester: 3, examDurationHours: 2, weeklyHours: 5, annualHours: 170, homeworkPerSemester: 3, continuousWeight: 0.25 },
        { pattern: /علوم تجريبية|العلوم التجريبية|ع\.?\s*تجريبية|س\.ت|\b1?b?se\b|\b1?b?exp\b|\b1?b?sx\b|sc\.?\s*exp|1bac\s*sc/i, code: 'SE', label: 'شعبة العلوم التجريبية (الأولى بكالوريا)', coefficient: 7, examsPerSemester: 3, examDurationHours: 2, weeklyHours: 5, annualHours: 170, homeworkPerSemester: 3, continuousWeight: 0.25 },
        { pattern: /علوم زراعية|زراعية|agro/i, code: 'AGRO', label: 'مسلك العلوم الزراعية', coefficient: 7, examsPerSemester: 3, examDurationHours: 2, weeklyHours: 5, annualHours: 170, homeworkPerSemester: 3, continuousWeight: 0.25 },
        { pattern: /علوم وتكنولوجيات|تكنولوجي|كهربائية|ميكانيكية|كهرباء|ميكانيك|\b[12]?b?ste\b|\b[12]?b?stm\b/i, code: 'TECH', label: 'شعبة العلوم والتكنولوجيات (الكهربائية / الميكانيكية)', coefficient: 7, examsPerSemester: 3, examDurationHours: 2, weeklyHours: 5, annualHours: 170, homeworkPerSemester: 3, continuousWeight: 0.25 },
        { pattern: /اقتصاد|إقتصاد|تدبير|محاسباتي|\b[12]?b?eco\b|\b[12]?b?seg\b|\b[12]?b?sgc\b|\b[12]?b?tgc\b|\bgct\b|\bsgec\b|\bgest/i, code: 'ECO', label: 'شعبة العلوم الاقتصادية والتدبير', coefficient: 4, examsPerSemester: 3, examDurationHours: 2, weeklyHours: 4, annualHours: 136, homeworkPerSemester: 3, continuousWeight: 0.25 },
        { pattern: /فنون تطبيقية|فنون|arts/i, code: 'ART', label: 'شعبة الفنون التطبيقية', coefficient: 4, examsPerSemester: 3, examDurationHours: 1, weeklyHours: 3, annualHours: 102, homeworkPerSemester: 3, continuousWeight: 0.25 },
        { pattern: /[12]\s*(?:ème|eme|ère|ere)?\s*bac.*(?:آداب|اداب|إنسانية|انسانية|أصيل|اصيل|lsh|lettres|sh)|(?:أولى|اولى|ثانية|الأولى|الثانية)\s*(?:باك|بكالوريا)?.*(?:آداب|اداب|إنسانية|انسانية|أصيل|اصيل)|\b[12]b?(?:lsh|sh|let|lit)\b/i, code: 'BAC_LSH', label: 'الأولى والثانية بكالوريا آداب وعلوم إنسانية وتعليم أصيل', coefficient: 1, examsPerSemester: 2, examDurationHours: 1, weeklyHours: 2, annualHours: 68, homeworkPerSemester: 2, continuousWeight: 0.25 },
        { pattern: /آداب|اداب|علوم إنسانية|أصيل|اصيل|جذع مشترك أدبي|lsh|tcl|tco|lettres|sh/i, code: 'LIT', label: 'الجذع المشترك للآداب والعلوم الإنسانية والتعليم الأصيل', coefficient: 2, examsPerSemester: 2, examDurationHours: 1, weeklyHours: 2, annualHours: 68, homeworkPerSemester: 2, continuousWeight: 0.25 }
    ];

    /**
     * التنسيق الشرطي والتلوين الديناميكي لمعدلات النقط (/20)
     */
    function getGradeConditionalStyle(avg) {
        if (avg === null || avg === undefined || isNaN(avg) || avg === '') {
            return {
                cls: 'avg-empty',
                category: 'empty',
                label: 'غير مسجل',
                title: 'لم تُسجل نقط بعد',
                bg: '#f8fafc',
                color: '#94a3b8',
                border: '#e2e8f0',
                cssText: 'background: #f8fafc !important; color: #94a3b8 !important; border: 1.5px solid #e2e8f0 !important; box-shadow: none !important;'
            };
        }
        const val = parseFloat(avg);
        if (isNaN(val)) {
            return {
                cls: 'avg-empty',
                category: 'empty',
                label: 'غير مسجل',
                title: 'لم تُسجل نقط بعد',
                bg: '#f8fafc',
                color: '#94a3b8',
                border: '#e2e8f0',
                cssText: 'background: #f8fafc !important; color: #94a3b8 !important; border: 1.5px solid #e2e8f0 !important; box-shadow: none !important;'
            };
        }
        if (val >= 14) {
            return {
                cls: 'avg-pass avg-excellent',
                category: 'excellent',
                label: 'متفوق',
                title: 'متفوق (مستوفٍ بامتياز: ' + val.toFixed(2) + ' / 20)',
                bg: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
                color: '#065f46',
                border: '#34d399',
                cssText: 'background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important; color: #065f46 !important; border: 1.5px solid #34d399 !important; font-weight: 900 !important; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.22) !important;'
            };
        } else if (val >= 12) {
            return {
                cls: 'avg-pass avg-good',
                category: 'good',
                label: 'حسن',
                title: 'حسن (مستوفٍ بجدارة: ' + val.toFixed(2) + ' / 20)',
                bg: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                color: '#166534',
                border: '#86efac',
                cssText: 'background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%) !important; color: #166534 !important; border: 1.5px solid #86efac !important; font-weight: 900 !important; box-shadow: 0 2px 5px rgba(34, 197, 94, 0.16) !important;'
            };
        } else if (val >= 10) {
            return {
                cls: 'avg-pass avg-medium',
                category: 'medium',
                label: 'متوسط',
                title: 'متوسط (مستوفٍ للعتبة: ' + val.toFixed(2) + ' / 20)',
                bg: 'linear-gradient(135deg, #fefce8, #fef08a)',
                color: '#854d0e',
                border: '#facc15',
                cssText: 'background: linear-gradient(135deg, #fefce8 0%, #fef08a 100%) !important; color: #854d0e !important; border: 1.5px solid #facc15 !important; font-weight: 900 !important; box-shadow: 0 2px 5px rgba(234, 88, 12, 0.22) !important;'
            };
        } else if (val >= 8) {
            return {
                cls: 'avg-fail avg-warning',
                category: 'warning',
                label: 'قريب من العتبة',
                title: 'متعثر جزئياً (قريب من العتبة: ' + val.toFixed(2) + ' / 20)',
                bg: 'linear-gradient(135deg, #fff7ed, #ffedd5)',
                color: '#9a3412',
                border: '#fb923c',
                cssText: 'background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%) !important; color: #9a3412 !important; border: 1.5px solid #fb923c !important; font-weight: 900 !important; box-shadow: 0 2px 5px rgba(249, 115, 22, 0.18) !important;'
            };
        }
        return {
            cls: 'avg-fail avg-struggling',
            category: 'struggling',
            label: 'متعثر',
            title: 'متعثر (يحتاج دعماً مكثفاً: ' + val.toFixed(2) + ' / 20)',
            bg: 'linear-gradient(135deg, #fef2f2, #fee2e2)',
            color: '#991b1b',
            border: '#f87171',
            cssText: 'background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%) !important; color: #991b1b !important; border: 1.5px solid #f87171 !important; font-weight: 900 !important; box-shadow: 0 2px 5px rgba(239, 68, 68, 0.22) !important;'
        };
    }

    /**
     * استنتاج المعامل الرسمي وعدد الفروض المحروسة لقسم معين بناءً على اسمه أو سلكه
     */
    function getStreamOfficialConfig(classNameOrStream) {
        const text = String(classNameOrStream || '').trim();
        for (let i = 0; i < MOROCCAN_MATH_STREAM_CONFIGS.length; i++) {
            const cfg = MOROCCAN_MATH_STREAM_CONFIGS[i];
            if (cfg.pattern.test(text)) {
                return {
                    code: cfg.code,
                    label: cfg.label,
                    coefficient: cfg.coefficient,
                    examsPerSemester: cfg.examsPerSemester,
                    examDurationHours: cfg.examDurationHours || 2,
                    weeklyHours: cfg.weeklyHours || 5,
                    annualHours: cfg.annualHours || ((cfg.weeklyHours || 5) * 34),
                    homeworkPerSemester: cfg.homeworkPerSemester || cfg.examsPerSemester,
                    continuousWeight: cfg.continuousWeight
                };
            }
        }
        return {
            code: 'TCS',
            label: 'الجذع المشترك العلمي (افتراضي)',
            coefficient: 4,
            examsPerSemester: 3,
            examDurationHours: 2,
            weeklyHours: 5,
            annualHours: 170,
            homeworkPerSemester: 3,
            continuousWeight: 0.25
        };
    }

    /**
     * حساب معدل التلميذ في الدورة بناءً على الفروض المحروسة (المذكرة الوزارية 142-08)
     * بموجب المذكرة 142-08، يُحتسب معدل المراقبة المستمرة لمادة الرياضيات بالسلك الثانوي التأهيلي
     * بنسبة 100% من المعدل الحسابي للفروض المحروسة المنجزة حضورياً داخل القسم (لا توجد أنشطة مندمجة في مسار).
     * @param {Object} gradesObj كائن النقط (مثلاً { f1: 14, f2: 12, f3: 15, f4: 16 })
     * @param {Object} options خيارات الحساب (examCount, examKeys, includeActivity, activityWeight)
     */
    function calculateStudentSemesterAverage(gradesObj, options) {
        if (!gradesObj || typeof gradesObj !== 'object') return null;
        const opts = options || {};
        const examKeys = Array.isArray(opts.examKeys) ? opts.examKeys : ['f1', 'f2', 'f3', 'f4', 'exam1', 'exam2', 'exam3', 'exam4'];
        const examValues = [];

        for (let i = 0; i < examKeys.length; i++) {
            const raw = gradesObj[examKeys[i]];
            if (raw !== undefined && raw !== null && raw !== '') {
                const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
                if (!isNaN(n) && n >= 0 && n <= 20) {
                    examValues.push(n);
                }
            }
        }

        if (examValues.length === 0) return null;
        const examsAvg = examValues.reduce((acc, v) => acc + v, 0) / examValues.length;

        const rawAct = gradesObj.act !== undefined ? gradesObj.act : gradesObj.activity;
        if (opts.includeActivity && rawAct !== undefined && rawAct !== null && rawAct !== '') {
            const actVal = typeof rawAct === 'number' ? rawAct : parseFloat(String(rawAct).replace(',', '.'));
            if (!isNaN(actVal) && actVal >= 0 && actVal <= 20) {
                const w = typeof opts.activityWeight === 'number' && opts.activityWeight >= 0 && opts.activityWeight <= 0.5
                    ? opts.activityWeight
                    : 0.25;
                return Number(((examsAvg * (1 - w)) + (actVal * w)).toFixed(2));
            }
        }

        return Number(examsAvg.toFixed(2));
    }

    /**
     * حساب المؤشرات الإحصائية الشاملة لمجموعة من المعدلات أو النقط
     */
    function calculateClassStatisticalMetrics(numericGrades, threshold) {
        const passThreshold = (typeof threshold === 'number' && !isNaN(threshold)) ? threshold : 10;
        const valid = (Array.isArray(numericGrades) ? numericGrades : [])
            .map(v => (typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))))
            .filter(v => !isNaN(v) && v >= 0 && v <= 20);

        if (valid.length === 0) {
            return {
                count: 0,
                mean: 0,
                median: 0,
                min: 0,
                max: 0,
                stdDev: 0,
                passCount: 0,
                passRate: 0,
                strugglingCount: 0,
                excellentCount: 0
            };
        }

        const sorted = valid.slice().sort((a, b) => a - b);
        const count = sorted.length;
        const sum = sorted.reduce((acc, v) => acc + v, 0);
        const mean = sum / count;
        const mid = Math.floor(count / 2);
        const median = (count % 2 === 0) ? ((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
        const variance = sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / count;
        const stdDev = Math.sqrt(variance);
        const passCount = sorted.filter(v => v >= passThreshold).length;
        const strugglingCount = sorted.filter(v => v < 8).length;
        const excellentCount = sorted.filter(v => v >= 14).length;

        return {
            count,
            mean: Number(mean.toFixed(2)),
            median: Number(median.toFixed(2)),
            min: Number(sorted[0].toFixed(2)),
            max: Number(sorted[count - 1].toFixed(2)),
            stdDev: Number(stdDev.toFixed(2)),
            passCount,
            passRate: Number(((passCount / count) * 100).toFixed(1)),
            strugglingCount,
            excellentCount
        };
    }

    const GradesCalculator = {
        MOROCCAN_MATH_STREAM_CONFIGS,
        getGradeConditionalStyle,
        getGradeCondition: getGradeConditionalStyle,
        getStreamOfficialConfig,
        calculateStudentSemesterAverage,
        calculateClassStatisticalMetrics
    };

    window.GradesCalculator = GradesCalculator;
    window.getGradeConditionalStyle = getGradeConditionalStyle;
    window.getGradeCondition = getGradeConditionalStyle;
})(typeof window !== 'undefined' ? window : globalThis);
