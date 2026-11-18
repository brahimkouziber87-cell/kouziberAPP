/**
 * ============================================================================
 * جسور التكامل البيداغوجي للسبورة التفاعلية + درج مصغرات الصفحات الحرة
 * Whiteboard Bridges: Digital Library (IndexedDB), Private Tutoring & Freehand Pages
 * ============================================================================
 */
(function (window) {
    'use strict';

    const esc = (s) => (window.WbSecurityMath ? window.WbSecurityMath.escapeHtml(s) : String(s || ''));

    // ------------------------------------------------------------------------
    // 1. استيراد PDF من المكتبة الرقمية الحقيقية (ResourceDB + URL + بحث)
    // ------------------------------------------------------------------------
    function isLibraryItemPdf(r) {
        if (!r) return false;
        const ft = String(r.fileType || r.type || '').toLowerCase();
        const fn = String(r.fileName || r.name || r.title || '').toLowerCase();
        const url = String(r.url || '').toLowerCase();
        return ft.includes('pdf') || fn.endsWith('.pdf') || url.includes('.pdf');
    }

    async function loadLibraryResourceIntoWhiteboard(item, onBufferReady, onFallbackImport) {
        if (!item) return;
        try {
            if (item.isLocalFile && window.ResourceDB && typeof window.ResourceDB.getFile === 'function') {
                const record = await window.ResourceDB.getFile(String(item.id));
                const blobOrFile = record && (record.data || record.file || record);
                if (blobOrFile && typeof blobOrFile.arrayBuffer === 'function') {
                    const buf = await blobOrFile.arrayBuffer();
                    await onBufferReady(buf, item.fileName || item.title || 'مورد_المكتبة.pdf');
                    return;
                }
            }
            if (item.dataUrl && item.dataUrl.startsWith('data:')) {
                const res = await fetch(item.dataUrl);
                const buf = await res.arrayBuffer();
                await onBufferReady(buf, item.title || item.name || 'مورد_المكتبة.pdf');
                return;
            }
            if (item.url) {
                const res = await fetch(item.url);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const buf = await res.arrayBuffer();
                await onBufferReady(buf, item.title || 'ملف_المكتبة.pdf');
                return;
            }
            throw new Error('لا يتضمن هذا المورد ملف PDF قابلاً للقراءة المباشرة.');
        } catch (err) {
            if (typeof window.showNotification === 'function') {
                window.showNotification('⚠️ تعذر فتح ملف PDF مباشرة من الرابط (' + (err.message || '') + ')؛ يمكنك اختيار الملف من جهازك.', 'warning');
            }
            if (typeof onFallbackImport === 'function') onFallbackImport();
        }
    }

    function openLibraryPdfPickerModal(onBufferReady, onFallbackImport) {
        const db = window.db || {};
        const libItems = Array.isArray(db.library) ? db.library : (Array.isArray(db.resources) ? db.resources : []);
        const pdfItems = libItems.filter(isLibraryItemPdf);

        let modal = document.getElementById('wbLibraryPdfPickerModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'wbLibraryPdfPickerModal';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.72);backdrop-filter:blur(5px);z-index:10080;display:flex;align-items:center;justify-content:center;padding:14px;direction:rtl;font-family:"Cairo",sans-serif;';
            document.body.appendChild(modal);
        }

        let query = '';
        let levelFilter = 'all';

        const render = () => {
            const levels = Array.from(new Set(pdfItems.map(r => r.level).filter(Boolean)));
            const filtered = pdfItems.filter(r => {
                const matchLevel = levelFilter === 'all' || r.level === levelFilter;
                const q = query.trim().toLowerCase();
                const matchQ = !q || [r.title, r.topic, r.level, r.category, r.fileName].some(v => String(v || '').toLowerCase().includes(q));
                return matchLevel && matchQ;
            });

            modal.innerHTML = `
                <div style="background:#fff;border-radius:16px;max-width:640px;width:100%;max-height:86vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 25px 55px rgba(0,0,0,0.35);border:1.5px solid #cbd5e1;">
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;background:linear-gradient(135deg,#6d28d9,#4f46e5);color:#fff;">
                        <div style="font-weight:800;font-size:0.96rem;">📚 استيراد مستند PDF من المكتبة الرقمية (${pdfItems.length})</div>
                        <button type="button" id="wbLibPickCloseX" style="background:rgba(255,255,255,0.2);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;">✕</button>
                    </div>
                    <div style="padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                        <input type="text" id="wbLibPickSearch" value="${esc(query)}" placeholder="🔍 ابحث بعنوان الدرس أو الفرض أو المستوى..." style="flex:1;min-width:200px;padding:7px 11px;border:1.5px solid #cbd5e1;border-radius:8px;font-family:inherit;font-size:0.82rem;font-weight:700;">
                        <select id="wbLibPickLevel" style="padding:7px 10px;border:1.5px solid #cbd5e1;border-radius:8px;font-family:inherit;font-size:0.8rem;font-weight:700;background:#fff;">
                            <option value="all">كل المستويات</option>
                            ${levels.map(l => `<option value="${esc(l)}" ${l === levelFilter ? 'selected' : ''}>${esc(l)}</option>`).join('')}
                        </select>
                        <button type="button" id="wbLibPickFromDeviceBtn" style="background:#0284c7;color:#fff;border:none;border-radius:8px;padding:7px 12px;font-size:0.78rem;font-weight:800;cursor:pointer;">📂 من الحاسوب</button>
                    </div>
                    <div style="padding:12px 16px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:8px;">
                        ${filtered.length === 0 ? `
                            <div style="text-align:center;padding:32px 16px;color:#64748b;font-size:0.86rem;font-weight:700;">
                                لا توجد ملفات PDF مطابقة في المكتبة الرقمية حالياً.<br>
                                <span style="font-size:0.76rem;color:#94a3b8;">يمكنك حفظ أي سبورة أو فرض مصحح إلى المكتبة، أو استيراد ملف PDF مباشرة من جهازك.</span>
                            </div>
                        ` : filtered.map((item, idx) => `
                            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;">
                                <div style="flex:1;min-width:0;">
                                    <div style="font-weight:800;font-size:0.85rem;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">📄 ${esc(item.title || item.fileName || 'مستند PDF')}</div>
                                    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;font-size:0.72rem;color:#64748b;font-weight:700;">
                                        ${item.level ? `<span style="background:#eff6ff;color:#1d4ed8;padding:1px 7px;border-radius:5px;">${esc(item.level)}</span>` : ''}
                                        ${item.category ? `<span style="background:#faf5ff;color:#6d28d9;padding:1px 7px;border-radius:5px;">${esc(item.category)}</span>` : ''}
                                        ${item.topic ? `<span>📘 ${esc(item.topic)}</span>` : ''}
                                        <span>${item.isLocalFile ? '💾 محفوظ محلياً' : '🔗 رابط خارجي'}</span>
                                        ${item.fileSize ? `<span>(${esc(item.fileSize)})</span>` : ''}
                                    </div>
                                </div>
                                <button type="button" class="wb-lib-pick-open-btn" data-id="${esc(item.id)}" data-idx="${idx}" style="background:linear-gradient(135deg,#059669,#047857);color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:0.78rem;font-weight:800;cursor:pointer;white-space:nowrap;">فتح على السبورة</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;

            document.getElementById('wbLibPickCloseX').onclick = () => { modal.style.display = 'none'; };
            const searchEl = document.getElementById('wbLibPickSearch');
            if (searchEl) {
                searchEl.oninput = () => { query = searchEl.value; render(); };
            }
            const levelEl = document.getElementById('wbLibPickLevel');
            if (levelEl) {
                levelEl.onchange = () => { levelFilter = levelEl.value; render(); };
            }
            const devBtn = document.getElementById('wbLibPickFromDeviceBtn');
            if (devBtn) {
                devBtn.onclick = () => {
                    modal.style.display = 'none';
                    if (typeof onFallbackImport === 'function') onFallbackImport();
                };
            }
            modal.querySelectorAll('.wb-lib-pick-open-btn').forEach(btn => {
                btn.onclick = async () => {
                    const targetId = btn.getAttribute('data-id');
                    const chosen = filtered.find(it => String(it.id) === String(targetId));
                    modal.style.display = 'none';
                    await loadLibraryResourceIntoWhiteboard(chosen, onBufferReady, onFallbackImport);
                };
            });
        };

        modal.style.display = 'flex';
        render();
    }

    // ------------------------------------------------------------------------
    // 2. حفظ لقطة السبورة / الفرض المصحح مباشرة في المكتبة الرقمية (ResourceDB + db.library)
    // ------------------------------------------------------------------------
    function openSaveBoardToLibraryModal(getCompositedBlobAndMeta) {
        if (typeof getCompositedBlobAndMeta !== 'function') return;
        const meta = getCompositedBlobAndMeta();
        if (!meta) return;

        let modal = document.getElementById('wbSaveToLibraryModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'wbSaveToLibraryModal';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.72);backdrop-filter:blur(5px);z-index:10085;display:flex;align-items:center;justify-content:center;padding:14px;direction:rtl;font-family:"Cairo",sans-serif;';
            document.body.appendChild(modal);
        }

        const today = (typeof window.formatLocalDate === 'function') ? window.formatLocalDate() : new Date().toISOString().slice(0, 10);
        const defaultTitle = meta.defaultTitle || `ملخص_السبورة_${today}`;

        modal.style.display = 'flex';
        modal.innerHTML = `
            <div style="background:#fff;border-radius:16px;max-width:500px;width:100%;overflow:hidden;box-shadow:0 25px 55px rgba(0,0,0,0.35);border:1.5px solid #cbd5e1;">
                <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;background:linear-gradient(135deg,#059669,#047857);color:#fff;">
                    <div style="font-weight:800;font-size:0.95rem;">📚 حفظ السبورة والحلول في المكتبة الرقمية</div>
                    <button type="button" id="wbSaveLibCloseX" style="background:rgba(255,255,255,0.2);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;">✕</button>
                </div>
                <div style="padding:16px 18px;display:flex;flex-direction:column;gap:12px;">
                    <div style="text-align:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px;">
                        <img src="${meta.previewUrl}" alt="معاينة السبورة" style="max-height:135px;width:auto;border-radius:6px;border:1px solid #cbd5e1;">
                    </div>
                    <div>
                        <label style="display:block;font-size:0.78rem;font-weight:800;color:#1e293b;margin-bottom:4px;">عنوان المورد في المكتبة:</label>
                        <input type="text" id="wbSaveLibTitleInput" value="${esc(defaultTitle)}" style="width:100%;padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:8px;font-family:inherit;font-size:0.84rem;font-weight:700;box-sizing:border-box;">
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                        <div>
                            <label style="display:block;font-size:0.76rem;font-weight:800;color:#1e293b;margin-bottom:4px;">المستوى الدراسي:</label>
                            <select id="wbSaveLibLevelInput" style="width:100%;padding:7px 8px;border:1.5px solid #cbd5e1;border-radius:8px;font-family:inherit;font-size:0.8rem;font-weight:700;background:#fff;">
                                <option value="جذع مشترك">جذع مشترك</option>
                                <option value="1 باك">1 باك</option>
                                <option value="2 باك" selected>2 باك</option>
                                <option value="عام">عام</option>
                            </select>
                        </div>
                        <div>
                            <label style="display:block;font-size:0.76rem;font-weight:800;color:#1e293b;margin-bottom:4px;">التصنيف الديداكتيكي:</label>
                            <select id="wbSaveLibCatInput" style="width:100%;padding:7px 8px;border:1.5px solid #cbd5e1;border-radius:8px;font-family:inherit;font-size:0.8rem;font-weight:700;background:#fff;">
                                <option value="درس">درس وشروحات</option>
                                <option value="تمارين">تمارين وحلول</option>
                                <option value="فروض مصححة">فروض مصححة</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label style="display:block;font-size:0.76rem;font-weight:800;color:#1e293b;margin-bottom:4px;">المحور أو الدرس المرتبط:</label>
                        <input type="text" id="wbSaveLibTopicInput" value="${esc(meta.topic || '')}" placeholder="مثال: دراسة الدوال العددية" style="width:100%;padding:7px 10px;border:1.5px solid #cbd5e1;border-radius:8px;font-family:inherit;font-size:0.82rem;font-weight:700;box-sizing:border-box;">
                    </div>
                    <div style="display:flex;justify-content:flex-end;gap:8px;border-top:1px solid #e2e8f0;padding-top:10px;">
                        <button type="button" id="wbSaveLibCancelBtn" style="background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;border-radius:8px;padding:7px 14px;font-weight:700;font-size:0.8rem;cursor:pointer;">إلغاء</button>
                        <button type="button" id="wbSaveLibConfirmBtn" style="background:linear-gradient(135deg,#059669,#047857);color:#fff;border:none;border-radius:8px;padding:7px 18px;font-weight:800;font-size:0.82rem;cursor:pointer;">💾 حفظ في المكتبة الرقمية</button>
                    </div>
                </div>
            </div>
        `;

        const close = () => { modal.style.display = 'none'; };
        document.getElementById('wbSaveLibCloseX').onclick = close;
        document.getElementById('wbSaveLibCancelBtn').onclick = close;
        document.getElementById('wbSaveLibConfirmBtn').onclick = async () => {
            const title = (document.getElementById('wbSaveLibTitleInput').value || '').trim() || defaultTitle;
            const level = document.getElementById('wbSaveLibLevelInput').value || 'عام';
            const category = document.getElementById('wbSaveLibCatInput').value || 'درس';
            const topic = (document.getElementById('wbSaveLibTopicInput').value || '').trim();
            close();

            try {
                const blob = await meta.toBlob();
                const fileName = `${title.replace(/[^\u0600-\u06FFa-zA-Z0-9_-]+/g, '_')}.png`;
                const fileObj = (typeof File === 'function')
                    ? new File([blob], fileName, { type: 'image/png' })
                    : blob;
                const resourceId = 'wb_' + Date.now();
                if (window.ResourceDB && typeof window.ResourceDB.saveFile === 'function') {
                    await window.ResourceDB.saveFile(resourceId, fileObj);
                }
                if (!window.db) window.db = {};
                if (!Array.isArray(window.db.library)) window.db.library = [];
                window.db.library.unshift({
                    id: resourceId,
                    title,
                    isLocalFile: true,
                    category,
                    fileName,
                    fileSize: Math.max(1, Math.round((blob.size || 20480) / 1024)) + ' KB',
                    fileType: 'image/png',
                    type: 'image',
                    topic: topic || title,
                    level,
                    source: 'whiteboard',
                    dateAdded: today
                });
                if (typeof window.saveDB === 'function') window.saveDB();
                if (typeof window.renderLibrary === 'function') window.renderLibrary();
                if (typeof window.showNotification === 'function') {
                    window.showNotification(`📚 تم حفظ "${title}" في المكتبة الرقمية بنجاح!`, 'success');
                }
            } catch (err) {
                if (typeof window.showNotification === 'function') {
                    window.showNotification('تعذر الحفظ في المكتبة الرقمية: ' + (err.message || ''), 'error');
                }
            }
        };
    }

    // ------------------------------------------------------------------------
    // 3. إرفاق لقطة السبورة بسجل الدعم الخصوصي (db.tutoring)
    // ------------------------------------------------------------------------
    function openAttachBoardToTutoringModal(getSnapshotData) {
        if (typeof getSnapshotData !== 'function') return;
        const snap = getSnapshotData();
        if (!snap) return;

        const db = window.db || {};
        const tutoring = db.tutoring || {};
        const students = Array.isArray(tutoring.students) ? tutoring.students : [];
        const groups = Array.isArray(tutoring.groups) ? tutoring.groups : [];

        let modal = document.getElementById('wbAttachTutoringModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'wbAttachTutoringModal';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.72);backdrop-filter:blur(5px);z-index:10085;display:flex;align-items:center;justify-content:center;padding:14px;direction:rtl;font-family:"Cairo",sans-serif;';
            document.body.appendChild(modal);
        }

        const today = (typeof window.formatLocalDate === 'function') ? window.formatLocalDate() : new Date().toISOString().slice(0, 10);

        modal.style.display = 'flex';
        modal.innerHTML = `
            <div style="background:#fff;border-radius:16px;max-width:520px;width:100%;overflow:hidden;box-shadow:0 25px 55px rgba(0,0,0,0.35);border:1.5px solid #cbd5e1;">
                <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;background:linear-gradient(135deg,#0f766e,#0d9488);color:#fff;">
                    <div style="font-weight:800;font-size:0.95rem;">🎓 إرفاق السبورة التفاعلية بسجل الدعم الخصوصي</div>
                    <button type="button" id="wbTutCloseX" style="background:rgba(255,255,255,0.2);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;">✕</button>
                </div>
                <div style="padding:16px 18px;display:flex;flex-direction:column;gap:12px;">
                    <div style="text-align:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px;">
                        <img src="${snap.previewUrl}" alt="معاينة السبورة" style="max-height:130px;width:auto;border-radius:6px;border:1px solid #cbd5e1;">
                    </div>
                    <div>
                        <label style="display:block;font-size:0.78rem;font-weight:800;color:#1e293b;margin-bottom:4px;">اختر التلميذ أو فوج الدعم الخصوصي المستهدف:</label>
                        <select id="wbTutTargetSelect" style="width:100%;padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:8px;font-family:inherit;font-size:0.82rem;font-weight:700;background:#fff;">
                            ${students.length === 0 && groups.length === 0 ? `<option value="">-- لا يوجد تلاميذ أو أفواج دعم مسجلة بعد --</option>` : ''}
                            ${groups.map(g => `<option value="group:${esc(g.name)}">👥 فوج: ${esc(g.name)} ${g.level ? '(' + esc(g.level) + ')' : ''}</option>`).join('')}
                            ${students.map(s => `<option value="student:${esc(s.id)}">🧑‍🎓 تلميذ(ة): ${esc(s.name)} ${s.group ? '— ' + esc(s.group) : ''}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label style="display:block;font-size:0.78rem;font-weight:800;color:#1e293b;margin-bottom:4px;">عنوان اللوحة أو التمرين المرفق:</label>
                        <input type="text" id="wbTutAttachmentTitle" value="${esc(snap.defaultTitle || 'تصحيح وشرح من السبورة التفاعلية')}" style="width:100%;padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:8px;font-family:inherit;font-size:0.82rem;font-weight:700;box-sizing:border-box;">
                    </div>
                    <div style="display:flex;justify-content:flex-end;gap:8px;border-top:1px solid #e2e8f0;padding-top:10px;">
                        <button type="button" id="wbTutCancelBtn" style="background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;border-radius:8px;padding:7px 14px;font-weight:700;font-size:0.8rem;cursor:pointer;">إلغاء</button>
                        <button type="button" id="wbTutConfirmBtn" ${students.length === 0 && groups.length === 0 ? 'disabled' : ''} style="background:linear-gradient(135deg,#0f766e,#0d9488);color:#fff;border:none;border-radius:8px;padding:7px 18px;font-weight:800;font-size:0.82rem;cursor:pointer;opacity:${students.length === 0 && groups.length === 0 ? '0.5' : '1'};">📎 إرفاق بسجل الدعم</button>
                    </div>
                </div>
            </div>
        `;

        const close = () => { modal.style.display = 'none'; };
        document.getElementById('wbTutCloseX').onclick = close;
        document.getElementById('wbTutCancelBtn').onclick = close;
        document.getElementById('wbTutConfirmBtn').onclick = async () => {
            const targetVal = document.getElementById('wbTutTargetSelect').value;
            const title = (document.getElementById('wbTutAttachmentTitle').value || '').trim() || 'ملخص السبورة التفاعلية';
            if (!targetVal) return;
            close();

            let shareUrl = '';
            try {
                const tp = (window.WbSecurityMath && window.WbSecurityMath.getTeacherProfile()) || {};
                const resp = await fetch('/api/share/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'whiteboard',
                        title,
                        subtitle: `مرفق حصة الدعم الخصوصي (${today})`,
                        data: {
                            kind: 'whiteboard_snapshot',
                            imageDataUrl: snap.shareDataUrl,
                            pageTitle: title,
                            createdAt: today
                        },
                        expiryDays: 60,
                        teacherName: tp.name || '',
                        schoolName: tp.school || ''
                    })
                });
                if (resp.ok) {
                    const data = await resp.json();
                    if (data && data.shareUrl) shareUrl = data.shareUrl;
                }
            } catch (e) {}

            const attachmentObj = {
                id: 'wb_tut_' + Date.now(),
                title: `📐 ${title}`,
                url: shareUrl || snap.shareDataUrl,
                date: today,
                isWhiteboardSnapshot: true
            };

            const [kind, idVal] = targetVal.split(':');
            const matchedStudents = kind === 'group'
                ? students.filter(s => s.group === idVal)
                : students.filter(s => String(s.id) === String(idVal));

            if (kind === 'group') {
                const grp = groups.find(g => g.name === idVal);
                if (grp) {
                    if (!Array.isArray(grp.attachedResources)) grp.attachedResources = [];
                    grp.attachedResources.push(attachmentObj);
                }
            }

            matchedStudents.forEach(std => {
                if (!Array.isArray(std.sessions)) std.sessions = [];
                if (std.sessions.length > 0) {
                    const lastSess = std.sessions[std.sessions.length - 1];
                    if (!Array.isArray(lastSess.attachedResources)) lastSess.attachedResources = [];
                    lastSess.attachedResources.push(attachmentObj);
                } else {
                    std.sessions.push({
                        id: 'sess_wb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
                        date: today,
                        time: new Date().toTimeString().slice(0, 5),
                        hours: 1,
                        topic: title,
                        attendance: 'present',
                        attachedResources: [attachmentObj]
                    });
                }
            });

            if (typeof window.saveDB === 'function') window.saveDB();
            if (typeof window.renderTutoring === 'function') {
                try { window.renderTutoring(); } catch (e) {}
            }
            if (typeof window.showNotification === 'function') {
                window.showNotification(`🎓 تم إرفاق السبورة التفاعلية بسجل ${kind === 'group' ? 'الفوج ' + idVal : 'التلميذ(ة)'} بنجاح!`, 'success');
            }
        };
    }

    // ------------------------------------------------------------------------
    // 4. درج مصغرات الصفحات الحرة (Freehand Pages Thumbnails Drawer)
    // ------------------------------------------------------------------------
    function renderFreehandPagesDrawer(state, handlers) {
        const listEl = document.getElementById('whiteboardFreehandPagesList');
        if (!listEl) return;
        const pageDataUrls = Array.isArray(state.pageDataUrls) ? state.pageDataUrls : [''];
        const currentIdx = Number(state.currentPageIndex) || 0;

        listEl.innerHTML = '';
        pageDataUrls.forEach((url, idx) => {
            const isCurr = idx === currentIdx;
            const card = document.createElement('div');
            card.style.cssText = `
                border: 2px solid ${isCurr ? '#2563eb' : '#cbd5e1'};
                background: ${isCurr ? '#eff6ff' : '#ffffff'};
                border-radius: 8px; padding: 5px; display: flex; flex-direction: column; gap: 4px; cursor: pointer;
                transition: border-color 0.15s ease;
            `;

            const preview = document.createElement('div');
            preview.style.cssText = 'width:100%;height:74px;background:#fff;border:1px solid #e2e8f0;border-radius:5px;overflow:hidden;display:flex;align-items:center;justify-content:center;';
            if (url) {
                const img = document.createElement('img');
                img.src = url;
                img.alt = `صفحة ${idx + 1}`;
                img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
                preview.appendChild(img);
            } else {
                const empty = document.createElement('span');
                empty.style.cssText = 'font-size:0.7rem;color:#94a3b8;font-weight:700;';
                empty.textContent = 'صفحة فارغة';
                preview.appendChild(empty);
            }
            preview.onclick = () => handlers.onJump(idx);
            card.appendChild(preview);

            const bar = document.createElement('div');
            bar.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:2px;';

            const lbl = document.createElement('span');
            lbl.style.cssText = `font-size:0.7rem;font-weight:800;color:${isCurr ? '#1d4ed8' : '#334155'};`;
            lbl.textContent = `صفحة ${idx + 1}`;
            lbl.onclick = () => handlers.onJump(idx);
            bar.appendChild(lbl);

            const btns = document.createElement('div');
            btns.style.cssText = 'display:flex;gap:2px;';

            if (idx > 0) {
                const upBtn = document.createElement('button');
                upBtn.type = 'button';
                upBtn.textContent = '▲';
                upBtn.title = 'تحريك للأعلى';
                upBtn.style.cssText = 'border:none;background:#e2e8f0;color:#334155;border-radius:4px;font-size:0.62rem;padding:1px 4px;cursor:pointer;';
                upBtn.onclick = (e) => { e.stopPropagation(); handlers.onMove(idx, idx - 1); };
                btns.appendChild(upBtn);
            }
            if (idx < pageDataUrls.length - 1) {
                const dnBtn = document.createElement('button');
                dnBtn.type = 'button';
                dnBtn.textContent = '▼';
                dnBtn.title = 'تحريك للأسفل';
                dnBtn.style.cssText = 'border:none;background:#e2e8f0;color:#334155;border-radius:4px;font-size:0.62rem;padding:1px 4px;cursor:pointer;';
                dnBtn.onclick = (e) => { e.stopPropagation(); handlers.onMove(idx, idx + 1); };
                btns.appendChild(dnBtn);
            }
            if (pageDataUrls.length > 1) {
                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.textContent = '✕';
                delBtn.title = 'حذف الصفحة';
                delBtn.style.cssText = 'border:none;background:#fee2e2;color:#dc2626;border-radius:4px;font-size:0.62rem;padding:1px 4px;cursor:pointer;';
                delBtn.onclick = (e) => { e.stopPropagation(); handlers.onDelete(idx); };
                btns.appendChild(delBtn);
            }

            bar.appendChild(btns);
            card.appendChild(bar);
            listEl.appendChild(card);
        });
    }

    window.WbBridges = {
        openLibraryPdfPickerModal,
        openSaveBoardToLibraryModal,
        openAttachBoardToTutoringModal,
        renderFreehandPagesDrawer
    };
})(window);
