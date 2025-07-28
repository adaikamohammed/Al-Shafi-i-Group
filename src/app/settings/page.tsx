
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Clock, Database, Lock, Users, Smartphone, Palette, Search, BarChartHorizontal, FileDown, CalendarDays } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-headline font-bold">الإعدادات</h1>
      <Card>
        <CardHeader>
          <CardTitle>✨ نظرة عامة على التطبيق</CardTitle>
          <CardDescription>
            هذه الصفحة تعرض الميزات المفعّلة حاليًا، بالإضافة إلى الميزات التقنية المخطط إضافتها في المستقبل لتطوير المنصة.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
                <h3 className="font-semibold text-lg font-headline mb-4">الميزات الحالية المفعّلة ✅</h3>
                <ul className="space-y-3">
                    <li className="flex items-start p-3 bg-muted rounded-md border-r-4 border-primary">
                        <Lock className="ml-3 h-5 w-5 text-primary flex-shrink-0 mt-1" />
                        <span><strong>نظام تسجيل دخول آمن</strong> يعتمد على البريد وكلمة المرور مع حفظ الجلسة.</span>
                    </li>
                    <li className="flex items-start p-3 bg-muted rounded-md border-r-4 border-primary">
                        <Users className="ml-3 h-5 w-5 text-primary flex-shrink-0 mt-1" />
                        <span><strong>إدارة كاملة للطلبة</strong> (إضافة، تعديل، حذف، طرد، وتصدير).</span>
                    </li>
                    <li className="flex items-start p-3 bg-muted rounded-md border-r-4 border-primary">
                        <CalendarDays className="ml-3 h-5 w-5 text-primary flex-shrink-0 mt-1" />
                        <span><strong>واجهة الحصص اليومية</strong> لتسجيل الأداء والمراجعة في الوقت الفعلي.</span>
                    </li>
                     <li className="flex items-start p-3 bg-muted rounded-md border-r-4 border-primary">
                        <BarChartHorizontal className="ml-3 h-5 w-5 text-primary flex-shrink-0 mt-1" />
                        <span><strong>تقارير مرئية</strong> شهرية وأسبوعية لمتابعة الحضور والسلوك والتقييم.</span>
                    </li>
                    <li className="flex items-start p-3 bg-muted rounded-md border-r-4 border-primary">
                        <Search className="ml-3 h-5 w-5 text-primary flex-shrink-0 mt-1" />
                        <span><strong>فلترة متقدمة</strong> في كل الصفحات (حسب الطالب، التاريخ، الحالة).</span>
                    </li>
                    <li className="flex items-start p-3 bg-muted rounded-md border-r-4 border-primary">
                        <Smartphone className="ml-3 h-5 w-5 text-primary flex-shrink-0 mt-1" />
                        <span><strong>تخزين محلي ذكي</strong> (LocalStorage) لضمان السرعة عند التنقل بين الصفحات.</span>
                    </li>
                    <li className="flex items-start p-3 bg-muted rounded-md border-r-4 border-primary">
                        <FileDown className="ml-3 h-5 w-5 text-primary flex-shrink-0 mt-1" />
                        <span><strong>دعم تصدير واستيراد Excel</strong> لتنظيم بيانات الطلبة والحصص.</span>
                    </li>
                </ul>
            </div>

            <div>
                <h3 className="font-semibold text-lg font-headline mt-0 mb-4">الميزات القادمة في التحديثات المستقبلية 📌</h3>
                <ul className="space-y-3">
                    <li className="flex items-start p-3 bg-amber-50 rounded-md border-r-4 border-amber-400">
                        <Database className="ml-3 h-5 w-5 text-amber-500 flex-shrink-0 mt-1" />
                        <span><strong>ربط مباشر بقاعدة بيانات سحابية</strong> (مثل Firebase أو Supabase) لمزامنة البيانات.</span>
                    </li>
                    <li className="flex items-start p-3 bg-amber-50 rounded-md border-r-4 border-amber-400">
                        <Clock className="ml-3 h-5 w-5 text-amber-500 flex-shrink-0 mt-1" />
                        <span><strong>إرسال تقارير PDF تلقائيًا</strong> إلى البريد الإلكتروني للإدارة أو أولياء الأمور.</span>
                    </li>
                    <li className="flex items-start p-3 bg-amber-50 rounded-md border-r-4 border-amber-400">
                        <Clock className="ml-3 h-5 w-5 text-amber-500 flex-shrink-0 mt-1" />
                        <span><strong>نظام إشعارات ذكي</strong> لتنبيه المعلم، المدير، وأولياء الأمور بالأحداث المهمة.</span>
                    </li>
                     <li className="flex items-start p-3 bg-amber-50 rounded-md border-r-4 border-amber-400">
                        <Clock className="ml-3 h-5 w-5 text-amber-500 flex-shrink-0 mt-1" />
                        <span><strong>تخصيص الملف الشخصي للمعلم</strong> (صورة، اسم العرض، بريد التواصل).</span>
                    </li>
                    <li className="flex items-start p-3 bg-amber-50 rounded-md border-r-4 border-amber-400">
                        <Clock className="ml-3 h-5 w-5 text-amber-500 flex-shrink-0 mt-1" />
                        <span><strong>لوحة تحكم متقدمة للمدير</strong> مع صلاحيات مخصصة لمتابعة الأفواج.</span>
                    </li>
                    <li className="flex items-start p-3 bg-amber-50 rounded-md border-r-4 border-amber-400">
                        <Clock className="ml-3 h-5 w-5 text-amber-500 flex-shrink-0 mt-1" />
                        <span><strong>وضع مراجعة جماعية</strong> يتيح تتبع السور الأكثر ضعفًا على مستوى الفوج.</span>
                    </li>
                </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
