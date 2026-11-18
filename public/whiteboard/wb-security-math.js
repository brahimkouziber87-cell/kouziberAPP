/**
 * ============================================================================
 * وحدة الأمان وتقييم التعابير الرياضية وبيانات الملف المهني للسبورة التفاعلية
 * Whiteboard Security Helpers, Zero-Eval Math Parser & Profile Accessors
 * ============================================================================
 */
(function (window) {
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

    /**
     * تحليل وتقييم دالة رياضية بدلالة المتغير x بأمان تام (بدون eval أو new Function)
     * يدعم: + - * / ^ والأقواس والضرب الضمني (2x, 3(x+1), xsin(x)) والدوال: sin, cos, tan, ln, log, sqrt, abs, exp
     */
    function evaluateMathWithX(rawExpr, xVal, useDegrees) {
        if (rawExpr === null || rawExpr === undefined) return NaN;
        const normalized = String(rawExpr)
            .replace(/×/g, '*')
            .replace(/÷/g, '/')
            .replace(/−/g, '-')
            .replace(/π/g, 'pi')
            .replace(/√/g, 'sqrt')
            .replace(/\s+/g, '')
            .trim();

        if (!normalized || normalized.length > 220) return NaN;

        const rawTokens = [];
        let i = 0;
        while (i < normalized.length) {
            const ch = normalized[i];
            if (/[0-9.]/.test(ch)) {
                let numStr = '';
                let dotCount = 0;
                while (i < normalized.length && /[0-9.]/.test(normalized[i])) {
                    if (normalized[i] === '.') dotCount++;
                    if (dotCount > 1) return NaN;
                    numStr += normalized[i++];
                }
                const val = parseFloat(numStr);
                if (isNaN(val)) return NaN;
                rawTokens.push({ type: 'num', value: val });
                continue;
            }
            if (/[a-zA-Z]/.test(ch)) {
                let id = '';
                while (i < normalized.length && /[a-zA-Z]/.test(normalized[i])) {
                    id += normalized[i++];
                }
                const lower = id.toLowerCase();
                if (lower === 'x') {
                    rawTokens.push({ type: 'num', value: Number(xVal) });
                } else if (lower === 'pi') {
                    rawTokens.push({ type: 'num', value: Math.PI });
                } else if (lower === 'e') {
                    rawTokens.push({ type: 'num', value: Math.E });
                } else if (['sin', 'cos', 'tan', 'ln', 'log', 'sqrt', 'abs', 'exp'].includes(lower)) {
                    rawTokens.push({ type: 'fn', value: lower });
                } else {
                    return NaN;
                }
                continue;
            }
            if ('+-*/^()'.includes(ch)) {
                rawTokens.push({
                    type: (ch === '(' || ch === ')') ? 'paren' : 'op',
                    value: ch
                });
                i++;
                continue;
            }
            return NaN;
        }

        // إدراج الضرب الضمني بين: رقم ومتغير/دالة/قوس مفتوح، أو قوس مغلق ورقم/متغير/دالة/قوس مفتوح
        const tokens = [];
        for (let k = 0; k < rawTokens.length; k++) {
            const cur = rawTokens[k];
            const prev = tokens[tokens.length - 1];
            if (prev) {
                const prevIsVal = prev.type === 'num' || (prev.type === 'paren' && prev.value === ')');
                const curStartsVal = cur.type === 'num' || cur.type === 'fn' || (cur.type === 'paren' && cur.value === '(');
                if (prevIsVal && curStartsVal) {
                    tokens.push({ type: 'op', value: '*' });
                }
            }
            tokens.push(cur);
        }

        let pos = 0;
        const peek = () => tokens[pos] || null;
        const consume = () => tokens[pos++];

        function parseExpression() {
            let left = parseTerm();
            while (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
                const op = consume().value;
                const right = parseTerm();
                left = op === '+' ? left + right : left - right;
            }
            return left;
        }

        function parseTerm() {
            let left = parsePower();
            while (peek() && peek().type === 'op' && (peek().value === '*' || peek().value === '/')) {
                const op = consume().value;
                const right = parsePower();
                if (op === '*') {
                    left = left * right;
                } else {
                    left = Math.abs(right) < 1e-12 ? NaN : left / right;
                }
            }
            return left;
        }

        function parsePower() {
            const base = parseUnary();
            if (peek() && peek().type === 'op' && peek().value === '^') {
                consume();
                const exp = parsePower();
                return Math.pow(base, exp);
            }
            return base;
        }

        function parseUnary() {
            if (peek() && peek().type === 'op' && peek().value === '-') {
                consume();
                return -parseUnary();
            }
            if (peek() && peek().type === 'op' && peek().value === '+') {
                consume();
                return parseUnary();
            }
            return parsePrimary();
        }

        function parsePrimary() {
            const tok = peek();
            if (!tok) return NaN;
            if (tok.type === 'num') {
                consume();
                return tok.value;
            }
            if (tok.type === 'fn') {
                const fnName = consume().value;
                if (!peek() || peek().value !== '(') return NaN;
                consume();
                const arg = parseExpression();
                if (!peek() || peek().value !== ')') return NaN;
                consume();
                const angleVal = useDegrees ? (arg * Math.PI) / 180 : arg;
                switch (fnName) {
                    case 'sin': return Math.sin(angleVal);
                    case 'cos': return Math.cos(angleVal);
                    case 'tan': return Math.tan(angleVal);
                    case 'ln': return arg > 0 ? Math.log(arg) : NaN;
                    case 'log': return arg > 0 ? (Math.log10 ? Math.log10(arg) : Math.log(arg) / Math.LN10) : NaN;
                    case 'sqrt': return arg >= 0 ? Math.sqrt(arg) : NaN;
                    case 'abs': return Math.abs(arg);
                    case 'exp': return Math.exp(arg);
                    default: return NaN;
                }
            }
            if (tok.type === 'paren' && tok.value === '(') {
                consume();
                const val = parseExpression();
                if (!peek() || peek().value !== ')') return NaN;
                consume();
                return val;
            }
            return NaN;
        }

        const result = parseExpression();
        if (pos !== tokens.length) return NaN;
        return (typeof result === 'number' && isFinite(result)) ? result : NaN;
    }

    function getAcademicYearLabel() {
        const db = window.db || {};
        if (db.academicYear) return String(db.academicYear);
        if (db.teacherProfile && db.teacherProfile.academicYear) return String(db.teacherProfile.academicYear);
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth() + 1;
        return m >= 9 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
    }

    function getTeacherProfile() {
        const db = window.db || {};
        const tp = db.teacherProfile || db.teacher || {};
        return {
            name: tp.name || tp.fullName || 'الأستاذ(ة)',
            school: tp.school || tp.schoolName || tp.institution || 'الثانوية التأهيلية',
            directorate: tp.directorate || 'المديرية الإقليمية للتربية والتكوين',
            academy: tp.academy || 'الأكاديمية الجهوية للتربية والتكوين',
            specialty: tp.specialty || 'مادة الرياضيات - السلك الثانوي التأهيلي',
            academicYear: getAcademicYearLabel()
        };
    }

    function sanitizeRoomCode(raw) {
        const cleaned = String(raw || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
        return cleaned || 'MATH-BAC-2026';
    }

    function solveQuadraticAnalytical(aNum, bNum, cNum) {
        if (isNaN(aNum) || isNaN(bNum) || isNaN(cNum)) return null;
        const fmt = (n) => Math.round(n * 10000) / 10000;
        if (Math.abs(aNum) < 1e-12) {
            if (Math.abs(bNum) < 1e-12) {
                return { type: 'deg0', summary: cNum === 0 ? 'عدد غير منتهٍ من الحلول (0 = 0)' : 'لا يوجد حل (معادلة مستحيلة)' };
            }
            const x = fmt(-cNum / bNum);
            return {
                type: 'deg1',
                x,
                summary: `معادلة من الدرجة الأولى: x = ${x}`,
                stampTitle: `📐 حل المعادلة: ${bNum}x + (${cNum}) = 0`,
                stampBody: `بما أن a = 0 فإن المعادلة من الدرجة الأولى:\nx = -c / b = ${x}\nمجموعة الحلول: S = { ${x} }`
            };
        }
        const delta = fmt(bNum * bNum - 4 * aNum * cNum);
        const eqStr = `${aNum}x² ${bNum >= 0 ? '+ ' + bNum : '- ' + Math.abs(bNum)}x ${cNum >= 0 ? '+ ' + cNum : '- ' + Math.abs(cNum)} = 0`;
        if (delta > 0) {
            const sqrtD = Math.sqrt(delta);
            const x1 = fmt((-bNum - sqrtD) / (2 * aNum));
            const x2 = fmt((-bNum + sqrtD) / (2 * aNum));
            return {
                type: 'real2',
                delta,
                x1,
                x2,
                summary: `Δ = ${delta} > 0  ⇒  x₁ = ${x1}  ,  x₂ = ${x2}`,
                subSummary: `التعميل: ${aNum}(x - ${x1})(x - ${x2})`,
                stampTitle: `📐 حل المعادلة: ${eqStr}`,
                stampBody: `• المميز: Δ = b² - 4ac = (${bNum})² - 4(${aNum})(${cNum}) = ${delta} > 0\n• للمعادلة حلان حقيقيان مختلفان:\n  x₁ = (-b - √Δ)/(2a) = ${x1}   و   x₂ = (-b + √Δ)/(2a) = ${x2}\n• S_ℝ = { ${x1} ; ${x2} }`
            };
        } else if (Math.abs(delta) < 1e-12) {
            const x0 = fmt(-bNum / (2 * aNum));
            return {
                type: 'real1',
                delta: 0,
                x0,
                summary: `Δ = 0  ⇒  حل مزدوج x₀ = ${x0}`,
                subSummary: `التعميل: ${aNum}(x - ${x0})²`,
                stampTitle: `📐 حل المعادلة: ${eqStr}`,
                stampBody: `• المميز: Δ = b² - 4ac = 0\n• للمعادلة حل حقيقي مزدوج:\n  x₀ = -b / (2a) = ${x0}\n• S_ℝ = { ${x0} }`
            };
        } else {
            const re = fmt(-bNum / (2 * aNum));
            const im = fmt(Math.sqrt(Math.abs(delta)) / Math.abs(2 * aNum));
            return {
                type: 'complex2',
                delta,
                re,
                im,
                summary: `Δ = ${delta} < 0 ⇒ لا حل في ℝ (حلان عقديان في ℂ)`,
                subSummary: `في ℂ: z₁ = ${re} - ${im}i  ,  z₂ = ${re} + ${im}i`,
                stampTitle: `📐 حل المعادلة في ℝ و ℂ: ${eqStr}`,
                stampBody: `• المميز: Δ = b² - 4ac = ${delta} < 0\n• في ℝ: S_ℝ = ∅ (إشارة ثلاثية الحدود هي إشارة a = ${aNum})\n• في ℂ (حلان عقديان مترافقان):\n  z₁ = ${re} - ${im}i   و   z₂ = ${re} + ${im}i`
            };
        }
    }

    function solveLinearSystem2x2(a1, b1, c1, a2, b2, c2) {
        if ([a1, b1, c1, a2, b2, c2].some((v) => isNaN(v))) return null;
        const fmt = (n) => Math.round(n * 10000) / 10000;
        const D = fmt(a1 * b2 - a2 * b1);
        const Dx = fmt(c1 * b2 - c2 * b1);
        const Dy = fmt(a1 * c2 - a2 * c1);
        if (Math.abs(D) > 1e-12) {
            const x = fmt(Dx / D);
            const y = fmt(Dy / D);
            return {
                ok: true,
                D, Dx, Dy, x, y,
                summary: `Δ = ${D} ≠ 0  ⇒  (x , y) = (${x} , ${y})`,
                subSummary: `Δₓ = ${Dx}  |  Δᵧ = ${Dy}`,
                stampTitle: `⚖️ حل النظمة بطريقة المحددات (كرامر)`,
                stampBody: `• محددة النظمة: Δ = (${a1})(${b2}) - (${a2})(${b1}) = ${D} ≠ 0\n• Δₓ = ${Dx}   و   Δᵧ = ${Dy}\n• إذن للنظمة حل وحيد:\n  x = Δₓ/Δ = ${x}   و   y = Δᵧ/Δ = ${y}\n• S = { (${x} ; ${y}) }`
            };
        }
        return {
            ok: false,
            D: 0, Dx, Dy,
            summary: (Math.abs(Dx) < 1e-12 && Math.abs(Dy) < 1e-12)
                ? 'Δ = 0 و Δₓ = Δᵧ = 0 ⇒ ما لا نهاية من الحلول'
                : 'Δ = 0 و (Δₓ ≠ 0 أو Δᵧ ≠ 0) ⇒ النظمة ليس لها حل (S = ∅)',
            subSummary: `Δ = 0  |  Δₓ = ${Dx}  |  Δᵧ = ${Dy}`,
            stampTitle: `⚖️ دراسة النظمة (Δ = 0)`,
            stampBody: `• محددة النظمة: Δ = 0 ، Δₓ = ${Dx} ، Δᵧ = ${Dy}`
        };
    }

    window.WbSecurityMath = {
        escapeHtml,
        evaluateMathWithX,
        getTeacherProfile,
        getAcademicYearLabel,
        sanitizeRoomCode,
        solveQuadraticAnalytical,
        solveLinearSystem2x2
    };
})(window);
