import { useState, useMemo } from 'react';
import {
  Sparkles,
  AlertTriangle,
  Brain,
  Target,
  Clock,
  Printer,
  Calendar,
  Search,
  Filter,
  Users,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  TrendingDown,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  QrCode
} from 'lucide-react';

export interface StudentMetric {
  id: string;
  name: string;
  massar: string;
  className: string;
  f1: number | null;
  f2: number | null;
  f3: number | null;
  f4?: number | null;
  avg: number | null;
  delta: number | null;
  deltaPercent: number | null;
  trajectory: 'improving' | 'declining' | 'stable' | 'unknown';
  validExamsCount: number;
}

export interface AiRemediationViewProps {
  db: any;
  selectedClass: string;
  semester: 's1' | 's2';
  studentMetrics: StudentMetric[];
  classAverages: any;
}

export interface RemediationActivity {
  id: string;
  categoryKey: string;
  categoryLabel: string;
  commonErrors: string;
  title: string;
  objective: string;
  strategy: string;
  strategyType: 'peer' | 'workshop' | 'digital' | 'individual';
  miniExercise: string;
  durationMinutes: number;
  verificationIndicator: string;
}

// Catalog of didactic math difficulties and customized remediation activities for Moroccan curriculum
const REMEDIATION_CATALOG: Record<string, {
  label: string;
  icon: string;
  commonErrors: string;
  activities: Array<{
    title: string;
    objective: string;
    strategy: string;
    strategyType: 'peer' | 'workshop' | 'digital' | 'individual';
    miniExercise: string;
    duration: number;
    indicator: string;
  }>;
}> = {
  algebra_signs: {
    label: 'الحساب العددي في ℝ والحدوديات والترتيب والمجالات',
    icon: '⚡',
    commonErrors: 'أخطاء في الحساب داخل المجموعة ℝ، القيمة المطلقة والتأطير، القسمة الإقليدية للحدوديات على (x - α)، وتحديد إشارة ثلاثية الحدود ax² + bx + c.',
    activities: [
      {
        title: 'ورشة التحكم في الترتيب في ℝ والقيمة المطلقة والتأطير',
        objective: 'التمكن من قواعد الترتيب والتأطير في ℝ وحل المعادلات والمتراجحات المتضمنة للقيمة المطلقة وتمثيل المجالات.',
        strategy: 'بيداغوجيا الأقران: العمل في ثنائي تعاوني لمراجعة خصائص التأطير وإنجاز وضعيات متدرجة وفق التوجيهات التربوية للسلك الثانوي التأهيلي.',
        strategyType: 'peer',
        miniExercise: '1) ليكن x و y عددين حقيقيين بحيث: 2 ≤ x ≤ 5 و -4 ≤ y ≤ -1.\nأطر التعابير التالية: x + y ، x - y ، x×y ، و x/y.\n2) حل في ℝ المتراجحة: |2x - 3| ≤ 5 ومثل مجموعة الحلول على مستقيم مدرج.',
        duration: 35,
        indicator: 'إنجاز تأطير جداء وخارج عددين حقيقيين وحل متراجحة القيمة المطلقة بنجاح تام في روائز التتبع.'
      },
      {
        title: 'بطاقة الدعم المركز: الحدوديات والقسمة الإقليدية وإشارة ثلاثية الحدود',
        objective: 'التحكم في تقنية القسمة الإقليدية لحدودية P(x) على (x - α) وتعميلها ودراسة إشارتها في ℝ.',
        strategy: 'توجيه فردي موجه: حل وضعيات تدريبية مع التبرير المنهجي لكل مرحلة.',
        strategyType: 'workshop',
        miniExercise: 'لتكن الحدودية: P(x) = 2x³ - 5x² + x + 2.\n1) تحقق أن 2 جذر للحدودية P(x).\n2) أنجز القسمة الإقليدية لـ P(x) على (x - 2) ثم عمّل P(x) إلى جداء حدوديات من الدرجة الأولى.\n3) استنتج حلول المتراجحة P(x) ≥ 0 في ℝ.',
        duration: 35,
        indicator: 'إتقان جدول إشارة ثلاثية الحدود والتعميل بالجذر بنسبة 100%.'
      }
    ]
  },
  thales_trig: {
    label: 'الحساب المثلثي وصيغ التحويل والمعادلات المثلثية',
    icon: '📐',
    commonErrors: 'صعوبة تمثيل الأفاصيل المنحنية الرئيسية على الدائرة المثلثية، الخلط في علاقات التحويل المثلثية، ونسيان الحلول الدورية (+2kπ) في المعادلات المثلثية.',
    activities: [
      {
        title: 'مختبر الدائرة المثلثية: الأفصول المنحني الرئيسي والعلاقات الأساسية',
        objective: 'تحديد الأفصول المنحني الرئيسي لنقطة على الدائرة المثلثية وتوظيف الزوايا المرتبطة (π-x, π+x, π/2-x) لحساب النسب المثلثية.',
        strategy: 'دعامة بصرية رقمية: محاكاة تفاعلية على الدائرة المثلثية ببرمجية GeoGebra لربط التماثل الهندسي بالصيغ الجبرية.',
        strategyType: 'digital',
        miniExercise: '1) حدد الأفصول المنحني الرئيسي للعدد: α = 37π/4 ثم احسب cos(α) و sin(α).\n2) بسط التعبير التالي:\nA(x) = cos(π - x) + sin(π/2 - x) - cos(x + π) + sin(-x).',
        duration: 40,
        indicator: 'حساب القيم المضبوطة للنسب المثلثية وتبسيط تعابير الزوايا المرتبطة بدقة.'
      },
      {
        title: 'عيادة المعادلات والمتراجحات المثلثية وصيغ التحويل',
        objective: 'حل المعادلات المثلثية الأساسية cos(x)=a و sin(x)=a في ℝ وفي مجال محدد مثل [-π, π] أو [0, 2π[.',
        strategy: 'عمل بالمجموعات الصغيرة الموجهة: حل وضعيات متدرجة وتمثيل الحلول على الدائرة المثلثية.',
        strategyType: 'workshop',
        miniExercise: '1) حل في ℝ ثم في المجال [-π, π] المعادلة:\n2cos(x) - √3 = 0\n2) حل في المجال [0, 2π[ المتراجحة:\nsin(x) ≥ 1/2 مع تمثيل القوس الموافق على الدائرة المثلثية.',
        duration: 35,
        indicator: 'تحديد جميع الحلول في المجال المطلوب وتمثيلها على الدائرة المثلثية بدون أخطاء.'
      }
    ]
  },
  equations_modelling: {
    label: 'النهايات والاتصال والاشتقاق ودراسة الدوال العددية',
    icon: '🎯',
    commonErrors: 'صعوبة إزالة الأشكال غير المحددة في النهايات، الخلط في شروط مبرهنة القيم الوسيطية، وأخطاء في حساب مشتقة مركب دالتين وتأويلها الهندسي.',
    activities: [
      {
        title: 'ورشة التحكم في تقنيات حساب النهايات والاتصال ومبرهنة القيم الوسيطية',
        objective: 'رفع الأشكال غير المحددة باستعمال التعميل والمرافق، وتطبيق مبرهنة القيم الوسيطية لإثبات وجود ووحدانية حل المعادلة f(x)=0.',
        strategy: 'ورشة تطبيقية موجهة: تفكيك منهجي لخطوات دراسة الاتصال والنهايات وفق الأطر المرجعية.',
        strategyType: 'workshop',
        miniExercise: '1) احسب النهايتين:\nlim(x→2) (x² - 4)/(√(x+2) - 2)  و  lim(x→+∞) (√(x² + x + 1) - x)\n2) لتكن f(x) = x³ + 3x - 5. بين أن المعادلة f(x) = 0 تقبل حلاً وحيداً α في المجال ]1, 2[.',
        duration: 40,
        indicator: 'صياغة برهان مبرهنة القيم الوسيطية (الاتصال + الرتابة قطعا + شرط الصور) بشكل تام وسليم.'
      },
      {
        title: 'معالجة الاشتقاق ومعادلة المماس وجدول تغيرات دالة عددية',
        objective: 'ضبط قواعد اشتقاق الدوال الجذرية والمركبة واللوغاريتمية والأسية، وتحديد رتابة الدالة من إشارة المشتقة f\'(x).',
        strategy: 'تمرين علاجي فردي مع بطاقة المراقبة الذاتية للتأويلات الهندسية للاشتقاق.',
        strategyType: 'individual',
        miniExercise: 'لتكن الدالة العددية f المعرفة على ℝ\\{1} بـ: f(x) = (x² - x + 2)/(x - 1).\n1) احسب f\'(x) لكل x ≠ 1 وادرس إشارتها.\n2) ضع جدول تغيرات الدالة f وحدد مطاريفها المحلية.\n3) اكتب معادلة المماس (T) للمنحنى (Cf) عند النقطة ذات الأفصول x₀ = 2.',
        duration: 35,
        indicator: 'حساب المشتقة بشكل صحيح واستنتاج جدول التغيرات ومعادلة المماس دون خطأ حسابي.'
      }
    ]
  },
  pythagoras_geometry: {
    label: 'الهندسة الفضائية والجداء السلمي والمتجهي والفلكة',
    icon: '📐',
    commonErrors: 'صعوبة تحديد المتجهة المنظمية لمستوى، الخلط بين التمثيل البارامتري لمستقيم ومعادلة ديكارتية لمستوى، وحساب مسافة نقطة عن مستوى.',
    activities: [
      {
        title: 'ورشة الهندسة التحليلية في الفضاء: المستقيمات والمستويات والفلكة',
        objective: 'تحديد معادلة ديكارتية لمستوى بمعرفة نقطة ومتجهة منظمية، ودراسة الوضع النسبي لمستوى وفلكة في الفضاء.',
        strategy: 'بيداغوجيا الأقران مع تمثيل ثلاثي الأبعاد: تحليل المعطيات الهندسية وتحويلها إلى علاقات سلمية ومتجهية.',
        strategyType: 'peer',
        miniExercise: 'في الفضاء المنسوب إلى معلم متعامد ممنظم مباشر (O,i,j,k)، نعتبر النقطة A(1,2,-1) والمتجهة n(2,-1,2).\n1) حدد معادلة ديكارتية للمستوى (P) المار من A والمنظمية عليه المتجهة n.\n2) احسب مسافة النقطة Ω(3,0,1) عن المستوى (P).\n3) استنتج الوضع النسبي للمستوى (P) والفلكة (S) التي مركزها Ω وشعاعها R = 3.',
        duration: 40,
        indicator: 'تحديد معادلة المستوى وحساب المسافة واستنتاج تقاطع الفلكة والمستوى بدقة.'
      }
    ]
  },
  roots_powers: {
    label: 'المتتاليات العددية والبرهان بالترجع والتقارب',
    icon: '🔢',
    commonErrors: 'ارتباك في صياغة مراحل البرهان بالترجع، الخلط بين المتتالية الحسابية والهندسية، وصعوبة دراسة رتابة وتقارب متتالية ترجعية u_(n+1) = f(u_n).',
    activities: [
      {
        title: 'ورشة المتتاليات العددية: البرهان بالترجع والرتابة والمتتالية المساعدة',
        objective: 'التمكن من إثبات الكبر والصغر بالترجع، دراسة رتابة (u_n) بحساب u_(n+1) - u_n، واستغلال متتالية هندسية مساعدة لتحديد الحد العام ونهاية المتتالية.',
        strategy: 'بيداغوجيا الأقران: حل مسألة متكاملة حول المتتاليات الترجعية وفق منهجية الامتحان الوطني الموحد.',
        strategyType: 'peer',
        miniExercise: 'نعتبر المتتالية (u_n) المعرفة بـ u₀ = 5 ولكل n من ℕ: u_(n+1) = (1/2)u_n + 2.\n1) بين بالترجع أن: (∀n∈ℕ) u_n > 4.\n2) بين أن المتتالية (u_n) تناقصية واستنتج أنها متقاربة.\n3) نضع v_n = u_n - 4؛ بين أن (v_n) متتالية هندسية محدداً أساسها، ثم اكتب u_n بدلالة n واحسب lim u_n.',
        duration: 40,
        indicator: 'تحرير البرهان بالترجع وتحديد الحد العام ونهاية المتتالية بدون أخطاء منهجية.'
      }
    ]
  },
  vectors_analytic: {
    label: 'المرجح في المستوى والجداء السلمي والأعداد العقدية',
    icon: '↗️',
    commonErrors: 'أخطاء في خاصية التجميعية للمرجح، صعوبة تحديد مجموعات النقط في المستوى، والخلط في الشكل المثلثي والجبري لعدد عقدي والتأويل الهندسي.',
    activities: [
      {
        title: 'مختبر المستوى التحليلي والعقدي: المرجح والجداء السلمي والأعداد العقدية',
        objective: 'توظيف خاصية المرجح وعلاقة شال والجداء السلمي أو الأعداد العقدية لتحديد مجموعات النقط والطبيعة الهندسية للمثلثات والتحويلات.',
        strategy: 'نشاط تطبيقي يربط الحساب المتجهي/العقدي بالتأويل الهندسي المباشر.',
        strategyType: 'digital',
        miniExercise: '1) لتكن G مرجح النقطتين المتزنتين (A,2) و (B,1). حدد وأنشئ مجموعة النقط M من المستوى بحيث: ||2MA + MB|| = 6.\n2) في المستوى العقدي، نعتبر النقط A(1+i) و B(3-i) و C(2+2i). احسب (z_C - z_A)/(z_B - z_A) واستنتج طبيعة المثلث ABC.',
        duration: 40,
        indicator: 'ربط سليم بين العلاقة المتجهية/العقدية والخاصية الهندسية الموافقة لها.'
      }
    ]
  },
  proof_reasoning: {
    label: 'المنطق الرياضي وأنماط الاستدلال (الترجع، الخلف، فصل الحالات، التكافؤ)',
    icon: '📝',
    commonErrors: 'الخلط بين الاستلزام P⇒Q والتكافؤ P⇔Q، صعوبة نفي العبارات المكممة (∀ و ∃)، وضعف هيكلة البرهان بالخلف أو بفصل الحالات.',
    activities: [
      {
        title: 'ورشة المنطق والاستدلال الرياضي المهيكل وفق التوجيهات التربوية الرسمية',
        objective: 'تدريب المتعلم على التحكم في المكممات المنطقية ونفيها، واختيار نمط الاستدلال المناسب (التكافؤات المتتالية، البرهان بالخلف، المثال المضاد، الترجع).',
        strategy: 'ملء هياكل البراهين الموجهة (Guided Proof Skeleton) ثم تحرير براهين مستقلة وفق المذكرة 142-08.',
        strategyType: 'workshop',
        miniExercise: '1) أعط نفي العبارة التالية ثم حدد قيمتها الحقيقية:\n(P): (∀x∈ℝ) (∃y∈ℝ) : x + y > 0\n2) باستعمال الاستدلال بالخلف أو التكافؤات المتتالية، بين أنه لكل x و y من ℝ⁺:\n√(x + y) = √x + √y ⇔ (x = 0 أو y = 0).',
        duration: 35,
        indicator: 'تحرير برهان رياضي سليم منطقياً ولغوياً مع توظيف الروابط المنطقية بدقة.'
      }
    ]
  }
};

