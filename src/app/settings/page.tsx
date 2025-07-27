import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Clock } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-headline font-bold">الإعدادات</h1>
      <Card>
        <CardHeader>
          <CardTitle>الإعدادات والتطوير المستقبلي</CardTitle>
          <CardDescription>
            هذه الصفحة مخصصة للإعدادات المستقبلية للتطبيق.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <h3 className="font-semibold text-lg font-headline">الميزات المخطط لها:</h3>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li className="flex items-center">
                <Clock className="ml-2 h-4 w-4 text-yellow-500" />
                <span>إضافة نظام مصادقة (Firebase Authentication) لتسجيل دخول آمن.</span>
              </li>
              <li className="flex items-center">
                <Clock className="ml-2 h-4 w-4 text-yellow-500" />
                <span>ربط كل شيخ بفوجه الخاص للوصول المحدد للبيانات.</span>
              </li>
              <li className="flex items-center">
                <Clock className="ml-2 h-4 w-4 text-yellow-500" />
                <span>إرسال التقارير تلقائيًا إلى لوحة تحكم الإدارة.</span>
              </li>
              <li className="flex items-center">
                <Clock className="ml-2 h-4 w-4 text-yellow-500" />
                <span>نظام إشعارات وتنبيهات لأولياء الأمور.</span>
              </li>
              <li className="flex items-center">
                 <Clock className="ml-2 h-4 w-4 text-yellow-500" />
                <span>سجل الاستدعاءات والردود من الإدارة.</span>
              </li>
            </ul>

            <h3 className="font-semibold text-lg font-headline mt-6">الميزات الحالية:</h3>
             <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li className="flex items-center">
                    <CheckCircle className="ml-2 h-4 w-4 text-green-500" />
                    <span>إدارة كاملة للطلبة (إضافة, تعديل, حذف, طرد).</span>
                </li>
                 <li className="flex items-center">
                    <CheckCircle className="ml-2 h-4 w-4 text-green-500" />
                    <span>تسجيل الحصص اليومية.</span>
                </li>
                 <li className="flex items-center">
                    <CheckCircle className="ml-2 h-4 w-4 text-green-500" />
                    <span>تتبع حفظ السور.</span>
                </li>
                 <li className="flex items-center">
                    <CheckCircle className="ml-2 h-4 w-4 text-green-500" />
                    <span>لوحة إحصائيات تفاعلية.</span>
                </li>
                 <li className="flex items-center">
                    <CheckCircle className="ml-2 h-4 w-4 text-green-500" />
                    <span>استيراد وتصدير البيانات.</span>
                </li>
             </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
