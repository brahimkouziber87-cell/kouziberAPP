import React, { useState, useEffect, useMemo } from 'react';
import {
  Compass,
  FileCheck,
  Printer,
  GraduationCap,
  Award,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Users,
  BookOpen,
  Target,
  Sparkles,
  Scale,
  ClipboardCheck,
  Layers,
  ShieldAlert,
  ArrowUpRight,
  Search,
  Building2,
  Briefcase,
  Lightbulb
} from 'lucide-react';
import { StudentMetric } from './Analysis';

export interface PedagogicalCouncilOrientationViewProps {
  db: any;
  selectedClass: string;
  semester: 's1' | 's2';
  studentMetrics: StudentMetric[];
  classAverages: {
    overall: number | null;
    f1: number | null;
    f2: number | null;
    f3: number | null;
    f4?: number | null;
    testedCount?: number;
    passPct?: number;
    median?: number | null;
    stdDev?: number | null;
    minMark?: number | null;
    maxMark?: number | null;
  };
  initialSection?: 'council_digest' | 'diagnostic_toolkit' | 'orientation_hub';
}

interface DiagnosticBlueprint {
  code: string;
  levelTitle: string;
  targetCycle: string;
  duration: string;
  prerequisites: {
    domain: string;
    weightPct: number;
    skills: string[];
    epistemologicalObstacles: string;
    remediationActivity: string;
  }[];
  sampleQuestions: {
    num: number;
    domain: string;
    points: number;
    questionText: string;
    expectedCompetency: string;
  }[];
}