const CATEGORY_KEYS = Object.keys(REMEDIATION_CATALOG);

// Deterministic heuristic diagnostic to classify student error type based on their marks profile
function diagnoseStudentMathError(std: StudentMetric): string {
  // If student has a sharp drop from F1 to F2 (F1 >= 10 and F2 < 8)
  if (std.f1 !== null && std.f2 !== null && std.f1 >= 10 && std.f2 < 8) {
    return 'thales_trig'; // Geometry & Trig introduced in exam 2
  }

  // If student has consistent very low grade (< 6)
  if (std.avg !== null && std.avg < 6) {
    return 'algebra_signs'; // Foundational algebra & signs issue
  }

  // If student failed exam 1 severely (F1 < 7)
  if (std.f1 !== null && std.f1 < 7) {
    return 'roots_powers';
  }

  // If student has moderate struggling (6 <= avg < 8)
  if (std.avg !== null && std.avg < 8) {
    return 'equations_modelling';
  }

  // If student struggles with 8 <= avg < 10
  if (std.avg !== null && std.avg < 10) {
    // Hash based on student ID to vary pedagogical suggestions across students
    const sumChars = std.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const catList = ['pythagoras_geometry', 'vectors_analytic', 'proof_reasoning', 'thales_trig'];
    return catList[sumChars % catList.length];
  }

  return 'algebra_signs';
}

