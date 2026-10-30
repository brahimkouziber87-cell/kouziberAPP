import React, { useState, useMemo } from 'react';
import {
  X,
  FileCheck2,
  Printer,
  Sparkles,
  Calculator,
  Layers,
  BookOpen,
  Award,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Download,
  Copy,
  Plus,
  Trash2,
  Settings2
} from 'lucide-react';

export interface ExamFrameworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialClass?: string;
}

interface SkillDistribution {
  directApplication: number; // تطبيق مباشر
  familiarSituation: number; // وضعية مألوفة
  complexReasoning: number;  // استدلال وتركيب
}

interface ExerciseItem {
  id: string;
  order: number;
  title: string;
  domain: string;
  points: number;
  skills: SkillDistribution;
  competencies: string;
}

const PRESET_LEVELS: Record<string, {
  name: string;
  stream: string;
  coef: number;
  duration: string;
  examsCount: number;
  domains: { name: string; defaultPoints: number; weightPct: number }[];
  defaultExercises: Omit<ExerciseItem, 'id'>[];
}> = {
  '2BAC_PC': {
    name: 'الثانية باكالوريا علوم تجريبية (PC / SVT)',
    stream: 'مسلك العلوم الفيزيائية وعلوم الحياة والأرض',
    coef: 7,
    duration: 'ساعتان (2h)',
    examsCount: 3,
    domains: [
      { name: 'التحليل: النهايات، الاتصال، والاشتقاق ودراسة الدوال', defaultPoints: 10, weightPct: 50 },
      { name: 'المتتاليات العددية', defaultPoints: 3.5, weightPct: 17.5 },
      { name: 'الأعداد العقدية', defaultPoints: 3.5, weightPct: 17.5 },
      { name: 'الهندسة الفضائية وحساب الاحتمالات', defaultPoints: 3, weightPct: 15 }
    ],
    defaultExercises: [
      {
        order: 1,
        title: 'التمرين الأول: دراسة المتتاليات العددية والتقارب',
        domain: 'المتتاليات العددية',
        points: 4,
        skills: { directApplication: 2, familiarSituation: 1.5, complexReasoning: 0.5 },
        competencies: 'البرهان بالترجع، دراسة الرتابة والمتتاليات الهندسية المساعدة وحساب النهايات.'
      },
      {
        order: 2,
        title: 'التمرين الثاني: الأعداد العقدية في المستوى العقدي',
        domain: 'الأعداد العقدية',
        points: 4,
        skills: { directApplication: 2, familiarSituation: 1.5, complexReasoning: 0.5 },
        competencies: 'حل معادلة من الدرجة 2، الشكل المثلثي والأس، وتحديد طبيعة المثلثات والتحويلات.'
      },
      {
        order: 3,
        title: 'التمرين الثالث: دراسة دالة لوغاريتمية / أسية وتمثيلها المبياني',
        domain: 'التحليل ودراسة الدوال',
        points: 9,
        skills: { directApplication: 3.5, familiarSituation: 3.5, complexReasoning: 2 },
        competencies: 'حساب النهايات، الفروع اللانهائية، إشارة المشتقة، جدول التغيرات، والإنشاء الهندسي لـ (Cf).'
      },
      {
        order: 4,
        title: 'التمرين الرابع: الهندسة الفضائية والجداء السلمي والمتجهي',
        domain: 'الهندسة الفضائية وحساب الاحتمالات',
        points: 3,
        skills: { directApplication: 1.5, familiarSituation: 1, complexReasoning: 0.5 },
        competencies: 'معادلة الفلكة، تقاطع مستوى وفلكة، والمسافة بين نقطة ومستوى تحليلياً.'
      }
    ]
  },
  '2BAC_SM': {
    name: 'الثانية باكالوريا علوم رياضية (أ و ب)',
    stream: 'شعبة العلوم الرياضية',
    coef: 9,
    duration: '3 ساعات (3h)',
    examsCount: 4,
    domains: [
      { name: 'التحليل وحساب التكامل والمعادلات التفاضلية', defaultPoints: 10, weightPct: 50 },
      { name: 'البنيات الجبرية والحسابيات في Z', defaultPoints: 3.5, weightPct: 17.5 },
      { name: 'الأعداد العقدية والتحويلات الهندسية', defaultPoints: 3.5, weightPct: 17.5 },
      { name: 'حساب الاحتمالات والمتغيرات العشوائية', defaultPoints: 3, weightPct: 15 }
    ],
    defaultExercises: [
      {
        order: 1,
        title: 'التمرين الأول: البنيات الجبرية (الزمر والحلقات والأجسام)',
        domain: 'البنيات الجبرية والحسابيات في Z',
        points: 3.5,
        skills: { directApplication: 1.5, familiarSituation: 1, complexReasoning: 1 },
        competencies: 'التحقق من قانون تركيب داخلي، التشاكل، الاستقرار، والزمرة الجزئية.'
      },
      {
        order: 2,
        title: 'التمرين الثاني: الأعداد العقدية والحساب الهندسي التوليفي',
        domain: 'الأعداد العقدية والتحويلات الهندسية',
        points: 3.5,
        skills: { directApplication: 1, familiarSituation: 1.5, complexReasoning: 1 },
        competencies: 'الجذور النونية، التدوير والتحاكي، والحل الجبري في C.'
      },
      {
        order: 3,
        title: 'التمرين الثالث: الحسابيات والتعداد ونظرية الأعداد الأولية',
        domain: 'البنيات الجبرية والحسابيات في Z',
        points: 3,
        skills: { directApplication: 1, familiarSituation: 1, complexReasoning: 1 },
        competencies: 'مبرهنة فيرما ومبرهنة غوص، ونظام العد والموافقات بترديد n.'
      },
      {
        order: 4,
        title: 'التمرين الرابع: مسألة التحليل، الاتصال والاشتقاق، التكامل والتفرع',
        domain: 'التحليل وحساب التكامل والمعادلات التفاضلية',
        points: 10,
        skills: { directApplication: 3, familiarSituation: 4, complexReasoning: 3 },
        competencies: 'مبرهنة التزايدات المنتهية، المتتاليات المعرفة بتكامل، والدوال الأصلية.'
      }
    ]
  },
  '1BAC_SM': {
    name: 'الأولى باكالوريا علوم رياضية',
    stream: 'شعبة العلوم الرياضية',
    coef: 9,
    duration: 'ساعتان (2h)',
    examsCount: 4,
    domains: [
      { name: 'المنطق الرياضي والمجموعات والتطبيقات', defaultPoints: 5, weightPct: 25 },
      { name: 'عموميات حول الدوال العددية والنهايات والاشتقاق', defaultPoints: 8, weightPct: 40 },
      { name: 'المتتاليات العددية', defaultPoints: 3.5, weightPct: 17.5 },
      { name: 'الهندسة المستوية والدوران والحساب المثلثي', defaultPoints: 3.5, weightPct: 17.5 }
    ],
    defaultExercises: [
      {
        order: 1,
        title: 'التمرين الأول: مبادئ في المنطق الرياضي وأنواع الاستدلال',
        domain: 'المنطق الرياضي والمجموعات والتطبيقات',
        points: 4,
        skills: { directApplication: 2, familiarSituation: 1.5, complexReasoning: 0.5 },
        competencies: 'الاستدلال بالخلف، بفصل الحالات، بالاستلزام المضاد للعكس وبالترجع.'
      },
      {
        order: 2,
        title: 'التمرين الثاني: المجموعات والتطبيقات (التباين والشمول والتقابل)',
        domain: 'المنطق الرياضي والمجموعات والتطبيقات',
        points: 3,
        skills: { directApplication: 1.5, familiarSituation: 1, complexReasoning: 0.5 },
        competencies: 'الصورة المباشرة والضمنية، والتطبيق التقابلي والتقابل العكسي.'
      },
      {
        order: 3,
        title: 'التمرين الثالث: دراسة دالة عددية والاشتقاق والمماسات',
        domain: 'عموميات حول الدوال العددية والنهايات والاشتقاق',
        points: 8.5,
        skills: { directApplication: 3.5, familiarSituation: 3.5, complexReasoning: 1.5 },
        competencies: 'الاشتقاق في نقطة وعلى مجال، مطاريف دالة، نقط الانعطاف وتغيرات الدوال.'
      },
      {
        order: 4,
        title: 'التمرين الرابع: الدوران في المستوى والحساب المثلثي',
        domain: 'الهندسة المستوية والدوران والحساب المثلثي',
        points: 4.5,
        skills: { directApplication: 2, familiarSituation: 1.5, complexReasoning: 1 },
        competencies: 'صيغ التحويل، المعادلات والمتراجحات المثلثية، والتحويلات الهندسية.'
      }
    ]
  },
  '1BAC_EXP': {
    name: 'الأولى باكالوريا علوم تجريبية وتكنولوجية',
    stream: 'مسلك العلوم التجريبية والتكنولوجيات STE/STM',
    coef: 7,
    duration: 'ساعتان (2h)',
    examsCount: 3,
    domains: [
      { name: 'مبادئ في المنطق والحساب العددي', defaultPoints: 4, weightPct: 20 },
      { name: 'عموميات حول الدوال ونهايات الدوال', defaultPoints: 8, weightPct: 40 },
      { name: 'المتتاليات العددية', defaultPoints: 4, weightPct: 20 },
      { name: 'الجداء السلمي والحساب المثلثي', defaultPoints: 4, weightPct: 20 }
    ],
    defaultExercises: [
      {
        order: 1,
        title: 'التمرين الأول: المنطق الرياضي والاستدلال',
        domain: 'مبادئ في المنطق والحساب العددي',
        points: 3.5,
        skills: { directApplication: 2, familiarSituation: 1.5, complexReasoning: 0 },
        competencies: 'العبارات، الاستلزام، التكافؤ، ومثال مضاد.'
      },
      {
        order: 2,
        title: 'التمرين الثاني: المتتاليات الحسابية والهندسية',
        domain: 'المتتاليات العددية',
        points: 4.5,
        skills: { directApplication: 2.5, familiarSituation: 1.5, complexReasoning: 0.5 },
        competencies: 'الحد العام، حساب المجموع، والرتابة.'
      },
      {
        order: 3,
        title: 'التمرين الثالث: دراسة الدوال العددية والاشتقاق',
        domain: 'عموميات حول الدوال ونهايات الدوال',
        points: 8,
        skills: { directApplication: 3.5, familiarSituation: 3.5, complexReasoning: 1 },
        competencies: 'مجموعة التعريف، النهايات عند المحدات، جدول التغيرات والمستقيمات المقاربة.'
      },
      {
        order: 4,
        title: 'التمرين الرابع: الجداء السلمي وتطبيقاته',
        domain: 'الجداء السلمي والحساب المثلثي',
        points: 4,
        skills: { directApplication: 2, familiarSituation: 1.5, complexReasoning: 0.5 },
        competencies: 'مبرهنة المتوسط، حساب الأطوال والزوايا في المستوى.'
      }
    ]
  },
  'TCS': {
    name: 'الجذع المشترك العلمي والتكنولوجي (TCS / TCT)',
    stream: 'التعليم الثانوي التأهيلي المشترك',
    coef: 4,
    duration: 'ساعتان (2h)',
    examsCount: 3,
    domains: [
      { name: 'الحسابيات في IN والمجموعات', defaultPoints: 5, weightPct: 25 },
      { name: 'الحساب المتجهي والإسقاط في المستوى', defaultPoints: 5, weightPct: 25 },
      { name: 'المجموعات والحساب العددي والترتيب في IR', defaultPoints: 5, weightPct: 25 },
      { name: 'المستقيم في المستوى والهندسة التحليلية والإحصاء', defaultPoints: 5, weightPct: 25 }
    ],
    defaultExercises: [
      {
        order: 1,
        title: 'التمرين الأول: الحسابيات في مجموعة الأعداد الصحيحة الطبيعية IN',
        domain: 'الحسابيات في IN والمجموعات',
        points: 4.5,
        skills: { directApplication: 2.5, familiarSituation: 1.5, complexReasoning: 0.5 },
        competencies: 'الأعداد الأولية، الزوجية، القواسم والمضاعفات، و PGCD و PPCM.'
      },
      {
        order: 2,
        title: 'التمرين الثاني: الحساب المتجهي في المستوى وعلاقة شال',
        domain: 'الحساب المتجهي والإسقاط في المستوى',
        points: 4.5,
        skills: { directApplication: 2.5, familiarSituation: 1.5, complexReasoning: 0.5 },
        competencies: 'الاستقامية، تساوي متجهتين، منتصف قطعة وتوازي المستقيمات.'
      },
      {
        order: 3,
        title: 'التمرين الثالث: الترتيب في IR والمجالات والقيمة المطلقة والتأطير',
        domain: 'المجموعات والحساب العددي والترتيب في IR',
        points: 6,
        skills: { directApplication: 3, familiarSituation: 2.5, complexReasoning: 0.5 },
        competencies: 'المتطابقات الهامة، الجذور المربعة، الحصر والتأطير والمسافة.'
      },
      {
        order: 4,
        title: 'التمرين الرابع: الهندسة التحليلية للمستقيم في المستوى',
        domain: 'المستقيم في المستوى والهندسة التحليلية والإحصاء',
        points: 5,
        skills: { directApplication: 2.5, familiarSituation: 2, complexReasoning: 0.5 },
        competencies: 'المعادلة الديكارتية لمستقيم، المعامل الموجه، وشرط التوازي والتعامد.'
      }
    ]
  },
  'TCL': {
    name: 'الجذع المشترك للآداب والعلوم الإنسانية والأصيل (TCL)',
    stream: 'مسلك الآداب والتعليم الأصيل',
    coef: 2,
    duration: 'ساعة واحدة (1h)',
    examsCount: 2,
    domains: [
      { name: 'الحساب العددي والعمليات في IR والنسب المئوية', defaultPoints: 6, weightPct: 30 },
      { name: 'الترتيب في IR والمجالات والتأطير', defaultPoints: 6, weightPct: 30 },
      { name: 'المعادلات والمتراجحات والنظمات وترييض وضعيات', defaultPoints: 5, weightPct: 25 },
      { name: 'الإحصاء وتنظيم المعطيات والمخططات', defaultPoints: 3, weightPct: 15 }
    ],
    defaultExercises: [
      {
        order: 1,
        title: 'التمرين الأول: الحساب العددي والعمليات والتناسبية والنسب المئوية',
        domain: 'الحساب العددي والعمليات في IR والنسب المئوية',
        points: 6,
        skills: { directApplication: 3.5, familiarSituation: 2, complexReasoning: 0.5 },
        competencies: 'العمليات على الكسور، القوى ذات أس صحيح نسبي، وحساب النسب والتخفيض.'
      },
      {
        order: 2,
        title: 'التمرين الثاني: المعادلات والمتراجحات من الدرجة الأولى والنظمات',
        domain: 'المعادلات والمتراجحات والنظمات وترييض وضعيات',
        points: 7,
        skills: { directApplication: 3.5, familiarSituation: 2.5, complexReasoning: 1 },
        competencies: 'حل معادلات ومتراجحات الدرجة الأولى بمجهول واحد، وحل نظمة معادلتين بمجهولين وترييض مسألة.'
      },
      {
        order: 3,
        title: 'التمرين الثالث: الإحصاء الوصفي ومؤشرات الموضع والتمثيل المبياني',
        domain: 'الإحصاء وتنظيم المعطيات والمخططات',
        points: 7,
        skills: { directApplication: 4, familiarSituation: 2.5, complexReasoning: 0.5 },
        competencies: 'جدول الحصيصات والترددات، حساب المعدل الحسابي والمنوال وقراءة المخططات.'
      }
    ]
  },
  '2BAC_ECO': {
    name: 'الثانية باكالوريا علوم اقتصادية وتدبير (ECO / SGC)',
    stream: 'شعبة العلوم الاقتصادية والتدبير',
    coef: 4,
    duration: 'ساعتان (2h)',
    examsCount: 3,
    domains: [
      { name: 'التحليل: النهايات، الاتصال، الاشتقاق والدوال اللوغاريتمية والأسية', defaultPoints: 10, weightPct: 50 },
      { name: 'المتتاليات العددية وتطبيقاتها الاقتصادية والمالية', defaultPoints: 4, weightPct: 20 },
      { name: 'التعداد وحساب الاحتمالات', defaultPoints: 3.5, weightPct: 17.5 },
      { name: 'الحساب التكاملي والدوال الأصلية', defaultPoints: 2.5, weightPct: 12.5 }
    ],
    defaultExercises: [
      {
        order: 1,
        title: 'التمرين الأول: المتتاليات العددية وتقاربها واستثمارها في مسائل النمو',
        domain: 'المتتاليات العددية وتطبيقاتها الاقتصادية والمالية',
        points: 4.5,
        skills: { directApplication: 2.5, familiarSituation: 1.5, complexReasoning: 0.5 },
        competencies: 'المتتاليات التآلفية، البرهان بالترجع، رتابة متتالية ونهايتها.'
      },
      {
        order: 2,
        title: 'التمرين الثاني: التعداد وحساب الاحتمالات والمتغير العشوائي',
        domain: 'التعداد وحساب الاحتمالات',
        points: 4.5,
        skills: { directApplication: 2.5, familiarSituation: 1.5, complexReasoning: 0.5 },
        competencies: 'التأليفات والترتيبات، حساب احتمال أحداث عشوائية، وقانون احتمال متغير عشوائي.'
      },
      {
        order: 3,
        title: 'التمرين الثالث: مسألة التحليل، دراسة دالة أسية/لوغاريتمية وتفسير المنحنى',
        domain: 'التحليل: النهايات، الاتصال، الاشتقاق والدوال اللوغاريتمية والأسية',
        points: 11,
        skills: { directApplication: 4, familiarSituation: 4.5, complexReasoning: 2.5 },
        competencies: 'النهايات عند المحدات، إشارة المشتقة وتغيرات الدالة، وتحديد نقط الانعطاف ونمذجة دالة كلفة.'
      }
    ]
  }
};

