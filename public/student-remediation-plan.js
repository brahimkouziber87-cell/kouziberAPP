/**
 * ============================================================================
 * وحدة توليد خطة المعالجة التربوية البيداغوجية المخصصة لكل تلميذ
 * Personalized Pedagogical Remediation Plan Engine (Diagnostic + Statistical Student Record)
 * ============================================================================
 * تجمع وتحلل نتائج التقويم التشخيصي (المجالات الرياضية الأربعة: الحساب العددي، الهندسة، الجبر والتحليل،
 * وتنظيم المعطيات) مع البيانات الإحصائية في سجل التلميذ (نقط الفروض S1/S2، مؤشر القيمة المضافة،
 * ساعات الغياب المبررة وغير المبررة، التأخرات، الواجبات المنزلية، والسلوك) لتوليد خطة معالجة فردية متكاملة.
 */
(function (window) {
    'use strict';

    var _activePlanContext = null;
    var _activeGeneratedPlan = null;

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function parseNum(v) {
        if (v === undefined || v === null || typeof v === 'boolean') return null;
        var s = String(v).trim().replace(',', '.');
        if (!s) return null;
        var n = parseFloat(s);
        return (!isNaN(n) && isFinite(n)) ? n : null;
    }

    function getStudentsArray(clsVal) {
        if (!clsVal) return [];
        if (Array.isArray(clsVal)) return clsVal;
        if (Array.isArray(clsVal.students)) return clsVal.students;
        return [];
    }

    function getActiveClassDefault() {
        var selectors = ['reportClassSelect', 'lessonLogClassSelect', 'notesClassSelect', 'classSelect'];
        for (var i = 0; i < selectors.length; i++) {
            var el = document.getElementById(selectors[i]);
            if (el && el.value && el.value !== '__ALL__' && !String(el.value).startsWith('__MULTI__')) {
                return el.value;
            }
        }
        var db = window.db || {};
        var keys = Object.keys(db.classes || {});
        return keys.length > 0 ? keys[0] : '';
    }

    /**
     * تجميع الملف التشخيصي والإحصائي المتكامل للتلميذ من قاعدة البيانات
     */
    function buildStudentDiagnosticAndStatisticalRecord(className, studentId) {
        var db = window.db || {};
        var clsName = className || getActiveClassDefault();
        var students = getStudentsArray(db.classes && db.classes[clsName]);
        var student = students.find(function (s) { return s && String(s.id) === String(studentId); }) || students[0];

        if (!student) {
            return null;
        }
        var resolvedId = String(student.id);
        var stdIndex = students.findIndex(function (s) { return s && String(s.id) === resolvedId; });
        if (stdIndex < 0) stdIndex = 0;

        // 1. استخراج نتائج التقويم التشخيصي (المجالات الأربعة d1, d2, d3, d4 والمجموع على 20)
        var diagObj = (db.diagnostic && db.diagnostic[clsName] && db.diagnostic[clsName][resolvedId])
            ? db.diagnostic[clsName][resolvedId]
            : null;

        //2. استخراج نقط فروض المراقبة المستمرة للدورتين S1 و S2
        var s1Grades = (typeof window.getStudentGradesBySemester === 'function')
            ? window.getStudentGradesBySemester(clsName, resolvedId, 's1')
            : ((db.gradesS1 && db.gradesS1[clsName] && db.gradesS1[clsName][resolvedId]) ||
               (db.grades && db.grades[clsName] && db.grades[clsName][resolvedId] && db.grades[clsName][resolvedId].s1) ||
               (db.grades && db.grades[clsName] && db.grades[clsName][resolvedId]) ||
               (student.grades && student.grades.s1) ||
               student.grades || {});

        var s2Grades = (typeof window.getStudentGradesBySemester === 'function')
            ? window.getStudentGradesBySemester(clsName, resolvedId, 's2')
            : ((db.gradesS2 && db.gradesS2[clsName] && db.gradesS2[clsName][resolvedId]) ||
               (db.grades && db.grades[clsName] && db.grades[clsName][resolvedId] && db.grades[clsName][resolvedId].s2) ||
               (student.grades && student.grades.s2) || {});

        var streamCfg = (window.GradesCalculator && typeof window.GradesCalculator.getStreamOfficialConfig === 'function')
            ? window.GradesCalculator.getStreamOfficialConfig(clsName)
            : { label: 'سلك الثانوي التأهيلي', coefficient: 4, examsPerSemester: 3 };
        var examCount = (typeof window.getExamsCountForClass === 'function')
            ? (Number(window.getExamsCountForClass(clsName)) || streamCfg.examsPerSemester || 3)
            : (streamCfg.examsPerSemester || 3);

        var examKeys = ['f1', 'f2', 'f3', 'f4'].slice(0, Math.max(2, Math.min(4, examCount)));
        var computeSemAvg = function (gObj) {
            if (!gObj || typeof gObj !== 'object') return null;
            if (window.GradesCalculator && typeof window.GradesCalculator.calculateStudentSemesterAverage === 'function') {
                return window.GradesCalculator.calculateStudentSemesterAverage(gObj, { examCount: examCount });
            }
            var vals = [];
            examKeys.forEach(function (k) {
                var n = parseNum(gObj[k]);
                if (n !== null && n >= 0 && n <= 20) vals.push(n);
            });
            if (vals.length === 0) return null;
            return parseFloat((vals.reduce(function (a, b) { return a + b; }, 0) / vals.length).toFixed(2));
        };

        var s1Avg = computeSemAvg(s1Grades);
        var s2Avg = computeSemAvg(s2Grades);
        var currentAvg = (s1Avg !== null && s2Avg !== null)
            ? parseFloat(((s1Avg + s2Avg) / 2).toFixed(2))
            : (s2Avg !== null ? s2Avg : s1Avg);

        // حساب تقدير التقويم التشخيصي إن لم يكن مسجلاً بشكل صريح
        var d1 = 2.5, d2 = 2.5, d3 = 2.5, d4 = 2.5, diagTotal = 10;
        if (diagObj && typeof diagObj === 'object') {
            d1 = parseNum(diagObj.d1) !== null ? parseNum(diagObj.d1) : 2.5;
            d2 = parseNum(diagObj.d2) !== null ? parseNum(diagObj.d2) : 2.5;
            d3 = parseNum(diagObj.d3) !== null ? parseNum(diagObj.d3) : 2.5;
            d4 = parseNum(diagObj.d4) !== null ? parseNum(diagObj.d4) : 2.5;
            diagTotal = parseNum(diagObj.total) !== null
                ? parseNum(diagObj.total)
                : parseFloat((d1 + d2 + d3 + d4).toFixed(2));
        } else if (typeof diagObj === 'number' && !isNaN(diagObj)) {
            diagTotal = diagObj;
            d1 = parseFloat((diagTotal * 0.26).toFixed(2));
            d2 = parseFloat((diagTotal * 0.24).toFixed(2));
            d3 = parseFloat((diagTotal * 0.25).toFixed(2));
            d4 = parseFloat(Math.max(0.5, diagTotal - d1 - d2 - d3).toFixed(2));
        } else {
            var baseEst = currentAvg !== null ? currentAvg : 10.5;
            var factor = Math.max(3, Math.min(19, baseEst)) / 20;
            d1 = parseFloat(Math.min(5, Math.max(0.5, factor * 5.2)).toFixed(2));
            d2 = parseFloat(Math.min(5, Math.max(0.5, factor * 4.8)).toFixed(2));
            d3 = parseFloat(Math.min(5, Math.max(0.5, factor * 5.0)).toFixed(2));
            d4 = parseFloat(Math.min(5, Math.max(0.5, (factor * 20) - d1 - d2 - d3)).toFixed(2));
            diagTotal = parseFloat((d1 + d2 + d3 + d4).toFixed(2));
        }

        // 3. استخراج سجلات الغياب، التأخر، الواجبات المنزلية، والسلوك
        var records = [];
        if (typeof window.getStudentClassRecordsFast === 'function') {
            records = window.getStudentClassRecordsFast(resolvedId, clsName) || [];
        } else if (Array.isArray(db.records)) {
            records = db.records.filter(function (r) {
                return r && r.class === clsName && String(r.studentId) === resolvedId;
            });
        }

        var unjustifiedHours = 0;
        var justifiedHours = 0;
        var lateCount = 0;
        var missedHwRecords = 0;

        records.forEach(function (r) {
            var hrs = Number(r.hours) || 1;
            if (r.status === 'غائب') unjustifiedHours += hrs;
            else if (r.status === 'مبرر') justifiedHours += hrs;
            else if (r.status === 'متأخر') lateCount++;
            if (r.homework === 'لم ينجز') missedHwRecords++;
        });

        var totalAbsentHours = unjustifiedHours + justifiedHours;
        var missedHomeworkCount = (typeof window.getTotalMissedHomework === 'function')
            ? (Number(window.getTotalMissedHomework(resolvedId, clsName)) || missedHwRecords)
            : missedHwRecords;

        var behaviorObj = (db.behaviors && db.behaviors[clsName] && db.behaviors[clsName][resolvedId])
            ? db.behaviors[clsName][resolvedId]
            : { status: 'منضبط', note: '' };

        var classNotes = (db.notes && Array.isArray(db.notes[clsName]))
            ? db.notes[clsName].filter(function (n) { return n && String(n.studentId) === resolvedId; })
            : [];

        var valueAddedDelta = currentAvg !== null
            ? parseFloat((currentAvg - diagTotal).toFixed(2))
            : 0;

        var profileCategory = diagTotal >= 12 ? 'A' : (diagTotal >= 8 ? 'B' : 'C');

        return {
            className: clsName,
            trackName: streamCfg.label || clsName,
            coefficient: streamCfg.coefficient || 4,
            examCount: examCount,
            studentId: resolvedId,
            studentName: student.name || 'تلميذ(ة)',
            massar: student.massar || student.massarCode || student.cne || '',
            orderNum: student.orderNum || (stdIndex + 1),
            diagnostic: {
                d1: d1,
                d2: d2,
                d3: d3,
                d4: d4,
                total: diagTotal,
                profileCategory: profileCategory
            },
            statistics: {
                s1Grades: s1Grades,
                s2Grades: s2Grades,
                s1Avg: s1Avg,
                s2Avg: s2Avg,
                currentAvg: currentAvg,
                valueAddedDelta: valueAddedDelta,
                totalAbsentHours: totalAbsentHours,
                unjustifiedHours: unjustifiedHours,
                justifiedHours: justifiedHours,
                lateCount: lateCount,
                missedHomeworkCount: missedHomeworkCount,
                behaviorStatus: behaviorObj.status || 'منضبط',
                behaviorNote: behaviorObj.note || '',
                notesCount: classNotes.length
            }
        };
    }

    /**
     * محرك محلي فوري لتوليد خطة المعالجة المخصصة قبل أو بدون انتظار الشبكة
     */
    function buildLocalPersonalizedRemediationPlan(record) {
        if (!record) return null;
        var diag = record.diagnostic;
        var stats = record.statistics;
        var avgVal = stats.currentAvg !== null ? stats.currentAvg : diag.total;

        var domainCatalog = [
            {
                key: 'd1',
                domainName: 'الحسابيات والأنشطة العددية (Arithmétique & Calcul)',
                score: diag.d1,
                maxScore: 5,
                topicFocus: 'الحساب العددي في ℝ، القوى والجذور المربعة، الترتيب والمجالات والقيمة المطلقة',
                epistemologicalObstacle: 'خلط في قواعد الإشارات وتوحيد المقامات وصعوبة تأطير التعابير الجبرية والقيمة المطلقة',
                remedialObjective: 'التحكم في العمليات داخل ℝ وقواعد الترتيب والتأطير وحل متراجحات القيمة المطلقة بدقة.',
                didacticStrategy: 'ورشة تطبيقية بتقنية التفريد وبطاقة المراقبة الذاتية لقواعد الإشارات والتأطير',
                customExercise: '1) ليكن x و y عددين حقيقيين بحيث 2 ≤ x ≤ 5 و -4 ≤ y ≤ -1: أطر x + y و x - y و x×y.\n2) حل في ℝ المتراجحة |2x - 3| ≤ 5 ومثل الحلول على مستقيم مدرج.'
            },
            {
                key: 'd2',
                domainName: 'الهندسة والحساب المثلثي (Géométrie & Trigonométrie)',
                score: diag.d2,
                maxScore: 5,
                topicFocus: 'الحساب المتجهي، الجداء السلمي، الدائرة المثلثية، والهندسة التحليلية والفضائية',
                epistemologicalObstacle: 'صعوبة الانتقال من الشكل الهندسي الحسي إلى العلاقة المتجهية أو التحليلية البرهانية',
                remedialObjective: 'ضبط الأفصول المنحني الرئيسي وصيغ التحويل المثلثية وتوظيف الجداء السلمي تحليلياً.',
                didacticStrategy: 'مختبر الدائرة المثلثية والتمثيل المتجهي المدعم ببرمجية GeoGebra التفاعلية',
                customExercise: '1) حدد الأفصول المنحني الرئيسي للعدد α = 17π/4 واحسب cos(α) و sin(α).\n2) في معلم متعامد ممنظم (O,i,j)، حدد معادلة ديكارتية للمستقيم (D) المار من A(1,2) والعمودي على المتجهة n(2,-3).'
            },
            {
                key: 'd3',
                domainName: 'الجبر والتحليل ودراسة الدوال (Algèbre & Analyse)',
                score: diag.d3,
                maxScore: 5,
                topicFocus: 'المعادلات والمتراجحات، الحدوديات، النهايات والاتصال والاشتقاق ودراسة الدوال العددية',
                epistemologicalObstacle: 'عائق الربط بين إشارة المشتقة ورتابة الدالة وأخطاء التعميل وإشارة ثلاثية الحدود',
                remedialObjective: 'إتقان دراسة إشارة ثلاثية الحدود وحساب النهايات والمشتقات واستنتاج جدول التغيرات.',
                didacticStrategy: 'عيادة دراسة الدوال العددية وحل المعادلات والمتراجحات بمنهجية الخطوات المهيكلة',
                customExercise: 'لتكن الدالة العددية f المعرفة على ℝ بـ: f(x) = x³ - 3x + 2.\n1) احسب f\'(x) لكل x من ℝ وادرس إشارتها.\n2) ضع جدول تغيرات الدالة f وحدد مطاريفها المحلية ومعادلة المماس عند x₀ = 0.'
            },
            {
                key: 'd4',
                domainName: 'تنظيم المعطيات والمتتاليات وحل المسائل (Statistiques & Problèmes)',
                score: diag.d4,
                maxScore: 5,
                topicFocus: 'المتتاليات العددية والبرهان بالترجع، الإحصاء والاحتمالات، وترييض المسائل المركبة',
                epistemologicalObstacle: 'صعوبة ترجمة نص الوضعية أو المسألة إلى نموذج رياضي (متتالية أو معادلة) وهيكلة البرهان بالترجع',
                remedialObjective: 'التمكن من ترييض المسائل وصياغة البرهان بالترجع واستغلال المتتالية المساعدة.',
                didacticStrategy: 'بيداغوجيا الأقران وورشة تفكيك المسائل التوليفية وفق الإطار المرجعي (المذكرة 142-08)',
                customExercise: 'نعتبر المتتالية (u_n) المعرفة بـ u₀ = 4 ولكل n من ℕ: u_{n+1} = (1/2)u_n + 1.\n1) بين بالترجع أن u_n > 2 لكل n من ℕ.\n2) نضع v_n = u_n - 2، بين أن (v_n) متتالية هندسية محدداً أساسها ثم اكتب u_n بدلالة n.'
            }
        ];

        var sorted = domainCatalog.slice().sort(function (a, b) { return a.score - b.score; });
        var w1 = sorted[0];
        var w2 = sorted[1];

        var profileCat = diag.total >= 12 && avgVal >= 12 ? 'A' : (diag.total >= 8 && avgVal >= 9 ? 'B' : 'C');
        var profileTitle = profileCat === 'A'
            ? 'الفئة (أ): متمكن — خطة تثبيت وإغناء وتعميق الاستدلال البرهاني'
            : (profileCat === 'B'
                ? 'الفئة (ب): في طور التمكن — خطة تثبيت ومعالجة وقائية للمكتسبات'
                : 'الفئة (ج): متعثر — خطة دعم استدراكي وعلاجي فردي مكثف');

        var corrText = 'سجل التلميذ(ة) ' + record.studentName + ' في رائز التقويم التشخيصي (' + diag.total.toFixed(2) + '/20) ';
        if (stats.currentAvg !== null) {
            var sign = stats.valueAddedDelta >= 0 ? '+' : '';
            corrText += 'ومعدل مراقبة مستمرة (' + stats.currentAvg.toFixed(2) + '/20) بمؤشر قيمة مضافة (' + sign + stats.valueAddedDelta.toFixed(2) + ' نقطة). ';
        } else {
            corrText += 'مع عدم تسجيل نقط الفروض المحروسة بعد. ';
        }

        if (stats.totalAbsentHours >= 6) {
            corrText += 'ويُلاحظ ارتباط مباشر بين تراكم الغياب (' + stats.totalAbsentHours + ' ساعة؛ منها ' + stats.unjustifiedHours + 'س غير مبررة) وبين الصعوبات المسجلة، مما يفرض استدراك الدروس الفائتة وتفعيل التزام المواظبة.';
        } else if (stats.missedHomeworkCount >= 2) {
            corrText += 'رغم المواظبة المقبولة (' + stats.totalAbsentHours + 'س غياب)، تم رصد (' + stats.missedHomeworkCount + ' واجبات غير منجزة) مما يضعف تثبيت القواعد الرياضية في المنزل.';
        } else if (avgVal < 10) {
            corrText += 'التلميذ(ة) منضبط في الحضور (' + stats.totalAbsentHours + 'س غياب) والسلوك (' + stats.behaviorStatus + ')، مما يؤكد أن التعثر ذو طبيعة ديدكتيكية معرفية مرتبطة بالمكتسبات القبلية.';
        } else {
            corrText += 'المسار الإحصائي يبرز مواظبة جيدة (' + stats.totalAbsentHours + 'س غياب) وسلوكاً (' + stats.behaviorStatus + ')، مما يتيح التركيز على تجويد التحرير البرهاني وحل المسائل.';
        }

        return {
            source: 'local_pedagogical_engine',
            studentName: record.studentName,
            className: record.className,
            trackName: record.trackName,
            profileCategory: profileCat,
            profileTitle: profileTitle,
            diagnosticSynthesis: 'أفرز تشخيص المكتسبات القبلية للتلميذ(ة) ' + record.studentName + ' مجموع (' + diag.total.toFixed(2) + '/20)، حيث سُجل أضعف تحكم في مجال «' + w1.domainName + '» بنقطة (' + w1.score + '/5) يليه مجال «' + w2.domainName + '» بنقطة (' + w2.score + '/5).',
            statisticalCorrelationAnalysis: corrText,
            priorityDomains: [w1, w2].map(function (d) {
                return {
                    domainName: d.domainName,
                    scoreText: d.score + ' / ' + d.maxScore,
                    masteryLevel: d.score >= 3.5 ? 'تمكن جيد' : (d.score >= 2.5 ? 'تمكن جزئي متوسط' : 'تعثر أولوي يستوجب المعالجة'),
                    epistemologicalObstacle: d.epistemologicalObstacle,
                    remedialObjective: d.remedialObjective,
                    didacticStrategy: d.didacticStrategy,
                    customExercise: d.customExercise
                };
            }),
            weeklyActionPlan: [
                {
                    weekLabel: 'الأسبوع 1: معالجة الأساسيات وتصفية العوائق القبلية',
                    focus: w1.domainName,
                    classroomAction: 'دعم مندمج (15 دقيقة) في مستهل الحصة + بطاقة معالجة فردية موجهة في (' + w1.topicFocus + ').',
                    homeTask: 'إنجاز تمرين المعالجة المخصص رقم 1 مع التصحيح المفصل على دفتر البحث.',
                    evaluationCriteria: 'حل وضعيات المجال الأول بنسبة تحكم لا تقل عن 75% دون أخطاء منهجية.'
                },
                {
                    weekLabel: 'الأسبوع 2: تثبيت المهارات والربط بدروس المقرر الحالي',
                    focus: w2.domainName,
                    classroomAction: 'إدماج التلميذ(ة) في ثنائي متكافئ (بيداغوجيا الأقران) ومعالجة الأخطاء على السبورة.',
                    homeTask: 'إنجاز تمرين المعالجة المخصص رقم 2 وتمارين تثبيت من الكتاب المدرسي.',
                    evaluationCriteria: 'الانتقال السلس من تطبيق القاعدة المباشرة إلى التعليل البرهاني السليم.'
                },
                {
                    weekLabel: 'الأسبوع 3 و 4: التقويم التكويني وقياس أثر المعالجة (المذكرة 142-08)',
                    focus: 'إدماج المكتسبات والاستعداد للفرض المحروس القادم',
                    classroomAction: 'رائز تتبع قصير (15 دقيقة) + مراقبة دفتر الدروس والواجبات المنزلية.',
                    homeTask: 'حل وضعية توليفية تجمع بين الجبر/التحليل والهندسة وفق الإطار المرجعي.',
                    evaluationCriteria: 'تحقيق تطور إيجابي في الفرض المحروس الموالي (+2.0 نقط على الأقل).'
                }
            ],
            pedagogicalContract: {
                studentCommitment: 'الالتزام بالحضور المنتظم، تدوين الدروس كاملة، وإنجاز بطاقتي المعالجة والواجبات المنزلية في وقتها.',
                teacherSupport: 'توفير بطاقات المعالجة المتدرجة، المواكبة الفردية داخل الفصل، وتثمين كل تحسن في الأداء.',
                parentRole: 'تتبع مواظبة التلميذ(ة) ومراقبة إنجاز التمارين المنزلية والتواصل مع أستاذ مادة الرياضيات.'
            },
            readyNoteForStudentRecord: 'خطة معالجة بيداغوجية فردية (' + profileTitle + '): تركيز الدعم على [' + w1.domainName + '] و[' + w2.domainName + '] بناءً على الرائز التشخيصي (' + diag.total.toFixed(2) + '/20) والسجل الإحصائي.'
        };
    }

    function ensureStudentRemediationModalExists() {
        var existing = document.getElementById('studentPersonalizedRemediationModal');
        if (existing) return existing;

        var modal = document.createElement('div');
        modal.id = 'studentPersonalizedRemediationModal';
        modal.style.cssText = 'display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.76); z-index: 100060; backdrop-filter: blur(5px); align-items: center; justify-content: center; padding: 14px; direction: rtl; font-family: "Cairo", sans-serif;';

        modal.innerHTML = [
            '<div style="background: #ffffff; width: 100%; max-width: 1060px; max-height: 92vh; border-radius: 18px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.35); display: flex; flex-direction: column; overflow: hidden; border: 1.5px solid #cbd5e1;">',
            '  <!-- Header -->',
            '  <div style="padding: 15px 22px; background: linear-gradient(135deg, #0f172a 0%, #0369a1 55%, #4f46e5 100%); color: #ffffff; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">',
            '    <div style="display: flex; align-items: center; gap: 12px;">',
            '      <span style="display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 11px; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.28); font-size: 1.25rem;">🎯</span>',
            '      <div>',
            '        <h3 style="margin: 0; font-size: 1.08rem; font-weight: 900; color: #ffffff; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">',
            '          <span>خطة المعالجة التربوية البيداغوجية المخصصة للتلميذ(ة)</span>',
            '          <span id="stdRemPlanSourceBadge" style="background: rgba(16, 185, 129, 0.25); color: #a7f3d0; border: 1px solid rgba(167, 243, 208, 0.45); font-size: 0.7rem; padding: 2px 9px; border-radius: 999px; font-weight: 800;">التقويم التشخيصي + السجل الإحصائي</span>',
            '        </h3>',
            '        <p style="margin: 2px 0 0 0; font-size: 0.77rem; color: #e0f2fe;">توليد خطة دعم فردية مبنية على نتائج المجالات الرياضية الأربعة للتقويم التشخيصي ونقط الفروض والمواظبة والسلوك</p>',
            '      </div>',
            '    </div>',
            '    <button type="button" onclick="window.closeStudentPersonalizedRemediationModal()" style="background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.25); color: #ffffff; width: 34px; height: 34px; border-radius: 9px; cursor: pointer; font-weight: 900; font-size: 1rem;">✕</button>',
            '  </div>',
            '',
            '  <!-- Top Controls Bar (Class & Student Selector + AI Regenerate + Actions) -->',
            '  <div style="padding: 11px 22px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">',
            '    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">',
            '      <label style="font-size: 0.78rem; font-weight: 800; color: #334155;">القسم:</label>',
            '      <select id="stdRemModalClassSelect" onchange="window.onStdRemModalClassChange(this.value)" style="padding: 6px 10px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-weight: 800; font-size: 0.82rem; color: #0f172a; background: #ffffff; font-family: inherit;"></select>',
            '      <label style="font-size: 0.78rem; font-weight: 800; color: #334155;">التلميذ(ة):</label>',
            '      <select id="stdRemModalStudentSelect" onchange="window.onStdRemModalStudentChange(this.value)" style="min-width: 190px; padding: 6px 10px; border-radius: 8px; border: 1.5px solid #0284c7; font-weight: 800; font-size: 0.83rem; color: #0369a1; background: #f0f9ff; font-family: inherit;"></select>',
            '    </div>',
            '    <div style="display: flex; align-items: center; gap: 7px; flex-wrap: wrap;">',
            '      <button type="button" id="btnGenerateStdRemWithGemini" onclick="window.generateStudentRemediationWithGemini()" style="background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #ffffff; border: none; padding: 7px 14px; border-radius: 8px; font-size: 0.79rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 3px 8px rgba(79,70,229,0.28);">',
            '        <span>✨ تعميق الخطة بالذكاء الاصطناعي (Gemini AI)</span>',
            '      </button>',
            '      <button type="button" onclick="window.saveStudentRemediationToNotes()" style="background: #16a34a; color: #ffffff; border: none; padding: 7px 13px; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">',
            '        <span>💾 حفظ في سجل الملاحظات</span>',
            '      </button>',
            '      <button type="button" onclick="window.scheduleStudentRemediationInLessonLog()" style="background: #0284c7; color: #ffffff; border: none; padding: 7px 13px; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">',
            '        <span>📘 جدولة في دفتر النصوص</span>',
            '      </button>',
            '      <button type="button" onclick="window.printStudentPersonalizedRemediationPlan()" style="background: #0f172a; color: #ffffff; border: none; padding: 7px 14px; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">',
            '        <span>🖨️ طباعة الخطة الفردية (A4)</span>',
            '      </button>',
            '    </div>',
            '  </div>',
            '',
            '  <!-- Body Content -->',
            '  <div id="stdRemModalBodyContent" style="padding: 18px 22px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 14px;">',
            '  </div>',
            '',
            '  <!-- Footer -->',
            '  <div style="padding: 10px 22px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 0.76rem; color: #64748b;">',
            '    <span>📌 تستند هذه الخطة إلى التوجيهات التربوية لمادة الرياضيات (2007) والمذكرة الوزارية 142-08 لتفريد الدعم والمعالجة.</span>',
            '    <button type="button" onclick="window.closeStudentPersonalizedRemediationModal()" style="padding: 6px 18px; background: #e2e8f0; border: none; border-radius: 7px; color: #1e293b; font-weight: 800; cursor: pointer;">إغلاق</button>',
            '  </div>',
            '</div>'
        ].join('\n');

        document.body.appendChild(modal);
        return modal;
    }

    function renderStudentRemediationModalContent(record, plan) {
        var container = document.getElementById('stdRemModalBodyContent');
        if (!container) return;

        if (!record || !plan) {
            container.innerHTML = '<div style="padding: 36px; text-align: center; color: #64748b; font-weight: 800;">يرجى اختيار القسم والتلميذ(ة) لتوليد خطة المعالجة التربوية المخصصة.</div>';
            return;
        }

        var badge = document.getElementById('stdRemPlanSourceBadge');
        if (badge) {
            badge.textContent = plan.source === 'gemini_ai'
                ? '✨ خطة مولدة بـ Gemini AI + السجل الإحصائي'
                : '⚡ محرك التشخيص والمعالجة البيداغوجية';
        }

        var diag = record.diagnostic;
        var stats = record.statistics;
        var profColor = plan.profileCategory === 'A' ? '#15803d' : (plan.profileCategory === 'B' ? '#0284c7' : '#dc2626');
        var profBg = plan.profileCategory === 'A' ? '#f0fdf4' : (plan.profileCategory === 'B' ? '#f0f9ff' : '#fef2f2');
        var profBorder = plan.profileCategory === 'A' ? '#86efac' : (plan.profileCategory === 'B' ? '#93c5fd' : '#fca5a5');

        var priorityDomainsHtml = (plan.priorityDomains || []).map(function (dom, idx) {
            return [
                '<div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-right: 4px solid ' + (idx === 0 ? '#dc2626' : '#0284c7') + '; border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px;">',
                '  <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">',
                '    <span style="font-size: 0.86rem; font-weight: 900; color: #0f172a;">🎯 الأولوية ' + (idx + 1) + ': ' + escapeHtml(dom.domainName) + '</span>',
                '    <span style="font-size: 0.75rem; font-weight: 800; padding: 2px 9px; border-radius: 999px; background: #f1f5f9; color: #1e293b; border: 1px solid #cbd5e1;">النقطة: ' + escapeHtml(dom.scoreText) + ' (' + escapeHtml(dom.masteryLevel) + ')</span>',
                '  </div>',
                '  <div style="font-size: 0.78rem; color: #991b1b; background: #fef2f2; padding: 6px 10px; border-radius: 6px; border: 1px solid #fecaca;"><strong>⚠️ العائق الإبستيمولوجي والديدكتيكي المرصود:</strong> ' + escapeHtml(dom.epistemologicalObstacle) + '</div>',
                '  <div style="font-size: 0.78rem; color: #1e3a8a;"><strong>🎯 الهدف العلاجي:</strong> ' + escapeHtml(dom.remedialObjective) + '</div>',
                '  <div style="font-size: 0.78rem; color: #166534;"><strong>🛠️ استراتيجية المعالجة البيداغوجية:</strong> ' + escapeHtml(dom.didacticStrategy) + '</div>',
                '  <div style="background: #fffbeb; border: 1px dashed #f59e0b; border-radius: 8px; padding: 8px 10px; margin-top: 2px;">',
                '    <div style="font-size: 0.74rem; font-weight: 800; color: #92400e; margin-bottom: 3px;">📝 تمرين المعالجة التطبيقي المخصص للتلميذ(ة):</div>',
                '    <div style="font-size: 0.79rem; font-weight: 700; color: #1e293b; white-space: pre-wrap; line-height: 1.55;">' + escapeHtml(dom.customExercise) + '</div>',
                '  </div>',
                '</div>'
            ].join('\n');
        }).join('\n');

        var weeklyRowsHtml = (plan.weeklyActionPlan || []).map(function (w) {
            return [
                '<tr style="border-bottom: 1px solid #e2e8f0;">',
                '  <td style="padding: 8px 10px; font-weight: 800; color: #1e3a8a; background: #f8fafc; white-space: nowrap;">' + escapeHtml(w.weekLabel) + '</td>',
                '  <td style="padding: 8px 10px; font-weight: 700; color: #0f172a;">' + escapeHtml(w.focus) + '</td>',
                '  <td style="padding: 8px 10px; color: #334155;">' + escapeHtml(w.classroomAction) + '</td>',
                '  <td style="padding: 8px 10px; color: #334155;">' + escapeHtml(w.homeTask) + '</td>',
                '  <td style="padding: 8px 10px; font-weight: 700; color: #15803d;">' + escapeHtml(w.evaluationCriteria) + '</td>',
                '</tr>'
            ].join('\n');
        }).join('\n');

        var contract = plan.pedagogicalContract || {};

        container.innerHTML = [
            '<!-- 1. بطاقة الهوية والمؤشرات التشخيصية والإحصائية المدمجة -->',
            '<div style="background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%); border: 1.5px solid #bfdbfe; border-radius: 12px; padding: 14px 16px;">',
            '  <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">',
            '    <div>',
            '      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">',
            '        <span style="font-size: 1.05rem; font-weight: 900; color: #0f172a;">👤 ' + escapeHtml(record.studentName) + '</span>',
            '        <span style="font-size: 0.75rem; font-weight: 800; background: #e0f2fe; color: #0369a1; padding: 2px 9px; border-radius: 6px;">القسم: ' + escapeHtml(record.className) + '</span>',
            '        ' + (record.massar ? '<span style="font-size: 0.73rem; font-family: monospace; background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 6px;">مسار: ' + escapeHtml(record.massar) + '</span>' : ''),
            '      </div>',
            '      <div style="font-size: 0.75rem; color: #475569; margin-top: 2px;">المسلك: ' + escapeHtml(record.trackName) + ' | المعامل الرسمي: ' + record.coefficient + ' | عدد الفروض في الدورة: ' + record.examCount + '</div>',
            '    </div>',
            '    <div style="background: ' + profBg + '; color: ' + profColor + '; border: 1.5px solid ' + profBorder + '; padding: 5px 12px; border-radius: 999px; font-size: 0.8rem; font-weight: 900;">',
            '      ' + escapeHtml(plan.profileTitle),
            '    </div>',
            '  </div>',
            '',
            '  <!-- شريط المؤشرات الإحصائية والتشخيصية -->',
            '  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: 8px;">',
            '    <div style="background: #ffffff; border: 1px solid #bae6fd; border-radius: 8px; padding: 8px 10px; text-align: center;">',
            '      <div style="font-size: 0.7rem; color: #64748b; font-weight: 700;">التقويم التشخيصي</div>',
            '      <div style="font-size: 1.1rem; font-weight: 900; color: #0284c7;">' + diag.total.toFixed(2) + ' <span style="font-size: 0.72rem;">/ 20</span></div>',
            '      <div style="font-size: 0.68rem; color: #475569;">ع:' + diag.d1 + ' | هـ:' + diag.d2 + ' | ج:' + diag.d3 + ' | م:' + diag.d4 + '</div>',
            '    </div>',
            '    <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; text-align: center;">',
            '      <div style="font-size: 0.7rem; color: #64748b; font-weight: 700;">معدل الفروض (S1 / S2)</div>',
            '      <div style="font-size: 1.05rem; font-weight: 900; color: #1e3a8a;">' + (stats.currentAvg !== null ? stats.currentAvg.toFixed(2) + ' / 20' : 'غير مسجل') + '</div>',
            '      <div style="font-size: 0.68rem; color: #475569;">S1: ' + (stats.s1Avg !== null ? stats.s1Avg.toFixed(2) : '-') + ' | S2: ' + (stats.s2Avg !== null ? stats.s2Avg.toFixed(2) : '-') + '</div>',
            '    </div>',
            '    <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; text-align: center;">',
            '      <div style="font-size: 0.7rem; color: #64748b; font-weight: 700;">مؤشر القيمة المضافة</div>',
            '      <div style="font-size: 1.05rem; font-weight: 900; color: ' + (stats.valueAddedDelta >= 0 ? '#15803d' : '#dc2626') + ';">' + (stats.currentAvg !== null ? ((stats.valueAddedDelta >= 0 ? '+' : '') + stats.valueAddedDelta.toFixed(2)) : '0.00') + '</div>',
            '      <div style="font-size: 0.68rem; color: #475569;">مقارنة بالرائز التشخيصي</div>',
            '    </div>',
            '    <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; text-align: center;">',
            '      <div style="font-size: 0.7rem; color: #64748b; font-weight: 700;">سجل الغياب والتأخر</div>',
            '      <div style="font-size: 1.05rem; font-weight: 900; color: ' + (stats.totalAbsentHours >= 6 ? '#dc2626' : '#0f172a') + ';">' + stats.totalAbsentHours + ' س غياب</div>',
            '      <div style="font-size: 0.68rem; color: #475569;">غير مبرر: ' + stats.unjustifiedHours + 'س | تأخر: ' + stats.lateCount + '</div>',
            '    </div>',
            '    <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; text-align: center;">',
            '      <div style="font-size: 0.7rem; color: #64748b; font-weight: 700;">الواجبات والسلوك</div>',
            '      <div style="font-size: 0.95rem; font-weight: 900; color: #334155;">' + escapeHtml(stats.behaviorStatus) + '</div>',
            '      <div style="font-size: 0.68rem; color: #475569;">إهمال واجب: ' + stats.missedHomeworkCount + '</div>',
            '    </div>',
            '  </div>',
            '</div>',
            '',
            '<!-- 2. التشخيص البيداغوجي والربط الإحصائي -->',
            '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px;">',
            '  <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-right: 4px solid #0284c7; border-radius: 10px; padding: 12px 14px;">',
            '    <div style="font-size: 0.82rem; font-weight: 900; color: #0369a1; margin-bottom: 4px;">🔍 تشخيص المكتسبات القبلية (رائز التقويم التشخيصي):</div>',
            '    <div style="font-size: 0.8rem; color: #1e293b; line-height: 1.6;">' + escapeHtml(plan.diagnosticSynthesis) + '</div>',
            '  </div>',
            '  <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-right: 4px solid #7c3aed; border-radius: 10px; padding: 12px 14px;">',
            '    <div style="font-size: 0.82rem; font-weight: 900; color: #5b21b6; margin-bottom: 4px;">📊 التحليل الإحصائي المدمج (الفروض + الغياب + السلوك):</div>',
            '    <div style="font-size: 0.8rem; color: #1e293b; line-height: 1.6;">' + escapeHtml(plan.statisticalCorrelationAnalysis) + '</div>',
            '  </div>',
            '</div>',
            '',
            '<!-- 3. المجالات الرياضية ذات الأولوية وتمارين المعالجة المخصصة -->',
            '<div>',
            '  <h4 style="margin: 0 0 8px 0; font-size: 0.9rem; font-weight: 900; color: #0f172a;">📐 المجالات الرياضية المستهدفة بالمعالجة الفردية والتمارين التطبيقية:</h4>',
            '  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px;">',
            priorityDomainsHtml,
            '  </div>',
            '</div>',
            '',
            '<!-- 4. البرمجة الزمنية الأسبوعية للمعالجة والتتبع -->',
            '<div>',
            '  <h4 style="margin: 0 0 8px 0; font-size: 0.9rem; font-weight: 900; color: #0f172a;">🗓️ البرنامج الإجرائي للمعالجة والتتبع البيداغوجي:</h4>',
            '  <div style="overflow-x: auto; border: 1px solid #cbd5e1; border-radius: 10px;">',
            '    <table style="width: 100%; border-collapse: collapse; font-size: 0.78rem; text-align: right;">',
            '      <thead>',
            '        <tr style="background: #f1f5f9; color: #1e293b; border-bottom: 2px solid #cbd5e1;">',
            '          <th style="padding: 9px 10px;">المرحلة / الأسبوع</th>',
            '          <th style="padding: 9px 10px;">المحور المستهدف</th>',
            '          <th style="padding: 9px 10px;">التدخل الصفي للأستاذ</th>',
            '          <th style="padding: 9px 10px;">العمل المنزلي الموجه</th>',
            '          <th style="padding: 9px 10px;">مؤشر التحقق والتقويم</th>',
            '        </tr>',
            '      </thead>',
            '      <tbody>',
            weeklyRowsHtml,
            '      </tbody>',
            '    </table>',
            '  </div>',
            '</div>',
            '',
            '<!-- 5. التعاقد البيداغوجي الثلاثي والملاحظة الجاهزة -->',
            '<div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 10px; padding: 12px 14px;">',
            '  <div style="font-size: 0.84rem; font-weight: 900; color: #166534; margin-bottom: 8px;">🤝 ميثاق التعاقد البيداغوجي للمواكبة والدعم:</div>',
            '  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; font-size: 0.77rem; color: #14532d; margin-bottom: 10px;">',
            '    <div style="background: #ffffff; padding: 8px 10px; border-radius: 8px; border: 1px solid #bbf7d0;"><strong>🎓 التزام المتعلم(ة):</strong> ' + escapeHtml(contract.studentCommitment || '') + '</div>',
            '    <div style="background: #ffffff; padding: 8px 10px; border-radius: 8px; border: 1px solid #bbf7d0;"><strong>👨‍🏫 مواكبة الأستاذ(ة):</strong> ' + escapeHtml(contract.teacherSupport || '') + '</div>',
            '    <div style="background: #ffffff; padding: 8px 10px; border-radius: 8px; border: 1px solid #bbf7d0;"><strong>🏠 دور ولي الأمر:</strong> ' + escapeHtml(contract.parentRole || '') + '</div>',
            '  </div>',
            '  <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">',
            '    <span style="font-size: 0.76rem; font-weight: 800; color: #166534;">📝 الخلاصة للسجل التربوي:</span>',
            '    <input type="text" id="stdRemReadyNoteInput" value="' + escapeHtml(plan.readyNoteForStudentRecord || '') + '" style="flex: 1; min-width: 240px; padding: 6px 10px; border-radius: 7px; border: 1px solid #86efac; font-size: 0.78rem; font-family: inherit; background: #ffffff;">',
            '  </div>',
            '</div>'
        ].join('\n');
    }

    function populateModalSelectors(selectedClass, selectedStudentId) {
        var classSel = document.getElementById('stdRemModalClassSelect');
        var stdSel = document.getElementById('stdRemModalStudentSelect');
        if (!classSel || !stdSel) return;

        var db = window.db || {};
        var classesObj = db.classes || {};
        var classNames = Object.keys(classesObj);
        var targetClass = (selectedClass && classesObj[selectedClass]) ? selectedClass : (classNames[0] || selectedClass || '');

        classSel.innerHTML = '';
        classNames.forEach(function (c) {
            var opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            if (c === targetClass) opt.selected = true;
            classSel.appendChild(opt);
        });

        var students = getStudentsArray(classesObj[targetClass]);
        stdSel.innerHTML = '';
        students.forEach(function (s, idx) {
            if (!s) return;
            var opt = document.createElement('option');
            opt.value = String(s.id);
            opt.textContent = (s.orderNum || (idx + 1)) + '. ' + (s.name || 'تلميذ');
            if (String(s.id) === String(selectedStudentId)) opt.selected = true;
            stdSel.appendChild(opt);
        });
    }

    /**
     * فتح نافذة خطة المعالجة التربوية المخصصة للتلميذ(ة)
     */
    window.openStudentPersonalizedRemediationModal = function (className, studentId) {
        var modal = ensureStudentRemediationModalExists();
        var resolvedClass = className || getActiveClassDefault();
        var record = buildStudentDiagnosticAndStatisticalRecord(resolvedClass, studentId);

        if (!record) {
            if (typeof window.notifySafeToast === 'function') {
                window.notifySafeToast('يرجى اختيار قسم يضم تلاميذ مسجلين لتوليد خطة المعالجة الفردية.');
            }
            return null;
        }

        populateModalSelectors(record.className, record.studentId);
        _activePlanContext = record;
        _activeGeneratedPlan = buildLocalPersonalizedRemediationPlan(record);
        renderStudentRemediationModalContent(_activePlanContext, _activeGeneratedPlan);

        modal.style.display = 'flex';
        return _activeGeneratedPlan;
    };

    window.closeStudentPersonalizedRemediationModal = function () {
        var modal = document.getElementById('studentPersonalizedRemediationModal');
        if (modal) modal.style.display = 'none';
    };

    window.onStdRemModalClassChange = function (newClass) {
        var db = window.db || {};
        var students = getStudentsArray(db.classes && db.classes[newClass]);
        var firstId = students[0] ? students[0].id : '';
        window.openStudentPersonalizedRemediationModal(newClass, firstId);
    };

    window.onStdRemModalStudentChange = function (newStudentId) {
        var classSel = document.getElementById('stdRemModalClassSelect');
        var cls = classSel ? classSel.value : getActiveClassDefault();
        window.openStudentPersonalizedRemediationModal(cls, newStudentId);
    };

    /**
     * توليد/تعميق خطة المعالجة الفردية عبر خادم Gemini AI
     */
    window.generateStudentRemediationWithGemini = async function () {
        if (!_activePlanContext) return null;
        var btn = document.getElementById('btnGenerateStdRemWithGemini');
        var origHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span>⏳ جاري توليد الخطة المخصصة عبر Gemini AI...</span>';
        }

        try {
            var response = await fetch('/api/ai/student-personalized-remediation-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(_activePlanContext)
            });
            var result = await response.json();
            if (response.ok && result && result.diagnosticSynthesis) {
                _activeGeneratedPlan = result;
                renderStudentRemediationModalContent(_activePlanContext, _activeGeneratedPlan);
                if (typeof window.notifySafeToast === 'function') {
                    window.notifySafeToast('تم توليد خطة المعالجة التربوية المخصصة للتلميذ(ة) ' + _activePlanContext.studentName + ' بنجاح!');
                }
                return result;
            }
        } catch (_err) {
            // الاحتفاظ بالخطة البيداغوجية المهيكلة في حال تعذر الاتصال
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
        }
        return _activeGeneratedPlan;
    };

    /**
     * حفظ خطة المعالجة الفردية في سجل الملاحظات التربوية للتلميذ(ة) وفي db.remediationPlans
     */
    window.saveStudentRemediationToNotes = function () {
        if (!_activePlanContext || !_activeGeneratedPlan) return false;
        var className = _activePlanContext.className;
        var studentId = String(_activePlanContext.studentId);

        var noteInput = document.getElementById('stdRemReadyNoteInput');
        var noteText = (noteInput && noteInput.value.trim())
            ? noteInput.value.trim()
            : (_activeGeneratedPlan.readyNoteForStudentRecord || _activeGeneratedPlan.diagnosticSynthesis);

        if (!window.db) window.db = { classes: {}, notes: {}, lessonLogs: {} };
        if (!window.db.notes) window.db.notes = {};
        if (!Array.isArray(window.db.notes[className])) window.db.notes[className] = [];

        var sentiment = _activeGeneratedPlan.profileCategory === 'A'
            ? 'positive'
            : (_activeGeneratedPlan.profileCategory === 'B' ? 'guidance' : 'alert');

        window.db.notes[className].push({
            id: Date.now(),
            date: new Date().toLocaleDateString('ar-MA'),
            text: noteText,
            studentId: studentId,
            category: 'pedagogical',
            sentiment: sentiment,
            followUpStatus: 'in_progress',
            source: 'personalized_remediation_plan'
        });

        if (!window.db.remediationPlans) window.db.remediationPlans = {};
        if (!window.db.remediationPlans[className]) window.db.remediationPlans[className] = {};
        window.db.remediationPlans[className][studentId] = {
            updatedAt: new Date().toISOString(),
            record: _activePlanContext,
            plan: _activeGeneratedPlan
        };

        if (typeof window.saveDB === 'function') window.saveDB();
        if (typeof window.renderNotes === 'function') window.renderNotes();

        if (typeof window.notifySafeToast === 'function') {
            window.notifySafeToast('تم حفظ خطة المعالجة الفردية في سجل التلميذ(ة) ' + _activePlanContext.studentName + ' بنجاح!');
        }
        return true;
    };

    /**
     * جدولة حصة دعم ومعالجة في دفتر النصوص بناءً على خطة التلميذ
     */
    window.scheduleStudentRemediationInLessonLog = function () {
        if (!_activePlanContext || !_activeGeneratedPlan) return null;
        var className = _activePlanContext.className;
        if (!window.db) window.db = { classes: {}, lessonLogs: {} };
        if (!window.db.lessonLogs) window.db.lessonLogs = {};
        if (!Array.isArray(window.db.lessonLogs[className])) window.db.lessonLogs[className] = [];

        var pDomains = _activeGeneratedPlan.priorityDomains || [];
        var mainFocus = pDomains[0] ? pDomains[0].domainName : 'دعم ومعالجة المكتسبات القبلية';
        var exerciseText = pDomains[0] ? pDomains[0].customExercise : '';

        var newLog = {
            id: Date.now(),
            date: new Date().toISOString().split('T')[0],
            sessionNum: String(window.db.lessonLogs[className].length + 1),
            timeSlot: 'حصة دعم ومعالجة',
            duration: '1',
            sessionType: 'soutien',
            number: 'دعم ومعالجة فردية: ' + mainFocus,
            title: 'خطة معالجة مخصصة — ' + _activePlanContext.studentName,
            axes: pDomains.map(function (d) {
                return {
                    title: d.domainName,
                    paragraphs: [{ title: d.remedialObjective || '', type: 'construct', content: d.didacticStrategy || '' }]
                };
            }),
            summary: _activeGeneratedPlan.diagnosticSynthesis + '\n' + _activeGeneratedPlan.statisticalCorrelationAnalysis,
            homework: exerciseText,
            homeworkDueDate: '',
            homeworkCompleted: false,
            notes: 'خطة معالجة مخصصة للتلميذ(ة): ' + _activePlanContext.studentName,
            isExtraSupport: true,
            source: 'personalized_remediation_plan'
        };

        window.db.lessonLogs[className].push(newLog);
        if (typeof window.saveDB === 'function') window.saveDB();
        if (typeof window.renderLessonLogs === 'function') window.renderLessonLogs();

        if (typeof window.notifySafeToast === 'function') {
            window.notifySafeToast('تمت جدولة حصة المعالجة الفردية في دفتر النصوص للقسم (' + className + ') بنجاح!');
        }
        return newLog;
    };

    /**
     * طباعة بطاقة خطة المعالجة التربوية الفردية للتلميذ(ة) بصيغة A4 رسمية
     */
    window.printStudentPersonalizedRemediationPlan = function () {
        if (!_activePlanContext || !_activeGeneratedPlan) return;
        var bodyEl = document.getElementById('stdRemModalBodyContent');
        var innerHtml = bodyEl ? bodyEl.innerHTML : '';
        var teacherProfile = (window.db && window.db.teacherProfile) ? window.db.teacherProfile : {};
        var teacherName = teacherProfile.name || 'أستاذ مادة الرياضيات';
        var schoolName = teacherProfile.school || 'المؤسسة التعليمية';

        var printHtml = [
            '<!DOCTYPE html>',
            '<html lang="ar" dir="rtl">',
            '<head>',
            '  <meta charset="UTF-8">',
            '  <title>خطة المعالجة التربوية الفردية - ' + escapeHtml(_activePlanContext.studentName) + '</title>',
            '  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">',
            '  <style>',
            '    body { font-family: "Cairo", sans-serif; padding: 16px; color: #0f172a; direction: rtl; }',
            '    @page { size: A4 portrait; margin: 12mm; }',
            '    input { border: none !important; font-weight: 700; width: 100%; }',
            '  </style>',
            '</head>',
            '<body>',
            '  <div style="border-bottom: 2px solid #0284c7; padding-bottom: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">',
            '    <div>',
            '      <div style="font-size: 0.85rem; font-weight: 800; color: #0369a1;">المملكة المغربية — وزارة التربية الوطنية والتعليم الأولي والرياضة</div>',
            '      <div style="font-size: 0.8rem; color: #334155; font-weight: 700;">المؤسسة: ' + escapeHtml(schoolName) + ' | الأستاذ(ة): ' + escapeHtml(teacherName) + '</div>',
            '    </div>',
            '    <div style="text-align: left;">',
            '      <div style="font-size: 1rem; font-weight: 900; color: #0f172a;">بطاقة خطة المعالجة البيداغوجية الفردية</div>',
            '      <div style="font-size: 0.75rem; color: #64748b;">مادة الرياضيات — سلك الثانوي التأهيلي</div>',
            '    </div>',
            '  </div>',
            innerHtml,
            '  <div style="margin-top: 20px; padding-top: 10px; border-top: 1px dashed #94a3b8; display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 800; color: #334155;">',
            '    <span>توقيع أستاذ(ة) المادة: ........................</span>',
            '    <span>توقيع التلميذ(ة): ........................</span>',
            '    <span>اطلاع ولي الأمر: ........................</span>',
            '  </div>',
            '</body>',
            '</html>'
        ].join('\n');

        if (typeof window.printDocumentDirectly === 'function') {
            window.printDocumentDirectly(printHtml, 'خطة المعالجة الفردية - ' + _activePlanContext.studentName, 'portrait');
        } else {
            window.print();
        }
    };

    // تصدير الدوال على window لاستعمالها في كافة الواجهات والاختبارات
    window.buildStudentDiagnosticAndStatisticalRecord = buildStudentDiagnosticAndStatisticalRecord;
    window.buildLocalPersonalizedRemediationPlan = buildLocalPersonalizedRemediationPlan;

})(window);