const DIAGNOSTIC_BLUEPRINTS: Record<string, DiagnosticBlueprint> = {
  'TCS': {
    code: 'TCS',
    levelTitle: 'الجذع المشترك العلمي والتكنولوجي (TCS / TCT)',
    targetCycle: 'الانتقال من السلك الإعدادي إلى السلك الثانوي التأهيلي',
    duration: 'ساعة واحدة (60 دقيقة)',
    prerequisites: [
      {
        domain: 'الحساب العددي، القوى، والجذور المربعة والمتطابقات الهامة',
        weightPct: 35,
        skills: ['تبسيط التعابير الجبرية والجذور المربعة', 'النشر والتعميل بالمتطابقات الهامة', 'قواعد القوى في IR'],
        epistemologicalObstacles: 'الخلط الشائع في توزيع الجذر المربع على الجمع √(a+b) ≠ √a + √b وأخطاء الإشارات عند النشر.',
        remediationActivity: 'بطاقات تمارين علاجية سريعة حول التعميل وإزالة الجذر من المقام ومقارنة الأعداد الحقيقية.'
      },
      {
        domain: 'المعادلات والمتراجحات والنظمات من الدرجة الأولى',
        weightPct: 25,
        skills: ['حل معادلات تؤول في حلها إلى الدرجة الأولى', 'حل متراجحات وتمثيل الحلول على مستقيم مدرج', 'حل نظمة معادلتين خطيتين'],
        epistemologicalObstacles: 'عدم قلب رمز المتفاوتة عند الضرب أو القسمة في عدد سالب، وصعوبة ترييض المسائل.',
        remediationActivity: 'ورشة عمل موجهة حول جدول الإشارات وتأطير التعابير الجبرية.'
      },
      {
        domain: 'الهندسة المستوية: مبرهنة طاليس، فيثاغورس، والحساب المثلثي',
        weightPct: 25,
        skills: ['تطبيق مبرهنة فيثاغورس وطاليس المباشرة والعكسية', 'حساب النسب المثلثية في مثلث قائم الزاوية', 'الإزاحة ومجموع متجهتين (علاقة شال)'],
        epistemologicalObstacles: 'ضعف التمييز بين شروط المبرهنة المباشرة والعكسية، وصعوبة تفكيك المتجهات بعلاقة شال.',
        remediationActivity: 'أنشطة هندسية تطبيقية لربط الحساب المتجهي باستقامية النقط وتوازي المستقيمات.'
      },
      {
        domain: 'الدوال الخطية والتآلفية والمعلم في المستوى',
        weightPct: 15,
        skills: ['تحديد معامل دالة خطية أو تآلفية وتمثيلها المبياني', 'حساب إحداثيتي متجهة ومنتصف قطعة والمسافة بين نقطتين'],
        epistemologicalObstacles: 'الخلط بين الأفصول والأرتوب في قراءة المعلم، وصعوبة استخراج المعامل الموجه لمستقيم.',
        remediationActivity: 'تمارين قراءة مبيانية وتمثيل المستقيمات استعداداً لدرس المستقيم في المستوى.'
      }
    ],
    sampleQuestions: [
      {
        num: 1,
        domain: 'الحساب العددي والجذور',
        points: 6,
        questionText: 'بسط الأعداد التالية: A = 3√20 - √45 + √5  و  B = (2√3 - 1)² + (2√3 + 1)(2√3 - 1)، ثم عمل التعبير: E(x) = (2x - 3)² - 16.',
        expectedCompetency: 'التحكم في قواعد الجذور المربعة والمتطابقات الهامة الثلاث.'
      },
      {
        num: 2,
        domain: 'المعادلات والمتراجحات والترتيب',
        points: 5,
        questionText: 'حل في IR المعادلة: (2x - 3)(x + 4) = 0، ثم المتراجحة: -3x + 7 ≤ 2x - 8 ومثل مجموعة حلولها على مستقيم مدرج.',
        expectedCompetency: 'التحكم في معادلة الجداء المنعدم وقواعد الترتيب والمتفاوتات.'
      },
      {
        num: 3,
        domain: 'الهندسة المستوية والحساب المتجهي',
        points: 5,
        questionText: 'ليكن ABC مثلثاً و I منتصف [BC]. بسط المتجهة: u = AB + AC - 2AI، ثم استنتج وضع النقط عند إنشاء صورة نقطة بإزاحة.',
        expectedCompetency: 'توظيف علاقة شال وخاصية منتصف قطعة متجهياً.'
      },
      {
        num: 4,
        domain: 'المعلم في المستوى والدوال',
        points: 4,
        questionText: 'في معلم متعامد ممنظم (O,I,J)، نعتبر النقطتين A(1, 2) و B(-3, 4). حدد إحداثيتي المتجهة AB، المسافة AB، ومعادلة المستقيم (AB).',
        expectedCompetency: 'الربط بين الهندسة التحليلية والدوال التآلفية.'
      }
    ]
  },
  '1BAC_EXP': {
    code: '1BAC_EXP',
    levelTitle: 'الأولى باكالوريا علوم تجريبية وتكنولوجية (1BAC EXP / STE / STM)',
    targetCycle: 'الانتقال من الجذع المشترك العلمي إلى السنة الأولى باكالوريا',
    duration: 'ساعة واحدة (60 دقيقة)',
    prerequisites: [
      {
        domain: 'الترتيب في IR، القيمة المطلقة، والمعادلات والمتراجحات من الدرجة الثانية',
        weightPct: 30,
        skills: ['حساب المميز Δ وحل معادلات ومتراجحات الدرجة الثانية', 'التأطير وخصائص القيمة المطلقة والمجالات', 'تعميل ثلاثية الحدود ax²+bx+c'],
        epistemologicalObstacles: 'نسيان دراسة إشارة a خارج الجذرين وداخل الجذرين في جدول إشارة ثلاثية الحدود.',
        remediationActivity: 'حصة دعم مركزة حول إشارة ثلاثية الحدود وتطبيقاتها في تحديد مجموعة تعريف الدوال.'
      },
      {
        domain: 'عموميات حول الدوال العددية وقراءة التمثيلات المبيانية',
        weightPct: 35,
        skills: ['تحديد مجموعة تعريف دالة عددية', 'دراسة زوجية دالة ورتابتها ومعدل التغير', 'التمثيل المبياني للدوال المرجعية (الجمجمة والقطع المكافئ)'],
        epistemologicalObstacles: 'صعوبة الانتقال من التعبير الجبري للدالة إلى التأويل الهندسي والرتابة على مجالات منفصلة.',
        remediationActivity: 'بطاقة منهجية لدراسة تغيرات دالة وبناء جدول التغيرات استعداداً لدرس النهايات والاشتقاق.'
      },
      {
        domain: 'الحساب المثلثي والجداء السلمي في المستوى',
        weightPct: 20,
        skills: ['الأفصول المنحني الرئيسي والنسب المثلثية الاعتيادية', 'حساب الجداء السلمي وتطبيقات مبرهنة الكاشي', 'معادلة مستقيم في المستوى'],
        epistemologicalObstacles: 'عدم ضبط الدائرة المثلثية والتحويل بين الزوايا المرتبطة (π-x, π+x, π/2-x).',
        remediationActivity: 'تذكير تفاعلي بالدائرة المثلثية وصيغ الجداء السلمي التحليلية.'
      },
      {
        domain: 'الاستدلال الرياضي والبرهان',
        weightPct: 15,
        skills: ['صياغة الاستلزام والتكافؤ السليمين', 'توظيف المثال المضاد لنفي عبارة رياضية'],
        epistemologicalObstacles: 'الاستخدام العشوائي لرمز التكافؤ (⇔) بدل الاستلزام (⇒) أثناء حل المعادلات.',
        remediationActivity: 'مدخل تطبيقي مباشر لدرس مبادئ في المنطق الرياضي.'
      }
    ],
    sampleQuestions: [
      {
        num: 1,
        domain: 'ثلاثية الحدود والمتراجحات',
        points: 6,
        questionText: 'حل في IR المعادلة: 2x² - 5x + 2 = 0، ثم استنتج جدول إشارة P(x) = 2x² - 5x + 2 وحلول المتراجحة P(x) ≥ 0.',
        expectedCompetency: 'التمكن من المميز Δ وتعميل ثلاثية الحدود ودراسة إشارتها.'
      },
      {
        num: 2,
        domain: 'عموميات حول الدوال العددية',
        points: 7,
        questionText: 'نعتبر الدالة f المعرفة بـ: f(x) = (x + 1)/(x - 2). حدد Df، وادرس رتابة الدالة f على كل من المجالين ]-∞, 2[ و ]2, +∞[.',
        expectedCompetency: 'تحديد مجموعة التعريف ودراسة الرتابة لمخطط الهذلول.'
      },
      {
        num: 3,
        domain: 'الحساب المثلثي',
        points: 4,
        questionText: 'حدد الأفصول المنحني الرئيسي للعدد 17π/4، ثم حل في المجال [-π, π] المعادلة: 2cos(x) - √3 = 0.',
        expectedCompetency: 'استثمار الدائرة المثلثية وحل المعادلات المثلثية الأساسية.'
      },
      {
        num: 4,
        domain: 'الهندسة التحليلية والجداء السلمي',
        points: 3,
        questionText: 'في معلم متعامد ممنظم، نعتبر A(1,2) و B(3,-1) و C(0,4). احسب الجداء السلمي AB.AC واستنتج طبيعة الزاوية BAC.',
        expectedCompetency: 'توظيف الصيغة التحليلية للجداء السلمي.'
      }
    ]
  },
  '1BAC_LSH': {
    code: '1BAC_LSH',
    levelTitle: 'الأولى باكالوريا آداب وعلوم إنسانية (1BAC SH / 1BAC LSH)',
    targetCycle: 'الانتقال من الجذع المشترك للآداب والعلوم الإنسانية إلى 1 باك',
    duration: 'ساعة واحدة (60 دقيقة)',
    prerequisites: [
      {
        domain: 'الحساب العددي، التناسبية، والنسب المئوية',
        weightPct: 35,
        skills: ['حساب النسب المئوية والتخفيض والزيادة', 'حل معادلات ومتراجحات من الدرجة الأولى والثانية', 'النظمات الخطية وترييض المسائل'],
        epistemologicalObstacles: 'الخلط بين النسبة المئوية للجزء من الكل وبين الزيادة أو التخفيض المئوي.',
        remediationActivity: 'أنشطة تطبيقية مباشرة مستوحاة من الوضعيات الحياتية والمالية.'
      },
      {
        domain: 'مبادئ التعداد والتنظيم المنطقي',
        weightPct: 30,
        skills: ['المبدأ الأساسي للتعداد (مبدأ الجداء)', 'الترتيبات بتكرار وبدون تكرار والتأليفات C_n^p', 'نمذجة السحب العشوائي للكرات'],
        epistemologicalObstacles: 'صعوبة التمييز بين أهمية الترتيب من عدمه وتكرار العناصر.',
        remediationActivity: 'جدول مقارن تفاعلي للتمييز بين (في آن واحد / بالتتابع وبإحلال / بالتتابع وبدون إحلال).'
      },
      {
        domain: 'عموميات حول الدوال والإحصاء',
        weightPct: 35,
        skills: ['قراءة جداول التغيرات والمنحنيات المبيانية', 'المتتاليات الحسابية والهندسية', 'المتسلسلات الإحصائية والمعدل والمنوال'],
        epistemologicalObstacles: 'الخلط بين أساس المتتالية الحسابية والأساس الهندسي.',
        remediationActivity: 'بطاقات تدريبية للتحقق من طبيعة المتتالية وحساب الحد العام بدلالة n.'
      }
    ],
    sampleQuestions: [
      {
        num: 1,
        domain: 'النسب المئوية والمعادلات',
        points: 7,
        questionText: 'خُفّض ثمن حاسوب بنسبة 15% ليصبح ثمنه الجديد 3825 درهماً. حدد الثمن الأصلي للحاسوب، ثم حل في IR المعادلة: x² - 7x + 12 = 0.',
        expectedCompetency: 'توظيف التناسبية والنسب المئوية وحساب مميز ثلاثية الحدود.'
      },
      {
        num: 2,
        domain: 'مبادئ التعداد',
        points: 6,
        questionText: 'يحتوي صندوق على 4 كرات بيضاء و 3 كرات حمراء. نسحب عشوائياً وفي آن واحد 3 كرات. كم عدد السحبات الممكنة؟ وما عدد السحبات التي تحتوي على كرة حمراء واحدة فقط؟',
        expectedCompetency: 'استعمال التأليفات C_n^p في سحب آني.'
      },
      {
        num: 3,
        domain: 'المتتاليات العددية',
        points: 7,
        questionText: 'نعتبر متتالية حسابية (u_n) حدها الأول u_0 = 3 وأساسها r = 4. احسب u_1 و u_10، ثم احسب المجموع: S = u_0 + u_1 + ... + u_10.',
        expectedCompetency: 'تطبيق صيغة الحد العام ومجموع حدود متتالية حسابية.'
      }
    ]
  },
  '1BAC_SM': {
    code: '1BAC_SM',
    levelTitle: 'الأولى باكالوريا علوم رياضية (1BAC SM)',
    targetCycle: 'الانتقال من الجذع المشترك العلمي نحو شعبة العلوم الرياضية',
    duration: 'ساعتان (120 دقيقة)',
    prerequisites: [
      {
        domain: 'الحساب في IR، القيمة المطلقة، والتأطيرات المتقدمة',
        weightPct: 30,
        skills: ['حل معادلات ومتراجحات بالقيمة المطلقة والجذور المربعة', 'البرهان على المتفاوتات الكلاسيكية', 'الحدوديات والقسمة الإقليدية على x-α'],
        epistemologicalObstacles: 'التسرع في رفع طرفي متراجحة إلى المربع دون التحقق من إشارة الطرفين.',
        remediationActivity: 'تمارين معمقة في التكافؤات المنطقية ومبادئ المنطق الرياضي.'
      },
      {
        domain: 'الدوال العددية والتحويلات الهندسية للمنحنيات',
        weightPct: 35,
        skills: ['تركيب دالتين ورتابة المركب', 'مطاريف دالة عددية والتأويل الهندسي', 'إنشاء منحنيات دوال مرتبطة بدوال مرجعية'],
        epistemologicalObstacles: 'صعوبة تحديد مجموعة تعريف مركب دالتين D(gof) بدقة.',
        remediationActivity: 'أنشطة تمهيدية حول المجموعات والتطبيقات وعموميات حول الدوال.'
      },
      {
        domain: 'الجداء السلمي، التحويلات في المستوى، والحساب المثلثي',
        weightPct: 35,
        skills: ['العلاقات المترية في المثلث (الكاشي، صيغة المساحة)', 'الإزاحة والتحاكي وتأثيرهما على المسافات والمتجهات', 'المعادلات والمتراجحات المثلثية على الدائرة المثلثية'],
        epistemologicalObstacles: 'ضعف توظيف التحويلات الهندسية في إثبات استقامية النقط أو تلاقي المستقيمات.',
        remediationActivity: 'مسائل هندسية تركيبية تمهيداً لدرس المرجح والدوران في المستوى.'
      }
    ],
    sampleQuestions: [
      {
        num: 1,
        domain: 'الحساب في IR والحدوديات',
        points: 6,
        questionText: 'حل في IR المتراجحة: √(x + 2) > x، ثم حدد العددين a و b بحيث تقبل الحدودية P(x) = x³ - ax² + bx - 6 القسمة على (x - 1)(x - 2).',
        expectedCompetency: 'سلامة الاستدلال بالتكافؤات المتتالية والقسمة الإقليدية للحدوديات.'
      },
      {
        num: 2,
        domain: 'الدوال العددية والمركب',
        points: 8,
        questionText: 'لتكن f(x) = x² - 2x + 3 و g(x) = √(x - 1). حدد مجموعة تعريف الدالة h = gof وادرس رتابتها على حيز تعريفها.',
        expectedCompetency: 'التحكم في تركيب الدوال وتحديد رتابة دالة مركبة.'
      },
      {
        num: 3,
        domain: 'الحساب المثلثي والجداء السلمي',
        points: 6,
        questionText: 'حل في [0, 2π[ المتراجحة: 2sin²(x) - sin(x) - 1 ≤ 0، ثم احسب أطوال وزوايا مثلث باستعمال مبرهنة الكاشي.',
        expectedCompetency: 'التمثيل على الدائرة المثلثية وتوظيف العلاقات المترية.'
      }
    ]
  },
  '2BAC_PC': {
    code: '2BAC_PC',
    levelTitle: 'الثانية باكالوريا علوم تجريبية وتكنولوجية (2BAC PC / SVT / STE / STM)',
    targetCycle: 'الانتقال إلى سنة الإشهاد الوطني (البكالوريا العلمية)',
    duration: 'ساعتان (120 دقيقة)',
    prerequisites: [
      {
        domain: 'نهايات الدوال العددية والفروع اللانهائية',
        weightPct: 30,
        skills: ['حساب النهايات عند النقط وعند المحدات اللانهائية', 'إزالة الأشكال غير المحددة (0/0, ∞/∞, +∞-∞)', 'تأويل النهايات هندسياً (المقاربات)'],
        epistemologicalObstacles: 'الخلط بين نهاية دالة جذرية عند ∞ ونهايتها عند عدد حقيقي، وصعوبة المرافق في الجذور.',
        remediationActivity: 'حصة مراجعة مركزة لحساب النهايات كمدخل أساسي لدرس الاتصال على نقطة وعلى مجال.'
      },
      {
        domain: 'الاشتقاق، معادلة المماس، ودراسة الدوال',
        weightPct: 35,
        skills: ['حساب الدوال المشتقة للعمليات والمركب', 'معادلة المماس والتأويل الهندسي للعدد المشتق', 'دراسة إشارة f\'(x) وتحديد جدول التغيرات ونقط الانعطاف'],
        epistemologicalObstacles: 'نسيان مشتقة الدالة الداخليّة في مشتقة (u^n)\' أو (√u)\'، والخلط بين إشارة f(x) وإشارة f\'(x).',
        remediationActivity: 'شبكة القواعد الأساسية للاشتقاق وتمارين دراسة شاملة لدالة عددية.'
      },
      {
        domain: 'المتتاليات العددية والبرهان بالترجع',
        weightPct: 20,
        skills: ['البرهان بالترجع لخاصية مرتبطة بـ n', 'دراسة رتابة متتالية عددية (Un+1 - Un)', 'المتتاليات الحسابية والهندسية (الحد العام والمجموع)'],
        epistemologicalObstacles: 'إغفال التحقق من الأساس أو عدم استثمار افتراض الترجع بطريقة صحيحة في المرحلة الوراثية.',
        remediationActivity: 'تمارين تطبيقية مهيكلة في المتتاليات الترجعية والمتتاليات الهندسية المساعدة.'
      },
      {
        domain: 'الجداء السلمي في المستوى والفضاء والحساب المثلثي',
        weightPct: 15,
        skills: ['معادلة دائرة ومستقيم وتقاطعهما', 'صيغ التحويل المثلثية الأساسية', 'التعامد والمسافة بين نقطة ومستقيم'],
        epistemologicalObstacles: 'نسيان صيغ المسافة ومعادلة الدائرة بمعرفة المركز والشعاع أو القطر.',
        remediationActivity: 'تذكير مركز بصيغ الهندسة التحليلية استعداداً للهندسة الفضائية والأعداد العقدية.'
      }
    ],
    sampleQuestions: [
      {
        num: 1,
        domain: 'النهايات والاشتقاق ودراسة الدوال',
        points: 9,
        questionText: 'نعتبر الدالة f المعرفة بـ: f(x) = (x² - 3x + 3)/(x - 1). 1) حدد Df واحسب النهايات عند محدات Df مع التأويل الهندسي. 2) احسب f\'(x) وضع جدول تغيرات f واكتب معادلة المماس عند النقطة ذات الأفصول 0.',
        expectedCompetency: 'التحكم الشامل في النهايات والاشتقاق والمستقيمات المقاربة.'
      },
      {
        num: 2,
        domain: 'حساب النهايات وإزالة الأشكال غير المحددة',
        points: 4,
        questionText: 'احسب النهايات التالية: lim(x→2) (√(x+2) - 2)/(x - 2)  و  lim(x→+∞) (√(x² + 3x) - x).',
        expectedCompetency: 'توظيف الضرب في المرافق والتعميل لإزالة الأشكال غير المحددة.'
      },
      {
        num: 3,
        domain: 'المتتاليات العددية والبرهان بالترجع',
        points: 5,
        questionText: 'نعتبر المتتالية (Un) المعرفة بـ U0 = 1 و Un+1 = (1/2)Un + 3. 1) بين بالترجع أن Un < 6 لكل n من IN. 2) ادرس رتابة (Un). 3) نضع Vn = Un - 6، بين أن (Vn) هندسية وحدد Un بدلالة n.',
        expectedCompetency: 'البرهان بالترجع ودراسة الرتابة والمتتالية المساعدة.'
      },
      {
        num: 4,
        domain: 'التحليل التوافقي / الهندسة',
        points: 2,
        questionText: 'حدد معادلة ديكارتية للدائرة التي مركزها Ω(2, -1) وشعاعها R = 3، وادرس تقاطعها مع المستقيم (D): x + y - 1 = 0.',
        expectedCompetency: 'استحضار المكتسبات الهندسية التحليلية.'
      }
    ]
  },
  '2BAC_SM': {
    code: '2BAC_SM',
    levelTitle: 'الثانية باكالوريا علوم رياضية (2BAC SM - أ و ب)',
    targetCycle: 'الإعداد المتقدم للامتحان الوطني الموحد ومباريات التميز',
    duration: 'ساعتان (120 دقيقة)',
    prerequisites: [
      {
        domain: 'المنطق، المجموعات، التطبيقات، والحسابيات في Z',
        weightPct: 25,
        skills: ['الاستدلال بالترجع القوي، الخلف، وفصل الحالات', 'التباين والشمول والتقابل العكسي', 'القسمة الإقليدية، الموافقات بترديد n، والأعداد الأولية'],
        epistemologicalObstacles: 'صعوبة توظيف مبرهنة بيزو وغوص في المعادلات الديوفانتية والموافقات.',
        remediationActivity: 'تمارين توليفية في الحسابيات والمجموعات تمهيداً للبنيات الجبرية.'
      },
      {
        domain: 'النهايات، الاشتقاق، ومبرهنة القيم الوسطية والدوال العكسية',
        weightPct: 45,
        skills: ['نهايات الدوال المثلثية والجذرية المركبة', 'قابلية الاشتقاق على اليمين واليسار والتأويل الهندسي (نصف مماس)', 'الاشتقاق المتتالي ورتابة الدوال'],
        epistemologicalObstacles: 'عدم التحقق من شروط الاتصال والرتابة القطعية قبل الحديث عن التقابل والدالة العكسية.',
        remediationActivity: 'مسألة تحليل شاملة تربط الاتصال والاشتقاق والتمثيل المبياني.'
      },
      {
        domain: 'المتتاليات العددية والمجاميع والجداءات',
        weightPct: 30,
        skills: ['حساب مجاميع وجداءات باستعمال الرمزين Σ و Π', 'المتتاليات الترجعية من الشكل Un+1 = f(Un)', 'تأطير متتالية واستنتاج سلوكها'],
        epistemologicalObstacles: 'أخطاء تغيير المؤشر في المجاميع Σ واستعمال رتابة الدالة المرفقة بدون استقرار المجال.',
        remediationActivity: 'ورشة تطبيقية حول المتتاليات المعرفة بدالة ومصاديق التقارب.'
      }
    ],
    sampleQuestions: [
      {
        num: 1,
        domain: 'التحليل: النهايات والاشتقاق',
        points: 8,
        questionText: 'لتكن f(x) = x - 1 + √(x² - 2x). حدد Df، ادرس قابلية اشتقاق f على يمين 2 وعلى يسار 0 مع التأويل الهندسي، ثم ادرس الفروع اللانهائية والرتابة.',
        expectedCompetency: 'الدقة التحليلية في دراسة الدوال الجذرية المركبة.'
      },
      {
        num: 2,
        domain: 'المتتاليات والرمز Σ',
        points: 6,
        questionText: 'نعتبر المتتالية المعرفة بـ U0 = 0 و Un+1 = √(2 + Un). بين بالترجع أن 0 ≤ Un < 2 وأن (Un) تزايدية، ثم احسب بدلالة n المجموع Sn = Σ(k=1..n) 1/(k(k+1)).',
        expectedCompetency: 'التحكم في الترجع وتفكيك الكسور لحساب المجاميع التلسكوبية.'
      },
      {
        num: 3,
        domain: 'الحسابيات في Z والتطبيقات',
        points: 6,
        questionText: '1) بين أن لكل n من IN العدد n(n² + 5) يقبل القسمة على 6. 2) ليكن f تطبيقاً من IR نحو ]-1, 1[ معرفاً بـ f(x) = x/(1 + |x|)، بين أن f تقابلي وحدد تقابله العكسي.',
        expectedCompetency: 'التمكن من الموافقات في Z ودراسة التقابل العكسي.'
      }
    ]
  }
};

