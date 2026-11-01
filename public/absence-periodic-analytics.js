/**
 * ====================================================================
 * ويدجت إحصائيات الغياب حسب الفترات الزمنية (أسبوعي، شهري، فصلي)
 * Advanced Periodic Absence Analytics Widget (Weekly, Monthly, Term)
 * ====================================================================
 * لوحة بيانية متقدمة في لوحة القيادة ترصد وتُحلل اتجاهات الغياب المدرسي
 * عبر فترات زمنية متعددة (أسبوعياً، شهرياً، وفصلياً) باستخدام Chart.js
 * مع مؤشرات المقارنة والتحسن، والفصل بين المبرر وغير المبرر، وتوزيع الأقسام.
 */

(function (window) {
    'use strict';

    // الحالة العامة للويدجت
    const _periodicState = {
        period: 'weekly', // 'weekly' | 'monthly' | 'trimester'
        classFilter: 'all',
        chartType: 'bar', // 'bar' | 'line' | 'donut'
        metric: 'hours', // 'hours' | 'split' | 'average'
        selectedSlice: null
    };

    let _chartInstance = null;

    const ARABIC_MONTH_NAMES = {
        '01': 'يناير',
        '02': 'فبراير',
        '03': 'مارس',
        '04': 'أبريل',
        '05': 'ماي',
        '06': 'يونيو',
        '07': 'يوليوز',
        '08': 'غشت',
        '09': 'شتنبر',
        '10': 'أكتوبر',
        '11': 'نونبر',
        '12': 'دجنبر'
    };

    const SCHOOL_YEAR_MONTHS = ['09', '10', '11', '12', '01', '02', '03', '04', '05', '06'];

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
     * حساب رقم الأسبوع وتاريخ البداية والنهاية
     */
    function getWeekInfoFromDate(dateStr) {
        try {
            const [y, m, d] = dateStr.split('-').map(Number);
            const dt = new Date(y, m - 1, d);
            // ضبط على بداية الأسبوع (الاثنين)
            const dayOfWeek = (dt.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
            const startOfWeek = new Date(y, m - 1, d - dayOfWeek);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);

            const sY = startOfWeek.getFullYear();
            const sM = String(startOfWeek.getMonth() + 1).padStart(2, '0');
            const sD = String(startOfWeek.getDate()).padStart(2, '0');

            const eY = endOfWeek.getFullYear();
            const eM = String(endOfWeek.getMonth() + 1).padStart(2, '0');
            const eD = String(endOfWeek.getDate()).padStart(2, '0');

            return {
                startStr: `${sY}-${sM}-${sD}`,
                endStr: `${eY}-${eM}-${eD}`,
                label: `${sD}/${sM} ⬅️ ${eD}/${eM}`,
                sortKey: `${sY}-${sM}-${sD}`
            };
        } catch (e) {
            return { startStr: dateStr, endStr: dateStr, label: dateStr, sortKey: dateStr };
        }
    }

    /**
     * تحديد الفصل / الدورة من تاريخ الغياب
     */
    function getTermFromDate(dateStr) {
        if (!dateStr) return { id: 's1', label: 'الدورة الأولى (S1)', order: 1 };
        const m = parseInt(dateStr.split('-')[1], 10);
        // شتنبر إلى يناير = الدورة الأولى (S1)
        // فبراير إلى يونيو = الدورة الثانية (S2)
        if (m >= 9 || m === 1) {
            return { id: 's1', label: 'الدورة الأولى (S1)', order: 1 };
        } else {
            return { id: 's2', label: 'الدورة الثانية (S2)', order: 2 };
        }
    }

    /**
     * استخراج وتجميع بيانات الغياب حسب الفترة المحددة
     */
    function computeAbsencePeriodicData() {
        const db = window.db || {};
        const records = db.records || [];
        const classes = db.classes || {};
        const classFilter = _periodicState.classFilter;

        // خريطة لتجميع البيانات
        // key -> { label, sortKey, totalHours, unjustifiedHours, justifiedHours, studentsSet: Set, recordsCount, classMap: {} }
        const buckets = new Map();

        // حساب عدد التلاميذ الإجمالي للقسم/الأقسام
        let totalEnrolledStudents = 0;
        const targetClasses = (classFilter === 'all')
            ? Object.keys(classes)
            : (classes[classFilter] ? [classFilter] : []);

        targetClasses.forEach(c => {
            const clsVal = classes[c];
            const arr = Array.isArray(clsVal) ? clsVal : (clsVal && Array.isArray(clsVal.students) ? clsVal.students : []);
            totalEnrolledStudents += arr.length;
        });
        if (totalEnrolledStudents === 0) totalEnrolledStudents = 1;

        // تهيئة الفترات إذا كانت شهرية لتظهر بالترتيب الدراسي
        if (_periodicState.period === 'monthly') {
            SCHOOL_YEAR_MONTHS.forEach((mStr, idx) => {
                const label = ARABIC_MONTH_NAMES[mStr] || mStr;
                buckets.set(mStr, {
                    id: mStr,
                    label: label,
                    sortKey: idx,
                    totalHours: 0,
                    unjustifiedHours: 0,
                    justifiedHours: 0,
                    studentsSet: new Set(),
                    recordsCount: 0,
                    classMap: {}
                });
            });
        } else if (_periodicState.period === 'trimester') {
            buckets.set('s1', {
                id: 's1',
                label: 'الدورة الأولى (شتنبر - يناير)',
                sortKey: 1,
                totalHours: 0,
                unjustifiedHours: 0,
                justifiedHours: 0,
                studentsSet: new Set(),
                recordsCount: 0,
                classMap: {}
            });
            buckets.set('s2', {
                id: 's2',
                label: 'الدورة الثانية (فبراير - يونيو)',
                sortKey: 2,
                totalHours: 0,
                unjustifiedHours: 0,
                justifiedHours: 0,
                studentsSet: new Set(),
                recordsCount: 0,
                classMap: {}
            });
        }

        // مسح السجلات
        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            if (!r || !r.date) continue;
            if (classFilter !== 'all' && r.className !== classFilter) continue;

            const isUnjust = (r.status === 'غائب');
            const isJust = (r.status === 'مبرر');
            if (!isUnjust && !isJust) continue;

            // استثناء العطل الرسمية
            if (typeof window.isAbsenceDisabledOnDate === 'function' && window.isAbsenceDisabledOnDate(r.date, r.session)) {
                continue;
            }

            const dur = parseFloat(r.duration) || 1;
            let bucketKey = '';
            let bucketLabel = '';
            let sortKey = 0;

            if (_periodicState.period === 'weekly') {
                const wInfo = getWeekInfoFromDate(r.date);
                bucketKey = wInfo.sortKey;
                bucketLabel = `أسبوع ${wInfo.label}`;
                sortKey = wInfo.sortKey;
            } else if (_periodicState.period === 'monthly') {
                const mStr = r.date.split('-')[1];
                bucketKey = mStr;
                bucketLabel = ARABIC_MONTH_NAMES[mStr] || mStr;
                sortKey = SCHOOL_YEAR_MONTHS.indexOf(mStr);
                if (sortKey === -1) sortKey = 99;
            } else if (_periodicState.period === 'trimester') {
                const tInfo = getTermFromDate(r.date);
                bucketKey = tInfo.id;
                bucketLabel = tInfo.label;
                sortKey = tInfo.order;
            }

            if (!buckets.has(bucketKey)) {
                buckets.set(bucketKey, {
                    id: bucketKey,
                    label: bucketLabel,
                    sortKey: sortKey,
                    totalHours: 0,
                    unjustifiedHours: 0,
                    justifiedHours: 0,
                    studentsSet: new Set(),
                    recordsCount: 0,
                    classMap: {}
                });
            }

            const b = buckets.get(bucketKey);
            b.totalHours += dur;
            if (isUnjust) b.unjustifiedHours += dur;
            if (isJust) b.justifiedHours += dur;
            b.studentsSet.add(r.studentId);
            b.recordsCount++;

            if (!b.classMap[r.className]) b.classMap[r.className] = 0;
            b.classMap[r.className] += dur;
        }

        // تحويل الخريطة إلى مصفوفة مرتبة
        let items = Array.from(buckets.values());
        if (_periodicState.period === 'weekly') {
            // ترتيب تصاعدي حسب التاريخ ثم أخذ آخر 8 إلى 12 أسبوعاً إن كانت كثيرة
            items.sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey)));
            if (items.length > 10) {
                items = items.slice(-10);
            }
        } else {
            items.sort((a, b) => a.sortKey - b.sortKey);
        }

        // حساب الإحصائيات العامة
        let grandTotalHours = 0;
        let grandUnjustifiedHours = 0;
        let grandJustifiedHours = 0;
        let peakBucket = null;
        let maxBucketHours = -1;
        const classTotalHours = {};

        items.forEach((item, index) => {
            grandTotalHours += item.totalHours;
            grandUnjustifiedHours += item.unjustifiedHours;
            grandJustifiedHours += item.justifiedHours;

            if (item.totalHours > maxBucketHours) {
                maxBucketHours = item.totalHours;
                peakBucket = item;
            }

            // نسبة التغير مقارنة بالفترة السابقة
            if (index > 0) {
                const prev = items[index - 1];
                if (prev.totalHours > 0) {
                    item.changePct = Math.round(((item.totalHours - prev.totalHours) / prev.totalHours) * 100);
                } else if (item.totalHours > 0) {
                    item.changePct = 100;
                } else {
                    item.changePct = 0;
                }
            } else {
                item.changePct = null;
            }

            item.studentsCount = item.studentsSet.size;
            item.avgHoursPerStudent = totalEnrolledStudents > 0 
                ? (item.totalHours / totalEnrolledStudents).toFixed(1) 
                : 0;

            // تراكم الأقسام
            Object.keys(item.classMap).forEach(c => {
                classTotalHours[c] = (classTotalHours[c] || 0) + item.classMap[c];
            });
        });

        // تحديد أعلى قسم تسجيلاً للغياب
        let peakClass = 'لا يوجد';
        let peakClassHours = 0;
        Object.keys(classTotalHours).forEach(c => {
            if (classTotalHours[c] > peakClassHours) {
                peakClassHours = classTotalHours[c];
                peakClass = c;
            }
        });

        const unjustifiedPct = grandTotalHours > 0 
            ? Math.round((grandUnjustifiedHours / grandTotalHours) * 100) 
            : 0;

        return {
            items,
            grandTotalHours,
            grandUnjustifiedHours,
            grandJustifiedHours,
            unjustifiedPct,
            peakBucket,
            peakClass,
            peakClassHours,
            totalEnrolledStudents
        };
    }

    /**
     * رسم الرسم البياني المتقدم بواسطة Chart.js
     */
    function renderChartJs(data) {
        const canvas = document.getElementById('dashAbsencePeriodicCanvas');
        if (!canvas || !window.Chart) return;

        if (_chartInstance) {
            _chartInstance.destroy();
            _chartInstance = null;
        }

        const ctx = canvas.getContext('2d');
        const labels = data.items.map(i => i.label);

        // إنشاء تدرجات لونية جميلة
        const gradUnjust = ctx.createLinearGradient(0, 0, 0, 260);
        gradUnjust.addColorStop(0, 'rgba(234, 88, 12, 0.85)');
        gradUnjust.addColorStop(1, 'rgba(220, 38, 38, 0.2)');

        const gradJust = ctx.createLinearGradient(0, 0, 0, 260);
        gradJust.addColorStop(0, 'rgba(2, 132, 199, 0.85)');
        gradJust.addColorStop(1, 'rgba(14, 165, 233, 0.2)');

        const gradTotal = ctx.createLinearGradient(0, 0, 0, 260);
        gradTotal.addColorStop(0, 'rgba(124, 58, 237, 0.85)');
        gradTotal.addColorStop(1, 'rgba(79, 70, 229, 0.15)');

        let datasets = [];

        if (_periodicState.chartType === 'donut') {
            // رسم دائري لتوزيع الغياب حسب الفترة
            datasets = [{
                data: data.items.map(i => i.totalHours),
                backgroundColor: [
                    '#2563eb', '#7c3aed', '#ea580c', '#dc2626', '#059669',
                    '#0891b2', '#d97706', '#db2777', '#4f46e5', '#16a34a'
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }];

            _chartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: { labels, datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                font: { family: 'Cairo', size: 11, weight: 'bold' },
                                color: '#334155',
                                padding: 12
                            }
                        },
                        tooltip: {
                            rtl: true,
                            titleFont: { family: 'Cairo', weight: 'bold' },
                            bodyFont: { family: 'Cairo' },
                            callbacks: {
                                label: function (context) {
                                    const val = context.raw || 0;
                                    const total = data.grandTotalHours || 1;
                                    const pct = Math.round((val / total) * 100);
                                    return ` ${val} ساعة غياب (${pct}%)`;
                                }
                            }
                        }
                    },
                    cutout: '62%'
                }
            });
            return;
        }

        if (_periodicState.metric === 'split') {
            // تفصيل المبرر وغير المبرر (Stacked Bar أو Dual Line)
            datasets = [
                {
                    label: 'غياب غير مبرر (ساعات)',
                    data: data.items.map(i => i.unjustifiedHours),
                    backgroundColor: _periodicState.chartType === 'bar' ? '#ea580c' : 'rgba(234, 88, 12, 0.15)',
                    borderColor: '#ea580c',
                    borderWidth: 2,
                    borderRadius: _periodicState.chartType === 'bar' ? 6 : 0,
                    tension: 0.35,
                    fill: _periodicState.chartType === 'line'
                },
                {
                    label: 'غياب مبرر (ساعات)',
                    data: data.items.map(i => i.justifiedHours),
                    backgroundColor: _periodicState.chartType === 'bar' ? '#0284c7' : 'rgba(2, 132, 199, 0.15)',
                    borderColor: '#0284c7',
                    borderWidth: 2,
                    borderRadius: _periodicState.chartType === 'bar' ? 6 : 0,
                    tension: 0.35,
                    fill: _periodicState.chartType === 'line'
                }
            ];
        } else if (_periodicState.metric === 'average') {
            // معدل الغياب لكل تلميذ
            datasets = [{
                label: 'معدل ساعات الغياب لكل تلميذ',
                data: data.items.map(i => i.avgHoursPerStudent),
                backgroundColor: _periodicState.chartType === 'bar' ? gradTotal : 'rgba(124, 58, 237, 0.18)',
                borderColor: '#7c3aed',
                borderWidth: 2.5,
                borderRadius: 6,
                tension: 0.35,
                fill: _periodicState.chartType === 'line'
            }];
        } else {
            // مجموع ساعات الغياب الإجمالية
            datasets = [{
                label: 'مجموع ساعات الغياب',
                data: data.items.map(i => i.totalHours),
                backgroundColor: _periodicState.chartType === 'bar' ? gradTotal : 'rgba(37, 99, 235, 0.15)',
                borderColor: '#2563eb',
                borderWidth: 2.5,
                borderRadius: 7,
                tension: 0.35,
                fill: _periodicState.chartType === 'line'
            }];
        }

        _chartInstance = new Chart(ctx, {
            type: _periodicState.chartType,
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        stacked: (_periodicState.chartType === 'bar' && _periodicState.metric === 'split'),
                        grid: {
                            color: '#f1f5f9'
                        },
                        ticks: {
                            font: { family: 'Cairo', size: 10, weight: 'bold' },
                            color: '#64748b'
                        }
                    },
                    x: {
                        stacked: (_periodicState.chartType === 'bar' && _periodicState.metric === 'split'),
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: { family: 'Cairo', size: 10, weight: 'bold' },
                            color: '#475569',
                            maxRotation: 35
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        rtl: true,
                        labels: {
                            font: { family: 'Cairo', size: 11, weight: 'bold' },
                            color: '#1e293b',
                            boxWidth: 14,
                            padding: 10
                        }
                    },
                    tooltip: {
                        rtl: true,
                        titleFont: { family: 'Cairo', weight: 'bold', size: 12 },
                        bodyFont: { family: 'Cairo', size: 11 },
                        padding: 10,
                        backgroundColor: 'rgba(15, 23, 42, 0.92)',
                        callbacks: {
                            afterBody: function (context) {
                                const idx = context[0].dataIndex;
                                const item = data.items[idx];
                                if (!item) return '';
                                const lines = [
                                    `👥 عدد التلاميذ المتغيبين: ${item.studentsCount} تلميذ`,
                                    `⚡ إجمالي الساعات: ${item.totalHours} س`
                                ];
                                if (item.changePct !== null) {
                                    const sign = item.changePct > 0 ? '+' : '';
                                    lines.push(`📈 نسبة التغير عن الفترة السابقة: ${sign}${item.changePct}%`);
                                }
                                return lines.join('\n');
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * ====================================================================
     * رسم الواجهة الكاملة للويدجت
     * ====================================================================
     */
    function renderPeriodicAbsenceAnalyticsWidget() {
        const mount = document.getElementById('dashAbsencePeriodicAnalyticsMount');
        if (!mount) return;

        const db = window.db || {};
        const classes = Object.keys(db.classes || {}).sort();
        const data = computeAbsencePeriodicData();

        const periodLabel = _periodicState.period === 'weekly' 
            ? 'أسبوعي' 
            : _periodicState.period === 'monthly' 
            ? 'شهري' 
            : 'فصلي / دوري';

        const peakTitle = data.peakBucket 
            ? `${data.peakBucket.label} (${data.peakBucket.totalHours} س)` 
            : 'لا توجد غيابات';

        mount.innerHTML = `
            <div class="card dash-widget-card" style="border-radius: 14px; border: 1.5px solid #cbd5e1; border-top: 5px solid #2563eb; background: #ffffff; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05); padding: 18px 20px;">
                <!-- رأس الويدجت والأزرار التفاعلية -->
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; border-bottom: 1px solid #f1f5f9; padding-bottom: 14px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="width: 42px; height: 42px; border-radius: 11px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 8px rgba(37, 99, 235, 0.3);">
                            <span class="ui-icon" style="margin:0; color:#fff;"><span data-lucide="bar-chart-3" data-size="22"></span></span>
                        </span>
                        <div>
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <h3 style="margin: 0; font-size: 1.08rem; font-weight: 800; color: #0f172a; font-family: 'Cairo', sans-serif;">
                                    إحصائيات الغياب حسب الفترات الزمنية (${periodLabel})
                                </h3>
                                <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 9999px; background: #eff6ff; color: #1d4ed8; font-weight: 800; border: 1px solid #bfdbfe;">
                                    رسوم بيانية متطورة
                                </span>
                            </div>
                            <p style="margin: 2px 0 0 0; font-size: 0.78rem; color: #64748b;">
                                تحليل شامل لمسار الغياب أسبوعياً وشهرياً وفصلياً لتشخيص اتجاهات المواظبة والحد من الهدر المدرسي.
                            </p>
                        </div>
                    </div>

                    <!-- ضوابط الفلترة وأزرار التبديل -->
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <!-- Time Period Switcher (أسبوعي، شهري، فصلي) -->
                        <div style="display: flex; align-items: center; gap: 3px; background: #f1f5f9; padding: 3px; border-radius: 9px; border: 1px solid #e2e8f0;">
                            <button type="button" class="dash-pill-btn ${_periodicState.period === 'weekly' ? 'active' : ''}" onclick="window.setPeriodicAbsencePeriod('weekly')" style="padding: 5px 12px; font-size: 0.76rem; font-weight: 800;">
                                📅 أسبوعي
                            </button>
                            <button type="button" class="dash-pill-btn ${_periodicState.period === 'monthly' ? 'active' : ''}" onclick="window.setPeriodicAbsencePeriod('monthly')" style="padding: 5px 12px; font-size: 0.76rem; font-weight: 800;">
                                📆 شهري
                            </button>
                            <button type="button" class="dash-pill-btn ${_periodicState.period === 'trimester' ? 'active' : ''}" onclick="window.setPeriodicAbsencePeriod('trimester')" style="padding: 5px 12px; font-size: 0.76rem; font-weight: 800;">
                                🎓 فصلي (دورات)
                            </button>
                        </div>

                        <!-- Class Filter -->
                        <select id="periodicAbsenceClassFilter" onchange="window.setPeriodicAbsenceClass(this.value)" style="padding: 6px 10px; border-radius: 8px; border: 1px solid #cbd5e1; font-weight: 700; font-size: 0.78rem; background: #f8fafc; color: #1e293b; cursor: pointer;">
                            <option value="all" ${_periodicState.classFilter === 'all' ? 'selected' : ''}>جميع الأقسام معاً</option>
                            ${classes.map(c => `<option value="${escapeHtml(c)}" ${_periodicState.classFilter === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
                        </select>

                        <!-- Chart Style Toggle (أعمدة / منحنى / دائري) -->
                        <div style="display: flex; align-items: center; gap: 2px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 2px;">
                            <button type="button" class="dash-pill-btn ${_periodicState.chartType === 'bar' ? 'active' : ''}" onclick="window.setPeriodicAbsenceChartType('bar')" title="أعمدة بيانية" style="padding: 4px 8px; border-radius: 6px;">
                                📊
                            </button>
                            <button type="button" class="dash-pill-btn ${_periodicState.chartType === 'line' ? 'active' : ''}" onclick="window.setPeriodicAbsenceChartType('line')" title="منحنى بياني انسيابي" style="padding: 4px 8px; border-radius: 6px;">
                                📈
                            </button>
                            <button type="button" class="dash-pill-btn ${_periodicState.chartType === 'donut' ? 'active' : ''}" onclick="window.setPeriodicAbsenceChartType('donut')" title="رسم دائري للتوزيع" style="padding: 4px 8px; border-radius: 6px;">
                                🍩
                            </button>
                        </div>

                        <!-- Metric Toggle (ساعات / تفصيل مبرر / معدل) -->
                        <select onchange="window.setPeriodicAbsenceMetric(this.value)" style="padding: 6px 10px; border-radius: 8px; border: 1px solid #cbd5e1; font-weight: 700; font-size: 0.78rem; background: #f8fafc; color: #1e293b; cursor: pointer;">
                            <option value="hours" ${_periodicState.metric === 'hours' ? 'selected' : ''}>مجموع الساعات</option>
                            <option value="split" ${_periodicState.metric === 'split' ? 'selected' : ''}>مفصل (مبرر / غير مبرر)</option>
                            <option value="average" ${_periodicState.metric === 'average' ? 'selected' : ''}>معدل الغياب لكل تلميذ</option>
                        </select>
                    </div>
                </div>

                <!-- شريط مؤشرات الأداء السريعة (4 KPI Cards داخل الويدجت) -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 16px;">
                    <!-- 1. Total Hours in Period -->
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-right: 4px solid #2563eb; border-radius: 10px; padding: 10px 14px;">
                        <div style="font-size: 0.74rem; font-weight: 700; color: #64748b;">إجمالي ساعات الغياب في الفترة</div>
                        <div style="font-size: 1.55rem; font-weight: 900; color: #0f172a; margin-top: 3px; line-height: 1.2;">
                            ${data.grandTotalHours} <span style="font-size: 0.8rem; font-weight: 700; color: #64748b;">ساعة</span>
                        </div>
                        <div style="font-size: 0.72rem; color: #2563eb; font-weight: 700; margin-top: 4px;">
                            ${data.items.length} فترات زمنية محللة
                        </div>
                    </div>

                    <!-- 2. Peak Period -->
                    <div style="background: #fff7ed; border: 1px solid #fed7aa; border-right: 4px solid #ea580c; border-radius: 10px; padding: 10px 14px;">
                        <div style="font-size: 0.74rem; font-weight: 700; color: #c2410c;">ذروة الغياب (أعلى فترة)</div>
                        <div style="font-size: 1.05rem; font-weight: 800; color: #9a3412; margin-top: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${peakTitle}">
                            ${peakTitle}
                        </div>
                        <div style="font-size: 0.72rem; color: #ea580c; font-weight: 700; margin-top: 4px;">
                            تستدعي التدخل الوقائي
                        </div>
                    </div>

                    <!-- 3. Unjustified Rate -->
                    <div style="background: #fef2f2; border: 1px solid #fecaca; border-right: 4px solid #dc2626; border-radius: 10px; padding: 10px 14px;">
                        <div style="font-size: 0.74rem; font-weight: 700; color: #991b1b;">نسبة الغياب غير المبرر</div>
                        <div style="font-size: 1.55rem; font-weight: 900; color: #dc2626; margin-top: 3px; line-height: 1.2;">
                            ${data.unjustifiedPct}% <span style="font-size: 0.76rem; font-weight: 700; color: #7f1d1d;">(${data.grandUnjustifiedHours} س)</span>
                        </div>
                        <div style="font-size: 0.72rem; color: #0284c7; font-weight: 700; margin-top: 4px;">
                            المبرر: ${data.grandJustifiedHours} س (${100 - data.unjustifiedPct}%)
                        </div>
                    </div>

                    <!-- 4. Peak Class -->
                    <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-right: 4px solid #7c3aed; border-radius: 10px; padding: 10px 14px;">
                        <div style="font-size: 0.74rem; font-weight: 700; color: #6d28d9;">أكثر قسم تسجيلاً للغياب</div>
                        <div style="font-size: 1.2rem; font-weight: 800; color: #581c87; margin-top: 4px;">
                            ${escapeHtml(data.peakClass)}
                        </div>
                        <div style="font-size: 0.72rem; color: #7c3aed; font-weight: 700; margin-top: 4px;">
                            ${data.peakClassHours} س في هذه الفترة
                        </div>
                    </div>
                </div>

                <!-- مساحة الرسم البياني المتطور بواسطة Chart.js -->
                <div style="position: relative; height: 280px; width: 100%; margin-bottom: 16px;">
                    <canvas id="dashAbsencePeriodicCanvas"></canvas>
                </div>

                <!-- جدول التفصيل الإحصائي القابل للطي -->
                <details style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; font-size: 0.8rem;">
                    <summary style="cursor: pointer; font-weight: 800; color: #1e293b; display: flex; align-items: center; justify-content: space-between;">
                        <span>📋 جدول المعطيات الإحصائية المفصلة للفترات الزمنية (${data.items.length} فترة)</span>
                        <span style="font-size: 0.72rem; color: #64748b; font-weight: 600;">انقر للعرض / الإخفاء</span>
                    </summary>
                    <div style="margin-top: 12px; overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.78rem; text-align: right;">
                            <thead>
                                <tr style="background: #e2e8f0; color: #0f172a; font-weight: 800;">
                                    <th style="padding: 7px 10px; border-radius: 6px 0 0 6px;">الفترة الزمنية</th>
                                    <th style="padding: 7px 10px;">إجمالي الساعات</th>
                                    <th style="padding: 7px 10px;">غير مبرر</th>
                                    <th style="padding: 7px 10px;">مبرر</th>
                                    <th style="padding: 7px 10px;">التلاميذ المتغيبين</th>
                                    <th style="padding: 7px 10px;">المعدل لكل تلميذ</th>
                                    <th style="padding: 7px 10px; border-radius: 0 6px 6px 0;">التغير</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.items.map(item => {
                                    const changeBadge = item.changePct !== null 
                                        ? (item.changePct > 0 
                                            ? `<span style="color: #dc2626; font-weight: 800;">▲ +${item.changePct}%</span>` 
                                            : item.changePct < 0 
                                            ? `<span style="color: #16a34a; font-weight: 800;">▼ ${item.changePct}%</span>` 
                                            : `<span style="color: #64748b;">0%</span>`)
                                        : '<span style="color: #94a3b8;">-</span>';

                                    return `
                                        <tr style="border-bottom: 1px solid #f1f5f9;">
                                            <td style="padding: 7px 10px; font-weight: 800; color: #1e293b;">${escapeHtml(item.label)}</td>
                                            <td style="padding: 7px 10px; font-weight: 900; color: #0f172a;">${item.totalHours} س</td>
                                            <td style="padding: 7px 10px; color: #ea580c; font-weight: 700;">${item.unjustifiedHours} س</td>
                                            <td style="padding: 7px 10px; color: #0284c7; font-weight: 700;">${item.justifiedHours} س</td>
                                            <td style="padding: 7px 10px; color: #334155;">${item.studentsCount} تلميذ</td>
                                            <td style="padding: 7px 10px; color: #64748b;">${item.avgHoursPerStudent} س</td>
                                            <td style="padding: 7px 10px;">${changeBadge}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </details>
            </div>
        `;

        if (window.renderLucide) window.renderLucide(mount);

        // رسم المخطط البياني فور اكتمال بناء عناصر الـ DOM مع منع التكرار المتزامن
        if (window._periodicChartRenderTimer) {
            clearTimeout(window._periodicChartRenderTimer);
        }
        window._periodicChartRenderTimer = setTimeout(() => {
            window._periodicChartRenderTimer = null;
            renderChartJs(data);
        }, 40);
    }

    // دوال التحكم التفاعلي
    window.setPeriodicAbsencePeriod = function (period) {
        _periodicState.period = period;
        renderPeriodicAbsenceAnalyticsWidget();
    };

    window.setPeriodicAbsenceClass = function (className) {
        _periodicState.classFilter = className;
        renderPeriodicAbsenceAnalyticsWidget();
    };

    window.setPeriodicAbsenceChartType = function (chartType) {
        _periodicState.chartType = chartType;
        renderPeriodicAbsenceAnalyticsWidget();
    };

    window.setPeriodicAbsenceMetric = function (metric) {
        _periodicState.metric = metric;
        renderPeriodicAbsenceAnalyticsWidget();
    };

    window.renderPeriodicAbsenceAnalyticsWidget = renderPeriodicAbsenceAnalyticsWidget;
    window.cleanupPeriodicAnalyticsChart = function () {
        if (window._periodicChartRenderTimer) {
            clearTimeout(window._periodicChartRenderTimer);
            window._periodicChartRenderTimer = null;
        }
        if (_chartInstance) {
            try { _chartInstance.destroy(); } catch (e) {}
            _chartInstance = null;
        }
    };

})(window);
