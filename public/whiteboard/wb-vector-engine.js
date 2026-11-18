/**
 * ============================================================================
 * محرك الكائنات المتجهية التفاعلية والإحداثيات المعيارية للـ PDF
 * Whiteboard Interactive Vector Object Model & PDF Normalized Coordinates
 * ============================================================================
 */
(function (window) {
    'use strict';

    function uid(prefix) {
        return (prefix || 'wb') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
    }

    // ------------------------------------------------------------------------
    // Normalized PDF Coordinates ([0..1] relative to active rendered PDF box)
    // ------------------------------------------------------------------------
    function hasValidPdfBox(env) {
        return !!(env && env.isPdfActive && env.pdfRenderPos && env.pdfRenderPos.width > 10 && env.pdfRenderPos.height > 10);
    }

    function getPdfOrigin(env) {
        const panX = (env && env.pdfPanOffset && Number(env.pdfPanOffset.x)) || 0;
        const panY = (env && env.pdfPanOffset && Number(env.pdfPanOffset.y)) || 0;
        const rp = (env && env.pdfRenderPos) || { x: 0, y: 0, width: 800, height: 600 };
        return {
            x: (rp.x || 0) + panX,
            y: (rp.y || 0) + panY,
            w: rp.width || 800,
            h: rp.height || 600
        };
    }

    function toPdfNorm(px, py, env) {
        if (!hasValidPdfBox(env)) return null;
        const box = getPdfOrigin(env);
        return [
            Math.round(((px - box.x) / box.w) * 100000) / 100000,
            Math.round(((py - box.y) / box.h) * 100000) / 100000
        ];
    }

    function fromPdfNorm(nx, ny, env) {
        if (!hasValidPdfBox(env)) return [nx, ny];
        const box = getPdfOrigin(env);
        return [box.x + nx * box.w, box.y + ny * box.h];
    }

    function attachNormalizedPdfFields(obj, env) {
        if (!obj || !hasValidPdfBox(env)) return obj;
        obj.coordSpace = 'pdf_norm';
        const box = getPdfOrigin(env);
        if (Array.isArray(obj.pts)) {
            obj.npts = obj.pts.map(p => {
                const px = Array.isArray(p) ? p[0] : p.x;
                const py = Array.isArray(p) ? p[1] : p.y;
                return toPdfNorm(px, py, env);
            });
        }
        if (typeof obj.x1 === 'number' && typeof obj.y1 === 'number') {
            const p1 = toPdfNorm(obj.x1, obj.y1, env);
            const p2 = toPdfNorm(obj.x2, obj.y2, env);
            obj.nx1 = p1[0]; obj.ny1 = p1[1];
            obj.nx2 = p2[0]; obj.ny2 = p2[1];
        }
        if (typeof obj.x === 'number' && typeof obj.y === 'number') {
            const pt = toPdfNorm(obj.x, obj.y, env);
            obj.nx = pt[0]; obj.ny = pt[1];
            if (typeof obj.w === 'number' && typeof obj.h === 'number') {
                obj.nw = Math.round((obj.w / box.w) * 100000) / 100000;
                obj.nh = Math.round((obj.h / box.h) * 100000) / 100000;
            }
        }
        if (typeof obj.cx === 'number' && typeof obj.cy === 'number') {
            const pt = toPdfNorm(obj.cx, obj.cy, env);
            obj.ncx = pt[0]; obj.ncy = pt[1];
        }
        return obj;
    }

    function resolvePoints(obj, env) {
        if (obj.coordSpace === 'pdf_norm' && hasValidPdfBox(env) && Array.isArray(obj.npts)) {
            return obj.npts.map(p => fromPdfNorm(p[0], p[1], env));
        }
        return (obj.pts || obj.points || []).map(p => Array.isArray(p) ? [p[0], p[1]] : [p.x, p.y]);
    }

    function resolveSegment(obj, env) {
        if (obj.coordSpace === 'pdf_norm' && hasValidPdfBox(env) && typeof obj.nx1 === 'number') {
            const p1 = fromPdfNorm(obj.nx1, obj.ny1, env);
            const p2 = fromPdfNorm(obj.nx2, obj.ny2, env);
            return { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1] };
        }
        return { x1: obj.x1, y1: obj.y1, x2: obj.x2, y2: obj.y2 };
    }

    function resolveBox(obj, env) {
        if (obj.coordSpace === 'pdf_norm' && hasValidPdfBox(env) && typeof obj.nx === 'number') {
            const p = fromPdfNorm(obj.nx, obj.ny, env);
            const box = getPdfOrigin(env);
            return {
                x: p[0],
                y: p[1],
                w: typeof obj.nw === 'number' ? obj.nw * box.w : (obj.w || 160),
                h: typeof obj.nh === 'number' ? obj.nh * box.h : (obj.h || 60)
            };
        }
        return { x: obj.x || 0, y: obj.y || 0, w: obj.w || 160, h: obj.h || 60 };
    }

    function resolveCenter(obj, env) {
        if (obj.coordSpace === 'pdf_norm' && hasValidPdfBox(env) && typeof obj.ncx === 'number') {
            const p = fromPdfNorm(obj.ncx, obj.ncy, env);
            return { cx: p[0], cy: p[1] };
        }
        return { cx: obj.cx || 400, cy: obj.cy || 300 };
    }

    // ------------------------------------------------------------------------
    // Image cache for KaTeX / SVG / Stamp rasterized vector objects
    // ------------------------------------------------------------------------
    const _imgCache = new Map();
    function getCachedImage(src, onLoadCb) {
        if (!src) return null;
        let entry = _imgCache.get(src);
        if (!entry) {
            const img = new Image();
            entry = { img, loaded: false };
            img.onload = () => {
                entry.loaded = true;
                if (typeof onLoadCb === 'function') onLoadCb();
            };
            img.src = src;
            _imgCache.set(src, entry);
        }
        return entry;
    }

    // ------------------------------------------------------------------------
    // Shape Drawing Helper
    // ------------------------------------------------------------------------
    function drawShape(targetCtx, x1, y1, x2, y2, tool, color, size) {
        targetCtx.save();
        targetCtx.globalCompositeOperation = 'source-over';
        targetCtx.globalAlpha = 1.0;
        targetCtx.strokeStyle = color || '#1e3a8a';
        targetCtx.fillStyle = color || '#1e3a8a';
        targetCtx.lineWidth = size || 3;
        targetCtx.lineCap = 'round';
        targetCtx.lineJoin = 'round';

        const dx = x2 - x1;
        const dy = y2 - y1;

        if (tool === 'line') {
            targetCtx.beginPath();
            targetCtx.moveTo(x1, y1);
            targetCtx.lineTo(x2, y2);
            targetCtx.stroke();
        } else if (tool === 'arrow') {
            targetCtx.beginPath();
            targetCtx.moveTo(x1, y1);
            targetCtx.lineTo(x2, y2);
            targetCtx.stroke();

            const angle = Math.atan2(dy, dx);
            const headLen = 12 + (size || 3) * 1.5;
            targetCtx.beginPath();
            targetCtx.moveTo(x2, y2);
            targetCtx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
            targetCtx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
            targetCtx.closePath();
            targetCtx.fill();
        } else if (tool === 'rect') {
            targetCtx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(dx), Math.abs(dy));
        } else if (tool === 'circle') {
            const radius = Math.sqrt(dx * dx + dy * dy);
            targetCtx.beginPath();
            targetCtx.arc(x1, y1, radius, 0, 2 * Math.PI);
            targetCtx.stroke();
            targetCtx.beginPath();
            targetCtx.arc(x1, y1, 3, 0, 2 * Math.PI);
            targetCtx.fill();
        } else if (tool === 'triangle') {
            targetCtx.beginPath();
            targetCtx.moveTo(x1, y1);
            targetCtx.lineTo(x2, y2);
            targetCtx.lineTo(x1, y2);
            targetCtx.closePath();
            targetCtx.stroke();
        }
        targetCtx.restore();
    }

    function drawRoundRectPath(ctx, x, y, w, h, r) {
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, y, w, h, r);
        } else {
            ctx.rect(x, y, w, h);
        }
    }

    // ------------------------------------------------------------------------
    // Master Vector Object Renderer
    // ------------------------------------------------------------------------
    function drawVectorObject(targetCtx, obj, env, onAsyncReady) {
        if (!targetCtx || !obj) return;
        const tool = obj.t || obj.tool || 'pen';
        const color = obj.c || obj.color || '#1e3a8a';
        const size = Number(obj.s || obj.size) || 3;
        const evalFn = (window.WbSecurityMath && window.WbSecurityMath.evaluateMathWithX) || (() => NaN);

        // 1. Freehand strokes (pen, highlighter, eraser)
        if (tool === 'pen' || tool === 'highlighter' || tool === 'eraser') {
            const pts = resolvePoints(obj, env);
            if (!pts || pts.length === 0) return;

            targetCtx.save();
            targetCtx.lineCap = 'round';
            targetCtx.lineJoin = 'round';
            if (tool === 'pen') {
                targetCtx.strokeStyle = color;
                targetCtx.fillStyle = color;
                targetCtx.lineWidth = size;
                targetCtx.globalAlpha = 1.0;
                targetCtx.globalCompositeOperation = 'source-over';
            } else if (tool === 'highlighter') {
                targetCtx.strokeStyle = color;
                targetCtx.fillStyle = color;
                targetCtx.lineWidth = Math.max(12, size * 4);
                targetCtx.globalAlpha = 0.28;
                targetCtx.globalCompositeOperation = 'source-over';
            } else if (tool === 'eraser') {
                targetCtx.lineWidth = Math.max(16, size * 5);
                targetCtx.globalCompositeOperation = 'destination-out';
                targetCtx.strokeStyle = 'rgba(0,0,0,1)';
                targetCtx.globalAlpha = 1.0;
            }

            if (pts.length === 1) {
                targetCtx.beginPath();
                targetCtx.arc(pts[0][0], pts[0][1], Math.max(0.8, size / 2), 0, Math.PI * 2);
                targetCtx.fill();
            } else if (pts.length === 2) {
                targetCtx.beginPath();
                targetCtx.moveTo(pts[0][0], pts[0][1]);
                targetCtx.lineTo(pts[1][0], pts[1][1]);
                targetCtx.stroke();
            } else {
                targetCtx.beginPath();
                targetCtx.moveTo(pts[0][0], pts[0][1]);
                for (let j = 1; j < pts.length - 1; j++) {
                    targetCtx.quadraticCurveTo(pts[j][0], pts[j][1], (pts[j][0] + pts[j + 1][0]) / 2, (pts[j][1] + pts[j + 1][1]) / 2);
                }
                const last = pts[pts.length - 1];
                targetCtx.lineTo(last[0], last[1]);
                targetCtx.stroke();
            }
            targetCtx.restore();
            return;
        }

        // 2. Basic Geometric Shapes
        if (tool === 'line' || tool === 'arrow' || tool === 'rect' || tool === 'circle' || tool === 'triangle') {
            const seg = resolveSegment(obj, env);
            if (seg.x1 !== undefined && seg.x2 !== undefined) {
                drawShape(targetCtx, seg.x1, seg.y1, seg.x2, seg.y2, tool, color, size);
            }
            return;
        }

        // 3. Text & Math Symbol
        if (tool === 'text') {
            const box = resolveBox(obj, env);
            const fontSize = obj.fontSize || Math.max(17, size * 5);
            targetCtx.save();
            targetCtx.globalCompositeOperation = 'source-over';
            targetCtx.font = `bold ${fontSize}px ${obj.fontFamily || '"Cairo", sans-serif'}`;
            targetCtx.fillStyle = color;
            targetCtx.textBaseline = 'top';
            targetCtx.textAlign = obj.align || 'left';
            targetCtx.fillText(obj.text || '', box.x, box.y);
            targetCtx.restore();
            return;
        }

        // 4. Cached Rasterized SVG / KaTeX Formula Image
        if (tool === 'latex_img') {
            const box = resolveBox(obj, env);
            const entry = getCachedImage(obj.src, onAsyncReady);
            if (entry && entry.loaded && entry.img.complete) {
                targetCtx.save();
                targetCtx.globalCompositeOperation = 'source-over';
                targetCtx.drawImage(entry.img, box.x, box.y, box.w, box.h);
                targetCtx.restore();
            } else if (obj.latex) {
                // Fallback instant text until SVG loads
                targetCtx.save();
                targetCtx.font = `bold ${Math.min(26, Math.max(14, box.h * 0.45))}px "Cairo", serif`;
                targetCtx.fillStyle = color;
                targetCtx.textAlign = 'center';
                targetCtx.textBaseline = 'middle';
                targetCtx.fillText(obj.latex, box.x + box.w / 2, box.y + box.h / 2);
                targetCtx.restore();
            }
            return;
        }

        // 5. Homework Stamp Pill
        if (tool === 'stamp') {
            const box = resolveBox(obj, env);
            targetCtx.save();
            targetCtx.globalCompositeOperation = 'source-over';
            targetCtx.shadowColor = 'rgba(0,0,0,0.12)';
            targetCtx.shadowBlur = 6;
            targetCtx.fillStyle = obj.bg || '#fefce8';
            targetCtx.strokeStyle = obj.border || '#facc15';
            targetCtx.lineWidth = 1.5;
            drawRoundRectPath(targetCtx, box.x, box.y, box.w, box.h, 6);
            targetCtx.fill();
            targetCtx.stroke();
            targetCtx.shadowBlur = 0;
            targetCtx.fillStyle = obj.textColor || '#854d0e';
            targetCtx.font = 'bold 12px "Cairo", sans-serif';
            targetCtx.textAlign = 'center';
            targetCtx.textBaseline = 'middle';
            targetCtx.fillText(`${obj.icon || '⭐'} ${obj.label || ''}`, box.x + box.w / 2, box.y + box.h / 2);
            targetCtx.restore();
            return;
        }

        // 6. Score Circle Badge
        if (tool === 'score_badge') {
            const box = resolveBox(obj, env);
            const cx = box.x + box.w / 2;
            const cy = box.y + box.h / 2;
            const r = Math.min(box.w, box.h) / 2;
            targetCtx.save();
            targetCtx.globalCompositeOperation = 'source-over';
            targetCtx.fillStyle = obj.c || '#dc2626';
            targetCtx.strokeStyle = obj.c || '#dc2626';
            targetCtx.lineWidth = 2;
            targetCtx.font = `bold ${Math.max(12, Math.round(r * 0.72))}px "Cairo", sans-serif`;
            targetCtx.beginPath();
            targetCtx.arc(cx, cy, r, 0, Math.PI * 2);
            targetCtx.stroke();
            targetCtx.textAlign = 'center';
            targetCtx.textBaseline = 'middle';
            targetCtx.fillText(obj.score || '+2', cx, cy);
            targetCtx.restore();
            return;
        }

        // 7. Calc Result Pill
        if (tool === 'calc_result') {
            const box = resolveBox(obj, env);
            targetCtx.save();
            targetCtx.globalCompositeOperation = 'source-over';
            targetCtx.fillStyle = '#eff6ff';
            targetCtx.strokeStyle = '#2563eb';
            targetCtx.lineWidth = 2;
            drawRoundRectPath(targetCtx, box.x, box.y, box.w, box.h, 10);
            targetCtx.fill();
            targetCtx.stroke();
            targetCtx.fillStyle = '#1e3a8a';
            targetCtx.font = 'bold 18px monospace';
            targetCtx.textAlign = 'center';
            targetCtx.textBaseline = 'middle';
            targetCtx.fillText(obj.text || '', box.x + box.w / 2, box.y + box.h / 2);
            targetCtx.restore();
            return;
        }

        // 8. Lesson Header Bar (Adaptive contrast on green/dark backgrounds)
        if (tool === 'lesson_header') {
            const box = resolveBox(obj, env);
            const isDark = env && (env.currentBg === 'green' || env.currentBg === 'dark');
            targetCtx.save();
            targetCtx.globalCompositeOperation = 'source-over';
            targetCtx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(239, 246, 255, 0.96)';
            targetCtx.strokeStyle = isDark ? '#38bdf8' : '#1e3a8a';
            targetCtx.lineWidth = 2;
            drawRoundRectPath(targetCtx, box.x, box.y, box.w, box.h, 10);
            targetCtx.fill();
            targetCtx.stroke();

            targetCtx.font = 'bold 13.5px "Cairo", sans-serif';
            targetCtx.textBaseline = 'middle';
            targetCtx.fillStyle = isDark ? '#e0f2fe' : '#1e3a8a';
            targetCtx.textAlign = 'right';
            targetCtx.fillText(`📅 ${obj.todayStr || ''}   |   🏫 القسم: ${obj.className || ''}`, box.x + box.w - 14, box.y + box.h / 2, box.w * 0.55);

            targetCtx.textAlign = 'left';
            targetCtx.fillStyle = isDark ? '#6ee7b7' : '#047857';
            targetCtx.fillText(`📘 الدرس: ${obj.lessonTitle || ''}`, box.x + 14, box.y + box.h / 2, box.w * 0.4);
            targetCtx.restore();
            return;
        }

        // 9. Didactic Callout Card
        if (tool === 'callout') {
            const box = resolveBox(obj, env);
            targetCtx.save();
            targetCtx.globalCompositeOperation = 'source-over';
            targetCtx.fillStyle = obj.bgColor || '#eff6ff';
            targetCtx.strokeStyle = obj.borderColor || '#1d4ed8';
            targetCtx.lineWidth = 2.2;
            drawRoundRectPath(targetCtx, box.x, box.y, box.w, box.h, 10);
            targetCtx.fill();
            targetCtx.stroke();

            targetCtx.fillStyle = obj.borderColor || '#1d4ed8';
            targetCtx.fillRect(box.x + box.w - 6, box.y + 4, 6, box.h - 8);

            targetCtx.direction = 'rtl';
            targetCtx.textAlign = 'right';
            targetCtx.textBaseline = 'top';
            targetCtx.font = 'bold 13.5px "Cairo", sans-serif';
            targetCtx.fillText(obj.title || '', box.x + box.w - 18, box.y + 12, box.w - 32);

            targetCtx.font = 'bold 12.5px "Cairo", sans-serif';
            targetCtx.fillStyle = '#0f172a';
            targetCtx.fillText(obj.body || '', box.x + box.w - 18, box.y + 40, box.w - 32);
            targetCtx.restore();
            return;
        }

        // 10. Quick Quiz Card
        if (tool === 'quiz_card') {
            const box = resolveBox(obj, env);
            const qObj = obj.question || {};
            targetCtx.save();
            targetCtx.globalCompositeOperation = 'source-over';
            targetCtx.fillStyle = '#fffbeb';
            targetCtx.strokeStyle = '#d97706';
            targetCtx.lineWidth = 2.2;
            drawRoundRectPath(targetCtx, box.x, box.y, box.w, box.h, 12);
            targetCtx.fill();
            targetCtx.stroke();
            targetCtx.fillStyle = '#d97706';
            targetCtx.fillRect(box.x + box.w - 8, box.y + 8, 5, box.h - 16);

            targetCtx.direction = 'rtl';
            targetCtx.textAlign = 'right';
            targetCtx.font = 'bold 13px "Cairo", sans-serif';
            targetCtx.fillStyle = '#92400e';
            targetCtx.fillText(`⚡ تذكير بالمكتسبات القبلية: ${qObj.concept || ''}`, box.x + box.w - 18, box.y + 26, box.w - 34);
            targetCtx.font = 'bold 13.5px "Cairo", sans-serif';
            targetCtx.fillStyle = '#0f172a';
            targetCtx.fillText(`❓ ${qObj.q || ''}`, box.x + box.w - 18, box.y + 54, box.w - 34);
            const correctText = (qObj.options && qObj.options[qObj.correct]) || '';
            targetCtx.font = 'bold 13px "Cairo", sans-serif';
            targetCtx.fillStyle = '#065f46';
            targetCtx.fillText(`✅ الجواب الصحيح: ${correctText}`, box.x + box.w - 18, box.y + 86, box.w - 34);
            targetCtx.font = 'bold 12px "Cairo", sans-serif';
            targetCtx.fillStyle = '#1e3a8a';
            targetCtx.fillText(`💡 التعليل: ${qObj.explanation || ''}`, box.x + box.w - 18, box.y + 118, box.w - 34);
            targetCtx.font = 'bold 11.5px "Cairo", sans-serif';
            targetCtx.fillStyle = '#9f1239';
            targetCtx.fillText(`⚠️ انتبه (خطأ شائع): ${qObj.pitfall || ''}`, box.x + box.w - 18, box.y + 150, box.w - 34);
            targetCtx.font = '11px "Cairo", sans-serif';
            targetCtx.fillStyle = '#64748b';
            targetCtx.fillText('🎯 تقويم تشخيصي وتكويني فوري على السبورة الرقمية (غير محتسب في النقط)', box.x + box.w - 18, box.y + 178, box.w - 34);
            targetCtx.restore();
            return;
        }

        // 11. Variation Table (Full or Blank)
        if (tool === 'variation_table') {
            const box = resolveBox(obj, env);
            const isDark = env && (env.currentBg === 'green' || env.currentBg === 'dark');
            const x0 = box.x;
            const y0 = box.y;
            const tblW = box.w;
            const tblH = box.h;
            const col1W = Math.max(70, Math.round(tblW * 0.175));
            const row1H = Math.round(tblH * 0.19);
            const row2H = Math.round(tblH * 0.24);

            targetCtx.save();
            targetCtx.globalCompositeOperation = 'source-over';
            if (obj.blank) {
                targetCtx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.78)' : 'rgba(248, 250, 252, 0.94)';
                targetCtx.fillRect(x0, y0, tblW, tblH);
                targetCtx.strokeStyle = isDark ? '#e2e8f0' : '#0f172a';
                targetCtx.lineWidth = 2.4;
                targetCtx.strokeRect(x0, y0, tblW, tblH);

                targetCtx.beginPath();
                targetCtx.moveTo(x0, y0 + row1H);
                targetCtx.lineTo(x0 + tblW, y0 + row1H);
                targetCtx.moveTo(x0, y0 + row1H + row2H);
                targetCtx.lineTo(x0 + tblW, y0 + row1H + row2H);
                targetCtx.moveTo(x0 + col1W, y0);
                targetCtx.lineTo(x0 + col1W, y0 + tblH);
                targetCtx.stroke();

                targetCtx.fillStyle = isDark ? '#f8fafc' : '#1e3a8a';
                targetCtx.font = 'bold 16px "Cairo", sans-serif';
                targetCtx.textAlign = 'center';
                targetCtx.textBaseline = 'middle';
                targetCtx.fillText('x', x0 + col1W / 2, y0 + row1H / 2);
                targetCtx.fillText("إشارة f'(x)", x0 + col1W / 2, y0 + row1H + row2H / 2);
                targetCtx.fillText('تغيرات f(x)', x0 + col1W / 2, y0 + row1H + row2H + (tblH - row1H - row2H) / 2);

                targetCtx.font = 'bold 17px serif';
                targetCtx.fillStyle = isDark ? '#fbbf24' : '#dc2626';
                targetCtx.fillText('-∞', x0 + col1W + 28, y0 + row1H / 2);
                targetCtx.fillText('+∞', x0 + tblW - 28, y0 + row1H / 2);

                targetCtx.setLineDash([5, 5]);
                targetCtx.strokeStyle = isDark ? 'rgba(148,163,184,0.45)' : 'rgba(100,116,139,0.45)';
                targetCtx.lineWidth = 1.4;
                const mid1 = x0 + col1W + Math.floor((tblW - col1W) * 0.36);
                const mid2 = x0 + col1W + Math.floor((tblW - col1W) * 0.68);
                targetCtx.beginPath();
                targetCtx.moveTo(mid1, y0 + row1H); targetCtx.lineTo(mid1, y0 + tblH);
                targetCtx.moveTo(mid2, y0 + row1H); targetCtx.lineTo(mid2, y0 + tblH);
                targetCtx.stroke();
            } else {
                const fnName = obj.fnName || 'f';
                const xList = obj.xList || ['-∞', '0', '+∞'];
                const sigList = obj.sigList || ['-', '+'];
                const arrList = obj.arrList || ['↘', '↗'];
                const yList = obj.yList || ['+∞', '0', '+∞'];

                targetCtx.fillStyle = '#ffffff';
                targetCtx.fillRect(x0, y0, tblW, tblH);
                targetCtx.strokeStyle = '#0f172a';
                targetCtx.lineWidth = 2.2;
                targetCtx.strokeRect(x0, y0, tblW, tblH);

                targetCtx.fillStyle = '#f8fafc';
                targetCtx.fillRect(x0, y0, col1W, tblH);

                targetCtx.beginPath();
                targetCtx.moveTo(x0, y0 + row1H); targetCtx.lineTo(x0 + tblW, y0 + row1H);
                targetCtx.moveTo(x0, y0 + row1H + row2H); targetCtx.lineTo(x0 + tblW, y0 + row1H + row2H);
                targetCtx.moveTo(x0 + col1W, y0); targetCtx.lineTo(x0 + col1W, y0 + tblH);
                targetCtx.stroke();

                targetCtx.fillStyle = '#0f172a';
                targetCtx.font = 'bold 14px "Cairo", serif';
                targetCtx.textAlign = 'center';
                targetCtx.textBaseline = 'middle';
                targetCtx.fillText('x', x0 + col1W / 2, y0 + row1H / 2);
                targetCtx.fillText(`${fnName}'(x)`, x0 + col1W / 2, y0 + row1H + row2H / 2);
                targetCtx.fillText(fnName, x0 + col1W / 2, y0 + row1H + row2H + (tblH - row1H - row2H) / 2);

                const padX = 28;
                const innerW = tblW - col1W - padX * 2;
                const stepX = xList.length > 1 ? innerW / (xList.length - 1) : innerW;
                const segCount = Math.max(1, xList.length - 1);
                const segW = innerW / segCount;
                const interspersedSigns = sigList.length > segCount;

                targetCtx.font = 'bold 14px "Cairo", serif';
                xList.forEach((xv, i) => {
                    const px = x0 + col1W + padX + i * stepX;
                    targetCtx.fillStyle = '#0f172a';
                    targetCtx.fillText(xv, px, y0 + row1H / 2);

                    if (!interspersedSigns && i > 0 && i < xList.length - 1) {
                        const prevSig = sigList[i - 1] || '';
                        const nextSig = sigList[i] || '';
                        if (prevSig === '||' || nextSig === '||') {
                            targetCtx.lineWidth = 1.6;
                            targetCtx.beginPath();
                            targetCtx.moveTo(px - 3, y0 + row1H); targetCtx.lineTo(px - 3, y0 + tblH);
                            targetCtx.moveTo(px + 3, y0 + row1H); targetCtx.lineTo(px + 3, y0 + tblH);
                            targetCtx.stroke();
                        } else {
                            targetCtx.setLineDash([4, 3]);
                            targetCtx.strokeStyle = '#94a3b8';
                            targetCtx.lineWidth = 1.2;
                            targetCtx.beginPath();
                            targetCtx.moveTo(px, y0 + row1H); targetCtx.lineTo(px, y0 + row1H + row2H);
                            targetCtx.stroke();
                            targetCtx.setLineDash([]);
                            targetCtx.strokeStyle = '#0f172a';
                            targetCtx.fillStyle = '#dc2626';
                            targetCtx.fillRect(px - 9, y0 + row1H + row2H / 2 - 9, 18, 18);
                            targetCtx.fillStyle = '#ffffff';
                            targetCtx.font = 'bold 12px sans-serif';
                            targetCtx.fillText('0', px, y0 + row1H + row2H / 2);
                            targetCtx.font = 'bold 14px "Cairo", serif';
                        }
                    }
                });

                if (interspersedSigns) {
                    sigList.forEach((sg, i) => {
                        const sx = x0 + col1W + padX + (sigList.length === 1 ? innerW / 2 : (i / (sigList.length - 1)) * innerW);
                        const sy = y0 + row1H + row2H / 2;
                        if (sg === '0') {
                            targetCtx.save();
                            targetCtx.strokeStyle = '#64748b';
                            targetCtx.lineWidth = 1.2;
                            targetCtx.setLineDash([4, 3]);
                            targetCtx.beginPath();
                            targetCtx.moveTo(sx, y0 + row1H); targetCtx.lineTo(sx, y0 + row1H + row2H);
                            targetCtx.stroke();
                            targetCtx.restore();
                            targetCtx.fillStyle = '#dc2626';
                            targetCtx.font = 'bold 13px "Cairo", sans-serif';
                            targetCtx.fillText('0', sx, sy);
                        } else if (sg === '||') {
                            targetCtx.save();
                            targetCtx.strokeStyle = '#dc2626';
                            targetCtx.lineWidth = 1.8;
                            targetCtx.beginPath();
                            targetCtx.moveTo(sx - 3, y0 + row1H); targetCtx.lineTo(sx - 3, y0 + tblH);
                            targetCtx.moveTo(sx + 3, y0 + row1H); targetCtx.lineTo(sx + 3, y0 + tblH);
                            targetCtx.stroke();
                            targetCtx.restore();
                        } else if (sg) {
                            targetCtx.fillStyle = sg === '+' ? '#059669' : '#dc2626';
                            targetCtx.font = 'bold 18px sans-serif';
                            targetCtx.fillText(sg, sx, sy);
                        }
                    });
                } else {
                    for (let i = 0; i < segCount; i++) {
                        const sx = x0 + col1W + padX + (i + 0.5) * segW;
                        const sg = sigList[i] || '';
                        if (sg && sg !== '||') {
                            targetCtx.fillStyle = sg === '+' ? '#059669' : '#dc2626';
                            targetCtx.font = 'bold 18px sans-serif';
                            targetCtx.fillText(sg, sx, y0 + row1H + row2H / 2);
                        }
                    }
                }

                const topY = y0 + row1H + row2H + 22;
                const botY = y0 + tblH - 22;
                let yValIdx = 0;
                arrList.forEach((ar, i) => {
                    const sx1 = x0 + col1W + padX + i * segW;
                    const sx2 = sx1 + segW;
                    if (ar === '||') return;
                    const isUp = ar.includes('↗') || ar === '+' || ar === 'up';
                    const startYPos = isUp ? botY : topY;
                    const endYPos = isUp ? topY : botY;

                    if (i === 0 && yList[yValIdx] !== undefined) {
                        targetCtx.fillStyle = '#0f172a';
                        targetCtx.font = 'bold 14px "Cairo", serif';
                        targetCtx.fillText(yList[yValIdx++], sx1, startYPos);
                    }
                    const ax1 = sx1 + 22;
                    const ay1 = isUp ? botY - 6 : topY + 6;
                    const ax2 = sx2 - 22;
                    const ay2 = isUp ? topY + 6 : botY - 6;

                    targetCtx.strokeStyle = isUp ? '#059669' : '#dc2626';
                    targetCtx.fillStyle = isUp ? '#059669' : '#dc2626';
                    targetCtx.lineWidth = 2.2;
                    targetCtx.beginPath();
                    targetCtx.moveTo(ax1, ay1);
                    targetCtx.lineTo(ax2, ay2);
                    targetCtx.stroke();

                    const ang = Math.atan2(ay2 - ay1, ax2 - ax1);
                    targetCtx.beginPath();
                    targetCtx.moveTo(ax2, ay2);
                    targetCtx.lineTo(ax2 - 9 * Math.cos(ang - Math.PI / 6), ay2 - 9 * Math.sin(ang - Math.PI / 6));
                    targetCtx.lineTo(ax2 - 9 * Math.cos(ang + Math.PI / 6), ay2 - 9 * Math.sin(ang + Math.PI / 6));
                    targetCtx.closePath();
                    targetCtx.fill();

                    if (yList[yValIdx] !== undefined) {
                        targetCtx.fillStyle = '#0f172a';
                        targetCtx.font = 'bold 14px "Cairo", serif';
                        targetCtx.fillText(yList[yValIdx++], sx2, endYPos);
                    }
                });
            }
            targetCtx.restore();
            return;
        }

        // 12. Cartesian Axes (O, i, j)
        if (tool === 'axes') {
            const box = resolveBox(obj, env);
            const w = box.w;
            const h = box.h;
            const x0 = box.x;
            const y0 = box.y;
            const cx = x0 + w / 2;
            const cy = y0 + h / 2;
            const step = obj.step || 40;

            targetCtx.save();
            targetCtx.globalCompositeOperation = 'source-over';
            targetCtx.strokeStyle = 'rgba(203, 213, 225, 0.45)';
            targetCtx.lineWidth = 0.6;
            targetCtx.beginPath();
            for (let gx = x0 + ((cx - x0) % step); gx < x0 + w; gx += step) {
                targetCtx.moveTo(gx, y0); targetCtx.lineTo(gx, y0 + h);
            }
            for (let gy = y0 + ((cy - y0) % step); gy < y0 + h; gy += step) {
                targetCtx.moveTo(x0, gy); targetCtx.lineTo(x0 + w, gy);
            }
            targetCtx.stroke();

            targetCtx.strokeStyle = color;
            targetCtx.fillStyle = color;
            targetCtx.lineWidth = 2.2;
            targetCtx.font = 'bold 12px "Cairo", sans-serif';

            targetCtx.beginPath();
            targetCtx.moveTo(x0 + 25, cy); targetCtx.lineTo(x0 + w - 25, cy);
            targetCtx.stroke();
            targetCtx.beginPath();
            targetCtx.moveTo(x0 + w - 25, cy);
            targetCtx.lineTo(x0 + w - 38, cy - 6);
            targetCtx.lineTo(x0 + w - 38, cy + 6);
            targetCtx.closePath();
            targetCtx.fill();
            targetCtx.fillText('(x)', x0 + w - 20, cy - 8);

            targetCtx.beginPath();
            targetCtx.moveTo(cx, y0 + h - 25); targetCtx.lineTo(cx, y0 + 25);
            targetCtx.stroke();
            targetCtx.beginPath();
            targetCtx.moveTo(cx, y0 + 25);
            targetCtx.lineTo(cx - 6, y0 + 38);
            targetCtx.lineTo(cx + 6, y0 + 38);
            targetCtx.closePath();
            targetCtx.fill();
            targetCtx.fillText('(y)', cx + 10, y0 + 28);

            targetCtx.lineWidth = 1.4;
            targetCtx.font = 'bold 10px "Cairo", sans-serif';
            targetCtx.textAlign = 'center';
            targetCtx.textBaseline = 'top';
            let val = 1;
            for (let tx = cx + step; tx < x0 + w - 45; tx += step) {
                targetCtx.beginPath(); targetCtx.moveTo(tx, cy - 4); targetCtx.lineTo(tx, cy + 4); targetCtx.stroke();
                targetCtx.fillText(String(val++), tx, cy + 6);
            }
            val = -1;
            for (let tx = cx - step; tx > x0 + 40; tx -= step) {
                targetCtx.beginPath(); targetCtx.moveTo(tx, cy - 4); targetCtx.lineTo(tx, cy + 4); targetCtx.stroke();
                targetCtx.fillText(String(val--), tx, cy + 6);
            }

            targetCtx.textAlign = 'right';
            targetCtx.textBaseline = 'middle';
            val = 1;
            for (let ty = cy - step; ty > y0 + 35; ty -= step) {
                targetCtx.beginPath(); targetCtx.moveTo(cx - 4, ty); targetCtx.lineTo(cx + 4, ty); targetCtx.stroke();
                targetCtx.fillText(String(val++), cx - 7, ty);
            }
            val = -1;
            for (let ty = cy + step; ty < y0 + h - 35; ty += step) {
                targetCtx.beginPath(); targetCtx.moveTo(cx - 4, ty); targetCtx.lineTo(cx + 4, ty); targetCtx.stroke();
                targetCtx.fillText(String(val--), cx - 7, ty);
            }

            targetCtx.font = 'bold 13px "Cairo", sans-serif';
            targetCtx.fillText('O', cx - 8, cy + 14);

            targetCtx.lineWidth = 3.2;
            targetCtx.strokeStyle = '#ef4444';
            targetCtx.beginPath(); targetCtx.moveTo(cx, cy); targetCtx.lineTo(cx + step, cy); targetCtx.stroke();
            targetCtx.fillStyle = '#ef4444';
            targetCtx.beginPath(); targetCtx.moveTo(cx + step, cy); targetCtx.lineTo(cx + step - 7, cy - 4); targetCtx.lineTo(cx + step - 7, cy + 4); targetCtx.closePath(); targetCtx.fill();
            targetCtx.fillText('i⃗', cx + step / 2, cy - 10);

            targetCtx.strokeStyle = '#059669';
            targetCtx.beginPath(); targetCtx.moveTo(cx, cy); targetCtx.lineTo(cx, cy - step); targetCtx.stroke();
            targetCtx.fillStyle = '#059669';
            targetCtx.beginPath(); targetCtx.moveTo(cx, cy - step); targetCtx.lineTo(cx - 4, cy - step + 7); targetCtx.lineTo(cx + 4, cy - step + 7); targetCtx.closePath(); targetCtx.fill();
            targetCtx.fillText('j⃗', cx + 18, cy - step / 2);
            targetCtx.restore();
            return;
        }

        // 13. Trigonometric Circle
        if (tool === 'trig_circle') {
            const box = resolveBox(obj, env);
            const cx = box.x + box.w / 2;
            const cy = box.y + box.h / 2;
            const R = Math.max(40, Math.min(box.w, box.h) / 2 - 40);
            const isDarkBg = env && (env.currentBg === 'green' || env.currentBg === 'dark');
            const axisColor = (isDarkBg && (color === '#1e3a8a' || color === '#0f172a')) ? '#f8fafc' : color;

            targetCtx.save();
            targetCtx.globalCompositeOperation = 'source-over';
            targetCtx.strokeStyle = axisColor;
            targetCtx.fillStyle = axisColor;
            targetCtx.lineWidth = 2;
            targetCtx.font = 'bold 12px "Cairo", sans-serif';
            targetCtx.beginPath();
            targetCtx.moveTo(cx - R - 35, cy); targetCtx.lineTo(cx + R + 35, cy);
            targetCtx.moveTo(cx, cy + R + 35); targetCtx.lineTo(cx, cy - R - 35);
            targetCtx.stroke();
            targetCtx.fillText('cos(x)', cx + R + 8, cy - 8);
            targetCtx.fillText('sin(x)', cx + 8, cy - R - 15);

            targetCtx.lineWidth = 2.5;
            targetCtx.strokeStyle = isDarkBg ? '#38bdf8' : '#2563eb';
            targetCtx.beginPath();
            targetCtx.arc(cx, cy, R, 0, 2 * Math.PI);
            targetCtx.stroke();

            const angles = [
                { rad: 0, label: '0' }, { rad: Math.PI / 6, label: 'π/6' }, { rad: Math.PI / 4, label: 'π/4' },
                { rad: Math.PI / 3, label: 'π/3' }, { rad: Math.PI / 2, label: 'π/2' },
                { rad: (2 * Math.PI) / 3, label: '2π/3' }, { rad: (3 * Math.PI) / 4, label: '3π/4' },
                { rad: (5 * Math.PI) / 6, label: '5π/6' }, { rad: Math.PI, label: 'π' }
            ];
            targetCtx.fillStyle = '#dc2626';
            targetCtx.font = 'bold 11px sans-serif';
            angles.forEach(a => {
                const px = cx + R * Math.cos(a.rad);
                const py = cy - R * Math.sin(a.rad);
                targetCtx.beginPath(); targetCtx.arc(px, py, 4, 0, 2 * Math.PI); targetCtx.fill();
                targetCtx.fillText(a.label, cx + (R + 18) * Math.cos(a.rad) - 10, cy - (R + 18) * Math.sin(a.rad) + 4);
            });
            targetCtx.restore();
            return;
        }

        // 14. Complex Plane
        if (tool === 'complex_plane') {
            const box = resolveBox(obj, env);
            const cx = box.x + box.w / 2;
            const cy = box.y + box.h / 2;
            const unit = Math.max(24, Math.min(box.w, box.h) / 9);
            const isDarkBg = env && (env.currentBg === 'green' || env.currentBg === 'dark');
            const axisClr = isDarkBg ? '#f8fafc' : '#1e293b';

            targetCtx.save();
            targetCtx.globalCompositeOperation = 'source-over';
            targetCtx.strokeStyle = axisClr;
            targetCtx.fillStyle = axisClr;
            targetCtx.lineWidth = 2;
            targetCtx.beginPath();
            targetCtx.moveTo(box.x + 20, cy); targetCtx.lineTo(box.x + box.w - 20, cy);
            targetCtx.moveTo(cx, box.y + box.h - 20); targetCtx.lineTo(cx, box.y + 20);
            targetCtx.stroke();

            targetCtx.beginPath();
            targetCtx.moveTo(box.x + box.w - 20, cy); targetCtx.lineTo(box.x + box.w - 30, cy - 5); targetCtx.lineTo(box.x + box.w - 30, cy + 5); targetCtx.closePath();
            targetCtx.moveTo(cx, box.y + 20); targetCtx.lineTo(cx - 5, box.y + 30); targetCtx.lineTo(cx + 5, box.y + 30); targetCtx.closePath();
            targetCtx.fill();

            targetCtx.save();
            targetCtx.strokeStyle = 'rgba(99, 102, 241, 0.45)';
            targetCtx.lineWidth = 1.5;
            targetCtx.setLineDash([4, 4]);
            targetCtx.beginPath();
            targetCtx.arc(cx, cy, unit, 0, Math.PI * 2);
            targetCtx.stroke();
            targetCtx.restore();

            targetCtx.strokeStyle = '#dc2626';
            targetCtx.fillStyle = '#dc2626';
            targetCtx.lineWidth = 2.8;
            targetCtx.beginPath();
            targetCtx.moveTo(cx, cy); targetCtx.lineTo(cx + unit, cy);
            targetCtx.moveTo(cx, cy); targetCtx.lineTo(cx, cy - unit);
            targetCtx.stroke();
            targetCtx.font = 'bold 13px sans-serif';
            targetCtx.fillText('u⃗', cx + unit / 2 - 4, cy + 18);
            targetCtx.fillText('v⃗', cx - 18, cy - unit / 2 + 4);

            const a = 2.4, b = 1.6;
            const mx = cx + a * unit, my = cy - b * unit, myConj = cy + b * unit;
            targetCtx.save();
            targetCtx.strokeStyle = '#64748b'; targetCtx.lineWidth = 1.3; targetCtx.setLineDash([5, 4]);
            targetCtx.beginPath();
            targetCtx.moveTo(mx, cy); targetCtx.lineTo(mx, my);
            targetCtx.moveTo(cx, my); targetCtx.lineTo(mx, my);
            targetCtx.moveTo(mx, cy); targetCtx.lineTo(mx, myConj);
            targetCtx.moveTo(cx, myConj); targetCtx.lineTo(mx, myConj);
            targetCtx.stroke();
            targetCtx.restore();

            targetCtx.strokeStyle = '#0284c7'; targetCtx.fillStyle = '#0284c7'; targetCtx.lineWidth = 2.4;
            targetCtx.beginPath(); targetCtx.moveTo(cx, cy); targetCtx.lineTo(mx, my); targetCtx.stroke();
            const theta = Math.atan2(b, a);
            targetCtx.beginPath(); targetCtx.arc(cx, cy, 32, -theta, 0); targetCtx.stroke();
            targetCtx.font = 'bold 12px sans-serif';
            targetCtx.fillText('θ = arg(z)', cx + 38, cy - 12);
            targetCtx.fillText('r = |z|', (cx + mx) / 2 - 22, (cy + my) / 2 - 10);
            targetCtx.beginPath(); targetCtx.arc(mx, my, 4.5, 0, Math.PI * 2); targetCtx.fill();
            targetCtx.fillText('M(z = a + ib)', mx + 10, my - 6);

            targetCtx.strokeStyle = '#059669'; targetCtx.fillStyle = '#059669'; targetCtx.lineWidth = 1.8;
            targetCtx.beginPath(); targetCtx.setLineDash([4, 3]); targetCtx.moveTo(cx, cy); targetCtx.lineTo(mx, myConj); targetCtx.stroke();
            targetCtx.setLineDash([]);
            targetCtx.beginPath(); targetCtx.arc(mx, myConj, 4, 0, Math.PI * 2); targetCtx.fill();
            targetCtx.fillText("M'(z̄ = a - ib)", mx + 10, myConj + 14);

            targetCtx.fillStyle = axisClr;
            targetCtx.font = 'bold 13px "Cairo", sans-serif';
            targetCtx.fillText('O', cx - 16, cy + 16);
            targetCtx.fillText('a = Re(z)', mx - 24, cy + 20);
            targetCtx.fillText('ib', cx - 24, my + 4);
            targetCtx.fillText('-ib', cx - 28, myConj + 4);
            targetCtx.fillText('المحور الحقيقي (Re)', box.x + box.w - 155, cy - 10);
            targetCtx.fillText('المحور التخيلي (i·Im)', cx + 12, box.y + 32);
            targetCtx.restore();
            return;
        }

        // 15. Preset or Custom Math Curve
        if (tool === 'math_curve') {
            const box = resolveBox(obj, env);
            const cx = box.x + box.w / 2;
            const cy = box.y + box.h / 2;
            const scale = obj.scale || 40;
            const xMin = -(box.w / 2) / scale;
            const xMax = (box.w / 2) / scale;

            targetCtx.save();
            targetCtx.globalCompositeOperation = 'source-over';

            // Integral shading if requested
            if (obj.withIntegral && obj.expr && obj.intA !== obj.intB) {
                const a = Math.min(obj.intA, obj.intB);
                const b = Math.max(obj.intA, obj.intB);
                targetCtx.save();
                targetCtx.fillStyle = 'rgba(124, 58, 237, 0.22)';
                targetCtx.beginPath();
                targetCtx.moveTo(cx + a * scale, cy);
                for (let x = a; x <= b; x += 0.05) {
                    const y = evalFn(obj.expr, x, false);
                    if (!isNaN(y) && Math.abs(y) < 30) {
                        targetCtx.lineTo(cx + x * scale, cy - y * scale);
                    }
                }
                targetCtx.lineTo(cx + b * scale, cy);
                targetCtx.closePath();
                targetCtx.fill();
                targetCtx.restore();
            }

            if (obj.curveType === 'homographic') {
                const asympX = cx + 1 * scale;
                const asympY = cy - 2 * scale;
                targetCtx.save();
                targetCtx.lineWidth = 1.6;
                targetCtx.setLineDash([5, 4]);
                targetCtx.strokeStyle = '#ef4444';
                targetCtx.beginPath(); targetCtx.moveTo(asympX, box.y + 20); targetCtx.lineTo(asympX, box.y + box.h - 20); targetCtx.stroke();
                targetCtx.strokeStyle = '#2563eb';
                targetCtx.beginPath(); targetCtx.moveTo(box.x + 20, asympY); targetCtx.lineTo(box.x + box.w - 20, asympY); targetCtx.stroke();
                targetCtx.font = 'bold 11px "Cairo", sans-serif';
                targetCtx.fillStyle = '#ef4444';
                targetCtx.fillText('المقارب العمودي: x = 1', asympX + 8, box.y + 40);
                targetCtx.fillStyle = '#2563eb';
                targetCtx.fillText('المقارب الأفقي: y = 2', box.x + box.w - 160, asympY - 8);
                targetCtx.restore();
            }

            targetCtx.strokeStyle = color;
            targetCtx.lineWidth = Math.max(2.5, size);
            targetCtx.lineCap = 'round';
            targetCtx.lineJoin = 'round';
            targetCtx.beginPath();
            let started = false;
            let prevPy = null;
            for (let px = box.x + 20; px < box.x + box.w - 20; px += 2) {
                const x = (px - cx) / scale;
                let y = NaN;
                if (obj.expr) {
                    y = evalFn(obj.expr, x, false);
                } else {
                    const ct = obj.curveType;
                    if (ct === 'parabola' || ct === 'tangent') y = x * x;
                    else if (ct === 'homographic') { if (Math.abs(x - 1) > 0.12) y = (2 * x - 1) / (x - 1); }
                    else if (ct === 'sqrt') { if (x >= 0) y = Math.sqrt(x); }
                    else if (ct === 'inv') { if (Math.abs(x) > 0.08) y = 1 / x; }
                    else if (ct === 'sin') y = Math.sin(x);
                    else if (ct === 'cos') y = Math.cos(x);
                    else if (ct === 'tan') { if (Math.abs(Math.cos(x)) > 0.1) y = Math.tan(x); }
                    else if (ct === 'cube') y = x * x * x;
                    else if (ct === 'abs') y = Math.abs(x);
                    else if (ct === 'ln') { if (x > 0.05) y = Math.log(x); }
                    else if (ct === 'exp') y = Math.exp(x);
                    else if (ct === 'gaussian') y = 2.5 * Math.exp(-x * x);
                }
                if (!isNaN(y) && isFinite(y) && Math.abs(y) <= 25) {
                    const py = cy - y * scale;
                    if (py >= box.y - 40 && py <= box.y + box.h + 40 && !(prevPy !== null && Math.abs(py - prevPy) > box.h * 0.45)) {
                        if (!started) { targetCtx.moveTo(px, py); started = true; }
                        else targetCtx.lineTo(px, py);
                        prevPy = py;
                    } else { started = false; prevPy = null; }
                } else { started = false; prevPy = null; }
            }
            targetCtx.stroke();

            if (obj.curveType === 'tangent') {
                targetCtx.save();
                targetCtx.strokeStyle = '#dc2626';
                targetCtx.lineWidth = 2.4;
                targetCtx.beginPath();
                targetCtx.moveTo(cx + xMin * scale, cy - (2 * xMin - 1) * scale);
                targetCtx.lineTo(cx + xMax * scale, cy - (2 * xMax - 1) * scale);
                targetCtx.stroke();
                const ax = cx + scale, ay = cy - scale;
                targetCtx.fillStyle = '#dc2626';
                targetCtx.beginPath(); targetCtx.arc(ax, ay, 5.5, 0, Math.PI * 2); targetCtx.fill();
                targetCtx.font = 'bold 12px "Cairo", sans-serif';
                targetCtx.fillText('A(1, 1)', ax + 10, ay - 6);
                targetCtx.restore();
            }

            if (obj.withTangent && obj.expr) {
                const x0 = Number(obj.x0) || 0;
                const y0 = evalFn(obj.expr, x0, false);
                const eps = 0.0001;
                const dy = (evalFn(obj.expr, x0 + eps, false) - evalFn(obj.expr, x0 - eps, false)) / (2 * eps);
                if (!isNaN(y0) && !isNaN(dy)) {
                    targetCtx.save();
                    targetCtx.strokeStyle = '#dc2626';
                    targetCtx.fillStyle = '#dc2626';
                    targetCtx.lineWidth = 2;
                    targetCtx.setLineDash([6, 4]);
                    const dxSpan = 2.2;
                    targetCtx.beginPath();
                    targetCtx.moveTo(cx + (x0 - dxSpan) * scale, cy - (y0 - dy * dxSpan) * scale);
                    targetCtx.lineTo(cx + (x0 + dxSpan) * scale, cy - (y0 + dy * dxSpan) * scale);
                    targetCtx.stroke();
                    targetCtx.setLineDash([]);
                    targetCtx.beginPath(); targetCtx.arc(cx + x0 * scale, cy - y0 * scale, 4.5, 0, Math.PI * 2); targetCtx.fill();
                    const mRound = Math.round(dy * 100) / 100;
                    const pRound = Math.round((y0 - dy * x0) * 100) / 100;
                    targetCtx.font = 'bold 12px "Cairo", sans-serif';
                    targetCtx.fillText(`(T): y = ${mRound}x ${pRound >= 0 ? '+ ' + pRound : pRound}`, cx + x0 * scale + 10, cy - y0 * scale - 10);
                    targetCtx.restore();
                }
            }

            targetCtx.font = 'bold 13.5px "Cairo", sans-serif';
            targetCtx.fillStyle = obj.curveType === 'tangent' ? '#dc2626' : color;
            targetCtx.fillText(obj.label || (obj.expr ? `(Cf): f(x) = ${obj.expr}` : 'Cf'), box.x + 40, box.y + 42);
            targetCtx.restore();
            return;
        }

        // 16. Recursive Sequence Cobweb
        if (tool === 'cobweb') {
            const box = resolveBox(obj, env);
            const cx = box.x + box.w / 2;
            const cy = box.y + box.h / 2;
            const scale = obj.scale || 40;
            const expr = obj.expr || 'sqrt(2*x+3)';
            const u0 = Number(obj.u0) || 0.5;
            const steps = obj.steps || 4;

            targetCtx.save();
            targetCtx.globalCompositeOperation = 'source-over';
            targetCtx.strokeStyle = '#64748b';
            targetCtx.lineWidth = 1.8;
            targetCtx.setLineDash([6, 4]);
            targetCtx.beginPath();
            targetCtx.moveTo(cx - 6 * scale, cy + 6 * scale);
            targetCtx.lineTo(cx + 6 * scale, cy - 6 * scale);
            targetCtx.stroke();
            targetCtx.setLineDash([]);
            targetCtx.fillStyle = '#475569';
            targetCtx.font = 'bold 12px "Cairo", sans-serif';
            targetCtx.fillText('(Δ): y = x', cx + 4.2 * scale, cy - 4.4 * scale);

            targetCtx.strokeStyle = '#2563eb';
            targetCtx.lineWidth = 2.6;
            targetCtx.beginPath();
            let penDown = false;
            for (let px = box.x + 30; px < box.x + box.w - 30; px += 2) {
                const x = (px - cx) / scale;
                const y = evalFn(expr, x, false);
                if (isNaN(y) || Math.abs(y) > 15) { penDown = false; continue; }
                const py = cy - y * scale;
                if (!penDown) { targetCtx.moveTo(px, py); penDown = true; }
                else targetCtx.lineTo(px, py);
            }
            targetCtx.stroke();
            targetCtx.fillStyle = '#1d4ed8';
            targetCtx.font = 'bold 13px "Cairo", sans-serif';
            targetCtx.fillText(`(Cf): f(x) = ${expr}`, box.x + 40, box.y + 42);

            let currU = u0;
            for (let i = 0; i < steps; i++) {
                const nextU = evalFn(expr, currU, false);
                if (isNaN(nextU) || Math.abs(nextU) > 15) break;
                const xCurr = cx + currU * scale;
                const yCurrOnLine = (i === 0) ? cy : (cy - currU * scale);
                const yNext = cy - nextU * scale;
                const xNext = cx + nextU * scale;

                targetCtx.strokeStyle = '#dc2626';
                targetCtx.lineWidth = 2;
                targetCtx.beginPath();
                targetCtx.moveTo(xCurr, yCurrOnLine);
                targetCtx.lineTo(xCurr, yNext);
                targetCtx.lineTo(xNext, yNext);
                targetCtx.stroke();

                targetCtx.save();
                targetCtx.strokeStyle = '#059669';
                targetCtx.lineWidth = 1.3;
                targetCtx.setLineDash([3, 3]);
                targetCtx.beginPath();
                targetCtx.moveTo(xCurr, yNext); targetCtx.lineTo(xCurr, cy);
                targetCtx.moveTo(xNext, yNext); targetCtx.lineTo(xNext, cy);
                targetCtx.stroke();
                targetCtx.restore();

                targetCtx.fillStyle = '#dc2626';
                targetCtx.beginPath(); targetCtx.arc(xCurr, cy, 3.2, 0, Math.PI * 2); targetCtx.fill();
                targetCtx.font = 'bold 12px sans-serif';
                targetCtx.fillText(`u${i}`, xCurr - 6, cy + 18 + (i % 2) * 12);
                if (i === steps - 1) {
                    targetCtx.beginPath(); targetCtx.arc(xNext, cy, 3.2, 0, Math.PI * 2); targetCtx.fill();
                    targetCtx.fillText(`u${i + 1}`, xNext - 6, cy + 18 + ((i + 1) % 2) * 12);
                }
                currU = nextU;
            }
            targetCtx.restore();
            return;
        }

        // 17. 3D Space & Probability Templates
        if (tool === 'space_prob') {
            const box = resolveBox(obj, env);
            const cx = box.x + box.w / 2;
            const cy = box.y + box.h / 2;
            const isDarkBg = env && (env.currentBg === 'green' || env.currentBg === 'dark');
            const mainClr = (isDarkBg && (color === '#1e3a8a' || color === '#0f172a')) ? '#f8fafc' : color;
            const tt = obj.templateType;
            const showHidden = obj.showHiddenEdges !== false;
            const showLabels = obj.showLabels !== false;
            const showProj = obj.showAltitude !== false;

            targetCtx.save();
            targetCtx.globalCompositeOperation = 'source-over';
            targetCtx.strokeStyle = mainClr;
            targetCtx.fillStyle = mainClr;
            targetCtx.lineWidth = 2.2;
            targetCtx.lineCap = 'round';
            targetCtx.lineJoin = 'round';
            targetCtx.font = 'bold 13px "Cairo", sans-serif';

            if (tt === 'cube3d' || tt === 'parallelepiped3d') {
                const isPara = tt === 'parallelepiped3d';
                const wSide = isPara ? box.w * 0.54 : Math.min(box.w, box.h) * 0.44;
                const hSide = isPara ? box.h * 0.42 : Math.min(box.w, box.h) * 0.44;
                const dx = wSide * 0.36, dy = -hSide * 0.34;
                const D = { x: cx - wSide * 0.32, y: cy + hSide * 0.36 };
                const C = { x: D.x + wSide, y: D.y };
                const H = { x: D.x, y: D.y - hSide };
                const G = { x: C.x, y: C.y - hSide };
                const A = { x: D.x - dx, y: D.y - dy };
                const B = { x: C.x - dx, y: C.y - dy };
                const E = { x: H.x - dx, y: H.y - dy };
                const F = { x: G.x - dx, y: G.y - dy };

                if (showHidden) {
                    targetCtx.save();
                    targetCtx.setLineDash([6, 4]); targetCtx.lineWidth = 1.6;
                    targetCtx.beginPath();
                    targetCtx.moveTo(D.x, D.y); targetCtx.lineTo(A.x, A.y);
                    targetCtx.moveTo(D.x, D.y); targetCtx.lineTo(C.x, C.y);
                    targetCtx.moveTo(D.x, D.y); targetCtx.lineTo(H.x, H.y);
                    targetCtx.stroke();
                    targetCtx.restore();
                }

                targetCtx.beginPath();
                targetCtx.moveTo(A.x, A.y); targetCtx.lineTo(B.x, B.y); targetCtx.lineTo(F.x, F.y); targetCtx.lineTo(E.x, E.y); targetCtx.closePath();
                targetCtx.moveTo(B.x, B.y); targetCtx.lineTo(C.x, C.y); targetCtx.lineTo(G.x, G.y); targetCtx.lineTo(F.x, F.y);
                targetCtx.moveTo(E.x, E.y); targetCtx.lineTo(H.x, H.y); targetCtx.lineTo(G.x, G.y);
                targetCtx.stroke();

                if (showProj) {
                    // Draw space diagonal AG dashed in red/amber for 3D Pythagoras/vector exercises
                    targetCtx.save();
                    targetCtx.strokeStyle = '#dc2626';
                    targetCtx.setLineDash([4, 4]);
                    targetCtx.lineWidth = 1.5;
                    targetCtx.beginPath();
                    targetCtx.moveTo(A.x, A.y); targetCtx.lineTo(G.x, G.y);
                    targetCtx.stroke();
                    targetCtx.restore();
                }

                if (showLabels) {
                    targetCtx.fillText('A', A.x - 16, A.y + 14); targetCtx.fillText('B', B.x + 8, B.y + 14);
                    targetCtx.fillText('C', C.x + 10, C.y + 6); targetCtx.fillText('D', D.x - 14, D.y - 6);
                    targetCtx.fillText('E', E.x - 16, E.y - 6); targetCtx.fillText('F', F.x + 8, F.y + 4);
                    targetCtx.fillText('G', G.x + 10, G.y - 6); targetCtx.fillText('H', H.x - 14, H.y - 8);
                }
            } else if (tt === 'tetrahedron') {
                const rx = box.w * 0.38, ry = box.h * 0.36;
                const A = { x: cx, y: cy - ry };
                const B = { x: cx - rx, y: cy + ry * 0.68 };
                const D = { x: cx + rx * 0.12, y: cy + ry };
                const C = { x: cx + rx, y: cy + ry * 0.5 };
                targetCtx.beginPath();
                targetCtx.moveTo(A.x, A.y); targetCtx.lineTo(B.x, B.y);
                targetCtx.moveTo(A.x, A.y); targetCtx.lineTo(D.x, D.y);
                targetCtx.moveTo(A.x, A.y); targetCtx.lineTo(C.x, C.y);
                targetCtx.moveTo(B.x, B.y); targetCtx.lineTo(D.x, D.y);
                targetCtx.moveTo(D.x, D.y); targetCtx.lineTo(C.x, C.y);
                targetCtx.stroke();
                if (showHidden) {
                    targetCtx.save(); targetCtx.setLineDash([6, 4]);
                    targetCtx.beginPath(); targetCtx.moveTo(B.x, B.y); targetCtx.lineTo(C.x, C.y); targetCtx.stroke();
                    targetCtx.restore();
                }
                if (showLabels) {
                    targetCtx.fillText('A', A.x - 5, A.y - 10); targetCtx.fillText('B', B.x - 18, B.y + 10);
                    targetCtx.fillText('D', D.x - 5, D.y + 18); targetCtx.fillText('C', C.x + 10, C.y + 8);
                }
            } else if (tt === 'pyramid3d') {
                const wBase = box.w * 0.52;
                const dx = wBase * 0.34, dy = -box.h * 0.18;
                const baseCy = cy + box.h * 0.26;
                const A = { x: cx - wBase * 0.56, y: baseCy };
                const B = { x: A.x + wBase, y: baseCy };
                const D = { x: A.x + dx, y: A.y + dy };
                const C = { x: B.x + dx, y: B.y + dy };
                const H = { x: (A.x + C.x) / 2, y: (A.y + C.y) / 2 };
                const S = { x: H.x, y: cy - box.h * 0.38 };

                if (showHidden) {
                    targetCtx.save();
                    targetCtx.setLineDash([6, 4]); targetCtx.lineWidth = 1.5;
                    targetCtx.beginPath();
                    targetCtx.moveTo(A.x, A.y); targetCtx.lineTo(D.x, D.y);
                    targetCtx.moveTo(D.x, D.y); targetCtx.lineTo(C.x, C.y);
                    targetCtx.moveTo(S.x, S.y); targetCtx.lineTo(D.x, D.y);
                    targetCtx.stroke();
                    targetCtx.restore();
                }

                targetCtx.beginPath();
                targetCtx.moveTo(A.x, A.y); targetCtx.lineTo(B.x, B.y); targetCtx.lineTo(C.x, C.y);
                targetCtx.moveTo(S.x, S.y); targetCtx.lineTo(A.x, A.y);
                targetCtx.moveTo(S.x, S.y); targetCtx.lineTo(B.x, B.y);
                targetCtx.moveTo(S.x, S.y); targetCtx.lineTo(C.x, C.y);
                targetCtx.stroke();

                if (showProj) {
                    targetCtx.save();
                    targetCtx.strokeStyle = '#dc2626';
                    targetCtx.setLineDash([4, 3]);
                    targetCtx.lineWidth = 1.5;
                    targetCtx.beginPath();
                    targetCtx.moveTo(S.x, S.y); targetCtx.lineTo(H.x, H.y);
                    targetCtx.moveTo(A.x, A.y); targetCtx.lineTo(C.x, C.y);
                    targetCtx.stroke();
                    targetCtx.fillStyle = '#dc2626';
                    targetCtx.beginPath(); targetCtx.arc(H.x, H.y, 3, 0, Math.PI * 2); targetCtx.fill();
                    if (showLabels) targetCtx.fillText('H', H.x + 6, H.y + 13);
                    targetCtx.restore();
                }

                if (showLabels) {
                    targetCtx.fillText('S', S.x - 5, S.y - 10);
                    targetCtx.fillText('A', A.x - 16, A.y + 12);
                    targetCtx.fillText('B', B.x + 8, B.y + 12);
                    targetCtx.fillText('C', C.x + 10, C.y + 4);
                    targetCtx.fillText('D', D.x - 14, D.y - 6);
                }
            } else if (tt === 'cylinder3d' || tt === 'cone3d') {
                const isCone = tt === 'cone3d';
                const rx = box.w * 0.32;
                const ry = rx * 0.28;
                const topY = cy - box.h * 0.32;
                const botY = cy + box.h * 0.30;

                // Bottom ellipse: front half solid, back half dashed
                targetCtx.beginPath();
                targetCtx.ellipse(cx, botY, rx, ry, 0, 0, Math.PI, false);
                targetCtx.stroke();
                if (showHidden) {
                    targetCtx.save();
                    targetCtx.setLineDash([6, 4]); targetCtx.lineWidth = 1.5;
                    targetCtx.beginPath();
                    targetCtx.ellipse(cx, botY, rx, ry, 0, Math.PI, Math.PI * 2, false);
                    targetCtx.stroke();
                    targetCtx.restore();
                }

                if (isCone) {
                    const S = { x: cx, y: topY };
                    targetCtx.beginPath();
                    targetCtx.moveTo(S.x, S.y); targetCtx.lineTo(cx - rx, botY);
                    targetCtx.moveTo(S.x, S.y); targetCtx.lineTo(cx + rx, botY);
                    targetCtx.stroke();
                    if (showProj) {
                        targetCtx.save();
                        targetCtx.strokeStyle = '#0284c7';
                        targetCtx.setLineDash([4, 4]);
                        targetCtx.lineWidth = 1.5;
                        targetCtx.beginPath();
                        targetCtx.moveTo(S.x, S.y); targetCtx.lineTo(cx, botY);
                        targetCtx.lineTo(cx + rx, botY);
                        targetCtx.stroke();
                        targetCtx.restore();
                    }
                    if (showLabels) {
                        targetCtx.fillText('S', S.x - 5, S.y - 10);
                        targetCtx.fillText('O', cx - 15, botY + 6);
                        targetCtx.fillText('R', cx + rx * 0.45, botY - 6);
                    }
                } else {
                    // Top ellipse + side generators
                    targetCtx.beginPath();
                    targetCtx.ellipse(cx, topY, rx, ry, 0, 0, Math.PI * 2);
                    targetCtx.moveTo(cx - rx, topY); targetCtx.lineTo(cx - rx, botY);
                    targetCtx.moveTo(cx + rx, topY); targetCtx.lineTo(cx + rx, botY);
                    targetCtx.stroke();
                    if (showProj) {
                        targetCtx.save();
                        targetCtx.strokeStyle = '#0284c7';
                        targetCtx.setLineDash([4, 4]);
                        targetCtx.lineWidth = 1.5;
                        targetCtx.beginPath();
                        targetCtx.moveTo(cx, topY); targetCtx.lineTo(cx, botY);
                        targetCtx.lineTo(cx + rx, botY);
                        targetCtx.stroke();
                        targetCtx.restore();
                    }
                    if (showLabels) {
                        targetCtx.fillText("O'", cx - 18, topY + 4);
                        targetCtx.fillText('O', cx - 16, botY + 5);
                        targetCtx.fillText('R', cx + rx * 0.45, botY - 6);
                    }
                }
            } else if (tt === 'space_axes_3d') {
                // 3D Orthonormal Coordinate System (O, i, j, k) with point M(x,y,z) and projection H(x,y,0)
                const O = { x: cx - box.w * 0.06, y: cy + box.h * 0.1 };
                const lenZ = box.h * 0.42;
                const lenY = box.w * 0.40;
                const lenX = Math.min(box.w, box.h) * 0.34;
                const angX = Math.PI * 0.78; // ~140 deg (down-left)
                const endZ = { x: O.x, y: O.y - lenZ };
                const endY = { x: O.x + lenY, y: O.y };
                const endX = { x: O.x + lenX * Math.cos(angX), y: O.y + lenX * Math.sin(angX) };

                const drawArrow = (x1, y1, x2, y2, clr, lw) => {
                    targetCtx.save();
                    targetCtx.strokeStyle = clr; targetCtx.fillStyle = clr; targetCtx.lineWidth = lw || 2.2;
                    targetCtx.beginPath(); targetCtx.moveTo(x1, y1); targetCtx.lineTo(x2, y2); targetCtx.stroke();
                    const a = Math.atan2(y2 - y1, x2 - x1);
                    targetCtx.beginPath();
                    targetCtx.moveTo(x2, y2);
                    targetCtx.lineTo(x2 - 9 * Math.cos(a - 0.35), y2 - 9 * Math.sin(a - 0.35));
                    targetCtx.lineTo(x2 - 9 * Math.cos(a + 0.35), y2 - 9 * Math.sin(a + 0.35));
                    targetCtx.closePath(); targetCtx.fill();
                    targetCtx.restore();
                };

                drawArrow(O.x, O.y, endX.x, endX.y, mainClr, 2.2);
                drawArrow(O.x, O.y, endY.x, endY.y, mainClr, 2.2);
                drawArrow(O.x, O.y, endZ.x, endZ.y, mainClr, 2.2);

                // Unit vectors i, j, k
                const uX = { x: O.x + lenX * 0.32 * Math.cos(angX), y: O.y + lenX * 0.32 * Math.sin(angX) };
                const uY = { x: O.x + lenY * 0.28, y: O.y };
                const uZ = { x: O.x, y: O.y - lenZ * 0.28 };
                drawArrow(O.x, O.y, uX.x, uX.y, '#dc2626', 2.8);
                drawArrow(O.x, O.y, uY.x, uY.y, '#059669', 2.8);
                drawArrow(O.x, O.y, uZ.x, uZ.y, '#2563eb', 2.8);

                if (showProj) {
                    const px = { x: O.x + lenX * 0.65 * Math.cos(angX), y: O.y + lenX * 0.65 * Math.sin(angX) };
                    const py = { x: O.x + lenY * 0.58, y: O.y };
                    const H = { x: px.x + (py.x - O.x), y: px.y + (py.y - O.y) };
                    const M = { x: H.x, y: H.y - lenZ * 0.62 };
                    const pz = { x: O.x, y: O.y - lenZ * 0.62 };

                    targetCtx.save();
                    targetCtx.strokeStyle = '#64748b';
                    targetCtx.setLineDash([4, 4]);
                    targetCtx.lineWidth = 1.4;
                    targetCtx.beginPath();
                    targetCtx.moveTo(px.x, px.y); targetCtx.lineTo(H.x, H.y); targetCtx.lineTo(py.x, py.y);
                    targetCtx.moveTo(O.x, O.y); targetCtx.lineTo(H.x, H.y);
                    targetCtx.moveTo(H.x, H.y); targetCtx.lineTo(M.x, M.y);
                    targetCtx.moveTo(pz.x, pz.y); targetCtx.lineTo(M.x, M.y);
                    targetCtx.stroke();
                    targetCtx.restore();

                    targetCtx.fillStyle = '#dc2626';
                    targetCtx.beginPath(); targetCtx.arc(M.x, M.y, 4, 0, Math.PI * 2); targetCtx.fill();
                    targetCtx.fillStyle = '#0284c7';
                    targetCtx.beginPath(); targetCtx.arc(H.x, H.y, 3.2, 0, Math.PI * 2); targetCtx.fill();
                    if (showLabels) {
                        targetCtx.fillStyle = '#dc2626';
                        targetCtx.fillText('M(x,y,z)', M.x + 8, M.y - 4);
                        targetCtx.fillStyle = '#0284c7';
                        targetCtx.fillText('H(x,y,0)', H.x + 8, H.y + 14);
                    }
                }

                if (showLabels) {
                    targetCtx.fillStyle = mainClr;
                    targetCtx.fillText('O', O.x - 16, O.y - 4);
                    targetCtx.fillText('x', endX.x - 14, endX.y + 12);
                    targetCtx.fillText('y', endY.x + 8, endY.y + 4);
                    targetCtx.fillText('z', endZ.x - 4, endZ.y - 10);
                    targetCtx.fillStyle = '#dc2626'; targetCtx.fillText('i⃗', uX.x - 16, uX.y - 2);
                    targetCtx.fillStyle = '#059669'; targetCtx.fillText('j⃗', uY.x - 4, uY.y + 16);
                    targetCtx.fillStyle = '#2563eb'; targetCtx.fillText('k⃗', uZ.x - 18, uZ.y + 5);
                }
            } else if (tt === 'sphere_plane') {
                const R = Math.min(box.w, box.h) * 0.38;
                targetCtx.beginPath(); targetCtx.arc(cx, cy, R, 0, Math.PI * 2); targetCtx.stroke();
                if (showHidden) {
                    targetCtx.save(); targetCtx.setLineDash([5, 4]); targetCtx.lineWidth = 1.4;
                    targetCtx.beginPath(); targetCtx.ellipse(cx, cy, R, R * 0.27, 0, 0, Math.PI * 2); targetCtx.stroke();
                    targetCtx.restore();
                }
                const hy = cy - R * 0.5;
                const rSec = Math.sqrt(Math.max(1, R * R - (R * 0.5) * (R * 0.5)));
                targetCtx.save();
                targetCtx.fillStyle = 'rgba(2, 132, 199, 0.16)'; targetCtx.strokeStyle = '#0284c7';
                targetCtx.beginPath(); targetCtx.ellipse(cx, hy, rSec, R * 0.19, 0, 0, Math.PI * 2); targetCtx.fill(); targetCtx.stroke();
                targetCtx.restore();
                targetCtx.fillStyle = '#dc2626';
                targetCtx.beginPath(); targetCtx.arc(cx, cy, 3.5, 0, Math.PI * 2); targetCtx.arc(cx, hy, 3.5, 0, Math.PI * 2); targetCtx.fill();
                targetCtx.beginPath(); targetCtx.moveTo(cx, cy); targetCtx.lineTo(cx, hy); targetCtx.lineTo(cx + rSec, hy); targetCtx.stroke();
                if (showLabels) {
                    targetCtx.fillText('Ω', cx - 18, cy + 5); targetCtx.fillText('H', cx - 18, hy + 4);
                    targetCtx.fillText('M', cx + rSec + 8, hy + 4); targetCtx.fillText('(S)', cx - R - 28, cy - R + 20);
                }
            } else if (tt === 'prob_tree') {
                const root = { x: cx - box.w * 0.42, y: cy };
                const nA = { x: cx - box.w * 0.08, y: cy - box.h * 0.28 };
                const nAb = { x: cx - box.w * 0.08, y: cy + box.h * 0.28 };
                const nAB = { x: cx + box.w * 0.35, y: cy - box.h * 0.42 };
                const nABb = { x: cx + box.w * 0.35, y: cy - box.h * 0.14 };
                const nAbB = { x: cx + box.w * 0.35, y: cy + box.h * 0.14 };
                const nAbBb = { x: cx + box.w * 0.35, y: cy + box.h * 0.42 };
                targetCtx.beginPath();
                targetCtx.moveTo(root.x, root.y); targetCtx.lineTo(nA.x - 16, nA.y);
                targetCtx.moveTo(root.x, root.y); targetCtx.lineTo(nAb.x - 16, nAb.y);
                targetCtx.moveTo(nA.x + 16, nA.y); targetCtx.lineTo(nAB.x - 16, nAB.y);
                targetCtx.moveTo(nA.x + 16, nA.y); targetCtx.lineTo(nABb.x - 16, nABb.y);
                targetCtx.moveTo(nAb.x + 16, nAb.y); targetCtx.lineTo(nAbB.x - 16, nAbB.y);
                targetCtx.moveTo(nAb.x + 16, nAb.y); targetCtx.lineTo(nAbBb.x - 16, nAbBb.y);
                targetCtx.stroke();
                targetCtx.fillStyle = '#1e3a8a'; targetCtx.font = 'bold 15px "Cairo", sans-serif';
                targetCtx.fillText('Ω', root.x - 22, root.y + 5); targetCtx.fillText('A', nA.x - 5, nA.y + 5); targetCtx.fillText('Ā', nAb.x - 5, nAb.y + 5);
                targetCtx.fillStyle = '#059669';
                targetCtx.fillText('B', nAB.x, nAB.y + 5); targetCtx.fillText('B̄', nABb.x, nABb.y + 5);
                targetCtx.fillText('B', nAbB.x, nAbB.y + 5); targetCtx.fillText('B̄', nAbBb.x, nAbBb.y + 5);
                targetCtx.fillStyle = '#dc2626'; targetCtx.font = 'bold 11px sans-serif';
                targetCtx.fillText('P(A)', (root.x + nA.x) / 2 - 20, (root.y + nA.y) / 2 - 8);
                targetCtx.fillText('P(Ā)', (root.x + nAb.x) / 2 - 20, (root.y + nAb.y) / 2 + 18);
                targetCtx.fillText('P_A(B)', (nA.x + nAB.x) / 2 - 15, (nA.y + nAB.y) / 2 - 8);
                targetCtx.fillText('P_A(B̄)', (nA.x + nABb.x) / 2 - 15, (nA.y + nABb.y) / 2 + 16);
                targetCtx.fillText('P_Ā(B)', (nAb.x + nAbB.x) / 2 - 15, (nAb.y + nAbB.y) / 2 - 8);
                targetCtx.fillText('P_Ā(B̄)', (nAb.x + nAbBb.x) / 2 - 15, (nAb.y + nAbBb.y) / 2 + 16);
            }
            targetCtx.restore();
            return;
        }

        // 18. Geometric Instrument Stamps (Right angle, Protractor angle, Compass Circle / Arc)
        if (tool === 'right_angle') {
            const box = resolveBox(obj, env);
            const scaleX = box.w / (obj.baseW || box.w);
            const scaleY = box.h / (obj.baseH || box.h);
            const tPt = (pt) => [box.x + (pt[0] - obj.x) * scaleX, box.y + (pt[1] - obj.y) * scaleY];
            const o = tPt(obj.origin), hEnd = tPt(obj.hEnd), vEnd = tPt(obj.vEnd);
            const sq1 = tPt(obj.sq1), sqCorner = tPt(obj.sqCorner), sq2 = tPt(obj.sq2), dot = tPt(obj.dot);
            targetCtx.save();
            targetCtx.globalCompositeOperation = 'source-over';
            targetCtx.strokeStyle = color; targetCtx.fillStyle = color;
            targetCtx.lineWidth = Math.max(2, size); targetCtx.lineCap = 'round'; targetCtx.lineJoin = 'round';
            targetCtx.beginPath(); targetCtx.moveTo(hEnd[0], hEnd[1]); targetCtx.lineTo(o[0], o[1]); targetCtx.lineTo(vEnd[0], vEnd[1]); targetCtx.stroke();
            targetCtx.beginPath(); targetCtx.moveTo(sq1[0], sq1[1]); targetCtx.lineTo(sqCorner[0], sqCorner[1]); targetCtx.lineTo(sq2[0], sq2[1]); targetCtx.stroke();
            targetCtx.beginPath(); targetCtx.arc(dot[0], dot[1], 2.5, 0, Math.PI * 2); targetCtx.fill();
            targetCtx.restore();
            return;
        }

        if (tool === 'angle_arc') {
            const box = resolveBox(obj, env);
            const scaleX = box.w / (obj.baseW || box.w);
            const scaleY = box.h / (obj.baseH || box.h);
            const tPt = (pt) => [box.x + (pt[0] - obj.x) * scaleX, box.y + (pt[1] - obj.y) * scaleY];
            const o = tPt(obj.origin), baseEnd = tPt(obj.baseEnd), rayEnd = tPt(obj.rayEnd), labelPos = tPt(obj.labelPos);
            targetCtx.save();
            targetCtx.globalCompositeOperation = 'source-over';
            targetCtx.strokeStyle = color; targetCtx.fillStyle = color;
            targetCtx.lineWidth = Math.max(2, size); targetCtx.lineCap = 'round'; targetCtx.lineJoin = 'round';
            targetCtx.beginPath(); targetCtx.moveTo(baseEnd[0], baseEnd[1]); targetCtx.lineTo(o[0], o[1]); targetCtx.lineTo(rayEnd[0], rayEnd[1]); targetCtx.stroke();
            targetCtx.beginPath(); targetCtx.arc(o[0], o[1], 34 * Math.min(scaleX, scaleY), obj.startWorldAngle, obj.endWorldAngle); targetCtx.stroke();
            targetCtx.font = 'bold 14px "Cairo", sans-serif'; targetCtx.textAlign = 'center'; targetCtx.textBaseline = 'middle';
            targetCtx.fillText(`${obj.deg || 60}°`, labelPos[0], labelPos[1]);
            targetCtx.restore();
            return;
        }

        if (tool === 'compass_circle') {
            const box = resolveBox(obj, env);
            const cx = box.x + box.w / 2;
            const cy = box.y + box.h / 2;
            const r = Math.min(box.w, box.h) / 2;
            const rCm = Math.round((r / 20) * 10) / 10;
            targetCtx.save();
            targetCtx.globalCompositeOperation = 'source-over';
            targetCtx.strokeStyle = color; targetCtx.fillStyle = color;
            targetCtx.lineWidth = Math.max(2, size); targetCtx.lineCap = 'round';
            targetCtx.beginPath(); targetCtx.arc(cx, cy, r, 0, Math.PI * 2); targetCtx.stroke();
            targetCtx.beginPath(); targetCtx.arc(cx, cy, 3.2, 0, Math.PI * 2); targetCtx.fill();
            const px = cx + r * Math.cos(obj.angle || 0);
            const py = cy + r * Math.sin(obj.angle || 0);
            targetCtx.save(); targetCtx.lineWidth = 1.3; targetCtx.setLineDash([4, 4]);
            targetCtx.beginPath(); targetCtx.moveTo(cx, cy); targetCtx.lineTo(px, py); targetCtx.stroke();
            targetCtx.restore();
            targetCtx.font = 'bold 12px "Cairo", sans-serif';
            targetCtx.fillText(`R = ${rCm} cm`, (cx + px) / 2 - 20, (cy + py) / 2 - 8);
            targetCtx.restore();
            return;
        }

        if (tool === 'compass_arc') {
            const box = resolveBox(obj, env);
            const cx = box.x + box.w / 2;
            const cy = box.y + box.h / 2;
            const r = Math.min(box.w, box.h) / 2;
            const baseAngle = obj.angle || 0;
            const halfArc = (35 * Math.PI) / 180;
            targetCtx.save();
            targetCtx.globalCompositeOperation = 'source-over';
            targetCtx.strokeStyle = color; targetCtx.fillStyle = color;
            targetCtx.lineWidth = Math.max(2, size); targetCtx.lineCap = 'round';
            targetCtx.beginPath(); targetCtx.arc(cx, cy, r, baseAngle - halfArc, baseAngle + halfArc); targetCtx.stroke();
            targetCtx.lineWidth = 1.4;
            targetCtx.beginPath();
            targetCtx.moveTo(cx - 4, cy); targetCtx.lineTo(cx + 4, cy);
            targetCtx.moveTo(cx, cy - 4); targetCtx.lineTo(cx, cy + 4);
            targetCtx.stroke();
            targetCtx.restore();
        }
    }

    // ------------------------------------------------------------------------
    // Bounding Box Calculation & Hit-Testing for Select / Stroke Eraser
    // ------------------------------------------------------------------------
    function getObjectBounds(obj, env) {
        if (!obj) return null;
        const tool = obj.t || obj.tool || 'pen';
        if (tool === 'pen' || tool === 'highlighter' || tool === 'eraser') {
            const pts = resolvePoints(obj, env);
            if (!pts || pts.length === 0) return null;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const p of pts) {
                if (p[0] < minX) minX = p[0];
                if (p[1] < minY) minY = p[1];
                if (p[0] > maxX) maxX = p[0];
                if (p[1] > maxY) maxY = p[1];
            }
            const pad = Math.max(8, (obj.s || 3) * 1.5);
            return { x: minX - pad, y: minY - pad, w: Math.max(20, maxX - minX + pad * 2), h: Math.max(20, maxY - minY + pad * 2) };
        }
        if (tool === 'line' || tool === 'arrow' || tool === 'rect' || tool === 'triangle') {
            const seg = resolveSegment(obj, env);
            const minX = Math.min(seg.x1, seg.x2);
            const minY = Math.min(seg.y1, seg.y2);
            const maxX = Math.max(seg.x1, seg.x2);
            const maxY = Math.max(seg.y1, seg.y2);
            return { x: minX - 6, y: minY - 6, w: Math.max(20, maxX - minX + 12), h: Math.max(20, maxY - minY + 12) };
        }
        if (tool === 'circle') {
            const seg = resolveSegment(obj, env);
            const r = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
            return { x: seg.x1 - r - 6, y: seg.y1 - r - 6, w: Math.max(24, r * 2 + 12), h: Math.max(24, r * 2 + 12) };
        }
        return resolveBox(obj, env);
    }

    function distToSegment(px, py, x1, y1, x2, y2) {
        const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
        if (l2 === 0) return Math.hypot(px - x1, py - y1);
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
    }

    function hitTestObjects(px, py, list, env) {
        if (!Array.isArray(list)) return -1;
        for (let i = list.length - 1; i >= 0; i--) {
            const obj = list[i];
            if (!obj) continue;
            const tool = obj.t || obj.tool || 'pen';
            if (tool === 'eraser') continue; // Don't select destination-out masks directly
            if (tool === 'pen' || tool === 'highlighter') {
                const pts = resolvePoints(obj, env);
                const tol = Math.max(12, (obj.s || 3) * (tool === 'highlighter' ? 2.5 : 1.5));
                if (pts.length === 1 && Math.hypot(px - pts[0][0], py - pts[0][1]) <= tol) return i;
                for (let j = 1; j < pts.length; j++) {
                    if (distToSegment(px, py, pts[j - 1][0], pts[j - 1][1], pts[j][0], pts[j][1]) <= tol) {
                        return i;
                    }
                }
                continue;
            }
            if (tool === 'line' || tool === 'arrow') {
                const seg = resolveSegment(obj, env);
                if (distToSegment(px, py, seg.x1, seg.y1, seg.x2, seg.y2) <= 12) return i;
                continue;
            }
            const b = getObjectBounds(obj, env);
            if (b && px >= b.x - 4 && px <= b.x + b.w + 4 && py >= b.y - 4 && py <= b.y + b.h + 4) {
                return i;
            }
        }
        return -1;
    }

    function hitTestSelectionHandle(px, py, b) {
        if (!b) return null;
        // Quick action pills above top-right of selection box
        const delX = b.x + b.w - 14;
        const delY = b.y - 16;
        if (Math.hypot(px - delX, py - delY) <= 13) return 'delete';
        const dupX = b.x + b.w - 44;
        const dupY = b.y - 16;
        if (Math.hypot(px - dupX, py - dupY) <= 13) return 'duplicate';

        // 4 corner handles
        if (Math.hypot(px - b.x, py - b.y) <= 12) return 'nw';
        if (Math.hypot(px - (b.x + b.w), py - b.y) <= 12) return 'ne';
        if (Math.hypot(px - b.x, py - (b.y + b.h)) <= 12) return 'sw';
        if (Math.hypot(px - (b.x + b.w), py - (b.y + b.h)) <= 12) return 'se';

        if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return 'move';
        return null;
    }

    function moveVectorObject(obj, dx, dy, env) {
        if (!obj || (!dx && !dy)) return;
        const round1 = (v) => Math.round(v * 10) / 10;
        if (Array.isArray(obj.pts)) {
            obj.pts = obj.pts.map(p => Array.isArray(p) ? [round1(p[0] + dx), round1(p[1] + dy)] : { x: round1(p.x + dx), y: round1(p.y + dy) });
        }
        if (typeof obj.x1 === 'number') {
            obj.x1 = round1(obj.x1 + dx); obj.y1 = round1(obj.y1 + dy);
            obj.x2 = round1(obj.x2 + dx); obj.y2 = round1(obj.y2 + dy);
        }
        if (typeof obj.x === 'number') {
            obj.x = round1(obj.x + dx); obj.y = round1(obj.y + dy);
        }
        if (typeof obj.cx === 'number') {
            obj.cx = round1(obj.cx + dx); obj.cy = round1(obj.cy + dy);
        }
        if (Array.isArray(obj.origin)) {
            const shiftPair = (p) => [round1(p[0] + dx), round1(p[1] + dy)];
            ['origin', 'hEnd', 'vEnd', 'sq1', 'sqCorner', 'sq2', 'dot', 'baseEnd', 'rayEnd', 'labelPos'].forEach(k => {
                if (Array.isArray(obj[k])) obj[k] = shiftPair(obj[k]);
            });
        }
        if (obj.coordSpace === 'pdf_norm' && hasValidPdfBox(env)) {
            attachNormalizedPdfFields(obj, env);
        }
    }

    function scaleObjectToBounds(obj, oldB, newB, env) {
        if (!obj || !oldB || !newB || oldB.w < 2 || oldB.h < 2) return;
        const sx = newB.w / oldB.w;
        const sy = newB.h / oldB.h;
        const mapX = (vx) => Math.round((newB.x + (vx - oldB.x) * sx) * 10) / 10;
        const mapY = (vy) => Math.round((newB.y + (vy - oldB.y) * sy) * 10) / 10;

        if (Array.isArray(obj.pts)) {
            obj.pts = obj.pts.map(p => Array.isArray(p) ? [mapX(p[0]), mapY(p[1])] : { x: mapX(p.x), y: mapY(p.y) });
        } else if (typeof obj.x1 === 'number') {
            obj.x1 = mapX(obj.x1); obj.y1 = mapY(obj.y1);
            obj.x2 = mapX(obj.x2); obj.y2 = mapY(obj.y2);
        } else if (typeof obj.x === 'number') {
            if (Array.isArray(obj.origin)) {
                ['origin', 'hEnd', 'vEnd', 'sq1', 'sqCorner', 'sq2', 'dot', 'baseEnd', 'rayEnd', 'labelPos'].forEach(k => {
                    if (Array.isArray(obj[k])) {
                        obj[k] = [mapX(obj[k][0]), mapY(obj[k][1])];
                    }
                });
            }
            obj.x = Math.round(newB.x * 10) / 10;
            obj.y = Math.round(newB.y * 10) / 10;
            obj.w = Math.max(24, Math.round(newB.w * 10) / 10);
            obj.h = Math.max(20, Math.round(newB.h * 10) / 10);
            if (Array.isArray(obj.origin)) {
                obj.baseW = obj.w;
                obj.baseH = obj.h;
            }
            if ((obj.t === 'text') && typeof obj.fontSize === 'number') {
                obj.fontSize = Math.max(12, Math.round(obj.fontSize * Math.min(sx, sy)));
            }
        }
        if (obj.coordSpace === 'pdf_norm' && hasValidPdfBox(env)) {
            attachNormalizedPdfFields(obj, env);
        }
    }

    function drawSelectionOverlay(tCtx, b) {
        if (!tCtx || !b) return;
        tCtx.save();
        tCtx.strokeStyle = '#2563eb';
        tCtx.lineWidth = 1.8;
        tCtx.setLineDash([5, 4]);
        tCtx.strokeRect(b.x, b.y, b.w, b.h);
        tCtx.setLineDash([]);

        // Corner resize handles
        const corners = [
            [b.x, b.y], [b.x + b.w, b.y],
            [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]
        ];
        corners.forEach(([hx, hy]) => {
            tCtx.fillStyle = '#ffffff';
            tCtx.strokeStyle = '#2563eb';
            tCtx.lineWidth = 2;
            tCtx.beginPath();
            tCtx.arc(hx, hy, 5.5, 0, Math.PI * 2);
            tCtx.fill();
            tCtx.stroke();
        });

        // Duplicate pill (x: b.x + b.w - 44, y: b.y - 16)
        const dupX = b.x + b.w - 44;
        const delX = b.x + b.w - 14;
        const barY = b.y - 16;

        tCtx.fillStyle = '#0284c7';
        tCtx.beginPath(); tCtx.arc(dupX, barY, 11, 0, Math.PI * 2); tCtx.fill();
        tCtx.fillStyle = '#ffffff';
        tCtx.font = 'bold 11px sans-serif';
        tCtx.textAlign = 'center';
        tCtx.textBaseline = 'middle';
        tCtx.fillText('⧉', dupX, barY);

        tCtx.fillStyle = '#dc2626';
        tCtx.beginPath(); tCtx.arc(delX, barY, 11, 0, Math.PI * 2); tCtx.fill();
        tCtx.fillStyle = '#ffffff';
        tCtx.fillText('✕', delX, barY);

        tCtx.restore();
    }

    window.WbVectorEngine = {
        uid,
        hasValidPdfBox,
        getPdfOrigin,
        toPdfNorm,
        fromPdfNorm,
        attachNormalizedPdfFields,
        drawShape,
        drawVectorObject,
        getObjectBounds,
        hitTestObjects,
        hitTestSelectionHandle,
        moveVectorObject,
        translateObject: moveVectorObject,
        scaleObjectToBounds,
        drawSelectionOverlay
    };
})(window);