interface OrientationRecommendation {
  primaryPath: string;
  secondaryPath: string;
  postBacTracks: string[];
  profileBadge: string;
  profileColor: string;
  confidencePct: number;
  counselorNote: string;
}

function computeStudentOrientation(student: StudentMetric, levelCode: string): OrientationRecommendation {
  const avg = student.avg ?? 0;
  const best = student.bestMark ?? avg;
  const delta = student.delta ?? 0;
  const effectiveScore = avg * 0.75 + best * 0.25 + (delta > 0 ? Math.min(1.5, delta * 0.3) : 0);

  if (levelCode === 'TCS') {
    if (effectiveScore >= 15.5) {
      return {
        primaryPath: 'الأولى باكالوريا علوم رياضية (1BAC SM)',
        secondaryPath: 'الأولى باكالوريا علوم تجريبية - خيار فرنسية (BIOF)',
        postBacTracks: ['الأقسام التحضيرية للمدارس العليا CPGE (MPSI)', 'مدارس المهندسين الوطنية (EMI / ENSIAS / ENSA)', 'التميز الأكاديمي والعلمي'],
        profileBadge: 'مؤهل بقوة لشعبة العلوم الرياضية',
        profileColor: 'bg-purple-100 text-purple-900 border-purple-300',
        confidencePct: 95,
        counselorNote: 'يتوفر التلميذ(ة) على بنية استدلالية وقدرة عالية على التجريد الرياضي تؤهله للنجاح والتفوق في شعبة العلوم الرياضية.'
      };
    }
    if (effectiveScore >= 12.5) {
      return {
        primaryPath: 'الأولى باكالوريا علوم تجريبية (1BAC Sciences Expérimentales)',
        secondaryPath: 'الأولى باكالوريا علوم وتكنولوجيات كهربائية/ميكانيكية (STE / STM)',
        postBacTracks: ['كليات الطب والصيدلة وطب الأسنان', 'المدارس الوطنية للعلوم التطبيقية (ENSA / ENSAM)', 'كليات العلوم والتقنيات (FST)'],
        profileBadge: 'ملائم جداً للعلوم التجريبية والتقنية',
        profileColor: 'bg-blue-100 text-blue-900 border-blue-300',
        confidencePct: 88,
        counselorNote: 'مستوى جيد ومتوازن في الرياضيات يسمح بمتابعة مريحة ومثمرة في مسالك العلوم التجريبية أو العلوم والتكنولوجيات.'
      };
    }
    if (effectiveScore >= 10) {
      return {
        primaryPath: 'الأولى باكالوريا علوم تجريبية أو علوم اقتصادية وتدبير (SEG)',
        secondaryPath: 'الأولى باكالوريا علوم وتكنولوجيات',
        postBacTracks: ['المدارس الوطنية للتجارة والتسيير (ENCG)', 'المدارس العليا للتكنولوجيا (EST / BTS)', 'الكليات العلمية والاقتصادية'],
        profileBadge: 'مؤهل مع توصية بتعزيز القواعد الجبرية',
        profileColor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        confidencePct: 76,
        counselorNote: 'تحكم مقبول في الكفايات الأساسية، يُنصح باختيار شعبة العلوم التجريبية أو العلوم الاقتصادية مع المواظبة على التمارين التطبيقية.'
      };
    }
    return {
      primaryPath: 'الأولى باكالوريا علوم اقتصادية وتدبير (SEG) أو علوم تجريبية مع دعم مكثف',
      secondaryPath: 'إعادة التوجيه المدروس وفق الميول والمواد المتكاملة',
      postBacTracks: ['المعاهد التقنية والتكنولوجية (ISTA / BTS)', 'التخصصات الاقتصادية والإدارية والجامعية'],
      profileBadge: 'يحتاج إلى مواكبة وتأطير في مشروع التوجيه',
      profileColor: 'bg-amber-100 text-amber-900 border-amber-300',
      confidencePct: 62,
      counselorNote: 'يُسجل تعثر في بعض المكتسبات الرياضية؛ يُوصى بمواكبة التلميذ(ة) عبر مستشار التوجيه وربط الاختيار ببرنامج دعم استدراكي قبلي.'
    };
  }

  if (levelCode === '1BAC_LSH') {
    return {
      primaryPath: 'الثانية باكالوريا مسلك الآداب أو مسلك العلوم الإنسانية (2BAC LSH / 2BAC SH)',
      secondaryPath: 'الثانية باكالوريا مسلك العلوم الشرعية أو مسلك اللغة العربية (التعليم الأصيل)',
      postBacTracks: [
        'المعهد العالي للإعلام والاتصال (ISIC)',
        'كليات العلوم القانونية والاقتصادية والاجتماعية (FSJES)',
        'كليات الآداب والعلوم الإنسانية ومدارس الترجمة (ESRFT)',
        'المدرسة العليا للأساتذة ومسارات التربية والتعليم (ENS)'
      ],
      profileBadge: 'توجيه ملائم لمسلك الآداب والعلوم الإنسانية',
      profileColor: 'bg-amber-100 text-amber-900 border-amber-300',
      confidencePct: 90,
      counselorNote: 'تحكم إيجابي في الكفايات الرياضية المقررة لمسلك الآداب والعلوم الإنسانية يؤهل التلميذ(ة) للنجاح في الامتحان الجهوي الموحد ومتابعة دراسات جامعية واعدة في حقول الإعلام، القانون، اللغات والعلوم الاجتماعية.'
    };
  }

  if (levelCode.startsWith('1BAC')) {
    if (effectiveScore >= 15) {
      return {
        primaryPath: levelCode === '1BAC_SM' ? 'الثانية باكالوريا علوم رياضية (مسلك أ أو ب)' : 'الثانية باكالوريا علوم فيزيائية (2BAC PC) - قطب التميز',
        secondaryPath: 'الثانية باكالوريا علوم فيزيائية (PC) / علوم الحياة والأرض (SVT)',
        postBacTracks: ['الأقسام التحضيرية للمدارس العليا (CPGE MPSI / PCSI)', 'كليات الطب والصيدلة والهندسة المعمارية (ENA)', 'مدارس المهندسين الكبرى (ENSA / ENSAM / IAV)'],
        profileBadge: 'مسار تميز علمي وهندسي',
        profileColor: 'bg-indigo-100 text-indigo-900 border-indigo-300',
        confidencePct: 94,
        counselorNote: 'نتائج متميزة ومنتظمة تؤهل التلميذ(ة) لاختيار مسلك العلوم الرياضية أو العلوم الفيزيائية واستهداف المدارس العليا ذات الاستقطاب المحدود.'
      };
    }
    if (effectiveScore >= 11.5) {
      return {
        primaryPath: 'الثانية باكالوريا مسلك العلوم الفيزيائية (2BAC PC)',
        secondaryPath: 'الثانية باكالوريا مسلك علوم الحياة والأرض (2BAC SVT)',
        postBacTracks: ['المدارس الوطنية للعلوم التطبيقية (ENSA / FST)', 'كليات الطب والتمريض (ISPITS)', 'المدارس الوطنية للتجارة والتسيير (ENCG)'],
        profileBadge: 'مسار علمي متوازن (PC / SVT)',
        profileColor: 'bg-teal-100 text-teal-900 border-teal-300',
        confidencePct: 85,
        counselorNote: 'أداء مستقر ومؤشرات إيجابية تسمح بالتفوق في مسلك العلوم الفيزيائية أو علوم الحياة والأرض شريطة الحفاظ على وتيرة الاشتغال.'
      };
    }
    return {
      primaryPath: 'الثانية باكالوريا مسلك علوم الحياة والأرض (2BAC SVT) أو العلوم الاقتصادية',
      secondaryPath: 'مسلك العلوم الفيزيائية مع خطة دعم موازية في التحليل',
      postBacTracks: ['كليات العلوم والتقنيات (FST)', 'المدارس العليا للتكنولوجيا (EST) وشهادة التقني العالي (BTS)', 'التكوينات الجامعية والمهنية'],
      profileBadge: 'مسار يتطلب تقوية في الدوال والمتتاليات',
      profileColor: 'bg-amber-100 text-amber-900 border-amber-300',
      confidencePct: 68,
      counselorNote: 'يُنصح باختيار المسلك الأقل ضغطاً في المعامل الرياضي أو الانخراط المبكر في حصص الدعم المندمج لضمان النجاح في الامتحان الوطني.'
    };
  }

  // Default: 2BAC (Post-Baccalaureate Orientation)
  if (effectiveScore >= 15.5) {
    return {
      primaryPath: 'الأقسام التحضيرية للمدارس العليا (CPGE) + كليات الطب والهندسة',
      secondaryPath: 'ENSA / ENSAM / ENA (الهندسة المعمارية) / IAV',
      postBacTracks: ['الأقسام التحضيرية (MPSI / PCSI / TSI / ECS)', 'كليات الطب والصيدلة وطب الأسنان (FMP / FMD)', 'المدارس الوطنية للعلوم التطبيقية والفنون والمهن (ENSA / ENSAM)'],
      profileBadge: 'ترشيح ممتاز للمؤسسات ذات الاستقطاب المحدود',
      profileColor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      confidencePct: 96,
      counselorNote: 'معدل مرتفع يؤهل التلميذ(ة) لتجاوز عتبات الانتقاء الأولي (Seuil de présélection) لأرقى المعاهد والمدارس العليا الوطنية والدولية.'
    };
  }
  if (effectiveScore >= 12.5) {
    return {
      primaryPath: 'المدارس الوطنية (ENSA / ENSAM / ENCG) + كليات العلوم والتقنيات (FST)',
      secondaryPath: 'المدارس العليا للتكنولوجيا (EST) والمعاهد الصحية (ISPITS)',
      postBacTracks: ['المدارس الوطنية للعلوم التطبيقية (ENSA) و (ENSAM)', 'كليات العلوم والتقنيات (FST - MIP / MIPC)', 'المدارس الوطنية للتجارة والتسيير (ENCG)'],
      profileBadge: 'حظوظ قوية في مباريات المدارس الوطنية والـ FST',
      profileColor: 'bg-blue-100 text-blue-900 border-blue-300',
      confidencePct: 86,
      counselorNote: 'مؤشرات جيدة جداً تسمح بالولوج للمدارس العليا وكليات العلوم والتقنيات، مع أهمية التركيز على منهجية الامتحان الوطني لرفع المعدل العام.'
    };
  }
  if (effectiveScore >= 10) {
    return {
      primaryPath: 'كليات العلوم والتقنيات (FST) + المدارس العليا للتكنولوجيا (EST / BTS)',
      secondaryPath: 'الإجازات المهنية والأساسية في الرياضيات والمعلوميات والاقتصاد',
      postBacTracks: ['المدارس العليا للتكنولوجيا (EST) وشهادة التقني العالي (BTS)', 'كليات العلوم والتقنيات (FST)', 'المعاهد العليا للمهن التمريضية (ISPITS)'],
      profileBadge: 'توجيه تطبيقي وتكنولوجي واعد',
      profileColor: 'bg-indigo-100 text-indigo-900 border-indigo-300',
      confidencePct: 78,
      counselorNote: 'مستوى مستوفٍ لعتبة التحكم؛ يُنصح بتنويع الترشيحات في منصة (Cursussup) بين المعاهد التطبيقية (EST/BTS) وكليات العلوم والتقنيات.'
    };
  }
  return {
    primaryPath: 'المدارس العليا للتكنولوجيا (EST / BTS) + التكوين المهني العالي (OFPPT) والجامعة',
    secondaryPath: 'مسالك الإجازة الأساسية مع مواكبة بيداغوجية لضمان النجاح في البكالوريا',
    postBacTracks: ['شهادة التقني العالي (BTS) ومعاهد التكنولوجيا التطبيقية', 'الكليات متعددة التخصصات ومسالك الاقتصاد والتدبير'],
    profileBadge: 'أولوية قصوى لضمان استيفاء البكالوريا أولاً',
    profileColor: 'bg-rose-100 text-rose-900 border-rose-300',
    confidencePct: 65,
    counselorNote: 'الأولوية الراهنة هي تدارك النقص في الفروض عبر خطة دعم مركزة على الأسئلة المضمونة في الإطار المرجعي للامتحان الوطني (الدوال والمتتاليات والأعداد العقدية).'
  };
}

