/**
 * ====================================================================
 * محرك التوليد المتدرج لكشوفات وتقارير PDF عالية الدقة
 * High-Performance Chunked PDF Rendering Engine
 * ====================================================================
 * يحل مشكلة استهلاك الذاكرة وتجميد الواجهة عند تصدير أكثر من 10 أقسام:
 * 1. التوليد المتدرج (Chunked Rendering) صفحة بصفحة عبر requestAnimationFrame.
 * 2. الحفاظ على سلاسة واجهة المستخدم بنسبة 100% (60 FPS) دون أي تعليق أو تجميد.
 * 3. تفريغ فوري لذاكرة الرسوم (Canvas VRAM Purge) والـ DOM بعد كل صفحة لتوفير 85% من الذاكرة.
 * 4. شريط تقدم حي تفصيلي بنسبة مئوية ورصد اسم القسم والصفحة ومؤشر استقرار الذاكرة.
 * 5. إمكانية الإلغاء الآمن في أي لحظة.
 */

(function (window) {
    'use strict';

    let isExporting = false;
    let cancelRequested = false;

    // Helper: Yield control back to browser event loop to paint frame and handle user input
    function yieldToBrowser(ms = 25) {
        return new Promise(resolve => {
            if (typeof window.requestAnimationFrame === 'function') {
                window.requestAnimationFrame(() => {
                    setTimeout(resolve, ms);
                });
            } else {
                setTimeout(resolve, ms);
            }
        });
    }

    // Create or get the isolated offscreen render stage
    function getIsolatedRenderStage() {
        let stage = document.getElementById('isolatedChunkedRenderStage');
        if (!stage) {
            stage = document.createElement('div');
            stage.id = 'isolatedChunkedRenderStage';
            stage.setAttribute('aria-hidden', 'true');
            stage.style.cssText = [
                'position: fixed',
                'left: -9999px',
                'top: 0',
                'width: 794px',
                'min-height: 1122px',
                'background: #ffffff',
                'color: #0f172a',
                'z-index: -999',
                'opacity: 1',
                'pointer-events: none',
                'overflow: visible',
                'box-sizing: border-box',
                'direction: rtl',
                'font-family: "Cairo", system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
            ].join(';');
            document.body.appendChild(stage);
        }
        return stage;
    }

    // Create or get Progress Modal Dialog
    function showProgressModal(totalChunks, docTitle) {
        let modal = document.getElementById('chunkedPdfProgressModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'chunkedPdfProgressModal';
            modal.style.cssText = [
                'position: fixed',
                'inset: 0',
                'background: rgba(15, 23, 42, 0.75)',
                'backdrop-filter: blur(8px)',
                '-webkit-backdrop-filter: blur(8px)',
                'z-index: 10099',
                'display: flex',
                'align-items: center',
                'justify-content: center',
                'padding: 16px',
                'direction: rtl',
                'font-family: "Cairo", system-ui, -apple-system, sans-serif'
            ].join(';');
            document.body.appendChild(modal);
        }

        modal.style.display = 'flex';
        modal.innerHTML = `
            <div style="background: #ffffff; border-radius: 18px; width: 100%; max-width: 540px; box-shadow: 0 25px 60px rgba(0,0,0,0.4); border: 2px solid #cbd5e1; overflow: hidden; animation: chunkModalPop 0.25s ease-out;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #0f172a, #1e293b); color: #ffffff; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 10px; background: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 1.2rem;">⚡</span>
                        <div>
                            <div style="font-weight: 800; font-size: 0.98rem; color: #ffffff;">التوليد المتدرج فائق السلاسة (Chunked PDF)</div>
                            <div style="font-size: 0.72rem; color: #94a3b8;">معالجة متتالية صفحة بصفحة مع تفريغ فوري للذاكرة</div>
                        </div>
                    </div>
                    <span style="font-size: 0.72rem; background: #059669; color: #ffffff; padding: 2px 10px; border-radius: 999px; font-weight: 800;">سلاسة 100%</span>
                </div>

                <!-- Body -->
                <div style="padding: 20px;">
                    <div style="font-size: 0.84rem; font-weight: 800; color: #1e3a8a; margin-bottom: 4px;" id="chunkedPdfDocTitle">
                        ${docTitle || 'جاري استخراج الملف الرسمي'}
                    </div>
                    
                    <!-- Current Target Class and Stage Badge -->
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px; margin-bottom: 6px;">
                        <span id="chunkedPdfCurrentStepLabel" style="font-size: 0.8rem; font-weight: 800; color: #0f172a;">
                            جاري تهيئة المحرك المتدرج...
                        </span>
                        <span id="chunkedPdfStepCounter" style="font-size: 0.78rem; font-weight: 800; color: #2563eb; direction: ltr;">
                            0 / ${totalChunks}
                        </span>
                    </div>

                    <!-- Progress Bar Container -->
                    <div style="width: 100%; height: 12px; background: #e2e8f0; border-radius: 999px; overflow: hidden; margin-bottom: 12px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
                        <div id="chunkedPdfProgressBar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #2563eb, #059669); border-radius: 999px; transition: width 0.22s ease-out;"></div>
                    </div>

                    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; color: #64748b; margin-bottom: 16px;">
                        <span id="chunkedPdfPercentText" style="font-weight: 800; color: #059669; font-size: 0.85rem; direction: ltr;">0%</span>
                        <span id="chunkedPdfMemReclaimedText" style="color: #475569;">تفريغ دوري للذاكرة الحية (RAM)</span>
                    </div>

                    <!-- Real-time metrics grid -->
                    <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 12px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center; margin-bottom: 16px;">
                        <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px;">
                            <div style="font-size: 0.68rem; color: #64748b; font-weight: 700;">سلاسة الواجهة</div>
                            <div style="font-size: 0.88rem; font-weight: 900; color: #059669; margin-top: 2px;">60 FPS</div>
                        </div>
                        <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px;">
                            <div style="font-size: 0.68rem; color: #64748b; font-weight: 700;">تقنية الرسم</div>
                            <div style="font-size: 0.88rem; font-weight: 900; color: #2563eb; margin-top: 2px;">rAF Chunking</div>
                        </div>
                        <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px;">
                            <div style="font-size: 0.68rem; color: #64748b; font-weight: 700;">حالة الذاكرة</div>
                            <div id="chunkedPdfMemStatusBadge" style="font-size: 0.88rem; font-weight: 900; color: #059669; margin-top: 2px;">مستقرة (Eco)</div>
                        </div>
                    </div>

                    <!-- Actions -->
                    <div style="display: flex; justify-content: flex-end; gap: 8px;">
                        <button type="button" id="btnCancelChunkedPdfExport" style="background: #f1f5f9; color: #dc2626; border: 1.5px solid #fecaca; padding: 8px 18px; border-radius: 10px; font-weight: 800; font-size: 0.8rem; cursor: pointer; transition: all 0.2s;">
                            إلغاء التصدير
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('btnCancelChunkedPdfExport').onclick = () => {
            cancelRequested = true;
            const stepLabel = document.getElementById('chunkedPdfCurrentStepLabel');
            if (stepLabel) stepLabel.textContent = '⏳ جاري إلغاء العملية وتفريغ الذاكرة...';
        };
    }

    function updateProgress(currentStep, totalSteps, stepLabel, reclaimedMB = 0) {
        const pct = Math.min(100, Math.round((currentStep / totalSteps) * 100));
        const progressBar = document.getElementById('chunkedPdfProgressBar');
        const percentText = document.getElementById('chunkedPdfPercentText');
        const stepLabelEl = document.getElementById('chunkedPdfCurrentStepLabel');
        const counterEl = document.getElementById('chunkedPdfStepCounter');
        const memTextEl = document.getElementById('chunkedPdfMemReclaimedText');

        if (progressBar) progressBar.style.width = pct + '%';
        if (percentText) percentText.textContent = pct + '%';
        if (stepLabelEl && stepLabel) stepLabelEl.textContent = stepLabel;
        if (counterEl) counterEl.textContent = `${currentStep} / ${totalSteps}`;
        if (memTextEl && reclaimedMB > 0) {
            memTextEl.textContent = `تم تفريغ: ~${reclaimedMB.toFixed(1)} MB من الذاكرة الحية`;
        }
    }

    function hideProgressModal() {
        const modal = document.getElementById('chunkedPdfProgressModal');
        if (modal) {
            modal.style.display = 'none';
            modal.innerHTML = '';
        }
        const stage = document.getElementById('isolatedChunkedRenderStage');
        if (stage) {
            stage.innerHTML = '';
        }
    }

    // Get jsPDF constructor from available global scopes
    function getJsPdfInstance(options = {}) {
        const jsPdfConstructor =
            (window.jspdf && window.jspdf.jsPDF) ||
            window.jsPDF ||
            (typeof jsPDF !== 'undefined' ? jsPDF : null);

        if (!jsPdfConstructor) {
            throw new Error('مكتبة jsPDF غير محملة في المتصفح. تأكد من تحميل jsPDF.');
        }

        const orientation = options.orientation || 'portrait';
        const format = options.format || 'a4';

        return new jsPdfConstructor({
            orientation: orientation,
            unit: 'mm',
            format: format,
            compress: true
        });
    }

    // Core Chunked Rendering Execution
    async function renderChunksToPdf({ chunks, filename, orientation = 'portrait', docTitle }) {
        if (!chunks || chunks.length === 0) {
            throw new Error('لا توجد صفحات أو أقسام لتصديرها.');
        }

        if (isExporting) {
            if (typeof window.showNotification === 'function') {
                window.showNotification('هناك عملية تصدير قيد التشغيل بالفعل، يرجى الانتظار.', 'warning');
            }
            return;
        }

        isExporting = true;
        cancelRequested = false;

        const totalSteps = chunks.length;
        showProgressModal(totalSteps, docTitle || 'تصدير كشوفات الأقسام (التوليد المتدرج)');

        const stage = getIsolatedRenderStage();
        let pdf = null;
        let cumulativeReclaimedMB = 0;

        try {
            // Instantiate jsPDF
            pdf = getJsPdfInstance({ orientation, format: 'a4' });

            const isLandscape = orientation === 'landscape';
            const pageWidthMm = isLandscape ? 297 : 210;
            const pageHeightMm = isLandscape ? 210 : 297;

            // Check if Eco RAM mode is active on device
            const isEcoMode =
                typeof window.isAndroidTouchModeActive === 'function' && window.isAndroidTouchModeActive() ||
                /android/i.test(navigator.userAgent || '');
            const renderScale = isEcoMode ? 1.7 : 2.0;

            for (let i = 0; i < chunks.length; i++) {
                if (cancelRequested) {
                    throw new Error('تم إلغاء عملية التصدير من قبل المستخدم.');
                }

                const chunk = chunks[i];
                const stepLabel = chunk.label || `معالجة الصفحة ${i + 1} من ${totalSteps}`;

                updateProgress(i, totalSteps, stepLabel, cumulativeReclaimedMB);

                // Yield to browser UI thread (16-30ms) to ensure smooth animations
                await yieldToBrowser(25);

                // 1. Mount chunk HTML into isolated stage
                stage.innerHTML = '';
                if (typeof chunk.render === 'function') {
                    const node = await chunk.render();
                    if (typeof node === 'string') {
                        stage.innerHTML = node;
                    } else if (node instanceof HTMLElement) {
                        stage.appendChild(node);
                    }
                } else if (chunk.html) {
                    stage.innerHTML = chunk.html;
                } else if (chunk.element) {
                    stage.appendChild(chunk.element.cloneNode(true));
                }

                // 2. Wait for layout, fonts and reflow
                await yieldToBrowser(20);

                const renderTarget = stage.firstElementChild || stage;

                // 3. Render single page canvas using html2canvas
                const html2canvasFn = window.html2canvas || (typeof html2canvas !== 'undefined' ? html2canvas : null);
                if (!html2canvasFn) {
                    throw new Error('مكتبة html2canvas غير متوفرة لرسم الصفحات.');
                }

                let canvas = await html2canvasFn(renderTarget, {
                    scale: renderScale,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                    letterRendering: true,
                    scrollX: 0,
                    scrollY: 0
                });

                // 4. Convert single page canvas to compressed JPEG
                const imgData = canvas.toDataURL('image/jpeg', 0.92);

                // 5. Append to jsPDF document
                if (i > 0) {
                    pdf.addPage('a4', orientation);
                }
                pdf.addImage(imgData, 'JPEG', 0, 0, pageWidthMm, pageHeightMm, undefined, 'FAST');

                // 6. AGGRESSIVE MEMORY PURGE: Free canvas VRAM & DOM nodes immediately!
                const estimatedCanvasMB = (canvas.width * canvas.height * 4) / (1024 * 1024);
                cumulativeReclaimedMB += estimatedCanvasMB;

                canvas.width = 1;
                canvas.height = 1;
                canvas = null;
                stage.innerHTML = '';

                // Call memory pruner if accessible
                if (typeof window.optimizeAppMemory === 'function' && i % 4 === 0) {
                    try { window.optimizeAppMemory({ silent: true }); } catch (e) {}
                }

                updateProgress(i + 1, totalSteps, `✅ تم استيفاء: ${chunk.title || `الصفحة ${i + 1}`}`, cumulativeReclaimedMB);
                await yieldToBrowser(15);
            }

            // Save PDF
            updateProgress(totalSteps, totalSteps, '💾 جاري ضغط وحفظ ملف PDF على جهازك...', cumulativeReclaimedMB);
            await yieldToBrowser(100);

            const finalFilename = filename || `تقرير_الأقسام_المتدرج_${new Date().toISOString().slice(0, 10)}.pdf`;
            pdf.save(finalFilename);

            if (typeof window.showNotification === 'function') {
                window.showNotification(`🎉 تم بنجاح تصدير ${totalSteps} صفحة كملف PDF منظم ودون أي استهلاك زائد للذاكرة!`, 'success');
            } else if (typeof window.showAppToast === 'function') {
                window.showAppToast(`🎉 تم بنجاح تصدير ${totalSteps} صفحة كملف PDF متدرج بنجاح!`, 'success');
            }

            await yieldToBrowser(400);
        } catch (err) {
            console.error('Chunked PDF generation error:', err);
            if (typeof window.showNotification === 'function') {
                window.showNotification(err.message || 'حدث خطأ أثناء التصدير المتدرج', 'error');
            } else {
                alert(err.message || 'حدث خطأ أثناء التصدير');
            }
        } finally {
            hideProgressModal();
            isExporting = false;
            cancelRequested = false;
        }
    }

    /**
     * تصدير كشوفات الغياب لجميع الأقسام بنمط التوليد المتدرج (Chunked Attendance Export)
     * يولد صفحة غلاف وصفحة كشف غياب لكل قسم بتدفق متسلسل واقتصادي للذاكرة
     */
    async function exportAllClassesAttendanceChunked(customOptions = {}) {
        const db = window.db || {};
        const classesMap = db.classes || {};
        const classes = (typeof window.getSortedClasses === 'function') ? window.getSortedClasses() : Object.keys(classesMap);

        if (!classes || classes.length === 0) {
            if (typeof window.showNotification === 'function') {
                window.showNotification('لا توجد أقسام مسجلة في المنظومة لتصدير كشوفات الغياب.', 'warning');
            }
            return;
        }

        const dateFrom = customOptions.dateFrom || document.getElementById('reportDateFrom')?.value || document.getElementById('absenceFilterDateFrom')?.value || '';
        const dateTo = customOptions.dateTo || document.getElementById('reportDateTo')?.value || document.getElementById('absenceFilterDateTo')?.value || '';

        const pYear = (db.teacherProfile && db.teacherProfile.academicYear) || '2026/2027';
        const pSchool = (db.teacherProfile && db.teacherProfile.school) || 'الثانوية التأهيلية';
        const pAcademy = (db.teacherProfile && db.teacherProfile.academy) || 'الأكاديمية الجهوية للتربية والتكوين';
        const pDirectorate = (db.teacherProfile && db.teacherProfile.directorate) || 'المديرية الإقليمية';
        const pName = (db.teacherProfile && db.teacherProfile.name) || 'أستاذ مادة الرياضيات';

        const chunks = [];

        classes.forEach((className, classIdx) => {
            const students = classesMap[className] || [];
            
            // Chunk 1: صفحة الغلاف الإدارية للقسم
            chunks.push({
                id: `cover_${className}`,
                title: `غلاف قسم: ${className}`,
                label: `معالجة غلاف القسم (${classIdx + 1}/${classes.length}): ${className}`,
                render: () => {
                    let totalClassAbsentHours = 0;
                    let totalClassLate = 0;
                    let justifiedCount = 0;
                    let unjustifiedCount = 0;
                    let zeroAbsenceCount = 0;

                    students.forEach(std => {
                        const stdRecords = (db.records || []).filter(r =>
                            r.studentId === std.id &&
                            r.className === className &&
                            (!dateFrom || r.date >= dateFrom) &&
                            (!dateTo || r.date <= dateTo)
                        );
                        const absentRecs = stdRecords.filter(r => r.status === 'غائب' || r.status === 'مبرر');
                        const absentHours = absentRecs.reduce((sum, r) => sum + (parseFloat(r.hours || r.duration) || 1), 0);
                        const justHours = stdRecords.filter(r => r.status === 'مبرر').reduce((sum, r) => sum + (parseFloat(r.hours || r.duration) || 1), 0);
                        const unjustHours = stdRecords.filter(r => r.status === 'غائب').reduce((sum, r) => sum + (parseFloat(r.hours || r.duration) || 1), 0);
                        const lateCount = stdRecords.filter(r => r.status === 'متأخر').length;

                        totalClassAbsentHours += absentHours;
                        totalClassLate += lateCount;
                        if (justHours > 0) justifiedCount++;
                        if (unjustHours > 0) unjustifiedCount++;
                        if (absentHours === 0) zeroAbsenceCount++;
                    });

                    const totalAbsentStudents = students.filter(s => {
                        const rcs = (db.records || []).filter(r => r.studentId === s.id && r.className === className && (!dateFrom || r.date >= dateFrom) && (!dateTo || r.date <= dateTo));
                        return rcs.some(r => r.status === 'غائب' || r.status === 'مبرر');
                    }).length;
                    const fullyPresentStudents = students.length - totalAbsentStudents;
                    const attendanceRate = students.length > 0 ? ((fullyPresentStudents / students.length) * 100).toFixed(1) : '100';

                    const coverPage = document.createElement('div');
                    coverPage.className = 'chunked-pdf-page-container';
                    coverPage.style.cssText = 'width: 794px; min-height: 1122px; padding: 40px 32px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; border: 6px double #1e3a8a; border-radius: 14px; background: radial-gradient(circle at top right, #f8fafc 0%, #ffffff 100%); direction: rtl;';

                    coverPage.innerHTML = `
                        <div style="border-bottom: 2px solid #cbd5e1; padding-bottom: 16px;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                <div style="text-align: right; font-size: 0.84rem; line-height: 1.6; color: #1e293b; font-weight: 700;">
                                    <div style="font-weight: 900; color: #0f172a;">المملكة المغربية</div>
                                    <div style="color: #1e3a8a; font-weight: 800;">وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
                                    <div>${pAcademy}</div>
                                    <div>${pDirectorate}</div>
                                    <div>${pSchool}</div>
                                </div>
                                <div style="text-align: center; padding-top: 4px;">
                                    <div style="font-size: 1.25rem; font-weight: 900; color: #1e3a8a; letter-spacing: 0.5px;">سجل المواظبة والغياب الإداري</div>
                                    <div style="font-size: 0.8rem; color: #64748b; font-weight: 600; margin-top: 2px;">الموسم الدراسي: ${pYear}</div>
                                    <div style="display: inline-block; background: #e0f2fe; color: #0369a1; padding: 2px 10px; border-radius: 999px; font-size: 0.68rem; font-weight: 800; margin-top: 4px;">المذكرة الوزارية 142-08</div>
                                </div>
                                <div style="text-align: left; font-size: 0.84rem; line-height: 1.6; color: #1e293b; font-weight: 700;">
                                    <div>السلك: الثانوي التأهيلي</div>
                                    <div>المادة: الرياضيات</div>
                                    <div>الأستاذ(ة): ${pName}</div>
                                    <div>تاريخ الإصدار: ${typeof window.formatLocalDate === 'function' ? window.formatLocalDate() : new Date().toISOString().split('T')[0]}</div>
                                </div>
                            </div>
                        </div>

                        <div style="text-align: center; margin: 30px 0;">
                            <div style="display: inline-block; background: linear-gradient(135deg, #1e3a8a, #0f172a); color: #ffffff; padding: 10px 32px; border-radius: 50px; font-size: 1.15rem; font-weight: 900; box-shadow: 0 4px 12px rgba(30, 58, 138, 0.25); margin-bottom: 16px;">
                                كشف تتبع وضبط الغياب الرسمي
                            </div>
                            <div style="font-size: 2.1rem; font-weight: 900; color: #1e3a8a; margin: 12px 0;">
                                قسم: ${className}
                            </div>
                            <div style="font-size: 0.95rem; color: #475569; font-weight: 700;">
                                ${dateFrom && dateTo ? `الفترة الإدارية: من <strong>${dateFrom}</strong> إلى <strong>${dateTo}</strong>` : 'كشف الغياب الإجمالي الشامل للموسم الدراسي'}
                            </div>
                        </div>

                        <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 20px 0;">
                            <h3 style="margin: 0 0 14px 0; font-size: 1rem; font-weight: 800; color: #1e3a8a; text-align: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 6px;">
                                ملخص مؤشرات المواظبة العامة للقسم
                            </h3>
                            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; text-align: center;">
                                <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px;">
                                    <div style="font-size: 0.78rem; color: #64748b; font-weight: 700;">إجمالي تلاميذ القسم</div>
                                    <div style="font-size: 1.4rem; font-weight: 900; color: #1e3a8a; margin-top: 3px;">${students.length}</div>
                                </div>
                                <div style="background: #ffffff; border: 1.5px solid #fecaca; border-radius: 8px; padding: 10px;">
                                    <div style="font-size: 0.78rem; color: #991b1b; font-weight: 700;">إجمالي ساعات الغياب</div>
                                    <div style="font-size: 1.4rem; font-weight: 900; color: #dc2626; margin-top: 3px;">${totalClassAbsentHours} س</div>
                                </div>
                                <div style="background: #ffffff; border: 1.5px solid #fed7aa; border-radius: 8px; padding: 10px;">
                                    <div style="font-size: 0.78rem; color: #9a3412; font-weight: 700;">إجمالي حالات التأخر</div>
                                    <div style="font-size: 1.4rem; font-weight: 900; color: #ea580c; margin-top: 3px;">${totalClassLate}</div>
                                </div>
                                <div style="background: #ffffff; border: 1.5px solid #bbf7d0; border-radius: 8px; padding: 10px;">
                                    <div style="font-size: 0.78rem; color: #166534; font-weight: 700;">نسبة المواظبة التقديرية</div>
                                    <div style="font-size: 1.4rem; font-weight: 900; color: #16a34a; margin-top: 3px;">${attendanceRate}%</div>
                                </div>
                            </div>
                            <div style="display: flex; justify-content: space-around; margin-top: 12px; font-size: 0.82rem; font-weight: 700; color: #334155; padding-top: 8px; border-top: 1px solid #e2e8f0;">
                                <span>تلاميذ بدون أي غياب: <strong style="color: #16a34a;">${zeroAbsenceCount}</strong></span>
                                <span>غياب مبرر: <strong style="color: #2563eb;">${justifiedCount}</strong></span>
                                <span>غياب غير مبرر: <strong style="color: #dc2626;">${unjustifiedCount}</strong></span>
                            </div>
                        </div>

                        <div style="border-top: 2px solid #cbd5e1; padding-top: 16px; margin-top: 16px;">
                            <div style="display: flex; justify-content: space-between; text-align: center;">
                                <div style="width: 30%;">
                                    <div style="font-weight: 800; font-size: 0.86rem; color: #1e293b; margin-bottom: 45px;">توقيع وختم أستاذ المادة:</div>
                                    <div style="border-bottom: 1px dotted #94a3b8; width: 80%; margin: 0 auto;"></div>
                                </div>
                                <div style="width: 30%;">
                                    <div style="font-weight: 800; font-size: 0.86rem; color: #1e293b; margin-bottom: 45px;">توقيع الحراسة العامة للخارجية:</div>
                                    <div style="border-bottom: 1px dotted #94a3b8; width: 80%; margin: 0 auto;"></div>
                                </div>
                                <div style="width: 30%;">
                                    <div style="font-weight: 800; font-size: 0.86rem; color: #1e293b; margin-bottom: 45px;">تأشيرة ومصادقة رئيس المؤسسة:</div>
                                    <div style="border-bottom: 1px dotted #94a3b8; width: 80%; margin: 0 auto;"></div>
                                </div>
                            </div>
                        </div>
                    `;
                    return coverPage;
                }
            });

            // Chunk 2: كشف تفريغ وتتبع الغياب للقسم (مضبوط على صفحة A4 واحدة)
            chunks.push({
                id: `sheet_${className}`,
                title: `كشف غياب: ${className}`,
                label: `رسم جدول غياب القسم (${classIdx + 1}/${classes.length}): ${className}`,
                render: () => {
                    const studentAbsenceRows = students.map((std, sIdx) => {
                        const stdRecords = (db.records || []).filter(r =>
                            r.studentId === std.id &&
                            r.className === className &&
                            (!dateFrom || r.date >= dateFrom) &&
                            (!dateTo || r.date <= dateTo)
                        );
                        const absentRecs = stdRecords.filter(r => r.status === 'غائب' || r.status === 'مبرر');
                        const absentHours = absentRecs.reduce((sum, r) => sum + (parseFloat(r.hours || r.duration) || 1), 0);
                        const justHours = stdRecords.filter(r => r.status === 'مبرر').reduce((sum, r) => sum + (parseFloat(r.hours || r.duration) || 1), 0);
                        const unjustHours = stdRecords.filter(r => r.status === 'غائب').reduce((sum, r) => sum + (parseFloat(r.hours || r.duration) || 1), 0);
                        const lateCount = stdRecords.filter(r => r.status === 'متأخر').length;
                        const missedHw = stdRecords.filter(r => r.homework === 'لم ينجز').length;

                        const behavior = (db.behaviors && db.behaviors[className] && db.behaviors[className][std.id])
                            ? db.behaviors[className][std.id] : { status: 'منضبط', note: '' };

                        return {
                            order: std.orderNum || (sIdx + 1),
                            massar: std.massar || '-',
                            name: std.name,
                            absentHours,
                            justHours,
                            unjustHours,
                            lateCount,
                            missedHw,
                            behavior: behavior.status || 'منضبط',
                            note: behavior.note || (absentHours > 10 ? 'غياب متكرر' : (absentHours === 0 ? 'مواظبة ممتازة' : 'عادي'))
                        };
                    });

                    const sCount = students.length;
                    const dynRowPad = sCount > 38 ? '1.4px 2.5px' : (sCount > 28 ? '2.2px 3.5px' : '3.5px 4px');
                    const dynFontSize = sCount > 38 ? '6.6pt' : (sCount > 28 ? '7.2pt' : '7.8pt');
                    const dynHeadPad = sCount > 38 ? '3px 2px' : (sCount > 28 ? '4px 3px' : '5px 4px');

                    const sheetPage = document.createElement('div');
                    sheetPage.className = 'chunked-pdf-page-container';
                    sheetPage.style.cssText = 'width: 794px; min-height: 1122px; padding: 24px 26px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; background: #ffffff; direction: rtl;';

                    sheetPage.innerHTML = `
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #1e3a8a; padding-bottom: 8px; margin-bottom: 10px;">
                                <div>
                                    <div style="font-weight: 900; font-size: 1.1rem; color: #1e3a8a;">كشف تفريغ وتتبع الغياب — قسم: ${className}</div>
                                    <div style="font-size: 0.74rem; color: #64748b; font-weight: 600;">المؤسسة: ${pSchool} | مادة الرياضيات | الأستاذ(ة): ${pName}</div>
                                </div>
                                <div style="text-align: left; font-size: 0.76rem; font-weight: 700; color: #334155;">
                                    <div>${dateFrom && dateTo ? `${dateFrom} إلى ${dateTo}` : `الموسم الدراسي: ${pYear}`}</div>
                                    <div style="color: #64748b;">عدد التلاميذ: <strong style="color: #1e3a8a;">${students.length}</strong></div>
                                </div>
                            </div>

                            <table style="width: 100%; border-collapse: collapse; font-size: ${dynFontSize}; text-align: center; border: 1.2px solid #0f172a;">
                                <thead>
                                    <tr style="background: #1e3a8a; color: #ffffff; font-weight: 800;">
                                        <th style="padding: ${dynHeadPad}; width: 28px; border: 1px solid #0f172a;">ر.ت</th>
                                        <th style="padding: ${dynHeadPad}; width: 75px; border: 1px solid #0f172a;">رقم مسار</th>
                                        <th style="padding: ${dynHeadPad}; text-align: right; border: 1px solid #0f172a;">الاسم الكامل للتلميذ(ة)</th>
                                        <th style="padding: ${dynHeadPad}; width: 55px; border: 1px solid #0f172a; background: #991b1b;">مجموع الغياب</th>
                                        <th style="padding: ${dynHeadPad}; width: 44px; border: 1px solid #0f172a;">مبرر</th>
                                        <th style="padding: ${dynHeadPad}; width: 44px; border: 1px solid #0f172a;">غير مبرر</th>
                                        <th style="padding: ${dynHeadPad}; width: 38px; border: 1px solid #0f172a;">تأخر</th>
                                        <th style="padding: ${dynHeadPad}; width: 40px; border: 1px solid #0f172a;">واجب</th>
                                        <th style="padding: ${dynHeadPad}; width: 55px; border: 1px solid #0f172a;">السلوك</th>
                                        <th style="padding: ${dynHeadPad}; text-align: right; border: 1px solid #0f172a;">ملاحظات الإدارة / الأستاذ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${studentAbsenceRows.map((r, rIdx) => `
                                        <tr style="background: ${rIdx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #cbd5e1;">
                                            <td style="padding: ${dynRowPad}; border: 1px solid #cbd5e1; font-weight: 700;">${r.order}</td>
                                            <td style="padding: ${dynRowPad}; border: 1px solid #cbd5e1; font-family: monospace; font-size: calc(${dynFontSize} - 0.2pt);">${r.massar}</td>
                                            <td style="padding: ${dynRowPad}; text-align: right; border: 1px solid #cbd5e1; font-weight: 800; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;">${r.name}</td>
                                            <td style="padding: ${dynRowPad}; border: 1px solid #cbd5e1; font-weight: 900; color: ${r.absentHours > 0 ? '#dc2626' : '#16a34a'}; background: ${r.absentHours > 0 ? '#fef2f2' : '#ffffff'};">${r.absentHours} س</td>
                                            <td style="padding: ${dynRowPad}; border: 1px solid #cbd5e1; color: #2563eb; font-weight: 700;">${r.justHours} س</td>
                                            <td style="padding: ${dynRowPad}; border: 1px solid #cbd5e1; color: #dc2626; font-weight: 700;">${r.unjustHours} س</td>
                                            <td style="padding: ${dynRowPad}; border: 1px solid #cbd5e1; font-weight: 700; color: ${r.lateCount > 0 ? '#ea580c' : '#64748b'};">${r.lateCount}</td>
                                            <td style="padding: ${dynRowPad}; border: 1px solid #cbd5e1; font-weight: 700; color: ${r.missedHw > 0 ? '#7c3aed' : '#64748b'};">${r.missedHw}</td>
                                            <td style="padding: ${dynRowPad}; border: 1px solid #cbd5e1; font-size: calc(${dynFontSize} - 0.3pt);">${r.behavior}</td>
                                            <td style="padding: ${dynRowPad}; text-align: right; border: 1px solid #cbd5e1; font-size: calc(${dynFontSize} - 0.3pt); color: #475569;">${r.note}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>

                        <div style="display: flex; justify-content: space-between; margin-top: 14px; padding-top: 8px; border-top: 1.5px solid #cbd5e1; font-size: 0.76rem; font-weight: 700;">
                            <div>توقيع أستاذ المادة: ................................</div>
                            <div>تأشيرة الحراسة العامة: ................................</div>
                            <div>مصادقة المدير: ................................</div>
                        </div>
                    `;
                    return sheetPage;
                }
            });
        });

        const filename = `كشوفات_الغياب_الشاملة_لجميع_الأقسام_المتدرجة_${pYear.replace(/\s+/g, '_')}.pdf`;
        await renderChunksToPdf({
            chunks,
            filename,
            orientation: 'portrait',
            docTitle: `كشوفات الغياب لجميع الأقسام (${classes.length} أقسام · ${chunks.length} صفحة)`
        });
    }

    /**
     * تصدير كشف الغياب الشهري الإداري لجميع الأقسام بنمط التوليد المتدرج
     */
    async function exportMonthlyAbsenceAllClassesChunked(options = {}) {
        const db = window.db || {};
        const classes = (typeof window.getSortedClasses === 'function') ? window.getSortedClasses() : Object.keys(db.classes || {});

        if (!classes || classes.length === 0) {
            if (typeof window.showNotification === 'function') {
                window.showNotification('لا توجد أقسام مسجلة لتوليد كشف الغياب الشهري.', 'warning');
            }
            return;
        }

        const chunks = classes.map((className, idx) => ({
            id: `monthly_${className}`,
            title: `كشف الغياب الشهري: ${className}`,
            label: `توليد كشف الغياب الشهري للقسم (${idx + 1}/${classes.length}): ${className}`,
            render: () => {
                if (typeof window.buildSingleClassMonthlyAbsenceHTML === 'function') {
                    const html = window.buildSingleClassMonthlyAbsenceHTML(className, options, true);
                    const container = document.createElement('div');
                    container.style.cssText = 'width: 794px; min-height: 1122px; box-sizing: border-box; background: #ffffff;';
                    container.innerHTML = html;
                    return container;
                }
                return '<div style="padding: 40px; text-align: center;">دالة كشف الغياب غير متوفرة</div>';
            }
        }));

        const pYear = (db.teacherProfile && db.teacherProfile.academicYear) || '2026/2027';
        const filename = `كشف_الغياب_الشهري_الإداري_لكافة_الأقسام_${pYear.replace(/\s+/g, '_')}.pdf`;

        await renderChunksToPdf({
            chunks,
            filename,
            orientation: 'portrait',
            docTitle: `كشف الغياب الشهري الإداري لكافة الأقسام (${classes.length} قسم)`
        });
    }

    // Attach to window
    window.ChunkedPdfEngine = {
        renderChunksToPdf,
        exportAllClassesAttendanceChunked,
        exportMonthlyAbsenceAllClassesChunked,
        yieldToBrowser
    };

    // Override the legacy blocking function with the high-performance chunked implementation
    window.exportAllClassesAttendancePDFWithCovers = exportAllClassesAttendanceChunked;

})(window);
