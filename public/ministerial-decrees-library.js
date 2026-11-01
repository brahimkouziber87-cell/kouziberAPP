/**
 * ====================================================================
 * دليل المذكرات الوزارية والنصوص التنظيمية لمادة الرياضيات (المحور الثالث)
 * Moroccan Secondary Math - Curated Ministerial Decrees & Legal Hub
 * ====================================================================
 * يتيح للأستاذ تصفح، بحث، ونسخ السند القانوني والتربوي بنقرة زر واحدة
 * للاستشهاد به في تقارير مجالس الأقسام، المراسلات الإدارية، وتبرير القرارات.
 */

(function (window) {
    'use strict';

    const MINISTERIAL_DECREES = [
        {
            id: 'note_142_08',
            number: 'المذكرة الوزارية رقم 142-08',
            date: '04 نونبر 2008',
            title: 'التقويم التربوي بالتعليم الثانوي التأهيلي - مادة الرياضيات',
            category: 'التقويم والمراقبة المستمرة',
            color: '#1e3a8a',
            summary: 'تحدد المذكرة أوزان ومواصفات المراقبة المستمرة لمادة الرياضيات بجميع شعب ومسالك الثانوي التأهيلي، والتأكيد على اعتماد الفروض المحروسة والمنزلية وبرمجة الفروض التعويضية.',
            keyArticles: [
                {
                    title: 'المعدل الدوري للمراقبة المستمرة',
                    text: 'يُحتسب المعدل الدوري للمراقبة المستمرة في مادة الرياضيات حصراً من المعدل الحسابي لنقط الفروض المحروسة المنجزة حضورياً خلال الدورة الدراسية.'
                },
                {
                    title: 'وثيرة وعدد الفروض المحروسة',
                    text: 'يُجرى في كل دورة: 4 فروض محروسة (2س إلى 3س) لشعبة العلوم الرياضية، و3 فروض محروسة (2س) لشعبة العلوم التجريبية والتكنولوجيات والاقتصاد، وفرضان محروسان (1س) لشعبة الآداب والتعليم الأصيل.'
                },
                {
                    title: 'مسطرة الفروض التعويضية (Rattrapage)',
                    text: 'يستفيد التلميذ المتغيب عن فرض محروس بمبرر قانوني مقبول (شهادة طبية أو إذن إداري) من إجراء فرض تعويضي مكافئ تبرمج له إدارة المؤسسة والأستاذ موعداً مناسباً تفادياً لمنحه نقطة الصفر.'
                },
                {
                    title: 'الفروض المنزلية والأنشطة المندمجة',
                    text: 'يُكلَف التلاميذ بثلاثة فروض منزلية على الأقل في كل دورة دراسية، وتُصحح داخل الفصل لترسيخ التعلمات دون احتسابها في معدل مسار المخصص للفروض المحروسة.'
                }
            ]
        },
        {
            id: 'note_cahier_textes',
            number: 'المذكرة الوزارية رقم 155',
            date: '17 نونبر 2011',
            title: 'العناية بدفاتر النصوص وتدبير الحصص الدراسية',
            category: 'التوثيق الديداكتيكي والتفتيش',
            color: '#059669',
            summary: 'تنظيم مسك وتدوين دفتر النصوص بانتظام وتوقيعه والتأشير عليه من طرف الأستاذ وإدارة المؤسسة والمفتش التربوي.',
            keyArticles: [
                {
                    title: 'إلزامية ومصداقية دفتر النصوص',
                    text: 'دفتر النصوص وثيقة رسمية تعكس السيرورة البيداغوجية المنجزة فعلياً داخل الفصل، ويجب تدوين تاريخ كل حصة، عنوان الدرس، المحاور، الأنشطة المنجزة، والواجبات المنزلية بدقة تامة.'
                },
                {
                    title: 'التأشير الإداري والتأطير التربوي',
                    text: 'يخضع دفتر النصوص للتأشير الدوري من طرف رئيس المؤسسة (المدير / الناظر) وتأشيرة المفتش التربوي أثناء الزيارات الصفية للتأكد من احترام التوزيع السنوي الرسمي.'
                }
            ]
        },
        {
            id: 'note_absence_discipline',
            number: 'المذكرة الوزارية رقم 43',
            date: '22 مارس 2006',
            title: 'تنظيم المراقبة التربوية وتتبع الغياب والمواظبة بالثانوي التأهيلي',
            category: 'المواظبة والانضباط',
            color: '#be123c',
            summary: 'إجراءات رصد وضبط الغياب غير المبرر، إشعار أولياء الأمور، ومسطرة الإحالة على مجالس الانضباط وتوجيه الإنذارات.',
            keyArticles: [
                {
                    title: 'التوثيق الفوري في ورقة الغياب',
                    text: 'يلتزم الأستاذ بتسجيل المتغيبين والمتأخرين بدقة في ورقة الغياب عند بداية كل حصة دراسية وتسليمها فوراً لإدارة الحراسة العامة.'
                },
                {
                    title: 'عتبات الإنذار بالغياب',
                    text: 'تتخذ الإدارة التدابير القانونية عند بلوغ الغياب غير المبرر 10 ساعات فأكثر، مع توجيه إشعارات متدرجة للولي قبل تفعيل قرارات الحرمان أو النقط الصفرية في المواظبة.'
                }
            ]
        },
        {
            id: 'note_councils_orientation',
            number: 'المقرر الوزاري والقرار رقم 2385-06',
            date: '16 أكتوبر 2006',
            title: 'تنظيم مجالس المؤسسة وإجراءات التوجيه وإعادة التوجيه',
            category: 'مجالس الأقسام والتوجيه',
            color: '#7c3aed',
            summary: 'مهام مجالس الأقسام في حصر النتائج الدورية، تحديد قرارات التوجيه، التفييئ، واقتراح خطط الدعم للمتعثرين.',
            keyArticles: [
                {
                    title: 'صلاحيات مجلس القسم',
                    text: 'يجتمع مجلس القسم في نهاية كل دورة دراسية للنظر في نتائج التلاميذ وتحصيلهم الدراسي في مادة الرياضيات وسائر المواد، وتحديد المتفوقين وقرارات الدعم والمواكبة.'
                },
                {
                    title: 'معايير التوجيه نحو شعبة العلوم الرياضية',
                    text: 'يعتمد التوجيه نحو 1 باك أو 2 باك علوم رياضية أساساً على معدل مادة الرياضيات والفيزياء، والقدرة على التجريد والاستدلال المنطقي والاستقرار الإيجابي للأداء الصفي.'
                }
            ]
        }
    ];

    /**
     * نسخ السند القانوني إلى الحافظة بنقرة واحدة
     */
    function copyLegalCitation(decreeNumber, articleTitle, articleText) {
        const citation = `السند القانوني التنظيمي (${decreeNumber} - مادة: ${articleTitle}):\n«${articleText}»`;
        const notify = () => {
            const toastFn = window.showAppToast || window.showToast;
            if (typeof toastFn === 'function') {
                toastFn('📋 تم نسخ السند القانوني للحافظة بنجاح للاستشهاد به في تقاريرك!', 'success');
            }
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(citation).then(notify).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = citation;
                ta.style.cssText = 'position:fixed;left:-9999px;';
                document.body.appendChild(ta);
                ta.select();
                try { document.execCommand('copy'); } catch (e) {}
                document.body.removeChild(ta);
                notify();
            });
        } else {
            const ta = document.createElement('textarea');
            ta.value = citation;
            ta.style.cssText = 'position:fixed;left:-9999px;';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch (e) {}
            document.body.removeChild(ta);
            notify();
        }
    }

    /**
     * بناء محتوى نافذة المذكرات الوزارية
     */
    function buildDecreesContentHTML(filterText = '') {
        const query = (filterText || '').trim().toLowerCase();
        const filtered = MINISTERIAL_DECREES.filter(d => {
            if (!query) return true;
            return d.number.toLowerCase().includes(query) ||
                   d.title.toLowerCase().includes(query) ||
                   d.summary.toLowerCase().includes(query) ||
                   d.keyArticles.some(a => a.title.toLowerCase().includes(query) || a.text.toLowerCase().includes(query));
        });

        if (filtered.length === 0) {
            return '<div style="text-align: center; padding: 40px; color: #64748b;">لا توجد نصوص أو مذكرات مطابقة لبحثك.</div>';
        }

        return filtered.map(d => `
        <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-right: 5px solid ${d.color}; border-radius: 12px; padding: 16px; margin-bottom: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px; margin-bottom: 10px;">
                <div>
                    <span style="background: #f1f5f9; color: ${d.color}; font-weight: 900; font-size: 0.76rem; padding: 3px 10px; border-radius: 6px; border: 1px solid #cbd5e1;">${d.category}</span>
                    <h4 style="margin: 6px 0 2px 0; color: #0f172a; font-size: 1.05rem; font-weight: 900;">${d.number}: ${d.title}</h4>
                    <div style="font-size: 0.74rem; color: #64748b;">تاريخ الصدور الرسمي: ${d.date}</div>
                </div>
            </div>
            <div style="font-size: 0.8rem; color: #334155; line-height: 1.5; margin-bottom: 12px; background: #f8fafc; padding: 10px; border-radius: 8px;">
                ${d.summary}
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px;">
                ${d.keyArticles.map(art => `
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <div style="font-weight: 800; color: ${d.color}; font-size: 0.82rem; margin-bottom: 4px;">📌 ${art.title}</div>
                            <div style="font-size: 0.76rem; color: #475569; line-height: 1.45; margin-bottom: 8px;">${art.text}</div>
                        </div>
                        <button type="button" onclick="window.copyLegalCitation('${d.number}', '${art.title.replace(/'/g, "\\'")}', '${art.text.replace(/'/g, "\\'")}')" style="background: #f8fafc; border: 1px solid #cbd5e1; color: #1e3a8a; padding: 4px 10px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px; align-self: flex-start; transition: all 0.2s;" onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='#f8fafc'">
                            <span>📋 نسخ السند للاستشهاد به</span>
                        </button>
                    </div>
                `).join('')}
            </div>
        </div>
        `).join('');
    }

    /**
     * فتح نافذة دليل المذكرات الوزارية
     */
    function openMinisterialDecreesModal() {
        let modal = document.getElementById('ministerialDecreesLibraryModal');
        if (!modal) {
            modal = createDecreesModalElement();
            document.body.appendChild(modal);
        }

        const container = document.getElementById('decreesModalCardsContainer');
        if (container) {
            container.innerHTML = buildDecreesContentHTML();
        }

        modal.style.display = 'flex';
        if (window.renderLucide) window.renderLucide(modal);
    }

    function closeMinisterialDecreesModal() {
        const modal = document.getElementById('ministerialDecreesLibraryModal');
        if (modal) modal.style.display = 'none';
    }

    function createDecreesModalElement() {
        const m = document.createElement('div');
        m.id = 'ministerialDecreesLibraryModal';
        m.style.cssText = 'display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(5px); z-index: 10080; align-items: center; justify-content: center; padding: 14px;';
        m.onclick = (e) => { if (e.target === m) closeMinisterialDecreesModal(); };

        m.innerHTML = `
        <div class="card" style="width: 100%; max-width: 1050px; max-height: 92vh; display: flex; flex-direction: column; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);">
            <div style="padding: 14px 20px; border-bottom: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 9px; background: linear-gradient(135deg, #1e3a8a, #4338ca); color: #fff;">
                        <span data-lucide="scale" data-size="20"></span>
                    </span>
                    <div>
                        <h3 style="margin: 0; font-size: 1.1rem; font-weight: 900; color: #0f172a;">دليل المذكرات والنصوص التنظيمية الوزارية (مادة الرياضيات)</h3>
                        <div style="font-size: 0.76rem; color: #64748b; font-weight: 600;">المرجعيات القانونية والديداكتيكية الرسمية للمراقبة المستمرة، دفاتر النصوص، ومجالس الأقسام</div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="text" id="decreesSearchInput" placeholder="بحث سريع في المذكرات والمواد..." oninput="window.onDecreesSearch(this.value)" style="padding: 7px 14px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-size: 0.82rem; outline: none; width: 220px;">
                    <button type="button" onclick="window.closeMinisterialDecreesModal()" style="background: #f1f5f9; border: none; color: #64748b; width: 32px; height: 32px; border-radius: 8px; font-size: 1.2rem; cursor: pointer;">✕</button>
                </div>
            </div>
            <div id="decreesModalCardsContainer" style="flex: 1; overflow-y: auto; padding: 20px; background: #f8fafc;"></div>
        </div>
        `;
        return m;
    }

    window.onDecreesSearch = function (val) {
        const container = document.getElementById('decreesModalCardsContainer');
        if (container) {
            container.innerHTML = buildDecreesContentHTML(val);
        }
    };

    window.copyLegalCitation = copyLegalCitation;
    window.openMinisterialDecreesModal = openMinisterialDecreesModal;
    window.closeMinisterialDecreesModal = closeMinisterialDecreesModal;

})(window);
