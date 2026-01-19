# خطة إصلاح واجهة الهاتف - القائمة الجانبية وصفحة متابعة الحفظ

> [!IMPORTANT]
> هذه الخطة تركز على حل مشكلتين رئيسيتين تؤثران على تجربة المستخدم على الهواتف المحمولة.

---

## المشكلة 1: القائمة الجانبية (Sidebar) - صعوبة الوصول للصفحات الفرعية

### الوضع الحالي
- القائمة الجانبية تستخدم `DropdownMenu` لعرض الصفحات الفرعية
- عند فتح القائمة على الهاتف، يظهر الـ Dropdown خارج الشريط الجانبي
- صعوبة الوصول للصفحات الفرعية باليد الواحدة
- تجربة مستخدم غير سلسة ومربكة

### الحل المقترح
استبدال `DropdownMenu` بنظام **Accordion/Collapsible** يفتح القوائم الفرعية **داخل** الشريط الجانبي نفسه.

### التفاصيل التقنية

#### [MODIFY] [ClientLayout.tsx](file:///g:/Al-Shafi-i-Group-main/Al-Shafi-i-Group-main/src/components/ui/ClientLayout.tsx)

**الخطوة 1: استيراد المكونات المطلوبة**
```tsx
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
```

**الخطوة 2: إضافة حالة للتحكم بالقوائم المفتوحة**
```tsx
const [openGroups, setOpenGroups] = useState<string[]>([]);

const toggleGroup = (groupTitle: string) => {
  setOpenGroups(prev => 
    prev.includes(groupTitle) 
      ? prev.filter(t => t !== groupTitle)
      : [...prev, groupTitle]
  );
};
```

**الخطوة 3: استبدال DropdownMenu بـ Collapsible**
- استخدام `Collapsible` كغلاف رئيسي
- `CollapsibleTrigger` للزر الرئيسي
- `CollapsibleContent` للقائمة الفرعية
- إضافة أيقونة `ChevronDown` تدور عند الفتح/الإغلاق

**الخطوة 4: تصميم القائمة الفرعية**
- عرض الصفحات الفرعية مباشرة تحت الزر الرئيسي
- استخدام `padding-right` لإظهار التسلسل الهرمي
- ألوان مختلفة للعناصر الفرعية (أفتح قليلاً)
- تأثيرات انتقالية ناعمة (`transition-all duration-300`)

### النتيجة المتوقعة
✅ القوائم الفرعية تفتح داخل الشريط الجانبي
✅ سهولة الوصول لجميع الصفحات باليد الواحدة
✅ تجربة مستخدم أكثر سلاسة وطبيعية
✅ دعم كامل للـ RTL

---

## المشكلة 2: صفحة متابعة الحفظ (Surahs) - تداخل النصوص وضيق المساحة

### الوضع الحالي
- أسماء السور تتداخل مع بعضها على الشاشات الصغيرة
- الخط كبير نسبياً (`text-xs` = 12px)
- الـ Grid يستخدم `minmax(100px, 1fr)` مما يجعل الخلايا واسعة جداً
- الـ padding الداخلي للأزرار يأخذ مساحة كبيرة

### الحل المقترح
تحسين استجابة الشبكة وتصغير العناصر على الشاشات الصغيرة.

### التفاصيل التقنية

#### [MODIFY] [surahs/page.tsx](file:///g:/Al-Shafi-i-Group-main/Al-Shafi-i-Group-main/src/app/surahs/page.tsx)

**الخطوة 1: تحسين Grid السور (السطر ~249)**
```tsx
// قبل:
<div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2 sm:gap-3">

// بعد:
<div className="grid grid-cols-[repeat(auto-fill,minmax(75px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-1.5 sm:gap-3">
```

**الخطوة 2: تصغير حجم الخط (السطر ~268)**
```tsx
// قبل:
<span className="truncate text-[10px] sm:text-xs">{surah.id}. {surah.name}</span>

// بعد:
<span className="truncate text-[8px] xs:text-[9px] sm:text-xs font-medium">{surah.id}. {surah.name}</span>
```

**الخطوة 3: تقليل Padding الأزرار (السطر ~263)**
```tsx
// قبل:
className={cn("h-auto justify-between transition-colors duration-300", buttonClass)}

// بعد:
className={cn("h-auto justify-between transition-colors duration-300 px-1.5 py-1 sm:px-3 sm:py-2", buttonClass)}
```

