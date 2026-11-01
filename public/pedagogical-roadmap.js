/**
 * pedagogical-roadmap.js
 * منظومة المسار البيداغوجي والتسلسل الزمني التفاعلي للمحطات التعليمية الكبرى
 * (الامتحانات، مجالس الأقسام، المذكرات الرسمية) وربطها بالأقسام المسندة
 * مع نظرة بانورامية على السنة الدراسية، مؤشرات إنجاز، وفلاتر ذكية.
 */

(function () {
    'use strict';

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // الحالة العامة للمسار البيداغوجي
    const roadmapState = {
        filterClass: 'all',
        filterSemester: 'all',
        filterCategory: 'all',
        filterStatus: 'all',
        searchQuery: '',
        viewMode: 'timeline' // 'timeline' أو 'table'
    };

    /**
     * استخراج وتوحيد قائمة المحطات البيداغوجية
     */
    function getRoadmapMilestones() {
        if (typeof window.getAcademicMilestones === 'function') {
            return window.getAcademicMilestones();
        }
        if (window.db && Array.isArray(window.db.academicMilestones)) {
            return window.db.academicMilestones;
        }
        return [];
    }

    /**
     * حساب وتحديث حالة المحطة (جارية، قادمة، منجزة، منقضية) مع العد التنازلي
     */
    function evaluateMilestoneStatus(ms) {
        const todayStr = new Date().toISOString().split('T')[0];
        const start = ms.startDate || ms.date || todayStr;
        const end = ms.endDate || start;

        const isCompleted = !!ms.isCompleted;

        // حساب فارق الأيام
        const todayMs = new Date(todayStr + 'T00:00:00').getTime();
        const startMs = new Date(start + 'T00:00:00').getTime();
        const endMs = new Date(end + 'T00:00:00').getTime();

        const diffStartDays = Math.round((startMs - todayMs) / (1000 * 60 * 60 * 24));
        const diffEndDays = Math.round((endMs - todayMs) / (1000 * 60 * 60 * 24));

        let status = 'upcoming'; // قادمة
        let statusBadge = '';
        let statusColor = '#2563eb';
        let statusBg = '#eff6ff';
        let statusBorder = '#bfdbfe';

        if (isCompleted) {
            status = 'completed';
            statusBadge = '✅ منجزة ومحققة';
            statusColor = '#065f46';
            statusBg = '#ecfdf5';
            statusBorder = '#a7f3d0';
        } else if (todayStr >= start && todayStr <= end) {
            status = 'active';
            statusBadge = '⏳ جارية حالياً';
            statusColor = '#9a3412';
            statusBg = '#fff7ed';
            statusBorder = '#fdba74';
        } else if (todayStr > end) {
            status = 'past';
            statusBadge = '⌛ منقضية الموعد';
            statusColor = '#475569';
            statusBg = '#f1f5f9';
            statusBorder = '#cbd5e1';
        } else {
            status = 'upcoming';
            if (diffStartDays === 1) {
                statusBadge = '⚡ تبدأ غداً';
                statusColor = '#b45309';
                statusBg = '#fef3c7';
                statusBorder = '#fde68a';
            } else if (diffStartDays <= 7) {
                statusBadge = `📅 بعد ${diffStartDays} أيام`;
                statusColor = '#1d4ed8';
                statusBg = '#eff6ff';
                statusBorder = '#bfdbfe';
            } else {
                statusBadge = `📅 بعد ${diffStartDays} يوماً`;
                statusColor = '#4338ca';
                statusBg = '#e0e7ff';
                statusBorder = '#c7d2fe';
            }
        }

        return {
            status,
            statusBadge,
            statusColor,
            statusBg,
            statusBorder,
            diffStartDays,
            diffEndDays,
            isCompleted
        };
    }

    /**
     * فحص هل المحطة تنطبق على قسم معين مع دعم ذكي لمستويات التأهيلي (جذع مشترك، 1 باك، 2 باك)
     */
    function doesMilestoneApplyToClass(ms, className) {
        if (!className || className === 'all') return true;
        const target = (ms.targetLevels || '').trim();
        if (!target) return true;

        if (target.includes('جميع الأقسام') || 
            target.includes('جميع المستويات') || 
            target.includes('كافة المستويات') || 
            target.includes('الثانوي التأهيلي') ||
            target.includes('هيئة التدريس')) {
            return true;
        }

        const normTarget = target.toLowerCase();
        const normClass = className.toLowerCase();

        // 1. المطابقة النصية المباشرة
        const parts = target.split(/[,،;|\n]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
        if (parts.some(p => normClass.includes(p) || p.includes(normClass))) return true;

        // 2. المطابقة الذكية للمستويات التعليمية (الجذوع المشتركة، الأولى باك، الثانية باك)
        const isCommonCore = normClass.includes('tcs') || normClass.includes('tc') || normClass.includes('جذع');
        const is1Bac = normClass.includes('1bac') || normClass.includes('1 bac') || normClass.includes('أولى') || normClass.includes('جهوي');
        const is2Bac = normClass.includes('2bac') || normClass.includes('2 bac') || normClass.includes('ثانية') || normClass.includes('وطني');

        if (isCommonCore && (normTarget.includes('جذع') || normTarget.includes('tcs') || normTarget.includes('tc'))) return true;
        if (is1Bac && (normTarget.includes('أولى') || normTarget.includes('1bac') || normTarget.includes('جهوي') || normTarget.includes('الجهوي'))) return true;
        if (is2Bac && (normTarget.includes('ثانية') || normTarget.includes('2bac') || normTarget.includes('وطني') || normTarget.includes('الوطني'))) return true;

        return false;
    }

    /**
     * استخراج الأقسام المسندة للمحطة لعرضها كأوسمة تفاعلية
     */
    function getMilestoneClassChips(targetLevels) {
        if (!targetLevels || targetLevels.trim() === '') {
            return [{ label: '🏫 جميع الأقسام المسندة', isAll: true }];
        }
        const text = targetLevels.trim();
        if (text.includes('جميع الأقسام') || text.includes('جميع المستويات') || text.includes('كافة المستويات')) {
            return [{ label: '🏫 جميع الأقسام المسندة', isAll: true }];
        }

        const parts = text.split(/[,،;|\n]+/).map(s => s.trim()).filter(Boolean);
        if (parts.length === 0) {
            return [{ label: text, isAll: false }];
        }
        return parts.map(p => ({ label: p, isAll: false }));
    }

    /**
     * تصنيف المحطة وأيقونتها ولونها
     */
    function getMilestoneCategoryMeta(category, ms) {
        const cat = (category || 'assessment').toLowerCase();
        if ((ms && ms.isUnifiedExam) || cat === 'certification' || (ms && ms.title && ms.title.includes('موحد'))) {
            return {
                label: '🏆 امتحانات موحدة وإشهادية',
                badge: '🎯 امتحان موحد',
                color: '#7c3aed',
                bg: '#faf5ff',
                border: '#d8b4fe',
                icon: 'graduation-cap'
            };
        }
        switch (cat) {
            case 'exam':
            case 'exams':
                return {
                    label: '📝 امتحانات وفروض رسمية',
                    badge: 'امتحان',
                    color: '#e11d48',
                    bg: '#fff1f2',
                    border: '#fecdd3',
                    icon: 'award'
                };
            case 'council':
                return {
                    label: '👥 مجالس الأقسام والتوجيه',
                    badge: 'مجلس قسم',
                    color: '#7c3aed',
                    bg: '#faf5ff',
                    border: '#e9d5ff',
                    icon: 'users'
                };
            case 'decree':
            case 'admin':
            case 'massar':
                return {
                    label: '📜 مذكرات ومقررات وزارية',
                    badge: 'مذكرة وزارية',
                    color: '#0284c7',
                    bg: '#f0f9ff',
                    border: '#bae6fd',
                    icon: 'file-text'
                };
            case 'diagnostic':
            case 'assessment':
                return {
                    label: '🎯 تقويم ومراقبة مستمرة',
                    badge: 'مراقبة وتقويم',
                    color: '#059669',
                    bg: '#ecfdf5',
                    border: '#a7f3d0',
                    icon: 'check-square'
                };
            case 'guidance':
                return {
                    label: '🧭 توجيه مدرسي وإعلام',
                    badge: 'توجيه مدرسي',
                    color: '#d97706',
                    bg: '#fffbeb',
                    border: '#fde68a',
                    icon: 'compass'
                };
            case 'start':
            case 'entry':
            default:
                return {
                    label: '📌 محطات تنظيمية وإدارية',
                    badge: 'محطة مدرسية',
                    color: '#2563eb',
                    bg: '#eff6ff',
                    border: '#bfdbfe',
                    icon: 'milestone'
                };
        }
    }

    /**
     * تبديل إنجاز المحطة وحفظها في قاعدة البيانات
     */
    function toggleMilestoneCompletion(id, event) {
        if (event) {
            event.stopPropagation();
        }
        const milestones = getRoadmapMilestones();
        const ms = milestones.find(m => m.id === id);
        if (!ms) return;

        ms.isCompleted = !ms.isCompleted;
        ms.completedAt = ms.isCompleted ? new Date().toISOString() : null;

        if (window.db) {
            window.db.academicMilestones = milestones;
            if (typeof window.saveDB === 'function') {
                window.saveDB();
            }
        }

        if (typeof window.syncAllCalendarUnits === 'function') {
            window.syncAllCalendarUnits(false);
        } else {
            renderPedagogicalRoadmap();
        }

        if (typeof window.showToast === 'function') {
            window.showToast(ms.isCompleted ? '✓ تم تسجيل إنجاز المحطة بنجاح' : 'تمت إعادة المحطة لقائمة قيد الإنجاز', 'success');
        }
    }
    window.toggleMilestoneCompletion = toggleMilestoneCompletion;

    /**
     * حذف محطة تربوية مع تنظيف الروابط والفروض المتزامنة دون تعارض
     */
    function deleteMilestoneFromRoadmap(id, event) {
        if (event) event.stopPropagation();
        if (typeof window.deleteAcademicMilestone === 'function') {
            window.deleteAcademicMilestone(id);
            return;
        }
        if (!confirm('هل أنت متأكد من رغبتك في حذف هذه المحطة من المسار البيداغوجي؟')) return;

        const milestones = getRoadmapMilestones();
        const idx = milestones.findIndex(m => m.id === id);
        if (idx >= 0) {
            milestones.splice(idx, 1);
            if (window.db) {
                window.db.academicMilestones = milestones;
                if (Array.isArray(window.db.calendarEvents)) {
                    window.db.calendarEvents = window.db.calendarEvents.filter(ev => ev.milestoneId !== id);
                }
                if (Array.isArray(window.db.upcomingExams)) {
                    window.db.upcomingExams = window.db.upcomingExams.filter(e => e.milestoneId !== id);
                }
                if (typeof window.saveDB === 'function') window.saveDB();
            }
            if (typeof window.syncAllCalendarUnits === 'function') {
                window.syncAllCalendarUnits(false);
            } else {
                renderPedagogicalRoadmap();
            }
            if (typeof window.showToast === 'function') {
                window.showToast('تم حذف المحطة وتنظيف روابط التقويم بنجاح', 'info');
            }
        }
    }
    window.deleteMilestoneFromRoadmap = deleteMilestoneFromRoadmap;

    /**
     * تصفية المسار من أزرار أو عناصر خارجية
     */
    function setRoadmapFilter(type, value) {
        if (type === 'class') roadmapState.filterClass = value;
        else if (type === 'semester') roadmapState.filterSemester = value;
        else if (type === 'category') roadmapState.filterCategory = value;
        else if (type === 'status') roadmapState.filterStatus = value;
        else if (type === 'view') roadmapState.viewMode = value;
        else if (type === 'search') roadmapState.searchQuery = value || '';
        else if (type === 'reset') {
            roadmapState.filterClass = 'all';
            roadmapState.filterSemester = 'all';
            roadmapState.filterCategory = 'all';
            roadmapState.filterStatus = 'all';
            roadmapState.searchQuery = '';
        }
        renderPedagogicalRoadmap();
    }
    window.setRoadmapFilter = setRoadmapFilter;
    window.roadmapState = roadmapState;

    /**
     * بناء وثيقة الطباعة الرسمية للمسار البيداغوجي السنوي (A4 Landscape / Portrait)
     */
    function buildPedagogicalRoadmapPrintHtml(customOptions = {}) {
        const optHeader = customOptions.optHeader !== false;
        const optVisas = customOptions.optVisas !== false;
        const optStats = customOptions.optStats !== false;

        const allMilestones = getRoadmapMilestones();

        // استخراج بيانات الأستاذ والمؤسسة ديناميكياً
        const tp = (window.db && window.db.teacherProfile) || {};
        const st = (window.db && window.db.settings) || {};
        const teacherName = tp.name || st.teacherName || 'الأستاذ إبراهيم قزيبر';
        const schoolName = tp.school || st.schoolName || 'الثانوية التأهيلية';
        const academyName = tp.academy || st.academyName || 'الأكاديمية الجهوية للتربية والتكوين';
        const directorateName = tp.directorate || st.directorateName || 'المديرية الإقليمية';
        const academicYear = tp.academicYear || st.academicYear || '2026 / 2027';
        const issueDate = new Date().toLocaleDateString('ar-MA');
        const dualLogosHtml = (typeof window.getDualLogosHTML === 'function') ? window.getDualLogosHTML({ size: 42 }) : '';

        // تصفية المحطات وفق الفلاتر النشطة أو المخصصة
        const fClass = customOptions.filterClass !== undefined ? customOptions.filterClass : roadmapState.filterClass;
        const fSem = customOptions.filterSemester !== undefined ? customOptions.filterSemester : roadmapState.filterSemester;
        const fCat = customOptions.filterCategory !== undefined ? customOptions.filterCategory : roadmapState.filterCategory;
        const fStat = customOptions.filterStatus !== undefined ? customOptions.filterStatus : roadmapState.filterStatus;
        const fQuery = customOptions.searchQuery !== undefined ? customOptions.searchQuery : roadmapState.searchQuery;

        const filtered = allMilestones.filter(ms => {
            if (fClass && fClass !== 'all') {
                if (!doesMilestoneApplyToClass(ms, fClass)) return false;
            }
            if (fSem && fSem !== 'all') {
                const s = ms.semester || 's1';
                if (fSem === 's1' && s !== 's1' && s !== '1') return false;
                if (fSem === 's2' && s !== 's2' && s !== '2') return false;
                if (fSem === 'year' && s !== 'year') return false;
            }
            if (fCat && fCat !== 'all') {
                const cat = (ms.category || 'assessment').toLowerCase();
                if (fCat === 'exams' && !['exam', 'exams', 'certification'].includes(cat)) return false;
                if (fCat === 'unified' && !(ms.isUnifiedExam || cat === 'certification' || (ms.title && ms.title.includes('موحد')))) return false;
                if (fCat === 'council' && cat !== 'council') return false;
                if (fCat === 'decree' && !['decree', 'admin', 'massar', 'start', 'end', 'orientation', 'guidance'].includes(cat)) return false;
                if (fCat === 'assessment' && !['assessment', 'diagnostic'].includes(cat)) return false;
            }
            const evalState = evaluateMilestoneStatus(ms);
            if (fStat && fStat !== 'all') {
                if (fStat === 'active' && evalState.status !== 'active') return false;
                if (fStat === 'upcoming' && evalState.status !== 'upcoming') return false;
                if (fStat === 'completed' && !evalState.isCompleted) return false;
                if (fStat === 'past' && (evalState.status !== 'past' || evalState.isCompleted)) return false;
            }
            if (fQuery && String(fQuery).trim()) {
                const q = String(fQuery).trim().toLowerCase();
                const title = (ms.title || '').toLowerCase();
                const desc = (ms.description || '').toLowerCase();
                const target = (ms.targetLevels || '').toLowerCase();
                if (!title.includes(q) && !desc.includes(q) && !target.includes(q)) return false;
            }
            return true;
        });

        filtered.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

        const totalCount = filtered.length;
        const completedCount = filtered.filter(m => !!m.isCompleted).length;
        const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        const examsCount = filtered.filter(m => ['exam', 'exams', 'certification'].includes((m.category || '').toLowerCase()) || m.isUnifiedExam).length;
        const councilsCount = filtered.filter(m => (m.category || '').toLowerCase() === 'council').length;

        const semLabelMap = { all: 'السنة الدراسية كاملة (الأسدوس 1 + 2)', s1: 'الدورة الأولى (الأسدوس الأول)', s2: 'الدورة الثانية (الأسدوس الثاني)', year: 'محطات سنوية مستمرة' };
        const activeFilterSummary = `القسم المستهدف: ${fClass === 'all' ? 'جميع الأقسام المسندة' : fClass} • النطاق الزمني: ${semLabelMap[fSem] || semLabelMap.all}`;

        return `
            <div style="font-family: 'Cairo', 'Amiri', sans-serif; direction: rtl; color: #0f172a; background: #ffffff; width: 100%; box-sizing: border-box;">
                ${optHeader ? `
                <div style="border-bottom: 2.5px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 14px;">
                    <div style="height: 3.5px; background: linear-gradient(90deg, #1e3a8a 0%, #d4af37 50%, #15803d 100%); border-radius: 2px; margin-bottom: 8px;"></div>
                    <table style="width: 100%; border-collapse: collapse; border: none;">
                        <tr>
                            <td style="width: 32%; border: none; text-align: right; vertical-align: top; font-size: 0.78rem; line-height: 1.45; font-weight: 700; color: #334155; padding: 0;">
                                <div style="font-weight: 900; color: #0f172a; font-size: 0.92rem;">المملكة المغربية</div>
                                <div style="color: #1e3a8a; font-weight: 800;">وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
                                <div>${escapeHtml(academyName)}</div>
                                <div>${escapeHtml(directorateName)}</div>
                                <div style="color: #0f172a; font-weight: 800; margin-top: 2px;">المؤسسة: <strong style="color: #1e3a8a;">${escapeHtml(schoolName)}</strong></div>
                            </td>
                            <td style="width: 36%; border: none; text-align: center; vertical-align: middle; padding: 0 8px;">
                                <div style="background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #ffffff; padding: 7px 14px; border-radius: 8px; border: 1px solid #1e40af;">
                                    <div style="font-size: 1.05rem; font-weight: 900;">المسار البيداغوجي السنوي وخارطة المحطات التربوية</div>
                                    <div style="font-size: 0.72rem; color: #e0f2fe; font-weight: 700; margin-top: 2px;">${escapeHtml(activeFilterSummary)}</div>
                                </div>
                                <div style="font-size: 0.72rem; font-weight: 800; color: #475569; margin-top: 5px;">
                                    الموسم الدراسي: <strong style="color: #1e3a8a;">${escapeHtml(academicYear)}</strong> • المقرر الوزاري لتنظيم السنة الدراسية
                                </div>
                            </td>
                            <td style="width: 32%; border: none; text-align: left; vertical-align: top; font-size: 0.78rem; line-height: 1.45; font-weight: 700; color: #334155; padding: 0;">
                                <div style="display: flex; justify-content: flex-end; margin-bottom: 4px;">${dualLogosHtml}</div>
                                <div>المادة المدرسة: <strong style="color: #1e3a8a;">الرياضيات (Mathématiques)</strong></div>
                                <div>الأستاذ(ة): <strong style="color: #0f172a;">${escapeHtml(teacherName)}</strong></div>
                                <div style="color: #64748b; font-size: 0.72rem;">تاريخ الاستخراج: <strong style="color: #0f172a;">${issueDate}</strong></div>
                            </td>
                        </tr>
                    </table>
                </div>
                ` : ''}

                ${optStats ? `
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; page-break-inside: avoid;">
                    <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-right: 4px solid #2563eb; border-radius: 8px; padding: 8px 12px;">
                        <div style="font-size: 0.72rem; color: #475569; font-weight: 800;">إجمالي المحطات المبرمجة</div>
                        <div style="font-size: 1.15rem; font-weight: 900; color: #1e3a8a;">${totalCount} محطة تربوية</div>
                    </div>
                    <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; border-right: 4px solid #16a34a; border-radius: 8px; padding: 8px 12px;">
                        <div style="font-size: 0.72rem; color: #166534; font-weight: 800;">المحطات المنجزة ونسبة التقدم</div>
                        <div style="font-size: 1.15rem; font-weight: 900; color: #15803d;">${completedCount} منجزة (${progressPct}%)</div>
                    </div>
                    <div style="background: #fef2f2; border: 1.5px solid #fecaca; border-right: 4px solid #dc2626; border-radius: 8px; padding: 8px 12px;">
                        <div style="font-size: 0.72rem; color: #991b1b; font-weight: 800;">فروض المراقبة والامتحانات الموحدة</div>
                        <div style="font-size: 1.15rem; font-weight: 900; color: #dc2626;">${examsCount} محطة تقويمية</div>
                    </div>
                    <div style="background: #fffbeb; border: 1.5px solid #fde68a; border-right: 4px solid #d97706; border-radius: 8px; padding: 8px 12px;">
                        <div style="font-size: 0.72rem; color: #92400e; font-weight: 800;">المجالس والعمليات الإدارية</div>
                        <div style="font-size: 1.15rem; font-weight: 900; color: #b45309;">${councilsCount} مجلس/عملية</div>
                    </div>
                </div>
                ` : ''}

                <table style="width: 100%; border-collapse: collapse; font-size: 0.78rem; border: 1.5px solid #1e293b;">
                    <thead>
                        <tr style="background: #f1f5f9; color: #0f172a; font-weight: 900;">
                            <th style="border: 1px solid #334155; padding: 7px 6px; width: 32px; text-align: center;">ر.ت</th>
                            <th style="border: 1px solid #334155; padding: 7px 8px; width: 120px; text-align: center;">الفترة والتواريخ</th>
                            <th style="border: 1px solid #334155; padding: 7px 8px; width: 65px; text-align: center;">الدورة</th>
                            <th style="border: 1px solid #334155; padding: 7px 8px; width: 95px; text-align: center;">الصنف التربوي</th>
                            <th style="border: 1px solid #334155; padding: 7px 10px; text-align: right;">عنوان المحطة البيداغوجية والبيانات المرجعية</th>
                            <th style="border: 1px solid #334155; padding: 7px 8px; width: 135px; text-align: right;">الأقسام والمستويات المعنية</th>
                            <th style="border: 1px solid #334155; padding: 7px 8px; width: 95px; text-align: center;">حالة الإنجاز</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length === 0 ? `
                            <tr>
                                <td colspan="7" style="border: 1px solid #cbd5e1; padding: 20px; text-align: center; color: #64748b; font-weight: 800;">
                                    لا توجد محطات تربوية مطابقة لمعايير التصفية المختارة.
                                </td>
                            </tr>
                        ` : filtered.map((ms, idx) => {
                            const evalState = evaluateMilestoneStatus(ms);
                            const catMeta = getMilestoneCategoryMeta(ms.category, ms);
                            const isUni = ms.isUnifiedExam || ms.category === 'certification' || (ms.title && ms.title.includes('موحد'));
                            const semText = (ms.semester === 's2' || ms.semester === '2') ? 'الأسدوس 2' : (ms.semester === 'year' ? 'سنوي' : 'الأسدوس 1');
                            const rowBg = evalState.isCompleted ? '#f0fdf4' : (idx % 2 === 0 ? '#ffffff' : '#f8fafc');
                            return `
                                <tr style="background: ${rowBg}; page-break-inside: avoid;">
                                    <td style="border: 1px solid #475569; padding: 6px; text-align: center; font-weight: 800;">${idx + 1}</td>
                                    <td style="border: 1px solid #475569; padding: 6px 8px; text-align: center; font-family: monospace, sans-serif; font-weight: 800; color: #0f172a;">
                                        <div>${escapeHtml(ms.startDate || '-')}</div>
                                        ${ms.endDate && ms.endDate !== ms.startDate ? `<div style="font-size: 0.7rem; color: #475569;">إلى ${escapeHtml(ms.endDate)}</div>` : ''}
                                        ${ms.timeSlot ? `<div style="font-size: 0.68rem; color: #1d4ed8;">${escapeHtml(ms.timeSlot)}</div>` : ''}
                                    </td>
                                    <td style="border: 1px solid #475569; padding: 6px; text-align: center; font-weight: 700;">${semText}</td>
                                    <td style="border: 1px solid #475569; padding: 6px; text-align: center;">
                                        <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 800; background: ${catMeta.bg}; color: ${catMeta.color}; border: 1px solid ${catMeta.border};">
                                            ${escapeHtml(catMeta.badge)}
                                        </span>
                                    </td>
                                    <td style="border: 1px solid #475569; padding: 6px 10px; text-align: right;">
                                        <div style="font-weight: 900; color: #0f172a; font-size: 0.82rem;">
                                            ${escapeHtml(ms.title)}
                                            ${isUni && ms.coef ? `<span style="font-size: 0.68rem; color: #6d28d9; margin-right: 6px;">[معامل: ${ms.coef}${ms.duration ? ' • المدة: ' + ms.duration + 'س' : ''}]</span>` : ''}
                                        </div>
                                        ${ms.description ? `<div style="font-size: 0.72rem; color: #334155; margin-top: 2px;">${escapeHtml(ms.description)}</div>` : ''}
                                        ${ms.topics ? `<div style="font-size: 0.7rem; color: #1e3a8a; margin-top: 2px; font-weight: 700;">📚 المحاور المرجعية: ${escapeHtml(ms.topics)}</div>` : ''}
                                        ${ms.deliverables ? `<div style="font-size: 0.7rem; color: #9a3412; margin-top: 2px; font-weight: 700;">📋 المخرجات والوثائق: ${escapeHtml(ms.deliverables)}</div>` : ''}
                                    </td>
                                    <td style="border: 1px solid #475569; padding: 6px 8px; text-align: right; font-weight: 700; color: #1e293b; font-size: 0.74rem;">
                                        ${escapeHtml(ms.targetLevels || 'جميع المستويات والأقسام')}
                                    </td>
                                    <td style="border: 1px solid #475569; padding: 6px; text-align: center; font-weight: 800; font-size: 0.72rem; color: ${evalState.statusColor};">
                                        ${evalState.isCompleted ? '✔️ منجزة ومحققة' : escapeHtml(evalState.statusBadge)}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>

                ${optVisas ? `
                <div style="margin-top: 18px; padding-top: 10px; border-top: 1.5px dashed #94a3b8; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; text-align: center; page-break-inside: avoid;">
                    <div style="border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 8px; background: #fafafa; min-height: 74px; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <div style="font-weight: 800; font-size: 0.78rem; color: #0f172a;">توقيع أستاذ(ة) المادة</div>
                            <div style="font-size: 0.74rem; color: #1e3a8a; font-weight: 700; margin-top: 2px;">${escapeHtml(teacherName)}</div>
                        </div>
                        <div style="font-size: 0.68rem; color: #64748b; border-top: 1px dotted #cbd5e1; padding-top: 4px;">الإمضاء: ...........................</div>
                    </div>
                    <div style="border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 8px; background: #fafafa; min-height: 74px; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <div style="font-weight: 800; font-size: 0.78rem; color: #0f172a;">تأشيرة السيد(ة) مدير(ة) المؤسسة / الناظر(ة)</div>
                            <div style="font-size: 0.68rem; color: #64748b; margin-top: 2px;">(مراقبة تنفيذ البرمجة الزمنية والامتحانات)</div>
                        </div>
                        <div style="font-size: 0.68rem; color: #64748b; border-top: 1px dotted #cbd5e1; padding-top: 4px;">الخاتم والتاريخ: ...........................</div>
                    </div>
                    <div style="border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 8px; background: #fafafa; min-height: 74px; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <div style="font-weight: 800; font-size: 0.78rem; color: #0f172a;">تأشيرة السيد(ة) المفتش(ة) التربوي(ة)</div>
                            <div style="font-size: 0.68rem; color: #64748b; margin-top: 2px;">(التأطير التربوي لمادة الرياضيات)</div>
                        </div>
                        <div style="font-size: 0.68rem; color: #64748b; border-top: 1px dotted #cbd5e1; padding-top: 4px;">التأشيرة والملاحظات: ...........................</div>
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    }
    window.buildPedagogicalRoadmapPrintHtml = buildPedagogicalRoadmapPrintHtml;

    /**
     * طباعة المسار البيداغوجي عالي التباين (عبر نافذة المعاينة الرسمية A4 أو الطباعة المباشرة)
     */
    function printPedagogicalRoadmap(customOptions = {}) {
        const htmlContent = buildPedagogicalRoadmapPrintHtml(customOptions);
        const docTitle = 'المسار_البيداغوجي_السنوي_لمادة_الرياضيات';
        const subtitle = 'خارطة الطريق الزمنية للمحطات التربوية وفروض المراقبة المستمرة ومجالس الأقسام (A4)';

        if (typeof window.openCustomPrintPreviewModal === 'function') {
            window.openCustomPrintPreviewModal(htmlContent, {
                title: docTitle,
                subtitle: subtitle,
                orientation: 'landscape'
            });
        } else if (typeof window.printDocumentDirectly === 'function') {
            window.printDocumentDirectly(htmlContent, docTitle, 'landscape');
        } else {
            window.print();
        }
    }
    window.printPedagogicalRoadmap = printPedagogicalRoadmap;

    /**
     * التابع الرئيسي لبناء وعرض المسار البيداغوجي والتسلسل الزمني للمحطات
     */
    function renderPedagogicalRoadmap(targetContainerId) {
        const container = (targetContainerId && document.getElementById(targetContainerId)) ||
                          document.getElementById('calendarRoadmapContentMount') ||
                          document.getElementById('roadmapContentMount');
        if (!container) return;

        const allMilestones = getRoadmapMilestones();

        // 1. استخراج الأقسام المسندة الحالية
        let assignedClasses = [];
        if (typeof getSortedClasses === 'function') {
            assignedClasses = getSortedClasses(false);
        } else if (window.db && window.db.classes) {
            const archived = window.db.archivedClasses || [];
            assignedClasses = Object.keys(window.db.classes).filter(c => !archived.includes(c));
        }

        // 2. تصفية البيانات
        const filtered = allMilestones.filter(ms => {
            // تصفية القسم
            if (roadmapState.filterClass !== 'all') {
                if (!doesMilestoneApplyToClass(ms, roadmapState.filterClass)) return false;
            }

            // تصفية الأسدوس
            if (roadmapState.filterSemester !== 'all') {
                const s = ms.semester || 's1';
                if (roadmapState.filterSemester === 's1' && s !== 's1' && s !== '1') return false;
                if (roadmapState.filterSemester === 's2' && s !== 's2' && s !== '2') return false;
                if (roadmapState.filterSemester === 'year' && s !== 'year') return false;
            }

            // تصفية الصنف
            if (roadmapState.filterCategory !== 'all') {
                const cat = (ms.category || 'assessment').toLowerCase();
                if (roadmapState.filterCategory === 'exams' && !['exam', 'exams', 'certification'].includes(cat)) return false;
                if (roadmapState.filterCategory === 'unified' && !(ms.isUnifiedExam || cat === 'certification' || (ms.title && ms.title.includes('موحد')))) return false;
                if (roadmapState.filterCategory === 'council' && cat !== 'council') return false;
                if (roadmapState.filterCategory === 'decree' && !['decree', 'admin', 'massar', 'start', 'end', 'orientation', 'guidance'].includes(cat)) return false;
                if (roadmapState.filterCategory === 'assessment' && !['assessment', 'diagnostic'].includes(cat)) return false;
            }

            // تقييم الحالة
            const evalState = evaluateMilestoneStatus(ms);

            // تصفية الحالة
            if (roadmapState.filterStatus !== 'all') {
                if (roadmapState.filterStatus === 'active' && evalState.status !== 'active') return false;
                if (roadmapState.filterStatus === 'upcoming' && evalState.status !== 'upcoming') return false;
                if (roadmapState.filterStatus === 'completed' && !evalState.isCompleted) return false;
                if (roadmapState.filterStatus === 'past' && (evalState.status !== 'past' || evalState.isCompleted)) return false;
            }

            // البحث النصي
            if (roadmapState.searchQuery && roadmapState.searchQuery.trim()) {
                const q = roadmapState.searchQuery.trim().toLowerCase();
                const title = (ms.title || '').toLowerCase();
                const desc = (ms.description || '').toLowerCase();
                const target = (ms.targetLevels || '').toLowerCase();
                if (!title.includes(q) && !desc.includes(q) && !target.includes(q)) return false;
            }

            return true;
        });

        // ترتيب زمني تصاعدي
        filtered.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

        // 3. حساب المؤشرات البانورامية (Panoramic KPIs)
        const totalCount = allMilestones.length;
        const completedCount = allMilestones.filter(m => !!m.isCompleted).length;
        const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

        const evaluatedAll = allMilestones.map(m => ({ ms: m, eval: evaluateMilestoneStatus(m) }));
        const currentActive = evaluatedAll.find(e => e.eval.status === 'active' && !e.eval.isCompleted);
        const upcomingList = evaluatedAll.filter(e => e.eval.status === 'upcoming' && !e.eval.isCompleted);
        upcomingList.sort((a, b) => (a.ms.startDate || '').localeCompare(b.ms.startDate || ''));
        const nextUpcoming = upcomingList.length > 0 ? upcomingList[0] : null;

        // 4. بناء الرأس والشريط البانورامي التفاعلي
        let html = `
            <!-- بطاقة المؤشرات البانورامية الكبرى -->
            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border: 1.5px solid #334155; border-radius: 16px; padding: 20px 24px; color: #ffffff; margin-bottom: 20px; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.4); position: relative; overflow: hidden;">
                <!-- Decorative background elements -->
                <div style="position: absolute; top: -40px; left: -40px; width: 140px; height: 140px; border-radius: 50%; background: radial-gradient(circle, rgba(37,99,235,0.25) 0%, transparent 70%); pointer-events: none;"></div>
                <div style="position: absolute; bottom: -30px; right: 20%; width: 180px; height: 180px; border-radius: 50%; background: radial-gradient(circle, rgba(14,165,233,0.2) 0%, transparent 70%); pointer-events: none;"></div>

                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; margin-bottom: 18px; border-bottom: 1px solid rgba(255,255,255,0.12); padding-bottom: 14px; position: relative; z-index: 2;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #2563eb, #1d4ed8); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);">
                            <span data-lucide="route" data-size="24" style="color: #ffffff;"></span>
                        </div>
                        <div>
                            <h2 style="margin: 0; font-size: 1.25rem; font-weight: 900; color: #ffffff; letter-spacing: -0.3px;">
                                المسار البيداغوجي السنوي لمادة الرياضيات
                            </h2>
                            <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 2px;">
                                تسلسل زمني بانورامي للمحطات الكبرى (الامتحانات، مجالس الأقسام، المذكرات) مع ربطها بالأقسام المسندة
                            </div>
                        </div>
                    </div>

                    <!-- أزرار العمليات السريعة -->
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <button type="button" onclick="window.openAddAcademicMilestoneModal('general')" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; border: none; padding: 9px 14px; border-radius: 9px; font-weight: 800; font-size: 0.84rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(37,99,235,0.35); transition: transform 0.15s ease;">
                            <span data-lucide="plus-circle" data-size="16"></span>
                            <span>إضافة محطة بيداغوجية</span>
                        </button>
                        <button type="button" onclick="window.openAddAcademicMilestoneModal('unified')" style="background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #ffffff; border: none; padding: 9px 14px; border-radius: 9px; font-weight: 800; font-size: 0.84rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(124,58,237,0.35); transition: transform 0.15s ease;" title="إضافة وتوثيق امتحان موحد إشهادي أو تجريبي">
                            <span data-lucide="award" data-size="16"></span>
                            <span>🎯 إضافة موحد</span>
                        </button>
                        <button type="button" onclick="window.openDecreeAiImportModal()" style="background: rgba(124, 58, 237, 0.25); color: #c4b5fd; border: 1.5px solid #a78bfa; padding: 9px 14px; border-radius: 9px; font-weight: 800; font-size: 0.84rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; backdrop-filter: blur(4px);">
                            <span data-lucide="sparkles" data-size="16"></span>
                            <span>استيراد المقرر الوزاري AI</span>
                        </button>
                        <button type="button" onclick="printPedagogicalRoadmap()" style="background: rgba(255,255,255,0.1); color: #f1f5f9; border: 1px solid rgba(255,255,255,0.2); padding: 9px 13px; border-radius: 9px; font-weight: 700; font-size: 0.84rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;" title="طباعة المسار البيداغوجي">
                            <span data-lucide="printer" data-size="16"></span>
                            <span>طباعة المسار</span>
                        </button>
                    </div>
                </div>

                <!-- شبكة كروت الـ KPIs البانورامية -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; position: relative; z-index: 2;">
                    <!-- 1. نسبة الإنجاز والتقدم -->
                    <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 12px 14px; backdrop-filter: blur(6px);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <span style="font-size: 0.74rem; font-weight: 700; color: #94a3b8;">إنجاز المحطات السنوية</span>
                            <span style="font-size: 0.74rem; font-weight: 800; color: #38bdf8;">${completedCount} / ${totalCount}</span>
                        </div>
                        <div style="font-size: 1.55rem; font-weight: 900; color: #38bdf8; margin-bottom: 6px;">${progressPct}%</div>
                        <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.15); border-radius: 999px; overflow: hidden;">
                            <div style="width: ${progressPct}%; height: 100%; background: linear-gradient(90deg, #38bdf8, #22c55e); border-radius: 999px; transition: width 0.4s ease;"></div>
                        </div>
                    </div>

                    <!-- 2. المحطة الجارية حالياً -->
                    <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 12px 14px; backdrop-filter: blur(6px);">
                        <div style="font-size: 0.74rem; font-weight: 700; color: #94a3b8; display: flex; align-items: center; gap: 5px; margin-bottom: 4px;">
                            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #f97316; box-shadow: 0 0 8px #f97316;"></span>
                            <span>المحطة الجارية الآن</span>
                        </div>
                        <div style="font-size: 0.88rem; font-weight: 800; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${currentActive ? currentActive.ms.title : 'لا توجد محطة جارية اليوم'}">
                            ${currentActive ? currentActive.ms.title : 'لا توجد محطة نشطة اليوم'}
                        </div>
                        <div style="font-size: 0.72rem; color: #fba759; margin-top: 4px; font-weight: 600;">
                            ${currentActive ? `تنتهي في ${currentActive.ms.endDate || currentActive.ms.startDate}` : 'جميع المحطات السابقة منجزة'}
                        </div>
                    </div>

                    <!-- 3. المحطة القادمة الأقرب -->
                    <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 12px 14px; backdrop-filter: blur(6px);">
                        <div style="font-size: 0.74rem; font-weight: 700; color: #94a3b8; display: flex; align-items: center; gap: 5px; margin-bottom: 4px;">
                            <span data-lucide="clock" data-size="13" style="color: #60a5fa;"></span>
                            <span>المحطة القادمة الأقرب</span>
                        </div>
                        <div style="font-size: 0.88rem; font-weight: 800; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${nextUpcoming ? nextUpcoming.ms.title : 'لا توجد محطات قادمة'}">
                            ${nextUpcoming ? nextUpcoming.ms.title : 'نهاية المحطات المبرمجة'}
                        </div>
                        <div style="font-size: 0.72rem; color: #93c5fd; margin-top: 4px; font-weight: 700;">
                            ${nextUpcoming ? `${nextUpcoming.eval.statusBadge} (${nextUpcoming.ms.startDate})` : '-'}
                        </div>
                    </div>

                    <!-- 4. الأقسام المربوطة بالمسار -->
                    <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 12px 14px; backdrop-filter: blur(6px);">
                        <div style="font-size: 0.74rem; font-weight: 700; color: #94a3b8; display: flex; align-items: center; gap: 5px; margin-bottom: 4px;">
                            <span data-lucide="users" data-size="13" style="color: #34d399;"></span>
                            <span>الأقسام المسندة للمنظومة</span>
                        </div>
                        <div style="font-size: 1.4rem; font-weight: 900; color: #34d399; margin-bottom: 2px;">
                            ${assignedClasses.length} أقسام
                        </div>
                        <div style="font-size: 0.72rem; color: #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${assignedClasses.slice(0, 3).join('، ')}${assignedClasses.length > 3 ? '...' : ''}
                        </div>
                    </div>
                </div>
            </div>

            <!-- شريط أدوات الفلترة والتحكم البانورامي -->
            <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 14px 18px; margin-bottom: 20px; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
                    <!-- حقل البحث السريع -->
                    <div style="flex: 1.5; min-width: 220px; position: relative;">
                        <span style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #64748b;">
                            <span data-lucide="search" data-size="16"></span>
                        </span>
                        <input type="text" id="roadmapSearchInput" value="${escapeHtml(roadmapState.searchQuery)}" placeholder="بحث في عناوين المحطات، المذكرات، مجالس الأقسام..." oninput="setRoadmapFilter('search', this.value)" style="width: 100%; padding: 8px 34px 8px 12px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-size: 0.85rem; font-weight: 600; outline: none;">
                    </div>

                    <!-- نمط العرض: تسلسل زمني vs جدول بانورامي -->
                    <div style="display: flex; gap: 4px; background: #f1f5f9; padding: 3px; border-radius: 8px; border: 1px solid #cbd5e1;">
                        <button type="button" onclick="setRoadmapFilter('view', 'timeline')" style="padding: 6px 12px; border-radius: 6px; border: none; font-size: 0.78rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; transition: all 0.15s; ${roadmapState.viewMode === 'timeline' ? 'background: #2563eb; color: #fff; box-shadow: 0 1px 3px rgba(37,99,235,0.3);' : 'background: transparent; color: #475569;'}">
                            <span data-lucide="git-commit" data-size="14"></span>
                            <span>التسلسل الزمني</span>
                        </button>
                        <button type="button" onclick="setRoadmapFilter('view', 'table')" style="padding: 6px 12px; border-radius: 6px; border: none; font-size: 0.78rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; transition: all 0.15s; ${roadmapState.viewMode === 'table' ? 'background: #2563eb; color: #fff; box-shadow: 0 1px 3px rgba(37,99,235,0.3);' : 'background: transparent; color: #475569;'}">
                            <span data-lucide="table" data-size="14"></span>
                            <span>الجدول البانورامي</span>
                        </button>
                    </div>
                </div>

                <!-- خط أزرار التصفية المتعددة -->
                <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                    <!-- فلتر الأقسام المسندة -->
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 0.78rem; font-weight: 800; color: #475569; white-space: nowrap;">
                            <span data-lucide="users" data-size="14" style="color: #2563eb; vertical-align: middle;"></span> القسم المسند:
                        </span>
                        <select onchange="setRoadmapFilter('class', this.value)" style="padding: 6px 10px; border-radius: 7px; border: 1.5px solid #93c5fd; background: #eff6ff; color: #1e3a8a; font-weight: 800; font-size: 0.8rem; cursor: pointer;">
                            <option value="all" ${roadmapState.filterClass === 'all' ? 'selected' : ''}>🏫 جميع الأقسام المسندة</option>
                            ${assignedClasses.map(c => `
                                <option value="${escapeHtml(c)}" ${roadmapState.filterClass === c ? 'selected' : ''}>قسم: ${escapeHtml(c)}</option>
                            `).join('')}
                        </select>
                    </div>

                    <!-- فلتر الأسدوس -->
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 0.78rem; font-weight: 800; color: #475569; white-space: nowrap;">
                            <span data-lucide="calendar" data-size="14" style="color: #7c3aed; vertical-align: middle;"></span> الدورة / الفصل:
                        </span>
                        <select onchange="setRoadmapFilter('semester', this.value)" style="padding: 6px 10px; border-radius: 7px; border: 1.5px solid #cbd5e1; background: #fff; color: #334155; font-weight: 700; font-size: 0.8rem; cursor: pointer;">
                            <option value="all" ${roadmapState.filterSemester === 'all' ? 'selected' : ''}>كل الفصول والسنة كاملة</option>
                            <option value="s1" ${roadmapState.filterSemester === 's1' ? 'selected' : ''}>الدورة الأولى (S1)</option>
                            <option value="s2" ${roadmapState.filterSemester === 's2' ? 'selected' : ''}>الدورة الثانية (S2)</option>
                            <option value="year" ${roadmapState.filterSemester === 'year' ? 'selected' : ''}>محطات سنوية مستمرة</option>
                        </select>
                    </div>

                    <!-- فلتر صنف المحطة -->
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 0.78rem; font-weight: 800; color: #475569; white-space: nowrap;">
                            <span data-lucide="tag" data-size="14" style="color: #059669; vertical-align: middle;"></span> الصنف:
                        </span>
                        <select onchange="setRoadmapFilter('category', this.value)" style="padding: 6px 10px; border-radius: 7px; border: 1.5px solid #cbd5e1; background: #fff; color: #334155; font-weight: 700; font-size: 0.8rem; cursor: pointer;">
                            <option value="all" ${roadmapState.filterCategory === 'all' ? 'selected' : ''}>كل الأصناف التعليمية</option>
                            <option value="unified" ${roadmapState.filterCategory === 'unified' ? 'selected' : ''}>🎯 الامتحانات الموحدة والإشهادية</option>
                            <option value="exams" ${roadmapState.filterCategory === 'exams' ? 'selected' : ''}>📝 الامتحانات والفروض</option>
                            <option value="council" ${roadmapState.filterCategory === 'council' ? 'selected' : ''}>👥 مجالس الأقسام والتوجيه</option>
                            <option value="decree" ${roadmapState.filterCategory === 'decree' ? 'selected' : ''}>📜 المذكرات والمقررات الوزارية</option>
                            <option value="assessment" ${roadmapState.filterCategory === 'assessment' ? 'selected' : ''}>🎯 التقويم والمراقبة المستمرة</option>
                        </select>
                    </div>

                    <!-- فلتر حالة الإنجاز -->
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 0.78rem; font-weight: 800; color: #475569; white-space: nowrap;">
                            <span data-lucide="check-circle" data-size="14" style="color: #d97706; vertical-align: middle;"></span> الحالة:
                        </span>
                        <select onchange="setRoadmapFilter('status', this.value)" style="padding: 6px 10px; border-radius: 7px; border: 1.5px solid #cbd5e1; background: #fff; color: #334155; font-weight: 700; font-size: 0.8rem; cursor: pointer;">
                            <option value="all" ${roadmapState.filterStatus === 'all' ? 'selected' : ''}>كل الحالات</option>
                            <option value="active" ${roadmapState.filterStatus === 'active' ? 'selected' : ''}>⏳ جارية حالياً</option>
                            <option value="upcoming" ${roadmapState.filterStatus === 'upcoming' ? 'selected' : ''}>📅 قادمة</option>
                            <option value="completed" ${roadmapState.filterStatus === 'completed' ? 'selected' : ''}>✅ منجزة ومحققة</option>
                            <option value="past" ${roadmapState.filterStatus === 'past' ? 'selected' : ''}>⌛ منقضية</option>
                        </select>
                    </div>

                    <!-- زر تصفير الفلاتر -->
                    ${(roadmapState.filterClass !== 'all' || roadmapState.filterSemester !== 'all' || roadmapState.filterCategory !== 'all' || roadmapState.filterStatus !== 'all' || roadmapState.searchQuery) ? `
                        <button type="button" onclick="setRoadmapFilter('reset')" style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #64748b; padding: 5px 10px; border-radius: 6px; font-size: 0.74rem; font-weight: 700; cursor: pointer;">
                            ✕ إعادة تعيين الفلاتر
                        </button>
                    ` : ''}
                </div>
            </div>
        `;

        // 5. بناء المحتوى (Timeline Flow أو Panoramic Table)
        if (filtered.length === 0) {
            html += `
                <div style="background: #ffffff; border: 1.5px dashed #cbd5e1; border-radius: 14px; padding: 48px 24px; text-align: center; color: #64748b; margin: 20px 0;">
                    <div style="width: 56px; height: 56px; border-radius: 50%; background: #f1f5f9; color: #94a3b8; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
                        <span data-lucide="calendar-x" data-size="28"></span>
                    </div>
                    <h3 style="font-size: 1.1rem; font-weight: 800; color: #1e293b; margin-bottom: 6px;">لا توجد محطات تربوية مطابقة لمعايير الفلترة الحالية</h3>
                    <p style="font-size: 0.84rem; max-width: 440px; margin: 0 auto 16px auto;">
                        جرب تعديل خيارات الفلترة أو إضافة محطة بيداغوجية أو امتحان موحد جديد.
                    </p>
                    <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
                        <button type="button" onclick="window.openAddAcademicMilestoneModal('general')" style="background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                            <span>➕ إضافة محطة بيداغوجية</span>
                        </button>
                        <button type="button" onclick="window.openAddAcademicMilestoneModal('unified')" style="background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 2px 6px rgba(124,58,237,0.3);">
                            <span>🎯 + إضافة امتحان موحد</span>
                        </button>
                    </div>
                </div>
            `;
        } else if (roadmapState.viewMode === 'table') {
            // نمط الجدول البانورامي الشامل (Panoramic Table View)
            html += `
                <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04); margin-bottom: 24px;">
                    <div style="padding: 12px 18px; background: #f8fafc; border-bottom: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-weight: 800; color: #0f172a; font-size: 0.92rem;">
                            الجدول البانورامي الشامل لمحطات الموسم الدراسي (${filtered.length} محطة)
                        </div>
                        <span style="font-size: 0.74rem; color: #64748b;">مناسب للمعاينة السريعة والطباعة الرسمية</span>
                    </div>
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.84rem; text-align: right;">
                            <thead>
                                <tr style="background: #f1f5f9; color: #334155; border-bottom: 2px solid #cbd5e1; font-weight: 800;">
                                    <th style="padding: 10px 12px; width: 44px; text-align: center;">الإنجاز</th>
                                    <th style="padding: 10px 12px; width: 140px;">الفترة والتواريخ</th>
                                    <th style="padding: 10px 12px; width: 100px;">الصنف</th>
                                    <th style="padding: 10px 14px;">عنوان وتفاصيل المحطة البيداغوجية</th>
                                    <th style="padding: 10px 12px; width: 160px;">الأقسام المسندة المعنية</th>
                                    <th style="padding: 10px 12px; width: 120px; text-align: center;">الحالة والعد التنازلي</th>
                                    <th style="padding: 10px 12px; width: 90px; text-align: center;">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filtered.map((ms, idx) => {
                                    const evalState = evaluateMilestoneStatus(ms);
                                    const catMeta = getMilestoneCategoryMeta(ms.category, ms);
                                    const chips = getMilestoneClassChips(ms.targetLevels);
                                    const isUni = ms.isUnifiedExam || ms.category === 'certification' || (ms.title && ms.title.includes('موحد'));
                                    const rowBg = evalState.isCompleted ? '#f0fdf4' : (evalState.status === 'active' ? '#fffbeb' : (isUni ? '#faf5ff' : (idx % 2 === 0 ? '#ffffff' : '#f8fafc')));
                                    return `
                                        <tr style="background: ${rowBg}; border-bottom: 1px solid #e2e8f0; transition: background 0.15s;">
                                            <td style="padding: 10px 12px; text-align: center;">
                                                <input type="checkbox" onchange="toggleMilestoneCompletion('${ms.id}', event)" ${evalState.isCompleted ? 'checked' : ''} style="width: 17px; height: 17px; accent-color: #059669; cursor: pointer;" title="تبديل حالة الإنجاز">
                                            </td>
                                            <td style="padding: 10px 12px; font-weight: 700; color: #1e293b; font-family: monospace, sans-serif; font-size: 0.8rem;">
                                                <div>📅 ${ms.startDate}</div>
                                                ${ms.endDate && ms.endDate !== ms.startDate ? `<div style="color: #64748b; font-size: 0.74rem;">إلى ${ms.endDate}</div>` : ''}
                                            </td>
                                            <td style="padding: 10px 12px;">
                                                <span style="background: ${catMeta.bg}; color: ${catMeta.color}; border: 1px solid ${catMeta.border}; font-size: 0.72rem; font-weight: 800; padding: 2px 7px; border-radius: 5px; white-space: nowrap;">
                                                    ${catMeta.badge}
                                                </span>
                                            </td>
                                            <td style="padding: 10px 14px;">
                                                <div style="font-weight: 800; color: #0f172a; font-size: 0.88rem; ${evalState.isCompleted ? 'text-decoration: line-through; opacity: 0.85;' : ''}">${escapeHtml(ms.title)}</div>
                                                ${ms.description ? `<div style="font-size: 0.76rem; color: #64748b; margin-top: 3px; line-height: 1.4;">${escapeHtml(ms.description)}</div>` : ''}
                                                ${isUni ? `
                                                    <div style="display: flex; gap: 5px; align-items: center; flex-wrap: wrap; margin-top: 5px;">
                                                        <span style="background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #fff; font-size: 0.67rem; font-weight: 800; padding: 2px 7px; border-radius: 4px;">
                                                            🎯 امتحان موحد ${ms.unifiedSubtype === 'national' ? 'وطني' : (ms.unifiedSubtype === 'regional' ? 'جهوي' : (ms.unifiedSubtype === 'local' ? 'محلي' : (ms.unifiedSubtype === 'mock' ? 'تجريبي' : '')))}
                                                        </span>
                                                        ${ms.coef ? `<span style="background: #faf5ff; color: #6b21a8; border: 1px solid #d8b4fe; font-size: 0.67rem; font-weight: 800; padding: 2px 6px; border-radius: 4px;">معامل: ${ms.coef}</span>` : ''}
                                                        ${ms.duration ? `<span style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; font-size: 0.67rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;">المدة: ${ms.duration}س</span>` : ''}
                                                        ${ms.timeSlot ? `<span style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-size: 0.67rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;">⏰ ${escapeHtml(ms.timeSlot)}</span>` : ''}
                                                        ${ms.topics ? `<span style="background: #f8fafc; color: #475569; border: 1px dashed #cbd5e1; font-size: 0.67rem; padding: 2px 6px; border-radius: 4px;">المحاور: ${escapeHtml(ms.topics)}</span>` : ''}
                                                        ${(window.db && window.db.upcomingExams && window.db.upcomingExams.some(e => e.milestoneId === ms.id)) ? `
                                                            <span style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 0.67rem; font-weight: 800; padding: 2px 6px; border-radius: 4px;">⚡ مدمج بجدول الفروض</span>
                                                        ` : ''}
                                                    </div>
                                                ` : ''}
                                            </td>
                                            <td style="padding: 10px 12px;">
                                                <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                                                    ${chips.map(chip => `
                                                        <span onclick="setRoadmapFilter('class', '${chip.isAll ? 'all' : escapeHtml(chip.label)}')" style="background: ${chip.isAll ? '#eff6ff' : '#ecfdf5'}; color: ${chip.isAll ? '#1e40af' : '#065f46'}; border: 1px solid ${chip.isAll ? '#bfdbfe' : '#a7f3d0'}; font-size: 0.7rem; font-weight: 800; padding: 2px 6px; border-radius: 4px; cursor: pointer;" title="انقر لفلترة مسار هذا القسم">
                                                            ${escapeHtml(chip.label)}
                                                        </span>
                                                    `).join('')}
                                                </div>
                                            </td>
                                            <td style="padding: 10px 12px; text-align: center;">
                                                <span style="background: ${evalState.statusBg}; color: ${evalState.statusColor}; border: 1.5px solid ${evalState.statusBorder}; font-size: 0.72rem; font-weight: 900; padding: 3px 8px; border-radius: 6px; display: inline-block; white-space: nowrap;">
                                                    ${evalState.statusBadge}
                                                </span>
                                            </td>
                                            <td style="padding: 10px 12px; text-align: center;">
                                                <div style="display: flex; gap: 4px; justify-content: center;">
                                                    <button type="button" onclick="window.navigateToMonthlyCalendarDate && window.navigateToMonthlyCalendarDate('${ms.startDate}')" style="background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; padding: 4px 7px; border-radius: 6px; font-size: 0.7rem; font-weight: 800; cursor: pointer;" title="عرض في التقويم الشهري">
                                                        📅 الشهري
                                                    </button>
                                                    <button type="button" onclick="window.openEditAcademicMilestoneModal('${ms.id}')" style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #334155; padding: 4px 7px; border-radius: 6px; cursor: pointer;" title="تعديل">
                                                        <span data-lucide="edit-3" data-size="13"></span>
                                                    </button>
                                                    <button type="button" onclick="deleteMilestoneFromRoadmap('${ms.id}', event)" style="background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 4px 7px; border-radius: 6px; cursor: pointer;" title="حذف">
                                                        <span data-lucide="trash-2" data-size="13"></span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } else {
            // نمط التسلسل الزمني التفاعلي الفاخر (Interactive Timeline Flow)
            html += `
                <div class="roadmap-timeline-flow" style="position: relative; padding: 10px 0 30px 0;">
                    <!-- الخط الرابط المركزي التفاعلي -->
                    <div style="position: absolute; top: 0; bottom: 0; right: 28px; width: 4px; background: linear-gradient(180deg, #2563eb 0%, #0284c7 50%, #10b981 100%); border-radius: 4px; box-shadow: 0 0 8px rgba(37,99,235,0.25);"></div>

                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        ${filtered.map((ms, idx) => {
                            const evalState = evaluateMilestoneStatus(ms);
                            const catMeta = getMilestoneCategoryMeta(ms.category, ms);
                            const chips = getMilestoneClassChips(ms.targetLevels);
                            const isUni = ms.isUnifiedExam || ms.category === 'certification' || (ms.title && ms.title.includes('موحد'));

                            const isCurrent = evalState.status === 'active';
                            const cardBorder = isCurrent ? '2px solid #ea580c' : (evalState.isCompleted ? '1.5px solid #a7f3d0' : (isUni ? '1.5px solid #d8b4fe' : '1.5px solid #cbd5e1'));
                            const cardBg = evalState.isCompleted ? '#f0fdf4' : (isCurrent ? '#fffdf7' : (isUni ? '#faf5ff' : '#ffffff'));
                            const nodeBorder = isCurrent ? '#f97316' : (evalState.isCompleted ? '#10b981' : (isUni ? '#7c3aed' : '#2563eb'));

                            return `
                                <div class="roadmap-milestone-node" style="display: flex; gap: 20px; align-items: flex-start; position: relative;">
                                    <!-- أيقونة العقدة على الخط الزمني -->
                                    <div style="width: 58px; height: 58px; border-radius: 50%; background: #ffffff; border: 4px solid ${nodeBorder}; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 3; box-shadow: 0 4px 10px rgba(0,0,0,0.08); flex-shrink: 0; cursor: pointer; transition: transform 0.2s;" onclick="toggleMilestoneCompletion('${ms.id}', event)" title="انقر لتبديل حالة الإنجاز (تم/قيد الإنجاز)">
                                        <span data-lucide="${evalState.isCompleted ? 'check-check' : catMeta.icon}" data-size="20" style="color: ${nodeBorder};"></span>
                                        <span style="font-size: 0.62rem; font-weight: 900; color: #475569; margin-top: 1px;">#${idx + 1}</span>
                                    </div>

                                    <!-- بطاقة المحطة البيداغوجية -->
                                    <div style="flex: 1; background: ${cardBg}; border: ${cardBorder}; border-right: 5px solid ${nodeBorder}; border-radius: 14px; padding: 16px 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: transform 0.15s ease, box-shadow 0.15s ease; position: relative;">
                                        <!-- رأس البطاقة: التاريخ، الصنف، والحالة -->
                                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
                                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                                <!-- بادج التاريخ -->
                                                <span style="background: #0f172a; color: #ffffff; font-size: 0.78rem; font-weight: 800; font-family: monospace, sans-serif; padding: 3px 10px; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px;">
                                                    <span data-lucide="calendar" data-size="13" style="color: #38bdf8;"></span>
                                                    <span>${ms.startDate}</span>
                                                    ${ms.endDate && ms.endDate !== ms.startDate ? `<span style="color: #94a3b8;">إلى ${ms.endDate}</span>` : ''}
                                                </span>

                                                <!-- بادج الصنف التربوي -->
                                                <span style="background: ${catMeta.bg}; color: ${catMeta.color}; border: 1px solid ${catMeta.border}; font-size: 0.74rem; font-weight: 800; padding: 3px 8px; border-radius: 6px;">
                                                    ${catMeta.badge}
                                                </span>

                                                <!-- بادج الدورة -->
                                                <span style="background: #f8fafc; color: #475569; border: 1px solid #cbd5e1; font-size: 0.72rem; font-weight: 700; padding: 2px 7px; border-radius: 5px;">
                                                    ${ms.semester === 's2' || ms.semester === '2' ? 'الدورة 2' : (ms.semester === 'year' ? 'سنوية' : 'الدورة 1')}
                                                </span>
                                            </div>

                                            <!-- بادج الحالة والعد التنازلي الحي -->
                                            <div style="display: flex; align-items: center; gap: 6px;">
                                                <span style="background: ${evalState.statusBg}; color: ${evalState.statusColor}; border: 1.5px solid ${evalState.statusBorder}; font-size: 0.75rem; font-weight: 900; padding: 3px 9px; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); display: inline-flex; align-items: center; gap: 4px;">
                                                    ${isCurrent ? '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#ea580c;animation:pulse 1.5s infinite;"></span>' : ''}
                                                    <span>${evalState.statusBadge}</span>
                                                </span>
                                            </div>
                                        </div>

                                        <!-- عنوان وتفاصيل المحطة -->
                                        <div style="margin-bottom: 12px;">
                                            <h3 style="margin: 0 0 6px 0; font-size: 1.05rem; font-weight: 900; color: #0f172a; line-height: 1.4; ${evalState.isCompleted ? 'text-decoration: line-through; opacity: 0.85;' : ''}">
                                                ${escapeHtml(ms.title)}
                                            </h3>
                                            ${ms.description ? `
                                                <p style="margin: 0; font-size: 0.82rem; color: #475569; line-height: 1.5; font-weight: 500;">
                                                    ${escapeHtml(ms.description)}
                                                </p>
                                            ` : ''}
                                            ${isUni ? `
                                                <div style="margin-top: 10px; margin-bottom: 8px; background: #ffffff; border: 1px solid #e9d5ff; border-radius: 10px; padding: 10px 14px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; box-shadow: 0 1px 3px rgba(124,58,237,0.05);">
                                                    <span style="background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #fff; font-size: 0.72rem; font-weight: 800; padding: 3px 9px; border-radius: 6px;">
                                                        🎯 امتحان موحد ${ms.unifiedSubtype === 'national' ? 'وطني رسمي' : (ms.unifiedSubtype === 'regional' ? 'جهوي رسمي' : (ms.unifiedSubtype === 'local' ? 'محلي موحد' : (ms.unifiedSubtype === 'mock' ? 'تجريبي أبيض' : '')))}
                                                    </span>
                                                    ${ms.coef ? `<span style="background: #faf5ff; color: #6b21a8; border: 1px solid #d8b4fe; font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 6px;">معامل الرياضيات: ${ms.coef}</span>` : ''}
                                                    ${ms.duration ? `<span style="background: #f8fafc; color: #334155; border: 1px solid #cbd5e1; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 6px;">مدة الإنجاز: ${ms.duration}</span>` : ''}
                                                    ${ms.timeSlot ? `<span style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 6px;">⏰ الفترة الزمنية: ${escapeHtml(ms.timeSlot)}</span>` : ''}
                                                    ${ms.topics ? `<div style="width: 100%; font-size: 0.74rem; color: #581c87; background: #faf5ff; border: 1px dashed #d8b4fe; padding: 6px 10px; border-radius: 6px; font-weight: 600;">📚 محاور ومفردات الإطار المرجعي: ${escapeHtml(ms.topics)}</div>` : ''}
                                                    ${(window.db && window.db.upcomingExams && window.db.upcomingExams.some(e => e.milestoneId === ms.id)) ? `
                                                        <span style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 0.7rem; font-weight: 800; padding: 2px 8px; border-radius: 6px;">⚡ مدمج تلقائياً في خطة الفروض والتقويم دون تعارض</span>
                                                    ` : ''}
                                                </div>
                                            ` : ''}
                                        </div>

                                        <!-- الأقسام المسندة المعنية (Class Chips) -->
                                        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 12px;">
                                            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                                <span style="font-size: 0.74rem; font-weight: 800; color: #334155; display: inline-flex; align-items: center; gap: 4px;">
                                                    <span data-lucide="award" data-size="13" style="color: #2563eb;"></span>
                                                    <span>الأقسام المسندة المعنية:</span>
                                                </span>
                                                ${chips.map(chip => `
                                                    <span onclick="setRoadmapFilter('class', '${chip.isAll ? 'all' : escapeHtml(chip.label)}')" style="background: ${chip.isAll ? '#eff6ff' : '#ecfdf5'}; color: ${chip.isAll ? '#1e3a8a' : '#065f46'}; border: 1.5px solid ${chip.isAll ? '#93c5fd' : '#a7f3d0'}; font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;" title="انقر لفلترة المسار لهذا القسم تحديداً">
                                                        <span>${escapeHtml(chip.label)}</span>
                                                    </span>
                                                `).join('')}
                                            </div>

                                            <!-- أزرار العمليات والتفاعل -->
                                            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                                <!-- زر انتقال مباشر حسب نوع المحطة -->
                                                ${(ms.category === 'exam' || ms.category === 'certification') ? `
                                                    <button type="button" onclick="switchTab('grades')" style="background: #eff6ff; color: #1d4ed8; border: 1.5px solid #bfdbfe; font-size: 0.74rem; font-weight: 800; padding: 5px 10px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="الانتقال الفوري لتبويب النقط والفروض">
                                                        <span data-lucide="award" data-size="13"></span>
                                                        <span>رصد النقط ↗</span>
                                                    </button>
                                                ` : (ms.category === 'council') ? `
                                                    <button type="button" onclick="switchTab('reports')" style="background: #faf5ff; color: #7c3aed; border: 1.5px solid #e9d5ff; font-size: 0.74rem; font-weight: 800; padding: 5px 10px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="الانتقال إلى محاضر مجالس الأقسام والتقارير">
                                                        <span data-lucide="file-bar-chart" data-size="13"></span>
                                                        <span>المحاضر ↗</span>
                                                    </button>
                                                ` : (ms.category === 'decree' || ms.category === 'admin' || ms.category === 'massar') ? `
                                                    <button type="button" onclick="switchTab('library')" style="background: #f0f9ff; color: #0284c7; border: 1.5px solid #bae6fd; font-size: 0.74rem; font-weight: 800; padding: 5px 10px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="الانتقال إلى المكتبة البيداغوجية والمذكرات الرسمية">
                                                        <span data-lucide="book-open" data-size="13"></span>
                                                        <span>المذكرات ↗</span>
                                                    </button>
                                                ` : (ms.category === 'diagnostic' || ms.category === 'assessment') ? `
                                                    <button type="button" onclick="if(window.openMathRemediationModal) window.openMathRemediationModal(); else switchTab('grades');" style="background: #ecfdf5; color: #059669; border: 1.5px solid #a7f3d0; font-size: 0.74rem; font-weight: 800; padding: 5px 10px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="فتح خطة المعالجة والدعم البيداغوجي">
                                                        <span data-lucide="sparkles" data-size="13"></span>
                                                        <span>خطة الدعم ↗</span>
                                                    </button>
                                                ` : ''}

                                                <button type="button" onclick="window.navigateToMonthlyCalendarDate && window.navigateToMonthlyCalendarDate('${ms.startDate}')" style="background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; font-size: 0.74rem; font-weight: 800; padding: 5px 9px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;" title="فتح موقع هذه المحطة في التقويم الشهري">
                                                    <span>📅 التقويم الشهري</span>
                                                </button>

                                                <button type="button" onclick="toggleMilestoneCompletion('${ms.id}', event)" style="background: ${evalState.isCompleted ? '#dcfce7' : '#ffffff'}; border: 1.5px solid ${evalState.isCompleted ? '#86efac' : '#cbd5e1'}; color: ${evalState.isCompleted ? '#166534' : '#334155'}; font-size: 0.74rem; font-weight: 800; padding: 5px 10px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                                                    <span data-lucide="${evalState.isCompleted ? 'check' : 'circle'}" data-size="13"></span>
                                                    <span>${evalState.isCompleted ? 'تم الإنجاز ✓' : 'تحديد كمكتمل'}</span>
                                                </button>

                                                <button type="button" onclick="window.openEditAcademicMilestoneModal('${ms.id}')" style="background: #ffffff; border: 1px solid #cbd5e1; color: #475569; font-size: 0.74rem; font-weight: 700; padding: 5px 9px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;" title="تعديل المحطة">
                                                    <span data-lucide="edit-3" data-size="13"></span>
                                                    <span>تعديل</span>
                                                </button>

                                                <button type="button" onclick="deleteMilestoneFromRoadmap('${ms.id}', event)" style="background: #ffffff; border: 1px solid #fecaca; color: #dc2626; font-size: 0.74rem; font-weight: 700; padding: 5px 8px; border-radius: 6px; cursor: pointer;" title="حذف المحطة">
                                                    <span data-lucide="trash-2" data-size="13"></span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;

        // Render Lucide icons inside roadmap container
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons({ root: container });
        } else if (window.renderLucide) {
            window.renderLucide(container);
        }
    }
    window.renderPedagogicalRoadmap = renderPedagogicalRoadmap;

    // تهيئة عند تحميل المستند
    document.addEventListener('DOMContentLoaded', () => {
        // فحص جاهزية الحاوية داخل تبويب التقويم
        const mount = document.getElementById('calendarRoadmapContentMount') || document.getElementById('roadmapContentMount');
        if (mount && mount.offsetParent !== null) {
            renderPedagogicalRoadmap();
        }
    });

})();