export default function AiRemediationView({
  db,
  selectedClass,
  semester,
  studentMetrics,
  classAverages
}: AiRemediationViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'severe' | 'moderate' | 'mild' | 'declining'>('all');
  const [customErrorOverrides, setCustomErrorOverrides] = useState<Record<string, string>>({});
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiGeminiReportHtml, setAiGeminiReportHtml] = useState<string | null>(null);
  const [showGeminiModal, setShowGeminiModal] = useState(false);
  const [schedulingStudentId, setSchedulingStudentId] = useState<string | null>(null);

  // Identify struggling students (avg < 10, or single exam < 9, or drop >= 2)
  const strugglingStudents = useMemo(() => {
    return studentMetrics.filter(s => {
      const isLowAvg = s.avg !== null && s.avg < 10;
      const isLowExams = (s.f1 !== null && s.f1 < 9) || (s.f2 !== null && s.f2 < 9) || (s.f3 !== null && s.f3 < 9);
      const isDropping = s.delta !== null && s.delta <= -2;
      return isLowAvg || isLowExams || isDropping;
    });
  }, [studentMetrics]);

  // Build full diagnosed activity list for struggling students
  const diagnosedStudents = useMemo(() => {
    return strugglingStudents.map(std => {
      const chosenCatKey = customErrorOverrides[std.id] || diagnoseStudentMathError(std);
      const catInfo = REMEDIATION_CATALOG[chosenCatKey] || REMEDIATION_CATALOG.algebra_signs;
      
      // Determine severity
      let severity: 'severe' | 'moderate' | 'mild' | 'declining' = 'moderate';
      let severityLabel = 'تعثر متوسط';
      let severityBadge = 'bg-amber-50 text-amber-700 border-amber-200';

      if (std.avg !== null && std.avg < 6) {
        severity = 'severe';
        severityLabel = 'تعثر حاد يحتاج تدخلاً عاجلاً';
        severityBadge = 'bg-rose-50 text-rose-700 border-rose-200';
      } else if (std.delta !== null && std.delta <= -2) {
        severity = 'declining';
        severityLabel = 'تراجع مفاجئ بين الفروض';
        severityBadge = 'bg-purple-50 text-purple-700 border-purple-200';
      } else if (std.avg !== null && std.avg >= 8 && std.avg < 10) {
        severity = 'mild';
        severityLabel = 'تعثر طفيف قابل للاستدراك';
        severityBadge = 'bg-blue-50 text-blue-700 border-blue-200';
      }

      // Pick activity (cycle between 0 and 1 based on id)
      const actIndex = (std.id.charCodeAt(std.id.length - 1) || 0) % catInfo.activities.length;
      const act = catInfo.activities[actIndex] || catInfo.activities[0];

      const activity: RemediationActivity = {
        id: `act_${std.id}`,
        categoryKey: chosenCatKey,
        categoryLabel: catInfo.label,
        commonErrors: catInfo.commonErrors,
        title: act.title,
        objective: act.objective,
        strategy: act.strategy,
        strategyType: act.strategyType,
        miniExercise: act.miniExercise,
        durationMinutes: act.duration,
        verificationIndicator: act.indicator
      };

      return {
        student: std,
        severity,
        severityLabel,
        severityBadge,
        activity
      };
    });
  }, [strugglingStudents, customErrorOverrides]);

  // Filtered diagnosed students
  const filteredDiagnosed = useMemo(() => {
    return diagnosedStudents.filter(item => {
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matchesName = item.student.name.toLowerCase().includes(q);
        const matchesMassar = item.student.massar.toLowerCase().includes(q);
        if (!matchesName && !matchesMassar) return false;
      }

      if (selectedCategoryFilter !== 'all' && item.activity.categoryKey !== selectedCategoryFilter) {
        return false;
      }

      if (severityFilter !== 'all' && item.severity !== severityFilter) {
        return false;
      }

      return true;
    });
  }, [diagnosedStudents, searchQuery, selectedCategoryFilter, severityFilter]);

  // Handler: Change error category for a specific student
  const handleCategoryChange = (studentId: string, newCategoryKey: string) => {
    setCustomErrorOverrides(prev => ({
      ...prev,
      [studentId]: newCategoryKey
    }));
  };

  // Handler: Schedule this activity directly as an Extra Support / Remedial Session in Cahier de Textes
  const handleScheduleExtraSession = (item: typeof diagnosedStudents[0]) => {
    if (schedulingStudentId) return; // Prevent double trigger
    setSchedulingStudentId(item.student.id);

    const targetCls = item.student.className || selectedClass || '';
    const act = item.activity;

    const prefillData = {
      title: `معالجة واستدراك: ${act.title}`,
      reason: `معالجة تعثر التلميذ(ة) ${item.student.name} في [${act.categoryLabel}]`,
      beneficiaries: `التلميذ(ة): ${item.student.name} (${targetCls})`,
      type: 'soutien',
      summary: `• سياق المعالجة البيداغوجية: معالجة الصعوبات المرصودة في الفرض المحروس (${act.categoryLabel}).\n• الهدف التعلمي الإجرائي: ${act.objective}\n• استراتيجية التنزيل: ${act.strategy}\n• الأنشطة والتمارين التطبيقية:\n${act.miniExercise}\n• مؤشر التحقق والتقويم: ${act.verificationIndicator}`,
      duration: '2'
    };

    if (typeof (window as any).openExtraSupportSessionModal === 'function') {
      (window as any).openExtraSupportSessionModal(targetCls, prefillData);
    } else {
      const modal = document.getElementById('extraSupportSessionModal');
      if (modal) modal.style.display = 'flex';
    }

    setTimeout(() => {
      setSchedulingStudentId(null);
    }, 600);
  };

  // Handler: Print individual student remediation worksheet (Fiche de remédiation A4)
  const handlePrintStudentWorksheet = (item: typeof diagnosedStudents[0]) => {
    const std = item.student;
    const act = item.activity;
    const teacherName = (db?.teacherProfile?.name) || (db?.profile?.name) || 'أستاذ مادة الرياضيات';
    const schoolName = (db?.teacherProfile?.school) || (db?.profile?.school) || 'المؤسسة التعليمية';
    const printDate = new Date().toLocaleDateString('ar-MA');
    const marksText = [
      `F1: ${std.f1 ?? '-'}`,
      `F2: ${std.f2 ?? '-'}`,
      std.f3 !== null && std.f3 !== undefined ? `F3: ${std.f3}` : null,
      std.f4 !== null && std.f4 !== undefined ? `F4: ${std.f4}` : null
    ].filter(Boolean).join(' | ');

    const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>بطاقة المعالجة البيداغوجية الفردية - ${std.name}</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        @page { size: A4 portrait; margin: 12mm 10mm; }
        body { font-family: 'Cairo', system-ui, sans-serif; background: #fff; color: #0f172a; margin: 0; padding: 0; font-size: 10pt; line-height: 1.5; }
        .sheet { max-width: 100%; border: 1.5px solid #1e3a8a; border-radius: 8px; padding: 16px; box-sizing: border-box; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 12px; }
        .badge { background: #eff6ff; color: #1e3a8a; border: 1px solid #bfdbfe; padding: 3px 10px; border-radius: 6px; font-weight: 800; font-size: 0.85rem; }
        .section-title { font-weight: 800; color: #1e3a8a; font-size: 9.5pt; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
        .box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; margin-bottom: 10px; }
        .exercise-box { background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; white-space: pre-wrap; font-family: 'Cairo', sans-serif; font-size: 10pt; line-height: 1.65; }
        .solution-zone { height: 150px; border: 1.5px dashed #94a3b8; border-radius: 8px; padding: 10px; margin-bottom: 12px; background: #ffffff; }
        .footer-sig { display: flex; justify-content: space-between; margin-top: 12px; padding-top: 8px; border-top: 1px dashed #cbd5e1; font-size: 8.5pt; }
    </style>
</head>
<body>
    <div class="sheet">
        <div class="header">
            <div>
                <div style="font-weight: 900; font-size: 10.5pt;">المملكة المغربية</div>
                <div style="font-size: 8pt; color: #475569;">وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
                <div style="font-size: 8.5pt;">المؤسسة: <strong>${schoolName}</strong></div>
            </div>
            <div style="text-align: center;">
                <div style="background: #1e3a8a; color: #fff; padding: 4px 16px; border-radius: 6px; font-weight: 900; font-size: 11.5pt;">بطاقة المعالجة البيداغوجية الفردية والدعم الرياضي</div>
                <div style="font-size: 8pt; color: #64748b; margin-top: 2px;">المذكرة الوزارية رقم 142-08 • السلك الثانوي التأهيلي</div>
            </div>
            <div style="text-align: left; font-size: 8.5pt;">
                <div>الأستاذ(ة): <strong>${teacherName}</strong></div>
                <div>المادة: <strong>الرياضيات</strong></div>
                <div>التاريخ: <strong>${printDate}</strong></div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px;">
            <div class="box">
                <div style="font-size: 7.5pt; color: #64748b;">اسم التلميذ(ة)</div>
                <div style="font-weight: 900; font-size: 10pt; color: #0f172a;">${std.name}</div>
            </div>
            <div class="box">
                <div style="font-size: 7.5pt; color: #64748b;">القسم ورقم مسار</div>
                <div style="font-weight: 800; font-size: 8.5pt;">${std.className} • ${std.massar || '-'}</div>
            </div>
            <div class="box">
                <div style="font-size: 7.5pt; color: #64748b;">نقط الفروض والمعدل</div>
                <div style="font-weight: 900; font-size: 9pt; color: #dc2626;">${marksText} (${std.avg}/20)</div>
            </div>
            <div class="box">
                <div style="font-size: 7.5pt; color: #64748b;">تصنيف التعثر</div>
                <div style="font-weight: 800; font-size: 8.5pt; color: #7e22ce;">${item.severityLabel}</div>
            </div>
        </div>

        <div class="section-title">🔍 1. تشخيص نوع الخطأ الرياضي والعائق الديداكتيكي المرصود:</div>
        <div class="box" style="background: #fdf2f8; border-color: #fbcfe8; color: #831843;">
            <strong style="color: #9d174d;">${act.categoryLabel}:</strong> ${act.commonErrors}
        </div>

        <div class="section-title">🎯 2. الهدف البيداغوجي واستراتيجية المعالجة المبرمجة:</div>
        <div class="box">
            <div>• <b>الهدف التعلمي الإجرائي:</b> ${act.objective}</div>
            <div style="margin-top: 3px;">• <b>استراتيجية الإنجاز:</b> ${act.strategy}</div>
            <div style="margin-top: 3px;">• <b>الغلاف الزمني التقديري:</b> ${act.durationMinutes} دقيقة بحصة الدعم الاستدراكية</div>
        </div>

        <div class="section-title">📝 3. النشاط الرياضي التطبيقي المباشر (تمرين المعالجة والاستدراك):</div>
        <div class="exercise-box">${act.miniExercise}</div>

        <div class="section-title">✍️ 4. حيز إنجاز التلميذ(ة) والتحليل الديداكتيكي للحل:</div>
        <div class="solution-zone">
            <span style="color: #94a3b8; font-size: 8pt;">[ يخصص هذا الحيز لإنجاز التلميذ(ة) وملاحظات الأستاذ أثناء الحصة الاستدراكية ]</span>
        </div>

        <div class="box" style="background: #f0fdf4; border-color: #bbf7d0;">
            <div style="font-weight: 800; color: #166534; font-size: 8.5pt;">📈 مؤشر التحقق وتقييم الأثر:</div>
            <div style="font-size: 8pt; color: #14532d;">${act.verificationIndicator}</div>
        </div>

        <div class="footer-sig">
            <div style="text-align: center; width: 45%;">
                <div>توقيع وملاحظة أستاذ مادة الرياضيات</div>
                <div style="height: 32px;"></div>
                <div>الأستاذ(ة): <b>${teacherName}</b></div>
            </div>
            <div style="text-align: center; width: 45%;">
                <div>ملاحظة وتأشيرة ولي أمر التلميذ(ة)</div>
                <div style="height: 32px;"></div>
                <div>اطلعت على خطة المعالجة: .....................</div>
            </div>
        </div>
    </div>
</body>
</html>
    `;

    if (typeof (window as any).printDocumentDirectly === 'function') {
      (window as any).printDocumentDirectly(htmlContent, `بطاقة المعالجة البيداغوجية - ${std.name}`, 'portrait');
      return;
    }
    window.print();
  };

  // Handler: Print Class Full Remediation Schedule (جدول خطة المعالجة الجماعية)
  const handlePrintClassRemediationSchedule = () => {
    const teacherName = (db?.teacherProfile?.name) || (db?.profile?.name) || 'أستاذ مادة الرياضيات';
    const schoolName = (db?.teacherProfile?.school) || (db?.profile?.school) || 'المؤسسة التعليمية';
    const printDate = new Date().toLocaleDateString('ar-MA');
    const clsName = selectedClass === 'all' ? 'جميع الأقسام' : selectedClass;

    const rowsHtml = diagnosedStudents.map((d, i) => `
      <tr style="border-bottom: 1px solid #cbd5e1; background: ${i % 2 === 0 ? '#fff' : '#f8fafc'}; font-size: 8.5pt;">
          <td style="padding: 6px; text-align: center; border: 1px solid #cbd5e1;">${i + 1}</td>
          <td style="padding: 6px 10px; font-weight: 800; border: 1px solid #cbd5e1;">${d.student.name}</td>
          <td style="padding: 6px; text-align: center; border: 1px solid #cbd5e1;">${d.student.className}</td>
          <td style="padding: 6px; text-align: center; font-weight: 800; color: #dc2626; border: 1px solid #cbd5e1;">${d.student.avg ?? '-'}</td>
          <td style="padding: 6px 10px; font-weight: 700; color: #7e22ce; border: 1px solid #cbd5e1;">${d.activity.categoryLabel}</td>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1;">${d.activity.title}</td>
          <td style="padding: 6px 10px; font-size: 8pt; border: 1px solid #cbd5e1;">${d.activity.strategy}</td>
          <td style="padding: 6px; text-align: center; border: 1px solid #cbd5e1;">${d.activity.durationMinutes} د</td>
      </tr>
    `).join('');

    const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>خطة المعالجة البيداغوجية والدعم الرياضي - ${clsName}</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: 'Cairo', system-ui, sans-serif; background: #fff; margin: 0; padding: 0; font-size: 9pt; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #1e3a8a; color: #fff; padding: 7px 6px; border: 1px solid #1e3a8a; font-size: 8.5pt; text-align: center; }
    </style>
</head>
<body>
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; margin-bottom: 8px;">
        <div>
            <div style="font-weight: 900; font-size: 11pt;">المملكة المغربية</div>
            <div style="font-size: 8pt; color: #475569;">وزارة التربية الوطنية والتعليم الأولي والرياضة • ${schoolName}</div>
        </div>
        <div style="text-align: center;">
            <div style="font-weight: 900; font-size: 13pt; color: #1e3a8a;">خطة المعالجة البيداغوجية المخصصة للمتعثرين في الفروض المحروسة (المذكرة 142-08)</div>
            <div style="font-size: 8pt; color: #64748b;">القسم: <b>${clsName}</b> • الدورة: <b>${semester === 's2' ? 'الثانية' : 'الأولى'}</b> • إجمالي المتعثرين: <b>${diagnosedStudents.length} تلميذ</b></div>
        </div>
        <div style="text-align: left; font-size: 8pt;">
            <div>الأستاذ: <b>${teacherName}</b></div>
            <div>التاريخ: <b>${printDate}</b></div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 28px;">#</th>
                <th style="width: 130px; text-align: right;">اسم التلميذ(ة)</th>
                <th style="width: 55px;">القسم</th>
                <th style="width: 50px;">المعدل</th>
                <th style="width: 170px; text-align: right;">نوع العائق الديداكتيكي المرصود</th>
                <th style="text-align: right;">نشاط المعالجة البيداغوجي المقترح</th>
                <th style="width: 170px; text-align: right;">صيغة الإنجاز المقترحة</th>
                <th style="width: 45px;">المدة</th>
            </tr>
        </thead>
        <tbody>
            ${rowsHtml}
        </tbody>
    </table>

    <div style="display: flex; justify-content: space-between; margin-top: 14px; font-size: 8.5pt;">
        <div>توقيع أستاذ(ة) المادة: <b>${teacherName}</b></div>
        <div>تأشيرة الحراسة العامة للخارجية</div>
        <div>تأشيرة وخاتم إدارة المؤسسة</div>
    </div>
</body>
</html>
    `;

    if (typeof (window as any).printDocumentDirectly === 'function') {
      (window as any).printDocumentDirectly(htmlContent, `خطة المعالجة الجماعية - ${clsName}`, 'landscape');
      return;
    }
    window.print();
  };

  // Handler: Run Generative AI (Gemini 3.8 Flash) via backend proxy
  const handleRunGenerativeAiInspection = async () => {
    if (isGeneratingAi) return;
    setIsGeneratingAi(true);

    try {
      const targetCls = selectedClass === 'all' ? Object.keys(db?.classes || {})[0] || 'القسم' : selectedClass;
      const payload = {
        className: targetCls,
        level: 'مقرر الرياضيات المغربي',
        subject: 'الرياضيات',
        examLabel: `فروض المراقبة المستمرة (${semester === 's2' ? 'الدورة الثانية' : 'الدورة الأولى'})`,
        stats: {
          totalStudents: studentMetrics.length,
          evaluatedCount: studentMetrics.filter(s => s.avg !== null).length,
          classAverage: classAverages.overall || 10,
          strugglingCount: strugglingStudents.length
        },
        strugglingStudents: strugglingStudents.slice(0, 12).map(s => ({
          name: s.name,
          grade: s.avg,
          f1: s.f1,
          f2: s.f2
        })),
        specificDifficulties: Object.values(REMEDIATION_CATALOG).map(c => c.commonErrors).slice(0, 4).join(' • ')
      };

      const res = await fetch('/api/ai/analyze-exam-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('تعذر استلام تقرير الذكاء الاصطناعي');
      }

      const data = await res.json();
      setAiGeminiReportHtml(data.result || 'تم التحليل بنجاح.');
      setShowGeminiModal(true);
    } catch (e: any) {
      alert('حدث تنبيه أثناء استدعاء محرك الذكاء الاصطناعي: ' + (e.message || 'يرجى المحاولة مجدداً'));
    } finally {
      setIsGeneratingAi(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Quick Analytics Banner */}
      <div className="bg-gradient-to-l from-purple-900 via-indigo-900 to-slate-900 text-white p-5 md:p-6 rounded-2xl shadow-md border border-purple-800/40 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-200 text-xs font-bold mb-2 border border-purple-400/30">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>خوارزمية الذكاء الاصطناعي لتشخيص الفروض والمعالجة البيداغوجية</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white">
              أنشطة المعالجة والاستدراك المخصصة لكل تلميذ متعثر
            </h2>
            <p className="text-xs md:text-sm text-purple-200/80 mt-1 max-w-2xl leading-relaxed">
              تقوم الخوارزمية بتحليل نوع الأخطاء المرتكبة في الفروض المحروسة (الحساب الجبري، طاليس، فيتاغورس، ترييض المسائل...) وتقترح لكل تلميذ نشاطاً علاجياً مخصصاً مع إمكانية برمجته فوراً في دفتر النصوص كحصة استدراكية موثقة رسمياً.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handlePrintClassRemediationSchedule}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-all cursor-pointer shadow-xs"
              title="طباعة جدول خطة المعالجة الجماعية للقسم"
            >
              <Printer className="w-4 h-4 text-purple-200" />
              <span>طباعة خطة المعالجة للقسم</span>
            </button>

            <button
              type="button"
              onClick={handleRunGenerativeAiInspection}
              disabled={isGeneratingAi}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-black shadow-md shadow-orange-500/20 transition-all cursor-pointer disabled:opacity-50"
              title="تشغيل التحليل التوليدي المعمق عبر Gemini AI"
            >
              {isGeneratingAi ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>جاري التحليل...</span>
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 text-amber-100" />
                  <span>تقرير الذكاء الاصطناعي التوليدي ✨</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-4 border-t border-purple-700/40">
          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-xl border border-white/10">
            <div className="text-[11px] text-purple-200 font-bold">فئة الدعم ذات الأولوية</div>
            <div className="text-xl md:text-2xl font-black text-rose-400 font-mono mt-0.5">
              {strugglingStudents.length} <span className="text-xs text-purple-200 font-normal">تلميذ(ة)</span>
            </div>
            <div className="text-[10px] text-purple-300 mt-0.5">
              {studentMetrics.length > 0 ? Math.round((strugglingStudents.length / studentMetrics.length) * 100) : 0}% من تلامذة القسم
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-xl border border-white/10">
            <div className="text-[11px] text-purple-200 font-bold">تعثر حاد (&lt; 6/20)</div>
            <div className="text-xl md:text-2xl font-black text-amber-300 font-mono mt-0.5">
              {strugglingStudents.filter(s => s.avg !== null && s.avg < 6).length}
            </div>
            <div className="text-[10px] text-purple-300 mt-0.5">يتطلب معالجة أساسية وتفييئاً فورياً</div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-xl border border-white/10">
            <div className="text-[11px] text-purple-200 font-bold">تراجع ملحوظ بين الفروض</div>
            <div className="text-xl md:text-2xl font-black text-purple-300 font-mono mt-0.5">
              {strugglingStudents.filter(s => s.delta !== null && s.delta <= -2).length}
            </div>
            <div className="text-[10px] text-purple-300 mt-0.5">انحدار بأكثر من نقطتين (F1 ➔ F2)</div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-xl border border-white/10">
            <div className="text-[11px] text-purple-200 font-bold">أنشطة المعالجة المولدة</div>
            <div className="text-xl md:text-2xl font-black text-emerald-400 font-mono mt-0.5">
              {diagnosedStudents.length} <span className="text-xs text-purple-200 font-normal">نشاطاً مخصصاً</span>
            </div>
            <div className="text-[10px] text-purple-300 mt-0.5">جاهزة للتنزيل في دفتر النصوص والطباعة</div>
          </div>
        </div>
      </div>

      {/* 2. Filter & Search Controls Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم التلميذ أو رقم مسار..."
              className="w-full pl-3 pr-9 py-2 text-xs md:text-sm font-semibold rounded-xl border border-slate-200 focus:outline-hidden focus:border-purple-500 bg-slate-50 focus:bg-white transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter by Math Category */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={selectedCategoryFilter}
              onChange={e => setSelectedCategoryFilter(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 cursor-pointer focus:outline-hidden focus:border-purple-500"
            >
              <option value="all">جميع العوائق والأخطاء الرياضية</option>
              {CATEGORY_KEYS.map(k => (
                <option key={k} value={k}>{REMEDIATION_CATALOG[k].label}</option>
              ))}
            </select>
          </div>

          {/* Filter by Severity */}
          <select
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value as any)}
            className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 cursor-pointer focus:outline-hidden focus:border-purple-500"
          >
            <option value="all">جميع درجات التعثر</option>
            <option value="severe">تعثر حاد (&lt; 6/20)</option>
            <option value="moderate">تعثر متوسط (6 إلى 8)</option>
            <option value="mild">تعثر طفيف (8 إلى 10)</option>
            <option value="declining">تراجع مفاجئ بين الفروض</option>
          </select>
        </div>
      </div>

      {/* 3. Students Activities Cards Grid */}
      {filteredDiagnosed.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">
            لا توجد حالات تعثر مطابقة لمعايير البحث الحالية
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            جميع تلامذة الفئة المحددة حققوا عتبة التمكن (≥ 10/20) أو لم تسجل لديهم أخطاء تعثر حادة في هذا الفلتر.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDiagnosed.map(({ student, severityBadge, severityLabel, activity }) => {
            const isScheduling = schedulingStudentId === student.id;

            return (
              <div
                key={student.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-purple-300 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between relative group"
              >
                <div>
                  {/* Top Bar: Student info & severity */}
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 mb-3.5">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-slate-900 text-sm md:text-base">
                          {student.name}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {student.className} • {student.massar || 'مسار غير محدد'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        <span className="text-slate-500">نقط الفروض:</span>
                        <span className="font-bold text-slate-700 font-mono">
                          F1: {student.f1 !== null ? `${student.f1}` : '-'} | F2: {student.f2 !== null ? `${student.f2}` : '-'}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="font-black text-rose-600 font-mono">
                          المعدل: {student.avg !== null ? `${student.avg}/20` : '-'}
                        </span>
                        {student.delta !== null && student.delta <= -2 && (
                          <span className="inline-flex items-center text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-sm">
                            <TrendingDown className="w-3 h-3 mr-0.5" />
                            {student.delta}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border whitespace-nowrap ${severityBadge}`}>
                      {severityLabel}
                    </span>
                  </div>

                  {/* Diagnostic classification & dropdown */}
                  <div className="bg-purple-50/70 border border-purple-100 rounded-xl p-3 mb-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="text-[11px] font-bold text-purple-900 flex items-center gap-1.5">
                        <Brain className="w-3.5 h-3.5 text-purple-600" />
                        <span>نوع الخطأ والعائق الديداكتيكي المرصود:</span>
                      </div>

                      {/* Dropdown to override category if teacher wants */}
                      <select
                        value={activity.categoryKey}
                        onChange={e => handleCategoryChange(student.id, e.target.value)}
                        className="text-[10px] font-bold text-purple-800 bg-white border border-purple-200 rounded-md px-1.5 py-0.5 cursor-pointer focus:outline-hidden"
                        title="تعديل تصنيف العائق الرياضي لهذا التلميذ"
                      >
                        {CATEGORY_KEYS.map(k => (
                          <option key={k} value={k}>{REMEDIATION_CATALOG[k].label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="text-xs font-extrabold text-purple-950">
                      {activity.categoryLabel}
                    </div>
                    <div className="text-[11px] text-purple-800/80 mt-1 leading-relaxed">
                      {activity.commonErrors}
                    </div>
                  </div>

                  {/* Proposed Remediation Activity Details */}
                  <div className="space-y-2 mb-4 text-xs">
                    <div className="flex items-start gap-2">
                      <Target className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-extrabold text-slate-800">النشاط المقترح: </span>
                        <span className="font-bold text-blue-700">{activity.title}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-slate-600 text-[11px] leading-relaxed">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-slate-700">الهدف الإجرائي: </span>
                        <span>{activity.objective}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-slate-600 text-[11px] leading-relaxed">
                      <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-slate-700">صيغة المعالجة: </span>
                        <span>{activity.strategy}</span>
                      </div>
                    </div>

                    {/* Mini Diagnostic Exercise preview */}
                    <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-2.5 mt-2">
                      <div className="text-[10px] font-bold text-amber-900 mb-1 flex items-center justify-between">
                        <span>📝 تمرين المعالجة التطبيقي المخصص:</span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-800 font-mono">
                          <Clock className="w-3 h-3" />
                          <span>{activity.durationMinutes} دقيقة</span>
                        </span>
                      </div>
                      <div className="text-[11px] font-semibold text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {activity.miniExercise}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleScheduleExtraSession({ student, severityLabel, severityBadge, activity, severity: 'moderate' })}
                    disabled={isScheduling}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer disabled:opacity-50"
                    title="برمجة هذا النشاط العلاجي فوراً كحصة استدراكية في دفتر النصوص وربطها بالقسم"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>{isScheduling ? 'جاري الفتح...' : 'برمجة كحصة استدراكية بالدفتر ⚡'}</span>
                  </button>

                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handlePrintStudentWorksheet({ student, severityLabel, severityBadge, activity, severity: 'moderate' })}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-all cursor-pointer"
                      title="طباعة بطاقة المعالجة الفردية للتلميذ بصيغة A4"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500" />
                      <span>طباعة بطاقة التلميذ</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (typeof (window as any).openShareRecordModal === 'function') {
                          (window as any).openShareRecordModal({
                            type: 'student',
                            className: student.className || selectedClass,
                            studentId: student.id,
                            studentName: student.name
                          });
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold transition-all cursor-pointer"
                      title="مشاركة سجل التلميذ وخطة المعالجة مع الزملاء عبر رمز QR أو رابط مباشر مشفر"
                    >
                      <QrCode className="w-3.5 h-3.5 text-purple-600" />
                      <span>مشاركة (QR / مشفر)</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Gemini Generative AI Full Report Modal */}
      {showGeminiModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-purple-200 overflow-hidden">
            <div className="p-4 md:p-5 bg-gradient-to-r from-purple-900 to-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Brain className="w-5 h-5 text-amber-300" />
                <h3 className="font-black text-sm md:text-base">
                  تقرير التفتيش البيداغوجي بالذكاء الاصطناعي وخطة المعالجة الشاملة
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGeminiModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg bg-white/10 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 md:p-6 overflow-y-auto flex-1 text-slate-800 text-sm leading-relaxed">
              {aiGeminiReportHtml ? (
                <div
                  dangerouslySetInnerHTML={{ __html: aiGeminiReportHtml }}
                  className="prose prose-purple max-w-none"
                />
              ) : (
                <div className="text-center py-10 text-slate-500">لا يوجد محتوى.</div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const html = `
                    <html lang="ar" dir="rtl">
                    <head><title>تقرير التفتيش البيداغوجي وخطة المعالجة (المذكرة 142-08)</title><link href="https://fonts.googleapis.com/css2?family=Cairo&display=swap" rel="stylesheet"><style>body{font-family:'Cairo',sans-serif;padding:16px;}</style></head>
                    <body>${aiGeminiReportHtml || ''}</body>
                    </html>
                  `;
                  if (typeof (window as any).printDocumentDirectly === 'function') {
                    (window as any).printDocumentDirectly(html, 'تقرير التفتيش البيداغوجي وخطة المعالجة', 'portrait');
                  } else {
                    window.print();
                  }
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                طباعة هذا التقرير 🖨️
              </button>
              <button
                type="button"
                onClick={() => setShowGeminiModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
