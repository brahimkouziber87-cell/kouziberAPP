/**
 * =========================================================================
 * وحدة الملف المهني الشخصي للأستاذ (Teacher Professional Profile View)
 * المسار الوظيفي، بيانات التوظيف والأقدمية، الصور والشعارات، والرسوم البيانية
 * =========================================================================
 */

(function () {
    'use strict';

    // التهيئة والتأكد من وجود البيانات الافتراضية
    function getTeacherProfile() {
        if (!window.db) window.db = {};
        if (!window.db.teacherProfile) {
            window.db.teacherProfile = { name: '', password: '' };
        }
        const tp = window.db.teacherProfile;

        // استكمال الحقول الإدارية والمهنية في حال كانت غير معرّفة
        if (!tp.name) tp.name = 'أستاذ مادة الرياضيات';
        if (tp.nameFr === undefined) tp.nameFr = '';
        if (tp.ppr === undefined) tp.ppr = ''; // رقم التأجير
        if (tp.cin === undefined) tp.cin = ''; // رقم البطاقة الوطنية
        if (tp.specialty === undefined) tp.specialty = 'مادة الرياضيات - التعليم الثانوي التأهيلي';
        if (tp.framework === undefined) tp.framework = 'أستاذ التعليم الثانوي التأهيلي';
        if (tp.scale === undefined) tp.scale = 'السلم 11 - الدرجة الأولى';
        if (tp.echelon === undefined) tp.echelon = 'الرتبة 6';
        if (tp.hireDate === undefined) tp.hireDate = '2015-09-02'; // تاريخ التوظيف
        if (tp.gradeDate === undefined) tp.gradeDate = '2021-01-01'; // تاريخ التسمية في الدرجة
        if (tp.schoolSeniorityDate === undefined) tp.schoolSeniorityDate = '2020-09-01'; // الأقدمية في المؤسسة
        if (tp.school === undefined) tp.school = 'الثانوية التأهيلية';
        if (tp.directorate === undefined) tp.directorate = 'المديرية الإقليمية للتربية والتكوين';
        if (tp.academy === undefined) tp.academy = 'الأكاديمية الجهوية للتربية والتكوين';
        if (tp.city === undefined) tp.city = '';
        if (tp.email === undefined) tp.email = '';
        if (tp.phone === undefined) tp.phone = '';
        if (tp.bio === undefined) {
            tp.bio = 'أستاذ التعليم الثانوي التأهيلي لمادة الرياضيات، متخصص في البيداغوجيا النشطة وتوظيف التكنولوجيا الحديثة والبرمجيات الديداكتيكية (GeoGebra, LaTeX) في تعليم وتعلم الرياضيات، والتحضير للامتحانات الإشهادية والأولمبياد المدرسي.';
        }

        // حقول الصورة الشخصية وشعار المؤسسة التعليمية
        if (tp.avatarDataUrl === undefined) tp.avatarDataUrl = '';
        if (tp.schoolLogoDataUrl === undefined) tp.schoolLogoDataUrl = '';
        if (tp.primaryHeaderImage === undefined) tp.primaryHeaderImage = 'both'; // 'both' | 'avatar' | 'logo'

        // المؤهلات الأكاديمية والشواهد
        if (!Array.isArray(tp.qualifications) || tp.qualifications.length === 0) {
            tp.qualifications = [
                {
                    id: 'q_1',
                    title: 'شهادة التأهيل التربوي للتعليم الثانوي التأهيلي',
                    field: 'ديداكتيك وتدريس مادة الرياضيات',
                    institution: 'المركز الجهوي لمهن التربية والتكوين (CRMEF)',
                    year: '2015',
                    grade: 'ميزة حسن جداً',
                    type: 'شهادة تأهيل تربوي ومهني'
                },
                {
                    id: 'q_2',
                    title: 'الإجازة في الدراسات الأساسية (مسلك العلوم الرياضية والتطبيقات SMA)',
                    field: 'الرياضيات البحتة والتطبيقية',
                    institution: 'كلية العلوم - جامعة محمد الخامس',
                    year: '2014',
                    grade: 'ميزة حسن',
                    type: 'شهادة جامعية أكاديمية'
                },
                {
                    id: 'q_3',
                    title: 'شهادة البكالوريا - مسلك العلوم الرياضية (أ)',
                    field: 'العلوم الرياضية والفيزيائية',
                    institution: 'وزارة التربية الوطنية',
                    year: '2011',
                    grade: 'ميزة حسن جداً',
                    type: 'شهادة جامعية أكاديمية'
                },
                {
                    id: 'q_4',
                    title: 'شهادة الكفاءة المهنية للتدريس بالثانوي التأهيلي',
                    field: 'التربية والتكوين - مادة الرياضيات',
                    institution: 'الأكاديمية الجهوية للتربية والتكوين',
                    year: '2016',
                    grade: 'ميزة حسن جداً',
                    type: 'شهادة تأهيل تربوي ومهني'
                }
            ];
        }

        // الإنجازات والأنشطة التربوية والديداكتيكية
        if (!Array.isArray(tp.achievements) || tp.achievements.length === 0) {
            tp.achievements = [
                {
                    id: 'ach_1',
                    title: 'تأطير نادي الرياضيات والأولمبياد المدرسي',
                    category: 'نادي تربوي وتفوق',
                    categoryKey: 'olympiad',
                    date: '2025 - 2026',
                    description: 'إعداد وتأطير فريق المؤسسة في الأولمبياد الوطنية للرياضيات وتحقيق مراتب جهوية متقدمة وتأهل تلميذين للإقصائيات الوطنية.',
                    icon: 'award',
                    color: '#7c3aed'
                },
                {
                    id: 'ach_2',
                    title: 'إنتاج حقيبة ديداكتيكية رقمية تفاعلية ببرمجية GeoGebra ثلاثية الأبعاد',
                    category: 'موارد رقمية وديداكتيك',
                    categoryKey: 'digital',
                    date: '2024 - 2025',
                    description: 'تصميم أكثر من 45 محاكاة تفاعلية ثلاثية الأبعاد وثنائية الأبعاد في الهندسة الفضائية ودراسة الدوال العددية لفائدة تلاميذ الثانية باكالوريا.',
                    icon: 'sparkles',
                    color: '#0284c7'
                },
                {
                    id: 'ach_3',
                    title: 'المشاركة الفعالة في لجان تصحيح الامتحان الوطني الموحد للبكالوريا',
                    category: 'امتحانات إشهادية',
                    categoryKey: 'exam',
                    date: '2023 - 2025',
                    description: 'المشاركة في مراكز التصحيح الإقليمية لعدة دورات عادية واستدراكية، مع تقديم تقرير بيداغوجي تحليلي حول مواطن تعثر المترشحين في المسائل التوليفية.',
                    icon: 'file-check',
                    color: '#059669'
                },
                {
                    id: 'ach_4',
                    title: 'تنظيم برنامج الدعم التربوي المؤسساتي الموجه والمعالجة البيداغوجية',
                    category: 'دعم ومعالجة',
                    categoryKey: 'support',
                    date: '2024 - 2026',
                    description: 'تأطير ورشات المعالجة البيداغوجية الموجهة للتلاميذ المتعثرين في الرياضيات وتحقيق نسبة تحسن ملحوظة في نتائج المراقبة المستمرة بلغت +40%.',
                    icon: 'trending-up',
                    color: '#ea580c'
                },
                {
                    id: 'ach_5',
                    title: 'شهادة تقدير وتكريم من المديرية الإقليمية للتربية والتكوين',
                    category: 'تقدير وتميز',
                    categoryKey: 'honor',
                    date: '2024',
                    description: 'الحصول على شهادة تقديرية تثميناً للمجهودات المتميزة والمبادرات البيداغوجية الرائدة في إدماج الوسائل الرقمية وتطوير تدريس الرياضيات.',
                    icon: 'medal',
                    color: '#e11d48'
                }
            ];
        }

        // محطات المسار المهني والمؤسسات السابقة
        if (!Array.isArray(tp.careerStations) || tp.careerStations.length === 0) {
            tp.careerStations = [
                {
                    id: 'car_1',
                    role: 'أستاذ التعليم الثانوي التأهيلي لمادة الرياضيات',
                    school: tp.school || 'الثانوية التأهيلية الحالية',
                    directorate: tp.directorate || 'المديرية الإقليمية',
                    period: '2020 - حتى الآن',
                    current: true,
                    tasks: 'تدريس مستويات الثانية باكالوريا علوم والأولى باكالوريا، وتنسيق أنشطة مادة الرياضيات بالمؤسسة.'
                },
                {
                    id: 'car_2',
                    role: 'أستاذ التعليم الثانوي التأهيلي',
                    school: 'الثانوية التأهيلية المسيرة الخضراء',
                    directorate: 'المديرية الإقليمية للتربية والتكوين',
                    period: '2015 - 2020',
                    current: false,
                    tasks: 'تدريس الجذوع المشتركة العلمية والأولى باكالوريا، وتنشيط النادي العلمي.'
                }
            ];
        }

        // التكوينات المستمرة والمهارات
        if (!Array.isArray(tp.trainings) || tp.trainings.length === 0) {
            tp.trainings = [
                {
                    id: 'tr_1',
                    title: 'توظيف الذكاء الاصطناعي التوليدي في الديداكتيك الرقمي لمادة الرياضيات',
                    provider: 'المركز الوطني للتجديد التربوي والتجريب',
                    year: '2025',
                    duration: '30 ساعة',
                    hours: 30
                },
                {
                    id: 'tr_2',
                    title: 'استراتيجيات التدريس الصريح وتدبير الفروق الفردية والدعم المتمايز',
                    provider: 'المديرية الإقليمية - مشروع المؤسسة المندمج',
                    year: '2024',
                    duration: '24 ساعة',
                    hours: 24
                },
                {
                    id: 'tr_3',
                    title: 'إنتاج وثائق الامتحانات الموحدة والجذاذات البيداغوجية بنظام LaTeX',
                    provider: 'الجمعية المغربية لأساتذة الرياضيات',
                    year: '2023',
                    duration: '40 ساعة',
                    hours: 40
                },
                {
                    id: 'tr_4',
                    title: 'التقويم التربوي وبناء الأطر المرجعية للامتحانات الإشهادية',
                    provider: 'الأكاديمية الجهوية للتربية والتكوين',
                    year: '2022',
                    duration: '18 ساعة',
                    hours: 18
                }
            ];
        }

        return tp;
    }

    /**
     * استخراج عدد الساعات الرقمي من حقل المدة أو الساعات
     */
    function parseTrainingHours(tr) {
        if (!tr) return 0;
        if (typeof tr.hours === 'number' && !isNaN(tr.hours) && tr.hours > 0) {
            return tr.hours;
        }
        const str = String(tr.duration || tr.year || '');
        const match = str.match(/(\d+(\.\d+)?)/);
        if (match) {
            const val = parseFloat(match[1]);
            // إذا كان الرقم سنة مثل 2024 نتجنبه إلا إذا كان أقل من 500
            if (val > 0 && val < 500) return val;
        }
        return 12; // قيمة افتراضية للدورة التكوينية إذا لم يحدد عدد الساعات
    }

    /**
     * حساب دقيق للأقدمية العامة (سنوات، أشهر، أيام) من تاريخ التوظيف حتى اليوم
     */
    function calculateDetailedSeniority(hireDateStr) {
        if (!hireDateStr) {
            return { years: 0, months: 0, days: 0, decimalYears: 0, formatted: 'غير محدد' };
        }
        try {
            const start = new Date(hireDateStr + 'T00:00:00');
            const end = new Date();
            if (isNaN(start.getTime())) {
                return { years: 0, months: 0, days: 0, decimalYears: 0, formatted: hireDateStr };
            }

            let years = end.getFullYear() - start.getFullYear();
            let months = end.getMonth() - start.getMonth();
            let days = end.getDate() - start.getDate();

            if (days < 0) {
                months -= 1;
                const prevMonthDays = new Date(end.getFullYear(), end.getMonth(), 0).getDate();
                days += prevMonthDays;
            }
            if (months < 0) {
                years -= 1;
                months += 12;
            }
            if (years < 0) {
                years = 0;
                months = 0;
                days = 0;
            }

            let parts = [];
            if (years > 0) parts.push(`${years} ${years === 1 ? 'سنة' : years === 2 ? 'سنتان' : years <= 10 ? 'سنوات' : 'سنة'}`);
            if (months > 0) parts.push(`${months} ${months === 1 ? 'شهر' : months === 2 ? 'شهران' : 'أشهر'}`);
            if (days > 0 && years === 0) parts.push(`${days} يوم`);

            const formatted = parts.length > 0 ? parts.join(' و ') : 'أقل من شهر';
            const decimalYears = Math.max(0, +(years + (months / 12)).toFixed(1));
            return { years, months, days, decimalYears, formatted };
        } catch (e) {
            return { years: 0, months: 0, days: 0, decimalYears: 0, formatted: hireDateStr };
        }
    }

    /**
     * حساب إحصائيات التدريس الحية من واقع قاعدة بيانات التطبيق
     */
    function calculateLiveTeachingStats() {
        const db = window.db || {};
        const classesObj = db.classes || {};
        const archivedClasses = Array.isArray(db.archivedClasses) ? db.archivedClasses : [];
        const classNames = Object.keys(classesObj).filter(c => !archivedClasses.includes(c));

        let totalStudents = 0;
        classNames.forEach(cls => {
            const list = classesObj[cls];
            if (Array.isArray(list)) {
                totalStudents += list.length;
            }
        });

        let completedLessonsCount = 0;
        if (Array.isArray(db.lessonLog)) {
            completedLessonsCount = db.lessonLog.filter(l => l.completed !== false).length;
        }

        let totalExamsCount = 0;
        if (Array.isArray(db.upcomingExams)) {
            totalExamsCount = db.upcomingExams.length;
        }

        let totalMilestonesCount = 0;
        let completedMilestonesCount = 0;
        if (Array.isArray(db.academicMilestones)) {
            totalMilestonesCount = db.academicMilestones.length;
            completedMilestonesCount = db.academicMilestones.filter(m => !!m.isCompleted).length;
        }

        return {
            classesCount: classNames.length,
            studentsCount: totalStudents,
            lessonsCount: completedLessonsCount,
            examsCount: totalExamsCount,
            milestonesCount: totalMilestonesCount,
            completedMilestonesCount
        };
    }

    /**
     * توليد قسم الرسوم البيانية التفاعلية للمسار الوظيفي (Visual Career Analytics)
     * 1. عدد سنوات الخبرة وتفصيل الأقدمية
     * 2. توزيع الشواهد والمؤهلات المحصل عليها (Donut Chart)
     * 3. ساعات التكوين المستمر وتوزيعها الزمني (Bar Chart)
     */
    function renderCareerVisualChartsHtml(tp, seniority, schoolSeniority, gradeSeniority) {
        const escapeHtml = (str) => {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        };

        // -----------------------------------------------------------------
        // 1. بيانات الرسم البياني لسنوات الخبرة والأقدمية
        // -----------------------------------------------------------------
        const totalExpYears = seniority.decimalYears || 1;
        const schoolExpYears = schoolSeniority.decimalYears || 0;
        const gradeExpYears = gradeSeniority.decimalYears || 0;
        const maxRefYears = Math.max(totalExpYears, 15); // مرجع التدرج البصري
        const totalExpPct = Math.min(100, Math.round((totalExpYears / 30) * 100));
        const schoolExpPct = Math.min(100, Math.round((schoolExpYears / Math.max(totalExpYears, 1)) * 100));
        const gradeExpPct = Math.min(100, Math.round((gradeExpYears / Math.max(totalExpYears, 1)) * 100));

        // تحليل سنوات المحطات المهنية
        const stationBars = (tp.careerStations || []).map((st, idx) => {
            const p = String(st.period || '');
            const yearsMatch = p.match(/(\d{4})/g);
            let stYears = 3;
            if (yearsMatch && yearsMatch.length >= 2) {
                stYears = Math.max(1, parseInt(yearsMatch[1], 10) - parseInt(yearsMatch[0], 10));
            } else if (yearsMatch && yearsMatch.length === 1) {
                const startY = parseInt(yearsMatch[0], 10);
                stYears = Math.max(1, new Date().getFullYear() - startY);
            }
            const pct = Math.min(100, Math.round((stYears / Math.max(totalExpYears, 1)) * 100));
            return {
                label: st.school || `محطة ${idx + 1}`,
                period: st.period || '',
                years: stYears,
                pct,
                current: !!st.current
            };
        });

        // -----------------------------------------------------------------
        // 2. بيانات الرسم البياني لتوزيع الشواهد المحصل عليها (Donut Chart)
        // -----------------------------------------------------------------
        const quals = tp.qualifications || [];
        const trainings = tp.trainings || [];
        const achievements = tp.achievements || [];

        let academicCerts = 0; // شواهد جامعية وأكاديمية (إجازة، ماستر، دكتوراه، بكالوريا)
        let pedagogicalCerts = 0; // شواهد التأهيل التربوي والكفاءة المهنية
        quals.forEach(q => {
            const t = ((q.title || '') + ' ' + (q.type || '') + ' ' + (q.institution || '')).toLowerCase();
            if (t.includes('تأهيل') || t.includes('كفاءة') || t.includes('crmef') || t.includes('تربو') || t.includes('مهن')) {
                pedagogicalCerts++;
            } else {
                academicCerts++;
            }
        });

        const trainingCerts = trainings.length; // شواهد التكوين المستمر
        const honorCerts = achievements.filter(a => {
            const t = ((a.title || '') + ' ' + (a.category || '')).toLowerCase();
            return t.includes('شهادة') || t.includes('تقدير') || t.includes('تكريم') || t.includes('أولمبياد') || t.includes('تميز') || a.categoryKey === 'honor' || a.categoryKey === 'olympiad';
        }).length || Math.min(2, achievements.length);

        const certCategories = [
            { label: 'شواهد جامعية وأكاديمية', count: academicCerts, color: '#2563eb', bg: '#eff6ff' },
            { label: 'شواهد التأهيل والكفاءة التربوية', count: pedagogicalCerts, color: '#7c3aed', bg: '#faf5ff' },
            { label: 'شواهد التكوين المستمر', count: trainingCerts, color: '#10b981', bg: '#ecfdf5' },
            { label: 'شواهد التقدير والتميز التربوي', count: honorCerts, color: '#f59e0b', bg: '#fffbeb' }
        ];

        const totalCertificatesCount = certCategories.reduce((sum, c) => sum + c.count, 0) || 1;

        // بناء مقاطع SVG للدائرة الحلقية (Donut Chart)
        const radius = 54;
        const circumference = +(2 * Math.PI * radius).toFixed(2);
        let accumulatedPercent = 0;
        const donutSegmentsSvg = certCategories.map(cat => {
            if (cat.count <= 0) return '';
            const pct = cat.count / totalCertificatesCount;
            const dashLength = +(pct * circumference).toFixed(2);
            const dashOffset = +(-accumulatedPercent * circumference).toFixed(2);
            accumulatedPercent += pct;
            return `<circle cx="70" cy="70" r="${radius}" fill="transparent" stroke="${cat.color}" stroke-width="18" stroke-dasharray="${dashLength} ${circumference}" stroke-dashoffset="${dashOffset}" transform="rotate(-90 70 70)" style="transition: all 0.5s ease;" />`;
        }).join('');

        // -----------------------------------------------------------------
        // 3. بيانات الرسم البياني لساعات التكوين المستمر
        // -----------------------------------------------------------------
        const trainingItemsWithHours = trainings.map((tr, i) => {
            const hrs = parseTrainingHours(tr);
            const yrMatch = String(tr.year || '').match(/\d{4}/);
            const yr = yrMatch ? yrMatch[0] : String(tr.year || (2023 + i));
            return {
                id: tr.id,
                title: tr.title || `دورة ${i + 1}`,
                shortTitle: (tr.title || `دورة ${i + 1}`).split(' ').slice(0, 4).join(' '),
                year: yr,
                provider: tr.provider || '',
                hours: hrs
            };
        });

        const totalTrainingHours = trainingItemsWithHours.reduce((sum, item) => sum + item.hours, 0);
        const maxCourseHours = Math.max(...trainingItemsWithHours.map(item => item.hours), 40);
        const trainingColors = ['#10b981', '#0284c7', '#7c3aed', '#f59e0b', '#ec4899', '#2563eb'];

        // نصف دائرة لمؤشر الخبرة (Radial Gauge)
        const gaugeRadius = 56;
        const gaugeCircumference = +(Math.PI * gaugeRadius).toFixed(2);
        const gaugeProgress = +(Math.min(1, totalExpYears / Math.max(maxRefYears, 20)) * gaugeCircumference).toFixed(2);

        return `
            <!-- قسم الرسوم البيانية التفاعلية لتلخيص المسار الوظيفي بصرياً -->
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 18px; padding: 22px 24px; margin-bottom: 24px; box-shadow: 0 6px 20px -4px rgba(15, 23, 42, 0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1.5px solid #f1f5f9;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg, #2563eb, #7c3aed); color: #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);">
                            <span data-lucide="bar-chart-3" data-size="20"></span>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 1.1rem; font-weight: 900; color: #0f172a;">التحليل البصري والرسوم البيانية للمسار الوظيفي</h3>
                            <div style="font-size: 0.78rem; color: #64748b; font-weight: 600;">مؤشرات بيانية حية لسنوات الخبرة والأقدمية، توزيع الشواهد المحصل عليها، وساعات التكوين المستمر</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                        <span style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-size: 0.74rem; font-weight: 800; padding: 5px 10px; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px;">
                            <span data-lucide="clock" data-size="13"></span>
                            <span>الخبرة: ${seniority.years} سنة و ${seniority.months} شهر</span>
                        </span>
                        <span style="background: #faf5ff; color: #6d28d9; border: 1px solid #ddd6fe; font-size: 0.74rem; font-weight: 800; padding: 5px 10px; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px;">
                            <span data-lucide="graduation-cap" data-size="13"></span>
                            <span>إجمالي الشواهد: ${totalCertificatesCount} شواهد</span>
                        </span>
                        <span style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 0.74rem; font-weight: 800; padding: 5px 10px; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px;">
                            <span data-lucide="timer" data-size="13"></span>
                            <span>التكوين المستمر: ${totalTrainingHours} ساعة</span>
                        </span>
                        <button type="button" onclick="window.exportTeacherProfilePDF()" style="background: linear-gradient(135deg, #dc2626, #b91c1c); color: #ffffff; border: none; font-size: 0.75rem; font-weight: 800; padding: 6px 12px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(220, 38, 38, 0.25);" title="تصدير الملف المهني بصيغة PDF شاملاً المعلومات الشخصية والرسوم البيانية والمسار">
                            <span data-lucide="file-down" data-size="14"></span>
                            <span>تصدير الملف المهني بصيغة PDF</span>
                        </button>
                    </div>
                </div>

                <!-- شبكة الرسوم البيانية الثلاثة -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                    
                    <!-- 1. الرسم البياني لسنوات الخبرة والأقدمية -->
                    <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 16px 18px; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <div style="font-weight: 900; font-size: 0.92rem; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                                    <span style="width: 10px; height: 10px; border-radius: 50%; background: #2563eb; display: inline-block;"></span>
                                    <span>1. مؤشر سنوات الخبرة والأقدمية</span>
                                </div>
                                <button type="button" onclick="window.openEditTeacherProfileModal('info')" style="background: #ffffff; border: 1px solid #cbd5e1; color: #2563eb; font-size: 0.7rem; font-weight: 800; padding: 2px 8px; border-radius: 6px; cursor: pointer;">تحديث</button>
                            </div>

                            <!-- عداد نصف دائري + ملخص رقمي -->
                            <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 14px; background: #ffffff; padding: 10px 12px; border-radius: 12px; border: 1px solid #e2e8f0;">
                                <div style="position: relative; width: 130px; height: 78px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                                    <svg width="130" height="78" viewBox="0 0 130 78">
                                        <path d="M 9 68 A 56 56 0 0 1 121 68" fill="none" stroke="#e2e8f0" stroke-width="12" stroke-linecap="round" />
                                        <path d="M 9 68 A 56 56 0 0 1 121 68" fill="none" stroke="url(#expGrad)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${gaugeProgress} ${gaugeCircumference}" />
                                        <defs>
                                            <linearGradient id="expGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                                <stop offset="0%" stop-color="#2563eb" />
                                                <stop offset="100%" stop-color="#06b6d4" />
                                            </linearGradient>
                                        </defs>
                                    </svg>
                                    <div style="position: absolute; bottom: 4px; text-align: center;">
                                        <div style="font-size: 1.25rem; font-weight: 900; color: #0f172a; line-height: 1;">${seniority.years}<span style="font-size: 0.72rem; color: #2563eb;"> سنة</span></div>
                                        <div style="font-size: 0.65rem; color: #64748b; font-weight: 700;">منذ ${escapeHtml((tp.hireDate || '').slice(0, 4) || 'التوظيف')}</div>
                                    </div>
                                </div>
                                <div style="flex: 1; font-size: 0.76rem; display: flex; flex-direction: column; gap: 6px;">
                                    <div>
                                        <div style="display: flex; justify-content: space-between; font-weight: 800; color: #1e293b; margin-bottom: 2px;">
                                            <span>الأقدمية العامة بالقطاع</span>
                                            <span style="color: #2563eb;">${seniority.decimalYears} سنة</span>
                                        </div>
                                        <div style="height: 6px; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
                                            <div style="width: ${Math.max(15, totalExpPct)}%; height: 100%; background: linear-gradient(90deg, #2563eb, #3b82f6); border-radius: 999px;"></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div style="display: flex; justify-content: space-between; font-weight: 800; color: #1e293b; margin-bottom: 2px;">
                                            <span>الأقدمية بالمؤسسة الحالية</span>
                                            <span style="color: #0284c7;">${schoolSeniority.decimalYears} سنة</span>
                                        </div>
                                        <div style="height: 6px; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
                                            <div style="width: ${Math.max(10, schoolExpPct)}%; height: 100%; background: linear-gradient(90deg, #0284c7, #38bdf8); border-radius: 999px;"></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div style="display: flex; justify-content: space-between; font-weight: 800; color: #1e293b; margin-bottom: 2px;">
                                            <span>الأقدمية في الدرجة (${escapeHtml((tp.scale || 'السلم 11').split('-')[0].trim())})</span>
                                            <span style="color: #7c3aed;">${gradeSeniority.decimalYears} سنة</span>
                                        </div>
                                        <div style="height: 6px; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
                                            <div style="width: ${Math.max(10, gradeExpPct)}%; height: 100%; background: linear-gradient(90deg, #7c3aed, #a855f7); border-radius: 999px;"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- توزيع الخبرة عبر المحطات المهنية -->
                            <div style="font-size: 0.74rem; font-weight: 800; color: #475569; margin-bottom: 6px;">توزيع الخبرة حسب المؤسسات التعليمية:</div>
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                ${stationBars.slice(0, 3).map(st => `
                                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 10px;">
                                        <div style="display: flex; justify-content: space-between; font-size: 0.74rem; font-weight: 800; color: #0f172a; margin-bottom: 3px;">
                                            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 170px;">🏫 ${escapeHtml(st.label)}</span>
                                            <span style="color: ${st.current ? '#2563eb' : '#64748b'}; font-family: monospace;">${st.years} سنوات (${escapeHtml(st.period)})</span>
                                        </div>
                                        <div style="height: 5px; background: #f1f5f9; border-radius: 999px; overflow: hidden;">
                                            <div style="width: ${Math.max(12, st.pct)}%; height: 100%; background: ${st.current ? '#2563eb' : '#64748b'}; border-radius: 999px;"></div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <!-- 2. الرسم البياني الدائري لتوزيع الشواهد المحصل عليها -->
                    <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 16px 18px; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <div style="font-weight: 900; font-size: 0.92rem; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                                    <span style="width: 10px; height: 10px; border-radius: 50%; background: #7c3aed; display: inline-block;"></span>
                                    <span>2. توزيع الشواهد والمؤهلات المحصل عليها</span>
                                </div>
                                <button type="button" onclick="window.openEditTeacherProfileModal('qualifications')" style="background: #ffffff; border: 1px solid #cbd5e1; color: #7c3aed; font-size: 0.7rem; font-weight: 800; padding: 2px 8px; border-radius: 6px; cursor: pointer;">+ شهادة</button>
                            </div>

                            <div style="display: flex; align-items: center; gap: 16px; background: #ffffff; padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 12px;">
                                <!-- Donut SVG -->
                                <div style="position: relative; width: 140px; height: 140px; flex-shrink: 0;">
                                    <svg width="140" height="140" viewBox="0 0 140 140">
                                        <circle cx="70" cy="70" r="${radius}" fill="transparent" stroke="#f1f5f9" stroke-width="18" />
                                        ${donutSegmentsSvg}
                                    </svg>
                                    <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; pointer-events: none;">
                                        <span style="font-size: 1.45rem; font-weight: 900; color: #0f172a; line-height: 1;">${totalCertificatesCount}</span>
                                        <span style="font-size: 0.68rem; font-weight: 800; color: #64748b; margin-top: 2px;">إجمالي الشواهد</span>
                                    </div>
                                </div>

                                <!-- مفتاح الرسم البياني الدائري -->
                                <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
                                    ${certCategories.map(cat => {
                                        const pct = Math.round((cat.count / totalCertificatesCount) * 100);
                                        return `
                                            <div style="display: flex; flex-direction: column; gap: 2px;">
                                                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.74rem; font-weight: 800; color: #1e293b;">
                                                    <span style="display: flex; align-items: center; gap: 5px;">
                                                        <span style="width: 8px; height: 8px; border-radius: 2px; background: ${cat.color}; display: inline-block;"></span>
                                                        <span>${cat.label}</span>
                                                    </span>
                                                    <span style="color: ${cat.color}; font-family: monospace;">${cat.count} (${pct}%)</span>
                                                </div>
                                                <div style="height: 4px; background: #f1f5f9; border-radius: 999px; overflow: hidden;">
                                                    <div style="width: ${pct}%; height: 100%; background: ${cat.color}; border-radius: 999px;"></div>
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        </div>

                        <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 8px 12px; font-size: 0.74rem; color: #5b21b6; font-weight: 700; display: flex; justify-content: space-between; align-items: center;">
                            <span>🏅 أعلى مؤهل مسجل:</span>
                            <strong style="color: #4c1d95;">${escapeHtml(quals[0] ? quals[0].title.slice(0, 34) : 'شهادة التأهيل التربوي')}</strong>
                        </div>
                    </div>

                    <!-- 3. الرسم البياني لساعات التكوين المستمر -->
                    <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 16px 18px; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <div style="font-weight: 900; font-size: 0.92rem; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                                    <span style="width: 10px; height: 10px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
                                    <span>3. ساعات التكوين المستمر وتطور الكفايات</span>
                                </div>
                                <button type="button" onclick="window.openEditTeacherProfileModal('trainings')" style="background: #ffffff; border: 1px solid #cbd5e1; color: #059669; font-size: 0.7rem; font-weight: 800; padding: 2px 8px; border-radius: 6px; cursor: pointer;">+ دورة</button>
                            </div>

                            <!-- بطاقة إجمالي الساعات -->
                            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-size: 0.72rem; color: #64748b; font-weight: 700;">مجموع الساعات التكوينية المعتمدة</div>
                                    <div style="font-size: 1.3rem; font-weight: 900; color: #059669;">${totalTrainingHours} ساعة تدريبية</div>
                                </div>
                                <div style="text-align: left;">
                                    <span style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 0.72rem; font-weight: 800; padding: 3px 8px; border-radius: 6px;">
                                        ${trainingItemsWithHours.length} دورات مؤطرة
                                    </span>
                                    <div style="font-size: 0.68rem; color: #64748b; margin-top: 3px; font-weight: 600;">
                                        معدل: ${trainingItemsWithHours.length ? Math.round(totalTrainingHours / trainingItemsWithHours.length) : 0} س / دورة
                                    </div>
                                </div>
                            </div>

                            <!-- الأعمدة البيانية لساعات كل دورة تكوينية حسب السنة -->
                            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 10px 8px 10px; margin-bottom: 10px;">
                                <div style="display: flex; align-items: flex-end; justify-content: space-around; height: 105px; gap: 8px; padding-bottom: 6px; border-bottom: 1.5px solid #cbd5e1;">
                                    ${trainingItemsWithHours.slice(0, 6).map((item, idx) => {
                                        const barHeightPx = Math.max(18, Math.round((item.hours / maxCourseHours) * 72));
                                        const barColor = trainingColors[idx % trainingColors.length];
                                        return `
                                            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%;" title="${escapeHtml(item.title)} (${item.hours} ساعة - ${escapeHtml(item.provider)})">
                                                <span style="font-size: 0.68rem; font-weight: 900; color: ${barColor}; margin-bottom: 3px; font-family: monospace;">${item.hours}س</span>
                                                <div style="width: 100%; max-width: 34px; height: ${barHeightPx}px; background: linear-gradient(180deg, ${barColor}, ${barColor}cc); border-radius: 6px 6px 2px 2px; transition: height 0.4s ease; box-shadow: 0 2px 6px ${barColor}33;"></div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                                <div style="display: flex; justify-content: space-around; gap: 8px; padding-top: 6px;">
                                    ${trainingItemsWithHours.slice(0, 6).map((item) => `
                                        <div style="flex: 1; text-align: center; font-size: 0.68rem; font-weight: 800; color: #475569; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(item.title)}">
                                            ${escapeHtml(item.year)}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>

                        <div style="background: #ecfdf5; border: 1px solid #bbf7d0; border-radius: 8px; padding: 8px 12px; font-size: 0.74rem; color: #065f46; font-weight: 700; display: flex; justify-content: space-between; align-items: center;">
                            <span>📈 مؤشر الكفاية المهنية المستمرة:</span>
                            <strong>${Math.min(100, Math.round((totalTrainingHours / 100) * 100))}% من الهدف المرجعي (100س)</strong>
                        </div>
                    </div>

                </div>
            </div>
        `;
    }

    /**
     * بناء ورسم صفحة الملف المهني للأستاذ
     */
    function renderTeacherProfileView() {
        const mount = document.getElementById('teacherProfileMount');
        if (!mount) return;

        try {
            const tp = getTeacherProfile();
        const seniority = calculateDetailedSeniority(tp.hireDate);
        const schoolSeniority = calculateDetailedSeniority(tp.schoolSeniorityDate || tp.hireDate);
        const gradeSeniority = calculateDetailedSeniority(tp.gradeDate || tp.hireDate);
        const stats = calculateLiveTeachingStats();

        const escapeHtml = (str) => {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        };

        // تحديد الصورة المعروضة في الإطار الرئيسي والشعار المؤسساتي
        const hasAvatar = !!(tp.avatarDataUrl && tp.avatarDataUrl.startsWith('data:image'));
        const hasSchoolLogo = !!(tp.schoolLogoDataUrl && tp.schoolLogoDataUrl.startsWith('data:image'));

        let avatarContentHtml = '';
        if (hasAvatar) {
            avatarContentHtml = `<img src="${tp.avatarDataUrl}" alt="صورة الأستاذ" style="width: 100%; height: 100%; object-fit: cover; border-radius: 20px;" />`;
        } else if (hasSchoolLogo && tp.primaryHeaderImage === 'logo') {
            avatarContentHtml = `<img src="${tp.schoolLogoDataUrl}" alt="شعار المؤسسة" style="width: 100%; height: 100%; object-fit: contain; background: #ffffff; padding: 6px; box-sizing: border-box; border-radius: 20px;" />`;
        } else {
            avatarContentHtml = `<span>${tp.name ? tp.name.trim().charAt(0) : 'أ'}</span>`;
        }

        let html = `
            <div class="teacher-profile-wrapper" style="direction: rtl; text-align: right; font-family: inherit; color: #1e293b; padding-bottom: 40px;">
                
                <!-- 1. ترويسة الملف الشخصي المطورة للأستاذ (Hero Header) بتنظيم وتناسق كامل للأيقونات والأزرار -->
                <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #0f172a 100%); border: 1.5px solid #334155; border-radius: 22px; padding: 22px 28px 26px 28px; color: #ffffff; margin-bottom: 24px; box-shadow: 0 12px 32px -6px rgba(15, 23, 42, 0.45); position: relative; overflow: hidden;">
                    <!-- إضاءات خلفية هادئة -->
                    <div style="position: absolute; top: -60px; left: -60px; width: 240px; height: 240px; border-radius: 50%; background: radial-gradient(circle, rgba(37,99,235,0.24) 0%, transparent 70%); pointer-events: none;"></div>
                    <div style="position: absolute; bottom: -70px; right: 12%; width: 260px; height: 260px; border-radius: 50%; background: radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%); pointer-events: none;"></div>

                    <!-- الشريط العلوي للترويسة: الهوية المؤسساتية + شريط الأيقونات السريعة المتناسقة -->
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; padding-bottom: 16px; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); position: relative; z-index: 2;">
                        <!-- شارة الانتماء المؤسساتي والوضعية الإدارية -->
                        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <div style="display: inline-flex; align-items: center; gap: 7px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.14); padding: 5px 12px; border-radius: 999px; font-size: 0.75rem; font-weight: 800; color: #e2e8f0;">
                                <span style="width: 22px; height: 22px; border-radius: 50%; background: rgba(37,99,235,0.35); color: #93c5fd; display: inline-flex; align-items: center; justify-content: center;">
                                    <span data-lucide="landmark" data-size="13"></span>
                                </span>
                                <span>${escapeHtml(tp.academy || 'الأكاديمية الجهوية للتربية والتكوين')}</span>
                            </div>
                            <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(16,185,129,0.14); border: 1px solid rgba(16,185,129,0.35); padding: 5px 12px; border-radius: 999px; font-size: 0.74rem; font-weight: 800; color: #6ee7b7;">
                                <span style="width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,0.25);"></span>
                                <span>وضعية نظامية: مزاول(ة) للعمل</span>
                            </div>
                            <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); padding: 5px 11px; border-radius: 999px; font-size: 0.74rem; font-weight: 700; color: #cbd5e1;">
                                <span data-lucide="calendar-check" data-size="13" style="color: #38bdf8;"></span>
                                <span>الموسم الدراسي: ${escapeHtml(tp.academicYear || '2026 / 2027')}</span>
                            </div>
                        </div>

                        <!-- شريط أيقونات الوصول السريع المنظم والمتناسق (Quick Section Icons Toolbar) -->
                        <div style="display: flex; align-items: center; gap: 6px; background: rgba(15,23,42,0.55); border: 1px solid rgba(255,255,255,0.12); padding: 4px 6px; border-radius: 12px;">
                            <span style="font-size: 0.7rem; font-weight: 800; color: #94a3b8; padding: 0 6px;">وصول سريع:</span>
                            <button type="button" onclick="window.openEditTeacherProfileModal('info')" title="البيانات الإدارية والتوظيف" style="width: 32px; height: 32px; border-radius: 8px; background: rgba(37,99,235,0.2); border: 1px solid rgba(59,130,246,0.35); color: #93c5fd; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease;">
                                <span data-lucide="id-card" data-size="15"></span>
                            </button>
                            <button type="button" onclick="window.openEditTeacherProfileModal('qualifications')" title="الشواهد والمؤهلات الجامعية" style="width: 32px; height: 32px; border-radius: 8px; background: rgba(124,58,237,0.2); border: 1px solid rgba(168,85,247,0.35); color: #d8b4fe; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease;">
                                <span data-lucide="graduation-cap" data-size="15"></span>
                            </button>
                            <button type="button" onclick="window.openEditTeacherProfileModal('career')" title="المسار الوظيفي والمؤسسات" style="width: 32px; height: 32px; border-radius: 8px; background: rgba(2,132,199,0.2); border: 1px solid rgba(56,189,248,0.35); color: #7dd3fc; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease;">
                                <span data-lucide="briefcase" data-size="15"></span>
                            </button>
                            <button type="button" onclick="window.openEditTeacherProfileModal('trainings')" title="دورات التكوين المستمر" style="width: 32px; height: 32px; border-radius: 8px; background: rgba(16,185,129,0.2); border: 1px solid rgba(52,211,153,0.35); color: #6ee7b7; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease;">
                                <span data-lucide="sparkles" data-size="15"></span>
                            </button>
                            <button type="button" onclick="window.openEditTeacherProfileModal('achievements')" title="الإنجازات التربوية والأنشطة" style="width: 32px; height: 32px; border-radius: 8px; background: rgba(245,158,11,0.2); border: 1px solid rgba(251,191,36,0.35); color: #fde68a; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease;">
                                <span data-lucide="award" data-size="15"></span>
                            </button>
                            <button type="button" onclick="window.openTeacherPhotoLogoModal()" title="تحديث الصورة الشخصية وشعار المؤسسة" style="width: 32px; height: 32px; border-radius: 8px; background: rgba(14,165,233,0.2); border: 1px solid rgba(56,189,248,0.35); color: #bae6fd; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease;">
                                <span data-lucide="camera" data-size="15"></span>
                            </button>
                        </div>
                    </div>

                    <!-- الصف الرئيسي للترويسة: الهوية البصرية المزدوجة + المعلومات المهنية + لوحة الأزرار المتناسقة -->
                    <div style="display: flex; justify-content: space-between; align-items: stretch; flex-wrap: wrap; gap: 22px; position: relative; z-index: 2;">
                        
                        <!-- الجانب الأيمن: الإطار المزدوج (الصورة الشخصية + شعار المؤسسة) والبيانات التعريفية -->
                        <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap; flex: 1; min-width: 300px;">
                            
                            <!-- وحدة الهوية البصرية المتناسقة (الأفاتار + شعار المؤسسة) -->
                            <div style="display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); padding: 10px; border-radius: 22px;">
                                <!-- إطار الصورة الشخصية للأستاذ -->
                                <div style="position: relative;">
                                    <div onclick="window.openTeacherPhotoLogoModal()" title="انقر لتحميل أو تغيير الصورة الشخصية للأستاذ" style="width: 88px; height: 88px; border-radius: 18px; background: linear-gradient(135deg, #2563eb, #7c3aed); display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 20px rgba(37, 99, 235, 0.4); border: 2.5px solid rgba(255,255,255,0.3); font-size: 2.1rem; color: #ffffff; font-weight: 900; cursor: pointer; overflow: hidden;">
                                        ${avatarContentHtml}
                                    </div>
                                    <button type="button" onclick="window.openTeacherPhotoLogoModal()" title="تغيير الصورة الشخصية" style="position: absolute; bottom: -5px; left: -5px; background: #2563eb; color: #ffffff; border: 2px solid #0f172a; width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 3px 8px rgba(0,0,0,0.4);">
                                        <span data-lucide="camera" data-size="13"></span>
                                    </button>
                                </div>

                                <!-- إطار شعار المؤسسة التعليمية (متناسق دائماً بجوار الصورة الشخصية) -->
                                <div onclick="window.openTeacherPhotoLogoModal()" title="شعار المؤسسة التعليمية (انقر للتحميل أو التغيير)" style="width: 80px; height: 88px; border-radius: 18px; background: ${hasSchoolLogo ? '#ffffff' : 'rgba(255,255,255,0.06)'}; border: 2px ${hasSchoolLogo ? 'solid rgba(255,255,255,0.4)' : 'dashed rgba(255,255,255,0.25)'}; padding: 6px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2); transition: all 0.2s ease;">
                                    ${hasSchoolLogo ? `
                                        <img src="${tp.schoolLogoDataUrl}" alt="شعار المؤسسة" style="max-width: 100%; max-height: 54px; object-fit: contain;" />
                                        <span style="font-size: 0.56rem; font-weight: 800; color: #1e293b; margin-top: 3px; white-space: nowrap;">شعار المؤسسة</span>
                                    ` : `
                                        <div style="width: 34px; height: 34px; border-radius: 10px; background: rgba(14,165,233,0.2); color: #7dd3fc; display: flex; align-items: center; justify-content: center; margin-bottom: 4px;">
                                            <span data-lucide="school" data-size="18"></span>
                                        </div>
                                        <span style="font-size: 0.58rem; font-weight: 800; color: #cbd5e1; text-align: center; line-height: 1.2;">+ شعار المؤسسة</span>
                                    `}
                                </div>
                            </div>

                            <!-- تفاصيل الاسم والرتبة والمؤسسة بأيقونات متناسقة -->
                            <div style="flex: 1; min-width: 240px;">
                                <!-- السطر 1: الاسم والدرجة والسلم -->
                                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
                                    <h1 style="margin: 0; font-size: 1.55rem; font-weight: 900; color: #ffffff; letter-spacing: -0.4px;">
                                        ${escapeHtml(tp.name)}
                                    </h1>
                                    ${tp.nameFr ? `
                                        <span style="font-size: 0.78rem; font-weight: 700; color: #94a3b8; font-family: sans-serif; background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 6px;">
                                            ${escapeHtml(tp.nameFr)}
                                        </span>
                                    ` : ''}
                                    <span style="background: rgba(37,99,235,0.25); border: 1px solid rgba(59,130,246,0.5); color: #93c5fd; font-size: 0.74rem; font-weight: 800; padding: 3px 10px; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px;">
                                        <span data-lucide="user-check" data-size="13"></span>
                                        <span>${escapeHtml(tp.framework || 'أستاذ التعليم الثانوي التأهيلي')}</span>
                                    </span>
                                    <span style="background: rgba(124,58,237,0.25); border: 1px solid rgba(168,85,247,0.5); color: #d8b4fe; font-size: 0.74rem; font-weight: 800; padding: 3px 10px; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px;">
                                        <span data-lucide="shield-check" data-size="13"></span>
                                        <span>${escapeHtml(tp.scale || 'السلم 11')}</span>
                                    </span>
                                </div>

                                <!-- السطر 2: التخصص والمؤسسة والمديرية بأيقونات موحدة -->
                                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;">
                                    <div style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.84rem; color: #e2e8f0; font-weight: 700; background: rgba(255,255,255,0.06); padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
                                        <span data-lucide="book-open" data-size="14" style="color: #60a5fa;"></span>
                                        <span>${escapeHtml(tp.specialty || 'مادة الرياضيات')}</span>
                                    </div>
                                    <div style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.84rem; color: #e2e8f0; font-weight: 700; background: rgba(255,255,255,0.06); padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
                                        <span data-lucide="school" data-size="14" style="color: #34d399;"></span>
                                        <span>${escapeHtml(tp.school || 'المؤسسة التعليمية')}</span>
                                    </div>
                                    <div style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.84rem; color: #e2e8f0; font-weight: 700; background: rgba(255,255,255,0.06); padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
                                        <span data-lucide="map-pin" data-size="14" style="color: #f472b6;"></span>
                                        <span>${escapeHtml(tp.directorate || 'المديرية الإقليمية')}</span>
                                    </div>
                                </div>

                                <!-- السطر 3: المعرفات الإدارية والأقدمية -->
                                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                    <span style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.16); color: #f1f5f9; font-size: 0.73rem; font-weight: 700; padding: 3px 9px; border-radius: 7px; display: inline-flex; align-items: center; gap: 5px; font-family: monospace;">
                                        <span data-lucide="hash" data-size="12" style="color: #93c5fd;"></span>
                                        <span>رقم التأجير (PPR): ${escapeHtml(tp.ppr || 'غير محدد')}</span>
                                    </span>
                                    ${tp.cin ? `
                                        <span style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.16); color: #f1f5f9; font-size: 0.73rem; font-weight: 700; padding: 3px 9px; border-radius: 7px; display: inline-flex; align-items: center; gap: 5px; font-family: monospace;">
                                            <span data-lucide="credit-card" data-size="12" style="color: #c4b5fd;"></span>
                                            <span>ب.ت.و: ${escapeHtml(tp.cin)}</span>
                                        </span>
                                    ` : ''}
                                    <span style="background: rgba(16,185,129,0.18); border: 1px solid rgba(16,185,129,0.4); color: #6ee7b7; font-size: 0.73rem; font-weight: 800; padding: 3px 10px; border-radius: 7px; display: inline-flex; align-items: center; gap: 5px;">
                                        <span data-lucide="clock" data-size="12"></span>
                                        <span>الأقدمية العامة: ${seniority.formatted}</span>
                                    </span>
                                    ${tp.echelon ? `
                                        <span style="background: rgba(245,158,11,0.18); border: 1px solid rgba(245,158,11,0.4); color: #fde68a; font-size: 0.73rem; font-weight: 800; padding: 3px 10px; border-radius: 7px; display: inline-flex; align-items: center; gap: 5px;">
                                            <span data-lucide="layers" data-size="12"></span>
                                            <span>${escapeHtml(tp.echelon)}</span>
                                        </span>
                                    ` : ''}
                                </div>
                            </div>
                        </div>

                        <!-- الجانب الأيسر: شبكة الأزرار الرئيسية المنظمة والمتناسقة شاملة زر تصدير PDF الرسمي -->
                        <div style="display: flex; flex-direction: column; justify-content: center; gap: 8px; min-width: 280px; background: rgba(15,23,42,0.45); border: 1px solid rgba(255,255,255,0.1); padding: 12px; border-radius: 16px;">
                            <!-- الزر الرسمي البارز: تصدير الملف المهني بصيغة PDF -->
                            <button type="button" onclick="window.exportTeacherProfilePDF()" style="width: 100%; height: 42px; background: linear-gradient(135deg, #e11d48, #be123c); color: #ffffff; border: 1px solid rgba(255,255,255,0.25); padding: 0 14px; border-radius: 10px; font-weight: 900; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 14px rgba(225, 29, 72, 0.4); transition: transform 0.15s ease;" title="تصدير الملف المهني بصيغة PDF يجمع المعلومات الشخصية والرسوم البيانية للخبرة والمسار في وثيقة رسمية">
                                <span style="width: 24px; height: 24px; border-radius: 6px; background: rgba(255,255,255,0.18); display: inline-flex; align-items: center; justify-content: center;">
                                    <span data-lucide="file-down" data-size="15"></span>
                                </span>
                                <span>تصدير الملف المهني بصيغة PDF</span>
                            </button>

                            <!-- صف الأزرار المساندة المتناسقة (2×2) -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                <button type="button" onclick="window.openEditTeacherProfileModal('info')" style="height: 38px; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; border: 1px solid rgba(255,255,255,0.18); padding: 0 10px; border-radius: 9px; font-weight: 800; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 3px 10px rgba(37,99,235,0.3); white-space: nowrap;" title="تعديل البيانات الإدارية وتاريخ التوظيف">
                                    <span data-lucide="edit-3" data-size="14"></span>
                                    <span>تعديل الملف</span>
                                </button>

                                <button type="button" onclick="window.openTeacherPhotoLogoModal()" style="height: 38px; background: linear-gradient(135deg, #0ea5e9, #0284c7); color: #ffffff; border: 1px solid rgba(255,255,255,0.18); padding: 0 10px; border-radius: 9px; font-weight: 800; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 3px 10px rgba(2,132,199,0.3); white-space: nowrap;" title="تحميل الصورة الشخصية أو شعار المؤسسة">
                                    <span data-lucide="camera" data-size="14"></span>
                                    <span>الصورة / الشعار</span>
                                </button>

                                <button type="button" onclick="window.openEditTeacherProfileModal('achievements')" style="height: 38px; background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #ffffff; border: 1px solid rgba(255,255,255,0.18); padding: 0 10px; border-radius: 9px; font-weight: 800; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 3px 10px rgba(124,58,237,0.3); white-space: nowrap;" title="إضافة إنجاز تربوي أو شهادة">
                                    <span data-lucide="plus-circle" data-size="14"></span>
                                    <span>إضافة إنجاز</span>
                                </button>

                                <button type="button" onclick="window.printTeacherProfessionalProfile()" style="height: 38px; background: rgba(255,255,255,0.12); color: #ffffff; border: 1px solid rgba(255,255,255,0.24); padding: 0 10px; border-radius: 9px; font-weight: 800; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap;" title="طباعة البطاقة المهنية مباشرة">
                                    <span data-lucide="printer" data-size="14"></span>
                                    <span>طباعة رسمية</span>
                                </button>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- 2. شبكة المؤشرات الإحصائية الحية (KPI Cards) -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 24px;">
                    <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 16px 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); border-right: 5px solid #2563eb;">
                        <div style="font-size: 0.76rem; font-weight: 800; color: #64748b; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                            <span data-lucide="history" data-size="15" style="color: #2563eb;"></span>
                            <span>تاريخ التوظيف الرسمي</span>
                        </div>
                        <div style="font-size: 1.25rem; font-weight: 900; color: #0f172a; margin-bottom: 2px;">
                            ${escapeHtml(tp.hireDate || 'غير محدد')}
                        </div>
                        <div style="font-size: 0.74rem; font-weight: 700; color: #2563eb;">
                            الأقدمية: ${seniority.formatted}
                        </div>
                    </div>

                    <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 16px 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); border-right: 5px solid #10b981;">
                        <div style="font-size: 0.76rem; font-weight: 800; color: #64748b; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                            <span data-lucide="users" data-size="15" style="color: #10b981;"></span>
                            <span>الأقسام المسندة للموسم</span>
                        </div>
                        <div style="font-size: 1.25rem; font-weight: 900; color: #0f172a; margin-bottom: 2px;">
                            ${stats.classesCount} أقسام مسندة
                        </div>
                        <div style="font-size: 0.74rem; font-weight: 700; color: #059669;">
                            إجمالي التلاميذ: ${stats.studentsCount} تلميذ
                        </div>
                    </div>

                    <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 16px 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); border-right: 5px solid #7c3aed;">
                        <div style="font-size: 0.76rem; font-weight: 800; color: #64748b; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                            <span data-lucide="award" data-size="15" style="color: #7c3aed;"></span>
                            <span>الإنجازات والأنشطة الموثقة</span>
                        </div>
                        <div style="font-size: 1.25rem; font-weight: 900; color: #0f172a; margin-bottom: 2px;">
                            ${tp.achievements ? tp.achievements.length : 0} إنجازات تعليمية
                        </div>
                        <div style="font-size: 0.74rem; font-weight: 700; color: #6d28d9;">
                            أولمبياد وموارد رقمية ودعم
                        </div>
                    </div>

                    <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 16px 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); border-right: 5px solid #f59e0b;">
                        <div style="font-size: 0.76rem; font-weight: 800; color: #64748b; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                            <span data-lucide="book-check" data-size="15" style="color: #f59e0b;"></span>
                            <span>حصص وفروض الموسم</span>
                        </div>
                        <div style="font-size: 1.25rem; font-weight: 900; color: #0f172a; margin-bottom: 2px;">
                            ${stats.lessonsCount} حصة موثقة
                        </div>
                        <div style="font-size: 0.74rem; font-weight: 700; color: #d97706;">
                            ${stats.examsCount} فروض مبرمجة ومحققة
                        </div>
                    </div>
                </div>

                <!-- 2.5. الرسوم البيانية التفاعلية للمسار الوظيفي (الخبرة، الشواهد، ساعات التكوين المستمر) -->
                ${renderCareerVisualChartsHtml(tp, seniority, schoolSeniority, gradeSeniority)}

                <!-- 3. النبذة التعريفية وفلسفة التدريس (Bio Card) -->
                ${tp.bio ? `
                    <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 16px 20px; margin-bottom: 24px; display: flex; align-items: flex-start; gap: 14px;">
                        <div style="width: 40px; height: 40px; border-radius: 10px; background: #eff6ff; border: 1px solid #bfdbfe; color: #2563eb; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <span data-lucide="quote" data-size="20"></span>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 0.82rem; font-weight: 800; color: #475569; margin-bottom: 4px;">النبذة المهنية وفلسفة تدريس مادة الرياضيات:</div>
                            <p style="margin: 0; font-size: 0.92rem; color: #1e293b; line-height: 1.6; font-weight: 600;">
                                ${escapeHtml(tp.bio)}
                            </p>
                        </div>
                        <button type="button" onclick="window.openEditTeacherProfileModal('info')" style="background: transparent; border: 1px solid #cbd5e1; color: #475569; padding: 5px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer; white-space: nowrap;">
                            تعديل النبذة
                        </button>
                    </div>
                ` : ''}

                <!-- 4. الشبكة الرئيسية المكونة من عمودين للبيانات والإنجازات -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 24px; margin-bottom: 24px;">
                    
                    <!-- العمود الأيمن: البطاقة الإدارية ومسار التوظيف -->
                    <div style="display: flex; flex-direction: column; gap: 24px;">
                        
                        <!-- بطاقة البيانات الإدارية والوظيفية -->
                        <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                            <div style="padding: 14px 20px; background: #f8fafc; border-bottom: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span data-lucide="badge-info" data-size="18" style="color: #2563eb;"></span>
                                    <h3 style="margin: 0; font-size: 1rem; font-weight: 900; color: #0f172a;">الوضعية الإدارية والوظيفية</h3>
                                </div>
                                <button type="button" onclick="window.openEditTeacherProfileModal('info')" style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer;">
                                    ✏️ تعديل
                                </button>
                            </div>

                            <div style="padding: 18px 20px;">
                                <table style="width: 100%; border-collapse: collapse; font-size: 0.86rem;">
                                    <tbody>
                                        <tr style="border-bottom: 1px solid #f1f5f9;">
                                            <td style="padding: 8px 0; color: #64748b; font-weight: 700; width: 40%;">الاسم الكامل:</td>
                                            <td style="padding: 8px 0; font-weight: 800; color: #0f172a;">${escapeHtml(tp.name)} ${tp.nameFr ? `(${escapeHtml(tp.nameFr)})` : ''}</td>
                                        </tr>
                                        <tr style="border-bottom: 1px solid #f1f5f9;">
                                            <td style="padding: 8px 0; color: #64748b; font-weight: 700;">رقم التأجير (PPR):</td>
                                            <td style="padding: 8px 0; font-weight: 800; color: #1e3a8a; font-family: monospace;">${escapeHtml(tp.ppr || 'غير مسجل')}</td>
                                        </tr>
                                        <tr style="border-bottom: 1px solid #f1f5f9;">
                                            <td style="padding: 8px 0; color: #64748b; font-weight: 700;">البطاقة الوطنية (CNIE):</td>
                                            <td style="padding: 8px 0; font-weight: 800; color: #0f172a; font-family: monospace;">${escapeHtml(tp.cin || 'غير مسجل')}</td>
                                        </tr>
                                        <tr style="border-bottom: 1px solid #f1f5f9;">
                                            <td style="padding: 8px 0; color: #64748b; font-weight: 700;">الإطار الوظيفي:</td>
                                            <td style="padding: 8px 0; font-weight: 800; color: #2563eb;">${escapeHtml(tp.framework || 'أستاذ التعليم الثانوي التأهيلي')}</td>
                                        </tr>
                                        <tr style="border-bottom: 1px solid #f1f5f9;">
                                            <td style="padding: 8px 0; color: #64748b; font-weight: 700;">السلم والدرجة:</td>
                                            <td style="padding: 8px 0; font-weight: 800; color: #7c3aed;">${escapeHtml(tp.scale || 'السلم 11 - الدرجة الأولى')}</td>
                                        </tr>
                                        <tr style="border-bottom: 1px solid #f1f5f9;">
                                            <td style="padding: 8px 0; color: #64748b; font-weight: 700;">الرتبة الحالية:</td>
                                            <td style="padding: 8px 0; font-weight: 800; color: #0f172a;">${escapeHtml(tp.echelon || 'الرتبة 6')}</td>
                                        </tr>
                                        <tr style="border-bottom: 1px solid #f1f5f9;">
                                            <td style="padding: 8px 0; color: #64748b; font-weight: 700;">تاريخ التسمية في الدرجة:</td>
                                            <td style="padding: 8px 0; font-weight: 800; color: #0f172a;">${escapeHtml(tp.gradeDate || 'غير مسجل')}</td>
                                        </tr>
                                        <tr style="border-bottom: 1px solid #f1f5f9;">
                                            <td style="padding: 8px 0; color: #64748b; font-weight: 700;">تاريخ التوظيف بقطاع التعليم:</td>
                                            <td style="padding: 8px 0; font-weight: 900; color: #059669;">${escapeHtml(tp.hireDate || 'غير محدد')} (${seniority.formatted})</td>
                                        </tr>
                                        <tr style="border-bottom: 1px solid #f1f5f9;">
                                            <td style="padding: 8px 0; color: #64748b; font-weight: 700;">المؤسسة الحالية:</td>
                                            <td style="padding: 8px 0; font-weight: 800; color: #0f172a;">${escapeHtml(tp.school || 'المؤسسة التعليمية')}</td>
                                        </tr>
                                        <tr style="border-bottom: 1px solid #f1f5f9;">
                                            <td style="padding: 8px 0; color: #64748b; font-weight: 700;">الأقدمية في المؤسسة:</td>
                                            <td style="padding: 8px 0; font-weight: 800; color: #0284c7;">${schoolSeniority.formatted} (${escapeHtml(tp.schoolSeniorityDate || tp.hireDate)})</td>
                                        </tr>
                                        <tr style="border-bottom: 1px solid #f1f5f9;">
                                            <td style="padding: 8px 0; color: #64748b; font-weight: 700;">المديرية الإقليمية:</td>
                                            <td style="padding: 8px 0; font-weight: 800; color: #0f172a;">${escapeHtml(tp.directorate || 'المديرية')}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 8px 0; color: #64748b; font-weight: 700;">الأكاديمية الجهوية:</td>
                                            <td style="padding: 8px 0; font-weight: 800; color: #0f172a;">${escapeHtml(tp.academy || 'الأكاديمية')}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- بطاقة المسار الأكاديمي والشهادات الجامعية -->
                        <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                            <div style="padding: 14px 20px; background: #f8fafc; border-bottom: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span data-lucide="graduation-cap" data-size="18" style="color: #7c3aed;"></span>
                                    <h3 style="margin: 0; font-size: 1rem; font-weight: 900; color: #0f172a;">المسار الأكاديمي والشهادات الجامعية</h3>
                                </div>
                                <button type="button" onclick="window.openEditTeacherProfileModal('qualifications')" style="background: #faf5ff; color: #7c3aed; border: 1px solid #d8b4fe; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer;">
                                    ➕ إضافة شهادة
                                </button>
                            </div>

                            <div style="padding: 18px 20px; display: flex; flex-direction: column; gap: 12px;">
                                ${tp.qualifications.map((q, idx) => `
                                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                                        <div style="display: flex; gap: 12px; align-items: flex-start;">
                                            <div style="width: 34px; height: 34px; border-radius: 8px; background: #faf5ff; border: 1px solid #e9d5ff; color: #7c3aed; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.8rem; flex-shrink: 0;">
                                                #${idx + 1}
                                            </div>
                                            <div>
                                                <div style="font-weight: 800; font-size: 0.92rem; color: #0f172a; margin-bottom: 2px;">
                                                    ${escapeHtml(q.title)}
                                                </div>
                                                <div style="font-size: 0.78rem; color: #475569; margin-bottom: 4px;">
                                                    🏛️ ${escapeHtml(q.institution)} ${q.field ? `• التخصص: ${escapeHtml(q.field)}` : ''}
                                                </div>
                                                <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                                                    <span style="background: #eff6ff; color: #1d4ed8; font-size: 0.7rem; font-weight: 800; padding: 2px 7px; border-radius: 4px;">سنة: ${escapeHtml(q.year)}</span>
                                                    ${q.grade ? `<span style="background: #ecfdf5; color: #047857; font-size: 0.7rem; font-weight: 800; padding: 2px 7px; border-radius: 4px;">${escapeHtml(q.grade)}</span>` : ''}
                                                </div>
                                            </div>
                                        </div>
                                        <button type="button" onclick="window.deleteTeacherQualification('${q.id}')" style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 4px 7px; border-radius: 6px; font-size: 0.72rem; cursor: pointer;" title="حذف الشهادة">
                                            <span data-lucide="trash-2" data-size="12"></span>
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <!-- بطاقة محطات المسار المهني والمؤسسات السابقة -->
                        <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                            <div style="padding: 14px 20px; background: #f8fafc; border-bottom: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span data-lucide="briefcase" data-size="18" style="color: #0284c7;"></span>
                                    <h3 style="margin: 0; font-size: 1rem; font-weight: 900; color: #0f172a;">المسار الوظيفي والمؤسسات السابقة</h3>
                                </div>
                                <button type="button" onclick="window.openEditTeacherProfileModal('career')" style="background: #f0f9ff; color: #0284c7; border: 1px solid #bae6fd; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer;">
                                    ➕ إضافة محطة
                                </button>
                            </div>

                            <div style="padding: 18px 20px; display: flex; flex-direction: column; gap: 12px;">
                                ${tp.careerStations.map((c) => `
                                    <div style="background: ${c.current ? '#eff6ff' : '#ffffff'}; border: 1px solid ${c.current ? '#bfdbfe' : '#e2e8f0'}; border-right: 4px solid ${c.current ? '#2563eb' : '#64748b'}; border-radius: 10px; padding: 12px 14px;">
                                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 4px;">
                                            <div style="font-weight: 800; font-size: 0.9rem; color: #0f172a;">
                                                ${escapeHtml(c.school)}
                                                ${c.current ? '<span style="background: #2563eb; color: #fff; font-size: 0.68rem; font-weight: 800; padding: 2px 6px; border-radius: 4px; margin-right: 6px;">المؤسسة الحالية</span>' : ''}
                                            </div>
                                            <span style="font-size: 0.72rem; font-weight: 700; color: #475569; font-family: monospace;">${escapeHtml(c.period)}</span>
                                        </div>
                                        <div style="font-size: 0.78rem; color: #334155; font-weight: 600; margin-bottom: 4px;">
                                            📍 ${escapeHtml(c.directorate || '')} ${c.role ? `• ${escapeHtml(c.role)}` : ''}
                                        </div>
                                        ${c.tasks ? `<div style="font-size: 0.76rem; color: #64748b; line-height: 1.4;">${escapeHtml(c.tasks)}</div>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                    </div>

                    <!-- العمود الأيسر: الإنجازات والأنشطة التربوية والديداكتيكية -->
                    <div style="display: flex; flex-direction: column; gap: 24px;">
                        
                        <!-- بطاقة الإنجازات التعليمية والتربوية الكبرى -->
                        <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                            <div style="padding: 14px 20px; background: #f8fafc; border-bottom: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span data-lucide="award" data-size="18" style="color: #ea580c;"></span>
                                    <h3 style="margin: 0; font-size: 1rem; font-weight: 900; color: #0f172a;">الإنجازات والمشاريع التربوية والديداكتيكية</h3>
                                </div>
                                <div style="display: flex; gap: 6px; align-items: center;">
                                    <button type="button" onclick="window.openEditTeacherProfileModal('achievements')" style="background: linear-gradient(135deg, #ea580c, #c2410c); color: #ffffff; border: none; padding: 5px 12px; border-radius: 6px; font-size: 0.78rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                                        <span data-lucide="plus-circle" data-size="14"></span>
                                        <span>إضافة إنجاز جديد</span>
                                    </button>
                                </div>
                            </div>

                            <div style="padding: 18px 20px; display: flex; flex-direction: column; gap: 14px;">
                                ${tp.achievements.map((ach) => `
                                    <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-right: 5px solid ${ach.color || '#2563eb'}; border-radius: 12px; padding: 14px 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.02); transition: transform 0.15s ease;">
                                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 6px; flex-wrap: wrap;">
                                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                                <span style="background: ${ach.color ? ach.color + '18' : '#eff6ff'}; color: ${ach.color || '#2563eb'}; border: 1px solid ${ach.color ? ach.color + '40' : '#bfdbfe'}; font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 6px;">
                                                    ${escapeHtml(ach.category || 'إنجاز تربوي')}
                                                </span>
                                                <span style="font-size: 0.74rem; font-weight: 700; color: #64748b; font-family: monospace;">
                                                    📅 ${escapeHtml(ach.date || '')}
                                                </span>
                                            </div>
                                            <div style="display: flex; gap: 4px; align-items: center;">
                                                <button type="button" onclick="window.deleteTeacherAchievement('${ach.id}')" style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 3px 6px; border-radius: 5px; font-size: 0.72rem; cursor: pointer;" title="حذف هذا الإنجاز">
                                                    <span data-lucide="trash-2" data-size="12"></span>
                                                </button>
                                            </div>
                                        </div>

                                        <h4 style="margin: 0 0 6px 0; font-size: 0.96rem; font-weight: 900; color: #0f172a; line-height: 1.4;">
                                            ${escapeHtml(ach.title)}
                                        </h4>

                                        <p style="margin: 0; font-size: 0.82rem; color: #475569; line-height: 1.5; font-weight: 500;">
                                            ${escapeHtml(ach.description || '')}
                                        </p>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <!-- بطاقة التكوين المستمر والشهادات المهنية -->
                        <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                            <div style="padding: 14px 20px; background: #f8fafc; border-bottom: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span data-lucide="sparkles" data-size="18" style="color: #059669;"></span>
                                    <h3 style="margin: 0; font-size: 1rem; font-weight: 900; color: #0f172a;">التكوين المستمر والمهارات الديداكتيكية</h3>
                                </div>
                                <button type="button" onclick="window.openEditTeacherProfileModal('trainings')" style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer;">
                                    ➕ إضافة دورة
                                </button>
                            </div>

                            <div style="padding: 18px 20px; display: flex; flex-direction: column; gap: 12px;">
                                ${tp.trainings.map((tr) => {
                                    const hrs = parseTrainingHours(tr);
                                    return `
                                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                                        <div style="flex: 1;">
                                            <div style="font-weight: 800; font-size: 0.9rem; color: #065f46; margin-bottom: 3px;">
                                                ${escapeHtml(tr.title)}
                                            </div>
                                            <div style="font-size: 0.76rem; color: #475569; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
                                                <span>🏛️ الجهة المنظمة: ${escapeHtml(tr.provider)}</span>
                                                <span style="font-weight: 800; color: #059669; background: #dcfce7; padding: 2px 8px; border-radius: 6px;">سنة ${escapeHtml(tr.year)} • ⏱️ ${hrs} ساعة</span>
                                            </div>
                                        </div>
                                        <button type="button" onclick="window.deleteTeacherTraining('${tr.id}')" style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 4px 7px; border-radius: 6px; font-size: 0.72rem; cursor: pointer;" title="حذف الدورة">
                                            <span data-lucide="trash-2" data-size="12"></span>
                                        </button>
                                    </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>

                    </div>
                </div>

                <!-- 5. شريط التذييل الموثق للبطاقة المهنية -->
                <div style="background: #f1f5f9; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; font-size: 0.8rem; color: #64748b;">
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <span data-lucide="shield-check" data-size="16" style="color: #2563eb;"></span>
                        <span>الملف المهني محدث بتاريخ: </span>
                        <strong style="color: #0f172a;">${new Date().toLocaleDateString('ar-MA')}</strong>
                        <span style="margin: 0 6px;">•</span>
                        <span>مخصص للتفتيش التربوي والترقيات والتوثيق البيداغوجي لمادة الرياضيات</span>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button type="button" onclick="window.openTeacherPhotoLogoModal()" style="background: #ffffff; border: 1px solid #cbd5e1; color: #0284c7; padding: 6px 12px; border-radius: 8px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                            <span data-lucide="camera" data-size="14"></span>
                            <span>الصورة / الشعار</span>
                        </button>
                        <button type="button" onclick="window.openEditTeacherProfileModal('info')" style="background: #ffffff; border: 1px solid #cbd5e1; color: #1e293b; padding: 6px 12px; border-radius: 8px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                            <span data-lucide="edit-3" data-size="14"></span>
                            <span>تحديث البيانات</span>
                        </button>
                        <button type="button" onclick="window.exportTeacherProfilePDF()" style="background: linear-gradient(135deg, #e11d48, #be123c); color: #ffffff; border: none; padding: 6px 14px; border-radius: 8px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(225,29,72,0.25);">
                            <span data-lucide="file-down" data-size="14"></span>
                            <span>تصدير الملف المهني بصيغة PDF</span>
                        </button>
                        <button type="button" onclick="window.printTeacherProfessionalProfile()" style="background: #2563eb; color: #ffffff; border: none; padding: 6px 14px; border-radius: 8px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                            <span data-lucide="printer" data-size="14"></span>
                            <span>طباعة رسمية A4</span>
                        </button>
                    </div>
                </div>

            </div>
        `;

        mount.innerHTML = html;

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons({ root: mount });
        } else if (typeof window.renderLucide === 'function') {
            window.renderLucide(mount);
        }
        } catch (err) {
            console.error('Error rendering teacher profile:', err);
            mount.innerHTML = `
                <div class="card" style="padding: 30px; text-align: center; border-radius: 16px; border: 1.5px solid #cbd5e1; background: #ffffff; margin-top: 10px;">
                    <div style="font-size: 2.2rem; margin-bottom: 10px;">👤</div>
                    <h3 style="color: #0f172a; margin-bottom: 8px; font-weight: 800; font-size: 1.15rem;">الملف المهني للأستاذ</h3>
                    <p style="color: #64748b; font-size: 0.88rem; max-width: 520px; margin: 0 auto 18px auto; line-height: 1.6;">
                        مرحباً بك في صفحة مسارك المهني. يمكنك تحديث بياناتك الشخصية والإدارية والشواهد المحصل عليها عبر زر الإعدادات أدناه.
                    </p>
                    <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                        <button type="button" class="btn-primary" onclick="if(typeof openTeacherSettings==='function') openTeacherSettings('settingsPersonal');" style="background: linear-gradient(135deg, #0284c7, #0369a1); padding: 9px 20px; border-radius: 8px; font-weight: 800; cursor: pointer; color: #fff; border: none; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.3);">
                            تحديث المعلومات الشخصية والمهنية
                        </button>
                        <button type="button" class="btn-secondary" onclick="renderTeacherProfileView();" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 9px 18px; border-radius: 8px; font-weight: 800; cursor: pointer;">
                            إعادة المحاولة 🔄
                        </button>
                    </div>
                </div>
            `;
        }
    }
    window.renderTeacherProfileView = renderTeacherProfileView;

    /**
     * ضغط وتحجيم أي رابط صورة DataURL عبر Canvas لتقليص الحجم بنسبة 90%
     */
    function compressDataUrlImage(rawDataUrl, maxDim = 280, callback) {
        if (!rawDataUrl || typeof rawDataUrl !== 'string' || !rawDataUrl.startsWith('data:image')) {
            if (callback) callback(rawDataUrl);
            return;
        }
        const img = new Image();
        img.onload = function () {
            try {
                const canvas = document.createElement('canvas');
                let w = img.width || maxDim;
                let h = img.height || maxDim;
                if (w > h && w > maxDim) {
                    h = Math.round((h * maxDim) / w);
                    w = maxDim;
                } else if (h >= w && h > maxDim) {
                    w = Math.round((w * maxDim) / h);
                    h = maxDim;
                }
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                let out = canvas.toDataURL('image/webp', 0.82);
                if (!out || out === 'data:,' || out.length > rawDataUrl.length) {
                    out = canvas.toDataURL('image/jpeg', 0.82);
                }
                callback(out && out.length < rawDataUrl.length ? out : rawDataUrl);
            } catch (e) {
                callback(rawDataUrl);
            }
        };
        img.onerror = function () {
            callback(rawDataUrl);
        };
        img.src = rawDataUrl;
    }
    window.compressDataUrlImage = compressDataUrlImage;

    /**
     * ضغط وتحجيم الصورة المرفوعة عبر Canvas لحفظها في teacherProfile دون تجاوز سعة التخزين
     */
    function compressUploadedImage(file, maxDim = 280, callback) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            compressDataUrlImage(e.target.result, maxDim, callback);
        };
        reader.readAsDataURL(file);
    }
    window.compressUploadedImage = compressUploadedImage;

    /**
     * نافذة مخصصة لتحميل ومعاينة الصورة الشخصية للأستاذ وشعار المؤسسة التعليمية
     */
    function openTeacherPhotoLogoModal() {
        let modal = document.getElementById('teacherPhotoLogoModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'teacherPhotoLogoModal';
            modal.style.cssText = 'display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.72); backdrop-filter: blur(4px); z-index: 100005; align-items: center; justify-content: center; padding: 16px; direction: rtl; text-align: right; box-sizing: border-box;';
            document.body.appendChild(modal);
        }

        const tp = getTeacherProfile();
        const hasAvatar = !!(tp.avatarDataUrl && tp.avatarDataUrl.startsWith('data:image'));
        const hasLogo = !!(tp.schoolLogoDataUrl && tp.schoolLogoDataUrl.startsWith('data:image'));

        modal.innerHTML = `
            <div style="background: #ffffff; border-radius: 18px; width: 100%; max-width: 640px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.35); border: 1.5px solid #cbd5e1; font-family: 'Cairo', sans-serif;">
                <div style="padding: 16px 22px; background: linear-gradient(135deg, #0f172a, #1e3a8a); color: #ffffff; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.4rem;">📷</span>
                        <div>
                            <h3 style="margin: 0; font-size: 1.08rem; font-weight: 900;">تحميل الصورة الشخصية وشعار المؤسسة التعليمية</h3>
                            <div style="font-size: 0.75rem; color: #bae6fd;">تُحفظ تلقائياً في الملف المهني (teacherProfile) وتظهر في أعلى البطاقة وعند الطباعة</div>
                        </div>
                    </div>
                    <button type="button" onclick="window.closeTeacherPhotoLogoModal()" style="background: rgba(255,255,255,0.15); border: none; color: #fff; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 1.1rem;">✕</button>
                </div>

                <div style="padding: 22px; display: flex; flex-direction: column; gap: 18px;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
                        
                        <!-- 1. بطاقة الصورة الشخصية للأستاذ -->
                        <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 16px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px;">
                            <div style="font-weight: 900; font-size: 0.9rem; color: #1e3a8a;">👤 الصورة الشخصية للأستاذ(ة)</div>
                            <div id="tpAvatarPreviewBox" style="width: 104px; height: 104px; border-radius: 22px; background: linear-gradient(135deg, #2563eb, #7c3aed); border: 3px solid #bfdbfe; display: flex; align-items: center; justify-content: center; overflow: hidden; color: #fff; font-size: 2.2rem; font-weight: 900; box-shadow: 0 4px 12px rgba(37,99,235,0.2);">
                                ${hasAvatar ? `<img src="${tp.avatarDataUrl}" style="width: 100%; height: 100%; object-fit: cover;" />` : (tp.name ? tp.name.trim().charAt(0) : 'أ')}
                            </div>
                            <input type="file" id="tpAvatarFileInput" accept="image/*" style="display: none;" onchange="window.handleTeacherImageUpload(event, 'avatar')">
                            <div style="display: flex; gap: 6px; width: 100%; justify-content: center; flex-wrap: wrap;">
                                <button type="button" onclick="document.getElementById('tpAvatarFileInput').click()" style="background: #2563eb; color: #ffffff; border: none; padding: 7px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 800; cursor: pointer;">
                                    📤 اختيار صورة شخصية
                                </button>
                                ${hasAvatar ? `
                                    <button type="button" onclick="window.removeTeacherImage('avatar')" style="background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; padding: 7px 10px; border-radius: 8px; font-size: 0.76rem; font-weight: 800; cursor: pointer;">
                                        حذف ✕
                                    </button>
                                ` : ''}
                            </div>
                            <div style="font-size: 0.72rem; color: #64748b;">تظهر في الإطار الرئيسي بجانب اسم الأستاذ</div>
                        </div>

                        <!-- 2. بطاقة شعار المؤسسة التعليمية -->
                        <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 16px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px;">
                            <div style="font-weight: 900; font-size: 0.9rem; color: #047857;">🏫 شعار المؤسسة التعليمية / الأكاديمية</div>
                            <div id="tpLogoPreviewBox" style="width: 104px; height: 104px; border-radius: 22px; background: #ffffff; border: 3px solid #a7f3d0; display: flex; align-items: center; justify-content: center; overflow: hidden; color: #059669; font-size: 2rem; font-weight: 900; padding: 8px; box-sizing: border-box; box-shadow: 0 4px 12px rgba(16,185,129,0.15);">
                                ${hasLogo ? `<img src="${tp.schoolLogoDataUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />` : '🏛️'}
                            </div>
                            <input type="file" id="tpLogoFileInput" accept="image/*" style="display: none;" onchange="window.handleTeacherImageUpload(event, 'logo')">
                            <div style="display: flex; gap: 6px; width: 100%; justify-content: center; flex-wrap: wrap;">
                                <button type="button" onclick="document.getElementById('tpLogoFileInput').click()" style="background: #059669; color: #ffffff; border: none; padding: 7px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 800; cursor: pointer;">
                                    📤 تحميل شعار المؤسسة
                                </button>
                                ${hasLogo ? `
                                    <button type="button" onclick="window.removeTeacherImage('logo')" style="background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; padding: 7px 10px; border-radius: 8px; font-size: 0.76rem; font-weight: 800; cursor: pointer;">
                                        حذف ✕
                                    </button>
                                ` : ''}
                            </div>
                            <div style="font-size: 0.72rem; color: #64748b;">يظهر في أعلى الملف المهني وفي ترويسة الطباعة الرسمية</div>
                        </div>

                    </div>

                    <!-- خيار طريقة العرض في الترويسة -->
                    <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <span style="font-size: 0.8rem; font-weight: 800; color: #334155;">نمط العرض في أعلى الملف المهني:</span>
                        <select id="tpPrimaryHeaderImageSelect" onchange="window.onChangeTeacherHeaderImageMode(this.value)" style="padding: 6px 12px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-size: 0.8rem; font-weight: 700; background: #ffffff;">
                            <option value="both" ${tp.primaryHeaderImage !== 'logo' ? 'selected' : ''}>عرض الصورة الشخصية + شارة شعار المؤسسة معاً (موصى به)</option>
                            <option value="logo" ${tp.primaryHeaderImage === 'logo' ? 'selected' : ''}>اعتماد شعار المؤسسة كصورة رئيسية للملف المهني</option>
                        </select>
                    </div>
                </div>

                <div style="padding: 14px 22px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px;">
                    <button type="button" onclick="window.closeTeacherPhotoLogoModal()" style="background: #2563eb; color: #ffffff; border: none; padding: 8px 22px; border-radius: 8px; font-weight: 800; font-size: 0.86rem; cursor: pointer;">
                        ✓ تم الحفظ والإغلاق
                    </button>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
    }
    window.openTeacherPhotoLogoModal = openTeacherPhotoLogoModal;

    function closeTeacherPhotoLogoModal() {
        const modal = document.getElementById('teacherPhotoLogoModal');
        if (modal) modal.style.display = 'none';
    }
    window.closeTeacherPhotoLogoModal = closeTeacherPhotoLogoModal;

    function handleTeacherImageUpload(event, targetType) {
        const file = event && event.target && event.target.files ? event.target.files[0] : null;
        if (!file) return;

        compressUploadedImage(file, 360, function (dataUrl) {
            const tp = getTeacherProfile();
            if (targetType === 'logo') {
                tp.schoolLogoDataUrl = dataUrl;
            } else {
                tp.avatarDataUrl = dataUrl;
            }
            window.db.teacherProfile = tp;
            if (typeof window.saveDB === 'function') window.saveDB();

            renderTeacherProfileView();
            const photoModal = document.getElementById('teacherPhotoLogoModal');
            if (photoModal && photoModal.style.display !== 'none') {
                openTeacherPhotoLogoModal();
            }

            if (typeof window.showNotification === 'function') {
                window.showNotification(targetType === 'logo' ? 'تم تحميل وحفظ شعار المؤسسة التعليمية في الملف المهني بنجاح 🏫✨' : 'تم تحميل وحفظ الصورة الشخصية للأستاذ في الملف المهني بنجاح 👤✨', 'success');
            } else if (typeof window.showToast === 'function') {
                window.showToast('تم حفظ الصورة وتحديث الملف المهني بنجاح ✨', 'success');
            }
        });
    }
    window.handleTeacherImageUpload = handleTeacherImageUpload;

    function removeTeacherImage(targetType) {
        const tp = getTeacherProfile();
        if (targetType === 'logo') {
            tp.schoolLogoDataUrl = '';
        } else {
            tp.avatarDataUrl = '';
        }
        window.db.teacherProfile = tp;
        if (typeof window.saveDB === 'function') window.saveDB();
        renderTeacherProfileView();
        openTeacherPhotoLogoModal();
    }
    window.removeTeacherImage = removeTeacherImage;

    function onChangeTeacherHeaderImageMode(mode) {
        const tp = getTeacherProfile();
        tp.primaryHeaderImage = mode || 'both';
        window.db.teacherProfile = tp;
        if (typeof window.saveDB === 'function') window.saveDB();
        renderTeacherProfileView();
    }
    window.onChangeTeacherHeaderImageMode = onChangeTeacherHeaderImageMode;

    /**
     * نافذة تحديث وتعديل الملف المهني للأستاذ
     */
    let currentEditSection = 'info';

    function openEditTeacherProfileModal(section = 'info') {
        currentEditSection = section;
        let modal = document.getElementById('teacherProfileEditModal');
        if (!modal) {
            createTeacherProfileEditModalHtml();
            modal = document.getElementById('teacherProfileEditModal');
        }
        if (!modal) return;

        populateTeacherProfileEditForm();
        switchProfileEditTab(section);
        modal.style.display = 'flex';

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons({ root: modal });
        }
    }
    window.openEditTeacherProfileModal = openEditTeacherProfileModal;

    function closeEditTeacherProfileModal() {
        const modal = document.getElementById('teacherProfileEditModal');
        if (modal) modal.style.display = 'none';
    }
    window.closeEditTeacherProfileModal = closeEditTeacherProfileModal;

    function switchProfileEditTab(tab) {
        currentEditSection = tab;
        const tabs = ['info', 'achievements', 'qualifications', 'career', 'trainings'];
        tabs.forEach(t => {
            const btn = document.getElementById('tpEditTabBtn_' + t);
            const pane = document.getElementById('tpEditPane_' + t);
            if (btn) {
                if (t === tab) {
                    btn.style.background = '#2563eb';
                    btn.style.color = '#ffffff';
                    btn.style.borderColor = '#2563eb';
                } else {
                    btn.style.background = '#f8fafc';
                    btn.style.color = '#475569';
                    btn.style.borderColor = '#cbd5e1';
                }
            }
            if (pane) {
                pane.style.display = (t === tab) ? 'block' : 'none';
            }
        });
    }
    window.switchProfileEditTab = switchProfileEditTab;

    function populateTeacherProfileEditForm() {
        const tp = getTeacherProfile();

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val || '';
        };

        setVal('tpInput_name', tp.name);
        setVal('tpInput_nameFr', tp.nameFr);
        setVal('tpInput_ppr', tp.ppr);
        setVal('tpInput_cin', tp.cin);
        setVal('tpInput_specialty', tp.specialty);
        setVal('tpInput_framework', tp.framework);
        setVal('tpInput_scale', tp.scale);
        setVal('tpInput_echelon', tp.echelon);
        setVal('tpInput_hireDate', tp.hireDate);
        setVal('tpInput_gradeDate', tp.gradeDate);
        setVal('tpInput_schoolSeniorityDate', tp.schoolSeniorityDate);
        setVal('tpInput_school', tp.school);
        setVal('tpInput_directorate', tp.directorate);
        setVal('tpInput_academy', tp.academy);
        setVal('tpInput_city', tp.city);
        setVal('tpInput_email', tp.email);
        setVal('tpInput_phone', tp.phone);
        setVal('tpInput_bio', tp.bio);

        renderAchievementsEditList();
        renderQualificationsEditList();
        renderCareerStationsEditList();
        renderTrainingsEditList();
    }

    function renderAchievementsEditList() {
        const container = document.getElementById('tpAchievementsEditList');
        if (!container) return;
        const tp = getTeacherProfile();
        const achievements = tp.achievements || [];

        container.innerHTML = achievements.map((ach, idx) => `
            <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 12px; margin-bottom: 10px; position: relative;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: 800; color: #2563eb; font-size: 0.82rem;">إنجاز #${idx + 1}</span>
                    <button type="button" onclick="window.deleteTeacherAchievement('${ach.id}')" style="background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 6px; padding: 3px 8px; font-size: 0.72rem; cursor: pointer;">
                        حذف الإنجاز ✕
                    </button>
                </div>
                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                    <input type="text" id="achTitle_${ach.id}" value="${ach.title || ''}" placeholder="عنوان الإنجاز أو النشاط" style="padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.82rem; font-weight: 700;">
                    <input type="text" id="achCat_${ach.id}" value="${ach.category || ''}" placeholder="الصنف (نادي، موارد، دعم...)" style="padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.82rem;">
                    <input type="text" id="achDate_${ach.id}" value="${ach.date || ''}" placeholder="السنة / التاريخ" style="padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.82rem;">
                </div>
                <textarea id="achDesc_${ach.id}" placeholder="تفاصيل ومخرجات الإنجاز التربوي..." rows="2" style="width: 100%; box-sizing: border-box; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.8rem; resize: vertical;">${ach.description || ''}</textarea>
            </div>
        `).join('');
    }

    function renderQualificationsEditList() {
        const container = document.getElementById('tpQualificationsEditList');
        if (!container) return;
        const tp = getTeacherProfile();
        const qualifications = tp.qualifications || [];

        container.innerHTML = qualifications.map((q, idx) => `
            <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 12px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: 800; color: #7c3aed; font-size: 0.82rem;">شهادة مؤهل #${idx + 1}</span>
                    <button type="button" onclick="window.deleteTeacherQualification('${q.id}')" style="background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 6px; padding: 3px 8px; font-size: 0.72rem; cursor: pointer;">
                        حذف ✕
                    </button>
                </div>
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px; margin-bottom: 8px;">
                    <input type="text" id="qualTitle_${q.id}" value="${q.title || ''}" placeholder="اسم الشهادة الجامعية أو التأهيلية" style="padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.82rem; font-weight: 700;">
                    <input type="text" id="qualField_${q.id}" value="${q.field || ''}" placeholder="التخصص / المسلك" style="padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.82rem;">
                </div>
                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 8px;">
                    <input type="text" id="qualInst_${q.id}" value="${q.institution || ''}" placeholder="الجامعة أو المركز أو المؤسسة" style="padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.82rem;">
                    <input type="text" id="qualYear_${q.id}" value="${q.year || ''}" placeholder="سنة الحصول" style="padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.82rem;">
                    <input type="text" id="qualGrade_${q.id}" value="${q.grade || ''}" placeholder="الميزة (حسن جداً...)" style="padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.82rem;">
                </div>
            </div>
        `).join('');
    }

    function renderCareerStationsEditList() {
        const container = document.getElementById('tpCareerStationsEditList');
        if (!container) return;
        const tp = getTeacherProfile();
        const stations = tp.careerStations || [];

        container.innerHTML = stations.map((c, idx) => `
            <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 12px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: 800; color: #0284c7; font-size: 0.82rem;">محطة مهنية #${idx + 1}</span>
                    <button type="button" onclick="window.deleteTeacherCareerStation('${c.id}')" style="background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 6px; padding: 3px 8px; font-size: 0.72rem; cursor: pointer;">
                        حذف ✕
                    </button>
                </div>
                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                    <input type="text" id="carSchool_${c.id}" value="${c.school || ''}" placeholder="اسم المؤسسة التعليمية" style="padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.82rem; font-weight: 700;">
                    <input type="text" id="carDir_${c.id}" value="${c.directorate || ''}" placeholder="المديرية الإقليمية" style="padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.82rem;">
                    <input type="text" id="carPeriod_${c.id}" value="${c.period || ''}" placeholder="الفترة (مثلاً: 2018 - 2022)" style="padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.82rem;">
                </div>
                <input type="text" id="carTasks_${c.id}" value="${c.tasks || ''}" placeholder="المهام والمستويات المسندة..." style="width: 100%; box-sizing: border-box; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.8rem;">
            </div>
        `).join('');
    }

    function renderTrainingsEditList() {
        const container = document.getElementById('tpTrainingsEditList');
        if (!container) return;
        const tp = getTeacherProfile();
        const trainings = tp.trainings || [];

        container.innerHTML = trainings.map((tr, idx) => {
            const hrs = parseTrainingHours(tr);
            return `
            <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 12px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: 800; color: #059669; font-size: 0.82rem;">دورة تكوينية #${idx + 1}</span>
                    <button type="button" onclick="window.deleteTeacherTraining('${tr.id}')" style="background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 6px; padding: 3px 8px; font-size: 0.72rem; cursor: pointer;">
                        حذف ✕
                    </button>
                </div>
                <div style="display: grid; grid-template-columns: 2fr 1.2fr 0.8fr 0.8fr; gap: 8px;">
                    <input type="text" id="trTitle_${tr.id}" value="${tr.title || ''}" placeholder="موضوع الدورة التكوينية" style="padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.82rem; font-weight: 700;">
                    <input type="text" id="trProv_${tr.id}" value="${tr.provider || ''}" placeholder="الجهة المنظمة" style="padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.82rem;">
                    <input type="text" id="trYear_${tr.id}" value="${tr.year || ''}" placeholder="السنة (مثال: 2025)" style="padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.82rem;">
                    <input type="number" id="trHours_${tr.id}" value="${hrs}" min="1" max="400" placeholder="الساعات" title="عدد ساعات التكوين المستمر" style="padding: 6px 10px; border: 1px solid #a7f3d0; border-radius: 6px; font-size: 0.82rem; font-weight: 800; color: #065f46;">
                </div>
            </div>
            `;
        }).join('');
    }

    /**
     * حفظ وتحديث بيانات الملف المهني
     */
    function saveTeacherProfileData() {
        const tp = getTeacherProfile();

        const getVal = (id) => {
            const el = document.getElementById(id);
            return el ? el.value.trim() : '';
        };

        tp.name = getVal('tpInput_name') || tp.name;
        tp.nameFr = getVal('tpInput_nameFr');
        tp.ppr = getVal('tpInput_ppr');
        tp.cin = getVal('tpInput_cin');
        tp.specialty = getVal('tpInput_specialty') || 'مادة الرياضيات';
        tp.framework = getVal('tpInput_framework') || 'أستاذ التعليم الثانوي التأهيلي';
        tp.scale = getVal('tpInput_scale') || 'السلم 11';
        tp.echelon = getVal('tpInput_echelon') || 'الرتبة 6';
        tp.hireDate = getVal('tpInput_hireDate') || tp.hireDate;
        tp.gradeDate = getVal('tpInput_gradeDate');
        tp.schoolSeniorityDate = getVal('tpInput_schoolSeniorityDate');
        tp.school = getVal('tpInput_school') || tp.school;
        tp.directorate = getVal('tpInput_directorate') || tp.directorate;
        tp.academy = getVal('tpInput_academy') || tp.academy;
        tp.city = getVal('tpInput_city');
        tp.email = getVal('tpInput_email');
        tp.phone = getVal('tpInput_phone');
        tp.bio = getVal('tpInput_bio');

        if (Array.isArray(tp.achievements)) {
            tp.achievements.forEach(ach => {
                const titleEl = document.getElementById(`achTitle_${ach.id}`);
                const catEl = document.getElementById(`achCat_${ach.id}`);
                const dateEl = document.getElementById(`achDate_${ach.id}`);
                const descEl = document.getElementById(`achDesc_${ach.id}`);
                if (titleEl) ach.title = titleEl.value.trim();
                if (catEl) ach.category = catEl.value.trim();
                if (dateEl) ach.date = dateEl.value.trim();
                if (descEl) ach.description = descEl.value.trim();
            });
        }

        if (Array.isArray(tp.qualifications)) {
            tp.qualifications.forEach(q => {
                const titleEl = document.getElementById(`qualTitle_${q.id}`);
                const fieldEl = document.getElementById(`qualField_${q.id}`);
                const instEl = document.getElementById(`qualInst_${q.id}`);
                const yearEl = document.getElementById(`qualYear_${q.id}`);
                const gradeEl = document.getElementById(`qualGrade_${q.id}`);
                if (titleEl) q.title = titleEl.value.trim();
                if (fieldEl) q.field = fieldEl.value.trim();
                if (instEl) q.institution = instEl.value.trim();
                if (yearEl) q.year = yearEl.value.trim();
                if (gradeEl) q.grade = gradeEl.value.trim();
            });
        }

        if (Array.isArray(tp.careerStations)) {
            tp.careerStations.forEach(c => {
                const schoolEl = document.getElementById(`carSchool_${c.id}`);
                const dirEl = document.getElementById(`carDir_${c.id}`);
                const periodEl = document.getElementById(`carPeriod_${c.id}`);
                const tasksEl = document.getElementById(`carTasks_${c.id}`);
                if (schoolEl) c.school = schoolEl.value.trim();
                if (dirEl) c.directorate = dirEl.value.trim();
                if (periodEl) c.period = periodEl.value.trim();
                if (tasksEl) c.tasks = tasksEl.value.trim();
            });
        }

        if (Array.isArray(tp.trainings)) {
            tp.trainings.forEach(tr => {
                const titleEl = document.getElementById(`trTitle_${tr.id}`);
                const provEl = document.getElementById(`trProv_${tr.id}`);
                const yearEl = document.getElementById(`trYear_${tr.id}`);
                const hoursEl = document.getElementById(`trHours_${tr.id}`);
                if (titleEl) tr.title = titleEl.value.trim();
                if (provEl) tr.provider = provEl.value.trim();
                if (yearEl) tr.year = yearEl.value.trim();
                if (hoursEl) {
                    const hrs = parseFloat(hoursEl.value) || 12;
                    tr.hours = hrs;
                    tr.duration = `${hrs} ساعة`;
                }
            });
        }

        window.db.teacherProfile = tp;
        if (typeof window.saveDB === 'function') window.saveDB();

        const setIfExists = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val || '';
        };
        setIfExists('settingsTeacherName', tp.name);
        setIfExists('settingsSchool', tp.school);
        setIfExists('settingsDirectorate', tp.directorate);
        setIfExists('settingsAcademy', tp.academy);

        closeEditTeacherProfileModal();
        renderTeacherProfileView();

        if (typeof window.showNotification === 'function') {
            window.showNotification('تم تحديث وحفظ بيانات الملف المهني والرسوم البيانية بنجاح ✨', 'success');
        } else if (typeof window.showToast === 'function') {
            window.showToast('تم حفظ الملف المهني بنجاح ✨', 'success');
        }
    }
    window.saveTeacherProfileData = saveTeacherProfileData;

    function addNewAchievement() {
        const tp = getTeacherProfile();
        if (!Array.isArray(tp.achievements)) tp.achievements = [];
        const newId = 'ach_' + Date.now();
        tp.achievements.unshift({
            id: newId,
            title: 'إنجاز تربوي جديد',
            category: 'أنشطة تربوية وديداكتيكية',
            date: new Date().getFullYear().toString(),
            description: 'وصف الإنجاز التربوي أو المبادرة أو المشروع...',
            icon: 'award',
            color: '#2563eb'
        });
        renderAchievementsEditList();
        const firstInput = document.getElementById(`achTitle_${newId}`);
        if (firstInput) firstInput.focus();
    }
    window.addNewAchievement = addNewAchievement;

    function deleteTeacherAchievement(id) {
        if (!confirm('هل أنت متأكد من حذف هذا الإنجاز من الملف المهني؟')) return;
        const tp = getTeacherProfile();
        if (Array.isArray(tp.achievements)) {
            tp.achievements = tp.achievements.filter(a => a.id !== id);
            renderAchievementsEditList();
            renderTeacherProfileView();
            if (typeof window.saveDB === 'function') window.saveDB();
        }
    }
    window.deleteTeacherAchievement = deleteTeacherAchievement;

    function addNewQualification() {
        const tp = getTeacherProfile();
        if (!Array.isArray(tp.qualifications)) tp.qualifications = [];
        const newId = 'q_' + Date.now();
        tp.qualifications.unshift({
            id: newId,
            title: 'شهادة جديدة',
            field: 'الرياضيات والتطبيقات',
            institution: 'الجامعة أو المركز',
            year: new Date().getFullYear().toString(),
            grade: 'ميزة مستحسن'
        });
        renderQualificationsEditList();
        const firstInput = document.getElementById(`qualTitle_${newId}`);
        if (firstInput) firstInput.focus();
    }
    window.addNewQualification = addNewQualification;

    function deleteTeacherQualification(id) {
        if (!confirm('هل تريد حذف هذه الشهادة من السجل الأكاديمي؟')) return;
        const tp = getTeacherProfile();
        if (Array.isArray(tp.qualifications)) {
            tp.qualifications = tp.qualifications.filter(q => q.id !== id);
            renderQualificationsEditList();
            renderTeacherProfileView();
            if (typeof window.saveDB === 'function') window.saveDB();
        }
    }
    window.deleteTeacherQualification = deleteTeacherQualification;

    function addNewCareerStation() {
        const tp = getTeacherProfile();
        if (!Array.isArray(tp.careerStations)) tp.careerStations = [];
        const newId = 'car_' + Date.now();
        tp.careerStations.unshift({
            id: newId,
            role: 'أستاذ مادة الرياضيات',
            school: 'المؤسسة التعليمية',
            directorate: 'المديرية الإقليمية',
            period: '2018 - 2022',
            current: false,
            tasks: 'تدريس المستويات التأهيلية والمشاركة في مجالس المؤسسة.'
        });
        renderCareerStationsEditList();
        const firstInput = document.getElementById(`carSchool_${newId}`);
        if (firstInput) firstInput.focus();
    }
    window.addNewCareerStation = addNewCareerStation;

    function deleteTeacherCareerStation(id) {
        if (!confirm('هل تريد حذف هذه المحطة الوظيفية؟')) return;
        const tp = getTeacherProfile();
        if (Array.isArray(tp.careerStations)) {
            tp.careerStations = tp.careerStations.filter(c => c.id !== id);
            renderCareerStationsEditList();
            renderTeacherProfileView();
            if (typeof window.saveDB === 'function') window.saveDB();
        }
    }
    window.deleteTeacherCareerStation = deleteTeacherCareerStation;

    function addNewTraining() {
        const tp = getTeacherProfile();
        if (!Array.isArray(tp.trainings)) tp.trainings = [];
        const newId = 'tr_' + Date.now();
        tp.trainings.unshift({
            id: newId,
            title: 'دورة تكوينية جديدة',
            provider: 'المديرية الإقليمية / المركز الجهوي',
            year: new Date().getFullYear().toString(),
            duration: '20 ساعة',
            hours: 20
        });
        renderTrainingsEditList();
        const firstInput = document.getElementById(`trTitle_${newId}`);
        if (firstInput) firstInput.focus();
    }
    window.addNewTraining = addNewTraining;

    function deleteTeacherTraining(id) {
        if (!confirm('هل تريد حذف هذه الدورة التكوينية؟')) return;
        const tp = getTeacherProfile();
        if (Array.isArray(tp.trainings)) {
            tp.trainings = tp.trainings.filter(tr => tr.id !== id);
            renderTrainingsEditList();
            renderTeacherProfileView();
            if (typeof window.saveDB === 'function') window.saveDB();
        }
    }
    window.deleteTeacherTraining = deleteTeacherTraining;

    /**
     * بناء كود HTML لنافذة التعديل التفاعلية
     */
    function createTeacherProfileEditModalHtml() {
        if (document.getElementById('teacherProfileEditModal')) return;

        const modalDiv = document.createElement('div');
        modalDiv.id = 'teacherProfileEditModal';
        modalDiv.style.cssText = 'display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px); z-index: 99999; align-items: center; justify-content: center; padding: 16px; direction: rtl; text-align: right; box-sizing: border-box;';

        modalDiv.innerHTML = `
            <div style="background: #ffffff; border-radius: 18px; width: 100%; max-width: 860px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.25); border: 1.5px solid #cbd5e1;">
                
                <!-- رأس النافذة -->
                <div style="padding: 16px 24px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 36px; height: 36px; border-radius: 10px; background: #2563eb; display: flex; align-items: center; justify-content: center;">
                            <span data-lucide="user-check" data-size="20"></span>
                        </div>
                        <div>
                            <h2 style="margin: 0; font-size: 1.15rem; font-weight: 900;">تحديث وتعديل الملف المهني والشخصي للأستاذ</h2>
                            <div style="font-size: 0.76rem; color: #94a3b8;">الوضعية الإدارية، تاريخ التوظيف، الأقدمية، والإنجازات والشواهد وساعات التكوين</div>
                        </div>
                    </div>
                    <button type="button" onclick="window.closeEditTeacherProfileModal()" style="background: rgba(255,255,255,0.1); border: none; color: #cbd5e1; width: 32px; height: 32px; border-radius: 8px; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        ✕
                    </button>
                </div>

                <!-- شريط التبويبات الداخلية للنافذة -->
                <div style="display: flex; gap: 6px; padding: 10px 18px; background: #f1f5f9; border-bottom: 1px solid #cbd5e1; overflow-x: auto;">
                    <button type="button" id="tpEditTabBtn_info" onclick="window.switchProfileEditTab('info')" style="padding: 7px 14px; border-radius: 8px; border: 1px solid #2563eb; background: #2563eb; color: #fff; font-size: 0.8rem; font-weight: 800; cursor: pointer; white-space: nowrap;">
                        📋 البيانات الإدارية والتوظيف
                    </button>
                    <button type="button" id="tpEditTabBtn_achievements" onclick="window.switchProfileEditTab('achievements')" style="padding: 7px 14px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; color: #475569; font-size: 0.8rem; font-weight: 800; cursor: pointer; white-space: nowrap;">
                        🏆 الإنجازات والأنشطة التربوية
                    </button>
                    <button type="button" id="tpEditTabBtn_qualifications" onclick="window.switchProfileEditTab('qualifications')" style="padding: 7px 14px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; color: #475569; font-size: 0.8rem; font-weight: 800; cursor: pointer; white-space: nowrap;">
                        🎓 الشواهد والمسار الأكاديمي
                    </button>
                    <button type="button" id="tpEditTabBtn_career" onclick="window.switchProfileEditTab('career')" style="padding: 7px 14px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; color: #475569; font-size: 0.8rem; font-weight: 800; cursor: pointer; white-space: nowrap;">
                        🏢 المسار الوظيفي والمؤسسات
                    </button>
                    <button type="button" id="tpEditTabBtn_trainings" onclick="window.switchProfileEditTab('trainings')" style="padding: 7px 14px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; color: #475569; font-size: 0.8rem; font-weight: 800; cursor: pointer; white-space: nowrap;">
                        💡 التكوين المستمر (الساعات)
                    </button>
                    <button type="button" onclick="window.openTeacherPhotoLogoModal()" style="padding: 7px 14px; border-radius: 8px; border: 1px solid #0284c7; background: #e0f2fe; color: #0369a1; font-size: 0.8rem; font-weight: 800; cursor: pointer; white-space: nowrap;">
                        📷 الصورة الشخصية / الشعار
                    </button>
                </div>

                <!-- جسم النافذة القابل للتمرير -->
                <div style="flex: 1; overflow-y: auto; padding: 20px 24px;">
                    
                    <!-- 1. لوحة البيانات الإدارية والتوظيف -->
                    <div id="tpEditPane_info" style="display: block;">
                        <div style="font-weight: 800; font-size: 0.88rem; color: #1e3a8a; margin-bottom: 14px; border-bottom: 1.5px solid #dbeafe; padding-bottom: 6px;">
                            📌 البيانات الشخصية والإدارية ومقر العمل
                        </div>
                        
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 16px;">
                            <div>
                                <label style="display: block; font-size: 0.78rem; font-weight: 800; color: #334155; margin-bottom: 4px;">الاسم الكامل للأستاذ(ة) بالعربية *</label>
                                <input type="text" id="tpInput_name" style="width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem; font-weight: 700;">
                            </div>
                            <div>
                                <label style="display: block; font-size: 0.78rem; font-weight: 800; color: #334155; margin-bottom: 4px;">الاسم بالفرنسية / اللاتينية (Nom et Prénom)</label>
                                <input type="text" id="tpInput_nameFr" style="width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem; font-family: sans-serif;">
                            </div>
                            <div>
                                <label style="display: block; font-size: 0.78rem; font-weight: 800; color: #334155; margin-bottom: 4px;">رقم التأجير (PPR / SOM)</label>
                                <input type="text" id="tpInput_ppr" placeholder="مثال: 1234567" style="width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem; font-family: monospace;">
                            </div>
                            <div>
                                <label style="display: block; font-size: 0.78rem; font-weight: 800; color: #334155; margin-bottom: 4px;">رقم البطاقة الوطنية (CNIE)</label>
                                <input type="text" id="tpInput_cin" placeholder="مثال: AB123456" style="width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem; font-family: monospace;">
                            </div>
                        </div>

                        <div style="font-weight: 800; font-size: 0.88rem; color: #1e3a8a; margin-bottom: 14px; border-bottom: 1.5px solid #dbeafe; padding-bottom: 6px;">
                            🏛️ التوظيف والأقدمية والإطار الإداري
                        </div>

                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 16px;">
                            <div>
                                <label style="display: block; font-size: 0.78rem; font-weight: 800; color: #047857; margin-bottom: 4px;">📅 تاريخ التوظيف الرسمي بالوزارة *</label>
                                <input type="date" id="tpInput_hireDate" style="width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1.5px solid #a7f3d0; border-radius: 8px; font-size: 0.88rem; font-weight: 700;">
                            </div>
                            <div>
                                <label style="display: block; font-size: 0.78rem; font-weight: 800; color: #334155; margin-bottom: 4px;">تاريخ التسمية في الدرجة الحالية</label>
                                <input type="date" id="tpInput_gradeDate" style="width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem;">
                            </div>
                            <div>
                                <label style="display: block; font-size: 0.78rem; font-weight: 800; color: #334155; margin-bottom: 4px;">تاريخ التعيين بالمؤسسة الحالية</label>
                                <input type="date" id="tpInput_schoolSeniorityDate" style="width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem;">
                            </div>
                            <div>
                                <label style="display: block; font-size: 0.78rem; font-weight: 800; color: #334155; margin-bottom: 4px;">الإطار (الدرجة الإدارية)</label>
                                <input type="text" id="tpInput_framework" placeholder="أستاذ التعليم الثانوي التأهيلي..." style="width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem; font-weight: 700;">
                            </div>
                            <div>
                                <label style="display: block; font-size: 0.78rem; font-weight: 800; color: #334155; margin-bottom: 4px;">السلم والدرجة</label>
                                <input type="text" id="tpInput_scale" placeholder="السلم 11 - الدرجة الأولى..." style="width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem;">
                            </div>
                            <div>
                                <label style="display: block; font-size: 0.78rem; font-weight: 800; color: #334155; margin-bottom: 4px;">الرتبة الحالية</label>
                                <input type="text" id="tpInput_echelon" placeholder="الرتبة 6..." style="width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem;">
                            </div>
                        </div>

                        <div style="font-weight: 800; font-size: 0.88rem; color: #1e3a8a; margin-bottom: 14px; border-bottom: 1.5px solid #dbeafe; padding-bottom: 6px;">
                            🏫 المؤسسة والمديرية ومعلومات التواصل
                        </div>

                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 16px;">
                            <div>
                                <label style="display: block; font-size: 0.78rem; font-weight: 800; color: #334155; margin-bottom: 4px;">المؤسسة التعليمية الحالية</label>
                                <input type="text" id="tpInput_school" style="width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem; font-weight: 700;">
                            </div>
                            <div>
                                <label style="display: block; font-size: 0.78rem; font-weight: 800; color: #334155; margin-bottom: 4px;">المديرية الإقليمية</label>
                                <input type="text" id="tpInput_directorate" style="width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem;">
                            </div>
                            <div>
                                <label style="display: block; font-size: 0.78rem; font-weight: 800; color: #334155; margin-bottom: 4px;">الأكاديمية الجهوية</label>
                                <input type="text" id="tpInput_academy" style="width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem;">
                            </div>
                            <div>
                                <label style="display: block; font-size: 0.78rem; font-weight: 800; color: #334155; margin-bottom: 4px;">مادة التخصص والتدريس</label>
                                <input type="text" id="tpInput_specialty" style="width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem; font-weight: 700;">
                            </div>
                            <div>
                                <label style="display: block; font-size: 0.78rem; font-weight: 800; color: #334155; margin-bottom: 4px;">البريد الإلكتروني المهني (taalim.ma)</label>
                                <input type="email" id="tpInput_email" placeholder="prenom.nom@taalim.ma" style="width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem; font-family: monospace;">
                            </div>
                            <div>
                                <label style="display: block; font-size: 0.78rem; font-weight: 800; color: #334155; margin-bottom: 4px;">رقم الهاتف الشخصي / واتساب</label>
                                <input type="tel" id="tpInput_phone" placeholder="06XXXXXXXX" style="width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem; font-family: monospace;">
                            </div>
                        </div>

                        <div>
                            <label style="display: block; font-size: 0.78rem; font-weight: 800; color: #334155; margin-bottom: 4px;">النبذة المهنية وفلسفة التدريس</label>
                            <textarea id="tpInput_bio" rows="3" style="width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem; resize: vertical; line-height: 1.5;"></textarea>
                        </div>
                    </div>

                    <!-- 2. لوحة الإنجازات والأنشطة التربوية -->
                    <div id="tpEditPane_achievements" style="display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                            <div style="font-weight: 800; font-size: 0.88rem; color: #7c3aed;">
                                🏆 قائمة الإنجازات والمشاريع التربوية والديداكتيكية
                            </div>
                            <button type="button" onclick="window.addNewAchievement()" style="background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #fff; border: none; padding: 6px 14px; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer;">
                                ➕ إضافة إنجاز جديد
                            </button>
                        </div>
                        <div id="tpAchievementsEditList"></div>
                    </div>

                    <!-- 3. لوحة الشواهد والمسار الأكاديمي -->
                    <div id="tpEditPane_qualifications" style="display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                            <div style="font-weight: 800; font-size: 0.88rem; color: #2563eb;">
                                🎓 الشواهد الجامعية والتأهيلية
                            </div>
                            <button type="button" onclick="window.addNewQualification()" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff; border: none; padding: 6px 14px; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer;">
                                ➕ إضافة شهادة
                            </button>
                        </div>
                        <div id="tpQualificationsEditList"></div>
                    </div>

                    <!-- 4. لوحة المسار الوظيفي والمؤسسات -->
                    <div id="tpEditPane_career" style="display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                            <div style="font-weight: 800; font-size: 0.88rem; color: #0284c7;">
                                🏢 محطات المسار المهني والمؤسسات التعليمية السابقة
                            </div>
                            <button type="button" onclick="window.addNewCareerStation()" style="background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff; border: none; padding: 6px 14px; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer;">
                                ➕ إضافة محطة وظيفية
                            </button>
                        </div>
                        <div id="tpCareerStationsEditList"></div>
                    </div>

                    <!-- 5. لوحة التكوين المستمر -->
                    <div id="tpEditPane_trainings" style="display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                            <div style="font-weight: 800; font-size: 0.88rem; color: #059669;">
                                💡 دورات التكوين المستمر وعدد الساعات التدريبية
                            </div>
                            <button type="button" onclick="window.addNewTraining()" style="background: linear-gradient(135deg, #059669, #047857); color: #fff; border: none; padding: 6px 14px; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer;">
                                ➕ إضافة دورة تكوينية
                            </button>
                        </div>
                        <div id="tpTrainingsEditList"></div>
                    </div>

                </div>

                <!-- تذييل النافذة: أزرار الحفظ والإلغاء -->
                <div style="padding: 14px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px; align-items: center;">
                    <button type="button" onclick="window.closeEditTeacherProfileModal()" style="background: #ffffff; border: 1.5px solid #cbd5e1; color: #475569; padding: 9px 18px; border-radius: 8px; font-weight: 800; font-size: 0.85rem; cursor: pointer;">
                        إلغاء
                    </button>
                    <button type="button" onclick="window.saveTeacherProfileData()" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; border: none; padding: 9px 24px; border-radius: 8px; font-weight: 900; font-size: 0.88rem; cursor: pointer; box-shadow: 0 4px 12px rgba(37,99,235,0.35);">
                        💾 حفظ وتحديث الملف المهني
                    </button>
                </div>

            </div>
        `;

        document.body.appendChild(modalDiv);
    }

    /**
     * بناء محتوى الوثيقة الرسمية للملف المهني للأستاذ (تجمع المعلومات الشخصية، الرسوم البيانية للخبرة والشواهد والتكوين، والمسار الوظيفي)
     */
    function buildOfficialTeacherProfileDocumentInnerHtml() {
        const tp = getTeacherProfile();
        const seniority = calculateDetailedSeniority(tp.hireDate);
        const schoolSeniority = calculateDetailedSeniority(tp.schoolSeniorityDate || tp.hireDate);
        const gradeSeniority = calculateDetailedSeniority(tp.gradeDate || tp.hireDate);
        const stats = calculateLiveTeachingStats();

        const escapeHtml = (str) => {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        };

        const hasAvatar = !!(tp.avatarDataUrl && tp.avatarDataUrl.startsWith('data:image'));
        const hasLogo = !!(tp.schoolLogoDataUrl && tp.schoolLogoDataUrl.startsWith('data:image'));

        // حساب بيانات الرسوم البيانية الثلاثة للوثيقة الرسمية
        const totalExpYears = Math.max(0.5, seniority.decimalYears || 1);
        const schoolExpYears = Math.max(0.5, schoolSeniority.decimalYears || 1);
        const gradeExpYears = Math.max(0.5, gradeSeniority.decimalYears || 1);
        const maxRefYears = Math.max(totalExpYears, 15);
        const totalExpPct = Math.min(100, Math.round((totalExpYears / maxRefYears) * 100));
        const schoolExpPct = Math.min(100, Math.round((schoolExpYears / maxRefYears) * 100));
        const gradeExpPct = Math.min(100, Math.round((gradeExpYears / maxRefYears) * 100));

        const quals = tp.qualifications || [];
        const trainings = tp.trainings || [];
        const achievements = tp.achievements || [];
        const careerStations = tp.careerStations || [];

        let academicCerts = 0;
        let pedagogicalCerts = 0;
        quals.forEach(q => {
            const t = ((q.title || '') + ' ' + (q.type || '') + ' ' + (q.institution || '')).toLowerCase();
            if (t.includes('تأهيل') || t.includes('كفاءة') || t.includes('crmef') || t.includes('تربو') || t.includes('مهن')) {
                pedagogicalCerts++;
            } else {
                academicCerts++;
            }
        });
        const trainingCerts = trainings.length;
        const honorCerts = achievements.filter(a => {
            const t = ((a.title || '') + ' ' + (a.category || '')).toLowerCase();
            return t.includes('شهادة') || t.includes('تقدير') || t.includes('تكريم') || t.includes('أولمبياد') || t.includes('تميز') || a.categoryKey === 'honor' || a.categoryKey === 'olympiad';
        }).length || Math.min(2, achievements.length);

        const certCategories = [
            { label: 'شواهد جامعية وأكاديمية', count: academicCerts, color: '#2563eb' },
            { label: 'شواهد التأهيل والكفاءة التربوية', count: pedagogicalCerts, color: '#7c3aed' },
            { label: 'شواهد التكوين المستمر', count: trainingCerts, color: '#10b981' },
            { label: 'شواهد التقدير والتميز التربوي', count: honorCerts, color: '#f59e0b' }
        ];
        const totalCertificatesCount = certCategories.reduce((sum, c) => sum + c.count, 0) || 1;

        const radius = 42;
        const circumference = +(2 * Math.PI * radius).toFixed(2);
        let accumulatedPercent = 0;
        const donutSegmentsSvg = certCategories.map(cat => {
            if (cat.count <= 0) return '';
            const pct = cat.count / totalCertificatesCount;
            const dashLength = +(pct * circumference).toFixed(2);
            const dashOffset = +(-accumulatedPercent * circumference).toFixed(2);
            accumulatedPercent += pct;
            return `<circle cx="52" cy="52" r="${radius}" fill="transparent" stroke="${cat.color}" stroke-width="14" stroke-dasharray="${dashLength} ${circumference}" stroke-dashoffset="${dashOffset}" transform="rotate(-90 52 52)" />`;
        }).join('');

        const trainingItemsWithHours = trainings.map((tr, i) => {
            const hrs = parseTrainingHours(tr);
            const yrMatch = String(tr.year || '').match(/\d{4}/);
            const yr = yrMatch ? yrMatch[0] : String(tr.year || (2023 + i));
            return {
                title: tr.title || `دورة ${i + 1}`,
                year: yr,
                provider: tr.provider || '',
                hours: hrs
            };
        });
        const totalTrainingHours = trainingItemsWithHours.reduce((sum, item) => sum + item.hours, 0);
        const maxCourseHours = Math.max(...trainingItemsWithHours.map(item => item.hours), 40);
        const trainingColors = ['#10b981', '#0284c7', '#7c3aed', '#f59e0b', '#ec4899', '#2563eb'];

        return `
            <div class="official-profile-pdf-sheet" style="font-family: 'Tajawal', 'Cairo', system-ui, -apple-system, sans-serif; color: #0f172a; direction: rtl; text-align: right; line-height: 1.45; font-size: 11.5px; background: #ffffff; padding: 18px 22px; box-sizing: border-box;">
                
                <!-- 1. الترويسة الرسمية للوثيقة -->
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 14px; gap: 12px;">
                    <div style="width: 82px; text-align: right; flex-shrink: 0;">
                        ${hasLogo ? `
                            <img src="${tp.schoolLogoDataUrl}" alt="شعار المؤسسة" style="width: 74px; height: 74px; object-fit: contain; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 4px; background: #fff;" />
                        ` : `
                            <div style="width: 74px; height: 74px; border: 1.5px dashed #cbd5e1; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #64748b; text-align: center; font-weight: 700;">شعار المؤسسة</div>
                        `}
                    </div>

                    <div style="text-align: center; flex: 1;">
                        <div style="font-size: 14px; font-weight: 900; color: #1e3a8a; margin-bottom: 2px;">المملكة المغربية • وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
                        <div style="font-size: 11.5px; font-weight: 800; color: #0284c7; margin-bottom: 2px;">${escapeHtml(tp.academy || 'الأكاديمية الجهوية للتربية والتكوين')}</div>
                        <div style="font-size: 11px; font-weight: 700; color: #334155; margin-bottom: 6px;">المديرية الإقليمية: ${escapeHtml(tp.directorate || 'المديرية')} | المؤسسة: ${escapeHtml(tp.school || 'المؤسسة التعليمية')}</div>
                        <div style="display: inline-block; background: #eff6ff; border: 1.5px solid #1e3a8a; color: #1e3a8a; font-size: 13px; font-weight: 900; padding: 4px 18px; border-radius: 999px;">
                            الملف المهني الرسمي ومسار الخبرة والإنجازات التربوية للأستاذ(ة)
                        </div>
                    </div>

                    <div style="width: 82px; text-align: left; flex-shrink: 0;">
                        ${hasAvatar ? `
                            <img src="${tp.avatarDataUrl}" alt="صورة الأستاذ" style="width: 74px; height: 74px; object-fit: cover; border: 2px solid #1e3a8a; border-radius: 12px;" />
                        ` : `
                            <div style="width: 74px; height: 74px; border: 2px solid #1e3a8a; border-radius: 12px; background: #eff6ff; color: #1e3a8a; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 900;">${escapeHtml(tp.name ? tp.name.trim().charAt(0) : 'أ')}</div>
                        `}
                    </div>
                </div>

                <!-- 2. المعلومات الشخصية والوضعية الإدارية والنظامية -->
                <div style="font-size: 12px; font-weight: 900; color: #1e3a8a; background: #f1f5f9; border-right: 4px solid #1e3a8a; padding: 5px 10px; margin: 10px 0 8px 0;">
                    أولاً: المعلومات الشخصية والوضعية الإدارية والنظامية
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px;">
                    <tbody>
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 5px 8px; background: #f8fafc; font-weight: 800; width: 18%;">الاسم الكامل:</td>
                            <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: 900; width: 32%;">${escapeHtml(tp.name)} ${tp.nameFr ? `(${escapeHtml(tp.nameFr)})` : ''}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 5px 8px; background: #f8fafc; font-weight: 800; width: 18%;">رقم التأجير (PPR):</td>
                            <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: 900; font-family: monospace; width: 32%;">${escapeHtml(tp.ppr || '-')} | ب.ت.و: ${escapeHtml(tp.cin || '-')}</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 5px 8px; background: #f8fafc; font-weight: 800;">الإطار والدرجة:</td>
                            <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: 800; color: #1d4ed8;">${escapeHtml(tp.framework || 'أستاذ التعليم الثانوي التأهيلي')}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 5px 8px; background: #f8fafc; font-weight: 800;">السلم والرتبة:</td>
                            <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: 800;">${escapeHtml(tp.scale || 'السلم 11')} (${escapeHtml(tp.echelon || '-')})</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 5px 8px; background: #f8fafc; font-weight: 800;">تاريخ التوظيف الرسمي:</td>
                            <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: 900; color: #047857;">${escapeHtml(tp.hireDate || '-')} (الأقدمية: ${seniority.formatted})</td>
                            <td style="border: 1px solid #cbd5e1; padding: 5px 8px; background: #f8fafc; font-weight: 800;">التعيين بالمؤسسة الحالية:</td>
                            <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: 800;">${escapeHtml(tp.schoolSeniorityDate || tp.hireDate || '-')} (${schoolSeniority.formatted})</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 5px 8px; background: #f8fafc; font-weight: 800;">مادة التخصص:</td>
                            <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: 800;">${escapeHtml(tp.specialty || 'الرياضيات')}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 5px 8px; background: #f8fafc; font-weight: 800;">البريد المهني والهاتف:</td>
                            <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-family: monospace;">${escapeHtml(tp.email || '-')} ${tp.phone ? ' | ' + escapeHtml(tp.phone) : ''}</td>
                        </tr>
                    </tbody>
                </table>

                <!-- 3. الرسوم البيانية للخبرة والشواهد وساعات التكوين المستمر -->
                <div style="font-size: 12px; font-weight: 900; color: #1e3a8a; background: #f1f5f9; border-right: 4px solid #7c3aed; padding: 5px 10px; margin: 12px 0 8px 0;">
                    ثانياً: الرسوم البيانية التحليلية للخبرة المهنية وتوزيع الشواهد وساعات التكوين المستمر
                </div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px;">
                    
                    <!-- رسم 1: مؤشرات الخبرة والأقدمية -->
                    <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; background: #f8fafc;">
                        <div style="font-weight: 900; font-size: 10.5px; color: #1e3a8a; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
                            1. مؤشر سنوات الخبرة والأقدمية (${seniority.years} سنة)
                        </div>
                        <div style="margin-bottom: 6px;">
                            <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 800; margin-bottom: 2px;">
                                <span>الأقدمية العامة بالقطاع</span>
                                <span style="color: #2563eb;">${seniority.decimalYears} سنة</span>
                            </div>
                            <div style="height: 7px; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
                                <div style="width: ${Math.max(15, totalExpPct)}%; height: 100%; background: #2563eb; border-radius: 999px;"></div>
                            </div>
                        </div>
                        <div style="margin-bottom: 6px;">
                            <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 800; margin-bottom: 2px;">
                                <span>الأقدمية بالمؤسسة الحالية</span>
                                <span style="color: #0284c7;">${schoolSeniority.decimalYears} سنة</span>
                            </div>
                            <div style="height: 7px; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
                                <div style="width: ${Math.max(12, schoolExpPct)}%; height: 100%; background: #0284c7; border-radius: 999px;"></div>
                            </div>
                        </div>
                        <div style="margin-bottom: 6px;">
                            <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 800; margin-bottom: 2px;">
                                <span>الأقدمية في الدرجة</span>
                                <span style="color: #7c3aed;">${gradeSeniority.decimalYears} سنة</span>
                            </div>
                            <div style="height: 7px; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
                                <div style="width: ${Math.max(12, gradeExpPct)}%; height: 100%; background: #7c3aed; border-radius: 999px;"></div>
                            </div>
                        </div>
                        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 4px 6px; font-size: 9.5px; font-weight: 800; color: #1e3a8a; text-align: center;">
                            تاريخ التوظيف: ${escapeHtml(tp.hireDate || '-')} • ${careerStations.length} محطات مهنية
                        </div>
                    </div>

                    <!-- رسم 2: توزيع الشواهد المحصل عليها -->
                    <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; background: #f8fafc;">
                        <div style="font-weight: 900; font-size: 10.5px; color: #6d28d9; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
                            2. توزيع الشواهد والمؤهلات (${totalCertificatesCount} شواهد)
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="position: relative; width: 104px; height: 104px; flex-shrink: 0;">
                                <svg width="104" height="104" viewBox="0 0 104 104">
                                    <circle cx="52" cy="52" r="${radius}" fill="transparent" stroke="#e2e8f0" stroke-width="14" />
                                    ${donutSegmentsSvg}
                                </svg>
                                <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
                                    <span style="font-size: 15px; font-weight: 900; color: #0f172a; line-height: 1;">${totalCertificatesCount}</span>
                                    <span style="font-size: 8.5px; font-weight: 800; color: #64748b;">شهادة</span>
                                </div>
                            </div>
                            <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
                                ${certCategories.map(cat => {
                                    const pct = Math.round((cat.count / totalCertificatesCount) * 100);
                                    return `
                                        <div style="font-size: 9.5px;">
                                            <div style="display: flex; justify-content: space-between; font-weight: 800; color: #1e293b;">
                                                <span style="display: inline-flex; align-items: center; gap: 4px;">
                                                    <span style="width: 7px; height: 7px; border-radius: 2px; background: ${cat.color}; display: inline-block;"></span>
                                                    <span>${cat.label}</span>
                                                </span>
                                                <span style="color: ${cat.color};">${cat.count} (${pct}%)</span>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>

                    <!-- رسم 3: ساعات التكوين المستمر -->
                    <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; background: #f8fafc;">
                        <div style="font-weight: 900; font-size: 10.5px; color: #047857; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
                            3. ساعات التكوين المستمر (${totalTrainingHours} ساعة معتمدة)
                        </div>
                        <div style="display: flex; align-items: flex-end; justify-content: space-around; height: 68px; gap: 6px; padding-bottom: 4px; border-bottom: 1px solid #cbd5e1; background: #ffffff; border-radius: 6px 6px 0 0; padding: 6px;">
                            ${trainingItemsWithHours.slice(0, 5).map((item, idx) => {
                                const barH = Math.max(12, Math.round((item.hours / maxCourseHours) * 44));
                                const col = trainingColors[idx % trainingColors.length];
                                return `
                                    <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%;">
                                        <span style="font-size: 8.5px; font-weight: 900; color: ${col}; margin-bottom: 2px;">${item.hours}س</span>
                                        <div style="width: 100%; max-width: 24px; height: ${barH}px; background: ${col}; border-radius: 4px 4px 0 0;"></div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        <div style="display: flex; justify-content: space-around; gap: 4px; padding-top: 3px; margin-bottom: 4px;">
                            ${trainingItemsWithHours.slice(0, 5).map(item => `
                                <div style="flex: 1; text-align: center; font-size: 8.5px; font-weight: 800; color: #475569;">${escapeHtml(item.year)}</div>
                            `).join('')}
                        </div>
                        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 3px 6px; font-size: 9.5px; font-weight: 800; color: #065f46; text-align: center;">
                            ${trainingItemsWithHours.length} دورات تكوينية • مؤشر الكفاية: ${Math.min(100, Math.round((totalTrainingHours / 100) * 100))}%
                        </div>
                    </div>

                </div>

                <!-- 4. المسار الوظيفي والمحطات المهنية والشواهد الأكاديمية -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 10px;">
                    <div>
                        <div style="font-size: 11.5px; font-weight: 900; color: #1e3a8a; background: #f1f5f9; border-right: 4px solid #0284c7; padding: 4px 8px; margin-bottom: 6px;">
                            ثالثاً: المسار الوظيفي والمؤسسات التعليمية
                        </div>
                        <table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
                            <thead>
                                <tr style="background: #f8fafc;">
                                    <th style="border: 1px solid #cbd5e1; padding: 4px 6px;">المؤسسة والمديرية</th>
                                    <th style="border: 1px solid #cbd5e1; padding: 4px 6px;">الصفة / المهام</th>
                                    <th style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; width: 85px;">الفترة</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${careerStations.map(c => `
                                    <tr>
                                        <td style="border: 1px solid #cbd5e1; padding: 4px 6px;"><strong>${escapeHtml(c.school)}</strong><br><span style="color: #64748b; font-size: 9.5px;">${escapeHtml(c.directorate || '')}</span></td>
                                        <td style="border: 1px solid #cbd5e1; padding: 4px 6px;">${escapeHtml(c.role || '')} ${c.tasks ? '<br><span style="color:#475569;font-size:9.5px;">' + escapeHtml(c.tasks) + '</span>' : ''}</td>
                                        <td style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; font-family: monospace; font-weight: 700;">${escapeHtml(c.period || '')}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <div>
                        <div style="font-size: 11.5px; font-weight: 900; color: #1e3a8a; background: #f1f5f9; border-right: 4px solid #7c3aed; padding: 4px 8px; margin-bottom: 6px;">
                            رابعاً: الشواهد الجامعية والتأهيل التربوي
                        </div>
                        <table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
                            <thead>
                                <tr style="background: #f8fafc;">
                                    <th style="border: 1px solid #cbd5e1; padding: 4px 6px;">الشهادة / الدبلوم</th>
                                    <th style="border: 1px solid #cbd5e1; padding: 4px 6px;">المؤسسة المانحة</th>
                                    <th style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; width: 65px;">السنة</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${quals.map(q => `
                                    <tr>
                                        <td style="border: 1px solid #cbd5e1; padding: 4px 6px;"><strong>${escapeHtml(q.title)}</strong> ${q.grade ? '<span style="color:#047857;font-size:9.5px;">(' + escapeHtml(q.grade) + ')</span>' : ''}</td>
                                        <td style="border: 1px solid #cbd5e1; padding: 4px 6px;">${escapeHtml(q.institution)}</td>
                                        <td style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; font-weight: 700;">${escapeHtml(q.year)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- 5. الإنجازات التربوية ودورات التكوين المستمر -->
                <div style="font-size: 11.5px; font-weight: 900; color: #1e3a8a; background: #f1f5f9; border-right: 4px solid #ea580c; padding: 4px 8px; margin-bottom: 6px;">
                    خامساً: أبرز الإنجازات والمشاريع التربوية والديداكتيكية وحصيلة الموسم (${escapeHtml(tp.academicYear || '2026 / 2027')})
                </div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-bottom: 10px;">
                    ${achievements.map((ach, i) => `
                        <div style="border: 1px solid #cbd5e1; border-right: 3.5px solid ${ach.color || '#2563eb'}; border-radius: 6px; padding: 5px 8px; background: #ffffff;">
                            <div style="display: flex; justify-content: space-between; font-size: 10.5px; font-weight: 900; color: #0f172a;">
                                <span>${i + 1}. ${escapeHtml(ach.title)}</span>
                                <span style="font-size: 9.5px; color: #64748b;">${escapeHtml(ach.date || '')}</span>
                            </div>
                            <div style="font-size: 9.8px; color: #475569; margin-top: 2px;">${escapeHtml(ach.description || '')}</div>
                        </div>
                    `).join('')}
                </div>

                <!-- جدول حصيلة الموسم الدراسي -->
                <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; margin-bottom: 14px;">
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th style="border: 1px solid #cbd5e1; padding: 5px; text-align: center;">الأقسام المسندة</th>
                            <th style="border: 1px solid #cbd5e1; padding: 5px; text-align: center;">إجمالي التلاميذ</th>
                            <th style="border: 1px solid #cbd5e1; padding: 5px; text-align: center;">الحصص الموثقة</th>
                            <th style="border: 1px solid #cbd5e1; padding: 5px; text-align: center;">الفروض والتقويمات</th>
                            <th style="border: 1px solid #cbd5e1; padding: 5px; text-align: center;">ساعات التكوين المستمر</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: center; font-weight: 900;">${stats.classesCount} أقسام</td>
                            <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: center; font-weight: 900;">${stats.studentsCount} تلميذ</td>
                            <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: center; font-weight: 900;">${stats.lessonsCount} حصة</td>
                            <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: center; font-weight: 900;">${stats.examsCount} فرض</td>
                            <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: center; font-weight: 900; color: #047857;">${totalTrainingHours} ساعة تدريبية</td>
                        </tr>
                    </tbody>
                </table>

                <!-- 6. التوقيعات الرسمية -->
                <div style="display: flex; justify-content: space-between; text-align: center; font-weight: 800; font-size: 11px; padding-top: 10px; border-top: 1.5px dashed #cbd5e1; margin-top: 10px;">
                    <div style="flex: 1;">
                        توقيع الأستاذ(ة):<br><br>
                        <strong style="color: #1e3a8a;">${escapeHtml(tp.name)}</strong>
                    </div>
                    <div style="flex: 1;">
                        تأشير وخاتم السيد(ة) رئيس(ة) المؤسسة:<br><br>
                        ..................................................
                    </div>
                    <div style="flex: 1;">
                        تأشير السيد(ة) المفتش(ة) التربوي(ة):<br><br>
                        ..................................................
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * طباعة البطاقة المهنية الرسمية والسيرة الذاتية للأستاذ شاملة الرسوم البيانية والمسار
     */
    function printTeacherProfessionalProfile() {
        const innerDoc = buildOfficialTeacherProfileDocumentInnerHtml();
        const printContent = `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>الملف المهني الرسمي للأستاذ(ة)</title>
                <style>
                    @page { size: A4 portrait; margin: 10mm; }
                    body {
                        margin: 0;
                        padding: 0;
                        background: #ffffff;
                        direction: rtl;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                </style>
            </head>
            <body>
                ${innerDoc}
            </body>
            </html>
        `;

        if (typeof window.printDocumentDirectly === 'function') {
            window.printDocumentDirectly(printContent, 'الملف المهني للأستاذ', 'portrait');
        } else {
            let iframe = document.getElementById('teacherProfilePrintIframe');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'teacherProfilePrintIframe';
                iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
                document.body.appendChild(iframe);
            }
            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(printContent);
            doc.close();
            setTimeout(() => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            }, 300);
        }
    }
    window.printTeacherProfessionalProfile = printTeacherProfessionalProfile;

    /**
     * تصدير الملف المهني بصيغة PDF:
     * يفتح نافذة المعاينة الرسمية الجاهزة للطباعة ويقوم بتوليد وتحميل ملف PDF رسمي يجمع المعلومات الشخصية والرسوم البيانية للخبرة والمسار
     */
    function exportTeacherProfilePDF(autoDownload = false) {
        let modal = document.getElementById('teacherProfilePdfPreviewModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'teacherProfilePdfPreviewModal';
            modal.style.cssText = 'display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.78); backdrop-filter: blur(5px); z-index: 100001; align-items: center; justify-content: center; padding: 16px; direction: rtl; text-align: right; box-sizing: border-box;';
            document.body.appendChild(modal);
        }

        const tp = getTeacherProfile();
        const innerSheetHtml = buildOfficialTeacherProfileDocumentInnerHtml();

        modal.innerHTML = `
            <div style="background: #f1f5f9; border-radius: 18px; width: 100%; max-width: 920px; max-height: 92vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.45); border: 1.5px solid #cbd5e1;">
                
                <!-- شريط أدوات نافذة تصدير PDF والطباعة الرسمية -->
                <div style="padding: 14px 22px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg, #e11d48, #be123c); display: flex; align-items: center; justify-content: center;">
                            <span data-lucide="file-down" data-size="20"></span>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 1.05rem; font-weight: 900;">تصدير الملف المهني بصيغة PDF (الوثيقة الرسمية A4)</h3>
                            <div style="font-size: 0.74rem; color: #cbd5e1;">تجمع المعلومات الشخصية، الرسوم البيانية للخبرة والشواهد والتكوين، والمسار الوظيفي</div>
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <button type="button" id="btnDownloadTeacherProfilePdfNow" onclick="window.downloadTeacherProfilePdfFile()" style="background: linear-gradient(135deg, #e11d48, #be123c); color: #ffffff; border: 1px solid rgba(255,255,255,0.25); padding: 8px 16px; border-radius: 9px; font-weight: 900; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(225,29,72,0.4);">
                            <span data-lucide="download" data-size="15"></span>
                            <span>تحميل ملف PDF الآن</span>
                        </button>
                        <button type="button" onclick="window.printTeacherProfessionalProfile()" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; border: 1px solid rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 9px; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                            <span data-lucide="printer" data-size="15"></span>
                            <span>طباعة / حفظ PDF عبر المتصفح</span>
                        </button>
                        <button type="button" onclick="document.getElementById('teacherProfilePdfPreviewModal').style.display='none'" style="background: rgba(255,255,255,0.12); border: none; color: #ffffff; width: 34px; height: 34px; border-radius: 8px; font-size: 1.1rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;">
                            ✕
                        </button>
                    </div>
                </div>

                <!-- منطقة معاينة الوثيقة الرسمية A4 -->
                <div style="flex: 1; overflow-y: auto; padding: 20px; display: flex; justify-content: center; background: #cbd5e1;">
                    <div id="teacherProfilePdfPrintableSheet" style="width: 210mm; max-width: 100%; background: #ffffff; box-shadow: 0 10px 25px rgba(0,0,0,0.18); border-radius: 4px; overflow: hidden;">
                        ${innerSheetHtml}
                    </div>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
        if (typeof window.renderLucide === 'function') {
            window.renderLucide(modal);
        }

        if (autoDownload) {
            setTimeout(() => {
                window.downloadTeacherProfilePdfFile();
            }, 250);
        }
    }
    window.exportTeacherProfilePDF = exportTeacherProfilePDF;

    /**
     * توليد وتنزيل ملف PDF الفعلي باستخدام html2pdf.js مع بديل الطباعة المباشرة
     */
    function downloadTeacherProfilePdfFile() {
        const sheetEl = document.getElementById('teacherProfilePdfPrintableSheet');
        if (!sheetEl) {
            window.printTeacherProfessionalProfile();
            return;
        }

        const tp = getTeacherProfile();
        const safeName = (tp.name || 'الأستاذ').replace(/\s+/g, '_');
        const filename = `الملف_المهني_${safeName}.pdf`;
        const btn = document.getElementById('btnDownloadTeacherProfilePdfNow');
        const originalText = btn ? btn.innerHTML : '';

        if (typeof window.html2pdf === 'function') {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<span>⏳ جاري تجهيز ملف PDF...</span>';
            }
            const opt = {
                margin: [6, 6, 6, 6],
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollY: 0 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            window.html2pdf().set(opt).from(sheetEl).save().then(() => {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                    if (typeof window.renderLucide === 'function') window.renderLucide(btn);
                }
                if (typeof window.showToast === 'function') {
                    window.showToast('✅ تم تصدير وتحميل الملف المهني بصيغة PDF بنجاح');
                }
            }).catch(() => {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                }
                window.printTeacherProfessionalProfile();
            });
        } else {
            window.printTeacherProfessionalProfile();
        }
    }
    window.downloadTeacherProfilePdfFile = downloadTeacherProfilePdfFile;

})();
