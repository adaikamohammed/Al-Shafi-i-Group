
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Clock, Database, Lock, Users } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-headline font-bold">الإعدادات</h1>
      <Card>
        <CardHeader>
          <CardTitle>نظرة عامة على التطبيق</CardTitle>
          <CardDescription>
            هذه الصفحة تعرض الميزات الحالية والمستقبلية المخطط لها لتطوير التطبيق.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
                <h3 className="font-semibold text-lg font-headline mb-3">الميزات الحالية:</h3>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li className="flex items-center">
                        <Lock className="ml-2 h-4 w-4 text-green-500" />
                        <span>نظام مصادقة آمن باستخدام البريد الإلكتروني وكلمة المرور.</span>
                    </li>
                    <li className="flex items-center">
                        <Users className="ml-2 h-4 w-4 text-green-500" />
                        <span>إدارة كاملة للطلبة (إضافة, تعديل, حذف, طرد).</span>
                    </li>
                    <li className="flex items-center">
                        <CheckCircle className="ml-2 h-4 w-4 text-green-500" />
                        <span>تسجيل الحصص اليومية وتتبع الحضور والأداء.</span>
                    </li>
                    <li className="flex items-center">
                        <Database className="ml-2 h-4 w-4 text-green-500" />
                        <span>تخزين جميع البيانات بشكل آمن في Firestore وربطها بحساب المعلم.</span>
                    </li>
                    <li className="flex items-center">
                        <CheckCircle className="ml-2 h-4 w-4 text-green-500" />
                        <span>استيراد وتصدير بيانات الطلبة والحصص باستخدام ملفات Excel.</span>
                    </li>
                    <li className="flex items-center">
                        <CheckCircle className="ml-2 h-4 w-4 text-green-500" />
                        <span>لوحة إحصائيات تفاعلية لمتابعة تقدم الفوج.</span>
                    </li>
                </ul>
            </div>

            <div>
                <h3 className="font-semibold text-lg font-headline mt-6 mb-3">الميزات المخطط لها:</h3>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li className="flex items-center">
                    <Clock className="ml-2 h-4 w-4 text-yellow-500" />
                    <span>تخصيص أكبر لحساب المعلم (تغيير الصورة، كلمة المرور).</span>
                </li>
                <li className="flex items-center">
                    <Clock className="ml-2 h-4 w-4 text-yellow-500" />
                    <span>إرسال تقارير تلقائيًا إلى لوحة تحكم الإدارة.</span>
                </li>
                <li className="flex items-center">
                    <Clock className="ml-2 h-4 w-4 text-yellow-500" />
                    <span>نظام إشعارات وتنبيهات لأولياء الأمور عبر التطبيق.</span>
                </li>
                <li className="flex items-center">
                    <Clock className="ml-2 h-4 w-4 text-yellow-500" />
                    <span>سجل الاستدعاءات والردود من الإدارة.</span>
                </li>
                </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