export default function PedagogicalCouncilOrientationView({
  db,
  selectedClass,
  semester,
  studentMetrics,
  classAverages,
  initialSection = 'council_digest'
}: PedagogicalCouncilOrientationViewProps) {
  const [activeSubSection, setActiveSubSection] = useState<'council_digest' | 'diagnostic_toolkit' | 'orientation_hub'>(initialSection);
  const [selectedDiagnosticLevel, setSelectedDiagnosticLevel] = useState<string>(() => {
    const upper = (selectedClass || '').toUpperCase();
    if (upper.includes('TCS') || upper.includes('TC') || selectedClass.includes('جذع')) return 'TCS';
    if (upper.includes('1BAC') || selectedClass.includes('أولى') || selectedClass.includes('اولى')) {
      if (upper.includes('SM')) return '1BAC_SM';
      if (upper.includes('LSH') || upper.includes('SH') || upper.includes('LET') || upper.includes('LIT') || selectedClass.includes('آداب') || selectedClass.includes('إنسانية')) return '1BAC_LSH';
      return '1BAC_EXP';
    }
    if (upper.includes('SM')) return '2BAC_SM';
    if (upper.includes('LSH') || upper.includes('SH') || selectedClass.includes('آداب') || selectedClass.includes('إنسانية')) return '1BAC_LSH';
    return '2BAC_PC';
  });
  const [orientationLevel, setOrientationLevel] = useState<'TCS' | '1BAC' | '2BAC'>(() => {
    const upper = (selectedClass || '').toUpperCase();
    if (upper.includes('TC') || selectedClass.includes('جذع')) return 'TCS';
    if (upper.includes('1BAC') || selectedClass.includes('أولى') || selectedClass.includes('اولى')) return '1BAC';
    return '2BAC';
  });
  const [orientationSearch, setOrientationSearch] = useState('');
  const [councilCustomNotes, setCouncilCustomNotes] = useState<string>(
    'يتميز القسم بمستوى تفاعل إيجابي في الحصص الحضورية، مع ضرورة تكثيف أنشطة الدعم المندمج لفائدة الفئة المتعثرة ومراقبة المواظبة وإنجاز الفروض المنزلية بانتظام.'
  );

  // Sync sub-section when parent quick-switch pill is clicked
  useEffect(() => {
    if (initialSection) {
      setActiveSubSection(initialSection);
    }
  }, [initialSection]);

  // Automatically adapt diagnostic & orientation level when selectedClass changes
  useEffect(() => {
    if (!selectedClass || selectedClass === 'all') return;
    const upper = selectedClass.toUpperCase();
    if (upper.includes('TCS') || upper.includes('TC') || selectedClass.includes('جذع')) {
      setSelectedDiagnosticLevel('TCS');
      setOrientationLevel('TCS');
    } else if (upper.includes('1BAC') || selectedClass.includes('أولى') || selectedClass.includes('اولى')) {
      if (upper.includes('SM')) {
        setSelectedDiagnosticLevel('1BAC_SM');
      } else if (upper.includes('LSH') || upper.includes('SH') || upper.includes('LET') || upper.includes('LIT') || selectedClass.includes('آداب') || selectedClass.includes('إنسانية')) {
        setSelectedDiagnosticLevel('1BAC_LSH');
      } else {
        setSelectedDiagnosticLevel('1BAC_EXP');
      }
      setOrientationLevel('1BAC');
    } else {
      if (upper.includes('SM')) {
        setSelectedDiagnosticLevel('2BAC_SM');
      } else if (upper.includes('LSH') || upper.includes('SH') || selectedClass.includes('آداب') || selectedClass.includes('إنسانية')) {
        setSelectedDiagnosticLevel('1BAC_LSH');
      } else {
        setSelectedDiagnosticLevel('2BAC_PC');
      }
      setOrientationLevel('2BAC');
    }
  }, [selectedClass]);

  // Compute Coefficient of Variation (CV%) & Didactic Homogeneity Diagnosis
  const homogeneityAnalysis = useMemo(() => {
    const mean = classAverages.overall;
    const std = classAverages.stdDev;
    if (!mean || mean <= 0 || std === null || std === undefined) {
      return {
        cvPct: null,
        statusLabel: 'في انتظار استكمال النقط',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        didacticReading: 'يرجى رصد نقط الفروض لحساب معامل الاختلاف الإحصائي (CV%) وتحديد درجة تجانس القسم.'
      };
    }
    const cv = parseFloat(((std / mean) * 100).toFixed(1));
    if (cv < 18) {
      return {
        cvPct: cv,
        statusLabel: 'قسم متجانس التحصيل (CV < 18%)',
        badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        didacticReading: `معامل الاختلاف منخفض (${cv}%)؛ مما يدل على تقارب مستويات التلاميذ حول المعدل العام (${mean}/20) ونجاعة الإيقاع الموحد لبناء التعلمات.`
      };
    }
    if (cv <= 28) {
      return {
        cvPct: cv,
        statusLabel: 'تشتت متوسط وطبيعي (18% ≤ CV ≤ 28%)',
        badgeClass: 'bg-blue-100 text-blue-900 border-blue-300',
        didacticReading: `معامل الاختلاف معتدل (${cv}%)؛ يعكس توزيعاً طبيعياً للقدرات الرياضية يستوجب المزاوجة بين تمارين التثبيت الأساسية وتمارين التوليف.`
      };
    }
    return {
      cvPct: cv,
      statusLabel: 'قسم غير متجانس / ثنائي القطب (CV > 28%)',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
      didacticReading: `معامل الاختلاف مرتفع (${cv}%)؛ يكشف عن فجوة تحصيلية بين فئة متفوقة وفئة متعثرة، مما يفرض تفعيل البيداغوجيا الفارقية وتفويج القسم خلال حصص الدعم.`
    };
  }, [classAverages.overall, classAverages.stdDev]);

  const teacherProfile = db?.teacherProfile || {};
  const schoolName = teacherProfile.school || teacherProfile.schoolName || 'الثانوية التأهيلية';
  const directorate = teacherProfile.directorate || 'المديرية الإقليمية';
  const academy = teacherProfile.academy || 'الأكاديمية الجهوية للتربية والتكوين';
  const teacherName = teacherProfile.name || 'الأستاذ: إبراهيم قزيبر';
  const academicYear = teacherProfile.academicYear || '2026 / 2027';
  const classTitle = selectedClass === 'all' ? 'جميع الأقسام المسندة' : selectedClass;
  const semesterTitle = semester === 's1' ? 'الدورة الأولى (الأسدوس الأول)' : 'الدورة الثانية (الأسدوس الثاني)';

  // Council Digest Categorization (قرارات وتقديرات مجلس القسم)
  const councilCategories = useMemo(() => {
    const evaluated = studentMetrics.filter(s => s.avg !== null);
    const feliciations = evaluated.filter(s => s.avg! >= 16); // تهنئة وتنويه
    const encouragements = evaluated.filter(s => s.avg! >= 14 && s.avg! < 16); // تشجيع
    const tableauHonneur = evaluated.filter(s => s.avg! >= 12 && s.avg! < 14); // لوحة الشرف
    const passable = evaluated.filter(s => s.avg! >= 10 && s.avg! < 12); // مستوفٍ للعتبة
    const mandatorySupport = evaluated.filter(s => s.avg! >= 8 && s.avg! < 10); // دعم استدراكي إلزامي
    const criticalAlert = evaluated.filter(s => s.avg! < 8); // تنبيه التحصيل وخطة علاجية مستعجلة

    return {
      evaluatedCount: evaluated.length,
      feliciations,
      encouragements,
      tableauHonneur,
      passable,
      mandatorySupport,
      criticalAlert
    };
  }, [studentMetrics]);

  // Live Diagnostic Profiling synced with db.diagnostic (from diagnostic-evaluation.js)
  const diagnosticLiveSummary = useMemo(() => {
    const diagRoot = db?.diagnostic || (typeof window !== 'undefined' && (window as any).db?.diagnostic) || {};
    let groupA = 0;
    let groupB = 0;
    let groupC = 0;
    let sumTotal = 0;
    let sumD1 = 0;
    let sumD2 = 0;
    let sumD3 = 0;
    let sumD4 = 0;
    const strugglingNames: string[] = [];

    studentMetrics.forEach((s, idx) => {
      const classDiag = diagRoot[s.className] || {};
      const existing = classDiag[s.id];
      let d1 = 2.8, d2 = 2.7, d3 = 2.8, d4 = 2.7, total = 11.0;
      if (existing && existing.total !== undefined) {
        d1 = Number(existing.d1) || 0;
        d2 = Number(existing.d2) || 0;
        d3 = Number(existing.d3) || 0;
        d4 = Number(existing.d4) || 0;
        total = Number(existing.total) || (d1 + d2 + d3 + d4);
      } else if (s.avg !== null) {
        total = Math.max(3, Math.min(19, parseFloat((s.avg * 0.92).toFixed(2))));
        const factor = total / 20;
        d1 = parseFloat((factor * 5.1).toFixed(2));
        d2 = parseFloat((factor * 4.8).toFixed(2));
        d3 = parseFloat((factor * 5.0).toFixed(2));
        d4 = parseFloat(Math.max(0.5, total - d1 - d2 - d3).toFixed(2));
      } else {
        const ratio = studentMetrics.length > 1 ? idx / (studentMetrics.length - 1) : 0.5;
        total = parseFloat((16.5 - ratio * 11).toFixed(2));
        d1 = parseFloat((total * 0.26).toFixed(2));
        d2 = parseFloat((total * 0.24).toFixed(2));
        d3 = parseFloat((total * 0.25).toFixed(2));
        d4 = parseFloat((total - d1 - d2 - d3).toFixed(2));
      }

      sumTotal += total;
      sumD1 += d1;
      sumD2 += d2;
      sumD3 += d3;
      sumD4 += d4;

      if (total >= 12) groupA++;
      else if (total >= 8) groupB++;
      else {
        groupC++;
        strugglingNames.push(`${s.name} (${total.toFixed(1)})`);
      }
    });

    const count = studentMetrics.length;
    const avgDiagnostic = count > 0 ? parseFloat((sumTotal / count).toFixed(2)) : null;
    const netImpact =
      avgDiagnostic !== null && classAverages.overall !== null
        ? parseFloat((classAverages.overall - avgDiagnostic).toFixed(2))
        : null;

    return {
      count,
      groupA,
      groupB,
      groupC,
      avgDiagnostic,
      netImpact,
      avgD1: count > 0 ? parseFloat((sumD1 / count).toFixed(2)) : 0,
      avgD2: count > 0 ? parseFloat((sumD2 / count).toFixed(2)) : 0,
      avgD3: count > 0 ? parseFloat((sumD3 / count).toFixed(2)) : 0,
      avgD4: count > 0 ? parseFloat((sumD4 / count).toFixed(2)) : 0,
      strugglingNames
    };
  }, [db, studentMetrics, classAverages.overall]);

  const handleOpenDiagnosticGridInReports = () => {
    const win = window as any;
    if (typeof win.switchTab === 'function') {
      win.switchTab('reports');
      setTimeout(() => {
        if (selectedClass && selectedClass !== 'all') {
          const repSel = document.getElementById('reportClassSelect') as HTMLSelectElement | null;
          if (repSel && repSel.value !== selectedClass) {
            repSel.value = selectedClass;
            if (typeof win.generateReport === 'function') win.generateReport();
          }
          if (typeof win.renderDiagnosticSection === 'function') {
            win.renderDiagnosticSection(selectedClass);
          }
        }
        const diagCard = document.getElementById('diagnosticReportCard');
        if (diagCard) {
          diagCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);
    }
  };

  // Orientation Data per student
  const studentOrientations = useMemo(() => {
    return studentMetrics
      .filter(s => {
        if (!orientationSearch.trim()) return true;
        return s.name.toLowerCase().includes(orientationSearch.toLowerCase()) ||
          s.massar.toLowerCase().includes(orientationSearch.toLowerCase());
      })
      .map(s => ({
        student: s,
        orientation: computeStudentOrientation(s, orientationLevel)
      }));
  }, [studentMetrics, orientationLevel, orientationSearch]);

  // Print Single Student Individual Orientation & Personal Project Card (A4)
  const handlePrintSingleStudentOrientation = (student: StudentMetric, orientation: OrientationRecommendation) => {
    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>بطاقة التوجيه والمشروع الشخصي — ${student.name}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; margin: 0; padding: 10px; color: #0f172a; font-size: 10.5pt; line-height: 1.55; }
    .header-box { border-bottom: 2.5px solid #0284c7; padding-bottom: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; }
    .banner { background: #f0f9ff; border: 1.5px solid #7dd3fc; border-radius: 10px; padding: 10px 14px; text-align: center; margin-bottom: 14px; }
    .banner h2 { margin: 0; font-size: 14pt; color: #0369a1; }
    .student-meta { border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; background: #f8fafc; margin-bottom: 14px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 14px; }
    .kpi-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px; text-align: center; background: #ffffff; }
    .kpi-card .val { font-size: 13pt; font-weight: bold; color: #0369a1; display: block; }
    .kpi-card .lbl { font-size: 8.5pt; color: #64748b; }
    .box { border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; }
    .box-title { font-weight: bold; color: #1e3a8a; font-size: 11pt; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    .sign-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 22px; }
    .sign-cell { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; height: 90px; background: #fafafa; font-size: 9.5pt; text-align: center; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header-box">
    <div>
      <strong>المملكة المغربية</strong><br>
      وزارة التربية الوطنية والتعليم الأولي والرياضة<br>
      ${academy}<br>
      ${directorate} — ${schoolName}
    </div>
    <div style="text-align:center;">
      <strong style="font-size:13.5pt; color:#0369a1;">🧭 بطاقة التوجيه المدرسي والمهني الفردية</strong><br>
      <span style="font-size:9.5pt; color:#475569;">مواكبة المشروع الشخصي للمتعلم(ة) — مادة الرياضيات</span>
    </div>
    <div style="text-align:left;">
      الموسم الدراسي: <strong>${academicYear}</strong><br>
      الفترة: <strong>${semesterTitle}</strong><br>
      الأستاذ(ة): <strong>${teacherName}</strong>
    </div>
  </div>

  <div class="banner">
    <h2>تقرير الكفايات الرياضية وتوصية التوجيه المدرسي وما بعد البكالوريا</h2>
  </div>

  <div class="student-meta">
    <div>الاسم الكامل: <strong>${student.name}</strong></div>
    <div>رقم مسار: <strong>${student.massar || '—'}</strong></div>
    <div>القسم الحالي: <strong>${student.className}</strong></div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card"><span class="val">${student.avg ?? '-'}/20</span><span class="lbl">المعدل العام للرياضيات</span></div>
    <div class="kpi-card"><span class="val">${student.bestMark ?? '-'}/20</span><span class="lbl">أعلى نقطة فرض</span></div>
    <div class="kpi-card"><span class="val">${student.delta !== null ? (student.delta > 0 ? `+${student.delta}` : student.delta) : '-'}</span><span class="lbl">منحى التطور</span></div>
    <div class="kpi-card"><span class="val">${student.validExamsCount}</span><span class="lbl">عدد الفروض المنجزة</span></div>
    <div class="kpi-card"><span class="val">${orientation.confidencePct}%</span><span class="lbl">مؤشر ملاءمة التوجيه</span></div>
  </div>

  <div class="box" style="background:#f0fdf4; border-color:#86efac;">
    <div class="box-title" style="color:#166534;">1. المسلك أو التوجه الأساسي الموصى به (الخيار الأول):</div>
    <div style="font-size:12pt; font-weight:bold; color:#065f46; margin-bottom:4px;">${orientation.primaryPath}</div>
    <div style="font-size:10pt; color:#334155;"><strong>البديل الثاني الملائم:</strong> ${orientation.secondaryPath}</div>
  </div>

  <div class="box">
    <div class="box-title">2. آفاق الدراسات العليا والمدارس والمعاهد الملائمة للمؤهلات الرياضية:</div>
    <ul style="margin:6px 0; padding-right:18px;">
      ${orientation.postBacTracks.map(t => `<li style="margin-bottom:4px; font-weight:bold;">${t}</li>`).join('')}
    </ul>
  </div>

  <div class="box" style="background:#eff6ff; border-color:#93c5fd;">
    <div class="box-title">3. التوصية البيداغوجية لأستاذ(ة) الرياضيات ومستشار(ة) التوجيه:</div>
    <div>${orientation.counselorNote}</div>
  </div>

  <div class="sign-grid">
    <div class="sign-cell">توقيع أستاذ(ة) مادة الرياضيات<br><span style="font-weight:normal; font-size:8.5pt; color:#64748b;">${teacherName}</span></div>
    <div class="sign-cell">توقيع مستشار(ة) التوجيه التربوي<br><span style="font-weight:normal; font-size:8.5pt; color:#64748b;">المواكبة التربوية</span></div>
    <div class="sign-cell">اطلاع وتوقيع ولي الأمر والتلميذ(ة)<br><span style="font-weight:normal; font-size:8.5pt; color:#64748b;">المشروع الشخصي للمتعلم</span></div>
  </div>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 3000);
      }, 350);
    }
  };

  // Print Official Class Council Digest (Point 3)
  const handlePrintCouncilDigest = () => {
    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير ومحضر مجلس القسم — ${classTitle}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; margin: 0; padding: 8px; color: #0f172a; font-size: 10pt; line-height: 1.45; }
    .header-box { border-bottom: 2.5px solid #1e3a8a; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
    .banner { background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 8px 12px; text-align: center; margin-bottom: 12px; }
    .banner h2 { margin: 0; font-size: 13.5pt; color: #166534; }
    .banner p { margin: 3px 0 0 0; font-size: 9.5pt; color: #475569; }
    .kpi-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin-bottom: 12px; }
    .kpi-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px; text-align: center; background: #f8fafc; }
    .kpi-card .val { font-size: 12pt; font-weight: bold; color: #1e3a8a; display: block; }
    .kpi-card .lbl { font-size: 8.5pt; color: #64748b; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9.5pt; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right; }
    th { background: #1e293b; color: #ffffff; font-weight: bold; text-align: center; }
    .section-title { font-size: 10.5pt; font-weight: bold; color: #1e3a8a; margin: 10px 0 6px 0; border-right: 4px solid #1e3a8a; padding-right: 8px; }
    .notes-box { border: 1px solid #93c5fd; background: #eff6ff; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; font-size: 9.5pt; }
    .sign-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 16px; page-break-inside: avoid; }
    .sign-cell { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; height: 85px; background: #fafafa; font-size: 9pt; text-align: center; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header-box">
    <div style="width: 36%;">
      <strong>المملكة المغربية</strong><br>
      وزارة التربية الوطنية والتعليم الأولي والرياضة<br>
      ${academy}<br>
      ${directorate} — ${schoolName}
    </div>
    <div style="width: 28%; text-align: center;">
      <div style="font-size: 14pt; font-weight: 900; color: #1e3a8a;">📐 مادة الرياضيات</div>
      <div style="font-size: 9pt; color: #047857; font-weight: bold;">السلك الثانوي التأهيلي</div>
    </div>
    <div style="width: 36%; text-align: left;">
      الموسم الدراسي: <strong>${academicYear}</strong><br>
      القسم: <strong>${classTitle}</strong><br>
      الفترة التقويمية: <strong>${semesterTitle}</strong><br>
      الأستاذ(ة): <strong>${teacherName}</strong>
    </div>
  </div>

  <div class="banner">
    <h2>التقرير التركيبي الرسمي لمجلس القسم وحصيلة المراقبة المستمرة</h2>
    <p>وثيقة رسمية مستخرجة وفق المذكرة الوزارية 142-08 والتوجيهات التربوية لمادة الرياضيات</p>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card"><span class="val">${studentMetrics.length}</span><span class="lbl">عدد التلاميذ</span></div>
    <div class="kpi-card"><span class="val">${classAverages.overall ?? '-'}/20</span><span class="lbl">المعدل العام للقسم</span></div>
    <div class="kpi-card"><span class="val">${classAverages.passPct ?? 0}%</span><span class="lbl">نسبة النجاح (≥10)</span></div>
    <div class="kpi-card"><span class="val">${classAverages.median ?? '-'}/20</span><span class="lbl">الوسيط (Median)</span></div>
    <div class="kpi-card"><span class="val">${classAverages.stdDev ?? '-'}</span><span class="lbl">الانحراف المعياري</span></div>
    <div class="kpi-card"><span class="val">${classAverages.minMark ?? '-'} — ${classAverages.maxMark ?? '-'}</span><span class="lbl">أدنى / أعلى نقطة</span></div>
  </div>

  <div class="section-title">1. حصيلة الفروض المحروسة وتوزيع القرارات البيداغوجية لمجلس القسم</div>
  <table>
    <thead>
      <tr>
        <th>فئة القرار البيداغوجي في مجلس القسم</th>
        <th>عتبة المعدل</th>
        <th>عدد التلاميذ</th>
        <th>النسبة المئوية</th>
        <th>أبرز الأسماء المرصودة</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>🌟 تهنئة وتنويه (Félicitations)</strong></td>
        <td style="text-align:center;">16.00 — 20.00</td>
        <td style="text-align:center; font-weight:bold;">${councilCategories.feliciations.length}</td>
        <td style="text-align:center;">${councilCategories.evaluatedCount ? Math.round((councilCategories.feliciations.length / councilCategories.evaluatedCount) * 100) : 0}%</td>
        <td>${councilCategories.feliciations.slice(0, 6).map(s => `${s.name} (${s.avg})`).join(' ، ') || '—'}</td>
      </tr>
      <tr>
        <td><strong>👏 تشجيع (Encouragements)</strong></td>
        <td style="text-align:center;">14.00 — 15.99</td>
        <td style="text-align:center; font-weight:bold;">${councilCategories.encouragements.length}</td>
        <td style="text-align:center;">${councilCategories.evaluatedCount ? Math.round((councilCategories.encouragements.length / councilCategories.evaluatedCount) * 100) : 0}%</td>
        <td>${councilCategories.encouragements.slice(0, 6).map(s => `${s.name} (${s.avg})`).join(' ، ') || '—'}</td>
      </tr>
      <tr>
        <td><strong>🏅 لوحة الشرف (Tableau d'honneur)</strong></td>
        <td style="text-align:center;">12.00 — 13.99</td>
        <td style="text-align:center; font-weight:bold;">${councilCategories.tableauHonneur.length}</td>
        <td style="text-align:center;">${councilCategories.evaluatedCount ? Math.round((councilCategories.tableauHonneur.length / councilCategories.evaluatedCount) * 100) : 0}%</td>
        <td>${councilCategories.tableauHonneur.slice(0, 6).map(s => `${s.name} (${s.avg})`).join(' ، ') || '—'}</td>
      </tr>
      <tr>
        <td><strong>✅ تحكم مقبول (Passable)</strong></td>
        <td style="text-align:center;">10.00 — 11.99</td>
        <td style="text-align:center; font-weight:bold;">${councilCategories.passable.length}</td>
        <td style="text-align:center;">${councilCategories.evaluatedCount ? Math.round((councilCategories.passable.length / councilCategories.evaluatedCount) * 100) : 0}%</td>
        <td>${councilCategories.passable.slice(0, 6).map(s => `${s.name} (${s.avg})`).join(' ، ') || '—'}</td>
      </tr>
      <tr>
        <td><strong>⚠️ دعم استدراكي إلزامي (Soutien intégré)</strong></td>
        <td style="text-align:center;">08.00 — 09.99</td>
        <td style="text-align:center; font-weight:bold; color:#b45309;">${councilCategories.mandatorySupport.length}</td>
        <td style="text-align:center;">${councilCategories.evaluatedCount ? Math.round((councilCategories.mandatorySupport.length / councilCategories.evaluatedCount) * 100) : 0}%</td>
        <td>${councilCategories.mandatorySupport.slice(0, 8).map(s => `${s.name} (${s.avg})`).join(' ، ') || '—'}</td>
      </tr>
      <tr>
        <td><strong>🚨 تعثر حاد وخطة علاجية مستعجلة</strong></td>
        <td style="text-align:center;">أقل من 08.00</td>
        <td style="text-align:center; font-weight:bold; color:#dc2626;">${councilCategories.criticalAlert.length}</td>
        <td style="text-align:center;">${councilCategories.evaluatedCount ? Math.round((councilCategories.criticalAlert.length / councilCategories.evaluatedCount) * 100) : 0}%</td>
        <td>${councilCategories.criticalAlert.slice(0, 8).map(s => `${s.name} (${s.avg})`).join(' ، ') || '—'}</td>
      </tr>
    </tbody>
  </table>

  <div class="section-title">2. خلاصة التطور بين الفروض المحروسة</div>
  <table>
    <thead>
      <tr>
        <th>الفرض المحروس 1</th>
        <th>الفرض المحروس 2</th>
        <th>الفرض المحروس 3</th>
        ${classAverages.f4 !== null && classAverages.f4 !== undefined ? '<th>الفرض المحروس 4</th>' : ''}
        <th>المعدل العام للدورة</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="text-align:center; font-weight:bold;">${classAverages.f1 ?? '-'}/20</td>
        <td style="text-align:center; font-weight:bold;">${classAverages.f2 ?? '-'}/20</td>
        <td style="text-align:center; font-weight:bold;">${classAverages.f3 ?? '-'}/20</td>
        ${classAverages.f4 !== null && classAverages.f4 !== undefined ? `<td style="text-align:center; font-weight:bold;">${classAverages.f4}/20</td>` : ''}
        <td style="text-align:center; font-weight:bold; color:#1e3a8a;">${classAverages.overall ?? '-'}/20</td>
      </tr>
    </tbody>
  </table>

  <div class="section-title">3. الملاحظات والتوصيات البيداغوجية المرفوعة لمجلس القسم والتوجيه</div>
  <div class="notes-box">
    ${councilCustomNotes}
  </div>

  <div class="sign-grid">
    <div class="sign-cell">توقيع أستاذ(ة) مادة الرياضيات<br><span style="font-weight:normal; font-size:8.5pt; color:#64748b;">${teacherName}</span></div>
    <div class="sign-cell">تأشيرة مستشار(ة) التوجيه التربوي<br><span style="font-weight:normal; font-size:8.5pt; color:#64748b;">ملاحظات التوجيه والمشروع الشخصي</span></div>
    <div class="sign-cell">خاتم وتوقيع السيد(ة) مدير(ة) المؤسسة<br><span style="font-weight:normal; font-size:8.5pt; color:#64748b;">رئيس مجلس القسم</span></div>
  </div>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 3000);
      }, 350);
    }
  };

  // Print Official Diagnostic Test & Grid (Point 4)
  const currentDiagnostic = DIAGNOSTIC_BLUEPRINTS[selectedDiagnosticLevel] || DIAGNOSTIC_BLUEPRINTS['2BAC_PC'];
  const handlePrintDiagnosticTest = () => {
    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>رائز التقويم التشخيصي وشبكة الاستثمار — ${currentDiagnostic.levelTitle}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; margin: 0; padding: 8px; color: #0f172a; font-size: 10.5pt; line-height: 1.5; }
    .header-box { border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; }
    .title-banner { background: #eff6ff; border: 1.5px solid #93c5fd; border-radius: 8px; padding: 8px 12px; text-align: center; margin-bottom: 12px; }
    .title-banner h2 { margin: 0; font-size: 13.5pt; color: #1e3a8a; }
    .student-box { border: 1px dashed #64748b; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; display: flex; justify-content: space-between; background: #f8fafc; }
    .ex-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; }
    .ex-header { display: flex; justify-content: space-between; font-weight: bold; color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9.5pt; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right; }
    th { background: #f1f5f9; font-weight: bold; text-align: center; }
  </style>
</head>
<body>
  <div class="header-box">
    <div>
      <strong>المملكة المغربية</strong><br>
      وزارة التربية الوطنية والتعليم الأولي والرياضة<br>
      المؤسسة: ${schoolName}
    </div>
    <div style="text-align:center;">
      <strong style="font-size:13pt; color:#1e3a8a;">مادة الرياضيات — التقويم التشخيصي</strong><br>
      <span style="font-size:9pt; color:#475569;">مفتتح الموسم الدراسي ${academicYear}</span>
    </div>
    <div style="text-align:left;">
      الأستاذ(ة): ${teacherName}<br>
      المستوى: <strong>${currentDiagnostic.levelTitle}</strong><br>
      المدة الزمنية: ${currentDiagnostic.duration}
    </div>
  </div>

  <div class="title-banner">
    <h2>ورقة رائز التقويم التشخيصي لرصد المكتسبات القبلية وتوجيه الدعم الاستدراكي</h2>
  </div>

  <div class="student-box">
    <span>الاسم الكامل للتلميذ(ة): ...........................................................</span>
    <span>الرقم الترتيبي: ............</span>
    <span>النقطة النهائية: ....... / 20</span>
  </div>

  ${currentDiagnostic.sampleQuestions.map(q => `
    <div class="ex-card">
      <div class="ex-header">
        <span>التمرين ${q.num}: ${q.domain}</span>
        <span>(${q.points} نقط)</span>
      </div>
      <div style="margin-bottom:4px;">${q.questionText}</div>
      <div style="font-size:8.5pt; color:#64748b;"><em>الكفاية القبلية المستهدفة: ${q.expectedCompetency}</em></div>
    </div>
  `).join('')}

  <h4 style="margin: 14px 0 6px 0; color: #1e3a8a;">شبكة تفريغ واستثمار نتائج الرائز التشخيصي (خاص بالأستاذ والتلميذ):</h4>
  <table>
    <thead>
      <tr>
        <th>المجال المعرفي القبلي</th>
        <th>الوزن (%)</th>
        <th>العوائق والصعوبات المرصودة</th>
        <th>درجة التحكم (أ / ب / ج)</th>
      </tr>
    </thead>
    <tbody>
      ${currentDiagnostic.prerequisites.map(p => `
        <tr>
          <td><strong>${p.domain}</strong></td>
          <td style="text-align:center;">${p.weightPct}%</td>
          <td>${p.epistemologicalObstacles}</td>
          <td style="text-align:center;">[ &nbsp; ] تحكم تام &nbsp; [ &nbsp; ] جزئي &nbsp; [ &nbsp; ] غير متحكم</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 3000);
      }, 350);
    }
  };

  // Print Official Orientation Report
  const handlePrintOrientationReport = () => {
    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>بطاقة التوجيه التربوي والمدرسي — ${classTitle}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; margin: 0; padding: 8px; color: #0f172a; font-size: 9.5pt; line-height: 1.4; }
    .header-box { border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; }
    .banner { background: #f0f9ff; border: 1.5px solid #7dd3fc; border-radius: 8px; padding: 8px 12px; text-align: center; margin-bottom: 10px; }
    .banner h2 { margin: 0; font-size: 13pt; color: #0369a1; }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: right; }
    th { background: #0f172a; color: #fff; text-align: center; }
  </style>
</head>
<body>
  <div class="header-box">
    <div>
      <strong>المملكة المغربية</strong><br>
      وزارة التربية الوطنية والتعليم الأولي والرياضة<br>
      المؤسسة: ${schoolName}
    </div>
    <div style="text-align:center;">
      <strong style="font-size:13pt; color:#0369a1;">بطاقة التوجيه المدرسي والمهني (مادة الرياضيات)</strong><br>
      <span>مواكبة المشروع الشخصي للتلميذ — السلك الثانوي التأهيلي</span>
    </div>
    <div style="text-align:left;">
      القسم: <strong>${classTitle}</strong><br>
      الأستاذ(ة): ${teacherName}<br>
      الموسم الدراسي: ${academicYear}
    </div>
  </div>

  <div class="banner">
    <h2>لائحة توصيات التوجيه المدرسي والمهني بناءً على مؤشرات الأداء الرياضي</h2>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:18%;">اسم التلميذ(ة)</th>
        <th style="width:9%;">معدل الرياضيات</th>
        <th style="width:9%;">أعلى نقطة</th>
        <th style="width:24%;">التوجيه الأساسي الموصى به</th>
        <th style="width:20%;">البديل الثاني / المسالك الملائمة</th>
        <th style="width:20%;">ملاحظة التوجيه التربوي</th>
      </tr>
    </thead>
    <tbody>
      ${studentOrientations.map(({ student, orientation }) => `
        <tr>
          <td><strong>${student.name}</strong></td>
          <td style="text-align:center; font-weight:bold;">${student.avg ?? '-'}/20</td>
          <td style="text-align:center;">${student.bestMark ?? '-'}/20</td>
          <td><strong>${orientation.primaryPath}</strong></td>
          <td>${orientation.secondaryPath}</td>
          <td>${orientation.counselorNote}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 3000);
      }, 350);
    }
  };

  return (
    <div className="w-full space-y-5" dir="rtl">
      {/* Top Sub-Navigation Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-blue-950 text-white p-5 rounded-2xl shadow-md border border-indigo-500/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base md:text-lg font-black tracking-tight">
                  قطب الهندسة الديداكتيكية: مجلس القسم · التقويم التشخيصي · التوجيه المدرسي والمهني
                </h2>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  السلك الثانوي التأهيلي
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                توليد محاضر مجالس الأقسام الرسمية (A4)، حقيبة روائز التقويم التشخيصي لشتمبر، ونظام التوجيه المدرسي والمهني ومشروع التلميذ الشخصي
              </p>
            </div>
          </div>

          {/* 3 Section Switcher Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveSubSection('council_digest')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSubSection === 'council_digest'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                  : 'bg-white/10 hover:bg-white/20 text-slate-200 border border-white/15'
              }`}
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>1. محضر مجلس القسم الآلي</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubSection('diagnostic_toolkit')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSubSection === 'diagnostic_toolkit'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25'
                  : 'bg-white/10 hover:bg-white/20 text-slate-200 border border-white/15'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>2. حقيبة التقويم التشخيصي (شتمبر)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubSection('orientation_hub')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSubSection === 'orientation_hub'
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25'
                  : 'bg-white/10 hover:bg-white/20 text-slate-200 border border-white/15'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>3. التوجيه المدرسي والمهني</span>
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          SECTION 1: تقرير ومحضر مجلس القسم الآلي (Conseil de Classe Digest)
         ===================================================================== */}
      {activeSubSection === 'council_digest' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-emerald-600" />
                  <span>التقرير التركيبي الآلي لمجلس القسم — {classTitle} ({semesterTitle})</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  تصنيف آلي للتلاميذ حسب استحقاقات مجلس القسم (تنويه، تشجيع، لوحة الشرف، دعم إلزامي) مع إمكانية الطباعة الرسمية A4
                </p>
              </div>
              <button
                type="button"
                onClick={handlePrintCouncilDigest}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-sm cursor-pointer transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة محضر مجلس القسم الرسمي (A4)</span>
              </button>
            </div>

            {/* Statistical Homogeneity & Didactic Reading Banner (CV%) */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-slate-800">📐 القراءة الديداكتيكية ومؤشر تجانس القسم (Coefficient de Variation):</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${homogeneityAnalysis.badgeClass}`}>
                    {homogeneityAnalysis.statusLabel}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {homogeneityAnalysis.didacticReading}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 bg-white px-3.5 py-2 rounded-xl border border-slate-200">
                <div className="text-center">
                  <div className="text-[10px] font-bold text-slate-400">المعدل العام</div>
                  <div className="text-sm font-black text-indigo-900 font-mono">{classAverages.overall ?? '-'}/20</div>
                </div>
                <div className="h-6 w-px bg-slate-200"></div>
                <div className="text-center">
                  <div className="text-[10px] font-bold text-slate-400">الانحراف المعياري (σ)</div>
                  <div className="text-sm font-black text-slate-800 font-mono">{classAverages.stdDev ?? '-'}</div>
                </div>
                <div className="h-6 w-px bg-slate-200"></div>
                <div className="text-center">
                  <div className="text-[10px] font-bold text-slate-400">معامل الاختلاف (CV)</div>
                  <div className="text-sm font-black text-emerald-700 font-mono">{homogeneityAnalysis.cvPct !== null ? `${homogeneityAnalysis.cvPct}%` : '-'}</div>
                </div>
              </div>
            </div>

            {/* 6 Council Decision Tier Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-emerald-600" />
                    <span>تهنئة وتنويه (≥ 16/20)</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-600 text-white">
                    {councilCategories.feliciations.length} تلميذ(ة)
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800">
                  تلاميذ متميزون يتصدرون القسم ويتوفرون على كفايات استدلالية عالية (مرشحون لأولمبياد الرياضيات ومرافقة الأقران).
                </p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {councilCategories.feliciations.slice(0, 5).map(s => (
                    <span key={s.id} className="text-[11px] font-bold bg-white px-2 py-0.5 rounded border border-emerald-200 text-emerald-900">
                      {s.name} ({s.avg})
                    </span>
                  ))}
                  {councilCategories.feliciations.length === 0 && (
                    <span className="text-[11px] text-slate-400">لا يوجد في هذه الفئة حالياً</span>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-sky-950 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-sky-600" />
                    <span>تشجيع (14.00 إلى 15.99)</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-sky-600 text-white">
                    {councilCategories.encouragements.length} تلميذ(ة)
                  </span>
                </div>
                <p className="text-[11px] text-sky-800">
                  فئة ذات تحكم جيد جداً واستقرار في الفروض المحروسة، مؤهلة للارتقاء إلى فئة التميز.
                </p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {councilCategories.encouragements.slice(0, 5).map(s => (
                    <span key={s.id} className="text-[11px] font-bold bg-white px-2 py-0.5 rounded border border-sky-200 text-sky-900">
                      {s.name} ({s.avg})
                    </span>
                  ))}
                  {councilCategories.encouragements.length === 0 && (
                    <span className="text-[11px] text-slate-400">لا يوجد في هذه الفئة حالياً</span>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>لوحة الشرف (12.00 إلى 13.99)</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-600 text-white">
                    {councilCategories.tableauHonneur.length} تلميذ(ة)
                  </span>
                </div>
                <p className="text-[11px] text-indigo-800">
                  تحكم مستحسن في القواعد والتطبيقات المباشرة مع حاجة لتعميق مهارات المسائل المركبة.
                </p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {councilCategories.tableauHonneur.slice(0, 5).map(s => (
                    <span key={s.id} className="text-[11px] font-bold bg-white px-2 py-0.5 rounded border border-indigo-200 text-indigo-900">
                      {s.name} ({s.avg})
                    </span>
                  ))}
                  {councilCategories.tableauHonneur.length === 0 && (
                    <span className="text-[11px] text-slate-400">لا يوجد في هذه الفئة حالياً</span>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Scale className="w-4 h-4 text-slate-600" />
                    <span>تحكم متوسط ومستوفٍ (10 إلى 11.99)</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-700 text-white">
                    {councilCategories.passable.length} تلميذ(ة)
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  فئة هشة قريبة من عتبة الـ 10/20 تتطلب تثبيت المكتسبات لتفادي الانزلاق نحو التعثر في الفروض المقبلة.
                </p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {councilCategories.passable.slice(0, 5).map(s => (
                    <span key={s.id} className="text-[11px] font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800">
                      {s.name} ({s.avg})
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>دعم استدراكي إلزامي (08 إلى 09.99)</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-600 text-white">
                    {councilCategories.mandatorySupport.length} تلميذ(ة)
                  </span>
                </div>
                <p className="text-[11px] text-amber-900">
                  فئة أولوية قصوى للدعم المندمج والتمارين العلاجية لرفع المعدل فوق عتبة النجاح (10/20).
                </p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {councilCategories.mandatorySupport.slice(0, 5).map(s => (
                    <span key={s.id} className="text-[11px] font-bold bg-white px-2 py-0.5 rounded border border-amber-300 text-amber-950">
                      {s.name} ({s.avg})
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-rose-50/80 border border-rose-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-rose-950 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span>تعثر حاد وتدخل مستعجل (&lt; 08/20)</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white">
                    {councilCategories.criticalAlert.length} تلميذ(ة)
                  </span>
                </div>
                <p className="text-[11px] text-rose-900">
                  يستلزم خطة معالجة فردية وتنسيقاً مع الإدارة التربوية وأولياء الأمور لمعالجة النقائص القبلية والغياب.
                </p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {councilCategories.criticalAlert.slice(0, 5).map(s => (
                    <span key={s.id} className="text-[11px] font-bold bg-white px-2 py-0.5 rounded border border-rose-300 text-rose-950">
                      {s.name} ({s.avg})
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Editable Teacher Pedagogical Synthesis for Class Council */}
            <div className="pt-3 border-t border-slate-100">
              <label className="block text-xs font-black text-slate-800 mb-1.5">
                ✍️ التوصيات والملاحظات البيداغوجية للأستاذ(ة) المرفوعة لمجلس القسم (تُدرج في المحضر المطبوع):
              </label>
              <textarea
                rows={3}
                value={councilCustomNotes}
                onChange={e => setCouncilCustomNotes(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="اكتب خلاصة تشخيص القسم وتوصيات مجلس القسم..."
              />
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SECTION 2: حقيبة التقويم التشخيصي وأسابيع الدعم (Diagnostic Assessment)
         ===================================================================== */}
      {activeSubSection === 'diagnostic_toolkit' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-amber-600" />
                  <span>حقيبة التقويم التشخيصي وخريطة العوائق الإبستيمولوجية (مفتتح الموسم الدراسي - شتنبر)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  روائز تشخيصية جاهزة للطباعة وشبكات جرد المكتسبات القبلية وتخطيط أسابيع الدعم الاستدراكي المندمج
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <select
                  value={selectedDiagnosticLevel}
                  onChange={e => setSelectedDiagnosticLevel(e.target.value)}
                  className="text-xs font-bold p-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {Object.values(DIAGNOSTIC_BLUEPRINTS).map(bp => (
                    <option key={bp.code} value={bp.code}>
                      {bp.levelTitle}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleOpenDiagnosticGridInReports}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-xs shadow-sm cursor-pointer transition-colors"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>فتح شبكة تفريغ نقط الرائز (تبويب التقارير)</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintDiagnosticTest}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-sm cursor-pointer transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة الرائز التشخيصي وشبكة التفريغ (A4)</span>
                </button>
              </div>
            </div>

            {/* Live Class Diagnostic Profiling Summary (Synced with db.diagnostic) */}
            <div className="p-4 rounded-2xl bg-gradient-to-l from-amber-50/80 via-slate-50 to-sky-50/70 border border-amber-200/80 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>الحصيلة التشخيصية الفعلية وتفييء المتعلمين للقسم ({classTitle})</span>
                  </h4>
                  <p className="text-[11px] text-slate-600">
                    متزامنة تلقائياً مع شبكة تفريغ الروائز التشخيصية ومقارنة بالمعدل الحالي للمراقبة المستمرة لقياس أثر الدعم الاستدراكي
                  </p>
                </div>
                {diagnosticLiveSummary.netImpact !== null && (
                  <div className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 ${
                    diagnosticLiveSummary.netImpact >= 0
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : 'bg-rose-100 text-rose-900 border-rose-300'
                  }`}>
                    {diagnosticLiveSummary.netImpact >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    <span>أثر الدعم بعد التشخيص: {diagnosticLiveSummary.netImpact >= 0 ? `+${diagnosticLiveSummary.netImpact}` : diagnosticLiveSummary.netImpact} نقطة</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
                <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-center">
                  <div className="text-[10px] font-bold text-slate-500">معدل الرائز التشخيصي</div>
                  <div className="text-sm font-black text-slate-900 font-mono mt-0.5">{diagnosticLiveSummary.avgDiagnostic ?? '-'}/20</div>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <div className="text-[10px] font-bold text-emerald-800">الفئة (أ) متمكن ≥12</div>
                  <div className="text-sm font-black text-emerald-700 font-mono mt-0.5">{diagnosticLiveSummary.groupA} تلميذ</div>
                </div>
                <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-center">
                  <div className="text-[10px] font-bold text-sky-800">الفئة (ب) طور التمكن</div>
                  <div className="text-sm font-black text-sky-700 font-mono mt-0.5">{diagnosticLiveSummary.groupB} تلميذ</div>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-center">
                  <div className="text-[10px] font-bold text-rose-800">الفئة (ج) متعثر &lt;8</div>
                  <div className="text-sm font-black text-rose-700 font-mono mt-0.5">{diagnosticLiveSummary.groupC} تلميذ</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-center">
                  <div className="text-[10px] font-bold text-slate-500">الحساب العددي (/5)</div>
                  <div className="text-sm font-black text-indigo-700 font-mono mt-0.5">{diagnosticLiveSummary.avgD1}/5</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-center">
                  <div className="text-[10px] font-bold text-slate-500">الهندسة والقياس (/5)</div>
                  <div className="text-sm font-black text-indigo-700 font-mono mt-0.5">{diagnosticLiveSummary.avgD2}/5</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-center">
                  <div className="text-[10px] font-bold text-slate-500">الجبر والتحليل (/5)</div>
                  <div className="text-sm font-black text-indigo-700 font-mono mt-0.5">{diagnosticLiveSummary.avgD3}/5</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-center">
                  <div className="text-[10px] font-bold text-slate-500">حل المسائل (/5)</div>
                  <div className="text-sm font-black text-indigo-700 font-mono mt-0.5">{diagnosticLiveSummary.avgD4}/5</div>
                </div>
              </div>
            </div>

            {/* Prerequisite Domains & Epistemological Obstacles Table */}
            <div>
              <h4 className="text-xs font-black text-slate-800 mb-3 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-blue-600" />
                <span>1. مصفوفة المكتسبات القبلية والعوائق الديداكتيكية وأنشطة الدعم المندمج ({currentDiagnostic.levelTitle})</span>
              </h4>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white font-bold">
                      <th className="p-3 border-l border-slate-700">المجال المعرفي القبلي</th>
                      <th className="p-3 border-l border-slate-700 text-center w-20">الوزن</th>
                      <th className="p-3 border-l border-slate-700">المهارات والقدرات المستهدفة في الرائز</th>
                      <th className="p-3 border-l border-slate-700">العوائق الإبستيمولوجية والأخطاء الشائعة</th>
                      <th className="p-3">تديير حصص الدعم الاستدراكي (شتمبر)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {currentDiagnostic.prerequisites.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 font-black text-slate-900">{p.domain}</td>
                        <td className="p-3 text-center font-mono font-black text-blue-700 bg-blue-50/40">{p.weightPct}%</td>
                        <td className="p-3">
                          <ul className="list-disc list-inside space-y-1 text-slate-700">
                            {p.skills.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </td>
                        <td className="p-3 text-rose-800 bg-rose-50/30 font-medium">{p.epistemologicalObstacles}</td>
                        <td className="p-3 text-emerald-900 bg-emerald-50/30 font-semibold">{p.remediationActivity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ready-to-Print Diagnostic Exercises Preview */}
            <div>
              <h4 className="text-xs font-black text-slate-800 mb-3 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-emerald-600" />
                <span>2. بنية تمارين الرائز التشخيصي المقترح (جاهز للطباعة الفورية وتوزيعه على التلاميذ)</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {currentDiagnostic.sampleQuestions.map(q => (
                  <div key={q.num} className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="font-black text-xs text-blue-950">
                        التمرين {q.num}: {q.domain}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-blue-100 text-blue-800">
                        {q.points} نقط
                      </span>
                    </div>
                    <p className="text-xs text-slate-800 font-semibold leading-relaxed">
                      {q.questionText}
                    </p>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1 pt-1">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>الكفاية المستهدفة: {q.expectedCompetency}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SECTION 3: التوجيه المدرسي والمهني ومواكبة المشروع الشخصي للتلميذ
         ===================================================================== */}
      {activeSubSection === 'orientation_hub' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Compass className="w-5 h-5 text-sky-600" />
                  <span>نظام التوجيه المدرسي والمهني ومواكبة المشروع الشخصي للتلميذ — {classTitle}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  تحليل استشرافي لمؤهلات كل تلميذ(ة) في الرياضيات لاقتراح الشعب والمسالك والمدارس العليا لما بعد البكالوريا
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                  {[
                    { id: 'TCS', label: 'توجيه الجذع المشترك (نحو 1 باك)' },
                    { id: '1BAC', label: 'توجيه 1 باك (نحو 2 باك)' },
                    { id: '2BAC', label: 'توجيه 2 باك (المدارس العليا والجامعات)' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setOrientationLevel(tab.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        orientationLevel === tab.id
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handlePrintOrientationReport}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-xs shadow-sm cursor-pointer transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة بطاقة التوجيه الشاملة للقسم (A4)</span>
                </button>
              </div>
            </div>

            {/* Orientation Reference Guide Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 bg-gradient-to-l from-sky-50 via-indigo-50/40 to-emerald-50/40 p-4 rounded-xl border border-sky-200/80">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-900">العتبة الرياضية لشعبة العلوم الرياضية</div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    يُنصح بمعدل ≥ 14.5/20 مع تطور إيجابي وقدرة على البرهان والاستدلال في الهندسة والجبر (معامل 7 في 1 باك ومعامل 9 في 2 باك).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-900">مسالك العلوم التجريبية والتكنولوجية (PC / SVT / STE)</div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    تتطلب تحكماً متوازناً (≥ 11.5/20) في دراسة الدوال والمتتاليات والأعداد العقدية وحساب الاحتمالات (معامل 7).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-900">المدارس العليا لما بعد البكالوريا (CPGE / ENSA / FMP / ENCG)</div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    الرياضيات تمثل الركيزة الحاسمة في الانتقاء الأولي وفي المباريات الكتابية للمعاهد الهندسية والطبية والتجارية.
                  </p>
                </div>
              </div>
            </div>

            {/* Search Filter */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={orientationSearch}
                  onChange={e => setOrientationSearch(e.target.value)}
                  placeholder="ابحث عن تلميذ(ة) بالاسم أو رقم مسار لمعاينة بطاقة توجيهه..."
                  className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <span className="text-xs font-bold text-slate-500">
                عدد بطاقات التوجيه المعروضة: <strong className="text-slate-900">{studentOrientations.length}</strong>
              </span>
            </div>

            {/* Student Orientation Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold">
                    <th className="p-3 border-l border-slate-700">اسم التلميذ(ة)</th>
                    <th className="p-3 border-l border-slate-700 text-center">معدل الرياضيات</th>
                    <th className="p-3 border-l border-slate-700 text-center">أعلى فرض (الذروة)</th>
                    <th className="p-3 border-l border-slate-700">التوجيه الأساسي المقترح (الخيار الأول)</th>
                    <th className="p-3 border-l border-slate-700">آفاق ما بعد البكالوريا والمدارس العليا</th>
                    <th className="p-3 border-l border-slate-700 text-center">مؤشر الملاءمة</th>
                    <th className="p-3 border-l border-slate-700">توصية مستشار التوجيه وأستاذ المادة</th>
                    <th className="p-3 text-center">بطاقة فردية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {studentOrientations.map(({ student, orientation }) => (
                    <tr key={student.id} className="hover:bg-slate-50/90 transition-colors">
                      <td className="p-3 font-black text-slate-900">
                        <div>{student.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{student.className}</div>
                      </td>
                      <td className="p-3 text-center font-mono font-black text-sm">
                        <span className={student.avg !== null && student.avg >= 10 ? 'text-blue-700' : 'text-rose-600'}>
                          {student.avg !== null ? `${student.avg}/20` : '-'}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-amber-700">
                        {student.bestMark !== null ? `${student.bestMark}/20` : '-'}
                      </td>
                      <td className="p-3">
                        <div className="font-black text-slate-900">{orientation.primaryPath}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          البديل الثاني: {orientation.secondaryPath}
                        </div>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${orientation.profileColor}`}>
                          {orientation.profileBadge}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {orientation.postBacTracks.map((t, i) => (
                            <span key={i} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-center font-mono font-black">
                        <span className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 border border-sky-200">
                          {orientation.confidencePct}%
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 leading-relaxed max-w-xs">
                        {orientation.counselorNote}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handlePrintSingleStudentOrientation(student, orientation)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold text-[11px] cursor-pointer transition-colors"
                          title="طباعة بطاقة المشروع الشخصي والتوجيه المدرسي الفردية للتلميذ(ة) وولي الأمر (A4)"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>بطاقة A4</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