**الخطوة 4: تحسين عرض عدد الآيات (السطر ~270)**
```tsx
// قبل:
<span className="text-[10px] opacity-70 shrink-0">{surah.verses}</span>

// بعد:
<span className="text-[8px] sm:text-[10px] opacity-70 shrink-0 hidden xs:inline">{surah.verses}</span>
```

**الخطوة 5: تحسين الأيقونات (السطر ~266-267)**
```tsx
// تصغير الأيقونات على الشاشات الصغيرة
{status === 1 && <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />}
{status === 2 && <CheckCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />}
```

### النتيجة المتوقعة
✅ عرض أكبر عدد من السور في الشاشة الواحدة
✅ عدم تداخل النصوص حتى على أصغر الشاشات
✅ قراءة واضحة لأسماء السور
✅ استجابة تدريجية (تكبر العناصر تدريجياً مع الشاشة)

---

## خطة التنفيذ

### المرحلة 1: القائمة الجانبية (30 دقيقة)
1. ✅ استيراد مكونات Collapsible
2. ✅ إضافة حالة `openGroups`
3. ✅ استبدال DropdownMenu بـ Collapsible
4. ✅ تصميم القائمة الفرعية
5. ✅ اختبار على الهاتف

### المرحلة 2: صفحة متابعة الحفظ (20 دقيقة)
1. ✅ تحديث Grid (minmax)
2. ✅ تصغير حجم الخط
3. ✅ تقليل Padding
4. ✅ إخفاء عدد الآيات على الشاشات الصغيرة جداً
5. ✅ تصغير الأيقونات
6. ✅ اختبار على أحجام شاشات مختلفة

### المرحلة 3: التحقق والاختبار (15 دقيقة)
1. ✅ فتح الموقع على هاتف حقيقي
2. ✅ اختبار فتح/إغلاق القوائم الفرعية
3. ✅ اختبار قراءة أسماء السور بوضوح
4. ✅ التأكد من عدم وجود تداخلات
5. ✅ اختبار الـ RTL والألوان

---

## الملفات المتأثرة

### ملفات سيتم تعديلها
1. `src/components/ui/ClientLayout.tsx` - القائمة الجانبية
2. `src/app/surahs/page.tsx` - صفحة متابعة الحفظ

### مكونات جديدة مطلوبة
- لا توجد (سنستخدم `Collapsible` من shadcn/ui الموجود مسبقاً)

---

## نقاط مهمة للانتباه

> [!WARNING]
> **القائمة الجانبية:**
> - يجب الحفاظ على الكود الحالي للـ Desktop (لا نغير إلا الـ Mobile)
> - التأكد من أن الألوان متناسقة مع الثيمات المختلفة
> - عدم كسر الـ Tooltip في الوضع المصغر (Icon mode)

> [!WARNING]
> **صفحة متابعة الحفظ:**
> - عدم تصغير الخط أكثر من اللازم (يجب أن يبقى مقروءاً)
> - الحفاظ على سهولة الضغط على الأزرار (Touch target لا يقل عن 40px)
> - اختبار على شاشات مختلفة (320px, 375px, 414px)

---

## معايير النجاح

### القائمة الجانبية
- [ ] القوائم الفرعية تفتح داخل الشريط الجانبي
- [ ] سهولة الوصول لجميع الصفحات بإصبع واحد
- [ ] الأيقونة تدور بسلاسة عند الفتح/الإغلاق
- [ ] الألوان متناسقة مع الثيم

### صفحة متابعة الحفظ
- [ ] عرض 12-15 سورة على الأقل في الشاشة الواحدة (هاتف صغير)
- [ ] عدم تداخل أي نصوص
- [ ] قراءة واضحة لأسماء السور
- [ ] سهولة الضغط على الأزرار

---

## الخطوة التالية

بعد موافقتك على هذه الخطة، سأبدأ مباشرة بالتنفيذ:
1. تعديل `ClientLayout.tsx` للقائمة الجانبية
2. تعديل `surahs/page.tsx` لصفحة متابعة الحفظ
3. اختبار التغييرات
4. تحديث ملف `walkthrough.md`

**هل أنت موافق على هذه الخطة؟** 🚀
