/**
 * ============================================================================
 * وحدة مسح وتفريغ الملاحظات والجذاذات التربوية المكتوبة بخط اليد عبر الكاميرا و Gemini AI
 * Camera & Handwritten Pedagogical Notes / Lesson Plans Scanner (Gemini Vision AI)
 * ============================================================================
 */
(function () {
    'use strict';

    var _cameraStream = null;
    var _cameraFacingMode = 'environment';
    var _capturedImageBase64 = '';
    var _capturedMimeType = 'image/jpeg';
    var _lastTranscriptionResult = null;
    var _activeScannerTargetMode = 'auto';

    function getActiveClassNameForScanner() {
        var lessonLogView = document.getElementById('lessonLogView');
        var notesView = document.getElementById('notesView');
        if (lessonLogView && lessonLogView.style.display !== 'none') {
            var llSel = document.getElementById('lessonLogClassSelect');
            if (llSel && llSel.value) return llSel.value;
        }
        if (notesView && notesView.style.display !== 'none') {
            var nSel = document.getElementById('notesClassSelect');
            if (nSel && nSel.value) return nSel.value;
        }
        var nSelFallback = document.getElementById('notesClassSelect') || document.getElementById('lessonLogClassSelect') || document.getElementById('classSelect');
        if (nSelFallback && nSelFallback.value) return nSelFallback.value;
        if (window.db && window.db.classes) {
            var keys = Object.keys(window.db.classes);
            if (keys.length > 0) return keys[0];
        }
        return '';
    }

    function extractStudentsArrayFromClass(rawClass) {
        if (!rawClass) return [];
        if (Array.isArray(rawClass)) return rawClass;
        if (Array.isArray(rawClass.students)) return rawClass.students;
        return [];
    }

    function getClassStudentsNamesList(className) {
        if (!className || !window.db || !window.db.classes) {
            return [];
        }
        var students = extractStudentsArrayFromClass(window.db.classes[className]);
        return students
            .map(function (s) { return s && s.name ? String(s.name).trim() : ''; })
            .filter(Boolean);
    }

    function ensureCameraScannerModalExists() {
        var existing = document.getElementById('handwrittenCameraScannerModal');
        if (existing) return existing;

        var modal = document.createElement('div');
        modal.id = 'handwrittenCameraScannerModal';
        modal.style.cssText = 'display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.78); z-index: 100050; backdrop-filter: blur(5px); align-items: center; justify-content: center; padding: 14px; direction: rtl; font-family: "Cairo", sans-serif;';

        modal.innerHTML = [
            '<div style="background: #ffffff; width: 100%; max-width: 980px; max-height: 92vh; border-radius: 18px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); display: flex; flex-direction: column; overflow: hidden; border: 1.5px solid #cbd5e1;">',
            '  <!-- Header -->',
            '  <div style="padding: 15px 20px; background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #4f46e5 100%); color: #ffffff; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">',
            '    <div style="display: flex; align-items: center; gap: 10px;">',
            '      <span style="display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 10px; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.28); font-size: 1.2rem;">📸</span>',
            '      <div>',
            '        <h3 style="margin: 0; font-size: 1.08rem; font-weight: 900; color: #ffffff; display: flex; align-items: center; gap: 8px;">',
            '          <span>مسح وتفريغ الملاحظات والجذاذات التربوية بالكاميرا (Gemini Vision AI)</span>',
            '          <span style="background: rgba(16, 185, 129, 0.25); color: #a7f3d0; border: 1px solid rgba(167, 243, 208, 0.4); font-size: 0.7rem; padding: 2px 8px; border-radius: 999px; font-weight: 800;">ذكاء اصطناعي بصري</span>',
            '        </h3>',
            '        <p style="margin: 2px 0 0 0; font-size: 0.77rem; color: #cbd5e1;">التقط صورة لملاحظاتك اليدوية أو جذاذة تحضير الدرس ليقوم Gemini AI بتفريغها وتنظيمها وإدراجها في التطبيق</p>',
            '      </div>',
            '    </div>',
            '    <button type="button" onclick="window.closeHandwrittenCameraScannerModal()" style="background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.22); color: #ffffff; width: 34px; height: 34px; border-radius: 9px; cursor: pointer; font-weight: 900; font-size: 1rem; display: flex; align-items: center; justify-content: center;" title="إغلاق">✕</button>',
            '  </div>',
            '',
            '  <!-- Top Config Strip -->',
            '  <div style="padding: 10px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between;">',
            '    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">',
            '      <label style="font-size: 0.78rem; font-weight: 800; color: #334155;">القسم المستهدف:</label>',
            '      <select id="cameraScannerClassSelect" style="padding: 5px 10px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-weight: 800; font-size: 0.82rem; color: #0f172a; background: #ffffff; font-family: inherit;"></select>',
            '      <label style="font-size: 0.78rem; font-weight: 800; color: #334155; margin-right: 6px;">نوع الوثيقة المصورة:</label>',
            '      <select id="cameraScannerTargetModeSelect" style="padding: 5px 10px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-weight: 800; font-size: 0.82rem; color: #1e3a8a; background: #eff6ff; font-family: inherit;">',
            '        <option value="auto">✨ تلقائي شامل (ملاحظات + جذاذة حصة + واجبات)</option>',
            '        <option value="notes">📝 ملاحظات تربوية وتوجيهات للتلاميذ أو القسم</option>',
            '        <option value="lesson_plan">📘 جذاذة تخطيط حصة / دفتر النصوص (Cahier de Textes)</option>',
            '        <option value="homework">📚 واجب منزلي / سلسلة تمارين رياضية</option>',
            '      </select>',
            '    </div>',
            '    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">',
            '      <input type="file" id="cameraScannerFileInput" accept="image/*" capture="environment" style="display: none;" onchange="window.handleCameraScannerFileUpload(event)">',
            '      <button type="button" onclick="document.getElementById(\'cameraScannerFileInput\').click()" style="background: #ffffff; color: #1e40af; border: 1.5px solid #93c5fd; padding: 6px 12px; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">',
            '        <span>🖼️ رفع صورة أو التقاط من الهاتف</span>',
            '      </button>',
            '      <button type="button" id="btnToggleLiveCameraStream" onclick="window.startHandwrittenCameraStream()" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; border: none; padding: 6px 12px; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 2px 6px rgba(37,99,235,0.25);">',
            '        <span>📷 تشغيل الكاميرا المباشرة</span>',
            '      </button>',
            '    </div>',
            '  </div>',
            '',
            '  <!-- Body: 2 Columns on Desktop (Capture Left/Right + AI Results) -->',
            '  <div style="padding: 16px 20px; overflow-y: auto; flex: 1; display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 16px; align-items: start;">',
            '    <!-- Column 1: Camera Viewport & Image Preview -->',
            '    <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">',
            '      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">',
            '        <span style="font-size: 0.84rem; font-weight: 900; color: #0f172a;">1️⃣ التقاط أو معاينة صورة الوثيقة اليدوية</span>',
            '        <span id="cameraScannerStatusBadge" style="font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 999px; background: #e2e8f0; color: #475569;">جاهز للالتقاط</span>',
            '      </div>',
            '',
            '      <!-- Live Video Container -->',
            '      <div id="cameraLiveVideoWrapper" style="display: none; position: relative; background: #0f172a; border-radius: 12px; overflow: hidden; min-height: 220px; border: 2px solid #3b82f6;">',
            '        <video id="cameraScannerVideoEl" autoplay playsinline muted style="width: 100%; max-height: 280px; object-fit: cover; display: block;"></video>',
            '        <div style="position: absolute; bottom: 10px; left: 0; right: 0; display: flex; justify-content: center; gap: 8px; padding: 0 10px;">',
            '          <button type="button" onclick="window.captureSnapshotFromCameraVideo()" style="background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; border: 2px solid #ffffff; padding: 7px 18px; border-radius: 999px; font-weight: 900; font-size: 0.82rem; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.35);">📸 التقاط الصورة الآن</button>',
            '          <button type="button" onclick="window.switchHandwrittenCameraFacingMode()" style="background: rgba(15, 23, 42, 0.75); color: #ffffff; border: 1px solid rgba(255,255,255,0.4); padding: 7px 12px; border-radius: 999px; font-weight: 800; font-size: 0.76rem; cursor: pointer;" title="تبديل الكاميرا الأمامية/الخلفية">🔄 تبديل العدسة</button>',
            '          <button type="button" onclick="window.stopHandwrittenCameraStream()" style="background: rgba(239, 68, 68, 0.85); color: #ffffff; border: none; padding: 7px 12px; border-radius: 999px; font-weight: 800; font-size: 0.76rem; cursor: pointer;">إيقاف</button>',
            '        </div>',
            '      </div>',
            '',
            '      <!-- Captured Image Preview Container -->',
            '      <div id="cameraCapturedPreviewWrapper" style="background: #ffffff; border: 2px dashed #cbd5e1; border-radius: 12px; min-height: 210px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px; position: relative; text-align: center;">',
            '        <img id="cameraCapturedImageEl" alt="معاينة الوثيقة الممسوحة" style="display: none; max-width: 100%; max-height: 260px; border-radius: 8px; object-fit: contain; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">',
            '        <div id="cameraEmptyPlaceholderBox" style="padding: 16px 10px;">',
            '          <div style="font-size: 2.2rem; margin-bottom: 6px;">📸📝</div>',
            '          <div style="font-size: 0.84rem; font-weight: 800; color: #334155; margin-bottom: 4px;">وجه الكاميرا نحو دفتر التحضير أو الملاحظات المكتوبة بخط اليد</div>',
            '          <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 12px;">يدعم قراءة الخط اليدوي بالعربية والفرنسية والرموز الرياضية ($f(x)$, $\\int$, $\\lim$)</div>',
            '          <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">',
            '            <button type="button" onclick="window.startHandwrittenCameraStream()" style="background: #2563eb; color: #ffffff; border: none; padding: 7px 14px; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer;">📷 فتح الكاميرا</button>',
            '            <button type="button" onclick="document.getElementById(\'cameraScannerFileInput\').click()" style="background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; padding: 7px 14px; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer;">📂 اختيار صورة جاهزة</button>',
            '          </div>',
            '        </div>',
            '        <button type="button" id="btnClearCapturedPhoto" onclick="window.clearHandwrittenCapturedPhoto()" style="display: none; position: absolute; top: 8px; left: 8px; background: rgba(239, 68, 68, 0.9); color: #fff; border: none; padding: 4px 10px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; cursor: pointer;">🗑️ مسح الصورة</button>',
            '      </div>',
            '',
            '      <!-- Hidden Canvas for Snapshot Compression -->',
            '      <canvas id="cameraScannerSnapshotCanvas" style="display: none;"></canvas>',
            '',
            '      <!-- Optional Context / Teacher Hint Input -->',
            '      <div>',
            '        <label style="display: block; font-size: 0.76rem; font-weight: 800; color: #334155; margin-bottom: 4px;">توجيه إضافي أو نص مساند للذكاء الاصطناعي (اختياري):</label>',
            '        <textarea id="cameraScannerCustomHintInput" rows="2" placeholder="مثال: هذه جذاذة درس الاشتقاق لقسم أولى باك، أو ملاحظات حول تعثر التلاميذ في البرهان بالترجع..." style="width: 100%; padding: 8px 10px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-size: 0.8rem; font-family: inherit; resize: vertical; background: #ffffff;"></textarea>',
            '      </div>',
            '',
            '      <!-- Analyze with Gemini Button -->',
            '      <button type="button" id="btnAnalyzeHandwrittenWithGemini" onclick="window.analyzeHandwrittenImageWithGemini()" style="width: 100%; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; border: none; padding: 11px 16px; border-radius: 10px; font-size: 0.88rem; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.32);">',
            '        <span>✨ تفريغ وتنظيم المحتوى بواسطة Gemini AI</span>',
            '      </button>',
            '    </div>',
            '',
            '    <!-- Column 2: Gemini AI Transcription & Structured Organization Output -->',
            '    <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 12px; min-height: 360px;">',
            '      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">',
            '        <span style="font-size: 0.84rem; font-weight: 900; color: #1e3a8a;">2️⃣ المخرجات المفرغة والمنظمة بيداغوجياً (قابلة للتعديل والاعتماد)</span>',
            '        <span id="cameraScannerAiSourceBadge" style="display: none; font-size: 0.7rem; font-weight: 800; padding: 2px 8px; border-radius: 999px; background: #ede9fe; color: #6d28d9; border: 1px solid #ddd6fe;">Gemini Vision AI</span>',
            '      </div>',
            '',
            '      <!-- Empty Waiting State -->',
            '      <div id="cameraScannerResultsEmptyState" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 30px 14px; color: #64748b;">',
            '        <div style="font-size: 2rem; margin-bottom: 8px;">🤖📋</div>',
            '        <div style="font-size: 0.85rem; font-weight: 800; color: #334155; margin-bottom: 4px;">في انتظار التقاط صورة أو تشغيل التفريغ الذكي</div>',
            '        <div style="font-size: 0.76rem; color: #64748b; max-width: 340px; line-height: 1.55;">سيقوم Gemini AI بقراءة خط اليد واستخراج النص الكامل، ثم تصنيفه تلقائياً إلى: ملاحظات تربوية مصنفة، جذاذة حصة لدفتر النصوص (مع المحاور والملخص)، وواجب منزلي.</div>',
            '      </div>',
            '',
            '      <!-- Active Results Container -->',
            '      <div id="cameraScannerResultsContainer" style="display: none; flex-direction: column; gap: 12px;">',
            '        <!-- Raw & Cleaned Transcription -->',
            '        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px;">',
            '          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">',
            '            <label style="font-size: 0.78rem; font-weight: 900; color: #0f172a;">📄 النص المفرغ من الصورة (قابل للتعديل المباشر):</label>',
            '            <button type="button" onclick="window.insertTranscribedTextIntoActiveNoteEditor()" style="background: #eff6ff; color: #1d4ed8; border: 1px solid #93c5fd; padding: 3px 10px; border-radius: 6px; font-size: 0.73rem; font-weight: 800; cursor: pointer;">↗ إدراج في حقل الملاحظة الحالية</button>',
            '          </div>',
            '          <textarea id="cameraScannerRawTranscriptionText" rows="3" style="width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.82rem; font-family: inherit; line-height: 1.55; background: #ffffff; resize: vertical;"></textarea>',
            '        </div>',
            '',
            '        <!-- Structured Pedagogical Notes Card -->',
            '        <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 10px; padding: 10px;">',
            '          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">',
            '            <span style="font-size: 0.8rem; font-weight: 900; color: #166534;">📝 الملاحظات التربوية المستخرجة والمصنفة:</span>',
            '            <button type="button" id="btnSaveExtractedNotesBatch" onclick="window.saveAllExtractedNotesFromScanner()" style="background: linear-gradient(135deg, #16a34a, #15803d); color: #ffffff; border: none; padding: 4px 12px; border-radius: 7px; font-size: 0.75rem; font-weight: 800; cursor: pointer; box-shadow: 0 2px 5px rgba(22,163,74,0.25);">💾 حفظ جميع الملاحظات في سجل القسم</button>',
            '          </div>',
            '          <div id="cameraScannerExtractedNotesList" style="display: flex; flex-direction: column; gap: 6px; max-height: 155px; overflow-y: auto;"></div>',
            '        </div>',
            '',
            '        <!-- Structured Lesson Plan / Cahier de Textes Card -->',
            '        <div style="background: #eff6ff; border: 1.5px solid #93c5fd; border-radius: 10px; padding: 10px;">',
            '          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">',
            '            <span style="font-size: 0.8rem; font-weight: 900; color: #1e3a8a;">📘 الجذاذة وخطة الحصة المستخرجة لدفتر النصوص:</span>',
            '            <div style="display: flex; gap: 6px; flex-wrap: wrap;">',
            '              <button type="button" onclick="window.fillLessonLogFormFromScanner()" style="background: #ffffff; color: #1d4ed8; border: 1px solid #60a5fa; padding: 4px 10px; border-radius: 6px; font-size: 0.74rem; font-weight: 800; cursor: pointer;">✍️ تعبئة استمارة دفتر النصوص</button>',
            '              <button type="button" onclick="window.saveExtractedLessonPlanDirectly()" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; border: none; padding: 4px 12px; border-radius: 6px; font-size: 0.74rem; font-weight: 800; cursor: pointer;">💾 حفظ الحصة مباشرة في الدفتر</button>',
            '            </div>',
            '          </div>',
            '          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 6px; margin-bottom: 6px;">',
            '            <input type="text" id="cameraScannerLessonTitleInput" placeholder="عنوان الدرس المستخرج..." style="padding: 6px 9px; border-radius: 6px; border: 1px solid #93c5fd; font-size: 0.8rem; font-weight: 800; background: #ffffff;">',
            '            <select id="cameraScannerSessionTypeSelect" style="padding: 6px 8px; border-radius: 6px; border: 1px solid #93c5fd; font-size: 0.78rem; font-weight: 700; background: #ffffff;">',
            '              <option value="cours">📐 درس وبناء مفاهيم</option>',
            '              <option value="exercices">✏️ تمارين تطبيقية</option>',
            '              <option value="problemes">🎯 مسائل توليفية</option>',
            '              <option value="soutien">💡 دعم واستدراك</option>',
            '              <option value="homework">📝 تصحيح واجب</option>',
            '              <option value="controle">🚨 فرض محروس</option>',
            '              <option value="correction">✅ تصحيح فرض</option>',
            '            </select>',
            '          </div>',
            '          <div id="cameraScannerAxesPreviewBox" style="font-size: 0.76rem; color: #1e40af; margin-bottom: 6px; display: flex; flex-direction: column; gap: 4px;"></div>',
            '          <textarea id="cameraScannerLessonSummaryInput" rows="2" placeholder="ملخص أنشطة ومحتوى الحصة..." style="width: 100%; padding: 6px 9px; border-radius: 6px; border: 1px solid #93c5fd; font-size: 0.78rem; font-family: inherit; background: #ffffff; resize: vertical; margin-bottom: 6px;"></textarea>',
            '          <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">',
            '            <input type="text" id="cameraScannerHomeworkInput" placeholder="الواجب المنزلي / التمارين المطلوبة..." style="flex: 1; min-width: 180px; padding: 5px 9px; border-radius: 6px; border: 1px solid #fde68a; background: #fffbeb; font-size: 0.77rem;">',
            '            <button type="button" onclick="window.saveExtractedHomeworkToAgenda()" style="background: #d97706; color: #ffffff; border: none; padding: 5px 10px; border-radius: 6px; font-size: 0.73rem; font-weight: 800; cursor: pointer;">📌 إضافة لأجندة الواجبات</button>',
            '          </div>',
            '        </div>',
            '      </div>',
            '    </div>',
            '  </div>',
            '',
            '  <!-- Footer -->',
            '  <div style="padding: 10px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 0.76rem; color: #64748b;">',
            '    <span>💡 تلميح: يمكنك تعديل أي نص مفرغ قبل حفظه في سجل الملاحظات أو دفتر النصوص الرقمي.</span>',
            '    <button type="button" onclick="window.closeHandwrittenCameraScannerModal()" style="padding: 6px 18px; background: #e2e8f0; border: none; border-radius: 7px; color: #1e293b; font-weight: 800; cursor: pointer;">إغلاق النافذة</button>',
            '  </div>',
            '</div>'
        ].join('\n');

        document.body.appendChild(modal);
        return modal;
    }

    function populateScannerClassSelect(preferredClass) {
        var select = document.getElementById('cameraScannerClassSelect');
        if (!select) return;
        var classesObj = (window.db && window.db.classes) ? window.db.classes : {};
        var classNames = Object.keys(classesObj);
        select.innerHTML = '';
        if (classNames.length === 0) {
            var opt = document.createElement('option');
            opt.value = preferredClass || 'TCS-1';
            opt.textContent = preferredClass || 'TCS-1';
            select.appendChild(opt);
            return;
        }
        classNames.forEach(function (cls) {
            var opt = document.createElement('option');
            opt.value = cls;
            opt.textContent = cls;
            if (cls === preferredClass) opt.selected = true;
            select.appendChild(opt);
        });
    }

    function setScannerStatus(text, tone) {
        var badge = document.getElementById('cameraScannerStatusBadge');
        if (!badge) return;
        badge.textContent = text;
        if (tone === 'success') {
            badge.style.background = '#dcfce7';
            badge.style.color = '#166534';
        } else if (tone === 'loading') {
            badge.style.background = '#dbeafe';
            badge.style.color = '#1e40af';
        } else if (tone === 'warning') {
            badge.style.background = '#fef3c7';
            badge.style.color = '#92400e';
        } else {
            badge.style.background = '#e2e8f0';
            badge.style.color = '#475569';
        }
    }

    window.openHandwrittenCameraScannerModal = function (targetMode, preferredClass) {
        var modal = ensureCameraScannerModalExists();
        _activeScannerTargetMode = targetMode || 'auto';
        var activeClass = preferredClass || getActiveClassNameForScanner();
        populateScannerClassSelect(activeClass);

        var modeSelect = document.getElementById('cameraScannerTargetModeSelect');
        if (modeSelect) {
            modeSelect.value = ['auto', 'notes', 'lesson_plan', 'homework'].indexOf(_activeScannerTargetMode) !== -1
                ? _activeScannerTargetMode
                : 'auto';
        }

        modal.style.display = 'flex';
    };

    window.closeHandwrittenCameraScannerModal = function () {
        window.stopHandwrittenCameraStream();
        var modal = document.getElementById('handwrittenCameraScannerModal');
        if (modal) {
            modal.style.display = 'none';
        }
    };

    window.startHandwrittenCameraStream = async function () {
        var videoWrapper = document.getElementById('cameraLiveVideoWrapper');
        var videoEl = document.getElementById('cameraScannerVideoEl');
        if (!videoWrapper || !videoEl) return;

        window.stopHandwrittenCameraStream();

        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
            setScannerStatus('الكاميرا المباشرة غير مدعومة، استعمل زر رفع صورة', 'warning');
            if (window.notifySafeToast) {
                window.notifySafeToast('متصفحك لا يدعم البث المباشر للكاميرا هنا، يرجى الضغط على "رفع صورة أو التقاط من الهاتف".');
            }
            var fileInp = document.getElementById('cameraScannerFileInput');
            if (fileInp) fileInp.click();
            return;
        }

        try {
            setScannerStatus('جاري تشغيل الكاميرا...', 'loading');
            var stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: _cameraFacingMode },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });
            _cameraStream = stream;
            videoEl.srcObject = stream;
            videoWrapper.style.display = 'block';
            setScannerStatus('الكاميرا المباشرة مفعلة', 'success');
        } catch (err) {
            setScannerStatus('تعذر فتح الكاميرا المباشرة — اختر صورة', 'warning');
            if (window.notifySafeToast) {
                window.notifySafeToast('تعذر الوصول للكاميرا المباشرة. يمكنك اختيار أو التقاط صورة عبر زر "رفع صورة أو التقاط من الهاتف".');
            }
        }
    };

    window.stopHandwrittenCameraStream = function () {
        if (_cameraStream) {
            try {
                _cameraStream.getTracks().forEach(function (t) { t.stop(); });
            } catch (_e) {}
            _cameraStream = null;
        }
        var videoEl = document.getElementById('cameraScannerVideoEl');
        if (videoEl) {
            videoEl.srcObject = null;
        }
        var videoWrapper = document.getElementById('cameraLiveVideoWrapper');
        if (videoWrapper) {
            videoWrapper.style.display = 'none';
        }
    };

    window.switchHandwrittenCameraFacingMode = function () {
        _cameraFacingMode = _cameraFacingMode === 'environment' ? 'user' : 'environment';
        window.startHandwrittenCameraStream();
    };

    function displayCapturedImageDataUrl(dataUrl, mimeType) {
        _capturedImageBase64 = dataUrl || '';
        _capturedMimeType = mimeType || 'image/jpeg';

        var imgEl = document.getElementById('cameraCapturedImageEl');
        var placeholderEl = document.getElementById('cameraEmptyPlaceholderBox');
        var clearBtn = document.getElementById('btnClearCapturedPhoto');

        if (imgEl && _capturedImageBase64) {
            imgEl.src = _capturedImageBase64;
            imgEl.style.display = 'block';
        }
        if (placeholderEl) {
            placeholderEl.style.display = _capturedImageBase64 ? 'none' : 'block';
        }
        if (clearBtn) {
            clearBtn.style.display = _capturedImageBase64 ? 'inline-block' : 'none';
        }
        if (_capturedImageBase64) {
            setScannerStatus('تم التقاط الصورة وجاهزة للتفريغ الذكي', 'success');
        }
    }

    window.clearHandwrittenCapturedPhoto = function () {
        _capturedImageBase64 = '';
        var imgEl = document.getElementById('cameraCapturedImageEl');
        var placeholderEl = document.getElementById('cameraEmptyPlaceholderBox');
        var clearBtn = document.getElementById('btnClearCapturedPhoto');
        var fileInput = document.getElementById('cameraScannerFileInput');
        if (imgEl) {
            imgEl.src = '';
            imgEl.style.display = 'none';
        }
        if (placeholderEl) placeholderEl.style.display = 'block';
        if (clearBtn) clearBtn.style.display = 'none';
        if (fileInput) fileInput.value = '';
        setScannerStatus('جاهز للالتقاط', 'neutral');
    };

    window.captureSnapshotFromCameraVideo = function () {
        var videoEl = document.getElementById('cameraScannerVideoEl');
        var canvas = document.getElementById('cameraScannerSnapshotCanvas');
        if (!videoEl || !canvas) return;

        var vw = videoEl.videoWidth || 960;
        var vh = videoEl.videoHeight || 720;
        var maxDim = 1280;
        var scale = Math.min(1, maxDim / Math.max(vw, vh));
        canvas.width = Math.round(vw * scale);
        canvas.height = Math.round(vh * scale);

        var ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
            var dataUrl = canvas.toDataURL('image/jpeg', 0.84);
            displayCapturedImageDataUrl(dataUrl, 'image/jpeg');
            window.stopHandwrittenCameraStream();
        }
    };

    window.handleCameraScannerFileUpload = function (event) {
        var file = event && event.target && event.target.files ? event.target.files[0] : null;
        if (!file) return;

        var reader = new FileReader();
        reader.onload = function (e) {
            var rawDataUrl = e && e.target ? String(e.target.result || '') : '';
            if (!rawDataUrl) return;

            // Downscale large photos via Image + Canvas so payload is fast and under limit
            var img = new Image();
            img.onload = function () {
                var canvas = document.getElementById('cameraScannerSnapshotCanvas');
                if (!canvas) {
                    displayCapturedImageDataUrl(rawDataUrl, file.type || 'image/jpeg');
                    return;
                }
                var maxDim = 1350;
                var scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                var ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    var compressedUrl = canvas.toDataURL('image/jpeg', 0.85);
                    displayCapturedImageDataUrl(compressedUrl, 'image/jpeg');
                } else {
                    displayCapturedImageDataUrl(rawDataUrl, file.type || 'image/jpeg');
                }
            };
            img.onerror = function () {
                displayCapturedImageDataUrl(rawDataUrl, file.type || 'image/jpeg');
            };
            img.src = rawDataUrl;
        };
        reader.readAsDataURL(file);
    };

    function renderScannerResultsInModal(data) {
        _lastTranscriptionResult = data || null;
        var emptyState = document.getElementById('cameraScannerResultsEmptyState');
        var container = document.getElementById('cameraScannerResultsContainer');
        var sourceBadge = document.getElementById('cameraScannerAiSourceBadge');

        if (!data) {
            if (emptyState) emptyState.style.display = 'flex';
            if (container) container.style.display = 'none';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        if (container) container.style.display = 'flex';
        if (sourceBadge) {
            sourceBadge.style.display = 'inline-block';
            sourceBadge.textContent = data.source === 'gemini_vision_ai' ? '✨ Gemini Vision AI' : '⚡ تفريغ بيداغوجي ذكي';
        }

        var rawTextEl = document.getElementById('cameraScannerRawTranscriptionText');
        if (rawTextEl) {
            rawTextEl.value = data.rawTranscription || data.organizedSummary || '';
        }

        // Render extracted notes list
        var notesListEl = document.getElementById('cameraScannerExtractedNotesList');
        if (notesListEl) {
            notesListEl.innerHTML = '';
            var notesArr = Array.isArray(data.notes) && data.notes.length > 0
                ? data.notes
                : [{ text: data.organizedSummary || data.rawTranscription || '', category: 'pedagogical', sentiment: 'guidance', studentName: '' }];

            var catLabels = {
                pedagogical: '🎓 بيداغوجية',
                behavioral: '⚖️ سلوكية',
                administrative: '🏛️ إدارية'
            };

            notesArr.forEach(function (noteItem, idx) {
                var row = document.createElement('div');
                row.style.cssText = 'background: #ffffff; border: 1px solid #bbf7d0; border-radius: 8px; padding: 7px 10px; display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;';
                var catBadge = catLabels[noteItem.category] || '🎓 بيداغوجية';
                var studentTag = noteItem.studentName ? ' — 👤 ' + noteItem.studentName : ' — 👥 ملاحظة للقسم';

                var leftDiv = document.createElement('div');
                leftDiv.style.cssText = 'flex: 1; min-width: 180px; font-size: 0.78rem; color: #14532d; font-weight: 700; line-height: 1.45;';
                var metaSpan = document.createElement('div');
                metaSpan.style.cssText = 'font-size: 0.69rem; color: #15803d; font-weight: 800; margin-bottom: 2px;';
                metaSpan.textContent = catBadge + studentTag;
                var textSpan = document.createElement('div');
                textSpan.textContent = noteItem.text || '';
                leftDiv.appendChild(metaSpan);
                leftDiv.appendChild(textSpan);

                var useBtn = document.createElement('button');
                useBtn.type = 'button';
                useBtn.textContent = 'إدراج';
                useBtn.style.cssText = 'background: #dcfce7; color: #166534; border: 1px solid #86efac; padding: 3px 9px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; cursor: pointer; white-space: nowrap;';
                useBtn.onclick = function () {
                    window.applySingleExtractedNoteToEditor(idx);
                };

                row.appendChild(leftDiv);
                row.appendChild(useBtn);
                notesListEl.appendChild(row);
            });
        }

        // Render extracted lesson plan
        var plan = data.lessonPlan || {};
        var titleInput = document.getElementById('cameraScannerLessonTitleInput');
        if (titleInput) titleInput.value = plan.lessonTitle || data.documentTitle || '';

        var typeSelect = document.getElementById('cameraScannerSessionTypeSelect');
        if (typeSelect && plan.sessionType) {
            typeSelect.value = plan.sessionType;
        }

        var axesBox = document.getElementById('cameraScannerAxesPreviewBox');
        if (axesBox) {
            axesBox.innerHTML = '';
            var axesArr = Array.isArray(plan.axes) ? plan.axes : [];
            axesArr.forEach(function (ax, i) {
                var axEl = document.createElement('div');
                axEl.style.cssText = 'background: #ffffff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 4px 8px;';
                axEl.textContent = 'المحور ' + (i + 1) + ': ' + (ax.title || '') + (ax.content ? ' — ' + ax.content : '');
                axesBox.appendChild(axEl);
            });
        }

        var summaryInput = document.getElementById('cameraScannerLessonSummaryInput');
        if (summaryInput) {
            summaryInput.value = plan.summaryContent || data.organizedSummary || data.rawTranscription || '';
        }

        var hwInput = document.getElementById('cameraScannerHomeworkInput');
        if (hwInput) {
            var hwText = plan.homework || (data.homeworkItem && data.homeworkItem.title) || '';
            hwInput.value = hwText;
        }
    }

    window.analyzeHandwrittenImageWithGemini = async function () {
        var hintEl = document.getElementById('cameraScannerCustomHintInput');
        var customHint = hintEl ? String(hintEl.value || '').trim() : '';
        var classSel = document.getElementById('cameraScannerClassSelect');
        var className = (classSel && classSel.value) ? classSel.value : getActiveClassNameForScanner();
        var modeSel = document.getElementById('cameraScannerTargetModeSelect');
        var targetMode = (modeSel && modeSel.value) ? modeSel.value : _activeScannerTargetMode;

        if (!_capturedImageBase64 && !customHint) {
            if (window.notifySafeToast) {
                window.notifySafeToast('يرجى التقاط صورة بالكاميرا أو رفع صورة للملاحظات / الجذاذة أولاً.');
            }
            setScannerStatus('يرجى التقاط أو اختيار صورة أولاً', 'warning');
            return;
        }

        var analyzeBtn = document.getElementById('btnAnalyzeHandwrittenWithGemini');
        var origBtnText = analyzeBtn ? analyzeBtn.innerHTML : '';
        if (analyzeBtn) {
            analyzeBtn.disabled = true;
            analyzeBtn.innerHTML = '<span>⏳ جاري قراءة الخط اليدوي وتنظيمه عبر Gemini AI...</span>';
        }
        setScannerStatus('جاري التحليل البصري عبر Gemini AI...', 'loading');

        try {
            var studentsList = getClassStudentsNamesList(className);
            var response = await fetch('/api/ai/transcribe-handwritten-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageBase64: _capturedImageBase64,
                    mimeType: _capturedMimeType,
                    className: className,
                    targetMode: targetMode,
                    customHint: customHint,
                    studentsList: studentsList
                })
            });

            var result = await response.json();
            if (!response.ok || result.error) {
                throw new Error(result.error || 'تعذر تفريغ الصورة');
            }

            renderScannerResultsInModal(result);
            setScannerStatus('تم التفريغ والتنظيم البيداغوجي بنجاح ✓', 'success');
            if (window.notifySafeToast) {
                window.notifySafeToast('تم تفريغ وتنظيم الملاحظات والجذاذة بنجاح بواسطة Gemini AI!');
            }
        } catch (err) {
            setScannerStatus('تعذر الاتصال، تم تفعيل التفريغ المساند', 'warning');
            if (window.notifySafeToast) {
                window.notifySafeToast(err && err.message ? err.message : 'حدث خطأ أثناء معالجة الصورة.');
            }
        } finally {
            if (analyzeBtn) {
                analyzeBtn.disabled = false;
                analyzeBtn.innerHTML = origBtnText;
            }
        }
    };

    window.insertTranscribedTextIntoActiveNoteEditor = function () {
        var rawTextEl = document.getElementById('cameraScannerRawTranscriptionText');
        var text = rawTextEl ? String(rawTextEl.value || '').trim() : '';
        if (!text && _lastTranscriptionResult) {
            text = _lastTranscriptionResult.rawTranscription || _lastTranscriptionResult.organizedSummary || '';
        }
        if (!text) return;

        var noteTextarea = document.getElementById('newNoteText');
        if (noteTextarea) {
            noteTextarea.value = text;
            if (typeof window.onNewNoteCategoryOrTextChange === 'function') {
                window.onNewNoteCategoryOrTextChange();
            }
        }
        window.closeHandwrittenCameraScannerModal();
        if (typeof window.switchTab === 'function') {
            var notesView = document.getElementById('notesView');
            if (notesView && notesView.style.display === 'none') {
                window.switchTab('notes');
            }
        }
        if (window.notifySafeToast) {
            window.notifySafeToast('تم إدراج النص المفرغ في حقل الملاحظة التربوية.');
        }
    };

    window.applySingleExtractedNoteToEditor = function (noteIndex) {
        if (!_lastTranscriptionResult) return;
        var notesArr = Array.isArray(_lastTranscriptionResult.notes) ? _lastTranscriptionResult.notes : [];
        var item = notesArr[noteIndex];
        if (!item || !item.text) return;

        var noteTextarea = document.getElementById('newNoteText');
        if (noteTextarea) noteTextarea.value = item.text;

        var catSel = document.getElementById('newNoteCategorySelect');
        if (catSel && item.category) catSel.value = item.category;

        var sentSel = document.getElementById('newNoteSentimentSelect');
        if (sentSel && item.sentiment) sentSel.value = item.sentiment;

        if (typeof window.onNewNoteCategoryOrTextChange === 'function') {
            window.onNewNoteCategoryOrTextChange();
        }
        window.closeHandwrittenCameraScannerModal();
        if (window.notifySafeToast) {
            window.notifySafeToast('تم إدراج الملاحظة المصنفة في محرر الملاحظات.');
        }
    };

    window.saveAllExtractedNotesFromScanner = function () {
        var classSel = document.getElementById('cameraScannerClassSelect');
        var className = (classSel && classSel.value) ? classSel.value : getActiveClassNameForScanner();
        if (!className) {
            if (window.notifySafeToast) window.notifySafeToast('يرجى اختيار القسم أولاً.');
            return 0;
        }

        var rawTextEl = document.getElementById('cameraScannerRawTranscriptionText');
        var rawText = rawTextEl ? String(rawTextEl.value || '').trim() : '';

        var notesToSave = [];
        if (_lastTranscriptionResult && Array.isArray(_lastTranscriptionResult.notes) && _lastTranscriptionResult.notes.length > 0) {
            notesToSave = _lastTranscriptionResult.notes.filter(function (n) { return n && n.text && String(n.text).trim(); });
        } else if (rawText) {
            notesToSave = [{ text: rawText, category: 'pedagogical', sentiment: 'guidance', studentName: '' }];
        }

        if (notesToSave.length === 0) {
            if (window.notifySafeToast) window.notifySafeToast('لا توجد ملاحظات مستخرجة للحفظ.');
            return 0;
        }

        if (!window.db) window.db = { classes: {}, notes: {}, lessonLogs: {}, homeworkAgenda: {} };
        if (!window.db.notes) window.db.notes = {};
        if (!Array.isArray(window.db.notes[className])) window.db.notes[className] = [];

        var students = (window.db.classes && window.db.classes[className])
            ? extractStudentsArrayFromClass(window.db.classes[className])
            : [];
        var nowDate = new Date().toLocaleDateString('ar-MA');
        var baseId = Date.now();

        notesToSave.forEach(function (n, idx) {
            var matchedStudentId = 'all';
            if (n.studentName) {
                var targetName = String(n.studentName).trim();
                var found = students.find(function (s) {
                    return s && s.name && (s.name.indexOf(targetName) !== -1 || targetName.indexOf(s.name) !== -1);
                });
                if (found && found.id !== undefined) {
                    matchedStudentId = String(found.id);
                }
            }
            window.db.notes[className].push({
                id: baseId + idx,
                date: nowDate,
                text: String(n.text).trim(),
                studentId: matchedStudentId,
                category: n.category || 'pedagogical',
                sentiment: n.sentiment || 'guidance',
                followUpStatus: 'done',
                source: 'camera_gemini_ai'
            });
        });

        if (typeof window.saveDB === 'function') window.saveDB();
        var notesClassSel = document.getElementById('notesClassSelect');
        if (notesClassSel && notesClassSel.value !== className) {
            notesClassSel.value = className;
        }
        if (typeof window.renderNotes === 'function') window.renderNotes();

        if (window.notifySafeToast) {
            window.notifySafeToast('تم حفظ ' + notesToSave.length + ' ملاحظة تربوية مفرغة في سجل القسم (' + className + ') بنجاح!');
        }
        return notesToSave.length;
    };

    window.fillLessonLogFormFromScanner = function () {
        var classSel = document.getElementById('cameraScannerClassSelect');
        var className = (classSel && classSel.value) ? classSel.value : getActiveClassNameForScanner();

        var lessonTitle = document.getElementById('cameraScannerLessonTitleInput')?.value?.trim() || '';
        var sessionType = document.getElementById('cameraScannerSessionTypeSelect')?.value || 'cours';
        var summaryContent = document.getElementById('cameraScannerLessonSummaryInput')?.value?.trim() || '';
        var homeworkText = document.getElementById('cameraScannerHomeworkInput')?.value?.trim() || '';

        var llClassSelect = document.getElementById('lessonLogClassSelect');
        if (llClassSelect && className) {
            llClassSelect.value = className;
            if (typeof window.onLessonLogClassSelectChanged === 'function') {
                window.onLessonLogClassSelectChanged(className);
            }
        }

        var llDate = document.getElementById('lessonLogDate');
        if (llDate && !llDate.value) {
            llDate.value = new Date().toISOString().split('T')[0];
        }

        var llNumber = document.getElementById('lessonLogNumber');
        if (llNumber && lessonTitle) {
            llNumber.value = lessonTitle;
            if (typeof window.onLessonLogNumberChanged === 'function') {
                window.onLessonLogNumberChanged(lessonTitle);
            }
        }

        var llType = document.getElementById('lessonLogSessionType');
        if (llType && sessionType) {
            llType.value = sessionType;
            if (typeof window.onLessonLogSessionTypeChanged === 'function') {
                window.onLessonLogSessionTypeChanged(sessionType);
            }
        }

        var planAxes = (_lastTranscriptionResult && _lastTranscriptionResult.lessonPlan && Array.isArray(_lastTranscriptionResult.lessonPlan.axes))
            ? _lastTranscriptionResult.lessonPlan.axes
            : [];

        if (planAxes.length > 0 && typeof window.setLessonLogAxesFields === 'function') {
            var formattedAxes = planAxes.map(function (ax) {
                return {
                    title: ax.title || 'محور الحصة',
                    paragraphs: [
                        {
                            title: ax.title || 'فقرة الدرس',
                            type: 'construct',
                            content: ax.content || ''
                        }
                    ]
                };
            });
            window.setLessonLogAxesFields(formattedAxes);
        }

        var llSummary = document.getElementById('lessonLogSummary');
        if (llSummary && summaryContent) {
            llSummary.value = summaryContent;
        }

        var llHomework = document.getElementById('lessonLogHomework');
        if (llHomework && homeworkText) {
            llHomework.value = homeworkText;
        }

        window.closeHandwrittenCameraScannerModal();
        if (typeof window.switchTab === 'function') {
            var llView = document.getElementById('lessonLogView');
            if (llView && llView.style.display === 'none') {
                window.switchTab('lessonLog');
            }
        }
        if (window.notifySafeToast) {
            window.notifySafeToast('تم تعبئة جذاذة الحصة في استمارة دفتر النصوص بنجاح!');
        }
    };

    window.saveExtractedLessonPlanDirectly = function () {
        var classSel = document.getElementById('cameraScannerClassSelect');
        var className = (classSel && classSel.value) ? classSel.value : getActiveClassNameForScanner();
        if (!className) {
            if (window.notifySafeToast) window.notifySafeToast('يرجى اختيار القسم أولاً.');
            return null;
        }

        var lessonTitle = document.getElementById('cameraScannerLessonTitleInput')?.value?.trim() ||
            (_lastTranscriptionResult && _lastTranscriptionResult.lessonPlan && _lastTranscriptionResult.lessonPlan.lessonTitle) ||
            'درس مفرغ بالذكاء الاصطناعي';
        var sessionType = document.getElementById('cameraScannerSessionTypeSelect')?.value || 'cours';
        var summaryContent = document.getElementById('cameraScannerLessonSummaryInput')?.value?.trim() ||
            (_lastTranscriptionResult && (_lastTranscriptionResult.rawTranscription || _lastTranscriptionResult.organizedSummary)) ||
            lessonTitle;
        var homeworkText = document.getElementById('cameraScannerHomeworkInput')?.value?.trim() || '';

        if (!window.db) window.db = { classes: {}, notes: {}, lessonLogs: {}, homeworkAgenda: {} };
        if (!window.db.lessonLogs) window.db.lessonLogs = {};
        if (!Array.isArray(window.db.lessonLogs[className])) window.db.lessonLogs[className] = [];

        var planAxes = (_lastTranscriptionResult && _lastTranscriptionResult.lessonPlan && Array.isArray(_lastTranscriptionResult.lessonPlan.axes))
            ? _lastTranscriptionResult.lessonPlan.axes
            : [];

        var axesTitles = planAxes.map(function (a) { return a && a.title ? a.title : ''; }).filter(Boolean);
        var todayIso = new Date().toISOString().split('T')[0];

        var newSessionRecord = {
            id: Date.now(),
            date: todayIso,
            sessionNum: String(window.db.lessonLogs[className].length + 1),
            timeSlot: '08:00 - 10:00',
            duration: (_lastTranscriptionResult && _lastTranscriptionResult.lessonPlan && _lastTranscriptionResult.lessonPlan.duration) || '2',
            sessionType: sessionType,
            number: lessonTitle,
            title: axesTitles.join(' | ') || lessonTitle,
            axes: planAxes.length > 0 ? planAxes.map(function (ax) {
                return {
                    title: ax.title || 'محور الحصة',
                    paragraphs: [{ title: ax.title || '', type: 'construct', content: ax.content || '' }]
                };
            }) : [],
            summary: summaryContent,
            homework: homeworkText,
            homeworkDueDate: '',
            homeworkCompleted: false,
            notes: 'تم مسح وتفريغ الجذاذة عبر الكاميرا و Gemini Vision AI',
            source: 'camera_gemini_ai'
        };

        window.db.lessonLogs[className].push(newSessionRecord);
        if (typeof window.saveDB === 'function') window.saveDB();
        if (typeof window.renderLessonLogs === 'function') window.renderLessonLogs();

        if (window.notifySafeToast) {
            window.notifySafeToast('تم حفظ الجذاذة والحصة مباشرة في دفتر النصوص للقسم (' + className + ')!');
        }
        return newSessionRecord;
    };

    window.saveExtractedHomeworkToAgenda = function () {
        var classSel = document.getElementById('cameraScannerClassSelect');
        var className = (classSel && classSel.value) ? classSel.value : getActiveClassNameForScanner();
        if (!className) return null;

        var hwText = document.getElementById('cameraScannerHomeworkInput')?.value?.trim() ||
            (_lastTranscriptionResult && _lastTranscriptionResult.homeworkItem && _lastTranscriptionResult.homeworkItem.title) || '';
        if (!hwText) {
            if (window.notifySafeToast) window.notifySafeToast('يرجى إدخال نص الواجب المنزلي أولاً.');
            return null;
        }

        if (!window.db) window.db = { classes: {}, notes: {}, lessonLogs: {}, homeworkAgenda: {} };
        if (!window.db.homeworkAgenda) window.db.homeworkAgenda = {};
        if (!Array.isArray(window.db.homeworkAgenda[className])) window.db.homeworkAgenda[className] = [];

        var lessonTitle = document.getElementById('cameraScannerLessonTitleInput')?.value?.trim() || '';
        var hwItem = {
            id: 'hw_cam_' + Date.now(),
            title: hwText,
            type: (_lastTranscriptionResult && _lastTranscriptionResult.homeworkItem && _lastTranscriptionResult.homeworkItem.type) || 'homework',
            dueDate: (_lastTranscriptionResult && _lastTranscriptionResult.homeworkItem && _lastTranscriptionResult.homeworkItem.dueDate) || new Date().toISOString().split('T')[0],
            topic: lessonTitle,
            createdAt: new Date().toISOString(),
            studentChecks: {}
        };

        window.db.homeworkAgenda[className].unshift(hwItem);
        if (typeof window.saveDB === 'function') window.saveDB();
        if (typeof window.renderHomeworkAgenda === 'function') window.renderHomeworkAgenda();

        if (window.notifySafeToast) {
            window.notifySafeToast('تمت إضافة الواجب المنزلي المستخرج إلى أجندة القسم (' + className + ') بنجاح!');
        }
        return hwItem;
    };
})();
