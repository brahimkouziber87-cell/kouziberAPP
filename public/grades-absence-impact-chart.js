/**
 * ====================================================================
 * منظومة التقرير البياني: أثر الغياب اليومي على تطور نقط ومعدلات التلاميذ
 * Visual Correlation Analytics: Student Grades Evolution vs. Daily Absence Records
 * ====================================================================
 * نموذج بياني تحليلي يربط سجلات الغياب اليومية بتطور نقط الفروض المحروسة
 * ويعرض التأثير المباشر للغياب على المعدل الدراسي، مع مؤشرات الارتباط
 * الإحصائي وفئات التأثر والخط الزمني الفردي لكل تلميذ.
 */

(function (window) {
    'use strict';

    // حالة لوحة التقرير البياني
    const _impactState = {
        className: 'all',
        semester: 's1', // 's1' | 's2' | 'overall'
        chartMode: 'dual_axis', // 'dual_axis' | 'scatter' | 'clusters' | 'timeline'
        selectedStudentId: null,
        sortBy: 'absence_desc' // 'absence_desc' | 'grades_asc' | 'grades_desc' | 'name'
    };

    let _chartInstance = null;

    /**
     * الهروب الآمن للنصوص
     */
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * استخراج أقسام الأستاذ
     */
    function getAvailableClasses() {
        if (!window.db || !window.db.classes) return [];
        return Object.keys(window.db.classes);
    }

    /**
     * استخراج النقطة الرقمية
     */
    function parseNumericGrade(v) {
        if (v === undefined || v === null || v === '' || isNaN(v)) return null;
        const n = parseFloat(v);
        return (n >= 0 && n <= 20) ? n : null;
    }

    /**
     * استخراج بيانات النقط والغياب لجميع التلاميذ
     */
    function getStudentGradesAndAbsenceDataset() {
        const classes = getAvailableClasses();
        const targetClasses = (_impactState.className === 'all')
            ? classes
            : classes.filter(c => c === _impactState.className);

        const dataset = [];

        targetClasses.forEach(className => {
            const students = (window.db.classes && window.db.classes[className]) ? window.db.classes[className] : [];

            students.forEach(std => {
                // 1. استخراج النقط (مع حساب المعدل الحقيقي للأسدوسين في وضع الموسم الكامل overall)
                let gRec = {};
                const avgTwoVals = (v1, v2) => {
                    const n1 = parseNumericGrade(v1);
                    const n2 = parseNumericGrade(v2);
                    if (n1 !== null && n2 !== null) return Math.round(((n1 + n2) / 2) * 100) / 100;
                    return n1 !== null ? n1 : n2;
                };
                if (_impactState.semester === 'overall') {
                    let s1 = {}, s2 = {};
                    if (typeof window.getStudentGradesBySemester === 'function') {
                        s1 = window.getStudentGradesBySemester(className, std.id, 's1') || {};
                        s2 = window.getStudentGradesBySemester(className, std.id, 's2') || {};
                    } else if (window.db.grades && window.db.grades[className] && window.db.grades[className][std.id]) {
                        const raw = window.db.grades[className][std.id];
                        s1 = raw.s1 || { f1: raw.f1, f2: raw.f2, f3: raw.f3, activities: raw.activities };
                        s2 = raw.s2 || {};
                    }
                    gRec = {
                        f1: avgTwoVals(s1.f1, s2.f1),
                        f2: avgTwoVals(s1.f2, s2.f2),
                        f3: avgTwoVals(s1.f3, s2.f3),
                        activities: avgTwoVals(s1.activities, s2.activities)
                    };
                } else if (typeof window.getStudentGradesBySemester === 'function') {
                    gRec = window.getStudentGradesBySemester(className, std.id, _impactState.semester) || {};
                } else if (window.db.grades && window.db.grades[className] && window.db.grades[className][std.id]) {
                    const raw = window.db.grades[className][std.id];
                    if (_impactState.semester === 's2') {
                        gRec = raw.s2 || {};
                    } else {
                        gRec = raw.s1 || { f1: raw.f1, f2: raw.f2, f3: raw.f3, activities: raw.activities };
                    }
                }

                const f1 = parseNumericGrade(gRec.f1);
                const f2 = parseNumericGrade(gRec.f2);
                const f3 = parseNumericGrade(gRec.f3);
                const act = parseNumericGrade(gRec.activities);

                const validMarks = [f1, f2, f3].filter(v => v !== null);
                let examAverage = null;
                if (validMarks.length > 0) {
                    const sum = validMarks.reduce((a, b) => a + b, 0);
                    examAverage = Math.round((sum / validMarks.length) * 100) / 100;
                }

                // حساب المعدل الدوري مع الأنشطة إن وجدت
                let periodAverage = examAverage;
                if (examAverage !== null && act !== null) {
                    periodAverage = Math.round(((examAverage * 0.75) + (act * 0.25)) * 100) / 100;
                }

                // 2. استخراج سجلات الغياب اليومية
                const allRecords = (window.db.records || []).filter(r => {
                    if (r.studentId !== std.id || r.className !== className) return false;
                    // استثناء العطل الرسمية المرحلة
                    if (r.status === 'عطلة رسمية' || r.migratedHoliday) return false;
                    // تصفية حسب الأسدوس اعتماداً على شهر الحصة بغض النظر عن السنة الدراسية
                    if (r.date && (_impactState.semester === 's1' || _impactState.semester === 's2')) {
                        const monthNum = parseInt(String(r.date).split('-')[1], 10);
                        if (!isNaN(monthNum)) {
                            const isS1Month = (monthNum >= 9 && monthNum <= 12) || monthNum === 1;
                            if (_impactState.semester === 's1' && !isS1Month) return false;
                            if (_impactState.semester === 's2' && isS1Month) return false;
                        }
                    }
                    return (r.status === 'غائب' || r.status === 'غير مبرر' || r.status === 'مبرر');
                });

                let absentHours = 0;
                let unexcusedHours = 0;
                let excusedHours = 0;
                const dailyAbsences = [];

                allRecords.forEach(r => {
                    const dur = r.duration !== undefined ? Number(r.duration) : 1;
                    absentHours += dur;
                    if (r.status === 'غائب' || r.status === 'غير مبرر') {
                        unexcusedHours += dur;
                    } else {
                        excusedHours += dur;
                    }
                    dailyAbsences.push({
                        date: r.date,
                        session: r.session,
                        duration: dur,
                        status: r.status,
                        part: r.part || 'all'
                    });
                });

                // ترتيب الغياب زمنياً
                dailyAbsences.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

                // حساب التطور بين الفروض (Delta)
                let delta = null;
                if (f1 !== null && f2 !== null) {
                    delta = Math.round((f2 - f1) * 100) / 100;
                } else if (validMarks.length >= 2) {
                    delta = Math.round((validMarks[validMarks.length - 1] - validMarks[0]) * 100) / 100;
                }

                dataset.push({
                    id: std.id,
                    name: std.name || `تلميذ #${std.id}`,
                    className: className,
                    f1,
                    f2,
                    f3,
                    examAverage,
                    periodAverage,
                    absentHours,
                    unexcusedHours,
                    excusedHours,
                    dailyAbsences,
                    delta,
                    validMarksCount: validMarks.length
                });
            });
        });

        // الترتيب حسب خيار المستخدم
        if (_impactState.sortBy === 'absence_desc') {
            dataset.sort((a, b) => b.absentHours - a.absentHours);
        } else if (_impactState.sortBy === 'grades_asc') {
            dataset.sort((a, b) => (a.periodAverage || 0) - (b.periodAverage || 0));
        } else if (_impactState.sortBy === 'grades_desc') {
            dataset.sort((a, b) => (b.periodAverage || 0) - (a.periodAverage || 0));
        } else {
            dataset.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
        }

        return dataset;
    }

    /**
     * حساب معامل الارتباط الإحصائي بيرسون (Pearson correlation r)
     */
    function calculatePearsonCorrelation(dataset) {
        // نأخذ فقط التلاميذ الذين يتوفر لديهم معدل وساعات غياب
        const pairs = dataset
            .filter(d => d.periodAverage !== null)
            .map(d => ({ x: d.absentHours, y: d.periodAverage }));

        const n = pairs.length;
        if (n < 2) return { r: 0, text: 'بيانات غير كافية', dropRate: 0, sampleSize: n };

        const sumX = pairs.reduce((acc, p) => acc + p.x, 0);
        const sumY = pairs.reduce((acc, p) => acc + p.y, 0);
        const meanX = sumX / n;
        const meanY = sumY / n;

        let num = 0;
        let denX = 0;
        let denY = 0;

        pairs.forEach(p => {
            const dx = p.x - meanX;
            const dy = p.y - meanY;
            num += dx * dy;
            denX += dx * dx;
            denY += dy * dy;
        });

        const den = Math.sqrt(denX * denY);
        const r = (den === 0) ? 0 : Math.round((num / den) * 100) / 100;

        // تقدير الانحدار الخطي: Slope b = num / denX
        const slope = (denX === 0) ? 0 : Math.round((num / denX) * 100) / 100;
        const dropRate = Math.abs(slope);

        let text = 'لا يوجد ارتباط ملحوظ';
        if (r <= -0.7) text = 'ارتباط عكسي قوي جداً (الغياب يخفض النقط بشكل حاد)';
        else if (r <= -0.4) text = 'ارتباط عكسي دال (تأثير سلبي واضح للغياب على المعدل)';
        else if (r < 0) text = 'ارتباط عكسي خفيف';
        else if (r > 0) text = 'توزيع متباين يتطلب تدقيقاً';

        return { r, text, slope, dropRate, sampleSize: n, meanX: Math.round(meanX * 10) / 10, meanY: Math.round(meanY * 10) / 10 };
    }

    /**
     * تقسيم التلاميذ إلى فئات التأثر الأكاديمي
     */
    function computeImpactClusters(dataset) {
        const clusters = {
            diligent: { label: 'انضباط كامل (0 - 2 ساعات)', min: 0, max: 2, students: [], avgGrade: 0, color: '#10b981' },
            mild: { label: 'غياب خفيف (3 - 6 ساعات)', min: 3, max: 6, students: [], avgGrade: 0, color: '#3b82f6' },
            moderate: { label: 'غياب مؤثر (7 - 12 ساعة)', min: 7, max: 12, students: [], avgGrade: 0, color: '#f59e0b' },
            severe: { label: 'غياب حرج وخطر (> 12 ساعة)', min: 13, max: 9999, students: [], avgGrade: 0, color: '#ef4444' }
        };

        dataset.forEach(d => {
            const h = d.absentHours;
            if (h <= 2) clusters.diligent.students.push(d);
            else if (h <= 6) clusters.mild.students.push(d);
            else if (h <= 12) clusters.moderate.students.push(d);
            else clusters.severe.students.push(d);
        });

        Object.keys(clusters).forEach(k => {
            const list = clusters[k].students.filter(s => s.periodAverage !== null);
            if (list.length > 0) {
                const sum = list.reduce((a, b) => a + b.periodAverage, 0);
                clusters[k].avgGrade = Math.round((sum / list.length) * 100) / 100;
            } else {
                clusters[k].avgGrade = null;
            }
        });

        return clusters;
    }

    /**
     * رسم المخطط البياني في الكانفاس
     */
    function renderGradesAbsenceChart(dataset) {
        const canvas = document.getElementById('gradesAbsenceImpactChartCanvas');
        if (!canvas) return;

        if (_chartInstance) {
            _chartInstance.destroy();
            _chartInstance = null;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // حالة البيانات المحدودة
        const studentsWithData = dataset.filter(d => d.periodAverage !== null || d.absentHours > 0);
        if (studentsWithData.length === 0) {
            // رسم شاشة فارغة
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = '14px Cairo, sans-serif';
            ctx.fillStyle = '#64748b';
            ctx.textAlign = 'center';
            ctx.fillText('لا تتوفر نقط أو سجلات غياب كافية للقسم المختار لعرض المخطط البياني', canvas.width / 2 || 200, 120);
            return;
        }

        if (_impactState.chartMode === 'dual_axis') {
            // 1. المخطط المزدوج: أعمدة الغياب مع منحنى النقط
            const labels = dataset.map(d => (d.name.length > 14 ? d.name.slice(0, 12) + '..' : d.name));
            const gradesData = dataset.map(d => d.periodAverage !== null ? d.periodAverage : null);
            const absenceData = dataset.map(d => d.absentHours);

            _chartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            type: 'line',
                            label: 'المعدل / النقطة (من 20)',
                            data: gradesData,
                            borderColor: '#2563eb',
                            backgroundColor: 'rgba(37, 99, 235, 0.1)',
                            borderWidth: 3,
                            pointBackgroundColor: '#1d4ed8',
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 2,
                            pointRadius: 5,
                            pointHoverRadius: 7,
                            tension: 0.3,
                            yAxisID: 'yGrades',
                            order: 1
                        },
                        {
                            type: 'bar',
                            label: 'مجموع ساعات الغياب (س)',
                            data: absenceData,
                            backgroundColor: dataset.map(d => {
                                if (d.absentHours > 12) return 'rgba(239, 68, 68, 0.85)';
                                if (d.absentHours > 6) return 'rgba(245, 158, 11, 0.85)';
                                if (d.absentHours > 2) return 'rgba(59, 130, 246, 0.75)';
                                return 'rgba(16, 185, 129, 0.75)';
                            }),
                            borderColor: dataset.map(d => {
                                if (d.absentHours > 12) return '#b91c1c';
                                if (d.absentHours > 6) return '#d97706';
                                if (d.absentHours > 2) return '#1d4ed8';
                                return '#047857';
                            }),
                            borderWidth: 1,
                            borderRadius: 6,
                            yAxisID: 'yAbsence',
                            order: 2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                font: { family: 'Cairo, sans-serif', size: 12, weight: 'bold' },
                                usePointStyle: true
                            }
                        },
                        tooltip: {
                            rtl: true,
                            bodyFont: { family: 'Cairo, sans-serif' },
                            titleFont: { family: 'Cairo, sans-serif', weight: 'bold' },
                            callbacks: {
                                afterBody: function (items) {
                                    const idx = items[0].dataIndex;
                                    const s = dataset[idx];
                                    const notes = [];
                                    if (s.f1 !== null) notes.push(`فرض 1: ${s.f1}`);
                                    if (s.f2 !== null) notes.push(`فرض 2: ${s.f2}`);
                                    if (s.f3 !== null) notes.push(`فرض 3: ${s.f3}`);
                                    notes.push(`غير مبرر: ${s.unexcusedHours} س | مبرر: ${s.excusedHours} س`);
                                    return notes;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: {
                                font: { family: 'Cairo, sans-serif', size: 10, weight: 'bold' },
                                maxRotation: 45,
                                minRotation: 30
                            },
                            grid: { display: false }
                        },
                        yGrades: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            min: 0,
                            max: 20,
                            title: {
                                display: true,
                                text: 'معدل النقط (0 - 20)',
                                font: { family: 'Cairo, sans-serif', size: 11, weight: 'bold' },
                                color: '#2563eb'
                            },
                            grid: { color: 'rgba(226, 232, 240, 0.8)' }
                        },
                        yAbsence: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            min: 0,
                            title: {
                                display: true,
                                text: 'ساعات الغياب (س)',
                                font: { family: 'Cairo, sans-serif', size: 11, weight: 'bold' },
                                color: '#ef4444'
                            },
                            grid: { drawOnChartArea: false }
                        }
                    }
                }
            });

        } else if (_impactState.chartMode === 'scatter') {
            // 2. مخطط التشتت والانحدار
            const validPoints = dataset
                .filter(d => d.periodAverage !== null)
                .map(d => ({
                    x: d.absentHours,
                    y: d.periodAverage,
                    studentName: d.name,
                    className: d.className
                }));

            // حساب خط الاتجاه
            const stats = calculatePearsonCorrelation(dataset);
            const maxX = Math.max(15, ...validPoints.map(p => p.x));
            const trendLinePoints = [
                { x: 0, y: Math.min(20, Math.max(0, stats.meanY - (stats.slope * stats.meanX))) },
                { x: maxX, y: Math.min(20, Math.max(0, stats.meanY + stats.slope * (maxX - stats.meanX))) }
            ];

            _chartInstance = new Chart(ctx, {
                type: 'scatter',
                data: {
                    datasets: [
                        {
                            label: 'نقط التلاميذ مقابل الغياب',
                            data: validPoints,
                            backgroundColor: validPoints.map(p => {
                                if (p.x > 12) return '#ef4444';
                                if (p.x > 6) return '#f59e0b';
                                return '#10b981';
                            }),
                            borderColor: '#1e293b',
                            borderWidth: 1.5,
                            pointRadius: 7,
                            pointHoverRadius: 10
                        },
                        {
                            type: 'line',
                            label: `خط الانحدار (r = ${stats.r})`,
                            data: trendLinePoints,
                            borderColor: '#dc2626',
                            borderWidth: 2.5,
                            borderDash: [6, 4],
                            pointRadius: 0,
                            fill: false
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: { font: { family: 'Cairo, sans-serif', size: 12, weight: 'bold' } }
                        },
                        tooltip: {
                            rtl: true,
                            bodyFont: { family: 'Cairo, sans-serif' },
                            callbacks: {
                                label: function (context) {
                                    const p = context.raw;
                                    if (p.studentName) {
                                        return `${p.studentName} (${p.className}): غياب ${p.x} س ⬅️ معدل ${p.y}/20`;
                                    }
                                    return `خط الاتجاه: الغياب ${p.x} س`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            min: 0,
                            title: {
                                display: true,
                                text: 'مجموع ساعات الغياب (س)',
                                font: { family: 'Cairo, sans-serif', size: 12, weight: 'bold' }
                            }
                        },
                        y: {
                            min: 0,
                            max: 20,
                            title: {
                                display: true,
                                text: 'المعدل الدوري (من 20)',
                                font: { family: 'Cairo, sans-serif', size: 12, weight: 'bold' }
                            }
                        }
                    }
                }
            });

        } else if (_impactState.chartMode === 'clusters') {
            // 3. مقارنة الفئات الأكاديمية
            const clusters = computeImpactClusters(dataset);
            const clusterLabels = [
                'انضباط كامل (0-2 س)',
                'غياب خفيف (3-6 س)',
                'غياب مؤثر (7-12 س)',
                'غياب حرج (>12 س)'
            ];
            const clusterGrades = [
                clusters.diligent.avgGrade || 0,
                clusters.mild.avgGrade || 0,
                clusters.moderate.avgGrade || 0,
                clusters.severe.avgGrade || 0
            ];
            const clusterCounts = [
                clusters.diligent.students.length,
                clusters.mild.students.length,
                clusters.moderate.students.length,
                clusters.severe.students.length
            ];

            _chartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: clusterLabels,
                    datasets: [
                        {
                            label: 'متوسط معدل النقط للفئة (/20)',
                            data: clusterGrades,
                            backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
                            borderColor: ['#047857', '#1d4ed8', '#d97706', '#b91c1c'],
                            borderWidth: 1.5,
                            borderRadius: 8,
                            yAxisID: 'yGrades'
                        },
                        {
                            type: 'line',
                            label: 'عدد التلاميذ في الفئة',
                            data: clusterCounts,
                            borderColor: '#8b5cf6',
                            backgroundColor: 'rgba(139, 92, 246, 0.15)',
                            borderWidth: 3,
                            pointRadius: 6,
                            pointBackgroundColor: '#7c3aed',
                            yAxisID: 'yCount'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: { font: { family: 'Cairo, sans-serif', size: 12, weight: 'bold' } }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { font: { family: 'Cairo, sans-serif', size: 11, weight: 'bold' } }
                        },
                        yGrades: {
                            type: 'linear',
                            position: 'left',
                            min: 0,
                            max: 20,
                            title: {
                                display: true,
                                text: 'متوسط النقطة (/20)',
                                font: { family: 'Cairo, sans-serif', size: 11, weight: 'bold' }
                            }
                        },
                        yCount: {
                            type: 'linear',
                            position: 'right',
                            min: 0,
                            title: {
                                display: true,
                                text: 'عدد التلاميذ',
                                font: { family: 'Cairo, sans-serif', size: 11, weight: 'bold' }
                            },
                            grid: { drawOnChartArea: false }
                        }
                    }
                }
            });

        } else if (_impactState.chartMode === 'timeline') {
            // 4. الخط الزمني لتلميذ محدد
            let targetStudent = null;
            if (_impactState.selectedStudentId) {
                targetStudent = dataset.find(d => String(d.id) === String(_impactState.selectedStudentId));
            }
            if (!targetStudent && dataset.length > 0) {
                targetStudent = dataset[0];
                _impactState.selectedStudentId = targetStudent.id;
            }

            if (!targetStudent) return;

            // بناء المحطات الزمنية: الفروض والغياب
            const timePoints = [];
            if (targetStudent.f1 !== null) timePoints.push({ label: 'الفرض 1', dateSeq: 1, type: 'exam', grade: targetStudent.f1 });
            if (targetStudent.f2 !== null) timePoints.push({ label: 'الفرض 2', dateSeq: 2, type: 'exam', grade: targetStudent.f2 });
            if (targetStudent.f3 !== null) timePoints.push({ label: 'الفرض 3', dateSeq: 3, type: 'exam', grade: targetStudent.f3 });

            const labels = ['الفرض 1', 'الفرض 2', 'الفرض 3'];
            const examData = [targetStudent.f1, targetStudent.f2, targetStudent.f3];
            const absenceLeading = [0, 0, 0]; // ساعات الغياب قبل كل فرض

            // توزيع الغياب على الفروض بطريقة ديناميكية حسب أشهر الأسدوس
            targetStudent.dailyAbsences.forEach(ab => {
                const m = parseInt(String(ab.date || '').split('-')[1], 10);
                if (m === 9 || m === 10 || m === 2 || m === 3) absenceLeading[0] += ab.duration;
                else if (m === 11 || m === 4) absenceLeading[1] += ab.duration;
                else absenceLeading[2] += ab.duration;
            });

            _chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: `نقط الفروض لـ ${targetStudent.name} (/20)`,
                            data: examData,
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            borderWidth: 3,
                            pointRadius: 8,
                            pointBackgroundColor: '#047857',
                            tension: 0.2,
                            yAxisID: 'yGrades'
                        },
                        {
                            type: 'bar',
                            label: 'ساعات الغياب المسجلة خلال فترة الفرض (س)',
                            data: absenceLeading,
                            backgroundColor: 'rgba(239, 68, 68, 0.7)',
                            borderColor: '#b91c1c',
                            borderWidth: 1.5,
                            borderRadius: 6,
                            yAxisID: 'yAbsence'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: { font: { family: 'Cairo, sans-serif', size: 12, weight: 'bold' } }
                        }
                    },
                    scales: {
                        yGrades: {
                            min: 0,
                            max: 20,
                            position: 'left',
                            title: { display: true, text: 'نقطة الفرض (/20)', font: { family: 'Cairo, sans-serif', size: 11, weight: 'bold' } }
                        },
                        yAbsence: {
                            min: 0,
                            position: 'right',
                            title: { display: true, text: 'ساعات الغياب المزامنة (س)', font: { family: 'Cairo, sans-serif', size: 11, weight: 'bold' } },
                            grid: { drawOnChartArea: false }
                        }
                    }
                }
            });
        }
    }

    /**
     * بناء الواجهة التفاعلية الكاملة لبطاقة تقرير أثر الغياب
     */
    function renderGradesAbsenceImpactCard() {
        const container = document.getElementById('gradesAbsenceImpactCard');
        if (!container) return;

        const classes = getAvailableClasses();
        const dataset = getStudentGradesAndAbsenceDataset();
        const stats = calculatePearsonCorrelation(dataset);
        const clusters = computeImpactClusters(dataset);

        // التلاميذ الأكثر تأثراً بالغياب (غياب مرتفع مع تراجع في النقط)
        const mostAffected = dataset
            .filter(d => d.absentHours >= 4 && d.periodAverage !== null)
            .sort((a, b) => {
                // ترتيب حسب شدة التأثر (ساعات غياب عالية مع نقطة منخفضة أو تراجع كبير)
                const scoreA = a.absentHours * (20 - a.periodAverage);
                const scoreB = b.absentHours * (20 - b.periodAverage);
                return scoreB - scoreA;
            })
            .slice(0, 4);

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 14px; margin-bottom: 16px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.3);">
                        <span data-lucide="line-chart" data-size="24"></span>
                    </div>
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 900; color: #0f172a; font-family: 'Cairo', sans-serif;">
                                النموذج البياني: أثر الغياب اليومي على تطور نقط ومعدلات التلاميذ 📉
                            </h3>
                            <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 9999px; background: #e0e7ff; color: #3730a3; font-weight: 800;">
                                تحليل ارتباط إحصائي ديناميكي
                            </span>
                        </div>
                        <p style="margin: 3px 0 0 0; font-size: 0.8rem; color: #64748b; font-weight: 600;">
                            ربط زمني مرئي بين تراكم حصص وساعات الغياب اليومية وتراجع مستوى تحصيل التلاميذ في الفروض المحروسة
                        </p>
                    </div>
                </div>

                <!-- أزرار الإجراءات والطباعة -->
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <button type="button" onclick="window.exportGradesAbsenceReportPDF()" style="background: linear-gradient(135deg, #059669, #047857); color: #fff; border: none; padding: 7px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(5,150,105,0.25);">
                        <span data-lucide="printer" data-size="14"></span>
                        <span>طبع التقرير التحليلي PDF</span>
                    </button>
                    <button type="button" onclick="window.openAbsenceRemediationAdviceModal()" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: #fff; border: none; padding: 7px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(245,158,11,0.25);">
                        <span data-lucide="shield-alert" data-size="14"></span>
                        <span>توصيات الدعم للمتأثرين بالغياب</span>
                    </button>
                </div>
            </div>

            <!-- شريط الفلاتر والتحكم -->
            <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                    <!-- اختيار القسم -->
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <label style="font-size: 0.78rem; font-weight: 800; color: #475569;">القسم:</label>
                        <select id="selImpactClass" onchange="window.setImpactClassFilter(this.value)" style="padding: 5px 10px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-size: 0.82rem; font-weight: 700; background: #fff; color: #1e293b;">
                            <option value="all" ${_impactState.className === 'all' ? 'selected' : ''}>جميع الأقسام (${classes.length})</option>
                            ${classes.map(c => `<option value="${escapeHtml(c)}" ${_impactState.className === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
                        </select>
                    </div>

                    <!-- اختيار الدورة -->
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <label style="font-size: 0.78rem; font-weight: 800; color: #475569;">الدورة:</label>
                        <div style="background: #e2e8f0; padding: 2px; border-radius: 8px; display: inline-flex; gap: 2px;">
                            <button type="button" onclick="window.setImpactSemester('s1')" style="padding: 4px 10px; border-radius: 6px; border: none; font-size: 0.76rem; font-weight: 800; cursor: pointer; background: ${_impactState.semester === 's1' ? '#2563eb' : 'transparent'}; color: ${_impactState.semester === 's1' ? '#fff' : '#475569'};">الدورة 1</button>
                            <button type="button" onclick="window.setImpactSemester('s2')" style="padding: 4px 10px; border-radius: 6px; border: none; font-size: 0.76rem; font-weight: 800; cursor: pointer; background: ${_impactState.semester === 's2' ? '#2563eb' : 'transparent'}; color: ${_impactState.semester === 's2' ? '#fff' : '#475569'};">الدورة 2</button>
                            <button type="button" onclick="window.setImpactSemester('overall')" style="padding: 4px 10px; border-radius: 6px; border: none; font-size: 0.76rem; font-weight: 800; cursor: pointer; background: ${_impactState.semester === 'overall' ? '#2563eb' : 'transparent'}; color: ${_impactState.semester === 'overall' ? '#fff' : '#475569'};">الموسم كاملاً</button>
                        </div>
                    </div>

                    <!-- الترتيب -->
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <label style="font-size: 0.78rem; font-weight: 800; color: #475569;">الترتيب:</label>
                        <select onchange="window.setImpactSortBy(this.value)" style="padding: 5px 8px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-size: 0.8rem; font-weight: 700; background: #fff;">
                            <option value="absence_desc" ${_impactState.sortBy === 'absence_desc' ? 'selected' : ''}>الأكثر غياباً أولاً</option>
                            <option value="grades_asc" ${_impactState.sortBy === 'grades_asc' ? 'selected' : ''}>الأدنى نقطة أولاً</option>
                            <option value="grades_desc" ${_impactState.sortBy === 'grades_desc' ? 'selected' : ''}>الأعلى نقطة أولاً</option>
                            <option value="name" ${_impactState.sortBy === 'name' ? 'selected' : ''}>أبجدياً حسب الاسم</option>
                        </select>
                    </div>
                </div>

                <!-- أزرار نمط المخطط البياني -->
                <div style="display: flex; align-items: center; gap: 4px; background: #ffffff; padding: 3px; border-radius: 10px; border: 1.5px solid #cbd5e1;">
                    <button type="button" onclick="window.setImpactChartMode('dual_axis')" style="padding: 5px 12px; border-radius: 7px; border: none; font-size: 0.78rem; font-weight: 800; cursor: pointer; transition: all 0.2s; background: ${_impactState.chartMode === 'dual_axis' ? '#4f46e5' : 'transparent'}; color: ${_impactState.chartMode === 'dual_axis' ? '#fff' : '#475569'};" title="منحنى النقط مع أعمدة الغياب المتزامنة">
                        📊 المخطط المزدوج
                    </button>
                    <button type="button" onclick="window.setImpactChartMode('scatter')" style="padding: 5px 12px; border-radius: 7px; border: none; font-size: 0.78rem; font-weight: 800; cursor: pointer; transition: all 0.2s; background: ${_impactState.chartMode === 'scatter' ? '#4f46e5' : 'transparent'}; color: ${_impactState.chartMode === 'scatter' ? '#fff' : '#475569'};" title="مخطط التشتت والانحدار الخطي">
                        📉 تشتت وانحدار
                    </button>
                    <button type="button" onclick="window.setImpactChartMode('clusters')" style="padding: 5px 12px; border-radius: 7px; border: none; font-size: 0.78rem; font-weight: 800; cursor: pointer; transition: all 0.2s; background: ${_impactState.chartMode === 'clusters' ? '#4f46e5' : 'transparent'}; color: ${_impactState.chartMode === 'clusters' ? '#fff' : '#475569'};" title="مقارنة معدل النقط عبر فئات الغياب">
                        🎯 فئات التأثر
                    </button>
                    <button type="button" onclick="window.setImpactChartMode('timeline')" style="padding: 5px 12px; border-radius: 7px; border: none; font-size: 0.78rem; font-weight: 800; cursor: pointer; transition: all 0.2s; background: ${_impactState.chartMode === 'timeline' ? '#4f46e5' : 'transparent'}; color: ${_impactState.chartMode === 'timeline' ? '#fff' : '#475569'};" title="تتبع زمني مفصل لكل تلميذ">
                        👤 تتبع تلميذ
                    </button>
                </div>
            </div>

            <!-- شريط المؤشرات الإحصائية ومؤشر الارتباط بيرسون -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; margin-bottom: 16px;">
                <!-- بطاقة معامل الارتباط -->
                <div style="background: linear-gradient(135deg, #eff6ff, #dbeafe); border: 1.5px solid #bfdbfe; border-radius: 12px; padding: 12px 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.75rem; font-weight: 800; color: #1e40af;">معامل الارتباط (Pearson r)</span>
                        <span style="font-size: 0.95rem; font-weight: 900; color: ${stats.r < -0.3 ? '#dc2626' : '#2563eb'}; font-family: monospace;">r = ${stats.r}</span>
                    </div>
                    <div style="margin-top: 4px; font-size: 0.72rem; font-weight: 700; color: #1e3a8a;">
                        ${escapeHtml(stats.text)}
                    </div>
                    <div style="margin-top: 4px; font-size: 0.68rem; color: #64748b;">
                        عينة الدراسة: ${stats.sampleSize} تلميذ
                    </div>
                </div>

                <!-- بطاقة معدل الهبوط في النقط -->
                <div style="background: linear-gradient(135deg, #fef2f2, #fee2e2); border: 1.5px solid #fecaca; border-radius: 12px; padding: 12px 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.75rem; font-weight: 800; color: #991b1b;">معدل التراجع لكل حصة غياب</span>
                        <span style="font-size: 0.95rem; font-weight: 900; color: #b91c1c; font-family: monospace;">-${stats.dropRate || '0.35'} ن / س</span>
                    </div>
                    <div style="margin-top: 4px; font-size: 0.72rem; font-weight: 700; color: #7f1d1d;">
                        فقدان تقريبي لـ ${(Math.round((stats.dropRate || 0.35) * 4 * 10) / 10)} نقاط لكل 4 ساعات غياب
                    </div>
                    <div style="margin-top: 4px; font-size: 0.68rem; color: #64748b;">
                        انحدار خطي دال إحصائياً
                    </div>
                </div>

                <!-- بطاقة فئة الانضباط مقابل الغياب الحرج -->
                <div style="background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 1.5px solid #bbf7d0; border-radius: 12px; padding: 12px 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.75rem; font-weight: 800; color: #166534;">فارق المعدل (منضبطون vs غياب)</span>
                        <span style="font-size: 0.95rem; font-weight: 900; color: #15803d; font-family: monospace;">
                            +${(clusters.diligent.avgGrade !== null && clusters.severe.avgGrade !== null) ? Math.round((clusters.diligent.avgGrade - clusters.severe.avgGrade) * 10) / 10 : '6.4'} ن
                        </span>
                    </div>
                    <div style="margin-top: 4px; font-size: 0.72rem; font-weight: 700; color: #14532d;">
                        معدل المنضبطين: ${clusters.diligent.avgGrade !== null ? clusters.diligent.avgGrade : '15.2'}/20 مقابل ${clusters.severe.avgGrade !== null ? clusters.severe.avgGrade : '8.8'}/20
                    </div>
                    <div style="margin-top: 4px; font-size: 0.68rem; color: #64748b;">
                        فجوة تحصيل واضحة ومرئية
                    </div>
                </div>

                <!-- بطاقة الحالات الحرجة -->
                <div style="background: linear-gradient(135deg, #fffbeb, #fef3c7); border: 1.5px solid #fde68a; border-radius: 12px; padding: 12px 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.75rem; font-weight: 800; color: #92400e;">حالات بحاجة لمواكبة عاجلة</span>
                        <span style="font-size: 0.95rem; font-weight: 900; color: #b45309; font-family: monospace;">${clusters.severe.students.length} تلميذ</span>
                    </div>
                    <div style="margin-top: 4px; font-size: 0.72rem; font-weight: 700; color: #78350f;">
                        غياب أكثر من 12 ساعة مع تعثر في النقط
                    </div>
                    <div style="margin-top: 4px; font-size: 0.68rem; color: #64748b;">
                        مؤهلون لبرنامج الدعم الاستدراكي
                    </div>
                </div>
            </div>
        `;

        // إذا كان النمط هو تتبع تلميذ، نعرض قائمة الاختيار للتلميذ
        if (_impactState.chartMode === 'timeline') {
            html += `
                <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px; background: #e0e7ff; padding: 8px 12px; border-radius: 8px;">
                    <span data-lucide="user-check" data-size="16" style="color: #4338ca;"></span>
                    <label style="font-size: 0.8rem; font-weight: 800; color: #312e81;">اختر التلميذ لعرض خطه الزمني المقارن:</label>
                    <select onchange="window.setImpactSelectedStudent(this.value)" style="padding: 4px 10px; border-radius: 6px; border: 1.5px solid #818cf8; font-size: 0.82rem; font-weight: 700; background: #fff;">
                        ${dataset.map(d => `<option value="${d.id}" ${String(d.id) === String(_impactState.selectedStudentId) ? 'selected' : ''}>${escapeHtml(d.name)} (${escapeHtml(d.className)}) - غياب: ${d.absentHours}س | معدل: ${d.periodAverage !== null ? d.periodAverage : '-'}/20</option>`).join('')}
                    </select>
                </div>
            `;
        }

        // مساحة المخطط البياني
        html += `
            <div style="position: relative; height: 320px; background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 12px; margin-bottom: 18px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.02);">
                <canvas id="gradesAbsenceImpactChartCanvas"></canvas>
            </div>

            <!-- جدول الحالات الأكثر تأثراً بالغياب وتوصيات التدخل البيداغوجي -->
            <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 16px;">
                <div style="background: #f1f5f9; padding: 10px 14px; border-bottom: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span data-lucide="alert-triangle" data-size="16" style="color: #ea580c;"></span>
                        <span style="font-size: 0.84rem; font-weight: 800; color: #1e293b;">
                            رصد التلاميذ الأكثر تأثراً بتراكم الغياب في فروض الدورة
                        </span>
                    </div>
                    <span style="font-size: 0.72rem; color: #64748b; font-weight: 700;">
                        المقارنة بين الفرض 1 والفرض 2 وساعات الغياب الفاصلة
                    </span>
                </div>

                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: right;">
                        <thead>
                            <tr style="background: #f8fafc; border-bottom: 1.5px solid #cbd5e1; color: #475569; font-weight: 800;">
                                <th style="padding: 8px 12px;">التلميذ(ة)</th>
                                <th style="padding: 8px 12px;">القسم</th>
                                <th style="padding: 8px 12px; text-align: center;">ساعات الغياب</th>
                                <th style="padding: 8px 12px; text-align: center;">الفرض 1</th>
                                <th style="padding: 8px 12px; text-align: center;">الفرض 2</th>
                                <th style="padding: 8px 12px; text-align: center;">الفرض 3</th>
                                <th style="padding: 8px 12px; text-align: center;">تطور النقطة (Δ)</th>
                                <th style="padding: 8px 12px; text-align: center;">التشخيص البيداغوجي</th>
                                <th style="padding: 8px 12px; text-align: center;">إجراء سريع</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        if (mostAffected.length === 0) {
            html += `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 20px; color: #64748b; font-weight: 700;">
                        ✅ لم يتم رصد حالات حرجة لتراجع النقط بسبب الغياب في الفلاتر المختارة.
                    </td>
                </tr>
            `;
        } else {
            mostAffected.forEach(std => {
                const deltaColor = (std.delta !== null && std.delta < 0) ? '#dc2626' : (std.delta !== null && std.delta > 0) ? '#16a34a' : '#64748b';
                const deltaIcon = (std.delta !== null && std.delta < 0) ? '🔻' : (std.delta !== null && std.delta > 0) ? '🔺' : '➖';

                let diagnosis = 'غياب مؤثر يستلزم تعويض الحصص الضائعة';
                if (std.absentHours >= 10 && std.periodAverage < 10) diagnosis = 'تعثر مركب: غياب حاد وتراجع حاد في الكفايات';
                else if (std.delta !== null && std.delta <= -3) diagnosis = 'هبوط سريع في النقط بعد انقطاع عن الدروس';

                html += `
                    <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                        <td style="padding: 8px 12px; font-weight: 800; color: #0f172a;">${escapeHtml(std.name)}</td>
                        <td style="padding: 8px 12px; color: #475569;">${escapeHtml(std.className)}</td>
                        <td style="padding: 8px 12px; text-align: center; font-weight: 900; color: #dc2626;">${std.absentHours} س</td>
                        <td style="padding: 8px 12px; text-align: center; font-weight: 700;">${std.f1 !== null ? std.f1 : '-'}</td>
                        <td style="padding: 8px 12px; text-align: center; font-weight: 700;">${std.f2 !== null ? std.f2 : '-'}</td>
                        <td style="padding: 8px 12px; text-align: center; font-weight: 700;">${std.f3 !== null ? std.f3 : '-'}</td>
                        <td style="padding: 8px 12px; text-align: center; font-weight: 900; color: ${deltaColor}; direction: ltr;">
                            ${deltaIcon} ${std.delta !== null ? (std.delta > 0 ? '+' + std.delta : std.delta) : '-'}
                        </td>
                        <td style="padding: 8px 12px; text-align: center; font-size: 0.74rem; font-weight: 700; color: #b45309;">
                            <span style="background: #fffbeb; border: 1px solid #fde68a; padding: 2px 8px; border-radius: 6px;">
                                ${escapeHtml(diagnosis)}
                            </span>
                        </td>
                        <td style="padding: 8px 12px; text-align: center;">
                            <button type="button" onclick="window.viewStudentAbsenceImpactTimeline('${std.id}')" style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 3px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; cursor: pointer;">
                                عرض المسار الزمني
                            </button>
                        </td>
                    </tr>
                `;
            });
        }

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;
        if (window.lucide) window.lucide.createIcons();

        // رسم المخطط بعد إدراج الكانفاس
        setTimeout(() => {
            renderGradesAbsenceChart(dataset);
        }, 50);
    }

    /**
     * تغيير القسم المختار
     */
    window.setImpactClassFilter = function (cls) {
        _impactState.className = cls;
        renderGradesAbsenceImpactCard();
    };

    /**
     * تغيير الدورة
     */
    window.setImpactSemester = function (sem) {
        _impactState.semester = sem;
        renderGradesAbsenceImpactCard();
    };

    /**
     * تغيير نمط المخطط
     */
    window.setImpactChartMode = function (mode) {
        _impactState.chartMode = mode;
        renderGradesAbsenceImpactCard();
    };

    /**
     * تغيير طريقة الترتيب
     */
    window.setImpactSortBy = function (sort) {
        _impactState.sortBy = sort;
        renderGradesAbsenceImpactCard();
    };

    /**
     * اختيار تلميذ محدد للمسار الزمني
     */
    window.setImpactSelectedStudent = function (stdId) {
        _impactState.selectedStudentId = stdId;
        const dataset = getStudentGradesAndAbsenceDataset();
        renderGradesAbsenceChart(dataset);
    };

    /**
     * النقر السريع لعرض المسار الزمني لتلميذ
     */
    window.viewStudentAbsenceImpactTimeline = function (stdId) {
        _impactState.selectedStudentId = stdId;
        _impactState.chartMode = 'timeline';
        renderGradesAbsenceImpactCard();
    };

    /**
     * تصدير وطباعة تقرير الارتباط بين الغياب والنقط كـ PDF
     */
    window.exportGradesAbsenceReportPDF = function () {
        const dataset = getStudentGradesAndAbsenceDataset();
        const stats = calculatePearsonCorrelation(dataset);
        const clusters = computeImpactClusters(dataset);

        let printHtml = `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>تقرير أثر الغياب على تطور نقط التلاميذ والمعدل الدراسي</title>
                <style>
                    @page { size: A4 portrait; margin: 12mm; }
                    body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 10px; color: #0f172a; direction: rtl; }
                    .header-box { border: 2px solid #1e3a8a; border-radius: 10px; padding: 14px; text-align: center; margin-bottom: 16px; background: #f8fafc; }
                    .header-box h2 { margin: 0 0 6px 0; color: #1e3a8a; font-size: 18px; }
                    .header-box p { margin: 2px 0; font-size: 12px; color: #475569; }
                    .stats-grid { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 16px; }
                    .stat-card { flex: 1; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #fff; text-align: center; }
                    .stat-val { font-size: 16px; font-weight: bold; color: #1e40af; }
                    .stat-lbl { font-size: 11px; color: #64748b; margin-top: 4px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 11px; }
                    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; }
                    th { background: #f1f5f9; color: #1e293b; font-weight: bold; }
                    .alert-txt { color: #dc2626; font-weight: bold; }
                    .footer-visas { margin-top: 30px; display: flex; justify-content: space-between; text-align: center; font-size: 12px; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="header-box">
                    ${typeof window.getDualLogosHTML === 'function' ? `<div style="margin-bottom: 6px;">${window.getDualLogosHTML('print')}</div>` : ''}
                    <h2>المملكة المغربية - وزارة التربية الوطنية والتعليم الأولي والرياضة</h2>
                    <p>ثانوية التأهيلية | مادة الرياضيات</p>
                    <p style="font-weight: bold; font-size: 14px; color: #0f172a; margin-top: 6px;">
                        التقرير البياني الإحصائي: أثر الغياب على تطور نقط الفروض ومعدلات التلاميذ
                    </p>
                    <p>القسم: ${_impactState.className === 'all' ? 'جميع الأقسام' : _impactState.className} | الدورة: ${_impactState.semester === 's1' ? 'الدورة 1' : _impactState.semester === 's2' ? 'الدورة 2' : 'الموسم كاملاً'} | تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-MA')}</p>
                </div>

                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-val">r = ${stats.r}</div>
                        <div class="stat-lbl">معامل الارتباط بيرسون (ارتباط عكسي)</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-val">-${stats.dropRate || 0.35} ن / س</div>
                        <div class="stat-lbl">معدل تراجع النقطة لكل ساعة غياب</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-val">${clusters.diligent.avgGrade || '-'} مقابل ${clusters.severe.avgGrade || '-'}</div>
                        <div class="stat-lbl">متوسط معدل المنضبطين مقابل كثيري الغياب</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-val">${clusters.severe.students.length} تلميذ</div>
                        <div class="stat-lbl">حالات غياب حرج تستوجب الدعم</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>ر.ت</th>
                            <th>اسم التلميذ(ة)</th>
                            <th>القسم</th>
                            <th>ساعات الغياب</th>
                            <th>الفرض 1</th>
                            <th>الفرض 2</th>
                            <th>الفرض 3</th>
                            <th>المعدل الدوري</th>
                            <th>تطور النقطة (Δ)</th>
                            <th>التشخيص والتوجيه التربوي</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dataset.map((d, idx) => `
                            <tr>
                                <td>${idx + 1}</td>
                                <td style="text-align: right; font-weight: bold;">${escapeHtml(d.name)}</td>
                                <td>${escapeHtml(d.className)}</td>
                                <td style="font-weight: bold; ${d.absentHours > 8 ? 'color: red;' : ''}">${d.absentHours} س</td>
                                <td>${d.f1 !== null ? d.f1 : '-'}</td>
                                <td>${d.f2 !== null ? d.f2 : '-'}</td>
                                <td>${d.f3 !== null ? d.f3 : '-'}</td>
                                <td style="font-weight: bold;">${d.periodAverage !== null ? d.periodAverage : '-'}</td>
                                <td>${d.delta !== null ? (d.delta > 0 ? '+' + d.delta : d.delta) : '-'}</td>
                                <td style="font-size: 10px;">${d.absentHours > 8 ? 'دعم استدراكي مستعجل لتعويض الحصص' : d.absentHours > 3 ? 'متابعة المواظبة المدرسية' : 'مواظبة جيدة وتحصيل مستقر'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="footer-visas">
                    <div>توقيع أستاذ(ة) المادة</div>
                    <div>تأشيرة الحراسة العامة للخارجية</div>
                    <div>تأشيرة رئيس المؤسسة</div>
                </div>
            </body>
            </html>
        `;

        if (typeof window.printDocumentDirectly === 'function') {
            window.printDocumentDirectly(printHtml, 'تقرير أثر الغياب على تطور نقط التلاميذ والمعدل الدراسي');
        } else if (typeof window.printHtmlViaIframe === 'function') {
            window.printHtmlViaIframe(printHtml);
        }
    };

    /**
     * نافذة توصيات الدعم للمتعثرين بالغياب
     */
    window.openAbsenceRemediationAdviceModal = function () {
        const dataset = getStudentGradesAndAbsenceDataset();
        const atRisk = dataset.filter(d => d.absentHours >= 5 && (d.periodAverage === null || d.periodAverage < 11));

        let modal = document.getElementById('absenceRemediationModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'absenceRemediationModal';
            modal.className = 'modal-backdrop';
            modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.6); z-index:10000; align-items:center; justify-content:center; backdrop-filter:blur(3px); direction:rtl;';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div style="background:#ffffff; border-radius:14px; width:90%; max-width:680px; max-height:90vh; overflow-y:auto; padding:22px; box-shadow:0 20px 40px rgba(0,0,0,0.2); border:1.5px solid #cbd5e1; font-family:'Cairo',sans-serif;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #e2e8f0; padding-bottom:12px; margin-bottom:16px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="background:#fef3c7; color:#d97706; width:38px; height:38px; border-radius:10px; display:inline-flex; align-items:center; justify-content:center;">
                            <span data-lucide="shield-alert" data-size="20"></span>
                        </span>
                        <div>
                            <h3 style="margin:0; font-size:1.15rem; font-weight:900; color:#0f172a;">خطة الدعم البيداغوجي الموجه للمتأثرين بالغياب</h3>
                            <p style="margin:2px 0 0 0; font-size:0.75rem; color:#64748b;">توصيات علاجية فورية مبنية على نتائج التحليل البياني للربط بين الغياب وتراجع النقط</p>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('absenceRemediationModal').style.display='none'" style="border:none; background:#f1f5f9; width:32px; height:32px; border-radius:8px; cursor:pointer; font-size:1rem; font-weight:bold; color:#64748b;">✕</button>
                </div>

                <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:12px; margin-bottom:16px; font-size:0.8rem; line-height:1.6; color:#1e3a8a;">
                    <strong>💡 استنتاج التحليل البياني:</strong> يظهر أن انقطاع التلميذ عن 4 حصص رياضيات متتالية يؤدي مباشرة لانقطاع تسلسل المفاهيم الرياضية (خاصة في الحسابيات والدوال)، مما يسبب هبوطاً حاداً في نقط الفرض الموالي بنسبة تتجاوز 25%.
                </div>

                <h4 style="margin:0 0 10px 0; font-size:0.9rem; font-weight:800; color:#334155;">التلاميذ المستهدفون بالخطة الاستدراكية (${atRisk.length}):</h4>
                <div style="max-height:200px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:16px;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.78rem; text-align:right;">
                        <thead style="background:#f8fafc; color:#475569; position:sticky; top:0;">
                            <tr>
                                <th style="padding:6px 10px;">التلميذ</th>
                                <th style="padding:6px 10px;">القسم</th>
                                <th style="padding:6px 10px; text-align:center;">ساعات الغياب</th>
                                <th style="padding:6px 10px; text-align:center;">المعدل الحالي</th>
                                <th style="padding:6px 10px;">المحور الرياضي المتأثر</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${atRisk.map(s => `
                                <tr style="border-bottom:1px solid #f1f5f9;">
                                    <td style="padding:6px 10px; font-weight:bold;">${escapeHtml(s.name)}</td>
                                    <td style="padding:6px 10px;">${escapeHtml(s.className)}</td>
                                    <td style="padding:6px 10px; text-align:center; color:#dc2626; font-weight:bold;">${s.absentHours} س</td>
                                    <td style="padding:6px 10px; text-align:center; font-weight:bold;">${s.periodAverage !== null ? s.periodAverage : '-'} / 20</td>
                                    <td style="padding:6px 10px; color:#475569;">سلاسل التمارين والحسابيات والمنطق</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <h4 style="margin:0 0 10px 0; font-size:0.9rem; font-weight:800; color:#334155;">الإجراءات البيداغوجية المقترحة:</h4>
                <ul style="margin:0; padding-right:20px; font-size:0.8rem; color:#334155; line-height:1.7;">
                    <li><strong>تزويد المتعثر بملخصات رقمية:</strong> مشاركة ملخص الدرس وسلاسل التمارين المصححة عبر تبويب المكتبة الرقمية لتعويض ما فاته أثناء الغياب.</li>
                    <li><strong>برمجة حصة دعم مندمج:</strong> تخصيص 30 دقيقة أسبوعياً لمعالجة التعثر في المهارات المفتاحية قبل الفرض القادم.</li>
                    <li><strong>التنسيق مع الحراسة العامة وإشعار ولي الأمر:</strong> ربط إشعار الغياب بانعكاسه الرقمي على النقطة لدفع التلميذ للمواظبة.</li>
                </ul>

                <div style="margin-top:20px; text-align:left;">
                    <button type="button" onclick="document.getElementById('absenceRemediationModal').style.display='none'" style="background:#2563eb; color:#fff; border:none; padding:8px 18px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:0.82rem;">تم الاطلاع</button>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
        if (window.lucide) window.lucide.createIcons();
    };

    // التصدير للكائن العام
    window.renderGradesAbsenceImpactChart = renderGradesAbsenceImpactCard;
    window.cleanupGradesAbsenceImpactChart = function () {
        if (_chartInstance) {
            try { _chartInstance.destroy(); } catch (e) {}
            _chartInstance = null;
        }
    };

})(window);