export const ExamFrameworkModal: React.FC<ExamFrameworkModalProps> = ({
  isOpen,
  onClose,
  initialClass = '2BAC_PC'
}) => {
  const [selectedLevel, setSelectedLevel] = useState<string>('2BAC_PC');
  const [examNumber, setExamNumber] = useState<'1' | '2' | '3' | '4'>('1');
  const [semester, setSemester] = useState<'s1' | 's2'>('s1');
  const [schoolYear, setSchoolYear] = useState<string>('2026 / 2027');
  const [establishment, setEstablishment] = useState<string>('الثانوية التأهيلية');
  const [teacherName, setTeacherName] = useState<string>('');

  const currentPreset = PRESET_LEVELS[selectedLevel] || PRESET_LEVELS['2BAC_PC'];

  const [exercises, setExercises] = useState<ExerciseItem[]>(() => {
    return currentPreset.defaultExercises.map((ex, i) => ({
      ...ex,
      id: `ex_${Date.now()}_${i}`
    }));
  });

  // Keep exercises in sync if preset changes
  const handleLevelChange = (newLevel: string) => {
    setSelectedLevel(newLevel);
    const p = PRESET_LEVELS[newLevel] || PRESET_LEVELS['2BAC_PC'];
    setExercises(p.defaultExercises.map((ex, i) => ({
      ...ex,
      id: `ex_${Date.now()}_${i}`
    })));
  };

  // Populate teacher profile name and institution from window.db if available
  React.useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).db) {
      const db = (window as any).db;
      if (db.teacherProfile) {
        if (db.teacherProfile.name) setTeacherName(db.teacherProfile.name);
        if (db.teacherProfile.schoolName || db.teacherProfile.school) {
          setEstablishment(db.teacherProfile.schoolName || db.teacherProfile.school);
        }
      }
    }
  }, []);

  // Compute Totals
  const totalPoints = useMemo(() => {
    return parseFloat(exercises.reduce((sum, ex) => sum + (Number(ex.points) || 0), 0).toFixed(2));
  }, [exercises]);

  const skillTotals = useMemo(() => {
    let direct = 0;
    let familiar = 0;
    let complex = 0;
    exercises.forEach(ex => {
      direct += Number(ex.skills.directApplication) || 0;
      familiar += Number(ex.skills.familiarSituation) || 0;
      complex += Number(ex.skills.complexReasoning) || 0;
    });
    const total = direct + familiar + complex || 1;
    return {
      direct: parseFloat(direct.toFixed(2)),
      familiar: parseFloat(familiar.toFixed(2)),
      complex: parseFloat(complex.toFixed(2)),
      directPct: Math.round((direct / total) * 100),
      familiarPct: Math.round((familiar / total) * 100),
      complexPct: Math.round((complex / total) * 100)
    };
  }, [exercises]);

  const domainTotals = useMemo(() => {
    const map: Record<string, number> = {};
    exercises.forEach(ex => {
      map[ex.domain] = (map[ex.domain] || 0) + (Number(ex.points) || 0);
    });
    return map;
  }, [exercises]);

  // Update exercise field
  const updateExercise = (id: string, updates: Partial<ExerciseItem>) => {
    setExercises(prev => prev.map(ex => (ex.id === id ? { ...ex, ...updates } : ex)));
  };

  const updateExerciseSkill = (id: string, skillKey: keyof SkillDistribution, val: number) => {
    setExercises(prev => prev.map(ex => {
      if (ex.id !== id) return ex;
      const nextSkills = { ...ex.skills, [skillKey]: val };
      // auto-rebalance points if desired or let user adjust
      return { ...ex, skills: nextSkills };
    }));
  };

  const addExercise = () => {
    const nextOrder = exercises.length + 1;
    const newEx: ExerciseItem = {
      id: `ex_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      order: nextOrder,
      title: `التمرين ${nextOrder}: مسألة إضافية`,
      domain: currentPreset.domains[0]?.name || 'التحليل ودراسة الدوال',
      points: 2.0,
      skills: { directApplication: 1, familiarSituation: 0.75, complexReasoning: 0.25 },
      competencies: 'تطبيق مباشر وتوظيف القواعد الرياضية المستهدفة.'
    };
    setExercises(prev => [...prev, newEx]);
  };

  const removeExercise = (id: string) => {
    if (exercises.length <= 1) return;
    setExercises(prev => prev.filter(ex => ex.id !== id).map((ex, idx) => ({ ...ex, order: idx + 1 })));
  };

  // Safe Print Execution via sandboxed iframe
  const handlePrintOfficialGrid = () => {
    const printDoc = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>شبكة توصيف وتنقيط الفرض المحروس رقم ${examNumber} — ${currentPreset.name}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; margin: 0; padding: 12px; color: #0f172a; font-size: 11pt; line-height: 1.5; }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; }
    .header-table td { vertical-align: middle; }
    .title-banner { text-align: center; margin: 10px 0; padding: 10px; background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; }
    .title-banner h2 { margin: 0; font-size: 14pt; color: #166534; }
    .title-banner p { margin: 4px 0 0 0; font-size: 10pt; color: #475569; }
    .grid-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10pt; }
    .grid-table th, .grid-table td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; }
    .grid-table th { background: #f8fafc; font-weight: bold; color: #1e293b; text-align: center; }
    .stat-badge { font-weight: bold; color: #1e3a8a; }
    .summary-box { margin-top: 14px; padding: 10px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; font-size: 9.5pt; }
    .sign-table { width: 100%; margin-top: 24px; border-collapse: collapse; page-break-inside: avoid; }
    .sign-table td { width: 50%; vertical-align: top; border: 1px solid #cbd5e1; padding: 10px; height: 90px; font-size: 9.5pt; background: #fafafa; }
  </style>
</head>
<body>
  <table class="header-table">
    <tr>
      <td style="width: 35%;">
        <strong>المملكة المغربية</strong><br>
        وزارة التربية الوطنية والتعليم الأولي والرياضة<br>
        المؤسسة: ${establishment || 'الثانوية التأهيلية'}<br>
        الأستاذ(ة): ${teacherName || 'أستاذ مادة الرياضيات'}
      </td>
      <td style="width: 30%; text-align: center;">
        <div style="font-size: 16pt; font-weight: 900; color: #1e3a8a;">📐 مادة الرياضيات</div>
        <div style="font-size: 9pt; color: #64748b; margin-top: 3px;">السلك الثانوي التأهيلي</div>
      </td>
      <td style="width: 35%; text-align: left;">
        الموسم الدراسي: ${schoolYear}<br>
        المستوى: <strong>${currentPreset.name}</strong><br>
        الدورة: ${semester === 's1' ? 'الدورة الأولى (S1)' : 'الدورة الثانية (S2)'}<br>
        المدة: ${currentPreset.duration} | المعامل: ${currentPreset.coef}
      </td>
    </tr>
  </table>

  <div class="title-banner">
    <h2>بطاقة الإطار المرجعي وشبكة تنقيط الفرض المحروس رقم (${examNumber})</h2>
    <p>وفق التوجيهات التربوية الرسمية ومذكرات التقويم والمراقبة المستمرة لوزارة التربية الوطنية</p>
  </div>

  <table class="grid-table">
    <thead>
      <tr>
        <th style="width: 8%;">رقم التمرين</th>
        <th style="width: 32%;">الموضوع والمجال الرياضي المستهدف</th>
        <th style="width: 30%;">القدرات والمهارات المكتسبة المستهدفة</th>
        <th style="width: 10%;">تطبيق مباشر</th>
        <th style="width: 10%;">وضعية مألوفة</th>
        <th style="width: 10%;">استدلال وتركيب</th>
        <th style="width: 8%;">النقطة /20</th>
      </tr>
    </thead>
    <tbody>
      ${exercises.map(ex => `
        <tr>
          <td style="text-align: center; font-weight: bold;">${ex.order}</td>
          <td>
            <strong>${ex.title}</strong><br>
            <span style="font-size: 8.5pt; color: #475569;">مجال: ${ex.domain}</span>
          </td>
          <td style="font-size: 9pt;">${ex.competencies}</td>
          <td style="text-align: center; font-family: monospace;">${ex.skills.directApplication} ن</td>
          <td style="text-align: center; font-family: monospace;">${ex.skills.familiarSituation} ن</td>
          <td style="text-align: center; font-family: monospace;">${ex.skills.complexReasoning} ن</td>
          <td style="text-align: center; font-weight: 900; font-family: monospace; background: #f0fdf4; color: #166534;">${ex.points} ن</td>
        </tr>
      `).join('')}
      <tr style="background: #f8fafc; font-weight: bold;">
        <td colspan="3" style="text-align: center;">المجموع الكلي ونسب المهارات المستهدفة:</td>
        <td style="text-align: center; color: #0284c7; font-family: monospace;">${skillTotals.direct} ن (${skillTotals.directPct}%)</td>
        <td style="text-align: center; color: #16a34a; font-family: monospace;">${skillTotals.familiar} ن (${skillTotals.familiarPct}%)</td>
        <td style="text-align: center; color: #9333ea; font-family: monospace;">${skillTotals.complex} ن (${skillTotals.complexPct}%)</td>
        <td style="text-align: center; font-size: 12pt; color: #1e3a8a; font-family: monospace;">${totalPoints} / 20</td>
      </tr>
    </tbody>
  </table>

  <div class="summary-box">
    <strong>📌 مؤشرات المطابقة البيداغوجية للإطار المرجعي:</strong><br>
    • مجالات المعارف الرياضية: ${Object.entries(domainTotals).map(([k, v]) => `${k}: ${v} ن`).join(' | ')}<br>
    • التوازن المعرفي: نسبة الاسترداد والتطبيق المباشر (${skillTotals.directPct}%)، حل الوضعيات المألوفة (${skillTotals.familiarPct}%)، الاستدلال التوليفي والتركيب (${skillTotals.complexPct}%).
  </div>

  <table class="sign-table">
    <tr>
      <td>
        <strong>توقيع أستاذ(ة) مادة الرياضيات:</strong><br>
        <div style="margin-top: 30px; font-size: 9pt; color: #64748b;">حرر بالمؤسسة في: ${new Date().toLocaleDateString('ar-MA')}</div>
      </td>
      <td>
        <strong>تأشيرة ومصادقة السيد(ة) المفتش(ة) التربوي(ة):</strong><br>
        <div style="margin-top: 30px; font-size: 9pt; color: #64748b;">الملاحظات والتوجيهات البيداغوجية: ..............................</div>
      </td>
    </tr>
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
    iframe.setAttribute('sandbox', 'allow-modals allow-same-origin allow-scripts');
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(printDoc);
      doc.close();
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.warn('Print frame error:', e);
        }
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 3000);
      }, 400);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Top Header */}
        <div className="bg-gradient-to-l from-slate-900 via-blue-900 to-indigo-950 text-white p-5 flex items-center justify-between border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black flex items-center gap-2">
                <span>الإطار المرجعي التفاعلي وشبكة توصيف وتنقيط الفروض المحروسة</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-mono">
                  معايير وزارة التربية الوطنية
                </span>
              </h2>
              <p className="text-xs text-blue-200/80 mt-0.5">
                توليد شبكات تنقيط معيارية مطابقة للمذكرات المنظمة للمراقبة المستمرة لمادة الرياضيات بالثانوي التأهيلي
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintOfficialGrid}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md cursor-pointer transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الشبكة الرسمية (A4)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {/* Controls Bar: Level & Exam Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">المستوى والشعبة الدراسية:</label>
              <select
                value={selectedLevel}
                onChange={e => handleLevelChange(e.target.value)}
                className="w-full text-xs font-bold p-2.5 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {Object.entries(PRESET_LEVELS).map(([k, p]) => (
                  <option key={k} value={k}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">الدورة الدراسية:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSemester('s1')}
                  className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    semester === 's1'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  الدورة 1 (S1)
                </button>
                <button
                  type="button"
                  onClick={() => setSemester('s2')}
                  className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    semester === 's2'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  الدورة 2 (S2)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                رقم الفرض المحروس (وفق 142-08):
              </label>
              <div className={`grid gap-1.5 ${currentPreset.examsCount === 4 ? 'grid-cols-4' : (currentPreset.examsCount === 2 ? 'grid-cols-2' : 'grid-cols-3')}`}>
                {(currentPreset.examsCount === 4
                  ? (['1', '2', '3', '4'] as const)
                  : currentPreset.examsCount === 2
                  ? (['1', '2'] as const)
                  : (['1', '2', '3'] as const)
                ).map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setExamNumber(num)}
                    className={`py-2 px-1 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                      examNumber === num
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    الفرض {num}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">المعامل والمدة الزمنية:</label>
              <div className="p-2 rounded-lg bg-white border border-slate-200 text-xs font-mono font-bold text-slate-700 flex items-center justify-between">
                <span>المعامل: <strong className="text-blue-700">{currentPreset.coef}</strong></span>
                <span>المدة: <strong className="text-emerald-700">{currentPreset.duration}</strong></span>
              </div>
            </div>
          </div>

          {/* Points & Skill Real-time Verification Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className={`p-4 rounded-xl border flex items-center justify-between ${
              totalPoints === 20
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}>
              <div>
                <span className="text-[11px] font-bold block">مجموع نقط الفرض:</span>
                <span className="text-2xl font-black font-mono mt-0.5 inline-block">
                  {totalPoints} / 20.00
                </span>
              </div>
              <div>
                {totalPoints === 20 ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>مطابق تماماً</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>فارق: {(20 - totalPoints).toFixed(2)}ن</span>
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-sky-200 bg-sky-50 text-sky-950">
              <span className="text-[11px] font-bold block text-sky-700">تطبيق مباشر للمعارف (35%-45%):</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xl font-black font-mono">{skillTotals.direct} ن</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-sky-200/80 text-sky-800 font-mono">
                  {skillTotals.directPct}%
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-950">
              <span className="text-[11px] font-bold block text-emerald-700">حل وضعيات مألوفة (35%-45%):</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xl font-black font-mono">{skillTotals.familiar} ن</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-800 font-mono">
                  {skillTotals.familiarPct}%
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-purple-200 bg-purple-50 text-purple-950">
              <span className="text-[11px] font-bold block text-purple-700">استدلال ووضعيات مركبة (15%-25%):</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xl font-black font-mono">{skillTotals.complex} ن</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-200/80 text-purple-800 font-mono">
                  {skillTotals.complexPct}%
                </span>
              </div>
            </div>
          </div>

          {/* Exercises & Assessment Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>هيكلة التمارين وسلالم التنقيط التفصيلية</span>
              </h3>
              <button
                type="button"
                onClick={addExercise}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة تمرين</span>
              </button>
            </div>

            <div className="space-y-3">
              {exercises.map(ex => (
                <div
                  key={ex.id}
                  className="p-4 rounded-xl border border-slate-200/90 bg-white shadow-2xs hover:border-slate-300 transition-colors space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-mono text-xs font-black flex items-center justify-center flex-shrink-0">
                        {ex.order}
                      </span>
                      <input
                        type="text"
                        value={ex.title}
                        onChange={e => updateExercise(ex.id, { title: e.target.value })}
                        className="font-bold text-xs text-slate-900 flex-1 p-1.5 rounded-md border border-slate-200 focus:border-blue-500 outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs font-bold text-slate-500">النقطة الإجمالية:</label>
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          max="20"
                          value={ex.points}
                          onChange={e => updateExercise(ex.id, { points: parseFloat(e.target.value) || 0 })}
                          className="w-16 p-1.5 text-center font-mono font-black text-xs rounded-md border border-emerald-300 bg-emerald-50 text-emerald-900 outline-none"
                        />
                        <span className="text-xs font-bold text-slate-400">ن</span>
                      </div>

                      {exercises.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeExercise(ex.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md cursor-pointer transition-colors"
                          title="حذف هذا التمرين"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">المجال الرياضي:</label>
                      <select
                        value={ex.domain}
                        onChange={e => updateExercise(ex.id, { domain: e.target.value })}
                        className="w-full p-2 rounded-lg border border-slate-200 bg-white font-bold outline-none text-slate-800"
                      >
                        {currentPreset.domains.map(d => (
                          <option key={d.name} value={d.name}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">القدرات والمهارات المستهدفة من التمرين:</label>
                      <input
                        type="text"
                        value={ex.competencies}
                        onChange={e => updateExercise(ex.id, { competencies: e.target.value })}
                        placeholder="مثال: حساب النهايات، الفروع اللانهائية، إشارة المشتقة..."
                        className="w-full p-2 rounded-lg border border-slate-200 bg-white outline-none text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Skills Sub-breakdown per exercise */}
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span className="text-[11px] font-bold text-slate-600">توزيع مهارات التمرين:</span>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sky-700 font-bold">تطبيق مباشر:</span>
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          max={ex.points}
                          value={ex.skills.directApplication}
                          onChange={e => updateExerciseSkill(ex.id, 'directApplication', parseFloat(e.target.value) || 0)}
                          className="w-14 p-1 text-center font-mono text-xs rounded border border-slate-300 bg-white"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-emerald-700 font-bold">وضعية مألوفة:</span>
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          max={ex.points}
                          value={ex.skills.familiarSituation}
                          onChange={e => updateExerciseSkill(ex.id, 'familiarSituation', parseFloat(e.target.value) || 0)}
                          className="w-14 p-1 text-center font-mono text-xs rounded border border-slate-300 bg-white"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-purple-700 font-bold">استدلال وتركيب:</span>
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          max={ex.points}
                          value={ex.skills.complexReasoning}
                          onChange={e => updateExerciseSkill(ex.id, 'complexReasoning', parseFloat(e.target.value) || 0)}
                          className="w-14 p-1 text-center font-mono text-xs rounded border border-slate-300 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-slate-500">
            💡 تضمن هذه الشبكة التوازن البيداغوجي وفق مذكرات التقويم الإشهادي والتوجيهات التربوية الرسمية للمغرب.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintOfficialGrid}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>معاينة وطباعة رسمية (A4)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer transition-colors"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamFrameworkModal;
