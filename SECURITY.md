# سياسة الأمان — Security Policy

## الإبلاغ عن ثغرة / Reporting a vulnerability

إن وجدت ثغرة أمنية، لا تفتح Issue عاماً. أرسل التفاصيل إلى مالك المستودع عبر GitHub
(Security → Report a vulnerability) أو بالبريد الإلكتروني المذكور في ملف `package.json`.

## نموذج التهديد / Threat model

مفتاح Firebase للويب (`firebase-applet-config.json`) **عام بطبيعته** — يُرسَل إلى المتصفح
مع كل تطبيق ويب. لذلك لا يمكن الاعتماد عليه كحدّ أمني. الحدود الأمنية الحقيقية هي:

1. **قواعد Firestore** (`firestore.rules`) — تمنع الوصول غير المُصادَق.
2. **تقييد مفتاح API** في Google Cloud — يمنع استخدام المفتاح من نطاقات أخرى.
3. **App Check** — يمنع أي عميل ليس نسخة أصلية من التطبيق.

## إعداد إلزامي قبل النشر / Required production setup

### 1. تقييد مفتاح Firebase API

1. افتح [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials?project=gen-lang-client-0761614487)
2. اختر المفتاح المستخدم في `firebase-applet-config.json` (يبدأ بـ `AIza…`)
3. **Application restrictions** → `Websites` → أضف النطاقات المسموحة فقط:
   ```
   https://<نطاقك>/*
   https://<نطاقك>
   http://localhost:3000/*
   http://127.0.0.1:3000/*
   ```
4. **API restrictions** → `Restrict key` → اختر فقط:
   - Cloud Firestore API
   - Identity Toolkit API
   - Token Service API
5. احفظ. أي طلب من نطاق غير مسموح سيُرفض بـ `403`.

### 2. تفعيل App Check

1. [Firebase Console → App Check](https://console.firebase.google.com/project/gen-lang-client-0761614487/appcheck)
2. اختر تطبيق الويب → **reCAPTCHA Enterprise** (أو v3)
3. أنشئ مفتاحاً من [reCAPTCHA admin](https://www.google.com/recaptcha/admin) للنطاقات نفسها
4. أضف التهيئة في `public/firebase-setup.js` بعد `initializeApp`:
   ```js
   import { initializeAppCheck, ReCaptchaEnterpriseProvider } from
     'https://www.gstatic.com/firebasejs/10.9.0/firebase-app-check.js';

   initializeAppCheck(app, {
     provider: new ReCaptchaEnterpriseProvider('<RECAPTCHA_SITE_KEY>'),
     isTokenAutoRefreshEnabled: true
   });
   ```
5. فعّل **Enforcement** لـ Cloud Firestore في لوحة App Check.

> أثناء الاختبار المحلي أضف `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;` قبل التهيئة
> وسجّل رمز التصحيح الظاهر في وحدة التحكم.

### 3. تفعيل Firestore ونشر القواعد

```sh
firebase login
firebase use gen-lang-client-0761614487
firebase deploy --only firestore:rules
```

### 4. أسرار الخادم

| المتغيّر | إلزامي | الوصف |
|---|---|---|
| `GEMINI_API_KEY` | نعم | مفتاح Gemini — لا يوضع في الكود أبداً |
| `SHARE_SECRET` | نعم في الإنتاج | سرّ ≥ 32 حرفاً لتشفير روابط المشاركة. إن غاب يُولَّد ويُحفظ في `data/.share-secret` |
| `HOST` | لا | `127.0.0.1` افتراضياً. استخدم `0.0.0.0` فقط خلف وكيل عكسي |
| `PORT` | لا | `3000` افتراضياً |

> ⚠️ تغيير `SHARE_SECRET` يُبطل كل روابط المشاركة المُنشأة سابقاً.

## ما تم إصلاحه / Hardening already applied

- إزالة مفتاح التشفير الثابت من الكود (كان منشوراً علناً).
- قواعد Firestore تتطلب جلسة موثّقة وبريداً مُتحقَّقاً مطابقاً لمالك المستند.
- مقارنة PIN ثابتة الزمن + قفل بعد 5 محاولات.
- حدود معدّل الطلبات على نقاط AI وiCal والمشاركة.
- حارس الأصل (Origin) على نقاط الكتابة.
- الخادم يستمع على `127.0.0.1` افتراضياً.
- ترويسات أمان + إخفاء `X-Powered-By`.
- رفض نوافذ Electron غير http(s) ومنع التنقّل خارج الأصل.

## مخاطر متبقية / Known residual risks

- **لا توجد مصادقة مستخدم على خادم Express.** أي شخص يصل إلى المنفذ يستطيع استدعاء
  نقاط API. الحماية الحالية تعتمد على الربط المحلي وحدود المعدّل. عند النشر العام
  يجب إضافة طبقة مصادقة (Reverse proxy + OAuth أو جلسات موقّعة).
- **لا توجد سياسة CSP** لأن التطبيق يعتمد على سكربتات مضمّنة وCDN خارجية. إضافتها
  تتطلب إعادة هيكلة `index.html`.
- **مخازن المشاركة والـ iCal في الذاكرة** — تُفقد عند إعادة التشغيل، وهي غير مشتركة
  بين نسخ متعددة من الخادم.
