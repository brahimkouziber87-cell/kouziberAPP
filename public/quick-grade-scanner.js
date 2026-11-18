/**
 * ====================================================================
 * ماسح الإدخال السريع المتسلسل والإملاء الصوتي للنقط - مادة الرياضيات
 * Quick Sequential Grade Scanner & Voice Dictation Engine
 * ====================================================================
 */

(function (window) {
    'use strict';

    let scannerState = {
        className: '',
        semester: 's1',
        examKey: 'f1',
        searchQuery: '',
        gradesMap: {}, // studentId -> grade string/number
        isVoiceListening: false,
        activeStudentIndexForVoice: 0,
        recognitionInstance: null
    };

    /**
     * فتح نافذة ماسح الإدخال السريع والإملاء الصوتي
     */
    function openQuickGradeScannerModal(preClassName, preExamKey) {
        ensureQuickGradeScannerModalExists();

        const modal = document.getElementById('quickGradeScannerModal');
        if (!modal) return;

        const dbClasses = (window.db && window.db.classes) ? Object.keys(window.db.classes) : [];
        if (preClassName && dbClasses.includes(preClassName)) {
            scannerState.className = preClassName;
        } else if (window.activeClass && dbClasses.includes(window.activeClass)) {
            scannerState.className = window.activeClass;
        } else if (dbClasses.length > 0) {
            scannerState.className = dbClasses[0];
        } else {
            scannerState.className = '';
        }

        scannerState.semester = typeof window.activeSemester !== 'undefined' ? window.activeSemester : 's1';
        scannerState.examKey = preExamKey || 'f1';
        scannerState.searchQuery = '';
        scannerState.isVoiceListening = false;
        scannerState.activeStudentIndexForVoice = 0;

        populateScannerSelectors();
        loadScannerGradesIntoMemory();
        renderScannerUI();

        modal.style.display = 'flex';
        if (window.renderLucide) window.renderLucide(modal);

        setTimeout(() => {
            const searchInput = document.getElementById('scannerSearchInput');
            if (searchInput) searchInput.focus();
        }, 150);
    }
    window.openQuickGradeScannerModal = openQuickGradeScannerModal;

    function closeQuickGradeScannerModal() {
        stopVoiceDictation();
        const modal = document.getElementById('quickGradeScannerModal');
        if (modal) modal.style.display = 'none';
    }
    window.closeQuickGradeScannerModal = closeQuickGradeScannerModal;

    function populateScannerSelectors() {
        const classSelect = document.getElementById('scannerClassSelect');
        const semesterSelect = document.getElementById('scannerSemesterSelect');
        const examSelect = document.getElementById('scannerExamSelect');

        if (classSelect) {
            const dbClasses = (window.db && window.db.classes) ? Object.keys(window.db.classes) : [];
            classSelect.innerHTML = dbClasses.length > 0
                ? dbClasses.map(c => `<option value="${escapeHtml(c)}" ${c === scannerState.className ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')
                : '<option value="">لا توجد أقسام مسجلة</option>';
        }

        if (semesterSelect) {
            semesterSelect.value = scannerState.semester;
        }

        if (examSelect) {
            examSelect.value = scannerState.examKey;
        }
    }

    function loadScannerGradesIntoMemory() {
        scannerState.gradesMap = {};
        if (!scannerState.className) return;

        const classGrades = (window.db && window.db.grades && window.db.grades[scannerState.className]) || {};
        const students = getScannerStudents();

        students.forEach(std => {
            let val = '';
            const stdGrades = classGrades[std.id] || {};
            
            if (typeof window.getStudentGradesBySemester === 'function') {
                const semObj = window.getStudentGradesBySemester(scannerState.className, std.id, scannerState.semester);
                if (semObj && semObj[scannerState.examKey] !== undefined) {
                    val = semObj[scannerState.examKey];
                }
            } else if (stdGrades[scannerState.examKey] !== undefined) {
                val = stdGrades[scannerState.examKey];
            } else if (stdGrades[scannerState.semester] && stdGrades[scannerState.semester][scannerState.examKey] !== undefined) {
                val = stdGrades[scannerState.semester][scannerState.examKey];
            }
            scannerState.gradesMap[std.id] = (val !== undefined && val !== null) ? String(val) : '';
        });
    }

    function getScannerStudents() {
        if (!window.db || !window.db.classes || !window.db.classes[scannerState.className]) return [];
        const raw = window.db.classes[scannerState.className];
        const list = Array.isArray(raw) ? raw : (raw.students || []);
        return list;
    }

    function renderScannerUI() {
        const rosterContainer = document.getElementById('scannerRosterContainer');
        const statsContainer = document.getElementById('scannerStatsContainer');
        const voiceStatusEl = document.getElementById('scannerVoiceStatusBadge');
        if (!rosterContainer) return;

        if (voiceStatusEl) {
            if (scannerState.isVoiceListening) {
                voiceStatusEl.style.display = 'inline-flex';
                voiceStatusEl.innerHTML = '<span class="animate-pulse" style="color: #ef4444; font-weight: 800;">🔴 جاري الاستماع للإملاء الصوتي... انطق النقطة</span>';
            } else {
                voiceStatusEl.style.display = 'none';
            }
        }

        const students = getScannerStudents();
        const query = (scannerState.searchQuery || '').trim().toLowerCase();

        const filtered = students.filter(std => {
            if (!query) return true;
            const name = String(std.name || '').toLowerCase();
            const massar = String(std.massar || std.id || '').toLowerCase();
            return name.includes(query) || massar.includes(query);
        });

        // Compute live stats
        let totalGraded = 0;
        let sumGrades = 0;
        let successCount = 0;
        let highest = -1;
        let lowest = 21;

        students.forEach(std => {
            const rawVal = scannerState.gradesMap[std.id];
            if (rawVal !== undefined && rawVal !== '' && rawVal !== 'غ' && rawVal !== 'إ') {
                const num = parseFloat(rawVal);
                if (!isNaN(num)) {
                    totalGraded++;
                    sumGrades += num;
                    if (num >= 10) successCount++;
                    if (num > highest) highest = num;
                    if (num < lowest) lowest = num;
                }
            }
        });

        const classAvg = totalGraded > 0 ? (sumGrades / totalGraded).toFixed(2) : '--';
        const successRate = totalGraded > 0 ? Math.round((successCount / totalGraded) * 100) : 0;

        if (statsContainer) {
            statsContainer.innerHTML = `
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 5px 8px; text-align: center;">
                    <div style="font-size: 0.64rem; color: #15803d; font-weight: 700;">المعدل الحسابي</div>
                    <div style="font-size: 0.88rem; font-weight: 900; color: #166534;">${classAvg} / 20</div>
                </div>
                <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 5px 8px; text-align: center;">
                    <div style="font-size: 0.64rem; color: #1e40af; font-weight: 700;">نسبة النجاح (>= 10)</div>
                    <div style="font-size: 0.88rem; font-weight: 900; color: #1e3a8a;">${successRate}%</div>
                </div>
                <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 6px; padding: 5px 8px; text-align: center;">
                    <div style="font-size: 0.64rem; color: #7e22ce; font-weight: 700;">المرصود / الإجمالي</div>
                    <div style="font-size: 0.88rem; font-weight: 900; color: #6b21a8;">${totalGraded} / ${students.length}</div>
                </div>
                <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 5px 8px; text-align: center;">
                    <div style="font-size: 0.64rem; color: #b45309; font-weight: 700;">أعلى / أدنى نقطة</div>
                    <div style="font-size: 0.88rem; font-weight: 900; color: #92400e;">${highest >= 0 ? highest : '--'} / ${lowest <= 20 ? lowest : '--'}</div>
                </div>
            `;
        }

        if (filtered.length === 0) {
            rosterContainer.innerHTML = `<div style="text-align: center; padding: 16px; color: #64748b; font-weight: 700;">لا توجد نتائج تطابق بحثك "${escapeHtml(scannerState.searchQuery)}"</div>`;
            return;
        }

        let html = `
            <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; table-layout: auto;">
                <thead>
                    <tr style="background: #0f172a; color: #f8fafc; text-align: right;">
                        <th style="padding: 5px 8px; width: 35px; text-align: center; white-space: nowrap;">ر.ت</th>
                        <th style="padding: 5px 8px; min-width: 200px; width: auto; text-align: right;">الاسم الكامل للتلميذ(ة)</th>
                        <th style="padding: 5px 8px; width: 95px; text-align: center; white-space: nowrap;">النقطة (/20)</th>
                        <th style="padding: 5px 8px; width: 90px; text-align: center; white-space: nowrap;">رقم مسار</th>
                        <th style="padding: 5px 8px; width: 120px; text-align: center; white-space: nowrap;">أزرار الإدخال السريع</th>
                    </tr>
                </thead>
                <tbody>
        `;

        filtered.forEach((std, index) => {
            const originalIndex = students.indexOf(std) + 1;
            const val = scannerState.gradesMap[std.id] !== undefined ? scannerState.gradesMap[std.id] : '';
            const numVal = parseFloat(val);
            const isActiveVoiceTarget = scannerState.isVoiceListening && index === scannerState.activeStudentIndexForVoice;
            
            let badgeBg = '#f1f5f9';
            let badgeColor = '#334155';
            if (!isNaN(numVal)) {
                if (numVal >= 14) { badgeBg = '#dcfce7'; badgeColor = '#15803d'; }
                else if (numVal >= 10) { badgeBg = '#dbeafe'; badgeColor = '#1e40af'; }
                else if (numVal >= 8) { badgeBg = '#fef3c7'; badgeColor = '#b45309'; }
                else { badgeBg = '#fee2e2'; badgeColor = '#b91c1c'; }
            } else if (val === 'غ') {
                badgeBg = '#fee2e2'; badgeColor = '#991b1b';
            } else if (val === 'إ') {
                badgeBg = '#f3f4f6'; badgeColor = '#4b5563';
            }

            const rowBg = isActiveVoiceTarget ? '#eff6ff' : 'transparent';
            const rowBorder = isActiveVoiceTarget ? '2px solid #2563eb' : '1px solid #e2e8f0';

            html += `
                <tr style="border-bottom: ${rowBorder}; background: ${rowBg}; transition: background 0.1s;" onmouseover="if(!${isActiveVoiceTarget}) this.style.background='#f8fafc'" onmouseout="if(!${isActiveVoiceTarget}) this.style.background='transparent'">
                    <td style="padding: 4px 8px; text-align: center; font-weight: 800; color: #64748b; white-space: nowrap;">${originalIndex}</td>
                    <td style="padding: 4px 8px; font-weight: 800; color: #0f172a; text-align: right;" title="${escapeHtml(std.name || '')}">
                        ${escapeHtml(std.name || '')}
                        ${isActiveVoiceTarget ? '<span style="color: #2563eb; font-size: 0.68rem; margin-right: 4px;">🎤 [مستهدف]</span>' : ''}
                    </td>
                    <td style="padding: 4px 8px; text-align: center; white-space: nowrap;">
                        <input type="text" 
                            id="scannerInput_${escapeHtml(std.id)}" 
                            value="${escapeHtml(val)}" 
                            oninput="window.onScannerGradeInput('${escapeHtml(std.id)}', this.value)"
                            onkeydown="window.onScannerKeyNavigation(event, ${index}, ${filtered.length}, '${escapeHtml(std.id)}')"
                            placeholder="0-20 أو غ" 
                            style="width: 65px; height: 26px; padding: 2px 4px; text-align: center; font-weight: 800; font-size: 0.85rem; border-radius: 5px; border: 1.5px solid #cbd5e1; background: ${badgeBg}; color: ${badgeColor}; outline: none; font-family: monospace;"
                            maxlength="5">
                    </td>
                    <td style="padding: 4px 8px; text-align: center; font-family: monospace; font-size: 0.74rem; color: #475569; direction: ltr; white-space: nowrap;">${escapeHtml(std.massar || std.id || '')}</td>
                    <td style="padding: 4px 8px; text-align: center; white-space: nowrap;">
                        <div style="display: inline-flex; gap: 2px; align-items: center;">
                            <button type="button" onclick="window.setScannerGradeQuick('${escapeHtml(std.id)}', '20')" style="background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; height: 24px; padding: 0 4px; border-radius: 4px; font-weight: 800; font-size: 0.65rem; cursor: pointer;" title="20">20</button>
                            <button type="button" onclick="window.setScannerGradeQuick('${escapeHtml(std.id)}', '15')" style="background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; height: 24px; padding: 0 4px; border-radius: 4px; font-weight: 800; font-size: 0.65rem; cursor: pointer;" title="15">15</button>
                            <button type="button" onclick="window.setScannerGradeQuick('${escapeHtml(std.id)}', '10')" style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a; height: 24px; padding: 0 4px; border-radius: 4px; font-weight: 800; font-size: 0.65rem; cursor: pointer;" title="10">10</button>
                            <button type="button" onclick="window.setScannerGradeQuick('${escapeHtml(std.id)}', 'غ')" style="background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; height: 24px; padding: 0 4px; border-radius: 4px; font-weight: 800; font-size: 0.65rem; cursor: pointer;" title="غائب">غ</button>
                            <button type="button" onclick="window.setScannerGradeQuick('${escapeHtml(std.id)}', '')" style="background: #f1f5f9; color: #64748b; border: 1.5px solid #cbd5e1; height: 24px; padding: 0 4px; border-radius: 4px; font-weight: 800; font-size: 0.65rem; cursor: pointer;" title="مسح">✕</button>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        rosterContainer.innerHTML = html;
    }

    window.onScannerGradeInput = function (studentId, rawValue) {
        let cleaned = rawValue.trim();
        if (cleaned !== '' && cleaned !== 'غ' && cleaned !== 'إ') {
            cleaned = cleaned.replace(',', '.');
            const num = parseFloat(cleaned);
            if (!isNaN(num)) {
                if (num < 0) cleaned = '0';
                if (num > 20) cleaned = '20';
            }
        }
        scannerState.gradesMap[studentId] = cleaned;
    };

    window.setScannerGradeQuick = function (studentId, val) {
        scannerState.gradesMap[studentId] = val;
        const inputEl = document.getElementById(`scannerInput_${studentId}`);
        if (inputEl) {
            inputEl.value = val;
        }
        renderScannerUI();
    };

    window.onScannerKeyNavigation = function (event, currentIndex, totalCount, studentId) {
        if (event.key === 'Enter' || event.key === 'ArrowDown') {
            event.preventDefault();
            const students = getScannerStudents();
            const nextIdx = (currentIndex + 1) % totalCount;
            const nextStd = students[nextIdx];
            if (nextStd) {
                const nextInput = document.getElementById(`scannerInput_${nextStd.id}`);
                if (nextInput) {
                    nextInput.focus();
                    nextInput.select();
                }
            }
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            const students = getScannerStudents();
            const prevIdx = (currentIndex - 1 + totalCount) % totalCount;
            const prevStd = students[prevIdx];
            if (prevStd) {
                const prevInput = document.getElementById(`scannerInput_${prevStd.id}`);
                if (prevInput) {
                    prevInput.focus();
                    prevInput.select();
                }
            }
        }
    };

    window.applyScannerSearch = function (q) {
        scannerState.searchQuery = q || '';
        renderScannerUI();
    };

    window.onScannerClassChange = function (cls) {
        scannerState.className = cls;
        loadScannerGradesIntoMemory();
        renderScannerUI();
    };

    window.onScannerSemesterChange = function (sem) {
        scannerState.semester = sem;
        loadScannerGradesIntoMemory();
        renderScannerUI();
    };

    window.onScannerExamChange = function (exam) {
        scannerState.examKey = exam;
        loadScannerGradesIntoMemory();
        renderScannerUI();
    };

    /**
     * تشغيل / إيقاف الإملائي الصوتي للنقط (Voice Dictation)
     */
    window.toggleScannerVoiceDictation = function () {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            if (typeof window.notifySafeToast === 'function') {
                window.notifySafeToast('⚠️ متصفحك الحالي لا يدعم ميزة التعرف على الصوت والإملاء الصوتي. يرجى استخدام متصفح Google Chrome.');
            }
            return;
        }

        if (scannerState.isVoiceListening) {
            stopVoiceDictation();
            return;
        }

        try {
            const recognition = new SpeechRecognition();
            scannerState.recognitionInstance = recognition;
            recognition.lang = 'ar-MA';
            recognition.continuous = true;
            recognition.interimResults = false;

            recognition.onstart = () => {
                scannerState.isVoiceListening = true;
                renderScannerUI();
                if (typeof window.notifySafeToast === 'function') {
                    window.notifySafeToast('🎤 تم تفعيل الإملاء الصوتي للنقط. انطق النقطة بوضوح للتلميذ الحالي...');
                }
            };

            recognition.onresult = (event) => {
                const transcript = event.results[event.results.length - 1][0].transcript.trim();
                processSpokenGradeTranscript(transcript);
            };

            recognition.onerror = (err) => {
                console.warn('Speech recognition error:', err);
                const code = err && err.error ? String(err.error) : '';
                if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture') {
                    stopVoiceDictation();
                }
            };

            recognition.onend = () => {
                if (scannerState.isVoiceListening) {
                    try { recognition.start(); } catch (e) {}
                }
            };

            recognition.start();
        } catch (e) {
            console.error('Failed to start speech recognition:', e);
            scannerState.isVoiceListening = false;
            if (typeof window.notifySafeToast === 'function') {
                window.notifySafeToast('⚠️ تعذر بدء الإملاء الصوتي: ' + e.message);
            }
        }
    };

    function stopVoiceDictation() {
        scannerState.isVoiceListening = false;
        if (scannerState.recognitionInstance) {
            try { scannerState.recognitionInstance.stop(); } catch (e) {}
            scannerState.recognitionInstance = null;
        }
        renderScannerUI();
    }

    function processSpokenGradeTranscript(text) {
        const cleanedText = String(text || '').trim().toLowerCase();
        let valToSet = null;

        if (cleanedText === 'غ' || cleanedText.includes('غيب') || cleanedText.includes('غائب') || cleanedText.includes('غياب')) {
            valToSet = 'غ';
        } else if (cleanedText.includes('إعفاء') || cleanedText.includes('معفي')) {
            valToSet = 'إ';
        } else if (typeof window.parseArabicSpokenScore === 'function') {
            const parsed = window.parseArabicSpokenScore(cleanedText);
            if (parsed === 'ABSENT') {
                valToSet = 'غ';
            } else if (parsed === 'CLEAR') {
                valToSet = '';
            } else if (parsed !== null && parsed !== undefined) {
                valToSet = String(parsed);
            }
        } else {
            const match = cleanedText.match(/(\d+([.,]\d+)?)/);
            if (match) {
                const num = parseFloat(match[1].replace(',', '.'));
                if (!isNaN(num) && num >= 0 && num <= 20) {
                    valToSet = String(num);
                }
            }
        }

        if (valToSet !== null) {
            const students = getScannerStudents();
            if (students.length > 0 && scannerState.activeStudentIndexForVoice < students.length) {
                const currentStd = students[scannerState.activeStudentIndexForVoice];
                window.setScannerGradeQuick(currentStd.id, valToSet);

                scannerState.activeStudentIndexForVoice = (scannerState.activeStudentIndexForVoice + 1) % students.length;
                renderScannerUI();

                if (typeof window.notifySafeToast === 'function') {
                    window.notifySafeToast(`✅ تم رصد النقطة (${valToSet || 'مسح'}) لـ: ${currentStd.name}`);
                }
            }
        }
    }

    /**
     * لصق عمود نقط من الحافظة (Excel / CSV) وتعبئتها تسلسلياً (بدون prompt المحظور في الإطارات)
     */
    window.openPasteGradesPrompt = function () {
        const box = document.getElementById('scannerPasteInlineBox');
        if (box) {
            box.style.display = box.style.display === 'none' ? 'block' : 'none';
            const area = document.getElementById('scannerPasteTextarea');
            if (area && box.style.display === 'block') area.focus();
        }
    };

    window.applyPastedScannerGrades = function () {
        const area = document.getElementById('scannerPasteTextarea');
        const text = area ? area.value : '';
        if (!text || !text.trim()) return;

        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');
        if (lines.length === 0) return;

        const students = getScannerStudents();
        let updatedCount = 0;

        lines.forEach((line, idx) => {
            if (idx < students.length) {
                let clean = line.replace(',', '.');
                const num = parseFloat(clean);
                if (!isNaN(num)) {
                    if (num < 0) clean = '0';
                    if (num > 20) clean = '20';
                    scannerState.gradesMap[students[idx].id] = String(clean);
                    updatedCount++;
                } else if (line === 'غ' || line === 'إ') {
                    scannerState.gradesMap[students[idx].id] = line;
                    updatedCount++;
                }
            }
        });

        const box = document.getElementById('scannerPasteInlineBox');
        if (box) box.style.display = 'none';
        if (area) area.value = '';

        renderScannerUI();
        if (typeof window.notifySafeToast === 'function') {
            window.notifySafeToast(`✅ تم بنجاح استيراد ولصق ${updatedCount} نقطة تسلسلياً.`);
        }
    };

    /**
     * حفظ النقط المرصودة في قاعدة البيانات ومزامنتها سحابياً
     */
    window.saveQuickScannerGrades = function () {
        stopVoiceDictation();
        if (!scannerState.className) {
            if (typeof window.notifySafeToast === 'function') window.notifySafeToast('⚠️ يرجى تحديد القسم أولاً.');
            return;
        }

        if (!window.db) window.db = {};
        if (!window.db.grades) window.db.grades = {};
        if (!window.db.grades[scannerState.className]) {
            window.db.grades[scannerState.className] = {};
        }

        const students = getScannerStudents();
        let savedCount = 0;

        students.forEach(std => {
            const rawVal = scannerState.gradesMap[std.id];
            if (rawVal !== undefined && rawVal !== '') {
                savedCount++;
                if (!window.db.grades[scannerState.className][std.id]) {
                    window.db.grades[scannerState.className][std.id] = { s1: {}, s2: {} };
                }
                const stdRecord = window.db.grades[scannerState.className][std.id];
                
                if (!stdRecord.s1) stdRecord.s1 = {};
                if (!stdRecord.s2) stdRecord.s2 = {};

                if (scannerState.semester === 's2') {
                    stdRecord.s2[scannerState.examKey] = rawVal;
                    if (window.db.gradesS2 && window.db.gradesS2[scannerState.className] && window.db.gradesS2[scannerState.className][std.id]) {
                        window.db.gradesS2[scannerState.className][std.id][scannerState.examKey] = rawVal;
                    }
                } else {
                    stdRecord.s1[scannerState.examKey] = rawVal;
                    stdRecord[scannerState.examKey] = rawVal;
                    if (window.db.gradesS1 && window.db.gradesS1[scannerState.className] && window.db.gradesS1[scannerState.className][std.id]) {
                        window.db.gradesS1[scannerState.className][std.id][scannerState.examKey] = rawVal;
                    }
                }
            }
        });

        if (typeof window.saveDB === 'function') {
            window.saveDB();
        }
        window.dispatchEvent(new Event('dbUpdated'));

        if (typeof window.renderStudents === 'function') {
            try { window.renderStudents(); } catch (e) {}
        }
        if (typeof window.renderGradesTable === 'function') {
            try { window.renderGradesTable(); } catch(e) {}
        }

        if (typeof window.notifySafeToast === 'function') {
            window.notifySafeToast(`✅ تم حفظ وترحيل ${savedCount} نقطة بنجاح إلى سجل القسم ومزامنتها مع السحابة.`);
        }

        closeQuickGradeScannerModal();
    };

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function ensureQuickGradeScannerModalExists() {
        if (document.getElementById('quickGradeScannerModal')) return;

        const modalDiv = document.createElement('div');
        modalDiv.id = 'quickGradeScannerModal';
        modalDiv.style.cssText = 'display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.78); backdrop-filter: blur(5px); z-index: 14000; align-items: center; justify-content: center; padding: 10px; box-sizing: border-box;';

        modalDiv.innerHTML = `
            <div class="card" style="width: 100%; max-width: 900px; max-height: 96vh; overflow-y: auto; background: #ffffff; border-radius: 14px; border: 1.5px solid #cbd5e1; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.35); padding: 0; display: flex; flex-direction: column;">

                <!-- Modal Header -->
                <div style="padding: 10px 14px; border-bottom: 1.5px solid #e2e8f0; background: linear-gradient(135deg, #0f172a, #1e293b); color: #fff; border-top-left-radius: 12px; border-top-right-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; background: rgba(37, 99, 235, 0.2); color: #60a5fa; border: 1.5px solid rgba(96, 165, 250, 0.4);">
                            <span data-lucide="zap" data-size="16"></span>
                        </span>
                        <div>
                            <h3 style="margin: 0; font-size: 1rem; font-weight: 800; color: #f8fafc;">ماسح الإدخال السريع والإملاء الصوتي للنقط ⚡</h3>
                            <p style="margin: 1px 0 0 0; font-size: 0.72rem; color: #94a3b8;">إدخال متسلسل فائق السرعة عبر لوحة المفاتيح والصوت</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeQuickGradeScannerModal()" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #cbd5e1; border-radius: 6px; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.95rem;" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">✕</button>
                </div>

                <!-- Modal Body -->
                <div style="padding: 12px; flex: 1; display: flex; flex-direction: column; gap: 10px;">

                    <!-- Top Bar: Selectors (Class, Semester, Component/Exam) -->
                    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 8px 12px;">
                        <select id="scannerClassSelect" onchange="window.onScannerClassChange(this.value)" style="flex: 1; min-width: 140px; padding: 5px 8px; border-radius: 6px; border: 1.5px solid #cbd5e1; font-weight: 700; color: #1e293b; background: #fff; cursor: pointer; font-size: 0.78rem;"></select>
                        <select id="scannerSemesterSelect" onchange="window.onScannerSemesterChange(this.value)" style="width: 110px; padding: 5px 8px; border-radius: 6px; border: 1.5px solid #cbd5e1; font-weight: 700; color: #1e293b; background: #fff; cursor: pointer; font-size: 0.78rem;">
                            <option value="s1">الأسدوس 1</option>
                            <option value="s2">الأسدوس 2</option>
                        </select>
                        <select id="scannerExamSelect" onchange="window.onScannerExamChange(this.value)" style="width: 140px; padding: 5px 8px; border-radius: 6px; border: 1.5px solid #cbd5e1; font-weight: 700; color: #1e293b; background: #fff; cursor: pointer; font-size: 0.78rem;">
                            <option value="f1">الفرض 1 (F1)</option>
                            <option value="f2">الفرض 2 (F2)</option>
                            <option value="f3">الفرض 3 (F3)</option>
                            <option value="f4">الفرض 4 (F4)</option>
                            <option value="act">الأنشطة والمواظبة</option>
                        </select>
                    </div>

                    <!-- Second Action Bar: Search + Voice Dictation + Paste -->
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <div style="position: relative; flex: 1; min-width: 200px;">
                            <span style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #64748b;"><span data-lucide="search" data-size="14"></span></span>
                            <input type="text" id="scannerSearchInput" oninput="window.applyScannerSearch(this.value)" placeholder="بحث سريع عن تلميذ بالاسم أو رقم مسار..." style="width: 100%; padding: 6px 32px 6px 10px; border-radius: 6px; border: 1.5px solid #cbd5e1; font-size: 0.78rem; outline: none; background: #fff;">
                        </div>

                        <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                            <button type="button" onclick="window.toggleScannerVoiceDictation()" style="background: linear-gradient(135deg, #dc2626, #b91c1c); color: #fff; border: none; height: 28px; padding: 0 12px; border-radius: 6px; font-weight: 800; font-size: 0.74rem; display: inline-flex; align-items: center; gap: 5px; cursor: pointer; box-shadow: 0 2px 6px rgba(220, 38, 38, 0.3);" title="تفعيل الإملاء الصوتي التلقائي للنقط">
                                <span data-lucide="mic" data-size="14"></span>
                                <span>الإملاء الصوتي 🎤</span>
                            </button>

                            <button type="button" onclick="window.openPasteGradesPrompt()" style="background: #eff6ff; color: #1e40af; border: 1.5px solid #bfdbfe; height: 28px; padding: 0 10px; border-radius: 6px; font-weight: 800; font-size: 0.74rem; display: inline-flex; align-items: center; gap: 5px; cursor: pointer;" title="لصق عمود نقط من إكسيل (Excel) دفعة واحدة">
                                <span data-lucide="clipboard-paste" data-size="13"></span>
                                <span>لصق من إكسيل</span>
                            </button>
                        </div>
                    </div>

                    <!-- Inline Excel Paste Box -->
                    <div id="scannerPasteInlineBox" style="display: none; background: #f8fafc; border: 1.5px dashed #93c5fd; border-radius: 8px; padding: 10px;">
                        <div style="font-size: 0.76rem; font-weight: 800; color: #1e3a8a; margin-bottom: 6px;">انسخ عمود النقط من Excel ثم الصقه هنا (كل نقطة في سطر مستقل):</div>
                        <textarea id="scannerPasteTextarea" rows="4" placeholder="14.5&#10;16&#10;12.25&#10;..." style="width: 100%; border-radius: 6px; border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 0.8rem; font-family: monospace; margin-bottom: 6px;"></textarea>
                        <div style="display: flex; justify-content: flex-end; gap: 6px;">
                            <button type="button" onclick="document.getElementById('scannerPasteInlineBox').style.display='none'" style="background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 10px; font-size: 0.74rem; font-weight: 700; cursor: pointer;">إلغاء</button>
                            <button type="button" onclick="window.applyPastedScannerGrades()" style="background: #2563eb; color: #fff; border: none; border-radius: 6px; padding: 4px 12px; font-size: 0.74rem; font-weight: 800; cursor: pointer;">تطبيق النقط الملصقة</button>
                        </div>
                    </div>

                    <!-- Voice Status Alert Badge -->
                    <div id="scannerVoiceStatusBadge" style="display: none; background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 6px; padding: 6px 10px; align-items: center; justify-content: center; font-size: 0.8rem;"></div>

                    <!-- Live Stats Bar -->
                    <div id="scannerStatsContainer" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 6px;"></div>

                    <!-- Roster Scrollable Table -->
                    <div id="scannerRosterContainer" style="border: 1.5px solid #cbd5e1; border-radius: 8px; max-height: 400px; overflow-y: auto; background: #fff;"></div>

                </div>

                <!-- Modal Footer -->
                <div style="padding: 8px 14px; border-top: 1.5px solid #e2e8f0; background: #f8fafc; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 0.72rem; color: #64748b; font-weight: 700;">💡 اضغط Enter أو السهم (↓) للانتقال للتلميذ الموالي.</span>
                    <div style="display: flex; gap: 6px;">
                        <button type="button" onclick="closeQuickGradeScannerModal()" style="padding: 6px 12px; border: 1.5px solid #cbd5e1; background: #fff; color: #475569; border-radius: 6px; font-weight: 800; font-size: 0.78rem; cursor: pointer;">
                            إغلاق
                        </button>
                        <button type="button" onclick="window.saveQuickScannerGrades()" class="btn-primary" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); border: none; padding: 6px 16px; border-radius: 6px; font-weight: 800; font-size: 0.8rem; color: #fff; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.3); cursor: pointer;">
                            <span data-lucide="save" data-size="14"></span>
                            <span>حفظ وترحيل النقط للسجل وسحابة Firestore</span>
                        </button>
                    </div>
                </div>

            </div>
        `;

        document.body.appendChild(modalDiv);
    }

})(window);
